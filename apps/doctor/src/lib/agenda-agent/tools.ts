/**
 * Agenda agent — read-only tool layer (PR 1).
 *
 * Every executor receives the session's doctorId from the route (never from model
 * output) and returns a JSON-serializable result. Write tools arrive in PR 2/3 as
 * proposals — nothing here mutates.
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from './anthropic';
import { dateKeyToUtcDate, utcDateToKey, isVencida, mxTodayKey, addMinutesToTime } from './dates';

// Server-side fetch needs an absolute URL — same fallback as the other
// server→server callers in apps/doctor (medical-records/tasks, calendar).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export interface ToolContext {
  doctorId: string;
  doctorSlug: string;
  /** Short-lived Bearer for apps/api AUTHENTICATED endpoints (F2a: catálogos
   * SAT). Minted per-turn from the doctor's own session (api-token.ts) — same
   * trust boundary as the client's authFetch. Absent in contexts without a
   * session secret; tools that need it must degrade with a clear error. */
  apiToken?: string | null;
}

// -----------------------------------------------------------------------------
// Tool definitions (Anthropic schema)
// -----------------------------------------------------------------------------

export const AGENT_TOOLS: AnthropicTool[] = [
  {
    name: 'get_day_schedule',
    description:
      'Agenda completa de un día: ventanas de disponibilidad (rangos), bloqueos y citas (incluye citas de horarios legacy). Úsala para "¿cómo está mi día X?".',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha "YYYY-MM-DD"' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_bookings',
    description:
      'Lista citas del doctor con filtros. Una cita VENCIDA es una PENDIENTE **o AGENDADA (CONFIRMED)** cuya hora ya pasó sin resolverse — para buscarlas usa `vencidas: true` (el servidor aplica la definición completa; NO intentes reconstruirla filtrando por status tú mismo).',
    input_schema: {
      type: 'object',
      properties: {
        vencidas: {
          type: 'boolean',
          description: 'true = solo citas vencidas (PENDING/CONFIRMED con hora ya pasada). Ignora "status".',
        },
        status: {
          type: 'string',
          enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
          description: 'Filtrar por estado (opcional)',
        },
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD" (opcional)' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (opcional)' },
        patientName: { type: 'string', description: 'Búsqueda parcial por nombre de paciente (opcional)' },
      },
    },
  },
  {
    name: 'get_availability',
    description:
      'Horarios DISPONIBLES para agendar, calculados por el mismo motor que usa la página pública (rangos menos citas, bloqueos y buffer). SIEMPRE usa esta tool para responder "¿cuándo tengo espacio?" — nunca lo calcules tú. Si no pasas serviceId, el servidor calcula con el servicio más corto del doctor (y lo indica en "nota").',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD"' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (opcional, default +30 días)' },
        serviceId: {
          type: 'string',
          description: 'ID del servicio (de get_services). Opcional — sin él se usa el servicio más corto como referencia.',
        },
      },
      required: ['startDate'],
    },
  },
  {
    name: 'get_ranges',
    description:
      'Lista rangos de disponibilidad y bloqueos (con sus ids) en un periodo de fechas — úsala para operaciones sobre VARIOS días (ej. "elimina los rangos de octubre") en vez de consultar día por día con get_day_schedule. Máx ~120 días por llamada.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD"' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD"' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'get_services',
    description: 'Catálogo de servicios del doctor (id, nombre, duración en minutos, precio). TODOS son agendables por el doctor; "visibleEnPaginaPublica" solo indica si el servicio se muestra a pacientes en la página pública de agendado.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_locations',
    description: 'Consultorios del doctor (nombre, dirección, default).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_booking_detail',
    description: 'Detalle completo de una cita por su id (contacto, notas, servicio, modalidad, links).',
    input_schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID de la cita (de get_bookings/get_day_schedule)' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'find_patient',
    description:
      'Busca pacientes del doctor por nombre (expediente + citas pasadas). Devuelve datos de contacto y patientId. Úsala antes de hablar de un paciente específico.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nombre (parcial) del paciente' },
      },
      required: ['query'],
    },
  },
];

// -----------------------------------------------------------------------------
// Executors
// -----------------------------------------------------------------------------

const BOOKING_SELECT = {
  id: true,
  patientName: true,
  status: true,
  serviceName: true,
  isFirstTime: true,
  appointmentMode: true,
  finalPrice: true,
  extendedBlockMinutes: true,
  date: true,
  startTime: true,
  endTime: true,
  slot: { select: { date: true, startTime: true, endTime: true } },
} as const;

