/**
 * Agenda agent — proposal layer (PR 2: internal actions · PR 3: citas).
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
 *
 * PR 3 (citas) specifics — 06-PR3-DISENO:
 * - Everything that notifies the patient carries a fixed 📱 warning (D5).
 * - create/reschedule re-validate the slot against the REAL availability
 *   engine at proposal time (G3), tolerating conflicts that this same plan
 *   removes (GAP-2: the booking being rescheduled; GAP-3: bookings an earlier
 *   step cancels).
 * - complete carries the full ledger payload built HERE (D4/G1: a raw PATCH
 *   does not create the LedgerEntry — the executor must POST it too).
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from './anthropic';
import {
  dateKeyToUtcDate,
  utcDateToKey,
  mxTodayKey,
  isVencida,
  addMinutesToTime,
} from './dates';
import { AREA_INGRESOS_CONSULTA, FORMAS_DE_PAGO } from '@/app/dashboard/practice/flujo-de-dinero/_components/ledger-types';
import { API_URL } from './tools';

// ---------------------------------------------------------------------------
// Types shared with the client (panel cards + executor)
// ---------------------------------------------------------------------------

export type ProposalType =
  | 'create_range'
  | 'block_time'
  | 'unblock_time'
  | 'delete_range'
  | 'create_booking'
  | 'confirm_booking'
  | 'cancel_booking'
  | 'reschedule_booking'
  | 'complete_booking'
  | 'no_show'
  // PR F2b/F2c (owned by modules/facturas.ts — the registry routes them there):
  | 'create_cfdi'
  | 'prepare_factura_borrador';

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

  /** Booking ids an earlier step of THIS plan cancels (cancel_booking or the
   * cancel half of reschedule_booking). Slot checks for later create/reschedule
   * steps treat them as gone — GAP-3, same pattern as pendingDeletedRangeIds. */
  pendingCancelledBookingIds(): Set<string> {
    const ids = new Set<string>();
    for (const p of this.proposals) {
      if (p.type === 'cancel_booking' || p.type === 'reschedule_booking') {
        const id = p.params.bookingId as string | undefined;
        if (id) ids.add(id);
      }
    }
    return ids;
  }

  /** Booking ids an earlier step of THIS plan confirms — lets a
   * confirmar→completar (or →no asistió) two-step live in ONE plan. */
  pendingConfirmedBookingIds(): Set<string> {
    const ids = new Set<string>();
    for (const p of this.proposals) {
      if (p.type === 'confirm_booking') {
        const id = p.params.bookingId as string | undefined;
        if (id) ids.add(id);
      }
    }
    return ids;
  }
}

export interface ProposalContext {
  doctorId: string;
  doctorSlug: string;
  collector: ProposalCollector;
}

/** GAP-5: on cap overflow the model must NARRATE the remainder, never drop it.
 * Exported: module proposal builders (facturas F2b+) reuse the same message. */
export const CAP_ERROR = `Máximo ${MAX_PROPOSALS_PER_TURN} propuestas por turno — DILE al doctor explícitamente cuántas acciones quedan pendientes para el siguiente turno (nunca las omitas en silencio).`;

