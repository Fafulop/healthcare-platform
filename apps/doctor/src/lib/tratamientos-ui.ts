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
  /** Cada cuántos días van las sesiones. Lo usa (y lo guarda) «Agendar sesiones» (T5). */
  intervaloDias?: number | null;
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
  /** V4 paso 2 — su visita es la de su cita: viaja con ella al reagendar o agendar de nuevo (servidor). */
  visitaViaja?: boolean;
  /** Sin permiso de `citas` sólo llega `{ id }`. */
  cita: CitaDeVisita | null;
  /** TRATAMIENTOS v2 · V1 — su servicio (siempre viaja). */
  servicioId: string | null;
  servicioNombre: string | null;
  /** Su precio (sólo con `flujo`): el suyo, o el de su cita (sesiones de antes de V1); null = sin precio. */
  precio?: number | null;
  fuente?: 'sesion' | 'cita' | null;
}

/** V1 — la CUENTA de un tratamiento sin paquete = la suma de sus sesiones. Sólo con `flujo`. */
export interface CuentaDelTratamiento {
  total: number;
  pagado: number;
  pendiente: number;
  cobradoDeMas: number;
  /** Lo que cobraron sesiones CANCELADAS: entró, pero no cuenta como pago de las demás. */
  cobradoEnCanceladas: number;
  /** Sesiones (no canceladas) sin precio: no entran al total — se dice. */
  sinPrecio: number;
  /** Por sesión: su IMPORTE (lo cobrado si ya se cobró — fuente `cobro` —, si no su precio planeado) y lo que de eso ya entró. */
  sesiones: { id: string; importe: number | null; fuente: 'sesion' | 'cita' | 'cobro' | null; pagado: number; folio: string | null }[];
  /** Ventas de las visitas de las sesiones: renglón APARTE (decisión 5). */
  ventas: {
    cuantas: number; total: number; pagado: number;
    /** V5 — cada venta (para el «Resumen de tratamiento»), por fecha. */
    detalle: { folio: string; fecha: string; total: number; pagado: number }[];
  };
}

export interface TratamientoDetalle extends TratamientoResumen {
  sesiones: SesionDeTratamiento[];
  /** V1/V2 — con `flujo`: la cuenta (suma de sesiones). Ausente = sin permiso de `flujo`. */
  cuenta?: CuentaDelTratamiento;
}

/** «$12,500» — pesos sin centavos si son cero. */
export const pesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });

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
 * TRATAMIENTOS T4 — lo que contestan las rutas que crean la cita nueva de un reagendado
 * (`sesionReagendada`, apps/api → `pasarSesionAlReagendar`). Ausente = la cita vieja no era de
 * ningún tratamiento (o no era un reagendado).
 */
export type RespuestaSesionReagendada =
  | { error: true }
  | { movida: false; motivo: 'sin_sesion' }
  | {
      movida: boolean;
      motivo?: 'sesion_cancelada' | 'sesion_con_visita' | 'cita_no_activa' | 'cita_nueva_invalida' | 'cambio';
      sesion: { tratamientoId: string; nombre: string; numero: number; sesionesPlaneadas: number | null };
    };

/**
 * El texto para el doctor (toast de la agenda y resumen del asistente), o null si no hay nada que
 * decir. Un error NO afirma que la cita era de un tratamiento: dice que no se pudo revisar.
 */
export function textoDeSesionReagendada(r: RespuestaSesionReagendada | undefined | null): { ok: boolean; texto: string } | null {
  if (!r) return null;
  if ('error' in r) {
    return { ok: false, texto: 'No se pudo revisar si la cita era la sesión de un tratamiento: revisa los tratamientos del paciente.' };
  }
  if (!('sesion' in r)) return null;
  const cual = `La ${etiquetaSesion(r.sesion.numero, r.sesion.sesionesPlaneadas).toLowerCase()} de «${r.sesion.nombre}»`;
  if (r.movida) return { ok: true, texto: `${cual} pasó a la nueva cita.` };
  const porque: Record<string, string> = {
    sesion_con_visita: 'su visita no es la de esta cita',
    sesion_cancelada: 'está cancelada',
    cita_no_activa: 'su cita ya no está pendiente ni confirmada',
    cita_nueva_invalida: 'la cita nueva no es válida para la sesión',
    cambio: 'la sesión cambió mientras tanto',
  };
  return { ok: false, texto: `${cual} no se pasó a la nueva cita (${porque[r.motivo ?? ''] ?? 'no se pudo'}): revísala en el tratamiento.` };
}
