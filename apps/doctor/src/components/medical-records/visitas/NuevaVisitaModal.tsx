'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { getClinicDateString } from '@/lib/dates';
import { toast } from '@/lib/practice-toast';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import type { TratamientoResumen } from '@/lib/tratamientos-ui';

interface Props {
  patientId: string;
  onClose: () => void;
  /** Citas del paciente (ya recortadas por permiso). Sin `citas` llegan vacías: no hay qué ligar. */
  bookings: PatientBooking[];
  verCitas: boolean;
  /** Para saber qué citas YA tienen visita (la automática al concluir, o una ligada a mano). */
  visitas: VisitaResumen[];
  /** Estado de la carga de las VISITAS: sin ellas no se sabe qué cita ya tiene la suya. */
  visitasEstado: 'cargando' | 'error' | 'ok';
  /** Estado de la carga de las CITAS (y de sus permisos). */
  citasEstado: 'cargando' | 'error' | 'ok';
  /** Re-lee las visitas del paciente (la lista puede ser vieja: la cita se concluyó en otra pestaña). */
  recargarVisitas: () => Promise<void>;
  /** T7 «¿Es seguimiento?»: los tratamientos del paciente (se ofrecen sólo los activos). Vacío = no hay. */
  tratamientos?: TratamientoResumen[];
}

/**
 * VISITAS D4 — «Nueva Visita». La visita se crea al CONFIRMAR aquí, no al picar el botón: crearla
 * al clic dejaba una visita manual vacía cada vez que el doctor se arrepentía.
 *
 * Una cita que YA tiene visita (la automática al concluir) no se vuelve a ligar — la API contesta
 * 409 —: se ofrece ABRIR la suya. Es el camino diario: se concluye la cita y su visita ya existe.
 */
