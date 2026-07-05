/**
 * Agenda agent — proposal layer (PR 2: internal actions as proposals).
 *
 * The model calls propose_* tools; each one runs SERVER-SIDE pre-checks
 * (regla 0: conflictos/duplicados/citas activas se resuelven aquí, no en el
 * modelo), registers an ordered proposal in the turn's collector, and returns
 * the preview to the model so it can narrate it. Nothing here mutates: the
 * CLIENT executes the real endpoints after the doctor confirms each card, and
 * those endpoints re-validate everything (locks, overlaps, authz).
 *
 * Ordering: proposals execute in registration order (the order the model calls
 * the tools). The client executor is strictly sequential and stops the chain
 * on failure (02-DISENO §3.1).
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from './anthropic';
import { dateKeyToUtcDate, utcDateToKey, mxTodayKey } from './dates';

// ---------------------------------------------------------------------------
// Types shared with the client (panel cards + executor)
// ---------------------------------------------------------------------------

export type ProposalType = 'create_range' | 'block_time' | 'unblock_time' | 'delete_range';

export interface AgendaProposal {
  /** Server-assigned id within the turn ("p1", "p2", …). */
  id: string;
  /** 1-based execution order (registration order). */
  orden: number;
  type: ProposalType;
  /** Human summary for the card title. */
  titulo: string;
  /** Preview lines (what will happen). */
  detalle: string[];
  /** Warnings the doctor must see before confirming (conflicts, cascades). */
  advertencias: string[];
  /** Exact payload the client executor sends to the real endpoint. */
  params: Record<string, unknown>;
}

export const MAX_PROPOSALS_PER_TURN = 10;

export class ProposalCollector {
  proposals: AgendaProposal[] = [];

  add(p: Omit<AgendaProposal, 'id' | 'orden'>): AgendaProposal | null {
    if (this.proposals.length >= MAX_PROPOSALS_PER_TURN) return null;
    const proposal: AgendaProposal = {
      ...p,
      id: `p${this.proposals.length + 1}`,
      orden: this.proposals.length + 1,
    };
    this.proposals.push(proposal);
    return proposal;
  }

  /** Range ids already proposed for deletion earlier in THIS plan. Later
   * pre-checks treat them as gone (the executor deletes them first — plan-aware
   * previews, the delete→create replacement pattern of 02-DISENO §3.1). */
  pendingDeletedRangeIds(): Set<string> {
    const ids = new Set<string>();
    for (const p of this.proposals) {
      if (p.type === 'delete_range') {
        for (const id of (p.params.rangeIds as string[]) ?? []) ids.add(id);
      }
    }
    return ids;
  }
}

export interface ProposalContext {
  doctorId: string;
  collector: ProposalCollector;
}

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic schema)
// ---------------------------------------------------------------------------

