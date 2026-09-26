'use client';

import Link from 'next/link';
import { AlertCircle, CalendarCheck, ChevronRight, FileText } from 'lucide-react';
import { EncounterCard, type Encounter } from '@/components/medical-records/EncounterCard';
import { FacturaBadge, PagoBadge, type PatientBooking } from '@/components/medical-records/CitaBadges';
import type { BookingPermisos } from '@/lib/booking-permisos';
import { describirConteo, formatoFechaVisita, totalHijos, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import type { EstadoCarga } from './useVisitasDelPaciente';

interface Props {
  patientId: string;
  estado: EstadoCarga;
  visitas: VisitaResumen[];
  /** Consultas «Sin visita» — nada se esconde (DISEÑO §7). */
  sueltas: Encounter[];
  /** Para pintar el cobro/factura con el VEREDICTO del servidor, no con el ingreso crudo. */
  bookings: PatientBooking[];
  permisos: BookingPermisos | null;
  onNuevaVisita: () => void;
}

/** VISITAS D4 — reemplaza «Historial de Consultas» en la página del paciente. */
export function VisitasCard({ patientId, estado, visitas, sueltas, bookings, permisos, onNuevaVisita }: Props) {
  const verCobro = permisos?.flujo ?? false;
  const verFactura = permisos?.facturacion ?? false;
  const citaPorId = new Map(bookings.map((b) => [b.id, b]));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <CalendarCheck className="w-5 h-5" />
        Visitas
      </h2>

      {estado === 'cargando' ? (
        <p className="text-sm text-gray-400 text-center py-6">Cargando visitas…</p>
      ) : estado === 'error' ? (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm">No se pudieron cargar las visitas. Recarga la página para intentar de nuevo.</p>
        </div>
      ) : (
        <>
          {visitas.length > 0 ? (
            <div className="space-y-2">
              {visitas.map((v) => {
                const vacia = totalHijos(v.conteo) === 0;
                const b = v.cita ? citaPorId.get(v.cita.id) : undefined;
                const hora = v.cita?.horaInicio;
                return (
                  <Link
                    key={v.id}
                    href={visitaHref(patientId, v.id)}
                    className={`flex items-center justify-between gap-3 p-4 border rounded-lg transition-all hover:border-blue-300 hover:shadow-sm ${
                      vacia ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`font-medium ${vacia ? 'text-gray-500' : 'text-gray-900'}`}>
                        Visita del {formatoFechaVisita(v.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}
                        {hora && <span className="font-normal text-gray-500"> · {hora}</span>}
                      </p>
                      {v.cita?.servicio && <p className="text-xs text-gray-500 mt-0.5">{v.cita.servicio}</p>}
                      <p className={`text-sm mt-1 ${vacia ? 'text-gray-400 italic' : 'text-gray-600'}`}>
                        {vacia ? 'Vacía' : describirConteo(v.conteo)}
                      </p>
                      {b && (verCobro || verFactura) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {verCobro && <PagoBadge estadoPago={b.estadoPago ?? 'SIN_REGISTRO'} metodoPago={b.metodoPago ?? null} />}
                          {verFactura && <FacturaBadge facturada={b.facturada === true} solicitada={b.facturaSolicitada === true} />}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No hay visitas registradas</p>
              <button onClick={onNuevaVisita} className="text-blue-600 hover:text-blue-800 text-sm mt-2">
                Crear primera visita
              </button>
            </div>
          )}

          {sueltas.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Consultas sin visita</h3>
              <p className="text-xs text-gray-500 mb-3">
                Registradas fuera de una visita. Si hay una visita del mismo día, desde ella puedes traerlas.
              </p>
              <div className="space-y-3">
                {sueltas.map((e) => <EncounterCard key={e.id} encounter={e} patientId={patientId} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