/** D5: fixed warning for every card whose execution notifies the patient. */
const NOTIFY_WARNING =
  '📱 Esta acción NOTIFICA al paciente (SMS/email/Google Calendar) — el aviso no se puede deshacer.';

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
    name: 'propose_create_booking',
    description:
      'PROPONE crear una CITA (🔴 notifica al paciente: SMS/email/Google Calendar — solo cuando el doctor lo pidió explícitamente). La cita nace CONFIRMADA. El horario debe salir de get_availability de ESTE turno; el servidor lo re-valida contra el motor real. Paciente conocido: usa find_patient primero y pasa patientId + su contacto. Walk-in: pide al doctor los datos de contacto que falten — NUNCA los inventes. Si el horario está ocupado por una cita que un paso anterior de ESTE plan cancela, sí puedes proponerlo (el servidor lo detecta).',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha "YYYY-MM-DD"' },
        startTime: { type: 'string', description: 'Hora inicio "HH:MM" (de get_availability de este turno)' },
        serviceId: { type: 'string', description: 'ID del servicio (de get_services)' },
        patientName: { type: 'string', description: 'Nombre del paciente' },
        patientId: { type: 'string', description: 'ID de expediente (de find_patient) — opcional, vincula la cita al expediente' },
        patientEmail: { type: 'string', description: 'Email del paciente (según settings puede ser requerido)' },
        patientPhone: { type: 'string', description: 'Teléfono (según settings puede ser requerido)' },
        patientWhatsapp: { type: 'string', description: 'WhatsApp (según settings puede ser requerido)' },
        notes: { type: 'string', description: 'Notas (opcional)' },
        appointmentMode: { type: 'string', enum: ['PRESENCIAL', 'TELEMEDICINA'], description: 'Modalidad (opcional)' },
        isFirstTime: { type: 'boolean', description: 'Primera vez (opcional)' },
      },
      required: ['date', 'startTime', 'serviceId', 'patientName'],
    },
  },
  {
    name: 'propose_confirm_booking',
    description:
      'PROPONE confirmar una cita PENDIENTE (🔴 notifica al paciente: SMS + email + Google Calendar). El bookingId sale de get_bookings/get_day_schedule/get_booking_detail de ESTE turno. Para completar una PENDIENTE, propone confirmar y completar como DOS pasos del mismo plan (en ese orden).',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita PENDIENTE' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'propose_cancel_booking',
    description:
      'PROPONE cancelar una cita activa (🔴 notifica: email de cancelación si hay correo, y borra el evento de Google Calendar — solo cuando el doctor lo pidió explícitamente). CANCELADA es estado FINAL. OJO con citas VENCIDAS (ya pasaron): cancelarlas manda un email de cancelación de una cita pasada — los cierres honestos de una vencida suelen ser COMPLETADA o NO ASISTIÓ; el servidor te avisa si aplica.',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita (PENDIENTE o CONFIRMADA)' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'propose_reschedule_booking',
    description:
      'PROPONE reagendar una cita: UNA sola acción — el sistema cancela la original y crea la nueva (CONFIRMADA) con los mismos datos del paciente (🔴 notifica DOS veces: cancelación + confirmación nueva). El horario nuevo debe salir de get_availability de ESTE turno; mover la cita DENTRO de su propio horario sí es válido (el servidor descuenta la cita que se mueve). NUNCA propongas cancelar+crear por separado para reagendar.',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita a mover' },
        newDate: { type: 'string', description: 'Nueva fecha "YYYY-MM-DD"' },
        newStartTime: { type: 'string', description: 'Nueva hora "HH:MM"' },
        newServiceId: { type: 'string', description: 'Nuevo servicio (opcional — default: el de la cita)' },
        patientEmail: { type: 'string', description: 'Email (opcional — solo si el servidor te dice que a la cita original le falta un dato requerido)' },
        patientPhone: { type: 'string', description: 'Teléfono (opcional — ídem)' },
        patientWhatsapp: { type: 'string', description: 'WhatsApp (opcional — ídem)' },
      },
      required: ['bookingId', 'newDate', 'newStartTime'],
    },
  },
  {
    name: 'propose_complete_booking',
    description:
      'PROPONE marcar una cita CONFIRMADA como COMPLETADA y registrar el ingreso en Flujo de Dinero (estado FINAL; no notifica al paciente). REQUIERE la forma de pago SALVO que el ingreso ya exista (p. ej. cita pagada con link de pago — este tool lo detecta y te lo dice). Si el doctor no dijo la forma de pago, llama al tool solo con bookingId: si hace falta, el error te pedirá preguntarla ("¿cómo te pagaron?"). El precio default es el de la cita. Una PENDIENTE no se puede completar directo: propone confirmar y completar como DOS pasos del mismo plan. La factura (CFDI) NO se emite aquí — se emite desde la tabla de citas.',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita CONFIRMADA' },
        formaDePago: {
          type: 'string',
          enum: FORMAS_DE_PAGO.map((f) => f.value as string),
          description: 'Cómo pagó el paciente — pregúntalo, no lo asumas (omitible si el ingreso ya existe)',
        },
        price: { type: 'number', description: 'Monto cobrado (opcional — default: el precio de la cita)' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'propose_no_show',
    description:
      'PROPONE marcar una cita CONFIRMADA como NO ASISTIÓ (estado FINAL; no notifica al paciente, no registra ingreso). Es el cierre honesto de una cita vencida a la que el paciente no llegó. Una PENDIENTE no puede marcarse no-asistió directo (primero confirmar, 2 pasos del mismo plan).',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita CONFIRMADA' },
      },
      required: ['bookingId'],
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
  if (!proposal) return { error: CAP_ERROR };

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
  if (!proposal) return { error: CAP_ERROR };

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
  if (!proposal) return { error: CAP_ERROR };

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
  if (!proposal) return { error: CAP_ERROR };

  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    rangosSinCitas: conRango,
    rangosProtegidosPorCitas: protegidos,
    nota: protegidos.length > 0 ? 'AVISA al doctor cuáles rangos serán rechazados por tener citas.' : undefined,
  };
}

// ---------------------------------------------------------------------------
// PR 3 — cita proposals (06-PR3-DISENO)
// ---------------------------------------------------------------------------

