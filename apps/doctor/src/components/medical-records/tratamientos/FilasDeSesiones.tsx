'use client';

/**
 * TRATAMIENTOS v2 · V3 — las FILAS de sesiones, compartidas por «Nuevo tratamiento» y «Agendar
 * sesiones» (docs/DESDE JUNIO/VISITAS/06-PLAN-tratamientos-v2.md §3.1 y §6). Cada fila: servicio
 * (precio editable con `flujo`), fecha y hora (pre-llenadas con la regla base — primera · hora · cada N
 * días — y editables por fila), «agendar después», y su DISPONIBILIDAD (✅ / 🔴) antes de confirmar.
 *
 * Reglas del DISEÑO §4 que se conservan de T5 (no se negocian):
 *   1. cada cita por la MISMA ruta que la agenda (`range-bookings/instant`) — que vuelve a revisar
 *      choques al crear — y ligada a SU sesión en esa petición (`paraSesion`; nace con el precio de la
 *      sesión, V1);
 *   2. falla parcial = se crea lo que cabe; la pantalla dice cuál no y por qué;
 *   3. UN aviso al paciente: presencial → un correo resumen; telemedicina → cada cita manda el suyo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useDoctorProfile } from '@/contexts/DoctorProfileContext';
import { usePermissions } from '@/lib/permissions-client';
import { getClinicDateString } from '@/lib/dates';
import { formatoFechaVisita } from '@/lib/visitas-ui';
import { etiquetaSesion, pesos } from '@/lib/tratamientos-ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Servicio { id: string; serviceName: string; durationMinutes: number; price: number | null }
interface Consultorio { id: string; name: string }
interface Paciente { firstName: string; lastName: string }

/** Una fila = una sesión (existente o por crear). */
export interface Fila {
  key: string;
  numero: number;
  /** La sesión ya existe («Agendar sesiones»); sin él, nace al confirmar («Nuevo tratamiento»). */
  sesionId?: string;
  servicioId: string;
  servicioNombre: string;
  /** Texto del input; '' = sin precio propio. */
  precio: string;
  fecha: string;
  hora: string;
  /** «Agendar después»: la sesión queda «por agendar» (con servicio y precio si se eligieron). */
  despues: boolean;
  /** Fecha/hora tocadas a mano: cambiar la regla base ya no las recalcula. */
  tocada: boolean;
  /** Lo que la fila tenía guardado (sólo sesiones existentes): para mandar sólo lo que cambió. */
  original?: { servicioId: string | null; servicioNombre: string | null; precio: number | null };
}

type Disp = { estado: 'revisando' } | { estado: 'ok' } | { estado: 'choque'; texto: string } | { estado: 'error' };

export type Resultado =
  | { key: string; numero: number; fecha: string; hora: string; ok: true; ligada: boolean; bookingId: string }
  | { key: string; numero: number; fecha: string; hora: string; ok: false; error: string };

