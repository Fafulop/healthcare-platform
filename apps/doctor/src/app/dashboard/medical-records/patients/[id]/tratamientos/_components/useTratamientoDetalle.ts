'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, redirect } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import type { BookingPermisos } from '@/lib/booking-permisos';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref, type VisitaResumen } from '@/lib/visitas-ui';
import { cancelarCitaSinPreguntar } from '@/lib/citas/acciones-cita';
import { citaVivaDeSesion, etiquetaSesion, type SesionDeTratamiento, type TratamientoDetalle } from '@/lib/tratamientos-ui';


type Estado = 'cargando' | 'error' | 'no-existe' | 'ok';

async function json(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `Error ${res.status}`), { status: res.status, data });
  return data;
}

/**
 * TRATAMIENTOS T3 — todo lo de la pantalla de UN tratamiento: el detalle (sesiones con su estado
 * DERIVADO por el servidor), y lo de alrededor: las citas del paciente (con sus permisos, notas y
 * cobro) y sus visitas (lo que tiene cada una). `null` = no cargó: la pantalla esconde eso en vez de
 * afirmar que no hay nada. (Sin selectores de «Ligar…» desde 07-PLAN P1.)
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

  const cargarDetalle = useCallback(async () => {
    try {
      const res = await fetch(urlT);
      if (res.status === 404) { setEstado('no-existe'); return; }
      const d = await json(res);
      setTratamiento(d.data);
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
   * V4 — «Abrir visita» de una sesión que aún no tiene, CON su cita vigente (activa o concluida): la
   * visita nace de ESA cita (fecha = la de la cita; el servidor la guarda en la sesión, G3). Luego se
   * navega a ella. (Sin cita que cuente ya no se abre aquí: «Abrir visita hoy» crea su cita, 09 L3.)
   */
  const abrirVisita = async (s: SesionDeTratamiento) => {
    // Una cita que no puedes ver (sin `status`) podría estar activa: no se adivina (el servidor daría 409).
    if (s.cita && !s.cita.status) { toast.error('Esta sesión tiene una cita que no puedes ver: ábrela desde la agenda'); return; }
    const citaVigente = s.cita && s.cita.status !== 'CANCELLED' && s.cita.status !== 'NO_SHOW';
    if (!citaVigente) { toast.error('Toda visita lleva su cita: usa «Abrir visita hoy» o agenda la sesión'); return; }
    setTrabajando(true);
    try {
      const d = await enviar(`${base}/visitas`, 'POST', { bookingId: s.cita!.id });
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
   * Cancelar una sesión cancela SU cita (decisión del usuario 2026-10-12: una acción, un resultado — antes
   * había tres salidas y la de «sólo la sesión» dejaba una sesión cancelada con su cita viva). PRIMERO la
   * cita, por la misma ruta de la agenda (aviso al paciente, Google Calendar, link); si falla se detiene y
   * la sesión NO se cancela. Quien llama ya preguntó y ya comprobó que la cita se puede cancelar.
   */
  const cancelarSesion = async (s: SesionDeTratamiento) => {
    if (citaVivaDeSesion(s)) {
      setTrabajando(true);
      const r = await cancelarCitaSinPreguntar(s.cita!.id);
      if (!r.ok) {
        toast.error(`No se pudo cancelar su cita (${r.error}). La sesión no se canceló; intenta de nuevo.`);
        await Promise.all([cargarDetalle(), cargarAlrededor()]);
        setTrabajando(false);
        return false;
      }
      // Sin soltar `trabajando` aquí: `escribir` lo vuelve a poner y en medio quedaba un render con los
      // botones vivos entre cancelar la cita y cancelar la sesión.
      return escribir(
        // La cita YA se canceló (y pudo avisarse al paciente): si ahora falla la sesión, se dice.
        () => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', { cancelada: true }).catch((err) => {
          throw new Error(`La cita SÍ se canceló, pero la sesión no (${err.message}). Vuelve a cancelar la sesión.`);
        }),
        'Sesión y su cita canceladas', true,
      );
    }
    return escribir(() => enviar(`${urlT}/sesiones/${s.id}`, 'PATCH', { cancelada: true }), 'Sesión cancelada');
  };

  /**
   * Cancelar el tratamiento cancela las citas vivas de sus sesiones (misma regla, un nivel arriba;
   * antes se quedaban en la agenda con sólo un aviso). Una por una por la ruta de la agenda; el
   * tratamiento se marca cancelado SÓLO si todas se cancelaron — si una falla se dice cuál y no queda
   * a medias sin explicación. Quien llama ya preguntó y comprobó el permiso.
   */
  const cancelarTratamiento = async () => {
    const vivas = (tratamiento?.sesiones ?? []).filter(citaVivaDeSesion);
    if (vivas.length > 0) {
      setTrabajando(true);
      // Una por una (no en paralelo): cada una avisa al paciente y va a Google Calendar, y así el
      // reporte de cuáles fallaron sale en orden.
      const fallidas: string[] = [];
      for (const s of vivas) {
        const r = await cancelarCitaSinPreguntar(s.cita!.id);
        if (!r.ok) fallidas.push(`${s.cita?.fecha ? formatoFechaVisita(s.cita.fecha) : `sesión ${s.numero}`} (${r.error})`);
      }
      if (fallidas.length > 0) {
        // Sólo lo que de verdad pasó: «las demás sí» era falso si fallaron todas.
        const hechas = vivas.length - fallidas.length;
        toast.error(`No se pudieron cancelar ${fallidas.length === 1 ? 'esta cita' : 'estas citas'}: ${fallidas.join(' · ')}. `
          + (hechas > 0 ? `${hechas === 1 ? 'La otra sí se canceló' : `Las otras ${hechas} sí se cancelaron`} (con su aviso al paciente). ` : '')
          + 'El tratamiento NO se canceló. Intenta de nuevo.');
        await Promise.all([cargarDetalle(), cargarAlrededor()]);
        setTrabajando(false);
        return false;
      }
    }
    return escribir(
      // Si las citas YA se cancelaron (con su aviso) y ahora falla el tratamiento, se dice — si no, sólo
      // saldría «No se pudo guardar» con el tratamiento activo y sus sesiones de pronto por agendar.
      () => enviar(urlT, 'PATCH', { estado: 'cancelado' }).catch((err) => {
        if (vivas.length === 0) throw err;
        throw new Error(`Sus citas SÍ se cancelaron (con su aviso al paciente), pero el tratamiento no (${err.message}). Vuelve a cancelar el tratamiento.`);
      }),
      vivas.length > 0 ? `Tratamiento cancelado, con ${vivas.length === 1 ? 'su cita' : `sus ${vivas.length} citas`}` : 'Tratamiento cancelado',
      vivas.length > 0,
    );
  };

  return {
    patientId, tratamientoId, doctorId: session?.user?.doctorId ?? null, sessionStatus,
    estado, tratamiento, patientName, bookings, permisos, visitas, trabajando,
    patchTratamiento, patchSesion, abrirVisita, borrarTratamiento, borrarSesion, cancelarSesion, cancelarTratamiento,
    /** Re-lee el tratamiento y lo de alrededor (T5: después de «Agendar sesiones»). */
    recargar: () => Promise.all([cargarDetalle(), cargarAlrededor()]),
  };
}
