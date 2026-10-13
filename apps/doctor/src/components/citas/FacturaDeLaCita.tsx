'use client';

import { useState } from 'react';
import { Download, Loader2, MessageCircle, Receipt, Send, Share2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import type { ContactoEnvio } from './enviar-enlace';
import { compartirArchivo, descargarBlob } from './compartir-archivo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function bajarCfdi(cfdiId: number, formato: 'pdf' | 'xml'): Promise<Blob> {
  const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/${formato}`);
  if (!res.ok) throw new Error();
  return res.blob();
}

/**
 * 2026-10-12 (pedido del usuario) — la FACTURA de la cita desde su tarjeta (agenda, visita, «Cobros»):
 * PDF · XML · «Factura por correo» (la manda Facturama al correo del paciente, como en Facturación) ·
 * «Factura por WhatsApp» (el «Compartir» del equipo con el PDF adjunto — WhatsApp no recibe archivos por
 * enlace y el PDF NO se publica en internet; decisión del usuario, opción A). WhatsApp va en DOS pasos:
 * primero se prepara el PDF y luego «Compartir PDF» abre el «Compartir» al instante (el navegador sólo
 * deja compartir justo después de un clic). Sin una factura de la plataforma se dice dónde verla.
 */
export function FacturaDeLaCita({ cfdiId, cfdiStatus, folio, contacto, nombrePaciente }: {
  cfdiId: number | null | undefined;
  cfdiStatus?: string | null;
  /** Serie-folio: el archivo se llama como la factura que ve el doctor, no con un número interno. */
  folio?: string | null;
  contacto: ContactoEnvio;
  nombrePaciente?: string;
}) {
  const [ocupado, setOcupado] = useState<null | 'correo' | 'wa' | 'pdf' | 'xml'>(null);
  // El PDF preparado es de ESTA factura: si cambia (se canceló y se re-emitió), se tira.
  const [listo, setListo] = useState<{ cfdiId: number; archivo: File } | null>(null);
  const archivoListo = listo && listo.cfdiId === cfdiId ? listo.archivo : null;

  const nombre = (ext: string) => `factura_${(folio || String(cfdiId)).replace(/[^\w-]/g, '')}.${ext}`;

  if (!cfdiId) {
    // Facturada, pero sin una factura de ingreso vigente de la plataforma (subida a mano, detectada en el
    // SAT, u otro tipo de CFDI): no se afirma de dónde — se dice dónde verla.
    return (
      <span className="text-xs text-teal-700 flex items-center gap-1">
        <Receipt className="w-3.5 h-3.5" /> Facturada — su factura se ve en Facturación
      </span>
    );
  }

  const descargar = async (formato: 'pdf' | 'xml') => {
    setOcupado(formato);
    try {
      descargarBlob(await bajarCfdi(cfdiId, formato), nombre(formato));
    } catch {
      toast.error(`No se pudo descargar el ${formato.toUpperCase()}`);
    } finally {
      setOcupado(null);
    }
  };

  const porCorreo = async () => {
    setOcupado('correo');
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/email`, {
        method: 'POST', body: JSON.stringify({ email: contacto.email }),
      });
      const d = await res.json().catch(() => null);
      // La ruta contesta 200 con `data.sent` — que Facturama lo haya mandado de verdad (code review).
      if (res.ok && d?.data?.sent === true) toast.success(`Se envió la factura a ${contacto.email}`);
      else toast.error(d?.data?.message || d?.error || 'No se pudo enviar la factura');
    } catch {
      toast.error('No se pudo enviar la factura');
    } finally {
      setOcupado(null);
    }
  };

  const preparar = async () => {
    setOcupado('wa');
    try {
      setListo({ cfdiId, archivo: new File([await bajarCfdi(cfdiId, 'pdf')], nombre('pdf'), { type: 'application/pdf' }) });
    } catch {
      toast.error('No se pudo preparar la factura');
    } finally {
      setOcupado(null);
    }
  };

  const chico = 'text-xs px-2 py-1 rounded flex items-center gap-1 disabled:opacity-60';
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-teal-700 font-medium flex items-center gap-1 mr-0.5">
        <Receipt className="w-3.5 h-3.5" /> Factura:
      </span>
      {cfdiStatus === 'cancellation_pending' && (
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Cancelación en proceso</span>
      )}
      <button onClick={() => descargar('pdf')} disabled={!!ocupado} className={`${chico} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
        {ocupado === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
      </button>
      <button onClick={() => descargar('xml')} disabled={!!ocupado} className={`${chico} bg-gray-100 text-gray-700 hover:bg-gray-200`}>
        {ocupado === 'xml' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} XML
      </button>
      {contacto.email ? (
        <button onClick={porCorreo} disabled={!!ocupado} className={`${chico} bg-teal-100 text-teal-700 hover:bg-teal-200`}>
          {ocupado === 'correo' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Factura por correo
        </button>
      ) : contacto.falta('correo')}
      {archivoListo ? (
        <button
          onClick={() => { void compartirArchivo(archivoListo); }}
          disabled={!!ocupado}
          className={`${chico} bg-green-600 text-white hover:bg-green-700`}
          title="Abre el «Compartir» de tu equipo con el PDF: elige WhatsApp y el chat del paciente"
        >
          <Share2 className="w-3 h-3" /> Compartir PDF
        </button>
      ) : (
        <button onClick={preparar} disabled={!!ocupado} className={`${chico} bg-green-100 text-green-700 hover:bg-green-200`}
          title="Prepara el PDF y luego «Compartir PDF» abre el «Compartir» de tu equipo (elige WhatsApp)">
          {ocupado === 'wa' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />} Factura por WhatsApp
        </button>
      )}
    </div>
  );
}
