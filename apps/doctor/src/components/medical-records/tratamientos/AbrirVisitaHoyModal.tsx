'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import { getClinicDateString, getClinicMinutesOfDay } from '@/lib/dates';
import { visitaHref } from '@/lib/visitas-ui';
import { etiquetaSesion, pesos, type SesionDeTratamiento } from '@/lib/tratamientos-ui';
import { useDoctorProfile } from '@/contexts/DoctorProfileContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface Servicio { id: string; serviceName: string; price: number | null; durationMinutes?: number }

/** «HH:MM» de AHORA en hora de la clínica. */
function horaDeAhora() {
  const m = getClinicMinutesOfDay();
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * VISITAS 07-PLAN P3b — «Abrir visita hoy» de una sesión SIN cita que cuente. Visita y cita son el
 * espejo del mismo evento: con **«También en la agenda»** (marcada por default) nace también su cita
 * de HOY (`enConsulta`: sin exigir correo/teléfono/WhatsApp y sin avisar al paciente, que está
 * enfrente), queda Agendada y se cobra al concluirla, como cualquier otra. Desmarcada (o sin permiso
 * de citas) es lo de antes: la visita sola.
 */
export function AbrirVisitaHoyModal({ patientId, s, planeadas, conAgenda, onSinAgenda, onClose, onFallo }: {
  patientId: string;
  s: SesionDeTratamiento;
  planeadas: number | null;
  /** ¿Se ofrece la casilla? Permiso de `citas` y tratamiento activo. */
  conAgenda: boolean;
  /** Lo de antes: la visita sola (`paraSesion`). La crea y navega el hook del tratamiento. */
  onSinAgenda: () => Promise<void>;
  onClose: () => void;
  /** Algo quedó a medias (la cita sí, la visita no): re-leer el tratamiento. */
  onFallo: () => void;
}) {
  const router = useRouter();
  const { doctorProfile } = useDoctorProfile();
  const [enAgenda, setEnAgenda] = useState(conAgenda);
  const [servicios, setServicios] = useState<Servicio[] | null | 'error'>(null);
  const [servicioId, setServicioId] = useState(s.servicioId ?? '');
  const [hora, setHora] = useState(horaDeAhora);
  const [paciente, setPaciente] = useState<{ firstName: string; lastName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!conAgenda) return;
    let vigente = true;
    authFetch('/api/doctor/services').then((r) => r.json())
      .then((d) => { if (vigente) setServicios(d?.success ? d.data as Servicio[] : 'error'); })
      .catch(() => { if (vigente) setServicios('error'); });
    fetch(`/api/medical-records/patients/${patientId}`).then((r) => r.json())
      .then((d) => { const p = d?.data; if (vigente && p?.firstName) setPaciente({ firstName: p.firstName, lastName: p.lastName ?? '' }); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [conAgenda, patientId]);

  // El servicio guardado en la sesión puede ya no existir: entonces hay que elegir otro.
  const servicioValido = Array.isArray(servicios) && servicios.some((x) => x.id === servicioId);
  const listoParaAgenda = servicioValido && /^\d{2}:\d{2}$/.test(hora) && !!paciente && !!doctorProfile?.id;

  const confirmar = async () => {
    setError(null);
    if (!enAgenda) {
      setTrabajando(true);
      await onSinAgenda();
      setTrabajando(false);
      return;
    }
    if (!listoParaAgenda) return;
    setTrabajando(true);
    let bookingId: string;
    try {
      const res = await authFetch(`${API_URL}/api/appointments/range-bookings/instant`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctorProfile!.id,
          date: getClinicDateString(),
          startTime: hora,
          serviceId: servicioId,
          patientName: `${paciente!.firstName} ${paciente!.lastName}`.trim(),
          patientFirstName: paciente!.firstName,
          patientLastName: paciente!.lastName,
          isFirstTime: false,
          appointmentMode: 'PRESENCIAL',
          patientId,
          paraSesion: s.id,
          enConsulta: true,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success || !d?.data?.id) {
        // Traslape, horario bloqueado…: se queda en el modal para cambiar la hora o desmarcar.
        setError(d?.error || `No se pudo crear la cita (${res.status})`);
        setTrabajando(false);
        return;
      }
      bookingId = d.data.id;
      if (d.sesionLigada?.ligada !== true) {
        // La cita existe pero no quedó en la sesión: no se abre una visita que no sería de ella.
        toast.error('La cita se creó, pero no quedó en la sesión: cancélala desde la agenda y vuelve a intentar.');
        onFallo();
        onClose();
        return;
      }
    } catch {
      setError('No se pudo crear la cita. Revisa tu conexión e intenta de nuevo.');
      setTrabajando(false);
      return;
    }
    try {
      // La sesión ya tiene esta cita: la visita de la cita entra sola a la sesión (G3).
      const res = await fetch(`/api/medical-records/patients/${patientId}/visitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.data?.id) throw new Error(d?.error);
      router.push(visitaHref(patientId, d.data.id));
    } catch {
      toast.error('La cita se creó, pero la visita no: ábrela desde la sesión.');
      onFallo();
      onClose();
    }
  };

  const elegido = Array.isArray(servicios) ? servicios.find((x) => x.id === servicioId) : undefined;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Abrir visita hoy · {etiquetaSesion(s.numero, planeadas)}</h2>
          <button onClick={onClose} disabled={trabajando} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <p className="text-gray-700">
            La visita queda con fecha de <strong>hoy</strong>
            {enAgenda ? ' y la sesión cuenta como atendida al completar su cita.' : ' y la sesión cuenta como atendida.'}
            {' '}Si la sesión es otro día, mejor agéndala.
          </p>

          {conAgenda && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={enAgenda} onChange={(e) => setEnAgenda(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-medium text-gray-900">También en la agenda</span>
                <span className="block text-xs text-gray-500">
                  Se crea su cita de hoy (sin avisarle al paciente) y se cobra al completarla, como cualquier otra.
                </span>
              </span>
            </label>
          )}

          {conAgenda && enAgenda && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
                <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} disabled={!Array.isArray(servicios)} className={inputClass}>
                  <option value="">
                    {servicios === null ? 'Cargando servicios…' : servicios === 'error' ? 'No se pudieron cargar los servicios' : 'Elige un servicio…'}
                  </option>
                  {Array.isArray(servicios) && servicios.map((x) => (
                    <option key={x.id} value={x.id}>{x.serviceName}{x.price != null ? ` · ${pesos(x.price)}` : ''}</option>
                  ))}
                </select>
                {/* El precio de la cita es el de la SESIÓN si tiene uno propio (el servidor lo pone). */}
                {elegido && s.precio != null && s.fuente === 'sesion' && s.precio !== elegido.price && (
                  <p className="text-xs text-gray-500 mt-1">La cita toma el precio de la sesión: {pesos(s.precio)}.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
              </div>
              {!paciente && <p className="text-xs text-gray-500">Cargando al paciente…</p>}
            </div>
          )}

          {!enAgenda && conAgenda && (
            <p className="text-xs text-amber-700">Sin cita: esta sesión no se cobra desde la agenda.</p>
          )}

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={trabajando} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={trabajando || (enAgenda && !listoParaAgenda)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {trabajando && <Loader2 className="w-4 h-4 animate-spin" />}
            {enAgenda ? 'Abrir visita y agendar' : 'Abrir visita'}
          </button>
        </div>
      </div>
    </div>
  );
}
