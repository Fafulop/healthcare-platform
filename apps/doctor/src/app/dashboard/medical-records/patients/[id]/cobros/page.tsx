'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, ShoppingCart, Wallet } from 'lucide-react';
import { usePatientProfile } from '../../_components/usePatientProfile';
import { useVisitasDelPaciente } from '@/components/medical-records/visitas/useVisitasDelPaciente';
import { CitasIngresosSection, type BookingsEstado } from '@/components/medical-records/cobros/CitasIngresosSection';
import { useTarjetaDeCita } from '@/components/citas/useTarjetaDeCita';
import { TarjetaDeCita } from '@/app/dashboard/appointments/_components/TarjetaDeCita';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import type { BookingPermisos } from '@/lib/booking-permisos';
import { usePermissions } from '@/lib/permissions-client';
import { authFetch } from '@/lib/auth-fetch';
import { visitaHref } from '@/lib/visitas-ui';
import { calcularCuenta } from '@/components/medical-records/cobros/cuenta';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const pesos = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

interface VentaDelPaciente {
  id: number; saleNumber: string; saleDate: string; total: string; amountPaid: string | null;
  status: string; paymentStatus: string; visitaId: string | null;
  items: { description: string }[];
}
const VENTA_PAGO: Record<string, string> = { PENDING: 'Pendiente', PARTIAL: 'Pago parcial', PAID: 'Pagada' };

/**
 * VISITAS 10-PLAN P2 — «Cobros» del expediente: el estado de cuenta del paciente.
 *   · Totales (con `flujo`): lo REGISTRADO (ingresos de sus citas + sus ventas), lo pagado y lo que se debe
 *     de eso; aparte, lo que está por cobrar de las citas agendadas (su precio de lista). No se adivina: una
 *     cita completada SIN ingreso (cortesía, o sin registrar) no suma — se cuenta y se dice.
 *   · Las citas: `CitasIngresosSection` (la que estuvo en el perfil hasta P3: Facturar, CFDI, borradores),
 *     cada una con su visita y la tarjeta completa de la cita (la de la agenda) plegada.
 *   · Las ventas (con `ventas`), cada una con su visita.
 */
