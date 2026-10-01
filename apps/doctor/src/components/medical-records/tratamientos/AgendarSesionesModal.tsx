'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, X, XCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useDoctorProfile } from '@/contexts/DoctorProfileContext';
import { getClinicDateString } from '@/lib/dates';
import { formatoFechaVisita } from '@/lib/visitas-ui';
import { etiquetaSesion, type TratamientoDetalle } from '@/lib/tratamientos-ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Servicio { id: string; serviceName: string; durationMinutes: number }
interface Consultorio { id: string; name: string }
interface Paciente { firstName: string; lastName: string; email: string | null; phone: string | null }

type Resultado =
  | { sesionId: string; numero: number; fecha: string; ok: true; bookingId: string; ligada: boolean }
  | { sesionId: string; numero: number; fecha: string; ok: false; error: string };

/** 'YYYY-MM-DD' + n días (aritmética en UTC: sin saltos por horario de verano). */
function sumarDias(fecha: string, n: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * TRATAMIENTOS T5 — «Agendar sesiones»: las sesiones «Por agendar» elegidas, una cada N días.
 * Reglas del DISEÑO §4 (no se negocian):
 *   1. cada cita por la MISMA ruta que la agenda (`range-bookings/instant`, con sus revisiones de
 *      disponibilidad y choques) — no un camino nuevo; y ligada a SU sesión en esa misma petición
 *      (`paraSesion`);
 *   2. falla parcial = se crea lo que cabe: cada sesión es independiente y la pantalla dice cuál no
 *      se creó y por qué (nunca «listo» si algo faltó);
 *   3. UN aviso al paciente, no N: presencial → cada cita sin correo (`avisoEnResumen`) y un correo
 *      resumen al final. Telemedicina → cada cita manda el suyo (lleva su liga de Meet).
 */
export function AgendarSesionesModal({ patientId, tratamiento, onClose, onListo }: {
  patientId: string;
  tratamiento: TratamientoDetalle;
  onClose: () => void;
  /** Recarga el tratamiento (se llama al cerrar si algo se creó). */
  onListo: () => void;
}) {
  const { doctorProfile } = useDoctorProfile();
  const porAgendar = useMemo(
    () => tratamiento.sesiones.filter((s) => s.estado === 'por_agendar' && !s.cancelada && !s.visita),
    [tratamiento.sesiones],
  );
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(porAgendar.map((s) => s.id)));
  const [fecha, setFecha] = useState(getClinicDateString());
  const [hora, setHora] = useState('10:00');
  const [cadaDias, setCadaDias] = useState(String(tratamiento.intervaloDias ?? 7));
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [servicioId, setServicioId] = useState('');
  const [consultorios, setConsultorios] = useState<Consultorio[] | null>(null);
  // '' = como en la agenda: el consultorio sale del rango del día (no se manda `locationId`).
  const [consultorioId, setConsultorioId] = useState('');
  const [modalidad, setModalidad] = useState<'PRESENCIAL' | 'TELEMEDICINA'>('PRESENCIAL');
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  // Contacto de la CITA (como en la agenda): se precarga del expediente y el doctor lo completa.
  // Qué es obligatorio lo dicen SUS ajustes de «Campos de cita» (alta instantánea).
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [requeridos, setRequeridos] = useState({ email: true, phone: true, whatsapp: true });
  const [enviando, setEnviando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [corriendo, setCorriendo] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/doctor/services').then((r) => r.json())
      .then((d) => { const l = d?.success ? d.data as Servicio[] : []; setServicios(l); if (l[0]) setServicioId(l[0].id); })
      .catch(() => { setServicios([]); setErrorCarga(true); });
    fetch(`/api/medical-records/patients/${patientId}`).then((r) => r.json())
      .then((d) => {
        const p = d?.data;
        if (!p?.firstName) { setErrorCarga(true); return; }
        setPaciente({ firstName: p.firstName, lastName: p.lastName ?? '', email: p.email ?? null, phone: p.phone ?? null });
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
      .then((d) => { setConsultorios(d?.success && Array.isArray(d.data) ? d.data as Consultorio[] : []); })
      .catch(() => setConsultorios([]));
  }, [doctorProfile?.slug]);

  const n = Number(cadaDias);
  const cadaValido = Number.isInteger(n) && n >= 1 && n <= 365;
  const lista = porAgendar.filter((s) => elegidas.has(s.id));
  const plan = lista.map((s, i) => ({ sesion: s, fecha: cadaValido ? sumarDias(fecha, i * n) : fecha }));
  const faltaContacto = [
    requeridos.email && !correo.trim() ? 'correo' : null,
    requeridos.phone && !telefono.trim() ? 'teléfono' : null,
    requeridos.whatsapp && !whatsapp.trim() ? 'WhatsApp' : null,
  ].filter(Boolean) as string[];
  const listo = !!servicios && !!paciente && !!servicioId && lista.length > 0 && cadaValido && !!fecha && !!hora
    && faltaContacto.length === 0 && !enviando;

  const agendar = async () => {
    if (!listo || !paciente) return;
    const doctorId = doctorProfile?.id;
    if (!doctorId) { setAviso('No se pudo identificar tu cuenta. Recarga la página.'); return; }
    // Un solo recorrido: el doble clic ya no lanza dos (y la pantalla pasa de inmediato a resultados).
    setEnviando(true);
    setResultados([]);
    const out: Resultado[] = [];
    for (let i = 0; i < plan.length; i++) {
      const { sesion, fecha: dia } = plan[i];
      setCorriendo(i + 1);
      try {
        const res = await authFetch(`${API_URL}/api/appointments/range-bookings/instant`, {
          method: 'POST',
          body: JSON.stringify({
            doctorId,
            date: dia,
            startTime: hora,
            serviceId: servicioId,
            patientName: `${paciente.firstName} ${paciente.lastName}`.trim(),
            patientFirstName: paciente.firstName,
            patientLastName: paciente.lastName,
            patientEmail: correo.trim(),
            patientPhone: telefono.trim(),
            ...(whatsapp.trim() ? { patientWhatsapp: whatsapp.trim() } : {}),
            isFirstTime: false,
            appointmentMode: modalidad,
            patientId,
            // Sólo si el doctor lo ELIGIÓ: si no, como en la agenda, el servidor lo hereda del rango
            // de cada día (mandar uno por default pisaba el del rango y mandaba al paciente a otra sede).
            ...(consultorioId ? { locationId: consultorioId } : {}),
            paraSesion: sesion.id,
            avisoEnResumen: modalidad === 'PRESENCIAL',
          }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.success || !d?.data?.id) {
          out.push({ sesionId: sesion.id, numero: sesion.numero, fecha: dia, ok: false, error: d?.error || `Error ${res.status}` });
        } else {
          out.push({
            sesionId: sesion.id, numero: sesion.numero, fecha: dia, ok: true, bookingId: d.data.id,
            ligada: d.sesionLigada?.ligada === true,
          });
        }
      } catch {
        out.push({ sesionId: sesion.id, numero: sesion.numero, fecha: dia, ok: false, error: 'Error de conexión' });
      }
      setResultados([...out]);
    }
    setCorriendo(null);

    // Guardar el intervalo usado (si cambió): la próxima vez viene precargado.
    if (n !== tratamiento.intervaloDias) {
      fetch(`/api/medical-records/patients/${patientId}/tratamientos/${tratamiento.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervaloDias: n }),
      }).catch(() => {});
    }

    // UN correo resumen (presencial). Telemedicina ya mandó uno por cita (con su liga de Meet).
    const creadas = out.filter((r): r is Extract<Resultado, { ok: true }> => r.ok).map((r) => r.bookingId);
    if (modalidad === 'PRESENCIAL' && creadas.length > 0) {
      try {
        const res = await authFetch(`${API_URL}/api/appointments/bookings/resumen-tratamiento`, {
          method: 'POST', body: JSON.stringify({ bookingIds: creadas }),
        });
        const d = await res.json().catch(() => null);
        setAviso(
          d?.enviado ? (creadas.length === 1 ? 'Se le mandó al paciente un correo con su cita.' : `Se le mandó al paciente UN correo con las ${creadas.length} citas.`)
          : d?.motivo === 'sin_correo' ? 'El paciente no tiene correo: no se le avisó. Avísale tú de sus citas.'
          : d?.motivo === 'sin_google' ? 'Tu cuenta de Google no está conectada (Mi Cuenta → Integraciones): no se le avisó al paciente.'
          : 'No se pudo mandar el correo con las citas: avísale tú al paciente.',
        );
      } catch {
        setAviso('No se pudo mandar el correo con las citas: avísale tú al paciente.');
      }
    } else if (modalidad === 'TELEMEDICINA' && creadas.length > 0) {
      setAviso('En telemedicina cada cita manda su propio correo con su liga de Meet, si el paciente tiene correo y tu cuenta de Google está conectada.');
    }
    setEnviando(false);
  };

  const ocupado = corriendo !== null || enviando;
  const cerrar = () => { if (ocupado) return; if (resultados?.some((r) => r.ok)) onListo(); onClose(); };
  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const planeadas = tratamiento.sesionesPlaneadas;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Agendar sesiones</h2>
          <button onClick={cerrar} disabled={ocupado} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {resultados ? (
            <div className="space-y-2">
              {corriendo !== null && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />Agendando {corriendo} de {plan.length}…
                </p>
              )}
              {resultados.map((r) => (
                <div key={r.sesionId} className="flex items-start gap-2 text-sm">
                  {r.ok ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                  <span>
                    <strong>{etiquetaSesion(r.numero, planeadas)}</strong> — {formatoFechaVisita(r.fecha)} {hora}
                    {r.ok
                      ? r.ligada ? ' · agendada' : ' · cita creada, pero NO se ligó a la sesión: lígala desde el tratamiento'
                      : ` · no se agendó: ${r.error}. Se queda «Por agendar».`}
                  </span>
                </div>
              ))}
              {aviso && <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{aviso}</p>}
            </div>
          ) : porAgendar.length === 0 ? (
            <p className="text-sm text-gray-500">No hay sesiones «Por agendar». Agrega una sesión o desliga la cita de alguna.</p>
          ) : (
            <>
              {errorCarga && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No se pudieron cargar tus servicios o los datos del paciente. Recarga la página.
                </p>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Sesiones</p>
                <div className="space-y-1">
                  {porAgendar.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={elegidas.has(s.id)}
                        onChange={(e) => setElegidas((prev) => {
                          const n2 = new Set(prev);
                          if (e.target.checked) n2.add(s.id); else n2.delete(s.id);
                          return n2;
                        })}
                      />
                      {etiquetaSesion(s.numero, planeadas)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primera</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cada (días)</label>
                  <input type="number" min={1} max={365} value={cadaDias} onChange={(e) => setCadaDias(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
                <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} disabled={!servicios} className={inputClass}>
                  {!servicios && <option value="">Cargando…</option>}
                  {(servicios ?? []).map((s) => <option key={s.id} value={s.id}>{s.serviceName} ({s.durationMinutes} min)</option>)}
                </select>
              </div>
              {consultorios && consultorios.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Consultorio</label>
                  <select value={consultorioId} onChange={(e) => setConsultorioId(e.target.value)} className={inputClass}>
                    <option value="">Según el horario de cada día (como en la agenda)</option>
                    {consultorios.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo{requeridos.email ? ' *' : ''}</label>
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono{requeridos.phone ? ' *' : ''}</label>
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp{requeridos.whatsapp ? ' *' : ''}</label>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} />
                </div>
              </div>
              {faltaContacto.length > 0 && (
                <p className="text-xs text-amber-800">Falta {faltaContacto.join(', ')} (lo pide tu configuración de «Campos de cita»).</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                <select value={modalidad} onChange={(e) => setModalidad(e.target.value as 'PRESENCIAL' | 'TELEMEDICINA')} className={inputClass}>
                  <option value="PRESENCIAL">Presencial</option>
                  <option value="TELEMEDICINA">Telemedicina</option>
                </select>
              </div>
              {lista.length > 0 && cadaValido && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm space-y-0.5">
                  {plan.map(({ sesion, fecha: dia }) => (
                    <p key={sesion.id}>{etiquetaSesion(sesion.numero, planeadas)} → {formatoFechaVisita(dia)} {hora}</p>
                  ))}
                  <p className="text-xs text-gray-500 pt-1">
                    {modalidad === 'PRESENCIAL'
                      ? 'Al paciente se le manda UN correo con todas (si tiene correo y tu cuenta de Google está conectada).'
                      : 'En telemedicina cada cita manda su propio correo con su liga de Meet (si el paciente tiene correo y tu cuenta de Google está conectada).'}
                    {' '}Si alguna no se puede (ya hay una cita a esa hora), las demás sí se agendan y ésa se queda «Por agendar».
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {resultados ? (
            <button onClick={cerrar} disabled={ocupado} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {ocupado ? 'Agendando…' : 'Cerrar'}
            </button>
          ) : (
            <>
              <button onClick={cerrar} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={agendar}
                disabled={!listo}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                Agendar {lista.length} {lista.length === 1 ? 'cita' : 'citas'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
