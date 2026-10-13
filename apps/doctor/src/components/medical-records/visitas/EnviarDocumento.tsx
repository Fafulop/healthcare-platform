'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import { DocumentoPdfModal } from '@/components/pdf/DocumentoPdfModal';
import { NotaVentaModal } from '@/app/dashboard/practice/ventas/_components/NotaVentaModal';
import { notaDeVenta } from '@/app/dashboard/practice/ventas/_components/comprador';
import { dibujarReceta, nombreArchivoReceta } from '@/lib/receta-pdf';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * 2026-10-12 (pedido del usuario) — «Enviar» en cada receta EMITIDA y cada venta de la visita: abre la vista
 * previa del PDF (la MISMA de siempre) con «Enviar por correo» (adjunto, desde el Gmail del doctor, al correo
 * del expediente) y «Compartir PDF» (el «Compartir» del equipo → WhatsApp; el PDF no se publica). Se manda
 * exactamente lo que se ve. Se va por la ventana porque el PDF lo dibuja el navegador.
 */
export function EnviarDocumento({ tipo, id, patientId }: { tipo: 'receta' | 'venta'; id: string | number; patientId: string }) {
  const [cargando, setCargando] = useState(false);
  const [receta, setReceta] = useState<any | null>(null);
  const [venta, setVenta] = useState<any | null>(null);

  const abrir = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCargando(true);
    try {
      if (tipo === 'receta') {
        const r = await fetch(`/api/medical-records/patients/${patientId}/prescriptions/${id}`);
        if (!r.ok) throw new Error();
        setReceta((await r.json()).data);
      } else {
        const r = await authFetch(`${API_URL}/api/practice-management/ventas/${id}`);
        if (!r.ok) throw new Error();
        setVenta((await r.json()).data);
      }
    } catch {
      toast.error(`No se pudo abrir ${tipo === 'receta' ? 'la receta' : 'la nota de venta'}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={cargando}
        title={tipo === 'receta' ? 'Ver la receta y mandarla por correo o WhatsApp' : 'Ver la nota de venta y mandarla por correo o WhatsApp'}
        className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 flex items-center gap-1 shrink-0 disabled:opacity-50"
      >
        {cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar
      </button>
      {receta && (
        <DocumentoPdfModal
          titulo={`Receta${receta.diagnosis ? ` · ${receta.diagnosis}` : ''}`}
          nombreArchivo={nombreArchivoReceta(receta)}
          queEs="la receta"
          // La MISMA función que «Descargar PDF» de la receta (diseño, logo, firma y ajustes de la receta).
          dibujar={(jsPDF, _autoTable, _emisor, diseno, rx) => dibujarReceta(jsPDF, receta, diseno, rx)}
          envio={{ tipo: 'receta', id }}
          onClose={() => setReceta(null)}
        />
      )}
      {venta && (
        <NotaVentaModal venta={notaDeVenta(venta)} envio={{ tipo: 'venta', id }} onClose={() => setVenta(null)} />
      )}
    </>
  );
}