export default function CobrosPage() {
  const { patientId, doctorId, patient, loading, error, sessionStatus } = usePatientProfile();
  const { can, loading: permisosCargando } = usePermissions();
  const pacienteHref = `/dashboard/medical-records/patients/${patientId}`;

  // Las citas del expediente (mismo endpoint y mismos permisos que el perfil).
  const [bookings, setBookings] = useState<PatientBooking[]>([]);
  const [permisos, setPermisos] = useState<BookingPermisos | null>(null);
  const [estado, setEstado] = useState<BookingsEstado>('cargando');
  const cargarCitas = useCallback(async () => {
    try {
      const d = await fetch(`/api/medical-records/patients/${patientId}/bookings`).then((r) => r.json());
      if (!Array.isArray(d?.data) || !d?.permisos) throw new Error();
      setBookings(d.data); setPermisos(d.permisos); setEstado('ok');
    } catch {
      setEstado('error');
    }
  }, [patientId]);
  useEffect(() => { if (patientId) cargarCitas(); }, [patientId, cargarCitas]);

  const verCitas = permisos?.citas ?? false;
  const verCobro = permisos?.flujo ?? false;
  const verFactura = permisos?.facturacion ?? false;

  // La visita de cada cita (para el enlace).
  const visitas = useVisitasDelPaciente(patientId, !!patientId);
  const visitaDeCita = useMemo(
    () => new Map(visitas.visitas.flatMap((v) => (v.cita ? [[v.cita.id, v.id] as const] : []))),
    [visitas.visitas],
  );

  // La tarjeta completa de la cita (10-PLAN P1), plegada en cada renglón.
  const tarjeta = useTarjetaDeCita({
    doctorId: verCitas ? doctorId : null,
    patientId,
    volverA: `${pacienteHref}/cobros`,
    despues: async () => { await Promise.all([cargarCitas(), visitas.recargar()]); },
  });
  const [abierta, setAbierta] = useState<string | null>(null);

  // Las ventas (apps/api), con su toggle. null = cargando · 'error' = no se pudo (se DICE).
  const puedeVentas = !permisosCargando && can('ventas');
  const [ventas, setVentas] = useState<VentaDelPaciente[] | null | 'error'>(null);
  const [ventasTotal, setVentasTotal] = useState(0);
  useEffect(() => {
    if (!puedeVentas || !patientId) return;
    let vigente = true;
    authFetch(`${API_URL}/api/practice-management/ventas?patientId=${encodeURIComponent(patientId)}&limit=200`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (vigente) { setVentas(d.data || []); setVentasTotal(Number(d.pagination?.total ?? (d.data || []).length)); } })
      .catch(() => { if (vigente) setVentas('error'); });
    return () => { vigente = false; };
  }, [puedeVentas, patientId]);

  // La regla vive en `cobros/cuenta.ts`: la misma que el resumen del perfil (si no, se contradecían).
  const totales = useMemo(() => calcularCuenta(bookings, Array.isArray(ventas) ? ventas : null), [bookings, ventas]);

  if (sessionStatus === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-blue-600" /></div>;
  }
  if (error || !patient) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900">No se pudo cargar el paciente. Recarga la página para intentar de nuevo.</p>
          <Link href={pacienteHref} className="text-amber-800 underline mt-2 inline-block">Volver al paciente</Link>
        </div>
      </div>
    );
  }

  const ventasListas = Array.isArray(ventas);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <Link href={pacienteHref} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeft className="w-5 h-5" /> Volver al Paciente
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-teal-600" /> Cobros
        </h1>
        <p className="text-base font-medium text-gray-700 mt-1">{patient.firstName} {patient.lastName}</p>
      </div>

      {/* Totales — con `flujo` (los montos) Y `citas` (sin él la lista de citas llega vacía A PROPÓSITO:
          sumar sólo las ventas afirmaría un saldo falso). */}
      {verCobro && !verCitas && estado === 'ok' && (
        <p className="text-sm text-gray-600 bg-white rounded-lg shadow p-4">
          Sin permiso de citas no se pueden calcular los totales del paciente.
        </p>
      )}
      {verCobro && verCitas && estado === 'ok' && (
        <div className="bg-white rounded-lg shadow p-5">
          <div className="grid grid-cols-3 gap-3">
            <div><p className="text-xs text-gray-500">Registrado</p><p className="text-lg font-semibold text-gray-900">{pesos(totales.registrado)}</p></div>
            <div><p className="text-xs text-gray-500">Pagado</p><p className="text-lg font-semibold text-green-700">{pesos(totales.pagado)}</p></div>
            <div><p className="text-xs text-gray-500">Pendiente</p><p className={`text-lg font-semibold ${totales.pendiente > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{pesos(totales.pendiente)}</p></div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Registrado = los cobros de sus citas (lo que se registró al completarlas o pagar su link)
            {puedeVentas ? ' y sus ventas' : ''}. Pendiente = lo registrado que falta pagar.
            {puedeVentas && ventas === null && ' (Cargando las ventas…)'}
            {ventas === 'error' && ' ⚠️ No se pudieron cargar las ventas: no están en el total.'}
            {Array.isArray(ventas) && ventasTotal > ventas.length && ` ⚠️ Sólo cuentan las ${ventas.length} ventas más recientes de ${ventasTotal}.`}
          </p>
          {(totales.porCobrar > 0 || totales.completadasSinCobro > 0) && (
            <p className="text-xs text-gray-600 mt-1">
              {totales.porCobrar > 0 && <>Por cobrar de sus citas agendadas: <strong>{pesos(totales.porCobrar)}</strong> (su precio). </>}
              {totales.completadasSinCobro > 0 && (
                <>{totales.completadasSinCobro === 1 ? '1 cita completada' : `${totales.completadasSinCobro} citas completadas`} sin cobro registrado (cortesía o sin registrar): no suman.</>
              )}
            </p>
          )}
        </div>
      )}

      {/* Las citas: la sección de siempre + su visita + la tarjeta completa de la cita. */}
      <CitasIngresosSection
        bookings={bookings} permisos={permisos} estado={estado} patient={patient}
        titulo="Citas"
        datosFiscalesHref={`${pacienteHref}#datos-fiscales`}
        extraPorCita={(b) => {
          const visitaId = visitaDeCita.get(b.id);
          const cita = tarjeta.porId(b.id);
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap text-xs">
                {visitaId && (
                  <Link href={visitaHref(patientId, visitaId)} className="text-blue-600 hover:text-blue-800 hover:underline">
                    Abrir su visita
                  </Link>
                )}
                {verCitas && !cita && (
                  <span className="text-gray-400">
                    {tarjeta.fallo ? 'No se pudieron cargar las acciones de la cita' : 'Cargando acciones…'}
                  </span>
                )}
                {verCitas && cita && (
                  <button
                    type="button" onClick={() => setAbierta((x) => (x === b.id ? null : b.id))}
                    className="text-blue-700 hover:text-blue-900 flex items-center gap-1" aria-expanded={abierta === b.id}
                  >
                    {abierta === b.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Cobro y factura de la cita
                  </button>
                )}
              </div>
              {abierta === b.id && cita && (
                <div className="p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                  <TarjetaDeCita
                    booking={cita} conExpediente={false} conNotas={false} soloCobro
                    sinCobro={!verCobro} sinFactura={!verFactura} {...tarjeta.manejadores}
                  />
                </div>
              )}
            </div>
          );
        }}
      />
      {tarjeta.modalFormulario}

      {/* Las ventas del paciente (las mismas de la página Ventas). */}
      {puedeVentas && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" /> Ventas
            </h2>
            <Link href={`/dashboard/practice/ventas/new?patientId=${patientId}`} className="text-sm text-blue-600 hover:text-blue-800">
              + Nueva venta
            </Link>
          </div>
          {ventas === 'error' ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No se pudieron cargar las ventas. Recarga la página para intentar de nuevo.
            </p>
          ) : !ventasListas ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : ventas.length === 0 ? (
            <p className="text-sm text-gray-400">Ninguna venta a este paciente.</p>
          ) : (
            <div className="space-y-2">
              {ventas.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-gray-100">
                  <div className="min-w-0">
                    <Link href={`/dashboard/practice/ventas/${s.id}`} className="text-sm text-gray-900 hover:text-blue-700 truncate block">
                      {s.saleNumber}
                      <span className="text-gray-500"> · {s.items.map((i) => i.description).join(', ')}</span>
                    </Link>
                    <p className="text-xs text-gray-500">
                      {/* `saleDate` es @db.Date: se lee como día, sin pasar por la hora local. */}
                      {s.saleDate.slice(0, 10)}
                      {s.visitaId && (
                        <> · <Link href={visitaHref(patientId, s.visitaId)} className="text-blue-600 hover:underline">su visita</Link></>
                      )}
                    </p>
                  </div>
                  <span className="text-xs shrink-0 flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{pesos(Number(s.total))}</span>
                    <span className={s.status === 'CANCELLED' ? 'text-gray-400' : s.paymentStatus === 'PAID' ? 'text-green-700' : 'text-amber-700'}>
                      {s.status === 'CANCELLED' ? 'Cancelada' : VENTA_PAGO[s.paymentStatus] ?? s.paymentStatus}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
