'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { getClinicDateString } from '@/lib/dates';
import { toast } from '@/lib/practice-toast';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';

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
}

/**
 * VISITAS D4 — «Nueva Visita». La visita se crea al CONFIRMAR aquí, no al picar el botón: crearla
 * al clic dejaba una visita manual vacía cada vez que el doctor se arrepentía.
 *
 * Una cita que YA tiene visita (la automática al concluir) no se vuelve a ligar — la API contesta
 * 409 —: se ofrece ABRIR la suya. Es el camino diario: se concluye la cita y su visita ya existe.
 */
export function NuevaVisitaModal({ patientId, onClose, bookings, verCitas, visitas, visitasEstado, citasEstado, recargarVisitas }: Props) {
  const router = useRouter();
  const [fecha, setFecha] = useState(getClinicDateString());
  const [bookingId, setBookingId] = useState('');
  const [guardando, setGuardando] = useState(false);

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
  const visitaExistente = elegida ? visitaPorCita.get(elegida.id) : undefined;

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
    setGuardando(true);
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/visitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Con cita, el día lo pone la CITA y el servidor ignora `fecha`; se manda cuando hay una
        // porque una cita cuyo slot se borró no tiene día (02-PLAN §5.1) y ahí manda la escrita.
        // Vacía NO se manda: el servidor rechaza una `fecha` mal formada aunque venga cita (400).
        body: JSON.stringify(elegida ? { bookingId: elegida.id, ...(fecha && { fecha }) } : { fecha }),
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
              className={inputClass}
            />
            {elegida?.date && (
              <p className="text-xs text-gray-500 mt-1">Con cita, la fecha de la visita es la de la cita.</p>
            )}
          </div>

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
