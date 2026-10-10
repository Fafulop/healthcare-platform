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
  /** `visitaId`: 08-PLAN F2 — la visita que la cita trajo al nacer (ausente con la API de antes). */
  | { ok: true; bookingId: string; sesionLigada: boolean; visitaId?: string }
  | { ok: false; error: string };

export interface Contacto { correo: string; telefono: string; whatsapp: string }

/**
 * VISITAS 07-PLAN P3b / 08-PLAN F1 — la CITA de una visita que se abre desde el expediente o el
 * tratamiento: sus servicios, los datos del paciente y la creación por `range-bookings/instant`.
 *   · HOY (sin `fecha`, o `fecha` = hoy) → `enConsulta`: el paciente está enfrente — sin exigir
 *     correo/teléfono/WhatsApp y sin avisarle (ver la ruta). «Abrir visita hoy» y «Nueva Visita» hoy.
 *   · Otro día (08-PLAN, «Nueva Visita» con fecha futura) → una cita NORMAL: con el contacto del
 *     paciente (el que el doctor exija, como en la agenda) y su correo de confirmación.
 * `activo` = cargar servicios, paciente y lo que el doctor exige (sólo si se va a ofrecer).
 */
export function useCitaEnConsulta(patientId: string, activo: boolean) {
  const { doctorProfile } = useDoctorProfile();
  const [servicios, setServicios] = useState<ServicioDeCita[] | null | 'error'>(null);
  const [paciente, setPaciente] = useState<{ firstName: string; lastName: string } | null>(null);
  // El contacto del expediente (precarga del formulario de una cita futura) y lo que el doctor exige.
  const [contactoInicial, setContactoInicial] = useState<Contacto>({ correo: '', telefono: '', whatsapp: '' });
  const [requeridos, setRequeridos] = useState({ email: true, phone: true, whatsapp: true });

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    authFetch('/api/doctor/services').then((r) => r.json())
      .then((d) => { if (vigente) setServicios(d?.success ? d.data as ServicioDeCita[] : 'error'); })
      .catch(() => { if (vigente) setServicios('error'); });
    fetch(`/api/medical-records/patients/${patientId}`).then((r) => r.json())
      .then((d) => {
        const p = d?.data;
        if (!vigente || !p?.firstName) return;
        setPaciente({ firstName: p.firstName, lastName: p.lastName ?? '' });
        setContactoInicial({ correo: p.email ?? '', telefono: p.phone ?? '', whatsapp: p.phone ?? '' });
      })
      .catch(() => {});
    authFetch('/api/doctor/booking-field-settings').then((r) => r.json())
      .then((d) => {
        const raw = d?.data;
        if (vigente && d?.success && raw) {
          setRequeridos({
            email: raw.bookingInstantEmailRequired ?? true,
            phone: raw.bookingInstantPhoneRequired ?? true,
            whatsapp: raw.bookingInstantWhatsappRequired ?? true,
          });
        }
      })
      .catch(() => {});
    return () => { vigente = false; };
  }, [activo, patientId]);

  /** ¿Se puede crear con este servicio y esta hora? (El servicio guardado puede ya no existir.) */
  const listoPara = (servicioId: string, hora: string) =>
    Array.isArray(servicios) && servicios.some((x) => x.id === servicioId)
    && /^\d{2}:\d{2}$/.test(hora) && !!paciente && !!doctorProfile?.id;

  /** Para una cita de otro día: lo que falta del contacto que el doctor exige ('' = nada). */
  const faltaContacto = (c: Contacto) => [
    requeridos.email && !c.correo.trim() ? 'correo' : null,
    requeridos.phone && !c.telefono.trim() ? 'teléfono' : null,
    requeridos.whatsapp && !c.whatsapp.trim() ? 'WhatsApp' : null,
  ].filter(Boolean).join(', ');

  const crear = async (args: {
    servicioId: string; hora: string; paraSesion?: string;
    /** 'YYYY-MM-DD'. Ausente u hoy → `enConsulta`. Otro día → cita normal con `contacto`. */
    fecha?: string; contacto?: Contacto;
  }): Promise<ResultadoCitaEnConsulta> => {
    if (!paciente || !doctorProfile?.id) return { ok: false, error: 'Todavía se está cargando el paciente. Intenta de nuevo.' };
    const hoy = getClinicDateString();
    const fecha = args.fecha ?? hoy;
    const enConsulta = fecha === hoy;
    try {
      const res = await authFetch(`${API_URL}/api/appointments/range-bookings/instant`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctorProfile.id,
          date: fecha,
          startTime: args.hora,
          serviceId: args.servicioId,
          patientName: `${paciente.firstName} ${paciente.lastName}`.trim(),
          patientFirstName: paciente.firstName,
          patientLastName: paciente.lastName,
          isFirstTime: false,
          appointmentMode: 'PRESENCIAL',
          patientId,
          ...(args.paraSesion ? { paraSesion: args.paraSesion } : {}),
          ...(enConsulta
            ? { enConsulta: true }
            : {
                patientEmail: args.contacto?.correo.trim() ?? '',
                patientPhone: args.contacto?.telefono.trim() ?? '',
                ...(args.contacto?.whatsapp.trim() ? { patientWhatsapp: args.contacto.whatsapp.trim() } : {}),
              }),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.success || !d?.data?.id) {
        // Traslape, horario bloqueado, falta contacto…: lo dice la ruta.
        return { ok: false, error: d?.error || `No se pudo crear la cita (${res.status})` };
      }
      return {
        ok: true, bookingId: d.data.id, sesionLigada: d.sesionLigada?.ligada === true,
        ...(typeof d.visitaId === 'string' ? { visitaId: d.visitaId } : {}),
      };
    } catch {
      return { ok: false, error: 'No se pudo crear la cita. Revisa tu conexión e intenta de nuevo.' };
    }
  };

  return { servicios, paciente, contactoInicial, requeridos, listoPara, faltaContacto, crear };
}