function mapBooking(b: {
  id: string;
  patientName: string;
  status: string;
  serviceName: string | null;
  isFirstTime: boolean | null;
  appointmentMode: string | null;
  finalPrice: unknown;
  extendedBlockMinutes: number | null;
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  slot: { date: Date; startTime: string; endTime: string } | null;
}) {
  const date = b.slot?.date ?? b.date;
  const startTime = b.slot?.startTime ?? b.startTime;
  const endTime = b.slot?.endTime ?? b.endTime;
  const fecha = date ? utcDateToKey(date) : null;
  // Extended block: extendedBlockMinutes counts from the START of the cita
  // (availability-calculator: blocked end = max(end, start + ext)). Compute the
  // real occupied end server-side (regla 0) so the model never does time math.
  // Only PENDING/CONFIRMED actually occupy — same filter as the availability
  // engine (range-availability); a cancelled/no-show extension blocks nothing.
  const ext =
    b.status === 'PENDING' || b.status === 'CONFIRMED' ? (b.extendedBlockMinutes ?? 0) : 0;
  const ocupadoHasta =
    ext > 0 && startTime && endTime
      ? [endTime, addMinutesToTime(startTime, ext)].sort().pop()!
      : null;
  return {
    id: b.id,
    paciente: b.patientName,
    estado: b.status,
    fecha,
    inicio: startTime,
    fin: endTime,
    ...(ocupadoHasta && ocupadoHasta > endTime!
      ? { bloqueExtendidoMinutos: ext, ocupadoHasta }
      : {}),
    servicio: b.serviceName ?? null,
    precio: Number(b.finalPrice),
    primeraVez: b.isFirstTime ?? false,
    modalidad: b.appointmentMode ?? null,
    vencida: fecha && endTime ? isVencida(fecha, endTime, b.status) : false,
  };
}

/** Chronological sort on the RESOLVED date/time (slot-based bookings have date null on the row). */
function sortByFecha<T extends { fecha: string | null; inicio: string | null }>(
  citas: T[],
  direction: 'asc' | 'desc'
): T[] {
  const key = (c: T) => `${c.fecha ?? '0000-00-00'} ${c.inicio ?? '00:00'}`;
  return [...citas].sort((a, b) =>
    direction === 'asc' ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))
  );
}

async function getDaySchedule(ctx: ToolContext, input: { date: string }) {
  const date = dateKeyToUtcDate(input.date);

  const [ranges, blocked, bookings] = await Promise.all([
    prisma.availabilityRange.findMany({
      where: { doctorId: ctx.doctorId, date },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        intervalMinutes: true,
        location: { select: { name: true } },
      },
    }),
    prisma.blockedTime.findMany({
      where: { doctorId: ctx.doctorId, date },
      orderBy: { startTime: 'asc' },
      select: { id: true, startTime: true, endTime: true, reason: true },
    }),
    prisma.booking.findMany({
      where: {
        doctorId: ctx.doctorId,
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
        OR: [{ slotId: null, date }, { slot: { date } }],
      },
      select: BOOKING_SELECT,
    }),
  ]);

  return {
    fecha: input.date,
    rangosDisponibilidad: ranges.map((r) => ({
      id: r.id,
      inicio: r.startTime,
      fin: r.endTime,
      intervaloMinutos: r.intervalMinutes,
      consultorio: r.location?.name ?? null,
    })),
    bloqueos: blocked.map((b) => ({ id: b.id, inicio: b.startTime, fin: b.endTime, motivo: b.reason ?? null })),
    citas: bookings.map(mapBooking).sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '')),
  };
}