const BOOKING_PROPOSAL_SELECT = {
  id: true,
  patientName: true,
  patientEmail: true,
  patientPhone: true,
  patientWhatsapp: true,
  notes: true,
  status: true,
  serviceId: true,
  serviceName: true,
  finalPrice: true,
  appointmentMode: true,
  isFirstTime: true,
  extendedBlockMinutes: true,
  patientId: true,
  date: true,
  startTime: true,
  endTime: true,
  slot: { select: { date: true, startTime: true, endTime: true } },
  patient: { select: { rfc: true, razonSocial: true } },
} as const;

type BookingForProposal = NonNullable<
  Awaited<ReturnType<typeof fetchBookingForProposal>>
>;

async function fetchBookingForProposal(doctorId: string, bookingId: unknown) {
  // Model input — a non-string would throw inside Prisma instead of giving
  // the model a clean "unknown id" to react to.
  if (!bookingId || typeof bookingId !== 'string') return null;
  return prisma.booking.findFirst({
    where: { id: bookingId, doctorId },
    select: BOOKING_PROPOSAL_SELECT,
  });
}

/** Strict "HH:MM" (zero-padded, 00–23) — an unpadded "9:00" from the model
 * would poison every lexicographic time comparison in the slot checks. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Resolved calendar data (legacy slot bookings carry it on the slot). */
function bookingTiming(b: BookingForProposal) {
  const date = b.slot?.date ?? b.date;
  return {
    fecha: date ? utcDateToKey(date) : null,
    inicio: b.slot?.startTime ?? b.startTime,
    fin: b.slot?.endTime ?? b.endTime,
  };
}

function bookingLabel(b: BookingForProposal) {
  const t = bookingTiming(b);
  return `${t.fecha ?? '¿?'} ${t.inicio ?? ''} · ${b.patientName}`;
}

/** Contact requirements per the doctor's settings (the create endpoint
 * enforces the same for doctor callers — failing at PROPOSAL time means a
 * clean "pídele X al doctor" instead of a 400 after confirmation, and on the
 * reschedule path it prevents the RSC-3 disaster of cancelling a booking whose
 * data can't satisfy the re-create). */
async function missingContactFields(
  doctorId: string,
  c: { email?: string | null; phone?: string | null; whatsapp?: string | null }
): Promise<string[]> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      bookingHorariosEmailRequired: true,
      bookingHorariosPhoneRequired: true,
      bookingHorariosWhatsappRequired: true,
    },
  });
  return [
    (doctor?.bookingHorariosEmailRequired ?? true) && !c.email ? 'email' : null,
    (doctor?.bookingHorariosPhoneRequired ?? true) && !c.phone ? 'teléfono' : null,
    (doctor?.bookingHorariosWhatsappRequired ?? true) && !c.whatsapp ? 'WhatsApp' : null,
  ].filter(Boolean) as string[];
}

const TERMINAL_ERROR = (status: string) =>
  `La cita está en estado ${status} — es FINAL y no se puede modificar. El camino es siempre una cita nueva.`;

const UNKNOWN_BOOKING_ERROR =
  'Ninguna cita con ese id pertenece a este doctor — usa ids de get_bookings/get_day_schedule/get_booking_detail de ESTE turno, nunca los inventes.';

/**
 * G3: re-validate a requested slot against the REAL availability engine (the
 * same endpoint get_availability uses). Plan-aware (GAP-2/3): conflicts caused
 * SOLELY by bookings in `excludeBookingIds` (the booking being rescheduled, or
 * bookings an earlier step of this plan cancels) don't count — those are gone
 * by the time the executor reaches this step. Both checks ask the SAME engine:
 * the plan-aware pass sends `excludeBookingIds` to range-availability instead
 * of re-deriving the occupied-window formula here.
 */
async function checkSlot(
  ctx: ProposalContext,
  input: { dateKey: string; startTime: string; serviceId: string; excludeBookingIds: Set<string> }
): Promise<
  | { ok: true; dependencia: string | null; servicio: { nombre: string; duracionMinutos: number; precio: number } }
  | { ok: false; error: string; horariosDisponibles: string[] }
