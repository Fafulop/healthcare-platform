'use client';

import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { etiquetaSesion, tratamientoHref } from '@/lib/tratamientos-ui';

/** Lo que manda `GET /api/appointments/bookings` (apps/api) en cada cita: su sesión, si tiene. */
export interface SesionEnCita {
  numero: number;
  cancelada: boolean;
  patientId: string;
  tratamiento: { id: string; nombre: string; sesionesPlaneadas: number | null };
}

/**
 * TRATAMIENTOS T4 — «Sesión 3 de 6 — Fisioterapia» en la agenda: el doctor sabe ANTES de cancelar o
 * reagendar que la cita es de un tratamiento. Sólo si la sesión es del MISMO paciente que la cita
 * (una re-ligada a otro, G1, no se pinta). Clic → el tratamiento (sin abrir la cita: la tarjeta
 * entera es clicable).
 */
export function SesionDeLaCita({ patientId, sesion }: { patientId?: string | null; sesion?: SesionEnCita | null }) {
  if (!sesion || !patientId || sesion.patientId !== patientId) return null;
  return (
    <Link
      href={tratamientoHref(patientId, sesion.tratamiento.id)}
      onClick={(e) => e.stopPropagation()}
      className="text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
    >
      <ListChecks className="w-3 h-3 shrink-0" />
      {etiquetaSesion(sesion.numero, sesion.tratamiento.sesionesPlaneadas)} — {sesion.tratamiento.nombre}
      {sesion.cancelada && ' (cancelada)'}
    </Link>
  );
}
