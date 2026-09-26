/**
 * VISITAS D4 — lo común de la UI de visitas (cliente). La API vive en `lib/visitas.ts` (servidor).
 * Plan: docs/DESDE JUNIO/VISITAS/02-PLAN-fase-1.md §5 · handoff: SESSION-REFRESCO.md.
 */
import { formatLocalDate } from '@/lib/dates';

/**
 * 🚧 La UI de visitas se ve SÓLO para estos doctores hasta el lanzamiento (decidido 2026-09-26).
 * El orden importa: el backfill corre UNA vez ANTES de que los doctores puedan crear o mover
 * visitas (si no, desharía sus «Sin visita» sin auditoría). Al lanzar: barrido + backfill, y un
 * commit que BORRA esta lista junto con el manual, la guía y `llm-assistant/capabilities.ts`.
 *
 * No es un candado de seguridad: la API ya está viva para todos y revisa sus propios permisos.
 */
const VISITAS_UI_DOCTORES = new Set<string>([
  'cmni1bov90000mk0lyeztr3ad', // dr-prueba
]);

export function visitasUiActiva(doctorId: string | null | undefined): boolean {
  return !!doctorId && VISITAS_UI_DOCTORES.has(doctorId);
}

export type ConteoHijos = { consultas: number; fotos: number; recetas: number; notas: number; informes: number };

/** El bloque de la cita tal como lo manda la API: sin `citas` sólo llega `id`; sin `flujo`, sin `cobro`. */
export interface CitaDeVisita {
  id: string;
  status?: string;
  fecha?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  servicio?: string | null;
  /** Ausente = sin permiso de `flujo`; null = la cita no tiene cobro. */
  cobro?: { monto: number; pagado: number; estado: string | null; formaDePago: string | null } | null;
}

export interface VisitaResumen {
  id: string;
  /** 'YYYY-MM-DD' — con cita, el día de la cita (lo resuelve el servidor). */
  fecha: string;
  comentario: string | null;
  origen: 'manual' | 'cita' | string;
  conteo?: ConteoHijos;
  cita: CitaDeVisita | null;
  createdAt: string;
}

export const totalHijos = (c?: ConteoHijos) =>
  c ? c.consultas + c.fotos + c.recetas + c.notas + c.informes : 0;

/**
 * 'YYYY-MM-DD' → «12 sep 2026». Delega en `formatLocalDate` (lee la fecha como LOCAL: `new Date('2026-09-12')`
 * se lee en UTC y en México pinta el día anterior). Sólo fija el formato corto por default.
 */
export function formatoFechaVisita(fecha: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return formatLocalDate(fecha.slice(0, 10), opts);
}

/** «2 plantillas · 3 fotos · 1 receta» — sólo lo que hay. Vacío → ''. */
export function describirConteo(c?: ConteoHijos): string {
  if (!c) return '';
  const partes: string[] = [];
  const add = (n: number, uno: string, varios: string) => { if (n > 0) partes.push(`${n} ${n === 1 ? uno : varios}`); };
  add(c.consultas, 'plantilla', 'plantillas');
  add(c.fotos, 'foto/documento', 'fotos/documentos');
  add(c.recetas, 'receta', 'recetas');
  add(c.notas, 'nota', 'notas');
  add(c.informes, 'informe', 'informes');
  return partes.join(' · ');
}

// ⚠️ El chip de COBRO / FACTURA de una visita NO se arma con `cita.cobro` (sólo el ingreso): se
// pinta con el VEREDICTO del servidor (`estadoPago`, `facturada`) de `GET …/patients/[id]/bookings`,
// que mira ingreso Y links juntos. Dos componentes leyendo mitades distintas es lo que hacía que
// una tarjeta dijera "Por cobrar" y "Pagado" a la vez (ver `CitaBadges.tsx`).

export const visitaHref = (patientId: string, visitaId: string) =>
  `/dashboard/medical-records/patients/${patientId}/visitas/${visitaId}`;
