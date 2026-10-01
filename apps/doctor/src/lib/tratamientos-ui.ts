/**
 * TRATAMIENTOS T3 — lo común de la UI de tratamientos (cliente). La API vive en
 * `lib/tratamientos.ts` (servidor). Plan: docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §4.
 */
import type { CitaDeVisita } from '@/lib/visitas-ui';

/**
 * La UI de tratamientos: ABIERTA PARA TODOS los doctores desde el lanzamiento (2026-10-01). Hasta
 * entonces se veía sólo en dr-prueba (como las visitas antes del 2026-09-29). El manual, la guía y
 * `llm-assistant/capabilities.ts` cambiaron en el MISMO commit, y la exportación de cuenta (G6) ya
 * estaba en prod.
 *
 * Queda como función para que el lanzamiento cambiara poco código. OJO: revertir NO es sólo esta
 * línea — el manual y la guía ya describen tratamientos: se revierte el commit de lanzamiento
 * completo. No es un candado de seguridad: la API revisa sus propios permisos.
 */
export function tratamientosUiActiva(doctorId: string | null | undefined): boolean {
  return !!doctorId;
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

/**
 * Reagendar = cancelar la vieja + crear la nueva (agenda y asistente). Si la vieja era la sesión de
 * un tratamiento, la sesión se pasa a la nueva (`POST /api/appointments/reagendar-sesion`, que sólo
 * lo hace en el caso limpio). Se llama DESPUÉS de que el reagendado salió bien y nunca lo deshace.
 * Devuelve el texto para el doctor, o null si la cita no era de ningún tratamiento. Un error NO
 * afirma que la cita era de un tratamiento: dice que no se pudo revisar.
 */
export async function pasarSesionACitaReagendada(
  deBookingId: string, aBookingId: string,
): Promise<{ ok: boolean; texto: string } | null> {
  const NO_SE_PUDO = { ok: false, texto: 'No se pudo revisar si la cita era la sesión de un tratamiento: revisa los tratamientos del paciente.' };
  try {
    const res = await fetch('/api/appointments/reagendar-sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deBookingId, aBookingId }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d?.success) {
      // 409 de la regla de ligar: el servidor SÍ encontró la sesión y dice por qué no se movió.
      return res.status === 409 && d?.error
        ? { ok: false, texto: `La cita era la sesión de un tratamiento y no se pasó a la nueva (${d.error}): lígala desde el tratamiento.` }
        : NO_SE_PUDO;
    }
    if (!d.sesion) return null;
    const cual = `La ${etiquetaSesion(d.sesion.numero, d.sesion.sesionesPlaneadas).toLowerCase()}${d.sesion.nombre ? ` de «${d.sesion.nombre}»` : ''}`;
    if (d.movida) return { ok: true, texto: `${cual} pasó a la nueva cita.` };
    const porque: Record<string, string> = {
      sesion_con_visita: 'ya tiene su visita',
      sesion_cancelada: 'está cancelada',
      cita_no_cancelada: 'la cita anterior no quedó cancelada',
      no_es_reagendado: 'la cita nueva no quedó como reagendada',
    };
    return { ok: false, texto: `${cual} no se pasó a la nueva cita (${porque[d.motivo] ?? 'no se pudo'}): revísala en el tratamiento.` };
  } catch {
    return NO_SE_PUDO;
  }
}
