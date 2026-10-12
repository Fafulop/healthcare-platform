'use client';

import Link from 'next/link';
import { AlertCircle, CalendarCheck, ChevronRight, FileText, ListChecks, Plus, StickyNote } from 'lucide-react';
import { etiquetaSesion } from '@/lib/tratamientos-ui';
import { BookingStatusPill, FacturaBadge, PagoBadge, type PatientBooking } from '@/components/medical-records/CitaBadges';
import { citaVencida } from '@/components/citas/BotonesEstadoCita';
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

/**
 * Lo que tiene la visita, en un renglón: «2 plantillas · 1 receta · comentario». El comentario cuenta
 * (es contenido: con él, cancelar la cita NO borra la visita y la cita no se elimina — 08-PLAN F2);
 * antes la tarjeta decía «Vacía» de una visita con sólo comentario. '' = vacía.
 */
const contenidoDe = (v: VisitaResumen) =>
  [totalHijos(v.conteo) > 0 ? describirConteo(v.conteo) : '', v.comentario?.trim() ? 'comentario' : '']
    .filter(Boolean).join(' · ');

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

  // UNA sola tarjeta para próximas y pasadas (2026-10-12, a pedido del usuario: «no son homogéneas»).
  // Antes la próxima no traía estado, cobro, factura, «Vacía» ni notas. La próxima sólo se distingue
  // por su rótulo «Próxima» y el tinte azul.
  const fila = (v: VisitaResumen, proxima: boolean) => {
    const vacia = !contenidoDe(v);
    const b = v.cita ? citaPorId.get(v.cita.id) : undefined;
    const inicio = v.cita?.horaInicio;
    const fin = v.cita?.horaFin;
    // El estado como lo dice la AGENDA: una agendada cuya hora de fin ya pasó es «Vencida», no «Agendada».
    const vencida = !!b && citaVencida(b.status, b.date ?? v.fecha, b.endTime ?? fin);
    // «Sin cobro registrado» sólo cuando la cita ya se completó: antes de eso no se debe nada y el chip
    // gris era ruido. Lo que SÍ afirma algo (Pagado — p. ej. por link antes de la consulta —, parcial,
    // por cobrar, cubierta) sale siempre.
    const verPago = verCobro && !!b && ((b.estadoPago ?? 'SIN_REGISTRO') !== 'SIN_REGISTRO' || b.status === 'COMPLETED');
    // Sólo si el chip dice algo (FacturaBadge se calla si no): si no, quedaba un renglón vacío.
    const verFact = verFactura && !!b && (b.facturada === true || (b.facturaSolicitada === true && b.estadoPago !== 'CUBIERTA'));
    return (
      <Link
        key={v.id}
        href={visitaHref(patientId, v.id)}
        className={`flex items-center justify-between gap-3 p-4 border rounded-lg transition-all hover:border-blue-300 hover:shadow-sm ${
          proxima ? 'border-blue-100 bg-blue-50/40' : vacia ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-200'
        }`}
      >
        <div className="min-w-0">
          <p className={`font-medium flex items-center gap-2 flex-wrap ${vacia && !proxima ? 'text-gray-500' : 'text-gray-900'}`}>
            <span>
              {proxima && <span className="text-blue-700">Próxima · </span>}
              Visita del {formatoFechaVisita(v.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}
              {inicio && <span className="font-normal text-gray-500"> · {inicio}{fin ? `–${fin}` : ''}</span>}
            </span>
            {b && (vencida
              ? <span className="text-xs font-normal px-2 py-0.5 rounded bg-red-100 text-red-700">Vencida</span>
              : <span className="font-normal"><BookingStatusPill status={b.status} /></span>)}
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
            {vacia ? 'Vacía' : contenidoDe(v)}
          </p>
          {(verPago || verFact) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {verPago && <PagoBadge estadoPago={b!.estadoPago ?? 'SIN_REGISTRO'} metodoPago={b!.metodoPago ?? null} />}
              {verFact && <FacturaBadge facturada={b!.facturada === true} solicitada={b!.facturaSolicitada === true} cubierta={b!.estadoPago === 'CUBIERTA'} />}
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
      </Link>
    );
  };

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
                {proximas.map((v) => fila(v, true))}
              </ListaColapsable>
            </div>
          )}
          {pasadas.length > 0 ? (
            <ListaColapsable className="space-y-2">
              {pasadas.map((v) => fila(v, false))}
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
