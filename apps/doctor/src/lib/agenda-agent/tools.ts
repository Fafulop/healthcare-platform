/**
 * Agenda agent — read-only tool layer (PR 1).
 *
 * Every executor receives the session's doctorId from the route (never from model
 * output) and returns a JSON-serializable result. Write tools arrive in PR 2/3 as
 * proposals — nothing here mutates.
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from './anthropic';
import { dateKeyToUtcDate, utcDateToKey, isVencida } from './dates';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ToolContext {
  doctorId: string;
  doctorSlug: string;
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
      'Lista citas del doctor con filtros. Incluye el flag "vencida" (cita PENDIENTE/AGENDADA cuya hora ya pasó sin resolverse). Úsala para buscar citas por estado, rango de fechas o nombre de paciente.',
    input_schema: {
      type: 'object',
      properties: {
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
      'Horarios DISPONIBLES para agendar, calculados por el mismo motor que usa la página pública (rangos menos citas, bloqueos y buffer). Con serviceId devuelve horarios exactos; sin serviceId solo fechas con disponibilidad. SIEMPRE usa esta tool para responder "¿cuándo tengo espacio?" — nunca lo calcules tú.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde "YYYY-MM-DD"' },
        endDate: { type: 'string', description: 'Hasta "YYYY-MM-DD" (opcional, default +30 días)' },
        serviceId: { type: 'string', description: 'ID del servicio (de get_services). Opcional.' },
      },
      required: ['startDate'],
    },
  },
  {
    name: 'get_services',
    description: 'Catálogo de servicios del doctor (id, nombre, duración en minutos, precio, activo para agenda).',
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
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  slot: { date: Date; startTime: string; endTime: string } | null;
}) {
  const date = b.slot?.date ?? b.date;
  const startTime = b.slot?.startTime ?? b.startTime;
  const endTime = b.slot?.endTime ?? b.endTime;
  const fecha = date ? utcDateToKey(date) : null;
  return {
    id: b.id,
    paciente: b.patientName,
    estado: b.status,
    fecha,
    inicio: startTime,
    fin: endTime,
    servicio: b.serviceName ?? null,
    primeraVez: b.isFirstTime ?? false,
    modalidad: b.appointmentMode ?? null,
    vencida: fecha && endTime ? isVencida(fecha, endTime, b.status) : false,
  };
}

async function getDaySchedule(ctx: ToolContext, input: { date: string }) {
  const date = dateKeyToUtcDate(input.date);

  const [ranges, blocked, bookings] = await Promise.all([
    prisma.availabilityRange.findMany({
      where: { doctorId: ctx.doctorId, date },
      orderBy: { startTime: 'asc' },
      select: {
        startTime: true,
        endTime: true,
        intervalMinutes: true,
        location: { select: { name: true } },
      },
    }),
    prisma.blockedTime.findMany({
      where: { doctorId: ctx.doctorId, date },
      orderBy: { startTime: 'asc' },
      select: { startTime: true, endTime: true, reason: true },
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
      inicio: r.startTime,
      fin: r.endTime,
      intervaloMinutos: r.intervalMinutes,
      consultorio: r.location?.name ?? null,
    })),
    bloqueos: blocked.map((b) => ({ inicio: b.startTime, fin: b.endTime, motivo: b.reason ?? null })),
    citas: bookings.map(mapBooking).sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '')),
  };
}

async function getBookings(
  ctx: ToolContext,
  input: { status?: string; startDate?: string; endDate?: string; patientName?: string }
) {
  const dateFilter =
    input.startDate || input.endDate
      ? {
          ...(input.startDate ? { gte: dateKeyToUtcDate(input.startDate) } : {}),
          ...(input.endDate ? { lte: dateKeyToUtcDate(input.endDate) } : {}),
        }
      : undefined;

  const bookings = await prisma.booking.findMany({
    where: {
      doctorId: ctx.doctorId,
      ...(input.status ? { status: input.status as any } : {}),
      ...(input.patientName
        ? { patientName: { contains: input.patientName, mode: 'insensitive' } }
        : {}),
      ...(dateFilter
        ? { OR: [{ slotId: null, date: dateFilter }, { slot: { date: dateFilter } }] }
        : {}),
    },
    select: BOOKING_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const citas = bookings.map(mapBooking);
  return { total: citas.length, truncadoA50: bookings.length === 50, citas };
}

async function getAvailability(
  ctx: ToolContext,
  input: { startDate: string; endDate?: string; serviceId?: string }
) {
  // Reuse the SAME calculator the public page uses, via the public endpoint —
  // the agent must never derive availability on its own.
  const params = new URLSearchParams({ startDate: input.startDate });
  if (input.endDate) params.set('endDate', input.endDate);
  if (input.serviceId) params.set('serviceId', input.serviceId);

  const res = await fetch(
    `${API_URL}/api/doctors/${ctx.doctorSlug}/range-availability?${params.toString()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) {
    return { error: `No se pudo calcular disponibilidad (HTTP ${res.status})` };
  }
  const data = await res.json();
  return {
    bufferMinutos: data.bufferMinutes ?? 0,
    servicio: data.service ?? null,
    fechasDisponibles: data.availableDates ?? [],
    horarios: data.timeSlots ?? {},
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
    servicios: services.map((s) => ({
      id: s.id,
      nombre: s.serviceName,
      duracionMinutos: s.durationMinutes,
      precio: Number(s.price),
      activoParaAgenda: s.isBookingActive,
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

async function findPatient(ctx: ToolContext, input: { query: string }) {
  const q = input.query.trim();
  const [patients, pastBookings] = await Promise.all([
    prisma.patient.findMany({
      where: {
        doctorId: ctx.doctorId,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
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
      where: {
        doctorId: ctx.doctorId,
        patientName: { contains: q, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: BOOKING_SELECT,
    }),
  ]);

  return {
    expedientes: patients.map((p) => ({
      patientId: p.id,
      nombre: `${p.firstName} ${p.lastName}`,
      email: p.email ?? null,
      telefono: p.phone ?? null,
      ultimaVisita: p.lastVisitDate ? utcDateToKey(p.lastVisitDate) : null,
    })),
    citasPrevias: pastBookings.map(mapBooking),
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
