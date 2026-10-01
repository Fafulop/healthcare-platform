'use client';

import Link from 'next/link';
import { AlertCircle, CalendarCheck, ChevronRight, FileText, ListChecks, Plus, StickyNote } from 'lucide-react';
import { etiquetaSesion } from '@/lib/tratamientos-ui';
import { FacturaBadge, PagoBadge, type PatientBooking } from '@/components/medical-records/CitaBadges';
import { ListaColapsable } from '@/components/medical-records/ListaColapsable';
import { tieneNotas } from '@/components/citas/NotasCita';
import type { BookingPermisos } from '@/lib/booking-permisos';
import { describirConteo, formatoFechaVisita, totalHijos, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import type { EstadoCarga } from './useVisitasDelPaciente';

interface Props {
  patientId: string;
  estado: EstadoCarga;
  visitas: VisitaResumen[];
  /** Para pintar el cobro/factura con el VEREDICTO del servidor, no con el ingreso crudo. */
  bookings: PatientBooking[];
  permisos: BookingPermisos | null;
  onNuevaVisita: () => void;
}

/** VISITAS D4 — reemplaza «Historial de Consultas» en la página del paciente. */
export function VisitasCard({ patientId, estado, visitas, bookings, permisos, onNuevaVisita }: Props) {
  const verCobro = permisos?.flujo ?? false;
  const verFactura = permisos?.facturacion ?? false;
  const citaPorId = new Map(bookings.map((b) => [b.id, b]));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5" />
          Visitas
        </h2>
        {/* Mismo botón arriba a la derecha que las demás tarjetas del expediente. */}
        <button
          onClick={onNuevaVisita}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
        >
          <Plus className="w-4 h-4" />Nueva visita
        </button>
      </div>

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
            <ListaColapsable className="space-y-2">
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
                      {/* T7: la serie a la que pertenece (sin link: la fila entera ya es un link). */}
                      {v.sesion && (
                        <p className="text-xs text-teal-700 mt-0.5 flex items-center gap-1 min-w-0">
                          <ListChecks className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {etiquetaSesion(v.sesion.numero, v.sesion.sesionesPlaneadas)} — {v.sesion.nombre}
                            {v.sesion.cancelada ? ' (cancelada)' : ''}
                          </span>
                        </p>
                      )}
                      {/* Las notas de la cita, en UN renglón: la fila entera es un link, así que el
                          «ver más» de `NotasCita` navegaría. Completas, en la pantalla de la visita. */}
                      {b && tieneNotas(b.notes) && (
                        <p className="text-xs text-gray-600 mt-1 flex items-center gap-1 min-w-0">
                          <StickyNote className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                          <span className="truncate">{b.notes!.trim()}</span>
                        </p>
                      )}
                      <p className={`text-sm mt-1 ${vacia ? 'text-gray-400 italic' : 'text-gray-600'}`}>
                        {vacia ? 'Vacía' : describirConteo(v.conteo)}
                      </p>
                      {b && (verCobro || verFactura) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {verCobro && <PagoBadge estadoPago={b.estadoPago ?? 'SIN_REGISTRO'} metodoPago={b.metodoPago ?? null} />}
                          {verFactura && <FacturaBadge facturada={b.facturada === true} solicitada={b.facturaSolicitada === true} cubierta={b.estadoPago === 'CUBIERTA'} />}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                  </Link>
                );
              })}
            </ListaColapsable>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No hay visitas registradas</p>
              <button onClick={onNuevaVisita} className="text-blue-600 hover:text-blue-800 text-sm mt-2">
                Crear primera visita
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
