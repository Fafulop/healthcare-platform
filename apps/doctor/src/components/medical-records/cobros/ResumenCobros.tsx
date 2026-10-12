'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Receipt, Wallet } from 'lucide-react';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import type { BookingPermisos } from '@/lib/booking-permisos';
import { useCfdiDrafts, type BookingsEstado } from './CitasIngresosSection';
import { calcularCuenta } from './cuenta';

const pesos = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const SIN_ENTRADAS = new Set<number>();

/**
 * VISITAS 10-PLAN P3 — en el perfil, en lugar de «Citas e Ingresos» (que se mudó a la página «Cobros»):
 * lo que pide atención y la entrada a Cobros. Los números salen de `calcularCuenta` — la MISMA regla que la
 * página Cobros (sin las ventas, que aquí no se piden: por eso dice «de sus citas»). Cada número sólo con
 * su permiso; sin `citas` la lista llega vacía a propósito y no se cuenta nada (sólo el enlace). Los
 * borradores de factura del asistente se avisan aquí: ya no se pintan en el perfil y uno invisible
 * bloquea preparar otro (409).
 */
export function ResumenCobros({ patientId, bookings, permisos, estado }: {
  patientId: string;
  bookings: PatientBooking[];
  permisos: BookingPermisos | null;
  estado: BookingsEstado;
}) {
  const verCitas = permisos?.citas ?? false;
  const verCobro = permisos?.flujo ?? false;
  const verFactura = permisos?.facturacion ?? false;
  const cuenta = useMemo(() => calcularCuenta(bookings, null), [bookings]);
  const { byLedgerEntry, sueltos } = useCfdiDrafts(patientId, SIN_ENTRADAS, verFactura);
  const borradores = sueltos.length + [...byLedgerEntry.values()].reduce((n, l) => n + l.length, 0);
  const href = `/dashboard/medical-records/patients/${patientId}/cobros`;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* La acción de entrada de la sección vieja se queda en el perfil: es la más usada. */}
      {verFactura && (
        <Link
          href={`/dashboard/facturacion?patient=${patientId}`}
          className="w-full mb-4 px-4 py-3 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Receipt className="w-4 h-4" /> Nueva factura manual
        </Link>
      )}
      <Link href={href} className="flex items-center justify-between gap-2 group">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-teal-600" /> Cobros
        </h2>
        <span className="text-sm text-blue-600 group-hover:text-blue-800 flex items-center gap-0.5">
          Ver <ChevronRight className="w-4 h-4" />
        </span>
      </Link>
      <div className="mt-3 text-sm text-gray-700 space-y-1">
        {estado === 'cargando' ? (
          <p className="text-gray-400">Cargando…</p>
        ) : estado === 'error' ? (
          <p className="text-amber-700">No se pudieron cargar sus citas. Recarga la página para intentar de nuevo.</p>
        ) : !verCitas ? (
          <p className="text-gray-500">Sus citas, cobros, facturas y ventas, en «Cobros».</p>
        ) : (
          <>
            {verCobro && (
              <>
                {/* Los mismos tres números que «Cobros» (aquí sin ventas: el perfil no las carga). */}
                <p>Cobrado (de sus citas): <strong className="text-green-700">{pesos(cuenta.cobrado)}</strong></p>
                <p>Por cobrar · próximas citas: <strong>{pesos(cuenta.porCobrarProximas)}</strong></p>
                <p>Por cobrar · citas pasadas sin completar:{' '}
                  <strong className={cuenta.porCobrarPasadas > 0 ? 'text-amber-700' : undefined}>{pesos(cuenta.porCobrarPasadas)}</strong>
                </p>
                {cuenta.otrosPendientes > 0 && <p className="text-xs text-gray-600">Cobros registrados sin pagar completo (de citas ya concluidas): {pesos(cuenta.otrosPendientes)}</p>}
              </>
            )}
            {verFactura && (
              <p>{cuenta.porFacturar === 0 ? 'Nada listo para facturar.' : `${cuenta.porFacturar === 1 ? '1 cita lista' : `${cuenta.porFacturar} citas listas`} para facturar.`}</p>
            )}
            {verFactura && borradores > 0 && (
              <p className="text-blue-700">{borradores === 1 ? '1 borrador de factura' : `${borradores} borradores de factura`} del asistente: revísalos en «Cobros».</p>
            )}
            <p className="text-xs text-gray-500">Citas, totales, facturas y ventas del paciente, en «Cobros».</p>
          </>
        )}
      </div>
    </div>
  );
}