/** ¿Es un día que `Date` puede usar? (un año a medio teclear tumbaba la página — 2026-10-01). */
export function fechaUsable(fecha: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(new Date(`${fecha}T12:00:00Z`).getTime());
}
/** 'YYYY-MM-DD' + n días (UTC: sin saltos por horario de verano). */
function sumarDias(fecha: string, n: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const precioValido = (p: string) => p.trim() === '' || (Number.isFinite(Number(p)) && Number(p) >= 0);
const lista = (f: Fila) => !f.despues;

/**
 * Todo lo que agendar necesita (servicios, paciente y su contacto, consultorios, modalidad) y el estado
 * de las filas con su regla base y su disponibilidad. Lo usan los dos modales.
 */
export function useAgendaDeSesiones(patientId: string, filasIniciales: Fila[], intervaloInicial: number | null) {
  const { doctorProfile } = useDoctorProfile();
  const { can } = usePermissions();
  const conFlujo = can('flujo');
  const [filas, setFilas] = useState<Fila[]>(filasIniciales);
  const [base, setBase] = useState({ fecha: getClinicDateString(), hora: '10:00', cada: String(intervaloInicial ?? 7) });
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [consultorios, setConsultorios] = useState<Consultorio[] | null>(null);
  const [consultorioId, setConsultorioId] = useState('');
  const [modalidad, setModalidad] = useState<'PRESENCIAL' | 'TELEMEDICINA'>('PRESENCIAL');
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [requeridos, setRequeridos] = useState({ email: true, phone: true, whatsapp: true });
  const [errorCarga, setErrorCarga] = useState(false);
  const [disp, setDisp] = useState<Record<string, Disp>>({});

  useEffect(() => {
    authFetch('/api/doctor/services').then((r) => r.json())
      .then((d) => setServicios(d?.success ? d.data as Servicio[] : []))
      .catch(() => { setServicios([]); setErrorCarga(true); });
    fetch(`/api/medical-records/patients/${patientId}`).then((r) => r.json())
      .then((d) => {
        const p = d?.data;
        if (!p?.firstName) { setErrorCarga(true); return; }
        setPaciente({ firstName: p.firstName, lastName: p.lastName ?? '' });
        setCorreo(p.email ?? '');
        setTelefono(p.phone ?? '');
        setWhatsapp(p.phone ?? '');
      })
      .catch(() => setErrorCarga(true));
    authFetch('/api/doctor/booking-field-settings').then((r) => r.json())
      .then((d) => {
        const raw = d?.data;
        if (d?.success && raw) {
          setRequeridos({
            email: raw.bookingInstantEmailRequired ?? true,
            phone: raw.bookingInstantPhoneRequired ?? true,
            whatsapp: raw.bookingInstantWhatsappRequired ?? true,
          });
        }
      })
      .catch(() => {});
  }, [patientId]);

  useEffect(() => {
    const slug = doctorProfile?.slug;
    if (!slug) return;
    fetch(`${API_URL}/api/doctors/${slug}/locations`).then((r) => r.json())
      .then((d) => setConsultorios(d?.success && Array.isArray(d.data) ? d.data as Consultorio[] : []))
      .catch(() => setConsultorios([]));
  }, [doctorProfile?.slug]);

  // La regla base recalcula fecha y hora de las filas NO tocadas a mano (en su orden). También cuando
  // CAMBIA el número de filas («Nuevo tratamiento»: las que nacen toman la regla).
  const cada = Number(base.cada);
  const cadaValido = Number.isInteger(cada) && cada >= 1 && cada <= 365;
  const cuantas = filas.length;
  useEffect(() => {
    if (!fechaUsable(base.fecha) || !cadaValido) return;
    setFilas((prev) => prev.map((f, i) => (f.tocada ? f : { ...f, fecha: sumarDias(base.fecha, i * cada), hora: base.hora })));
  }, [base.fecha, base.hora, cada, cadaValido, cuantas]);

  // Las filas sin servicio toman el primero (y su precio) — al cargar los servicios y al nacer filas
  // nuevas. Una fila «después» puede quedarse sin servicio a propósito: no se le pone.
  useEffect(() => {
    if (!servicios?.length) return;
    setFilas((prev) => prev.map((f) => {
      if (f.servicioId || f.despues) return f;
      const s = servicios[0];
      return { ...f, servicioId: s.id, servicioNombre: s.serviceName, precio: f.precio || (s.price != null ? String(s.price) : '') };
    }));
  }, [servicios, cuantas]);

  // Un servicio guardado que ya no está en la lista (se borró: liga sin FK) NO cuenta como elegido.
  const servicioExiste = (f: Fila) => !!f.servicioId && !!servicios?.some((s) => s.id === f.servicioId);

  // Disponibilidad de las filas a agendar: se pide ~0.5 s después del último cambio.
  const clave = useMemo(
    () => JSON.stringify(filas.filter(lista).map((f) => [f.key, f.fecha, f.hora, f.servicioId])),
    [filas],
  );
  const vuelta = useRef(0);
  useEffect(() => {
    const aRevisar = filas.filter((f) => lista(f) && servicioExiste(f) && fechaUsable(f.fecha) && /^\d{2}:\d{2}$/.test(f.hora));
    // Subir la vuelta TAMBIÉN al vaciar: si no, una respuesta en vuelo volvería a llenar `disp`.
    const mia = ++vuelta.current;
    if (!aRevisar.length) { setDisp({}); return; }
    setDisp(Object.fromEntries(aRevisar.map((f) => [f.key, { estado: 'revisando' } as Disp])));
    const t = setTimeout(async () => {
      try {
        const res = await authFetch(`${API_URL}/api/appointments/disponibilidad`, {
          method: 'POST',
          body: JSON.stringify({ items: aRevisar.map((f) => ({ date: f.fecha, startTime: f.hora, serviceId: f.servicioId })) }),
        });
        const d = await res.json().catch(() => null);
        if (mia !== vuelta.current) return;
        if (!res.ok || !Array.isArray(d?.data)) throw new Error();
        setDisp(Object.fromEntries(aRevisar.map((f, i) => {
          const r = d.data[i];
          if (r?.ok) return [f.key, { estado: 'ok' }];
          const texto = r?.motivo === 'cita' ? `se traslapa con una cita (${r.desde}–${r.hasta})`
            : r?.motivo === 'bloqueo' ? `horario bloqueado (${r.desde}–${r.hasta})`
            : r?.motivo === 'entre_filas' ? `choca con otra sesión de esta lista (${r.desde}–${r.hasta})`
            : 'fecha u hora no válida';
          return [f.key, { estado: 'choque', texto }];
        })));
      } catch {
        if (mia === vuelta.current) setDisp(Object.fromEntries(aRevisar.map((f) => [f.key, { estado: 'error' } as Disp])));
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, servicios]);

  const aAgendar = filas.filter(lista);
  const faltaContacto = aAgendar.length === 0 ? [] : [
    requeridos.email && !correo.trim() ? 'correo' : null,
    requeridos.phone && !telefono.trim() ? 'teléfono' : null,
    requeridos.whatsapp && !whatsapp.trim() ? 'WhatsApp' : null,
  ].filter(Boolean) as string[];
  // Listo: toda fila a agendar con servicio (existente), fecha y hora; precios válidos; contacto
  // completo. La disponibilidad es un AVISO (la ruta de crear vuelve a revisar): bloquea un 🔴
  // CONFIRMADO o una revisión EN CURSO; si la revisión falló (red, o sin permiso de `citas`), se dice
  // en la fila y se deja confirmar — el servidor decide al crear.
  const filasListas = filas.every((f) => precioValido(f.precio))
    && aAgendar.every((f) => servicioExiste(f) && fechaUsable(f.fecha) && f.hora
      && disp[f.key]?.estado !== 'choque' && disp[f.key]?.estado !== 'revisando');
  const listo = !!servicios && (aAgendar.length === 0 || !!paciente) && filasListas && faltaContacto.length === 0;

  const editar = (key: string, cambio: Partial<Fila>) =>
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambio } : f)));

  return {
    filas, setFilas, editar, base, setBase, cadaValido, servicios, consultorios, consultorioId, setConsultorioId,
    modalidad, setModalidad, paciente, correo, setCorreo, telefono, setTelefono, whatsapp, setWhatsapp,
    requeridos, faltaContacto, errorCarga, disp, aAgendar, listo, conFlujo, doctorId: doctorProfile?.id,
  };
}
export type AgendaDeSesiones = ReturnType<typeof useAgendaDeSesiones>;