async function getBookings(
  ctx: ToolContext,
  input: {
    vencidas?: boolean;
    status?: string;
    startDate?: string;
    endDate?: string;
    patientName?: string;
  }
) {
  // Vencidas mode: the full definition lives HERE (status PENDING **or** CONFIRMED
  // with end time in the past), so the model can't get it wrong by guessing filters.
  // The time comparison needs MX-local "now" vs string times, so we fetch candidates
  // (active bookings up to today) and filter in JS with isVencida.
  if (input.vencidas) {
    const today = dateKeyToUtcDate(mxTodayKey());
    const candidates = await prisma.booking.findMany({
      where: {
        doctorId: ctx.doctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        ...(input.patientName
          ? { patientName: { contains: input.patientName, mode: 'insensitive' } }
          : {}),
        OR: [{ slotId: null, date: { lte: today } }, { slot: { date: { lte: today } } }],
      },
      select: BOOKING_SELECT,
      orderBy: { date: 'desc' },
      take: 200,
    });

    const vencidas = sortByFecha(
      candidates.map(mapBooking).filter((c) => c.vencida),
      'desc'
    ).slice(0, 50);
    return { totalEncontradas: vencidas.length, mostradas: vencidas.length, citas: vencidas };
  }

  const dateFilter =
    input.startDate || input.endDate
      ? {
          ...(input.startDate ? { gte: dateKeyToUtcDate(input.startDate) } : {}),
          ...(input.endDate ? { lte: dateKeyToUtcDate(input.endDate) } : {}),
        }
      : undefined;

  const where = {
    doctorId: ctx.doctorId,
    ...(input.status ? { status: input.status as any } : {}),
    ...(input.patientName
      ? { patientName: { contains: input.patientName, mode: 'insensitive' as const } }
      : {}),
    ...(dateFilter
      ? { OR: [{ slotId: null, date: dateFilter }, { slot: { date: dateFilter } }] }
      : {}),
  };

  // Real total via count (the list is capped) so "¿cuántas...?" answers are exact.
  const [bookings, totalEncontradas] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: BOOKING_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.booking.count({ where }),
  ]);

  // Chronological order on the resolved date (SQL can't: legacy bookings carry
  // date on the slot). Future-looking queries read best ascending (next first).
  const direction = input.startDate && input.startDate >= mxTodayKey() ? 'asc' : 'desc';
  const citas = sortByFecha(bookings.map(mapBooking), direction).slice(0, 50);

  return { totalEncontradas, mostradas: citas.length, citas };
}

