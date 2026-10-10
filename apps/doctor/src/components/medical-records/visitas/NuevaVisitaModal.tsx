'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { getClinicDateString } from '@/lib/dates';
import { toast } from '@/lib/practice-toast';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import type { TratamientoResumen } from '@/lib/tratamientos-ui';
import { CamposDeCita } from '@/components/medical-records/tratamientos/AbrirVisitaHoyModal';
import { CompleteBookingModal, type CitaParaCompletar } from '@/components/citas/CompleteBookingModal';
import { completarCita } from '@/lib/citas/acciones-cita';
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
 * VISITAS D4 → 08-PLAN F1 → 09-PLAN L3 — «Nueva Visita». La visita se crea al CONFIRMAR aquí.
 *
 * TODA visita nace con su cita (nota N2, 2026-10-10): visita y cita son el mismo evento.
 *   · SIEMPRE se crea una cita nueva (`useCitaEnConsulta`) y la visita nace con ella — también un día en
 *     que el paciente ya tiene otra cita (otra hora = otra visita; pedido del usuario 2026-10-10, quita la
 *     regla de 08 F1 «ese día abre la de su cita», que venía de cuando había visitas sin cita). El choque
 *     de horario lo dice el servidor, como en la agenda. Las citas de ese día salen como AVISO con
 *     «Abrir su visita», que no estorba:
 *       hoy    → sin pedir contacto ni avisar (está aquí);
 *       pasado → igual y, creada, el MISMO «Completar cita» de la agenda (su cobro; $0 = cortesía);
 *       futuro → cita normal, con el contacto que el doctor exige y su correo de confirmación.
 *   · Sin permiso de citas no se crean visitas (el servidor también exige la cita).
 */
