'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { BookingStatusPill } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref } from '@/lib/visitas-ui';
import {
  ESTADO_SESION, ESTADO_TRATAMIENTO, describirAvance, detalleDeSesion, etiquetaSesion, tratamientosUiActiva,
  type SesionDeTratamiento,
} from '@/lib/tratamientos-ui';
import { practiceConfirm } from '@/lib/practice-confirm';
import { useTratamientoDetalle } from '../_components/useTratamientoDetalle';
import { AgendarSesionesModal } from '@/components/medical-records/tratamientos/AgendarSesionesModal';

const inputClass = 'px-2 py-1.5 border border-gray-300 rounded-md text-sm';
const botonTexto = 'text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50';
const botonGris = 'text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50';

/**
 * TRATAMIENTOS T3 — la pantalla de UN tratamiento: sus sesiones en orden con su estado (DERIVADO
 * por el servidor, P1), la cita y la visita de cada una, y las acciones para ligarlas.
 * Plan: docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §4.
 */
export default function TratamientoPage() {
  const t = useTratamientoDetalle();
  const { patientId, tratamiento } = t;
  const pacienteHref = `/dashboard/medical-records/patients/${patientId}`;
  const [editando, setEditando] = useState(false);
  const [cancelando, setCancelando] = useState<SesionDeTratamiento | null>(null);
  const [agendando, setAgendando] = useState(false);

  if (t.sessionStatus === 'loading' || t.estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // `tratamientosUiActiva` ya está abierta para todos: sin `doctorId` en la sesión no se pudo cargar.
  if (!tratamientosUiActiva(t.doctorId) || t.estado !== 'ok' || !tratamiento) {
    const texto = t.estado === 'no-existe'
      ? 'Este tratamiento no existe o ya se borró.'
      : 'No se pudo cargar el tratamiento. Recarga la página para intentar de nuevo.';
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900">{texto}</p>
          <Link href={pacienteHref} className="text-amber-800 underline mt-2 inline-block">Volver al paciente</Link>
        </div>
      </div>
    );
  }

  const chip = ESTADO_TRATAMIENTO[tratamiento.estado] ?? ESTADO_TRATAMIENTO.activo;
  const creadas = tratamiento.sesiones.length;
  const planeadas = tratamiento.sesionesPlaneadas;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Encabezado */}
      <div>
        <Link href={pacienteHref} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeft className="w-5 h-5" /> Volver al Paciente
        </Link>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              {t.patientName && <p className="text-sm text-gray-500">{t.patientName}</p>}
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                <ListChecks className="w-6 h-6 text-gray-500" />
                {tratamiento.nombre}
                <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${chip.clase}`}>{chip.texto}</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {creadas > 0 ? describirAvance({ sesionesPlaneadas: planeadas, conteo: conteoDe(tratamiento.sesiones) }) : 'Sin sesiones'}
                {planeadas !== null && creadas !== planeadas && (
                  <span className="text-gray-500"> · {creadas} {creadas === 1 ? 'creada' : 'creadas'} de {planeadas} planeadas</span>
                )}
              </p>
              {tratamiento.notas && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{tratamiento.notas}</p>}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => setEditando((x) => !x)} disabled={t.trabajando} className={botonGris}>
                <Pencil className="w-4 h-4 inline mr-1" />Editar
              </button>
              {tratamiento.estado === 'activo' && (
                <button
                  onClick={() => t.patchTratamiento({ estado: 'terminado' }, 'Tratamiento terminado')}
                  disabled={t.trabajando} className={botonGris}
                >Terminar</button>
              )}
              {/* Desde CUALQUIER estado que no sea cancelado: es lo que el 409 de «Borrar» pide. */}
              {tratamiento.estado !== 'cancelado' && (
                <button
                  onClick={() => t.patchTratamiento({ estado: 'cancelado' }, 'Tratamiento cancelado')}
                  disabled={t.trabajando} className={botonGris}
                >Cancelar tratamiento</button>
              )}
              {tratamiento.estado !== 'activo' && (
                <button
                  onClick={() => t.patchTratamiento({ estado: 'activo' }, 'Tratamiento reactivado')}
                  disabled={t.trabajando} className={botonGris}
                >Reactivar</button>
              )}
              <button onClick={t.borrarTratamiento} disabled={t.trabajando} className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="w-4 h-4 inline mr-1" />Borrar
              </button>
            </div>
          </div>
          {editando && <EditarDatos t={t} onListo={() => setEditando(false)} />}
        </div>
      </div>

      {/* Sesiones */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />Sesiones
          </h2>
          <div className="flex items-center gap-1">
            {/* T5: sólo con permiso de citas y si hay sesiones «Por agendar» (sin cita que cuente ni visita). */}
            {(t.permisos?.citas ?? false) && tratamiento.estado === 'activo'
              && tratamiento.sesiones.some((s) => s.estado === 'por_agendar' && !s.cancelada && !s.visita) && (
              <button onClick={() => setAgendando(true)} disabled={t.trabajando} className={`${botonTexto} flex items-center gap-1`}>
                <CalendarDays className="w-4 h-4" />Agendar sesiones…
              </button>
            )}
            <button onClick={t.agregarSesion} disabled={t.trabajando} className={`${botonTexto} flex items-center gap-1`}>
              <Plus className="w-4 h-4" />Agregar sesión
            </button>
          </div>
        </div>
        {creadas === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay sesiones. Agrega la primera cuando la necesites.</p>
        ) : (
          <div className="space-y-2">
            {tratamiento.sesiones.map((s) => (
              <FilaSesion key={s.id} s={s} t={t} planeadas={planeadas} onCancelar={() => pedirCancelar(s)} />
            ))}
          </div>
        )}
      </div>

      {agendando && (
        <AgendarSesionesModal
          patientId={patientId}
          tratamiento={tratamiento}
          onClose={() => setAgendando(false)}
          onListo={() => { t.recargar(); }}
        />
      )}

      {cancelando && (
        <CancelarSesionModal
          s={cancelando}
          planeadas={planeadas}
          trabajando={t.trabajando}
          onElegir={async (tambienCita) => {
            const s = cancelando;
            setCancelando(null);
            await t.cancelarSesion(s, tambienCita);
          }}
          onCerrar={() => setCancelando(null)}
        />
      )}
    </div>
  );

  /**
   * G8: con cita ACTIVA a la vista hay TRES salidas (también la cita · sólo la sesión · nada) y un
   * confirm de sí/no no las distingue: su «Cancelar» y el Esc acababan cancelando la sesión. Sin
   * cita activa (o sin permiso para verla) basta el confirm.
   */
  async function pedirCancelar(s: SesionDeTratamiento) {
    const citaActiva = s.cita?.status === 'PENDING' || s.cita?.status === 'CONFIRMED';
    if (citaActiva) { setCancelando(s); return; }
    const ok = await practiceConfirm(
      s.estado === 'agendada'
        ? 'La sesión quedará como cancelada. Tiene una cita que no puedes ver: seguirá en la agenda.'
        : 'La sesión quedará como cancelada. Puedes reactivarla después.',
      `¿Cancelar la ${etiquetaSesion(s.numero, null).toLowerCase()}?`,
    );
    if (ok) await t.cancelarSesion(s, false);
  }
}

function CancelarSesionModal({ s, planeadas, trabajando, onElegir, onCerrar }: {
  s: SesionDeTratamiento; planeadas: number | null; trabajando: boolean;
  onElegir: (tambienCita: boolean) => void; onCerrar: () => void;
}) {
  const dia = s.cita?.fecha ? ` del ${formatoFechaVisita(s.cita.fecha)}` : '';
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Cancelar {etiquetaSesion(s.numero, planeadas).toLowerCase()}</h2>
          <button onClick={onCerrar} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm text-gray-700">
          <p>Esta sesión tiene una cita{dia} que sigue activa en la agenda. ¿Qué quieres hacer con ella?</p>
          <p className="text-gray-500">
            Cancelarla aquí es lo mismo que cancelarla desde la agenda, con los mismos avisos al paciente.
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => onElegir(true)} disabled={trabajando}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
          >Cancelar la sesión y la cita</button>
          <button
            onClick={() => onElegir(false)} disabled={trabajando}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >Cancelar sólo la sesión (la cita se queda)</button>
          <button onClick={onCerrar} disabled={trabajando} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            No cancelar nada
          </button>
        </div>
      </div>
    </div>
  );
}

type Detalle = ReturnType<typeof useTratamientoDetalle>;

/** El conteo de la cabecera sale de las sesiones ya derivadas por el servidor (no se re-deriva). */
function conteoDe(sesiones: SesionDeTratamiento[]) {
  const c = { total: sesiones.length, hechas: 0, agendadas: 0, porAgendar: 0, canceladas: 0 };
  for (const s of sesiones) {
    if (s.estado === 'hecha') c.hechas++;
    else if (s.estado === 'agendada') c.agendadas++;
    else if (s.estado === 'cancelada') c.canceladas++;
    else c.porAgendar++;
  }
  return c;
}

function EditarDatos({ t, onListo }: { t: Detalle; onListo: () => void }) {
  const tr = t.tratamiento!;
  const [nombre, setNombre] = useState(tr.nombre);
  const [sesiones, setSesiones] = useState(tr.sesionesPlaneadas?.toString() ?? '');
  const [notas, setNotas] = useState(tr.notas ?? '');

  const guardar = async () => {
    const n = sesiones.trim() ? Number(sesiones) : null;
    const ok = await t.patchTratamiento(
      // Sin plantilla sugerida hasta T4 (ver NuevoTratamientoModal): no se manda, no se toca.
      { nombre: nombre.trim(), sesionesPlaneadas: n, notas: notas.trim() || null },
      'Tratamiento actualizado',
    );
    if (ok) onListo();
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} className={`${inputClass} w-full`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sesiones planeadas</label>
        <input type="number" min={1} max={100} value={sesiones} onChange={(e) => setSesiones(e.target.value)} className={`${inputClass} w-32`} />
        {/* G7: cambiar el número NO crea ni borra sesiones. */}
        <p className="text-xs text-gray-500 mt-1">Cambia sólo el número del plan: no crea ni borra sesiones.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={5000} className={`${inputClass} w-full`} />
      </div>
      <div className="flex gap-2">
        <button onClick={guardar} disabled={t.trabajando || !nombre.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          Guardar
        </button>
        <button onClick={onListo} disabled={t.trabajando} className="px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FilaSesion({ s, t, planeadas, onCancelar }: {
  s: SesionDeTratamiento; t: Detalle; planeadas: number | null; onCancelar: () => void;
}) {
  const [notas, setNotas] = useState<string | null>(null);
  const chip = ESTADO_SESION[s.estado];
  const detalle = detalleDeSesion(s);
  const verCitas = t.permisos?.citas ?? false;
  const cita = s.cita;

  // Se puede ligar una cita si la sesión no tiene, o si la suya ya no cuenta (cancelada / no
  // asistió: «Por agendar», y el servidor acepta cambiarla). Sólo si cargaron citas, visitas Y lo
  // ocupado: sin eso no se sabe qué rechazaría el servidor. Se quitan las que darían 409:
  //   · de otra sesión;
  //   · con su PROPIA visita, si la sesión ya guarda otra (una sesión no tiene dos visitas, G2);
  //   · de otro día, si la visita de la sesión ya tiene plantillas (regla del mismo día).
  const citaSustituible = !cita || s.motivo === 'cita_cancelada' || s.motivo === 'cita_no_asistio';
  const visitaPropia = s.visita && t.visitas ? t.visitas.find((v) => v.id === s.visita!.id) : undefined;
  const visitaPorCita = new Map((t.visitas ?? []).flatMap((v) => (v.cita ? [[v.cita.id, v.id] as const] : [])));
  const citasLigables = citaSustituible && verCitas && t.bookings && t.ocupadas && t.visitas
    ? t.bookings
        .filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW' && b.id !== cita?.id
          && !t.ocupadas!.citas.includes(b.id)
          && !(s.visita && visitaPorCita.has(b.id) && visitaPorCita.get(b.id) !== s.visita.id)
          && !(visitaPropia && !visitaPropia.cita && (visitaPropia.conteo?.consultas ?? 0) > 0 && b.date !== visitaPropia.fecha)
          // Si la visita guardada ya es de una cita, sólo ESA cita (una visita no es de dos citas).
          && !(visitaPropia?.cita && b.id !== visitaPropia.cita.id))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    : [];
  // Visitas que se pueden ligar (sólo SIN cita): sin cita propia y de ninguna sesión.
  const visitasLigables = !cita && !s.visita && t.visitas && t.ocupadas
    ? t.visitas.filter((v) => !v.cita && !t.ocupadas!.visitas.includes(v.id))
    : [];

  return (
    <div className={`p-4 border rounded-lg ${s.estado === 'cancelada' ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
            {etiquetaSesion(s.numero, planeadas)}
            <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${chip.clase}`}>{chip.texto}</span>
          </p>
          {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
          {cita && (
            cita.status ? (
              <p className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
                <span>
                  Cita: {[cita.fecha ? formatoFechaVisita(cita.fecha) : 'sin fecha', cita.horaInicio, cita.servicio].filter(Boolean).join(' · ')}
                </span>
                <BookingStatusPill status={cita.status} />
              </p>
            ) : (
              <p className="text-sm text-gray-500">Tiene una cita, pero no tienes permiso para ver sus datos.</p>
            )
          )}
          {s.visita && (
            <Link href={visitaHref(t.patientId, s.visita.id)} className="text-sm text-blue-600 hover:text-blue-800 inline-block">
              Abrir su visita{s.visita.fecha ? ` (${formatoFechaVisita(s.visita.fecha)})` : ''}
            </Link>
          )}
          {s.notas && notas === null && <p className="text-sm text-gray-600 whitespace-pre-wrap">{s.notas}</p>}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {!s.cancelada && citasLigables.length > 0 && (
            // Controlado en "": si ligar falla, vuelve al placeholder y se puede reintentar.
            <select value="" onChange={(e) => e.target.value && t.ligarCita(s, e.target.value)} disabled={t.trabajando} className={inputClass}>
              <option value="">Ligar una cita…</option>
              {citasLigables.map((b) => (
                <option key={b.id} value={b.id}>
                  {[b.date ? formatoFechaVisita(b.date) : 'Sin fecha', b.startTime, b.serviceName].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          )}
          {cita && verCitas && (
            <button onClick={() => t.desligarCita(s)} disabled={t.trabajando} className={botonGris}>Desligar cita</button>
          )}
          {!s.cancelada && visitasLigables.length > 0 && (
            <select value="" onChange={(e) => e.target.value && t.ligarVisita(s, e.target.value)} disabled={t.trabajando} className={inputClass}>
              <option value="">Ligar una visita…</option>
              {visitasLigables.map((v) => (
                <option key={v.id} value={v.id}>Visita del {formatoFechaVisita(v.fecha)}</option>
              ))}
            </select>
          )}
          {!cita && s.visita && (
            <button onClick={() => t.ligarVisita(s, null)} disabled={t.trabajando} className={botonGris}>Desligar visita</button>
          )}
          <button onClick={() => setNotas(notas === null ? s.notas ?? '' : null)} disabled={t.trabajando} className={botonGris}>
            Notas
          </button>
          {s.cancelada ? (
            <button onClick={() => t.patchSesion(s, { cancelada: false }, 'Sesión reactivada')} disabled={t.trabajando} className={botonGris}>
              Reactivar
            </button>
          ) : (
            <button onClick={onCancelar} disabled={t.trabajando} className={botonGris}>Cancelar sesión</button>
          )}
          {!cita && !s.visita && (
            <button onClick={() => t.borrarSesion(s)} disabled={t.trabajando} className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
              Borrar
            </button>
          )}
        </div>
      </div>

      {notas !== null && (
        <div className="mt-3 space-y-2">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={5000} className={`${inputClass} w-full`} />
          <div className="flex gap-2">
            <button
              onClick={async () => { if (await t.patchSesion(s, { notas: notas.trim() || null }, 'Notas guardadas')) setNotas(null); }}
              disabled={t.trabajando}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >Guardar</button>
            <button onClick={() => setNotas(null)} className="px-3 py-1 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
