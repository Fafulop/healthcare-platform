'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, redirect } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import { authFetch } from '@/lib/auth-fetch';
import type { BookingPermisos } from '@/lib/booking-permisos';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import { getClinicDateString } from '@/lib/dates';
import { etiquetaSesion, type Ocupadas, type SesionDeTratamiento, type TratamientoDetalle } from '@/lib/tratamientos-ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type Estado = 'cargando' | 'error' | 'no-existe' | 'ok';

async function json(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `Error ${res.status}`), { status: res.status, data });
  return data;
}

/**
 * TRATAMIENTOS T3 — todo lo de la pantalla de UN tratamiento: el detalle (sesiones con su estado
 * DERIVADO por el servidor), y lo de alrededor para los selectores: las citas del paciente (con
 * sus permisos), sus visitas y lo que ya es de otra sesión (`ocupadas`). `null` = no cargó: la
 * pantalla esconde esa acción en vez de afirmar que no hay nada.
 */
export function useTratamientoDetalle() {
  const params = useParams<{ id: string; tratamientoId: string }>();
  const router = useRouter();
  const patientId = params.id;
  const tratamientoId = params.tratamientoId;
  const base = `/api/medical-records/patients/${patientId}`;
  const urlT = `${base}/tratamientos/${tratamientoId}`;

  const { data: session, status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() { redirect('/login'); },
  });

  const [estado, setEstado] = useState<Estado>('cargando');
  const [tratamiento, setTratamiento] = useState<TratamientoDetalle | null>(null);
  const [patientName, setPatientName] = useState('');
  const [bookings, setBookings] = useState<PatientBooking[] | null>(null);
  const [permisos, setPermisos] = useState<BookingPermisos | null>(null);
  const [visitas, setVisitas] = useState<VisitaResumen[] | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // Viene con el detalle (no con la lista de tratamientos: eso traía TODAS las sesiones).
  const [ocupadas, setOcupadas] = useState<Ocupadas | null>(null);

  const cargarDetalle = useCallback(async () => {
    try {
      const res = await fetch(urlT);
      if (res.status === 404) { setEstado('no-existe'); return; }
      const d = await json(res);
      setTratamiento(d.data);
      setOcupadas(d.ocupadas ?? null);
      setEstado('ok');
    } catch {
      setEstado('error');
    }
  }, [urlT]);

  const cargarAlrededor = useCallback(async () => {
    const [rb, rv] = await Promise.allSettled([
      fetch(`${base}/bookings`).then(json),
      fetch(`${base}/visitas`).then(json),
    ]);
    if (rb.status === 'fulfilled' && Array.isArray(rb.value?.data) && rb.value?.permisos) {
      setBookings(rb.value.data); setPermisos(rb.value.permisos);
    } else { setBookings(null); setPermisos(null); }
    setVisitas(rv.status === 'fulfilled' && Array.isArray(rv.value?.data) ? rv.value.data : null);
  }, [base]);

  useEffect(() => { cargarDetalle(); cargarAlrededor(); }, [cargarDetalle, cargarAlrededor]);

  useEffect(() => {
    fetch(base).then(json)
      .then((d) => { const p = d?.data; if (p?.firstName) setPatientName(`${p.firstName} ${p.lastName || ''}`.trim()); })
      .catch(() => {});
  }, [base]);

  /**
   * Corre una escritura, avisa y recarga el detalle (y, si tocó citas o visitas, eso también).
   * Recarga AUNQUE falle: un 409 («ya se ligó a otra sesión») o un paso que sí ocurrió antes del
   * error (la cita de G8 ya cancelada) dejan la pantalla vieja y ofreciendo lo que ya no se puede.
   */
  const escribir = useCallback(async (fn: () => Promise<unknown>, ok: string, alrededor = false) => {
    setTrabajando(true);
    let exito = false;
    try {
      await fn();
      toast.success(ok);
      exito = true;
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar');
    }
    await Promise.all([cargarDetalle(), alrededor || !exito ? cargarAlrededor() : null]);
    setTrabajando(false);
    return exito;
  }, [cargarDetalle, cargarAlrededor]);

  const enviar = (url: string, method: string, body?: Record<string, unknown>) =>
    fetch(url, {
      method,
      ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    }).then(json);

  const patchTratamiento = (body: Record<string, unknown>, ok: string) =>
    escribir(() => enviar(urlT, 'PATCH', body), ok);

  const patchSesion = (s: SesionDeTratamiento, body: Record<string, unknown>, ok: string) =>
    escribir(() => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', body), ok);

  /**
   * V4 — «Abrir visita» de una sesión que aún no tiene: con su cita (activa o concluida) la visita
   * nace de ESA cita (fecha = la de la cita; el servidor la guarda en la sesión, G3); sin cita que
   * cuente, nace HOY ligada a la sesión (`paraSesion`). Luego se navega a ella.
   */
  const abrirVisita = async (s: SesionDeTratamiento) => {
    // Una cita que no puedes ver (sin `status`) podría estar activa: no se adivina (el servidor daría 409).
    if (s.cita && !s.cita.status) { toast.error('Esta sesión tiene una cita que no puedes ver: ábrela desde la agenda'); return; }
    const citaVigente = s.cita && s.cita.status !== 'CANCELLED' && s.cita.status !== 'NO_SHOW';
    setTrabajando(true);
    try {
      const d = await enviar(`${base}/visitas`, 'POST', citaVigente
        ? { bookingId: s.cita!.id }
        : { fecha: getClinicDateString(), paraSesion: s.id });
      router.push(visitaHref(patientId, d.data.id));
    } catch (err: any) {
      toast.error(err.message || 'No se pudo abrir la visita');
      await Promise.all([cargarDetalle(), cargarAlrededor()]);
      setTrabajando(false);
    }
  };

  const borrarTratamiento = async () => {
    const ok = await practiceConfirm('Se borrará el tratamiento con sus sesiones. Las citas y visitas no se tocan.', '¿Borrar el tratamiento?');
    if (!ok) return;
    setTrabajando(true);
    try {
      await enviar(urlT, 'DELETE');
      toast.success('Tratamiento borrado');
      router.push(`/dashboard/medical-records/patients/${patientId}`);
    } catch (err: any) {
      // 409: tiene sesiones con cita o visita. Lo que procede es CANCELARLO (decisión 2026-10-01);
      // el botón «Cancelar tratamiento» se ofrece en cualquier estado que no sea «cancelado».
      // T6: también 409 si tiene pagos en Flujo de Dinero — el porqué lo dice el servidor.
      toast.error(err.status === 409
        ? `No se borra: ${err.data?.conteo?.conDinero ? 'tiene pagos registrados en Flujo de Dinero' : 'tiene sesiones con cita o visita'}. Usa «Cancelar tratamiento».`
        : err.message || 'No se pudo borrar el tratamiento');
      setTrabajando(false);
    }
  };

  const borrarSesion = async (s: SesionDeTratamiento) => {
    const ok = await practiceConfirm(`La ${etiquetaSesion(s.numero, null).toLowerCase()} se borrará. Su número no se reutiliza.`, '¿Borrar la sesión?');
    if (!ok) return;
    await escribir(() => enviar(`${urlT}/sesiones/${s.id}`, 'DELETE'), 'Sesión borrada');
  };

  /**
   * G8 — cancelar una sesión. Con `tambienCita`, PRIMERO la cita por la MISMA ruta de la agenda (con
   * sus efectos: aviso al paciente y Google Calendar, cuando aplican); si eso falla se detiene y la
   * sesión NO se cancela. La pregunta la hace la pantalla (`CancelarSesionModal`): tres salidas.
   */
  const cancelarSesion = async (s: SesionDeTratamiento, tambienCita: boolean) => {
    if (tambienCita && s.cita) {
      setTrabajando(true);
      try {
        const res = await authFetch(`${API_URL}/api/appointments/bookings/${s.cita.id}`, {
          method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.error);
      } catch {
        toast.error('No se pudo cancelar la cita. La sesión no se canceló; intenta de nuevo o cancela la cita desde la agenda.');
        await Promise.all([cargarDetalle(), cargarAlrededor()]);
        setTrabajando(false);
        return false;
      }
      setTrabajando(false);
      return escribir(
        // La cita YA se canceló (y pudo avisarse al paciente): si ahora falla la sesión, se dice.
        () => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', { cancelada: true }).catch((err) => {
          throw new Error(`La cita SÍ se canceló, pero la sesión no (${err.message}). Vuelve a cancelar la sesión.`);
        }),
        'Sesión y cita canceladas', true,
      );
    }
    return escribir(() => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', { cancelada: true }), 'Sesión cancelada');
  };

  const ligarCita = (s: SesionDeTratamiento, bookingId: string) =>
    escribir(() => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', { bookingId }), 'Cita ligada', true);

  const ligarVisita = (s: SesionDeTratamiento, visitaId: string | null) =>
    escribir(
      () => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', { visitaId }),
      visitaId ? 'Visita ligada' : 'Visita desligada', true,
    );

  return {
    patientId, tratamientoId, doctorId: session?.user?.doctorId ?? null, sessionStatus,
    estado, tratamiento, patientName, bookings, permisos, visitas, ocupadas, trabajando,
    patchTratamiento, patchSesion, abrirVisita, borrarTratamiento, borrarSesion, cancelarSesion,
    ligarCita, ligarVisita,
    /** Re-lee el tratamiento y lo de alrededor (T5: después de «Agendar sesiones»). */
    recargar: () => Promise.all([cargarDetalle(), cargarAlrededor()]),
  };
}
