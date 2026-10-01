/**
 * TRATAMIENTOS T3 — lo común de la UI de tratamientos (cliente). La API vive en
 * `lib/tratamientos.ts` (servidor). Plan: docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §4.
 */
import type { CitaDeVisita } from '@/lib/visitas-ui';

/**
 * 🚧 La UI de tratamientos se ve SÓLO para estos doctores hasta el lanzamiento (como las visitas
 * antes del 2026-09-29). Al lanzar: un commit que abre esta función a todos JUNTO con el manual,
 * la guía y el widget (decidido 2026-10-01: mientras sólo dr-prueba lo vea, el manual no lo
 * describe — el widget le hablaría a los demás de algo que no tienen), y con la exportación de
 * cuenta (G6) ya en prod.
 *
 * No es un candado de seguridad: la API está viva para todos y revisa sus propios permisos.
 */
const TRATAMIENTOS_UI_DOCTORES = new Set<string>([
  'cmni1bov90000mk0lyeztr3ad', // dr-prueba
]);

export function tratamientosUiActiva(doctorId: string | null | undefined): boolean {
  return !!doctorId && TRATAMIENTOS_UI_DOCTORES.has(doctorId);
}

export type EstadoTratamiento = 'activo' | 'terminado' | 'cancelado';
export type EstadoSesion = 'cancelada' | 'hecha' | 'agendada' | 'por_agendar';

export interface ConteoSesiones {
  total: number; hechas: number; agendadas: number; porAgendar: number; canceladas: number;
}

/** `GET …/tratamientos` (sin `precioPaquete` hasta T6; sin `intervaloDias` en pantalla hasta T5). */
export interface TratamientoResumen {
  id: string;
  nombre: string;
  estado: EstadoTratamiento;
  sesionesPlaneadas: number | null;
  plantillaSugeridaId: string | null;
  notas: string | null;
  createdAt: string;
  conteo?: ConteoSesiones;
}

/** Citas y visitas que ya son de alguna sesión del paciente. */
export interface Ocupadas { citas: string[]; visitas: string[] }

/** Una sesión como la manda la API: el estado ya viene DERIVADO por el servidor (P1). */
export interface SesionDeTratamiento {
  id: string;
  numero: number;
  cancelada: boolean;
  notas: string | null;
  estado: EstadoSesion;
  motivo?: 'sin_cita' | 'cita_cancelada' | 'cita_no_asistio' | 'cita_de_otro_paciente' | 'cita_sin_expediente';
  aviso?: 'visita_no_abierta';
  visita: { id: string; fecha?: string } | null;
  /** Sin permiso de `citas` sólo llega `{ id }`. */
  cita: CitaDeVisita | null;
}

export interface TratamientoDetalle extends TratamientoResumen {
  sesiones: SesionDeTratamiento[];
}

/** `GET …/visitas/[id]` → `sesion`: la visita es la sesión N de un tratamiento. */
export interface SesionDeLaVisita {
  tratamientoId: string; nombre: string; numero: number; sesionesPlaneadas: number | null; cancelada: boolean;
}

export const ESTADO_TRATAMIENTO: Record<EstadoTratamiento, { texto: string; clase: string }> = {
  activo: { texto: 'Activo', clase: 'bg-blue-100 text-blue-700' },
  terminado: { texto: 'Terminado', clase: 'bg-green-100 text-green-700' },
  cancelado: { texto: 'Cancelado', clase: 'bg-gray-100 text-gray-600' },
};

export const ESTADO_SESION: Record<EstadoSesion, { texto: string; clase: string }> = {
  hecha: { texto: 'Hecha', clase: 'bg-green-100 text-green-700' },
  agendada: { texto: 'Agendada', clase: 'bg-blue-100 text-blue-700' },
  por_agendar: { texto: 'Por agendar', clase: 'bg-amber-100 text-amber-800' },
  cancelada: { texto: 'Cancelada', clase: 'bg-gray-100 text-gray-600' },
};

/** El porqué de «Por agendar» / el aviso de «Hecha», en palabras del doctor. */
export function detalleDeSesion(s: SesionDeTratamiento): string | null {
  if (s.aviso === 'visita_no_abierta') return 'La cita se completó pero su visita no se abrió.';
  switch (s.motivo) {
    case 'cita_cancelada': return 'Su cita se canceló.';
    case 'cita_no_asistio': return 'El paciente no asistió a su cita.';
    case 'cita_de_otro_paciente': return 'Su cita pasó al expediente de otro paciente.';
    case 'cita_sin_expediente': return 'Su cita se desligó del expediente.';
    default: return null;
  }
}

/** «3 de 6 hechas · 1 agendada» — el plan manda el total si existe; si no, las creadas. */
export function describirAvance(t: Pick<TratamientoResumen, 'sesionesPlaneadas' | 'conteo'>): string {
  const c = t.conteo;
  if (!c) return '';
  const total = t.sesionesPlaneadas ?? c.total;
  const partes = [`${c.hechas} de ${total} ${total === 1 ? 'hecha' : 'hechas'}`];
  if (c.agendadas > 0) partes.push(`${c.agendadas} ${c.agendadas === 1 ? 'agendada' : 'agendadas'}`);
  if (c.canceladas > 0) partes.push(`${c.canceladas} ${c.canceladas === 1 ? 'cancelada' : 'canceladas'}`);
  return partes.join(' · ');
}

/** «Sesión 3 de 6» (o «Sesión 3» si el tratamiento es abierto). */
export const etiquetaSesion = (numero: number, planeadas: number | null) =>
  planeadas ? `Sesión ${numero} de ${planeadas}` : `Sesión ${numero}`;

export const tratamientoHref = (patientId: string, tratamientoId: string) =>
  `/dashboard/medical-records/patients/${patientId}/tratamientos/${tratamientoId}`;