async function getAvailability(
  ctx: ToolContext,
  input: { startDate: string; endDate?: string; serviceId?: string }
) {
  // Without a serviceId the upstream endpoint only returns "dates that have
  // ranges" — NOT real availability (bookings/blocks aren't subtracted). To keep
  // the answer honest, default to the doctor's SHORTEST service: if the shortest
  // service fits nowhere, nothing fits. No isBookingActive filter — the flag is
  // public-page visibility, and internally every service is bookable.
  let serviceId = input.serviceId;
  let nota: string | null = null;
  if (!serviceId) {
    const shortest = await prisma.service.findFirst({
      where: { doctorId: ctx.doctorId },
      orderBy: { durationMinutes: 'asc' },
      select: { id: true, serviceName: true, durationMinutes: true },
    });
    if (shortest) {
      serviceId = shortest.id;
      nota = `Sin servicio especificado: calculado con el más corto (${shortest.serviceName}, ${shortest.durationMinutes} min). Para servicios más largos puede haber menos espacios.`;
    }
  }

  // Reuse the SAME calculator the public page uses, via the public endpoint —
  // the agent must never derive availability on its own. skipCutoff: the 1-hour
  // lead-time filter is for public patients; the doctor can book inside the hour.
  const params = new URLSearchParams({ startDate: input.startDate, skipCutoff: '1' });
  if (input.endDate) params.set('endDate', input.endDate);
  if (serviceId) params.set('serviceId', serviceId);

  const res = await fetch(
    `${API_URL}/api/doctors/${ctx.doctorSlug}/range-availability?${params.toString()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) {
    return { error: `No se pudo calcular disponibilidad (HTTP ${res.status})` };
  }
  const data = await res.json();
  return {
    nota,
    bufferMinutos: data.bufferMinutes ?? 0,
    servicio: data.service ?? null,
    fechasDisponibles: data.availableDates ?? [],
    horarios: data.timeSlots ?? {},
  };
}

async function getRanges(ctx: ToolContext, input: { startDate: string; endDate: string }) {
  if (!input.startDate || !input.endDate || input.endDate < input.startDate) {
    return { error: 'Se requieren startDate y endDate válidos (endDate >= startDate).' };
  }
  const start = dateKeyToUtcDate(input.startDate);
  const end = dateKeyToUtcDate(input.endDate);
  // Bound the span (~120 days) so one call can't dump a year of rows
  if (end.getTime() - start.getTime() > 120 * 24 * 3600 * 1000) {
    return { error: 'Periodo demasiado largo (máx ~120 días) — divide la consulta.' };
  }

  const dateFilter = { gte: start, lte: end };
  const [ranges, blocked] = await Promise.all([
    prisma.availabilityRange.findMany({
      where: { doctorId: ctx.doctorId, date: dateFilter },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, date: true, startTime: true, endTime: true, intervalMinutes: true },
    }),
    prisma.blockedTime.findMany({
      where: { doctorId: ctx.doctorId, date: dateFilter },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, date: true, startTime: true, endTime: true, reason: true },
    }),
  ]);

  // Totals FIRST: if the 8KB tool-result truncation cuts the arrays, the model
  // still sees the real counts and can detect the list is incomplete (E2 pattern).
  return {
    totalRangos: ranges.length,
    totalBloqueos: blocked.length,
    rangos: ranges.map((r) => ({
      id: r.id,
      fecha: utcDateToKey(r.date),
      inicio: r.startTime,
      fin: r.endTime,
      intervaloMinutos: r.intervalMinutes,
    })),
    bloqueos: blocked.map((b) => ({
      id: b.id,
      fecha: utcDateToKey(b.date),
      inicio: b.startTime,
      fin: b.endTime,
      motivo: b.reason ?? null,
    })),
  };
}

async function getServices(ctx: ToolContext) {
  const services = await prisma.service.findMany({
    where: { doctorId: ctx.doctorId },
    select: {
      id: true,
      serviceName: true,
      durationMinutes: true,
      price: true,
      isBookingActive: true,
    },
    orderBy: { serviceName: 'asc' },
  });
  return {
    // isBookingActive = visibility on the PUBLIC booking page only; every
    // service is bookable internally (doctor UI and agent alike).
    servicios: services.map((s) => ({
      id: s.id,
      nombre: s.serviceName,
      duracionMinutos: s.durationMinutes,
      precio: Number(s.price),
      visibleEnPaginaPublica: s.isBookingActive,
    })),
  };
}

async function getLocations(ctx: ToolContext) {
  const locations = await prisma.clinicLocation.findMany({
    where: { doctorId: ctx.doctorId },
    orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }],
    select: { id: true, name: true, address: true, isDefault: true },
  });
  return { consultorios: locations };
}

async function getBookingDetail(ctx: ToolContext, input: { bookingId: string }) {
  const b = await prisma.booking.findFirst({
    where: { id: input.bookingId, doctorId: ctx.doctorId },
    select: {
      ...BOOKING_SELECT,
      patientEmail: true,
      patientPhone: true,
      patientWhatsapp: true,
      notes: true,
      finalPrice: true,
      confirmationCode: true,
      meetLink: true,
      patientId: true,
      createdAt: true,
      confirmedAt: true,
      cancelledAt: true,
    },
  });
  if (!b) return { error: 'Cita no encontrada' };
  return {
    ...mapBooking(b),
    email: b.patientEmail,
    telefono: b.patientPhone,
    whatsapp: b.patientWhatsapp ?? null,
    notas: b.notes ?? null,
    precio: Number(b.finalPrice),
    codigoConfirmacion: b.confirmationCode,
    meetLink: b.meetLink ?? null,
    expedienteVinculado: Boolean(b.patientId),
    patientId: b.patientId ?? null,
  };
}

/** Fold accents + case: "José" → "jose". Postgres `contains` is case- but NOT accent-insensitive. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function findPatient(ctx: ToolContext, input: { query: string }) {
  const q = fold(input.query.trim());

  // Accent-insensitive search requires JS folding: fetch the doctor's patients
  // (bounded) and recent booking names, then match on folded text — "Jose"
  // finds "José" and vice versa.
  const [patients, recentBookings] = await Promise.all([
    prisma.patient.findMany({
      where: { doctorId: ctx.doctorId },
      take: 300,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        lastVisitDate: true,
      },
    }),
    prisma.booking.findMany({
      where: { doctorId: ctx.doctorId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: BOOKING_SELECT,
    }),
  ]);

  const matchedPatients = patients
    .filter((p) => fold(`${p.firstName} ${p.lastName}`).includes(q))
    .slice(0, 10);
  const matchedBookings = recentBookings
    .filter((b) => fold(b.patientName).includes(q))
    .slice(0, 10);

  return {
    expedientes: matchedPatients.map((p) => ({
      patientId: p.id,
      nombre: `${p.firstName} ${p.lastName}`,
      email: p.email ?? null,
      telefono: p.phone ?? null,
      ultimaVisita: p.lastVisitDate ? utcDateToKey(p.lastVisitDate) : null,
    })),
    citasPrevias: sortByFecha(matchedBookings.map(mapBooking), 'desc'),
  };
}

// -----------------------------------------------------------------------------
// Dispatcher
// -----------------------------------------------------------------------------

export async function executeTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_day_schedule':
      return getDaySchedule(ctx, input as any);
    case 'get_bookings':
      return getBookings(ctx, input as any);
    case 'get_availability':
      return getAvailability(ctx, input as any);
    case 'get_ranges':
      return getRanges(ctx, input as any);
    case 'get_services':
      return getServices(ctx);
    case 'get_locations':
      return getLocations(ctx);
    case 'get_booking_detail':
      return getBookingDetail(ctx, input as any);
    case 'find_patient':
      return findPatient(ctx, input as any);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}
