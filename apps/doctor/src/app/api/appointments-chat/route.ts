/**
 * POST /api/appointments-chat
 *
 * AI chat endpoint for the Appointments page.
 * Fetches slots + bookings context from Prisma (today−7 to today+60),
 * calls gpt-4o with jsonMode, and returns { reply, actions[] }.
 *
 * No mutations — all writes are executed client-side by useAppointmentsChat hook.
 *
 * Request:  { message: string, conversationHistory: { role, content }[] }
 * Response: { success: true, data: { reply: string, actions: AppointmentChatAction[] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { prisma } from '@healthcare/database';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface BookingContext {
  id: string;
  paciente: string;
  estado: string;
  vencida: boolean;
  servicio: string | null;
  primeraVez: boolean;
  modalidad: string | null;
}

interface SlotContext {
  id: string;
  fecha: string;
  inicio: string;
  fin: string;
  duracion: number;
  estado: 'DISPONIBLE' | 'LLENO' | 'CERRADO';
  lugaresOcupados: number;
  lugaresTotal: number;
  citas: BookingContext[];
}

// -----------------------------------------------------------------------------
// Context fetch
// -----------------------------------------------------------------------------

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING:    'PENDIENTE',
  CONFIRMED:  'AGENDADA',
  COMPLETED:  'COMPLETADA',
  NO_SHOW:    'NO_ASISTIÓ',
  CANCELLED:  'CANCELADA',
};

function slotEstado(isOpen: boolean, current: number, max: number): 'DISPONIBLE' | 'LLENO' | 'CERRADO' {
  if (!isOpen) return 'CERRADO';
  if (current >= max) return 'LLENO';
  return 'DISPONIBLE';
}

function isVencida(slotDate: string, endTime: string, status: string, now: Date): boolean {
  if (status !== 'PENDING' && status !== 'CONFIRMED') return false;
  // Compare as Mexico City local time strings (sv-SE locale → "YYYY-MM-DD HH:MM:SS")
  // Avoids constructing a Date from a naive string which would be server-local (UTC on Railway)
  const nowMx = now.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
  const slotEndStr = `${slotDate} ${endTime}:00`;
  return slotEndStr < nowMx;
}

async function fetchContext(doctorId: string, now: Date): Promise<SlotContext[]> {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 7);
  windowStart.setUTCHours(0, 0, 0, 0);

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 60);

  const slots = await prisma.appointmentSlot.findMany({
    where: {
      doctorId,
      date: { gte: windowStart, lte: windowEnd },
    },
    include: {
      bookings: {
        select: {
          id: true,
          patientName: true,
          status: true,
          serviceName: true,
          isFirstTime: true,
          appointmentMode: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return slots.map((slot) => {
    const fecha = slot.date.toISOString().split('T')[0];
    return {
      id: slot.id,
      fecha,
      inicio: slot.startTime,
      fin: slot.endTime,
      duracion: slot.duration,
      estado: slotEstado(slot.isOpen, slot.currentBookings, slot.maxBookings),
      lugaresOcupados: slot.currentBookings,
      lugaresTotal: slot.maxBookings,
      citas: slot.bookings.map((b) => ({
        id: b.id,
        paciente: b.patientName,
        estado: BOOKING_STATUS_LABEL[b.status] ?? b.status,
        vencida: isVencida(fecha, slot.endTime, b.status, now),
        servicio: b.serviceName ?? null,
        primeraVez: b.isFirstTime ?? false,
        modalidad: b.appointmentMode ?? null,
      })),
    };
  });
}

// -----------------------------------------------------------------------------
// System prompt (query-only phase)
// -----------------------------------------------------------------------------

function buildSystemPrompt(slots: SlotContext[], today: string): string {
  return `Eres el asistente de agenda de una consulta médica. Respondes preguntas del doctor sobre sus horarios y citas.

Hoy es ${today} (zona horaria: America/Mexico_City).

## Estructura de datos

Cada **horario** (slot) tiene:
- id, fecha (YYYY-MM-DD), inicio/fin (HH:MM), duracion (minutos)
- estado: DISPONIBLE (abierto y con lugar), LLENO (abierto pero sin lugar), CERRADO (bloqueado)
- lugaresOcupados / lugaresTotal
- citas[]: lista de reservas en ese horario

Cada **cita** (booking) dentro de un horario tiene:
- id, paciente (nombre), estado, vencida (bool), servicio, primeraVez, modalidad
- estado puede ser: PENDIENTE, AGENDADA, COMPLETADA, NO_ASISTIÓ, CANCELADA
- vencida: true significa que la cita era PENDIENTE o AGENDADA pero ya pasó la hora de fin del horario sin resolverse

## Reglas
1. Responde ÚNICAMENTE con JSON válido: { "reply": string, "actions": [] }
2. "actions" SIEMPRE es [] — eres de solo lectura por ahora.
3. Responde en español, con precisión. Solo usa datos del contexto — nunca inventes citas, horarios ni pacientes.
4. Si el doctor pregunta algo que no puedes responder con el contexto disponible, dilo claramente.
5. El contexto cubre hoy−7 días hasta hoy+60 días. Si preguntan fuera de ese rango, indícalo.
6. Al mencionar horarios, usa formato "Lunes 14 de marzo, 10:00–11:00". Al mencionar fechas relativas ("mañana", "el martes"), calcúlalas desde hoy.
7. Citas VENCIDAS son un indicador importante: son citas que nunca se resolvieron. Mencionarlas proactivamente si el doctor pregunta por el estado de su agenda.

## Contexto de agenda (hoy−7 a hoy+60)
${JSON.stringify(slots, null, 2)}`.trim();
}

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const body = await request.json();
    const { message, conversationHistory = [] } = body as {
      message: string;
      conversationHistory: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere un mensaje' } },
        { status: 400 }
      );
    }

    const now = new Date();
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
    const slots = await fetchContext(doctorId, now);
    const systemPrompt = buildSystemPrompt(slots, today);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message },
    ];

    console.log('[Appointments Chat] Request:', {
      doctorId,
      historyLength: conversationHistory.length,
      slotsInContext: slots.length,
      message: message.substring(0, 100),
    });

    const { content: responseText, usage } = await getChatProvider().chatCompletion(chatMessages, {
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      jsonMode: true,
    });

    logTokenUsage({
      doctorId,
      endpoint: 'appointments-chat',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let parsed: { reply: string; actions: any[] };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Appointments Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    const reply = typeof parsed.reply === 'string' ? parsed.reply : 'Sin respuesta';
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    console.log(`[Appointments Chat] Doctor: ${doctorId}, Actions: ${actions.length}, Reply: ${reply.substring(0, 80)}`);

    return NextResponse.json({
      success: true,
      data: { reply, actions },
    });
  } catch (error: any) {
    console.error('[Appointments Chat Error]', error);

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.' } },
        { status: 429 }
      );
    }

    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error de conexión. Verifique su internet e intente nuevamente.' } },
        { status: 503 }
      );
    }

    return handleApiError(error, 'POST /api/appointments-chat');
  }
}
