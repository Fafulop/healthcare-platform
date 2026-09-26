'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import type { BookingPermisos } from '@/lib/booking-permisos';
import type { PatientBooking } from '@/components/medical-records/CitaBadges';
import type { CitaDeVisita } from '@/lib/visitas-ui';
import { useVisitasDelPaciente } from '@/components/medical-records/visitas/useVisitasDelPaciente';

// La forma de `GET …/visitas/[visitaId]` (apps/doctor/src/app/api/…/visitas/[visitaId]/route.ts).
export interface ConsultaDeVisita {
  id: string; encounterDate: string; encounterType: string; chiefComplaint: string | null;
  status: string; templateId: string | null;
}
export interface FotoDeVisita {
  id: string; mediaType: string; fileName: string; fileUrl: string; thumbnailUrl: string | null;
  mimeType: string | null; category: string | null; captureDate: string | null; description: string | null;
  encounterId: string | null;
}
export interface RecetaDeVisita {
  id: string; prescriptionDate: string; status: string; diagnosis: string | null; encounterId: string | null;
}
export interface NotaDeVisita { id: string; content: string; createdAt: string; updatedAt: string }
export interface InformeDeVisita {
  id: string; formId: string; status: string; encounterId: string; createdAt: string; issuedAt: string | null;
}
export interface VisitaDetalle {
  id: string; fecha: string; comentario: string | null; origen: string; bookingId: string | null;
  cita: CitaDeVisita | null;
  consultas: ConsultaDeVisita[]; fotos: FotoDeVisita[]; recetas: RecetaDeVisita[];
  notas: NotaDeVisita[]; informes: InformeDeVisita[];
}

type Estado = 'cargando' | 'error' | 'no-existe' | 'ok';

async function json(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

export function useVisitaDetalle() {
  const params = useParams<{ id: string; visitaId: string }>();
  const router = useRouter();
  const patientId = params.id;
  const visitaId = params.visitaId;
  const base = `/api/medical-records/patients/${patientId}`;

  const { data: session, status: sessionStatus } = useSession({
    required: true,
    onUnauthenticated() { redirect('/login'); },
  });

  const [estado, setEstado] = useState<Estado>('cargando');
  const [visita, setVisita] = useState<VisitaDetalle | null>(null);
  const [patientName, setPatientName] = useState('');
  // Lo de alrededor: otras visitas (destinos de «Mover») y consultas sueltas (para «Traer») salen
  // del MISMO hook que la página del paciente (una sola definición de «suelta»); las citas dan el
  // veredicto de cobro/factura y las que se pueden ligar. `null` = no cargó: la UI esconde esa
  // acción en vez de afirmar que no hay nada.
  const lista = useVisitasDelPaciente(patientId, true);
  const otrasVisitas = lista.estado === 'ok' ? lista.visitas.filter((o) => o.id !== visitaId) : null;
  const sueltas: ConsultaDeVisita[] | null = lista.estado === 'ok'
    ? lista.sueltas.map((e) => ({
        id: e.id, encounterDate: e.encounterDate, encounterType: e.encounterType,
        chiefComplaint: e.chiefComplaint ?? null, status: e.status, templateId: e.templateId ?? null,
      }))
    : null;
  const [bookings, setBookings] = useState<PatientBooking[] | null>(null);
  const [permisos, setPermisos] = useState<BookingPermisos | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargarDetalle = useCallback(async () => {
    try {
      const res = await fetch(`${base}/visitas/${visitaId}`);
      if (res.status === 404) { setEstado('no-existe'); return; }
      const d = await json(res);
      setVisita(d.data);
      setEstado('ok');
    } catch {
      setEstado('error');
    }
  }, [base, visitaId]);

  const cargarCitas = useCallback(async () => {
    try {
      const d = await fetch(`${base}/bookings`).then(json);
      if (!Array.isArray(d.data) || !d.permisos) throw new Error();
      setBookings(d.data); setPermisos(d.permisos);
    } catch {
      setBookings(null); setPermisos(null);
    }
  }, [base]);

  useEffect(() => { cargarDetalle(); cargarCitas(); }, [cargarDetalle, cargarCitas]);

  useEffect(() => {
    fetch(base).then(json)
      .then((d) => { const p = d?.data; if (p?.firstName) setPatientName(`${p.firstName} ${p.lastName || ''}`.trim()); })
      .catch(() => {});
  }, [base]);

  /**
   * Corre una escritura, avisa y recarga SÓLO lo que la escritura pudo cambiar: comentario y fecha
   * tocan la visita; ligar, mover y traer tocan además la lista de visitas y las sueltas. Las
   * citas (la ruta más pesada) no cambian con nada de esta pantalla.
   */
  const escribir = useCallback(async (fn: () => Promise<unknown>, ok: string, tambienLista: boolean) => {
    setTrabajando(true);
    try {
      await fn();
      toast.success(ok);
      await Promise.all([cargarDetalle(), tambienLista ? lista.recargar() : null]);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'No se pudo guardar');
      return false;
    } finally {
      setTrabajando(false);
    }
  }, [cargarDetalle, lista.recargar]);

  const patchVisita = (body: Record<string, unknown>) =>
    fetch(`${base}/visitas/${visitaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(json);

  const guardarComentario = (comentario: string) =>
    escribir(() => patchVisita({ comentario: comentario.trim() || null }), 'Comentario guardado', false);

  const guardarFecha = (fecha: string) => escribir(() => patchVisita({ fecha }), 'Fecha actualizada', false);

  const ligarCita = (bookingId: string | null) =>
    escribir(() => patchVisita({ bookingId }), bookingId ? 'Cita ligada' : 'Cita desligada', true);

  /**
   * Mueve SÓLO la visita de una consulta: el PUT lleva únicamente `visitaId` (la ruta lo detecta y
   * no corre la edición completa, que borraba `followUpDate`). Sus fotos, recetas e informes se van
   * con ella en la misma transacción (D3, `moverConsultaDeVisita`).
   */
  const moverConsulta = async (encounterId: string, destino: string | null, destinoTexto: string) => {
    const ok = await practiceConfirm(
      `Se moverá a ${destinoTexto}, junto con las fotos, recetas e informes que cuelgan de ella.`,
      '¿Mover la consulta?',
    );
    if (!ok) return false;
    return escribir(
      () => fetch(`${base}/encounters/${encounterId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitaId: destino }),
      }).then(json),
      'Consulta movida',
      true,
    );
  };

  const traerConsulta = (encounterId: string) =>
    escribir(
      () => fetch(`${base}/encounters/${encounterId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitaId }),
      }).then(json),
      'Consulta agregada a la visita',
      true,
    );

  const borrar = async () => {
    const ok = await practiceConfirm('La visita está vacía. Se borrará sin afectar nada más.', '¿Borrar la visita?');
    if (!ok) return;
    setTrabajando(true);
    try {
      await fetch(`${base}/visitas/${visitaId}`, { method: 'DELETE' }).then(json);
      toast.success('Visita borrada');
      router.push(`/dashboard/medical-records/patients/${patientId}`);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo borrar la visita');
      setTrabajando(false);
    }
  };

  return {
    patientId, visitaId, doctorId: session?.user?.doctorId ?? null, sessionStatus,
    estado, visita, patientName, otrasVisitas, sueltas, bookings, permisos, trabajando,
    guardarComentario, guardarFecha, ligarCita, moverConsulta, traerConsulta, borrar,
  };
}
