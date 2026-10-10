'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { getClinicDateString } from '@/lib/dates';
import { toast } from '@/lib/practice-toast';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import type { TratamientoResumen } from '@/lib/tratamientos-ui';
import { CamposDeCita, CasillaEnAgenda } from '@/components/medical-records/tratamientos/AbrirVisitaHoyModal';
import { horaDeAhora, useCitaEnConsulta, type Contacto } from './useCitaEnConsulta';

interface Props {
  patientId: string;
  onClose: () => void;
  /** Citas del paciente (ya recortadas por permiso). Sin `citas` llegan vacías. */
  bookings: PatientBooking[];
  verCitas: boolean;
  /** Para saber qué citas YA tienen visita. */
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
 * VISITAS D4 → 08-PLAN F1 — «Nueva Visita». La visita se crea al CONFIRMAR aquí, no al picar el botón.
 *
 * Ya NO se elige «¿De qué cita?» (no se liga a mano): visita y cita son el mismo evento.
 *   · Si el paciente tiene una CITA viva ese día, su visita ES la de esa cita: se ofrece abrirla (o
 *     abrirla por primera vez). No se crea una suelta ese día — el servidor también lo rechaza.
 *   · Si no, nace una visita de ese día (hoy o antes, P2) y, HOY, con **«También en la agenda»**
 *     (marcada) también su cita (`useCitaEnConsulta`, como «Abrir visita hoy» del tratamiento).
 */
export function NuevaVisitaModal({
  patientId, onClose, bookings, verCitas, visitas, visitasEstado, citasEstado, recargarVisitas, tratamientos = [],
}: Props) {
  const router = useRouter();
  const hoy = getClinicDateString();
  const [fecha, setFecha] = useState(hoy);
  const [guardando, setGuardando] = useState(false);
  // T7 «¿Es seguimiento?»: '' = no · 't:<tratamientoId>' = sesión siguiente · 'v:<visitaId>' = de una visita anterior.
  const [seguimiento, setSeguimiento] = useState('');
  const activos = useMemo(() => tratamientos.filter((t) => t.estado === 'activo'), [tratamientos]);

  const visitaPorCita = useMemo(
    () => new Map(visitas.flatMap((v) => (v.cita ? [[v.cita.id, v.id] as const] : []))),
    [visitas],
  );

  // ⚠️ Mientras citas o visitas cargan NO se crea nada: no se sabría si ese día ya tiene cita.
  const cargando = citasEstado === 'cargando' || visitasEstado === 'cargando';
  const fallo = citasEstado === 'error' || visitasEstado === 'error';
  const listo = !cargando && !fallo;

  // La cita VIVA del paciente ese día (no cancelada ni «no asistió»): su visita es la de esa cita.
  const citaDelDia = useMemo(() => {
    if (!listo || !verCitas || !fecha) return null;
    return bookings
      .filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW' && (b.date ?? '').slice(0, 10) === fecha)
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))[0] ?? null;
  }, [listo, verCitas, bookings, fecha]);
  const visitaExistente = citaDelDia ? visitaPorCita.get(citaDelDia.id) : undefined;
  const citaEsSesion = citaDelDia?.esSesion === true;

  // HOY sin cita: «También en la agenda» (con permiso de citas). Marcada por default.
  const ofreceAgenda = listo && verCitas && fecha === hoy && !citaDelDia;
  // Fecha FUTURA sin cita ese día (pedido del usuario 2026-10-10): la visita futura nace CON su cita —
  // siempre (una visita futura sin cita no existe, 07-PLAN P2). Una cita normal: con el contacto que el
  // doctor exige y su correo de confirmación. Requiere permiso de citas.
  const esFutura = !!fecha && fecha > hoy;
  const futuraConCita = listo && verCitas && esFutura && !citaDelDia;
  const c = useCitaEnConsulta(patientId, listo && verCitas);
  const [enAgenda, setEnAgenda] = useState(true);
  const [servicioId, setServicioId] = useState('');
  const [hora, setHora] = useState(horaDeAhora);
  const [contacto, setContacto] = useState<Contacto>({ correo: '', telefono: '', whatsapp: '' });
  const [error, setError] = useState<string | null>(null);
  // Sin sesión de la que tomar el servicio: el primero de la lista, a la vista y cambiable.
  useEffect(() => {
    if (!servicioId && Array.isArray(c.servicios) && c.servicios.length) setServicioId(c.servicios[0].id);
  }, [c.servicios, servicioId]);
  // El contacto del expediente precarga el de la cita futura (una vez, al llegar).
  const contactoCargado = useRef(false);
  useEffect(() => {
    if (contactoCargado.current || !c.paciente) return;
    contactoCargado.current = true;
    setContacto(c.contactoInicial);
  }, [c.paciente, c.contactoInicial]);
  const conCita = (ofreceAgenda && enAgenda) || futuraConCita;
  const faltan = futuraConCita ? c.faltaContacto(contacto) : '';

  // Visitas que no son de NINGÚN tratamiento, del MISMO día o ANTERIORES (H-024). Las 20 más recientes.
  // (Sin la de la cita de ese día: una visita no es seguimiento de sí misma.)
  const visitasSueltas = useMemo(
    () => (fecha
      ? visitas.filter((v) => !v.sesion && v.fecha.slice(0, 10) <= fecha && v.id !== visitaExistente).slice(0, 20)
      : []),
    [visitas, fecha, visitaExistente],
  );
  // 08-PLAN F2: la visita de la cita ya existe (nace al agendar). Si aún no es de un tratamiento, también
  // puede marcarse como seguimiento (PATCH `seguimiento`).
  const existenteEnTratamiento = !!visitas.find((v) => v.id === visitaExistente)?.sesion;
  // Si al cambiar la fecha la visita elegida queda fuera (posterior), la elección vale «No».
  const seguimientoEf =
    seguimiento.startsWith('v:') && !visitasSueltas.some((v) => `v:${v.id}` === seguimiento) ? '' : seguimiento;
  useEffect(() => {
    setSeguimiento((s) => (s.startsWith('v:') ? '' : s));
  }, [fecha]);
  // La cita de una sesión ya lleva su visita al tratamiento: ahí no se pregunta (el servidor diría 409).
  const ofrecerSeguimiento = listo && !existenteEnTratamiento && !citaEsSesion && (activos.length > 0 || visitasSueltas.length > 0);
  const cuerpoSeguimiento = ofrecerSeguimiento && seguimientoEf
    ? { seguimiento: seguimientoEf.startsWith('t:') ? { tratamientoId: seguimientoEf.slice(2) } : { visitaId: seguimientoEf.slice(2) } }
    : {};

  /** Crea la visita (con `bookingId` = la de esa cita; sin él = suelta de ese día) y navega a ella. */
  const crearVisita = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/medical-records/patients/${patientId}/visitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...cuerpoSeguimiento }),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  };

  const avisarSeguimiento = (seg: { tratamientoCreado?: string | null; numero: number } | undefined) => {
    if (!seg) return;
    toast.success(seg.tratamientoCreado
      ? `Se creó el tratamiento «${seg.tratamientoCreado}»: esta visita es su sesión ${seg.numero}`
      : `Esta visita es la sesión ${seg.numero} de su tratamiento`);
  };

  /** 08-PLAN F2 — abre una visita que YA existe; si se eligió seguimiento, primero la mete al tratamiento. */
  const abrirExistente = async (visitaId: string) => {
    if (cuerpoSeguimiento.seguimiento) {
      const res = await fetch(`/api/medical-records/patients/${patientId}/visitas/${visitaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seguimiento: cuerpoSeguimiento.seguimiento }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'No se pudo marcar como seguimiento');
      avisarSeguimiento(data?.data?.seguimiento);
    }
    router.push(visitaHref(patientId, visitaId));
  };

  const confirmar = async () => {
    setError(null);
    if (visitaExistente) {
      setGuardando(true);
      try {
        await abrirExistente(visitaExistente);
      } catch (err: any) {
        toast.error(err.message || 'No se pudo abrir la visita');
        setGuardando(false);
      }
      return;
    }
    if (!fecha) { toast.error('Elige la fecha de la visita'); return; }
    // 07-PLAN P2 (el servidor también lo rechaza): sin cita, sólo hoy o antes. (Futura con permiso de
    // citas → se agenda su cita: `futuraConCita`.)
    if (!citaDelDia && fecha > hoy && !futuraConCita) {
      toast.error('Una visita sin cita no puede ser en el futuro: agenda una cita para ese día');
      return;
    }
    setGuardando(true);
    try {
      // 1) La cita de ese día YA existe (sin visita todavía): se abre la suya.
      if (citaDelDia) {
        const { res, data } = await crearVisita({ bookingId: citaDelDia.id });
        if (res.status === 409 && data?.error === 'La cita ya tiene una visita') {
          // La lista era vieja: a esa cita le nació su visita después. Se re-lee y el botón pasa a «Abrir su visita».
          await recargarVisitas();
          toast.error('Esa cita ya tiene su visita. Ábrela desde aquí.');
          setGuardando(false);
          return;
        }
        if (!res.ok || !data?.data?.id) throw new Error(data?.error || 'No se pudo abrir la visita');
        avisarSeguimiento(data.data.seguimiento);
        router.push(visitaHref(patientId, data.data.id));
        return;
      }
      // 2) HOY con «También en la agenda», o una fecha FUTURA: primero su cita, luego su visita.
      if (conCita) {
        if (!c.listoPara(servicioId, hora) || faltan) { setGuardando(false); return; }
        const r = await c.crear({ servicioId, hora, ...(esFutura ? { fecha, contacto } : {}) });
        if (!r.ok) { setError(r.error); setGuardando(false); return; }
        // 08-PLAN F2: la cita ya nació con su visita: se abre ésa (con seguimiento, primero entra al
        // tratamiento). Con la API de antes no viene `visitaId`: se crea como antes.
        if (r.visitaId) {
          try {
            await abrirExistente(r.visitaId);
          } catch (err: any) {
            toast.error(`La cita y su visita se crearon, pero no se marcó como seguimiento (${err.message}). Hazlo desde Nueva Visita.`);
            router.push(visitaHref(patientId, r.visitaId));
          }
          return;
        }
        const { res, data } = await crearVisita({ bookingId: r.bookingId });
        if (!res.ok || !data?.data?.id) {
          toast.error('La cita se creó, pero la visita no: ábrela desde la cita (Nueva Visita la ofrece).');
          await recargarVisitas();
          setGuardando(false);
          onClose();
          return;
        }
        avisarSeguimiento(data.data.seguimiento);
        router.push(visitaHref(patientId, data.data.id));
        return;
      }
      // 3) Sin cita: la visita sola de ese día.
      const { res, data } = await crearVisita({ fecha });
      if (!res.ok || !data?.data?.id) throw new Error(data?.error || 'No se pudo crear la visita');
      avisarSeguimiento(data.data.seguimiento);
      router.push(visitaHref(patientId, data.data.id));
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear la visita');
      setGuardando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500';
  const textoBoton = visitaExistente ? 'Abrir su visita'
    : citaDelDia ? 'Abrir la visita de su cita'
    : guardando ? 'Creando…'
    : futuraConCita ? 'Agendar cita y crear visita'
    : conCita ? 'Crear visita y agendar' : 'Crear visita';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Visita</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {cargando && <p className="text-sm text-gray-500">Cargando las citas del paciente…</p>}
          {fallo && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {citasEstado === 'error'
                ? 'No se pudieron cargar las citas del paciente'
                : 'No se pudieron cargar sus visitas'}
              . Recarga la página antes de crear la visita: si ese día tiene cita, su visita es la de la cita.
            </p>
          )}
          {listo && !verCitas && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No tienes permiso para ver citas, así que esta visita se crea sin cita. Si ese día el paciente tiene
              cita, no se puede crear: su visita es la de la cita.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              // Cualquier día: hoy o antes es una visita; un día FUTURO agenda su cita (la visita nace con ella).
              className={inputClass}
            />
            {!citaDelDia && (
              <p className="text-xs text-gray-500 mt-1">
                {esFutura
                  ? 'Fecha futura: se agenda su cita y la visita nace con ella (le puedes subir cosas antes).'
                  : 'Hoy o antes. Para un día futuro también: se agenda su cita.'}
              </p>
            )}
          </div>

          {futuraConCita && (
            <div className="space-y-3">
              <CamposDeCita c={c} servicioId={servicioId} setServicioId={setServicioId} hora={hora} setHora={setHora} />
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['correo', 'Correo', c.requeridos.email],
                  ['telefono', 'Teléfono', c.requeridos.phone],
                  ['whatsapp', 'WhatsApp', c.requeridos.whatsapp],
                ] as const).map(([k, etiqueta, req]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{etiqueta}{req ? ' *' : ''}</label>
                    <input
                      type={k === 'correo' ? 'email' : 'text'} value={contacto[k]}
                      onChange={(e) => setContacto((x) => ({ ...x, [k]: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
              {faltan && <p className="text-xs text-amber-700">Falta: {faltan}.</p>}
              <p className="text-xs text-gray-500">Al paciente le llega el correo de confirmación de la cita, como al agendar en la agenda.</p>
            </div>
          )}
          {listo && !verCitas && esFutura && !citaDelDia && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Para un día futuro se agenda una cita, y no tienes permiso de citas.
            </p>
          )}

          {citaDelDia && (
            <p className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Ese día tiene cita ({[citaDelDia.startTime, citaDelDia.serviceName].filter(Boolean).join(' · ')}): su visita es la
              de esa cita{visitaExistente ? '. Ábrela para agregarle plantillas, fotos, notas o recetas.' : ' y se abre ahora.'}
              {citaEsSesion && !visitaExistente && ' Es sesión de un tratamiento: la visita entra sola a él.'}
            </p>
          )}

          {ofreceAgenda && (
            <>
              <CasillaEnAgenda enAgenda={enAgenda} setEnAgenda={setEnAgenda} />
              {enAgenda && (
                <CamposDeCita c={c} servicioId={servicioId} setServicioId={setServicioId} hora={hora} setHora={setHora} />
              )}
            </>
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

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
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
            disabled={guardando || cargando || fallo || (conCita && (!c.listoPara(servicioId, hora) || !!faltan))}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
