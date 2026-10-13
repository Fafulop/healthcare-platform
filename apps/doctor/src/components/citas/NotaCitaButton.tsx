'use client';

/**
 * «Nota» of a COMPLETED cita — VENTAS PACIENTE paso 4. The nota is the cita's own charge (its Flujo
 * de Dinero entry) drawn as a «Nota de venta», generated ON DEMAND by GET
 * /api/appointments/bookings/:id/nota — not a sale, no stored file, no second income (decision 2).
 *
 * Same PDF + preview as a venta's nota (`NotaVentaModal`). Shown only with the `flujo` toggle, like
 * the charge itself (the route enforces it too). Used by the cita card (agenda) and the visita.
 */
import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { usePermissions } from '@/lib/permissions-client';
import { toast } from '@/lib/practice-toast';
import { NotaVentaModal } from '@/app/dashboard/practice/ventas/_components/NotaVentaModal';
import type { NotaVentaDatos } from '@/lib/nota-venta-pdf';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function NotaCitaButton({ bookingId, className }: { bookingId: string; className?: string }) {
  const { can, loading } = usePermissions();
  const [cargando, setCargando] = useState(false);
  const [nota, setNota] = useState<NotaVentaDatos | null>(null);

  if (loading || !can('flujo')) return null;

  const abrir = async () => {
    setCargando(true);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/bookings/${bookingId}/nota`);
      const body = await res.json().catch(() => null);
      // 404 «Esta cita no tiene cobro registrado» is a real answer, not a crash: say it.
      if (!res.ok) throw new Error(body?.error || 'No se pudo generar la nota');
      setNota(body.data);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo generar la nota');
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
        title="Ver y descargar la nota de venta de esta cita"
        // Más grande (pedido del usuario 2026-10-12): se perdía entre los chips.
        className={className ?? 'text-sm px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200 flex items-center gap-1.5 font-medium disabled:opacity-50'}
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Nota de venta
      </button>
      {nota && <NotaVentaModal venta={nota} onClose={() => setNota(null)} />}
    </>
  );
}
