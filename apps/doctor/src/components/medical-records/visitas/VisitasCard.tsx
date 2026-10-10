'use client';

import Link from 'next/link';
import { AlertCircle, CalendarCheck, ChevronRight, FileText, ListChecks, Plus, StickyNote } from 'lucide-react';
import { etiquetaSesion } from '@/lib/tratamientos-ui';
import { FacturaBadge, PagoBadge, type PatientBooking } from '@/components/medical-records/CitaBadges';
import { ListaColapsable } from '@/components/medical-records/ListaColapsable';
import { tieneNotas } from '@/components/citas/NotasCita';
import type { BookingPermisos } from '@/lib/booking-permisos';
import { describirConteo, formatoFechaVisita, totalHijos, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import { getClinicDateString } from '@/lib/dates';
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
  // TRATAMIENTOS v2 · V6 (2026-10-02, a pedido del usuario): una visita que es SESIÓN de un tratamiento
  // no se lista aquí — revuelta con las sueltas era demasiado. Se abre DESDE su tratamiento (tarjeta
  // «Tratamientos» de este mismo expediente). Sólo esta tarjeta filtra: las demás pantallas que usan
  // la lista (¿Es seguimiento?, selectores de fotos/recetas) la siguen necesitando completa.
  const sueltas = visitas.filter((v) => !v.sesion);
  const deTratamientos = visitas.length - sueltas.length;
  // 08-PLAN F3: la visita nace con su cita (F2), así que hay visitas FUTURAS. Van aparte, arriba, la
  // más cercana primero: «Próxima · 15 oct · 10:00». Las de hoy y antes, como siempre.
  const hoy = getClinicDateString();
  // Una cita cancelada / no asistió no es «próxima» aunque su día no haya llegado: su visita (que sólo
  // se queda si tiene algo) va con las demás, con su etiqueta.
  const citaCaida = (v: VisitaResumen) => {
    const st = v.cita ? citaPorId.get(v.cita.id)?.status : undefined;
    return st === 'CANCELLED' || st === 'NO_SHOW';
  };
  const esProxima = (v: VisitaResumen) => v.fecha.slice(0, 10) > hoy && !citaCaida(v);
  const proximas = sueltas.filter(esProxima)
    .sort((a, b) => `${a.fecha} ${a.cita?.horaInicio ?? ''}`.localeCompare(`${b.fecha} ${b.cita?.horaInicio ?? ''}`));
  const pasadas = sueltas.filter((v) => !esProxima(v));

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
          {proximas.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Próximas</p>
              <ListaColapsable className="space-y-2">
                {proximas.map((v) => {
                  const vacia = totalHijos(v.conteo) === 0;
                  return (
                    <Link
                      key={v.id}
                      href={visitaHref(patientId, v.id)}
                      className="flex items-center justify-between gap-3 p-3 border border-blue-100 bg-blue-50/40 rounded-lg transition-all hover:border-blue-300 hover:shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          Próxima · {formatoFechaVisita(v.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}
                          {v.cita?.horaInicio && <span className="font-normal text-gray-500"> · {v.cita.horaInicio}</span>}
                        </p>
                        {v.cita?.servicio && <p className="text-xs text-gray-500 mt-0.5">{v.cita.servicio}</p>}
                        {/* Se le puede subir algo antes de la consulta (F2): si ya tiene, se dice. */}
                        {!vacia && <p className="text-sm text-gray-600 mt-1">{describirConteo(v.conteo)}</p>}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                    </Link>
                  );
                })}
              </ListaColapsable>
            </div>
          )}
          {pasadas.length > 0 ? (
            <ListaColapsable className="space-y-2">
              {pasadas.map((v) => {
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
                        {/* 08-PLAN F2: la de una cita cancelada / no asistió sólo se queda si tiene algo. */}
                        {(b?.status === 'CANCELLED' || b?.status === 'NO_SHOW') && (
                          <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {b.status === 'CANCELLED' ? 'cita cancelada' : 'no asistió'}
                          </span>
                        )}
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
          ) : proximas.length > 0 ? null : (
            <div className="text-center py-6 text-gray-500">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              {/* Con visitas de tratamientos SÍ hay visitas: decir «no hay» sería falso. */}
              <p className="text-sm">{deTratamientos > 0 ? 'No hay visitas fuera de los tratamientos' : 'No hay visitas registradas'}</p>
              <button onClick={onNuevaVisita} className="text-blue-600 hover:text-blue-800 text-sm mt-2">
                {deTratamientos > 0 ? 'Nueva visita' : 'Crear primera visita'}
              </button>
            </div>
          )}
          {deTratamientos > 0 && (
            <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
              <ListChecks className="w-3.5 h-3.5 shrink-0 text-teal-600" />
              {deTratamientos === 1 ? '1 visita es' : `${deTratamientos} visitas son`} de tratamientos: se
              {deTratamientos === 1 ? ' abre' : ' abren'} desde su tratamiento, en la tarjeta «Tratamientos».
            </p>
          )}
        </>
      )}
    </div>
  );
}