> {
  // No isBookingActive filter: the flag only hides the service from the PUBLIC
  // page — the doctor (and therefore the agent acting for him) can book any of
  // his services, matching the internal booking modal and the endpoint.
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, doctorId: ctx.doctorId },
    select: { serviceName: true, durationMinutes: true, price: true },
  });
  if (!service) {
    return {
      ok: false,
      error: 'El servicio no existe — usa un id de get_services.',
      horariosDisponibles: [],
    };
  }
  const servicio = {
    nombre: service.serviceName,
    duracionMinutos: service.durationMinutes,
    precio: Number(service.price),
  };

  // The real engine (never derive availability — decisión D1: ruta normal).
  const fetchDaySlots = async (
    excludeIds?: Set<string>
  ): Promise<{ slots: { startTime: string }[] } | { error: string }> => {
    const params = new URLSearchParams({
      startDate: input.dateKey,
      endDate: input.dateKey,
      serviceId: input.serviceId,
      skipCutoff: '1',
    });
    if (excludeIds && excludeIds.size > 0) {
      params.set('excludeBookingIds', [...excludeIds].join(','));
    }
    try {
      const res = await fetch(
        `${API_URL}/api/doctors/${ctx.doctorSlug}/range-availability?${params.toString()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        return { error: `No se pudo verificar disponibilidad (HTTP ${res.status}) — reintenta.` };
      }
      const data: { timeSlots?: Record<string, { startTime: string }[]> } = await res.json();
      return { slots: data.timeSlots?.[input.dateKey] ?? [] };
    } catch {
      return { error: 'No se pudo verificar disponibilidad (error de red) — reintenta en un momento.' };
    }
  };

  // 1) Current state: free means free, no dependency on the plan.
  const current = await fetchDaySlots();
  if ('error' in current) {
    return { ok: false, error: current.error, horariosDisponibles: [] };
  }
  if (current.slots.some((s) => s.startTime === input.startTime)) {
    return { ok: true, dependencia: null, servicio };
  }

  // 2) Plan-aware pass: does the slot become free once the plan's earlier
  //    cancellations (or the booking being moved) are gone? Same engine, with
  //    those bookings excluded server-side.
  const horariosDisponibles = current.slots.map((s) => s.startTime);
  if (input.excludeBookingIds.size > 0) {
    const planAware = await fetchDaySlots(input.excludeBookingIds);
    if ('error' in planAware) {
      return { ok: false, error: planAware.error, horariosDisponibles: [] };
    }
    if (planAware.slots.some((s) => s.startTime === input.startTime)) {
      return {
        ok: true,
        dependencia:
          'Depende de pasos anteriores del plan: el horario se libera cuando este mismo plan cancele la cita que lo ocupa — si esa cancelación falla o se rechaza, este paso fallará con conflicto.',
        servicio,
      };
    }
  }

  return {
    ok: false,
    error: `El horario ${input.dateKey} ${input.startTime} NO está disponible para ${servicio.nombre}. ${
      horariosDisponibles.length > 0
        ? `Horarios libres ese día: ${horariosDisponibles.slice(0, 12).join(', ')}${horariosDisponibles.length > 12 ? '…' : ''}.`
        : 'Ese día no tiene ningún horario libre para ese servicio.'
    } Ofrece alternativas al doctor — no fuerces el horario.`,
    horariosDisponibles,
  };
}

async function proposeCreateBooking(
  ctx: ProposalContext,
  input: {
    date: string;
    startTime: string;
    serviceId: string;
    patientName: string;
    patientId?: string;
    patientEmail?: string;
    patientPhone?: string;
    patientWhatsapp?: string;
    notes?: string;
    appointmentMode?: string;
    isFirstTime?: boolean;
  }
) {
  const today = mxTodayKey();
  if (!input.date || !input.startTime || !input.serviceId || !input.patientName?.trim()) {
    return { error: 'Faltan datos: date, startTime, serviceId y patientName son obligatorios.' };
  }
  if (!TIME_RE.test(input.startTime)) {
    return { error: 'startTime debe ser "HH:MM" con cero inicial (ej. 09:00, no 9:00).' };
  }
  if (input.date < today) return { error: `Esa fecha ya pasó (hoy es ${today}).` };
  if (!withinHorizon(input.date)) return { error: 'Fecha demasiado lejana (máx 1 año).' };

  const missing = await missingContactFields(ctx.doctorId, {
    email: input.patientEmail,
    phone: input.patientPhone,
    whatsapp: input.patientWhatsapp,
  });
  if (missing.length > 0) {
    return {
      error: `Faltan datos de contacto requeridos: ${missing.join(', ')}. Pídelos al doctor (o tómalos de find_patient) — NUNCA los inventes.`,
    };
  }

  // GAP-1 mirror: a patientId must reference a patient of THIS doctor.
  if (input.patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
      select: { doctorId: true },
    });
    if (!patient || patient.doctorId !== ctx.doctorId) {
      return { error: 'Ese patientId no es válido para este doctor — usa el patientId que devuelve find_patient en ESTE turno.' };
    }
  }

  const slot = await checkSlot(ctx, {
    dateKey: input.date,
    startTime: input.startTime,
    serviceId: input.serviceId,
    excludeBookingIds: ctx.collector.pendingCancelledBookingIds(),
  });
  if (!slot.ok) return { error: slot.error, horariosDisponibles: slot.horariosDisponibles };

  const endTime = addMinutesToTime(input.startTime, slot.servicio.duracionMinutos);
  const advertencias = [NOTIFY_WARNING, ...(slot.dependencia ? [slot.dependencia] : [])];

  const proposal = ctx.collector.add({
    type: 'create_booking',
    titulo: `Crear cita ${input.date} ${input.startTime}–${endTime} · ${input.patientName}`,
    detalle: [
      `${slot.servicio.nombre} (${slot.servicio.duracionMinutos} min) · $${slot.servicio.precio}`,
      `Contacto: ${[input.patientEmail, input.patientPhone, input.patientWhatsapp].filter(Boolean).join(' · ') || 'sin datos'}`,
      input.patientId ? 'Vinculada al expediente del paciente' : 'Sin expediente (walk-in)',
      'La cita nace CONFIRMADA (creación del doctor)',
    ],
    advertencias,
    params: {
      doctorId: ctx.doctorId,
      date: input.date,
      startTime: input.startTime,
      serviceId: input.serviceId,
      patientName: input.patientName.trim(),
      // patientEmail/patientPhone are NON-NULLABLE columns (schema) — the UI
      // always sends at least "". Omitting them makes booking.create throw a
      // 500 (bitácora fila 21, cazado en vivo en el primer reschedule real).
      patientEmail: input.patientEmail ?? '',
      patientPhone: input.patientPhone ?? '',
      ...(input.patientWhatsapp ? { patientWhatsapp: input.patientWhatsapp } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.appointmentMode ? { appointmentMode: input.appointmentMode } : {}),
      ...(input.isFirstTime !== undefined ? { isFirstTime: input.isFirstTime } : {}),
      ...(input.patientId ? { patientId: input.patientId } : {}),
    },
  });
  if (!proposal) return { error: CAP_ERROR };

  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    horario: `${input.date} ${input.startTime}–${endTime}`,
    nota: 'Propuesta registrada — RECUERDA al doctor que al ejecutarse el paciente será notificado.',
  };
}

async function proposeConfirmBooking(ctx: ProposalContext, input: { bookingId: string }) {
  const b = await fetchBookingForProposal(ctx.doctorId, input.bookingId);
  if (!b) return { error: UNKNOWN_BOOKING_ERROR };
  if (b.status === 'CONFIRMED') return { error: 'Esa cita ya está CONFIRMADA — no hay nada que confirmar.' };
  if (b.status !== 'PENDING') return { error: TERMINAL_ERROR(b.status) };

  const proposal = ctx.collector.add({
    type: 'confirm_booking',
    titulo: `Confirmar cita ${bookingLabel(b)}`,
    detalle: [`${b.serviceName ?? 'Sin servicio'} · pasa de PENDIENTE a CONFIRMADA`],
    advertencias: [NOTIFY_WARNING],
    params: { bookingId: b.id, status: 'CONFIRMED' },
  });
  if (!proposal) return { error: CAP_ERROR };
  return { propuestaId: proposal.id, orden: proposal.orden, cita: bookingLabel(b) };
}

async function proposeCancelBooking(ctx: ProposalContext, input: { bookingId: string }) {
  const b = await fetchBookingForProposal(ctx.doctorId, input.bookingId);
  if (!b) return { error: UNKNOWN_BOOKING_ERROR };
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return { error: TERMINAL_ERROR(b.status) };

  const t = bookingTiming(b);
  const vencida = t.fecha && t.fin ? isVencida(t.fecha, t.fin, b.status) : false;

  const advertencias: string[] = [
    b.patientEmail
      ? '📱 El paciente recibirá un EMAIL de cancelación; el evento de Google Calendar se elimina. El aviso no se puede deshacer.'
      : '📱 La cita no tiene email — no se enviará aviso de cancelación, PERO el evento de Google Calendar del paciente sí se elimina (visible para él).',
    'CANCELADA es estado FINAL — para retomar al paciente el camino es una cita nueva.',
  ];
  if (vencida) {
    advertencias.push(
      `⚠️ Esta cita YA PASÓ (vencida).${
        b.patientEmail ? ' El paciente recibiría un email de cancelación de una cita pasada.' : ''
      } Los cierres honestos de una vencida suelen ser COMPLETADA (sí ocurrió — registra el ingreso) o NO ASISTIÓ.${
        b.status === 'PENDING'
          ? ' OJO: una PENDIENTE no puede marcarse NO ASISTIÓ directo (habría que confirmarla primero, lo cual TAMBIÉN notifica) — explícale las opciones al doctor.'
          : ''
      }`
    );
  }

  const proposal = ctx.collector.add({
    type: 'cancel_booking',
    titulo: `Cancelar cita ${bookingLabel(b)}`,
    detalle: [`${b.serviceName ?? 'Sin servicio'} · estado actual: ${b.status}${vencida ? ' (VENCIDA)' : ''}`],
    advertencias,
    params: { bookingId: b.id, status: 'CANCELLED' },
  });
  if (!proposal) return { error: CAP_ERROR };
  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    cita: bookingLabel(b),
    vencida,
    nota: vencida
      ? 'La cita es VENCIDA — antes de que el doctor confirme, adviértele el email de cita pasada y ofrece COMPLETADA/NO ASISTIÓ como alternativas.'
      : 'AVISA al doctor que el paciente será notificado.',
  };
}

async function proposeRescheduleBooking(
  ctx: ProposalContext,
  input: {
    bookingId: string;
    newDate: string;
    newStartTime: string;
    newServiceId?: string;
    patientEmail?: string;
    patientPhone?: string;
    patientWhatsapp?: string;
  }
) {
  const b = await fetchBookingForProposal(ctx.doctorId, input.bookingId);
  if (!b) return { error: UNKNOWN_BOOKING_ERROR };
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return { error: TERMINAL_ERROR(b.status) };

  const today = mxTodayKey();
  if (!input.newDate || !input.newStartTime) return { error: 'Faltan newDate y newStartTime.' };
  if (!TIME_RE.test(input.newStartTime)) {
    return { error: 'newStartTime debe ser "HH:MM" con cero inicial (ej. 09:00, no 9:00).' };
  }
  if (input.newDate < today) return { error: `Esa fecha ya pasó (hoy es ${today}).` };
  if (!withinHorizon(input.newDate)) return { error: 'Fecha demasiado lejana (máx 1 año).' };

  // The re-create must satisfy the doctor's contact requirements — otherwise
  // the executor would cancel (patient notified!) and then 400 on the create,
  // manufacturing exactly the RSC-3 disaster (review finding, 2026-07-06).
  const contact = {
    email: input.patientEmail ?? b.patientEmail,
    phone: input.patientPhone ?? b.patientPhone,
    whatsapp: input.patientWhatsapp ?? b.patientWhatsapp,
  };
  const missing = await missingContactFields(ctx.doctorId, contact);
  if (missing.length > 0) {
    return {
      error: `La cita original no tiene ${missing.join(' ni ')} y tus settings lo exigen para crear la nueva — pide el dato al doctor y repite la propuesta pasándolo (patientEmail/patientPhone/patientWhatsapp). NUNCA lo inventes.`,
    };
  }

  const t = bookingTiming(b);
  const serviceId = input.newServiceId ?? b.serviceId;
  if (!serviceId) {
    return { error: 'La cita original no tiene servicio — pasa newServiceId (de get_services).' };
  }
  // RSC-4 no-op guard: same slot (and same service) = nothing to do.
  if (
    input.newDate === t.fecha &&
    input.newStartTime === t.inicio &&
    (!input.newServiceId || input.newServiceId === b.serviceId)
  ) {
    return {
      error:
        'Ese es EXACTAMENTE el horario actual de la cita — reagendar al mismo horario no hace nada (y cancelaría/notificaría por gusto). Confirma con el doctor a qué horario quiere moverla.',
    };
  }

  // GAP-2: the booking being moved doesn't block its own new slot.
  // GAP-3: neither do bookings an earlier step of this plan cancels.
  const excludeIds = new Set(ctx.collector.pendingCancelledBookingIds());
  excludeIds.add(b.id);
  const slot = await checkSlot(ctx, {
    dateKey: input.newDate,
    startTime: input.newStartTime,
    serviceId,
    excludeBookingIds: excludeIds,
  });
  if (!slot.ok) return { error: slot.error, horariosDisponibles: slot.horariosDisponibles };

  const endTime = addMinutesToTime(input.newStartTime, slot.servicio.duracionMinutos);

  // The create endpoint always recomputes finalPrice from the service — a
  // manually-adjusted price would silently reset (review finding). Carry the
  // original price so the executor restores it on the new booking.
  const originalPrice = Number(b.finalPrice);
  const keepSameService = serviceId === b.serviceId;
  const restorePrice =
    keepSameService && Number.isFinite(originalPrice) && originalPrice > 0 && originalPrice !== slot.servicio.precio
      ? originalPrice
      : null;

  const advertencias = [
    '📱 Notifica DOS veces: email de cancelación de la cita original + SMS/email/Calendar de la nueva. Los avisos no se pueden deshacer.',
    ...(b.status === 'PENDING' ? ['La cita original es PENDIENTE — la nueva nace CONFIRMADA (creación del doctor).'] : []),
    'Si la creación de la nueva cita falla, la original ya quedó CANCELADA (paciente avisado) — recibirás el resultado para re-planear de inmediato (RSC-3).',
    ...(restorePrice !== null
      ? [`La cita original tiene precio ajustado ($${originalPrice} vs $${slot.servicio.precio} del servicio) — se re-aplicará a la nueva cita tras crearla.`]
      : []),
    ...(slot.dependencia ? [slot.dependencia] : []),
  ];

  const proposal = ctx.collector.add({
    type: 'reschedule_booking',
    titulo: `Reagendar ${b.patientName}: ${t.fecha} ${t.inicio} → ${input.newDate} ${input.newStartTime}`,
    detalle: [
      `${slot.servicio.nombre} (${slot.servicio.duracionMinutos} min) · nueva: ${input.newDate} ${input.newStartTime}–${endTime}`,
      'UNA acción: el sistema cancela la original y crea la nueva con los mismos datos del paciente',
    ],
    advertencias,
    params: {
      bookingId: b.id,
      ...(restorePrice !== null ? { restorePrice } : {}),
      create: {
        doctorId: ctx.doctorId,
        date: input.newDate,
        startTime: input.newStartTime,
        serviceId,
        patientName: b.patientName,
        // Non-nullable columns: always send strings (bitácora fila 21)
        patientEmail: contact.email ?? '',
        patientPhone: contact.phone ?? '',
        ...(contact.whatsapp ? { patientWhatsapp: contact.whatsapp } : {}),
        ...(b.notes ? { notes: b.notes } : {}),
        ...(b.appointmentMode ? { appointmentMode: b.appointmentMode } : {}),
        ...(b.isFirstTime !== null ? { isFirstTime: b.isFirstTime } : {}),
        ...(b.patientId ? { patientId: b.patientId } : {}),
        isRescheduled: true,
      },
    },
  });
  if (!proposal) return { error: CAP_ERROR };
  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    de: `${t.fecha} ${t.inicio}`,
    a: `${input.newDate} ${input.newStartTime}–${endTime}`,
    nota: 'RECUERDA al doctor que el paciente recibirá los dos avisos (cancelación + nueva).',
  };
}

/** Shared PENDING/terminal gate for complete_booking and no_show. */
function completionStatusGate(
  ctx: ProposalContext,
  b: BookingForProposal,
  accion: string
): { error: string } | { dependencia: string | null } {
  if (b.status === 'CONFIRMED') return { dependencia: null };
  if (b.status === 'PENDING') {
    if (ctx.collector.pendingConfirmedBookingIds().has(b.id)) {
      return {
        dependencia:
          'Depende del paso anterior que CONFIRMA esta cita — si esa confirmación falla o se rechaza, este paso fallará (transición inválida).',
      };
    }
    return {
      error: `La cita está PENDIENTE y no puede marcarse ${accion} directo (transición inválida). Propone propose_confirm_booking y luego este paso, EN ESE ORDEN, en el mismo plan — y avisa que confirmar notifica al paciente.`,
    };
  }
  return { error: TERMINAL_ERROR(b.status) };
}

// One source of truth: the same list the Flujo de Dinero UI uses.
const FORMAS_DE_PAGO_VALIDAS: string[] = FORMAS_DE_PAGO.map((f) => f.value);

async function proposeCompleteBooking(
  ctx: ProposalContext,
  input: { bookingId: string; formaDePago?: string; price?: number }
) {
  const b = await fetchBookingForProposal(ctx.doctorId, input.bookingId);
  if (!b) return { error: UNKNOWN_BOOKING_ERROR };
  const gate = completionStatusGate(ctx, b, 'COMPLETADA');
  if ('error' in gate) return { error: gate.error };

  // H2: a paid payment link may have ALREADY created this cita's income via webhook
  // (ledger_entries.booking_id is @unique). Completing then only needs the PATCH — a
  // second ledger POST would 409. No formaDePago needed either: the income exists.
  const existingLedger = await prisma.ledgerEntry.findUnique({
    where: { bookingId: b.id },
    select: { id: true, amount: true, origin: true, formaDePago: true },
  });
  if (existingLedger) {
    const montoTxt = `$${Number(existingLedger.amount)}`;
    const viaLink = existingLedger.origin === 'webhook_pago';
    const proposal = ctx.collector.add({
      type: 'complete_booking',
      titulo: `Completar cita ${bookingLabel(b)}`,
      detalle: [
        `${b.serviceName ?? 'Sin servicio'} · pasa a COMPLETADA`,
        `💰 El ingreso YA está registrado en Flujo de Dinero (${montoTxt}${viaLink ? ' · pagado con link de pago' : ''}) — no se crea otro`,
      ],
      advertencias: [
        'COMPLETADA es estado FINAL — no se puede revertir.',
        ...(gate.dependencia ? [gate.dependencia] : []),
      ],
      params: { bookingId: b.id, ledger: null },
    });
    if (!proposal) return { error: CAP_ERROR };
    return {
      propuestaId: proposal.id,
      orden: proposal.orden,
      cita: bookingLabel(b),
      ingreso: `ya registrado (${montoTxt}${viaLink ? ', pagado con link de pago' : ''})`,
      nota: 'El ingreso ya existía — solo se marcará COMPLETADA, sin duplicarlo. No hace falta preguntar la forma de pago.',
    };
  }

  if (!input.formaDePago || !FORMAS_DE_PAGO_VALIDAS.includes(input.formaDePago)) {
    return {
      error: `formaDePago ${input.formaDePago ? 'inválida' : 'requerida'} — pregunta al doctor cómo le pagaron: ${FORMAS_DE_PAGO_VALIDAS.join(', ')}.`,
    };
  }
  const price = input.price ?? Number(b.finalPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      error: 'La cita no tiene precio válido — pregunta al doctor el monto cobrado (el ingreso requiere un monto > 0).',
    };
  }

  // D4/G1: the ledger payload is built HERE (regla 0) — the executor sends it
  // verbatim after the PATCH. A raw PATCH alone would silently skip the income.
  const t = bookingTiming(b);
  const concept = b.serviceName ? `${b.serviceName} - ${b.patientName}` : `Consulta - ${b.patientName}`;
  const ledger = {
    entryType: 'ingreso',
    amount: price,
    concept,
    formaDePago: input.formaDePago,
    transactionDate: t.fecha ?? mxTodayKey(),
    paymentStatus: 'PAID',
    amountPaid: price,
    bookingId: b.id,
    origin: 'cita',
    serviceId: b.serviceId ?? null,
    serviceName: b.serviceName ?? null,
    area: AREA_INGRESOS_CONSULTA,
    subarea: b.serviceName ?? '',
    patientId: b.patientId ?? null,
    // `||` (not `??`) on purpose: an empty-string razonSocial must fall through
    // to patientName — same fallback as useBookings.completeBooking.
    counterpartyRfc: b.patient?.rfc || null,
    counterpartyName: b.patient?.razonSocial || b.patientName || null,
  };

  const proposal = ctx.collector.add({
    type: 'complete_booking',
    titulo: `Completar cita ${bookingLabel(b)}`,
    detalle: [
      `${b.serviceName ?? 'Sin servicio'} · pasa a COMPLETADA`,
      `💰 Ingreso: $${price} (${input.formaDePago}) → se registra en Flujo de Dinero`,
    ],
    advertencias: [
      'COMPLETADA es estado FINAL — no se puede revertir (el ingreso quedaría registrado).',
      ...(gate.dependencia ? [gate.dependencia] : []),
    ],
    params: { bookingId: b.id, ledger },
  });
  if (!proposal) return { error: CAP_ERROR };
  return {
    propuestaId: proposal.id,
    orden: proposal.orden,
    cita: bookingLabel(b),
    ingreso: `$${price} (${input.formaDePago})`,
    nota: 'La factura (CFDI) no se emite aquí — el doctor puede emitirla desde la tabla de citas.',
  };
}

async function proposeNoShow(ctx: ProposalContext, input: { bookingId: string }) {
  const b = await fetchBookingForProposal(ctx.doctorId, input.bookingId);
  if (!b) return { error: UNKNOWN_BOOKING_ERROR };
  const gate = completionStatusGate(ctx, b, 'NO ASISTIÓ');
  if ('error' in gate) return { error: gate.error };

  const proposal = ctx.collector.add({
    type: 'no_show',
    titulo: `Marcar NO ASISTIÓ: ${bookingLabel(b)}`,
    detalle: [`${b.serviceName ?? 'Sin servicio'} · no notifica al paciente · sin ingreso`],
    advertencias: [
      'NO ASISTIÓ es estado FINAL — no se puede revertir.',
      ...(gate.dependencia ? [gate.dependencia] : []),
    ],
    params: { bookingId: b.id, status: 'NO_SHOW' },
  });
  if (!proposal) return { error: CAP_ERROR };
  return { propuestaId: proposal.id, orden: proposal.orden, cita: bookingLabel(b) };
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
    case 'propose_create_booking':
      return proposeCreateBooking(ctx, input as any);
    case 'propose_confirm_booking':
      return proposeConfirmBooking(ctx, input as any);
    case 'propose_cancel_booking':
      return proposeCancelBooking(ctx, input as any);
    case 'propose_reschedule_booking':
      return proposeRescheduleBooking(ctx, input as any);
    case 'propose_complete_booking':
      return proposeCompleteBooking(ctx, input as any);
    case 'propose_no_show':
      return proposeNoShow(ctx, input as any);
    default:
      return null;
  }
}

export function isProposalTool(name: string): boolean {
  return PROPOSAL_TOOLS.some((t) => t.name === name);
}