/**
 * Crea las citas de las filas a agendar (sus sesiones ya existen: `sesionId`), una por una por la ruta
 * de la agenda, y manda el aviso. Devuelve el resultado de cada fila — nunca «listo» si algo faltó.
 */
export async function agendarFilas(
  a: AgendaDeSesiones, patientId: string, filas: (Fila & { sesionId: string })[],
  onAvance: (hechas: Resultado[]) => void,
): Promise<{ resultados: Resultado[]; aviso: string | null }> {
  const out: Resultado[] = [];
  if (!a.paciente || !a.doctorId) {
    return { resultados: filas.map((f) => ({ key: f.key, numero: f.numero, fecha: f.fecha, hora: f.hora, ok: false, error: 'No se pudo identificar al paciente o tu cuenta. Recarga la página.' })), aviso: null };
  }
  for (const f of filas) {
    try {
      const res = await authFetch(`${API_URL}/api/appointments/range-bookings/instant`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: a.doctorId,
          date: f.fecha,
          startTime: f.hora,
          serviceId: f.servicioId,
          patientName: `${a.paciente.firstName} ${a.paciente.lastName}`.trim(),
          patientFirstName: a.paciente.firstName,
          patientLastName: a.paciente.lastName,
          patientEmail: a.correo.trim(),
          patientPhone: a.telefono.trim(),
          ...(a.whatsapp.trim() ? { patientWhatsapp: a.whatsapp.trim() } : {}),
          isFirstTime: false,
          appointmentMode: a.modalidad,
          patientId,
          // Sólo si el doctor lo ELIGIÓ: si no, el servidor lo hereda del rango de cada día.
          ...(a.consultorioId ? { locationId: a.consultorioId } : {}),
          paraSesion: f.sesionId,
          avisoEnResumen: a.modalidad === 'PRESENCIAL',
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success || !d?.data?.id) {
        out.push({ key: f.key, numero: f.numero, fecha: f.fecha, hora: f.hora, ok: false, error: d?.error || `Error ${res.status}` });
      } else {
        out.push({ key: f.key, numero: f.numero, fecha: f.fecha, hora: f.hora, ok: true, ligada: d.sesionLigada?.ligada === true, bookingId: d.data.id });
      }
    } catch {
      out.push({ key: f.key, numero: f.numero, fecha: f.fecha, hora: f.hora, ok: false, error: 'Error de conexión' });
    }
    onAvance([...out]);
  }

  // UN correo resumen (presencial). Telemedicina ya mandó uno por cita (con su liga de Meet).
  const creadas = out.flatMap((r) => (r.ok ? [r.bookingId] : []));
  let aviso: string | null = null;
  if (a.modalidad === 'PRESENCIAL' && creadas.length > 0) {
    try {
      const res = await authFetch(`${API_URL}/api/appointments/bookings/resumen-tratamiento`, {
        method: 'POST', body: JSON.stringify({ bookingIds: creadas }),
      });
      const d = await res.json().catch(() => null);
      aviso = d?.enviado ? (creadas.length === 1 ? 'Se le mandó al paciente un correo con su cita.' : `Se le mandó al paciente UN correo con las ${creadas.length} citas.`)
        : d?.motivo === 'sin_correo' ? 'El paciente no tiene correo: no se le avisó. Avísale tú de sus citas.'
        : d?.motivo === 'sin_google' ? 'Tu cuenta de Google no está conectada (Mi Cuenta → Integraciones): no se le avisó al paciente.'
        : 'No se pudo mandar el correo con las citas: avísale tú al paciente.';
    } catch {
      aviso = 'No se pudo mandar el correo con las citas: avísale tú al paciente.';
    }
  } else if (a.modalidad === 'TELEMEDICINA' && creadas.length > 0) {
    aviso = 'En telemedicina cada cita manda su propio correo con su liga de Meet, si el paciente tiene correo y tu cuenta de Google está conectada.';
  }
  return { resultados: out, aviso };
}