export const PROPOSAL_TOOLS: AnthropicTool[] = [
  {
    name: 'propose_create_range',
    description:
      'PROPONE crear rango(s) de disponibilidad (el doctor confirma antes de ejecutar). Único: pasa "date". Recurrente: pasa "startDate"+"endDate"+"daysOfWeek" (0=domingo…6=sábado). El servidor pre-valida: fechas pasadas, retícula de 15 min, traslapes y duplicados con rangos existentes. Llama las propose_* EN EL ORDEN en que deben ejecutarse. Para REEMPLAZAR un rango: propone primero delete_range y luego create_range en el MISMO plan — los rangos que un paso anterior elimina ya no cuentan como traslape.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha única "YYYY-MM-DD" (modo único)' },
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD" (modo recurrente)' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (modo recurrente)' },
        daysOfWeek: {
          type: 'array',
          items: { type: 'number' },
          description: 'Días de la semana (0=domingo…6=sábado), modo recurrente',
        },
        startTime: { type: 'string', description: 'Hora inicio "HH:MM" (frontera de 15 min)' },
        endTime: { type: 'string', description: 'Hora fin "HH:MM" (frontera de 15 min)' },
        intervalMinutes: {
          type: 'number',
          description: 'Intervalo de citas: 15, 30, 45 o 60 (default 30)',
        },
      },
      required: ['startTime', 'endTime'],
    },
  },
  {
    name: 'propose_block_time',
    description:
      'PROPONE bloquear un horario (overlay: NO cancela citas existentes — el servidor te dice cuáles quedan vivas dentro del bloqueo y debes avisarlo). Horas SOLO en fronteras de 30 min (09:00, 09:30). Día(s) completo(s): usa 00:00–23:30. El doctor confirma antes de ejecutar.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD"' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (igual a startDate para un solo día)' },
        blockStartTime: { type: 'string', description: 'Hora inicio "HH:MM"' },
        blockEndTime: { type: 'string', description: 'Hora fin "HH:MM"' },
        reason: { type: 'string', description: 'Motivo (opcional pero recomendado)' },
      },
      required: ['startDate', 'endDate', 'blockStartTime', 'blockEndTime'],
    },
  },
  {
    name: 'propose_unblock_time',
    description:
      'PROPONE eliminar bloqueo(s) existentes (100% reversible). Los ids salen de get_day_schedule o get_ranges de ESTE turno — nunca los inventes.',
    input_schema: {
      type: 'object',
      properties: {
        blockedTimeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids de los bloqueos a eliminar (de get_day_schedule)',
        },
      },
      required: ['blockedTimeIds'],
    },
  },
  {
    name: 'propose_delete_range',
    description:
      'PROPONE eliminar rango(s) de disponibilidad por id (los ids salen de get_day_schedule o get_ranges de ESTE turno — para varios días usa get_ranges, UNA llamada). El servidor te avisa qué rangos tienen citas activas dentro: esos serán RECHAZADOS al ejecutar. IMPORTANTE: eliminar un rango NUNCA afecta las citas — no sugieras cancelar/reagendar citas como requisito para borrar rangos.',
    input_schema: {
      type: 'object',
      properties: {
        rangeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids de los rangos a eliminar (de get_day_schedule)',
        },
      },
      required: ['rangeIds'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_INTERVALS = [15, 30, 45, 60];

function isQuarterAligned(time: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && [0, 15, 30, 45].includes(min);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Expand a recurring spec into date keys (bounded horizon). */
function expandDates(startDate: string, endDate: string, daysOfWeek: number[]): string[] {
  const out: string[] = [];
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  for (let cur = new Date(start); cur <= end && out.length <= 120; cur.setUTCDate(cur.getUTCDate() + 1)) {
    if (daysOfWeek.includes(cur.getUTCDay())) out.push(cur.toISOString().split('T')[0]);
  }
  return out;
}

const HORIZON_DAYS = 366;

function withinHorizon(dateKey: string): boolean {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + HORIZON_DAYS);
  return dateKey <= limit.toISOString().split('T')[0];
}

/** Active bookings (freeform + slot-based) of a doctor on a set of dates. */
async function activeBookingsByDate(doctorId: string, dateKeys: string[]) {
  if (dateKeys.length === 0) return new Map<string, { patientName: string; startTime: string; endTime: string }[]>();
  const dates = dateKeys.map(dateKeyToUtcDate);
  const bookings = await prisma.booking.findMany({
    where: {
      doctorId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      OR: [{ slotId: null, date: { in: dates } }, { slot: { date: { in: dates } } }],
    },
    select: {
      patientName: true,
      startTime: true,
      endTime: true,
      date: true,
      slot: { select: { date: true, startTime: true, endTime: true } },
    },
  });
  const map = new Map<string, { patientName: string; startTime: string; endTime: string }[]>();
  for (const b of bookings) {
    const date = b.slot?.date ?? b.date;
    const startTime = b.slot?.startTime ?? b.startTime;
    const endTime = b.slot?.endTime ?? b.endTime;
    if (!date || !startTime || !endTime) continue;
    const key = utcDateToKey(date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ patientName: b.patientName, startTime, endTime });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Proposal builders (pre-checks + registration)
// ---------------------------------------------------------------------------

async function proposeCreateRange(
  ctx: ProposalContext,
  input: {
    date?: string;
    startDate?: string;
    endDate?: string;
    daysOfWeek?: number[];
    startTime: string;
    endTime: string;
    intervalMinutes?: number;
  }
) {
  const today = mxTodayKey();
  const interval = input.intervalMinutes ?? 30;
  const mode: 'single' | 'recurring' = input.date ? 'single' : 'recurring';

  // Hard validations (the endpoint does NOT check past dates — RNG-10)
  if (!isQuarterAligned(input.startTime) || !isQuarterAligned(input.endTime)) {
    return { error: 'Las horas deben estar en fronteras de 15 minutos (ej. 09:00, 09:15).' };
  }
  if (input.endTime <= input.startTime) {
    return { error: 'La hora de fin debe ser posterior a la de inicio.' };
  }
  if (!VALID_INTERVALS.includes(interval)) {
    return { error: 'intervalMinutes debe ser 15, 30, 45 o 60.' };
  }

  let dateKeys: string[];
  if (mode === 'single') {
    dateKeys = [input.date!];
  } else {
    if (!input.startDate || !input.endDate || !input.daysOfWeek?.length) {
      return { error: 'Modo recurrente requiere startDate, endDate y daysOfWeek.' };
    }
    dateKeys = expandDates(input.startDate, input.endDate, input.daysOfWeek);
    if (dateKeys.length === 0) return { error: 'Ningún día coincide con ese patrón de fechas.' };
    if (dateKeys.length > 120) return { error: 'Demasiados días (máx 120 por propuesta) — divide el rango de fechas.' };
  }
  const pastDates = dateKeys.filter((d) => d < today);
  if (pastDates.length > 0) {
    return { error: `No se pueden crear rangos en fechas pasadas (hoy es ${today}): ${pastDates.slice(0, 3).join(', ')}${pastDates.length > 3 ? '…' : ''}` };
  }
  if (dateKeys.some((d) => !withinHorizon(d))) {
    return { error: 'Fecha demasiado lejana (máx 1 año).' };
  }

  // Preview: overlaps/duplicates against existing ranges on those dates —
  // EXCLUDING ranges an earlier step of this plan deletes (plan-aware: the
  // executor runs delete before create, so they won't exist at execution).
  const pendingDeleted = ctx.collector.pendingDeletedRangeIds();
  const existing = await prisma.availabilityRange.findMany({
    where: { doctorId: ctx.doctorId, date: { in: dateKeys.map(dateKeyToUtcDate) } },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
  const byDate = new Map<string, { startTime: string; endTime: string }[]>();
  let excludedByPlan = 0;
  for (const r of existing) {
    if (pendingDeleted.has(r.id)) {
      // Only a real dependency if this range would actually have conflicted
      if (overlaps(input.startTime, input.endTime, r.startTime, r.endTime)) excludedByPlan++;
      continue;
    }
    const key = utcDateToKey(r.date);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push({ startTime: r.startTime, endTime: r.endTime });
  }
  const conflictDates: string[] = [];
  for (const d of dateKeys) {
    const dayRanges = byDate.get(d) ?? [];
    if (dayRanges.some((r) => overlaps(input.startTime, input.endTime, r.startTime, r.endTime))) {
      conflictDates.push(d);
    }
  }
  const creatable = dateKeys.length - conflictDates.length;

  // The endpoint is ALL-OR-NOTHING: any conflicting day → 409 and NOTHING is
  // created. Don't register a proposal that is guaranteed to fail — tell the
  // model to re-plan (exclude those days / adjust hours / delete ranges first).
  if (conflictDates.length > 0) {
    return {
      error: `${conflictDates.length} día(s) ya tienen un rango que traslapa (${conflictDates.slice(0, 5).join(', ')}${conflictDates.length > 5 ? '…' : ''}) y el servidor rechaza TODO el lote si un solo día choca. Re-propón excluyendo esos días (ajusta fechas/daysOfWeek), con otras horas, o propone primero eliminar los rangos que traslapan.`,
      diasConConflicto: conflictDates,
      diasSinConflicto: dateKeys.filter((d) => !conflictDates.includes(d)),
    };
  }
  const advertencias: string[] = [];
  if (excludedByPlan > 0) {
    advertencias.push(
      `Depende de pasos anteriores del plan: ${excludedByPlan} rango(s) que traslapan serán eliminados antes por este mismo plan — si esa eliminación falla o se rechaza, este paso fallará con conflicto.`
    );
  }

  // The endpoint's daysOfWeek convention is Monday=0…Sunday=6 (ranges/route.ts
  // adjustedDay); the tool schema and expandDates use JS getUTCDay (Sunday=0).
  // Convert here so preview days and created days are the SAME days.
  const params: Record<string, unknown> = {
    doctorId: ctx.doctorId,
    mode,
    startTime: input.startTime,
    endTime: input.endTime,
    intervalMinutes: interval,
    ...(mode === 'single'
      ? { date: input.date }
      : {
          startDate: input.startDate,
          endDate: input.endDate,
          daysOfWeek: input.daysOfWeek!.map((d) => (d === 0 ? 6 : d - 1)),
        }),
  };

  const titulo =
    mode === 'single'
      ? `Crear rango ${input.date} ${input.startTime}–${input.endTime}`
      : `Crear rangos recurrentes ${input.startDate}→${input.endDate} ${input.startTime}–${input.endTime}`;

  const proposal = ctx.collector.add({
    type: 'create_range',
    titulo,
    detalle: [
      `${creatable} rango(s) de ${input.startTime} a ${input.endTime}, intervalo ${interval} min`,
      ...(mode === 'recurring' ? [`Días: ${dateKeys.slice(0, 7).join(', ')}${dateKeys.length > 7 ? ` (+${dateKeys.length - 7} más)` : ''}`] : []),
    ],
    advertencias,
    params,
  });
  if (!proposal) return { error: `Máximo ${MAX_PROPOSALS_PER_TURN} propuestas por turno.` };

  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    diasACrear: creatable,
    diasConConflicto: conflictDates,
    nota: 'Propuesta registrada — el doctor debe confirmarla en la card para ejecutarse.',
  };
}

async function proposeBlockTime(
  ctx: ProposalContext,
  input: { startDate: string; endDate: string; blockStartTime: string; blockEndTime: string; reason?: string }
) {
  const today = mxTodayKey();
  // The endpoint enforces 30-min boundaries (isValid30MinBoundary) — pre-check
  // so a bad time fails at proposal time, not after the doctor confirmed.
  const is30Min = (t: string) => /^(\d{2}):(00|30)$/.test(t) && Number(t.slice(0, 2)) <= 23;
  if (!is30Min(input.blockStartTime) || !is30Min(input.blockEndTime)) {
    return { error: 'Las horas del bloqueo deben estar en fronteras de 30 minutos (ej. 09:00, 09:30). Día completo: 00:00–23:30.' };
  }
  if (input.blockEndTime <= input.blockStartTime) {
    return { error: 'La hora de fin debe ser posterior a la de inicio.' };
  }
  if (input.endDate < input.startDate) return { error: 'endDate no puede ser anterior a startDate.' };
  if (input.endDate < today) return { error: `Ese periodo ya pasó (hoy es ${today}).` };
  if (!withinHorizon(input.startDate)) return { error: 'Fecha demasiado lejana (máx 1 año).' };

  // Mirror the endpoint's dryRun: days with ranges, duplicates, cita conflicts.
  // Past days are dropped from the preview (blocking yesterday is meaningless
  // and past vencidas would pollute the conflict warnings).
  const effectiveStart = input.startDate < today ? today : input.startDate;
  const allDays = expandDates(effectiveStart, input.endDate, [0, 1, 2, 3, 4, 5, 6]);
  if (allDays.length > 120) return { error: 'Demasiados días (máx 120) — divide el periodo.' };
  if (allDays.length === 0) return { error: 'No hay días válidos en ese periodo.' };

  const [ranges, existingBlocks, bookingsByDate] = await Promise.all([
    prisma.availabilityRange.findMany({
      where: { doctorId: ctx.doctorId, date: { in: allDays.map(dateKeyToUtcDate) } },
      select: { date: true },
    }),
    prisma.blockedTime.findMany({
      where: { doctorId: ctx.doctorId, date: { in: allDays.map(dateKeyToUtcDate) } },
      select: { date: true, startTime: true, endTime: true },
    }),
    activeBookingsByDate(ctx.doctorId, allDays),
  ]);

  const daysWithRanges = new Set(ranges.map((r) => utcDateToKey(r.date)));
  const dup = new Set(
    existingBlocks
      .filter((b) => b.startTime === input.blockStartTime && b.endTime === input.blockEndTime)
      .map((b) => utcDateToKey(b.date))
  );

  const conflictos: string[] = [];
  for (const d of allDays) {
    for (const b of bookingsByDate.get(d) ?? []) {
      if (overlaps(input.blockStartTime, input.blockEndTime, b.startTime, b.endTime)) {
        conflictos.push(`${d} ${b.startTime}–${b.endTime} ${b.patientName}`);
      }
    }
  }

  const aBloquear = allDays.filter((d) => daysWithRanges.has(d) && !dup.has(d)).length;
  const sinRangos = allDays.filter((d) => !daysWithRanges.has(d)).length;

  const advertencias: string[] = [];
  if (conflictos.length > 0) {
    advertencias.push(
      `⚠️ ${conflictos.length} cita(s) activas quedan DENTRO del bloqueo y SIGUEN VIVAS (el bloqueo no cancela citas): ${conflictos.slice(0, 4).join(' · ')}${conflictos.length > 4 ? '…' : ''}`
    );
  }
  if (sinRangos > 0) advertencias.push(`${sinRangos} día(s) sin rangos se saltarán.`);
  if (dup.size > 0) advertencias.push(`${dup.size} día(s) ya tienen ese bloqueo exacto (se saltan).`);
  if (aBloquear === 0) {
    return { error: 'Nada que bloquear: los días no tienen rangos o ya tienen ese bloqueo.', diasSinRangos: sinRangos, duplicados: dup.size };
  }

  const proposal = ctx.collector.add({
    type: 'block_time',
    titulo: `Bloquear ${input.blockStartTime}–${input.blockEndTime} (${input.startDate}${input.endDate !== input.startDate ? `→${input.endDate}` : ''})`,
    detalle: [
      `${aBloquear} día(s) se bloquearán${input.reason ? ` — motivo: "${input.reason}"` : ' (sin motivo)'}`,
    ],
    advertencias,
    params: {
      doctorId: ctx.doctorId,
      startDate: input.startDate,
      endDate: input.endDate,
      blockStartTime: input.blockStartTime,
      blockEndTime: input.blockEndTime,
      ...(input.reason ? { reason: input.reason } : {}),
      dryRun: false,
    },
  });
  if (!proposal) return { error: `Máximo ${MAX_PROPOSALS_PER_TURN} propuestas por turno.` };

  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    diasABloquear: aBloquear,
    citasVivasDentro: conflictos,
    diasSinRangos: sinRangos,
    duplicados: dup.size,
    nota: 'Propuesta registrada — si hay citas dentro del bloqueo, AVISA al doctor que siguen vivas.',
  };
}

async function proposeUnblockTime(ctx: ProposalContext, input: { blockedTimeIds: string[] }) {
  if (!input.blockedTimeIds?.length) return { error: 'Se requieren ids de bloqueos.' };
  const blocks = await prisma.blockedTime.findMany({
    where: { id: { in: input.blockedTimeIds }, doctorId: ctx.doctorId },
    select: { id: true, date: true, startTime: true, endTime: true, reason: true },
  });
  if (blocks.length === 0) {
    return { error: 'Ningún bloqueo con esos ids pertenece a este doctor — usa ids de get_day_schedule de este turno.' };
  }
  const notFound = input.blockedTimeIds.filter((id) => !blocks.some((b) => b.id === id));

  const proposal = ctx.collector.add({
    type: 'unblock_time',
    titulo: `Desbloquear ${blocks.length} bloqueo(s)`,
    detalle: blocks.map(
      (b) => `${utcDateToKey(b.date)} ${b.startTime}–${b.endTime}${b.reason ? ` ("${b.reason}")` : ''}`
    ),
    advertencias: notFound.length > 0 ? [`${notFound.length} id(s) no encontrados se ignoran.`] : [],
    params: { ids: blocks.map((b) => b.id) },
  });
  if (!proposal) return { error: `Máximo ${MAX_PROPOSALS_PER_TURN} propuestas por turno.` };

  return { propuestaId: proposal.id, orden: proposal.orden, bloqueos: proposal.detalle };
}

async function proposeDeleteRange(ctx: ProposalContext, input: { rangeIds: string[] }) {
  if (!input.rangeIds?.length) return { error: 'Se requieren ids de rangos.' };
  const ranges = await prisma.availabilityRange.findMany({
    where: { id: { in: input.rangeIds }, doctorId: ctx.doctorId },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
  if (ranges.length === 0) {
    return { error: 'Ningún rango con esos ids pertenece a este doctor — usa ids de get_day_schedule de este turno.' };
  }

  // Pre-check: active citas inside each range (the individual DELETE endpoint
  // refuses those — warn now instead of failing at execution).
  const dateKeys = [...new Set(ranges.map((r) => utcDateToKey(r.date)))];
  const bookingsByDate = await activeBookingsByDate(ctx.doctorId, dateKeys);
  const conRango: string[] = [];
  const protegidos: string[] = [];
  for (const r of ranges) {
    const key = utcDateToKey(r.date);
    const inside = (bookingsByDate.get(key) ?? []).filter((b) =>
      overlaps(r.startTime, r.endTime, b.startTime, b.endTime)
    );
    const label = `${key} ${r.startTime}–${r.endTime}`;
    if (inside.length > 0) {
      protegidos.push(`${label} (${inside.length} cita(s): ${inside.map((b) => b.patientName).slice(0, 3).join(', ')})`);
    } else {
      conRango.push(label);
    }
  }

  const advertencias: string[] = [];
  if (protegidos.length > 0) {
    advertencias.push(
      `⚠️ ${protegidos.length} rango(s) no se pueden eliminar porque tienen citas agendadas: ${protegidos.join(' · ')}. Las citas no se tocan: eliminar rangos nunca afecta citas ya agendadas.`
    );
  }

  const proposal = ctx.collector.add({
    type: 'delete_range',
    titulo: `Eliminar ${ranges.length} rango(s) de disponibilidad`,
    detalle: conRango.length > 0 ? conRango : ['(todos los rangos seleccionados tienen citas — ver advertencia)'],
    advertencias,
    params: { rangeIds: ranges.map((r) => r.id) },
  });
  if (!proposal) return { error: `Máximo ${MAX_PROPOSALS_PER_TURN} propuestas por turno.` };

  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    rangosSinCitas: conRango,
    rangosProtegidosPorCitas: protegidos,
    nota: protegidos.length > 0 ? 'AVISA al doctor cuáles rangos serán rechazados por tener citas.' : undefined,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executeProposalTool(
  ctx: ProposalContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'propose_create_range':
      return proposeCreateRange(ctx, input as any);
    case 'propose_block_time':
      return proposeBlockTime(ctx, input as any);
    case 'propose_unblock_time':
      return proposeUnblockTime(ctx, input as any);
    case 'propose_delete_range':
      return proposeDeleteRange(ctx, input as any);
    default:
      return null;
  }
}

export function isProposalTool(name: string): boolean {
  return PROPOSAL_TOOLS.some((t) => t.name === name);
}
