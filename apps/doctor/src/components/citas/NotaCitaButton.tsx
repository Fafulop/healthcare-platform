'use client';

/**
 * «Nota de venta» of a cita — VENTAS PACIENTE paso 4. The nota is the cita's own charge (its Flujo de
 * Dinero entry) drawn as a «Nota de venta», generated ON DEMAND by GET /api/appointments/bookings/:id/nota
 * — not a sale, no stored file, no second income (decision 2). Same PDF + preview as a venta's nota
 * (`NotaVentaModal`).
 *
 * 2026-10-12 — a ROW of the cita card like the others: Correo · WhatsApp · Ver.
 *   · Correo  → opens the preview and sends it as soon as it's drawn (one click, like the other rows);
 *   · WhatsApp → opens the preview; its «Compartir PDF» opens the device share sheet (the browser only
 *     allows sharing right after a click, so it can't fire on its own);
 *   · Ver     → opens the preview.
 * Sending is the titular's only (it leaves from HIS Gmail — server: OWNER_ONLY); seeing it needs `flujo`.
 */
import { useState } from 'react';
import { Eye, MessageCircle, Send } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { usePermissions } from '@/lib/permissions-client';
import { toast } from '@/lib/practice-toast';
import { NotaVentaModal } from '@/app/dashboard/practice/ventas/_components/NotaVentaModal';
import type { NotaVentaDatos } from '@/lib/nota-venta-pdf';
import { BotonCita, COLUMNA, FilaCita, Hueco } from './fila-cita';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function NotaCitaButton({ bookingId, motivo, motivoCorto }: {
  bookingId: string;
  /** No hay nota que ver (sin cobro, cubierta por el paquete…): la fila gris con este porqué. */
  motivo?: string | null;
  /** El mismo motivo en pocas palabras, para la columna de estado. */
  motivoCorto?: string | null;
}) {
  const { can, isOwner, loading } = usePermissions();
  const [cargando, setCargando] = useState<null | 'correo' | 'wa' | 'ver'>(null);
  const [nota, setNota] = useState<NotaVentaDatos | null>(null);
  const [alAbrir, setAlAbrir] = useState<'correo' | undefined>(undefined);

  const sinPermiso = loading ? 'Cargando tus permisos…' : !can('flujo') ? 'Ver la nota necesita permiso de Flujo de Dinero' : null;
  const noSeVe = motivo ?? sinPermiso;
  const titular = isOwner === true;
  const noSeManda = noSeVe ?? (titular ? null : 'Sólo el titular de la cuenta la manda (sale de su Gmail)');

  const abrir = async (como: 'correo' | 'wa' | 'ver') => {
    setCargando(como);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/bookings/${bookingId}/nota`);
      const body = await res.json().catch(() => null);
      // 404 «Esta cita no tiene cobro registrado» is a real answer, not a crash: say it.
      if (!res.ok) throw new Error(body?.error || 'No se pudo generar la nota');
      setAlAbrir(como === 'correo' ? 'correo' : undefined);
      setNota(body.data);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo generar la nota');
    } finally {
      setCargando(null);
    }
  };

  return (
    <>
      <FilaCita nombre="Nota de venta" estado={noSeVe ? motivoCorto ?? 'No aplica' : 'Lista'} tono={noSeVe ? 'apagado' : 'neutro'}>
        <BotonCita
          etiqueta="Correo" icono={<Send className="w-3 h-3" />} onClick={() => abrir('correo')} ocupado={cargando === 'correo'}
          motivo={noSeManda} ancho={COLUMNA.correo} titulo="Abre la nota y la manda al correo del paciente"
        />
        <BotonCita
          etiqueta="WhatsApp" icono={<MessageCircle className="w-3 h-3" />} onClick={() => abrir('wa')} ocupado={cargando === 'wa'}
          motivo={noSeManda} ancho={COLUMNA.whatsapp} titulo="Abre la nota: «Compartir PDF» la manda por WhatsApp"
        />
        <BotonCita
          etiqueta="Ver" icono={<Eye className="w-3 h-3" />} onClick={() => abrir('ver')} ocupado={cargando === 'ver'}
          motivo={noSeVe} ancho={COLUMNA.ver}
        />
        <Hueco ancho={COLUMNA.extra} />
      </FilaCita>
      {nota && (
        <NotaVentaModal
          venta={nota}
          envio={titular ? { tipo: 'cita', id: bookingId } : undefined}
          alAbrir={titular ? alAbrir : undefined}
          onClose={() => { setNota(null); setAlAbrir(undefined); }}
        />
      )}
    </>
  );
}