const inputClass = 'w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** La regla base + las filas + modalidad, consultorio y contacto. */
export function FormularioDeFilas({ a, planeadas }: { a: AgendaDeSesiones; planeadas: number | null }) {
  const servicioPor = new Map((a.servicios ?? []).map((s) => [s.id, s]));
  return (
    <div className="space-y-4">
      {a.errorCarga && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No se pudieron cargar tus servicios o los datos del paciente. Recarga la página.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Primera</label>
          <input type="date" value={a.base.fecha} onChange={(e) => a.setBase({ ...a.base, fecha: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
          <input type="time" value={a.base.hora} onChange={(e) => a.setBase({ ...a.base, hora: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cada (días)</label>
          <input type="number" min={1} max={365} value={a.base.cada} onChange={(e) => a.setBase({ ...a.base, cada: e.target.value })} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Llena la fecha y la hora de las sesiones; cada una se puede cambiar abajo (las que cambies a mano ya no se recalculan).
      </p>

      <div className="space-y-2">
        {a.filas.map((f) => {
          const d = a.disp[f.key];
          return (
            <div key={f.key} className={`border rounded-lg p-2 space-y-2 ${f.despues ? 'bg-gray-50 border-dashed border-gray-200' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">{etiquetaSesion(f.numero, planeadas)}</span>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  <input type="checkbox" checked={f.despues} onChange={(e) => a.editar(f.key, { despues: e.target.checked })} />
                  Agendar después
                </label>
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={f.servicioId}
                  onChange={(e) => {
                    const s = servicioPor.get(e.target.value);
                    // El precio sigue al servicio elegido: uno SIN precio vacía el campo (si no, se
                    // quedaba el del servicio anterior y se guardaba como precio de la sesión).
                    a.editar(f.key, {
                      servicioId: e.target.value,
                      servicioNombre: s?.serviceName ?? '',
                      precio: s && s.price != null ? String(s.price) : '',
                    });
                  }}
                  disabled={!a.servicios}
                  className={`${inputClass} flex-1 min-w-[10rem]`}
                >
                  {!a.servicios && <option value="">Cargando…</option>}
                  {/* Un select sin la opción vacía ENSEÑA el primer servicio aunque el valor sea '':
                      la fila parecería lista sin estarlo. */}
                  {a.servicios && (f.despues || !f.servicioId) && (
                    <option value="">{f.despues ? 'Sin servicio todavía' : 'Elegir servicio…'}</option>
                  )}
                  {/* Su servicio guardado ya no existe: se enseña tal cual (sin opción, el select
                      mostraría el primero aunque el valor sea otro). */}
                  {a.servicios && f.servicioId && !servicioPor.has(f.servicioId) && (
                    <option value={f.servicioId}>{f.servicioNombre || 'Servicio'} (ya no existe)</option>
                  )}
                  {(a.servicios ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.serviceName} ({s.durationMinutes} min){s.price != null ? ` · ${pesos(s.price)}` : ''}</option>
                  ))}
                </select>
                {a.conFlujo && (
                  <input
                    value={f.precio} onChange={(e) => a.editar(f.key, { precio: e.target.value })}
                    inputMode="decimal" placeholder="Precio"
                    className={`${inputClass} w-24 ${precioValido(f.precio) ? '' : 'border-red-400'}`}
                  />
                )}
              </div>
              {!f.despues && (
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="date" value={f.fecha} onChange={(e) => a.editar(f.key, { fecha: e.target.value, tocada: true })} className={`${inputClass} w-40`} />
                  <input type="time" value={f.hora} onChange={(e) => a.editar(f.key, { hora: e.target.value, tocada: true })} className={`${inputClass} w-28`} />
                  <span className="text-xs">
                    {d?.estado === 'revisando' && <span className="text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />revisando…</span>}
                    {d?.estado === 'ok' && <span className="text-green-700 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />libre</span>}
                    {d?.estado === 'choque' && <span className="text-red-700 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{d.texto}</span>}
                    {d?.estado === 'error' && <span className="text-amber-700">no se pudo revisar: se revisa al crear la cita</span>}
                    {!f.despues && f.servicioId && !servicioPor.has(f.servicioId) && a.servicios && (
                      <span className="text-amber-700">su servicio ya no existe: elige otro</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {a.aAgendar.length > 0 && (
        <>
          {a.consultorios && a.consultorios.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Consultorio</label>
              <select value={a.consultorioId} onChange={(e) => a.setConsultorioId(e.target.value)} className={inputClass}>
                <option value="">Según el horario de cada día (como en la agenda)</option>
                {a.consultorios.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo{a.requeridos.email ? ' *' : ''}</label>
              <input type="email" value={a.correo} onChange={(e) => a.setCorreo(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono{a.requeridos.phone ? ' *' : ''}</label>
              <input value={a.telefono} onChange={(e) => a.setTelefono(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp{a.requeridos.whatsapp ? ' *' : ''}</label>
              <input value={a.whatsapp} onChange={(e) => a.setWhatsapp(e.target.value)} className={inputClass} />
            </div>
          </div>
          {a.faltaContacto.length > 0 && (
            <p className="text-xs text-amber-800">Falta {a.faltaContacto.join(', ')} (lo pide tu configuración de «Campos de cita»).</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Modalidad</label>
            <select value={a.modalidad} onChange={(e) => a.setModalidad(e.target.value as 'PRESENCIAL' | 'TELEMEDICINA')} className={inputClass}>
              <option value="PRESENCIAL">Presencial</option>
              <option value="TELEMEDICINA">Telemedicina</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">
            {a.modalidad === 'PRESENCIAL'
              ? 'Al paciente se le manda UN correo con todas (si tiene correo y tu cuenta de Google está conectada).'
              : 'En telemedicina cada cita manda su propio correo con su liga de Meet.'}
            {' '}Si alguna no se puede al crearla (alguien agendó a esa hora en medio), las demás sí se agendan y ésa se queda «Por agendar».
          </p>
        </>
      )}
    </div>
  );
}

/** Los resultados de agendar, fila por fila. */
export function ResultadosDeFilas({ resultados, total, planeadas, corriendo, aviso }: {
  resultados: Resultado[]; total: number; planeadas: number | null; corriendo: boolean; aviso: string | null;
}) {
  return (
    <div className="space-y-2">
      {corriendo && (
        <p className="text-sm text-gray-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />Agendando {Math.min(resultados.length + 1, total)} de {total}…
        </p>
      )}
      {resultados.map((r) => (
        <div key={r.key} className="flex items-start gap-2 text-sm">
          {r.ok ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
          <span>
            <strong>{etiquetaSesion(r.numero, planeadas)}</strong> — {formatoFechaVisita(r.fecha)} {r.hora}
            {r.ok
              ? r.ligada ? ' · agendada' : ' · cita creada, pero NO se ligó a la sesión: lígala desde el tratamiento'
              : ` · no se agendó: ${r.error}. Se queda «Por agendar».`}
          </span>
        </div>
      ))}
      {aviso && <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{aviso}</p>}
    </div>
  );
}