export function NuevaVisitaModal({
  patientId, onClose, bookings, verCitas, visitas, visitasEstado, citasEstado, recargarVisitas, tratamientos = [],
}: Props) {
  const router = useRouter();
  const [fecha, setFecha] = useState(getClinicDateString());
  const [bookingId, setBookingId] = useState('');
  const [guardando, setGuardando] = useState(false);
  // T7 «¿Es seguimiento?»: '' = no · 't:<tratamientoId>' = sesión siguiente · 'v:<visitaId>' = de una visita anterior.
  const [seguimiento, setSeguimiento] = useState('');
  const activos = useMemo(() => tratamientos.filter((t) => t.estado === 'activo'), [tratamientos]);
  // Visitas que no son de NINGÚN tratamiento: si ya son de uno activo, se elige ese tratamiento; si
  // son de uno terminado/cancelado, el servidor lo rechaza (se reactiva primero). Las 20 más recientes.
  // Sólo visitas del MISMO día o ANTERIORES (H-024): el servidor rechaza una posterior — la sesión 2
  // quedaba antes que la 1. Se recalcula con la fecha/cita elegida (más abajo).
  const visitasSueltasTodas = useMemo(() => visitas.filter((v) => !v.sesion), [visitas]);

  const visitaPorCita = useMemo(
    () => new Map(visitas.flatMap((v) => (v.cita ? [[v.cita.id, v.id] as const] : []))),
    [visitas],
  );

  // Canceladas y no-show no son una visita (la API las rechaza). Las más recientes primero.
  const citas = useMemo(
    () => bookings
      .filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW')
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.startTime ?? '').localeCompare(a.startTime ?? '')),
    [bookings],
  );

  // ⚠️ Mientras citas o visitas cargan NO se crea nada: una visita «Sin cita» creada en esa
  // ventana para la cita de hoy no se liga a ella, y al concluirla nace una SEGUNDA visita (D1).
  // Si una de las dos falló, se DICE — no es lo mismo que «no hay citas» ni «sin permiso».
  const cargando = citasEstado === 'cargando' || visitasEstado === 'cargando';
  const fallo = citasEstado === 'error' || visitasEstado === 'error';
  const listo = !cargando && !fallo;

  // La cita de HOY viene elegida: dejar «Sin cita» por default crea una visita suelta y, al
  // concluir la cita, D1 crea OTRA para el mismo día. (Si ya tiene visita, el botón la abre.)
  const preeligio = useRef(false);
  useEffect(() => {
    if (!listo || !verCitas || preeligio.current) return;
    preeligio.current = true;
    const hoy = getClinicDateString();
    const deHoy = citas.find((b) => b.date === hoy);
    if (deHoy) setBookingId(deHoy.id);
  }, [listo, verCitas, citas]);

  const elegida = listo ? citas.find((b) => b.id === bookingId) ?? null : null;
  // Día de la visita NUEVA: el de la cita si hay una, si no el que se escribe.
  const diaNueva = (elegida?.date ?? fecha ?? '').slice(0, 10);
  const visitasSueltas = useMemo(
    // Sin fecha todavía no se ofrece ninguna: no hay contra qué comparar.
    () => (diaNueva ? visitasSueltasTodas.filter((v) => v.fecha.slice(0, 10) <= diaNueva).slice(0, 20) : []),
    [visitasSueltasTodas, diaNueva],
  );
  // Si al cambiar la fecha/cita la visita elegida queda fuera (posterior), la elección vale «No» —
  // derivado en el render (el select lo muestra en el acto), no limpiado después por un efecto.
  const seguimientoEf =
    seguimiento.startsWith('v:') && !visitasSueltas.some((v) => `v:${v.id}` === seguimiento) ? '' : seguimiento;
  // Al cambiar el día se SUELTA una visita elegida (aunque vuelva a valer después): que no reaparezca
  // sola una elección que el select ya había mostrado como «No».
  useEffect(() => {
    setSeguimiento((s) => (s.startsWith('v:') ? '' : s));
  }, [diaNueva]);
  const visitaExistente = elegida ? visitaPorCita.get(elegida.id) : undefined;
  // La cita de una sesión ya lleva su visita al tratamiento: ahí no se pregunta (el servidor diría 409).
  const citaEsSesion = elegida?.esSesion === true;
  const ofrecerSeguimiento = listo && !visitaExistente && !citaEsSesion && (activos.length > 0 || visitasSueltas.length > 0);

  const etiquetaCita = (b: PatientBooking) => [
    b.date ? formatoFechaVisita(b.date) : 'Sin fecha',
    b.startTime,
    b.serviceName,
    visitaPorCita.has(b.id) ? '(ya tiene su visita)' : null,
  ].filter(Boolean).join(' · ');

  const confirmar = async () => {
    if (visitaExistente) {
      router.push(visitaHref(patientId, visitaExistente));
      return;
    }
    if (!elegida?.date && !fecha) {
      toast.error('Elige la fecha de la visita');
      return;
    }
    // 07-PLAN P2 (el servidor también lo rechaza): sin cita, sólo hoy o antes.
    if (!elegida && fecha > getClinicDateString()) {
      toast.error('Una visita sin cita no puede ser en el futuro: agenda una cita para ese día');
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/visitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Con cita, el día lo pone la CITA y el servidor ignora `fecha`; se manda cuando hay una
        // porque una cita cuyo slot se borró no tiene día (02-PLAN §5.1) y ahí manda la escrita.
        // Vacía NO se manda: el servidor rechaza una `fecha` mal formada aunque venga cita (400).
        body: JSON.stringify({
          ...(elegida ? { bookingId: elegida.id, ...(fecha && { fecha }) } : { fecha }),
          ...(ofrecerSeguimiento && seguimientoEf
            ? { seguimiento: seguimientoEf.startsWith('t:') ? { tratamientoId: seguimientoEf.slice(2) } : { visitaId: seguimientoEf.slice(2) } }
            : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      // Sólo ESTE 409 (texto exacto de `lib/visitas.ts`): los otros 409 —cita de otro paciente,
      // cancelada— no son "lista vieja" y se muestran tal cual abajo.
      if (res.status === 409 && elegida && data?.error === 'La cita ya tiene una visita') {
        // La lista era vieja: a esa cita le nació su visita después (se concluyó en otra pestaña o
        // desde el asistente). Se re-lee y el botón pasa solo a «Abrir su visita».
        await recargarVisitas();
        toast.error('Esa cita ya tiene su visita. Ábrela desde aquí.');
        setGuardando(false);
        return;
      }
      if (!res.ok || !data?.data?.id) throw new Error(data?.error || 'No se pudo crear la visita');
      const seg = data.data.seguimiento;
      if (seg) {
        toast.success(seg.tratamientoCreado
          ? `Se creó el tratamiento «${seg.tratamientoCreado}»: esta visita es su sesión ${seg.numero}`
          : `Esta visita es la sesión ${seg.numero} de su tratamiento`);
      }
      router.push(visitaHref(patientId, data.data.id));
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear la visita');
      setGuardando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Visita</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {cargando && <p className="text-sm text-gray-500">Cargando las citas del paciente…</p>}
          {fallo && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {citasEstado === 'error'
                ? 'No se pudieron cargar las citas del paciente'
                : 'No se pudieron cargar sus visitas (no se sabe qué citas ya tienen la suya)'}
              , así que esta visita se creará sin cita. Si es de una cita, recarga la página antes de crearla.
            </p>
          )}
          {listo && !verCitas && (
            // Sin permiso de `citas` no se puede elegir la cita: la visita nace «Sin cita», y si el
            // paciente tiene cita hoy, al completarla se abre OTRA visita (D1). Se dice.
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No tienes permiso para ver citas, así que esta visita se crea sin cita. Si el paciente tiene
              cita hoy, al completarla se abrirá otra visita para ella.
            </p>
          )}
          {listo && verCitas && citas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">¿De qué cita?</label>
              <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className={inputClass}>
                <option value="">Sin cita</option>
                {citas.map((b) => (
                  <option key={b.id} value={b.id}>{etiquetaCita(b)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={elegida?.date ?? fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={!!elegida?.date}
              // 07-PLAN P2: sin cita, hasta hoy. Una visita futura es una cita.
              max={elegida ? undefined : getClinicDateString()}
              className={inputClass}
            />
            {/* Con cita sin día (su slot se borró) no se dice nada: la fecha escrita vale y puede ser futura. */}
            {elegida ? (
              elegida.date && <p className="text-xs text-gray-500 mt-1">Con cita, la fecha de la visita es la de la cita.</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Sin cita, hoy o antes. Para otro día, agenda una cita.</p>
            )}
          </div>

          {listo && citaEsSesion && !visitaExistente && (
            <p className="text-xs text-gray-500">Esta cita es sesión de un tratamiento: la visita entra sola a él.</p>
          )}
          {ofrecerSeguimiento && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">¿Es seguimiento?</label>
              <select value={seguimientoEf} onChange={(e) => setSeguimiento(e.target.value)} className={inputClass}>
                <option value="">No</option>
                {activos.length > 0 && (
                  <optgroup label="Sesión siguiente de un tratamiento">
                    {activos.map((t) => (
                      <option key={t.id} value={`t:${t.id}`}>Sesión siguiente de «{t.nombre}»</option>
                    ))}
                  </optgroup>
                )}
                {visitasSueltas.length > 0 && (
                  <optgroup label="Seguimiento de una visita anterior">
                    {visitasSueltas.map((v) => (
                      <option key={v.id} value={`v:${v.id}`}>
                        Visita del {formatoFechaVisita(v.fecha)}{v.cita?.servicio ? ` · ${v.cita.servicio}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {seguimientoEf.startsWith('v:') && (
                <p className="text-xs text-gray-500 mt-1">
                  Se crea un tratamiento «Seguimiento del …» con esa visita y ésta (le cambias el nombre en «Editar»).
                  Las dos visitas pasan al tratamiento y dejan de verse en «Visitas» (están dentro del tratamiento).
                </p>
              )}
            </div>
          )}

          {visitaExistente && (
            <p className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Esta cita ya tiene su visita. Ábrela para agregarle plantillas, fotos, notas o recetas.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando || cargando}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {visitaExistente ? 'Abrir su visita' : guardando ? 'Creando…' : 'Crear visita'}
          </button>
        </div>
      </div>
    </div>
  );
}