export function NuevaVisitaModal({
  patientId, onClose, bookings, verCitas, visitas, visitasEstado, citasEstado, recargarVisitas, tratamientos = [],
}: Props) {
  const router = useRouter();
  const hoy = getClinicDateString();
  const [fecha, setFecha] = useState(hoy);
  const [guardando, setGuardando] = useState(false);
  // «Abrir su visita» del aviso: NO es crear (el botón principal no dice «Creando…»).
  const [abriendo, setAbriendo] = useState(false);
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

  // Las citas VIVAS del paciente ese día (no canceladas ni «no asistió»): sólo un AVISO con «Abrir su
  // visita» — ya no impiden crear otra (otra hora = otra cita y otra visita).
  const citasDelDia = useMemo(() => {
    if (!listo || !verCitas || !fecha) return [];
    return bookings
      .filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW' && (b.date ?? '').slice(0, 10) === fecha)
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }, [listo, verCitas, bookings, fecha]);

  // 09-PLAN L3: se CREA su cita (cualquier día). Requiere permiso de citas.
  const esFutura = !!fecha && fecha > hoy;
  const esPasada = !!fecha && fecha < hoy;
  const conCita = listo && verCitas && !!fecha;
  const futuraConCita = conCita && esFutura;
  const c = useCitaEnConsulta(patientId, listo && verCitas);
  // Día pasado: creada la cita, se completa con el MISMO modal de la agenda; al cerrarlo se abre la visita.
  const [porCompletar, setPorCompletar] = useState<{ bookingId: string; visitaId: string; cita: CitaParaCompletar } | null>(null);
  const completada = useRef(false);
  const [servicioId, setServicioId] = useState('');
  const [hora, setHora] = useState(horaDeAhora);
  const [contacto, setContacto] = useState<Contacto>({ correo: '', telefono: '', whatsapp: '' });
  const [error, setError] = useState<string | null>(null);
  // Un error de la cita («ese horario ya está ocupado») habla de la fecha/hora/servicio de ENTONCES:
  // al cambiar cualquiera de los tres ya no aplica.
  useEffect(() => { setError(null); }, [fecha, hora, servicioId]);
  // Hora por omisión: HOY la de ahora (el paciente está enfrente); otro día las 10:00, no la hora del
  // reloj (a la 1 a. m. proponía 01:07). Sólo mientras el doctor no la haya escrito él.
  const horaTocada = useRef(false);
  const cambiarHora = (h: string) => { horaTocada.current = true; setHora(h); };
  const esHoy = fecha === hoy;
  useEffect(() => {
    if (!horaTocada.current) setHora(esHoy ? horaDeAhora() : '10:00');
  }, [esHoy]);
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
  const faltan = futuraConCita ? c.faltaContacto(contacto) : '';

  // Visitas que no son de NINGÚN tratamiento, del MISMO día o ANTERIORES (H-024). Las 20 más recientes.
  // (La de otra cita del mismo día también: la nueva es OTRA visita y puede ser su seguimiento.)
  const visitasSueltas = useMemo(
    () => (fecha ? visitas.filter((v) => !v.sesion && v.fecha.slice(0, 10) <= fecha).slice(0, 20) : []),
    [visitas, fecha],
  );
  // Si al cambiar la fecha la visita elegida queda fuera (posterior), la elección vale «No».
  const seguimientoEf =
    seguimiento.startsWith('v:') && !visitasSueltas.some((v) => `v:${v.id}` === seguimiento) ? '' : seguimiento;
  useEffect(() => {
    setSeguimiento((s) => (s.startsWith('v:') ? '' : s));
  }, [fecha]);
  const ofrecerSeguimiento = listo && (activos.length > 0 || visitasSueltas.length > 0);
  const cuerpoSeguimiento = ofrecerSeguimiento && seguimientoEf
    ? { seguimiento: seguimientoEf.startsWith('t:') ? { tratamientoId: seguimientoEf.slice(2) } : { visitaId: seguimientoEf.slice(2) } }
    : {};

  /** Crea la visita de la cita `bookingId` (09 L3: el servidor ya no acepta una visita sin cita). */
  const crearVisita = async (body: Record<string, unknown>, conSeguimiento = true) => {
    const res = await fetch(`/api/medical-records/patients/${patientId}/visitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...(conSeguimiento ? cuerpoSeguimiento : {}) }),
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
  const abrirExistente = async (visitaId: string, navegar = true) => {
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
    if (navegar) router.push(visitaHref(patientId, visitaId));
  };

  /**
   * El AVISO de una cita de ese día: abre su visita (o, en una cita de antes del 9 oct que no la tiene,
   * la crea — de ESA cita). No crea citas. Si se eligió «¿Es seguimiento?», se aplica a ESA visita: es el
   * camino documentado para meter a un tratamiento la cita que se agendó desde la agenda.
   */
  const abrirVisitaDeCita = async (bookingId: string, esSesion: boolean) => {
    const existente = visitaPorCita.get(bookingId);
    // El seguimiento elegido NO aplica si esa visita ya es de un tratamiento (la de una sesión, o ya
    // marcada) — el servidor diría 409 y no se abriría — ni si lo elegido es ella MISMA. Se abre y se dice.
    const yaEnTratamiento = esSesion || (!!existente && !!visitas.find((v) => v.id === existente)?.sesion);
    const deSiMisma = !!existente && seguimientoEf === `v:${existente}`;
    const aplicaSeguimiento = !!cuerpoSeguimiento.seguimiento && !yaEnTratamiento && !deSiMisma;
    if (cuerpoSeguimiento.seguimiento && !aplicaSeguimiento) {
      toast.warning(deSiMisma
        ? 'Una visita no puede ser seguimiento de sí misma: se abre sin cambiarla.'
        : 'Esa visita ya es de un tratamiento: se abre sin marcarla como seguimiento.');
    }
    setAbriendo(true);
    try {
      if (existente) {
        if (aplicaSeguimiento) await abrirExistente(existente);
        else router.push(visitaHref(patientId, existente));
        return;
      }
      const { res, data } = await crearVisita({ bookingId }, aplicaSeguimiento);
      if (res.status === 409 && data?.error === 'La cita ya tiene una visita') {
        // La lista era vieja: le nació su visita después. Se re-lee y el aviso ya la abre.
        await recargarVisitas();
        toast.error('Esa cita ya tiene su visita. Vuelve a picar «Abrir su visita».');
        setAbriendo(false);
        return;
      }
      if (!res.ok || !data?.data?.id) throw new Error(data?.error || 'No se pudo abrir la visita');
      avisarSeguimiento(data.data.seguimiento);
      router.push(visitaHref(patientId, data.data.id));
    } catch (err: any) {
      toast.error(err.message || 'No se pudo abrir la visita');
      setAbriendo(false);
    }
  };

  /** Día pasado: tras crear su cita, el «Completar cita» de la agenda; si no, directo a la visita. */
  const despuesDeCrear = (r: { bookingId: string; finalPrice?: number }, visitaId: string) => {
    if (!esPasada) { router.push(visitaHref(patientId, visitaId)); return; }
    const servicio = Array.isArray(c.servicios) ? c.servicios.find((x) => x.id === servicioId) : undefined;
    setPorCompletar({
      bookingId: r.bookingId, visitaId,
      cita: {
        patientName: c.paciente ? [c.paciente.firstName, c.paciente.lastName].filter(Boolean).join(' ') : 'Paciente',
        serviceName: servicio?.serviceName ?? null,
        finalPrice: r.finalPrice ?? Number(servicio?.price ?? 0),
        ingreso: null, paymentLink: null, mpPaymentPreference: null,
      },
    });
  };

  const confirmar = async () => {
    setError(null);
    if (!fecha) { toast.error('Elige la fecha de la visita'); return; }
    // 09-PLAN L3: toda visita lleva su cita (el servidor también lo exige).
    if (!conCita) return;
    setGuardando(true);
    try {
      // Su cita nueva (cualquier día, aunque ese día ya tenga otra), luego su visita.
      if (!c.listoPara(servicioId, hora) || faltan) { setGuardando(false); return; }
      const r = await c.crear({ servicioId, hora, fecha, ...(esFutura ? { contacto } : {}) });
      if (!r.ok) { setError(r.error); setGuardando(false); return; }
      // 08-PLAN F2: la cita ya nació con su visita: se abre ésa (con seguimiento, primero entra al
      // tratamiento). Con la API de antes no viene `visitaId`: se crea como antes.
      if (r.visitaId) {
        try {
          await abrirExistente(r.visitaId, false);
        } catch (err: any) {
          toast.error(`La cita y su visita se crearon, pero no se marcó como seguimiento (${err.message}). Hazlo desde Nueva Visita.`);
        }
        despuesDeCrear(r, r.visitaId);
        return;
      }
      const { res, data } = await crearVisita({ bookingId: r.bookingId });
      if (!res.ok || !data?.data?.id) {
        toast.error('La cita se creó, pero la visita no: en «Nueva Visita» con esa fecha, «Abrir su visita».');
        await recargarVisitas();
        setGuardando(false);
        onClose();
        return;
      }
      avisarSeguimiento(data.data.seguimiento);
      despuesDeCrear(r, data.data.id);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo crear la visita');
      setGuardando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500';
  const textoBoton = guardando ? 'Creando…'
    : citasDelDia.length > 0 ? 'Crear otra cita y visita'
    : esFutura ? 'Agendar cita y crear visita'
    : esPasada ? 'Registrar cita y crear visita'
    : 'Crear visita y agendar';

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
              . Recarga la página antes de crear la visita: hace falta saber qué citas tiene ese día.
            </p>
          )}
          {listo && !verCitas && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Toda visita nace con su cita, y no tienes permiso de citas: no puedes crear visitas. Las visitas de
              las citas del paciente se abren desde su tarjeta «Visitas».
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              // Cualquier día: la visita nace con su cita (hoy · un día pasado · un día futuro, 09 L3).
              className={inputClass}
            />
            {conCita && (
              <p className="text-xs text-gray-500 mt-1">
                {esFutura
                  ? 'Fecha futura: se agenda su cita y la visita nace con ella (le puedes subir cosas antes).'
                  : esPasada
                    ? 'Día pasado: se registra su cita (sin avisarle al paciente) y enseguida la completas con su cobro.'
                    : 'Hoy: se agenda su cita de hoy, sin pedirle correo ni teléfono y sin avisarle (está contigo).'}
              </p>
            )}
          </div>

          {conCita && !esFutura && (
            <CamposDeCita c={c} servicioId={servicioId} setServicioId={setServicioId} hora={hora} setHora={cambiarHora} />
          )}
          {futuraConCita && (
            <div className="space-y-3">
              <CamposDeCita c={c} servicioId={servicioId} setServicioId={setServicioId} hora={hora} setHora={cambiarHora} />
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

          {/* Aviso, no candado: las citas que ya tiene ese día, cada una con su visita a un clic. */}
          {citasDelDia.length > 0 && (
            <div className="text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
              {citasDelDia.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 flex-wrap">
                  <span>Ese día ya tiene cita{[b.startTime, b.serviceName].filter(Boolean).length ? ` (${[b.startTime, b.serviceName].filter(Boolean).join(' · ')})` : ''}.</span>
                  <button
                    type="button" onClick={() => abrirVisitaDeCita(b.id, b.esSesion === true)} disabled={guardando || abriendo}
                    className="text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
                  >
                    Abrir su visita
                  </button>
                </div>
              ))}
              <p className="text-xs text-blue-700">Si es otra consulta ese mismo día, crea ésta con otra hora.</p>
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
            disabled={guardando || abriendo || cargando || fallo || !conCita || !c.listoPara(servicioId, hora) || !!faltan}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {textoBoton}
          </button>
        </div>
      </div>
      {/* Día pasado: el MISMO «Completar cita» de la agenda. Cerrarlo sin completar deja la cita vencida —
          se completa desde la visita (sus botones son los de la agenda). */}
      {porCompletar && (
        <CompleteBookingModal
          booking={porCompletar.cita}
          onConfirm={async (precio, forma) => {
            const r = await completarCita(porCompletar.bookingId, precio, forma);
            completada.current = r.ok;
            return r.ok ? { ledgerEntryId: r.ledgerEntryId } : {};
          }}
          onClose={() => {
            if (!completada.current) toast.warning('La cita quedó sin completar: complétala desde la visita, en «Cita».');
            router.push(visitaHref(patientId, porCompletar.visitaId));
          }}
        />
      )}
    </div>
  );
}
