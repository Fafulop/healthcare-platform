'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { getClinicDateString, getClinicMinutesOfDay } from '@/lib/dates';
import { useDoctorProfile } from '@/contexts/DoctorProfileContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ServicioDeCita { id: string; serviceName: string; price: number | null }

/** «HH:MM» de AHORA en hora de la clínica. */
export function horaDeAhora() {
  const m = getClinicMinutesOfDay();
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export type ResultadoCitaEnConsulta =
  | { ok: true; bookingId: string; sesionLigada: boolean }
  | { ok: false; error: string };

/**
 * VISITAS 07-PLAN P3b / 08-PLAN F1 — la CITA de HOY de una visita que se abre con el paciente enfrente
 * («También en la agenda»): sus servicios, el nombre del paciente y la creación por `range-bookings/
 * instant` con `enConsulta` (sin exigir correo/teléfono/WhatsApp y sin avisarle; ver la ruta). La usan
 * «Abrir visita hoy» del tratamiento (con `paraSesion`) y «Nueva Visita» (sin sesión). `activo` =
 * cargar servicios y paciente (sólo si se va a ofrecer la casilla).
 */
export function useCitaEnConsulta(patientId: string, activo: boolean) {
  const { doctorProfile } = useDoctorProfile();
  const [servicios, setServicios] = useState<ServicioDeCita[] | null | 'error'>(null);
  const [paciente, setPaciente] = useState<{ firstName: string; lastName: string } | null>(null);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    authFetch('/api/doctor/services').then((r) => r.json())
      .then((d) => { if (vigente) setServicios(d?.success ? d.data as ServicioDeCita[] : 'error'); })
      .catch(() => { if (vigente) setServicios('error'); });
    fetch(`/api/medical-records/patients/${patientId}`).then((r) => r.json())
      .then((d) => { const p = d?.data; if (vigente && p?.firstName) setPaciente({ firstName: p.firstName, lastName: p.lastName ?? '' }); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [activo, patientId]);

  /** ¿Se puede crear con este servicio y esta hora? (El servicio guardado puede ya no existir.) */
  const listoPara = (servicioId: string, hora: string) =>
    Array.isArray(servicios) && servicios.some((x) => x.id === servicioId)
    && /^\d{2}:\d{2}$/.test(hora) && !!paciente && !!doctorProfile?.id;

  const crear = async (args: { servicioId: string; hora: string; paraSesion?: string }): Promise<ResultadoCitaEnConsulta> => {
    if (!paciente || !doctorProfile?.id) return { ok: false, error: 'Todavía se está cargando el paciente. Intenta de nuevo.' };
    try {
      const res = await authFetch(`${API_URL}/api/appointments/range-bookings/instant`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctorProfile.id,
          date: getClinicDateString(),
          startTime: args.hora,
          serviceId: args.servicioId,
          patientName: `${paciente.firstName} ${paciente.lastName}`.trim(),
          patientFirstName: paciente.firstName,
          patientLastName: paciente.lastName,
          isFirstTime: false,
          appointmentMode: 'PRESENCIAL',
          patientId,
          ...(args.paraSesion ? { paraSesion: args.paraSesion } : {}),
          enConsulta: true,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success || !d?.data?.id) {
        // Traslape, horario bloqueado…: lo dice la ruta.
        return { ok: false, error: d?.error || `No se pudo crear la cita (${res.status})` };
      }
      return { ok: true, bookingId: d.data.id, sesionLigada: d.sesionLigada?.ligada === true };
    } catch {
      return { ok: false, error: 'No se pudo crear la cita. Revisa tu conexión e intenta de nuevo.' };
    }
  };

  return { servicios, paciente, listoPara, crear };
}
