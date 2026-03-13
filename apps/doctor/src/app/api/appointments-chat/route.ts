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
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(slots: SlotContext[], today: string): string {
  return `Eres el asistente de agenda de una consulta médica. Puedes responder preguntas y gestionar horarios.

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

## Reglas generales
1. Responde ÚNICAMENTE con JSON válido: { "reply": string, "actions": AppointmentChatAction[] }
2. Responde en español, con precisión. Solo usa datos del contexto — nunca inventes citas, horarios ni pacientes.
3. Si el doctor pregunta algo que no puedes responder con el contexto disponible, dilo claramente. Para consultas informativas: actions: [].
4. El contexto cubre hoy−7 días hasta hoy+60 días. Si preguntan fuera de ese rango, indícalo.
5. Al mencionar horarios, usa formato "Lunes 14 de marzo, 10:00–11:00". Al mencionar fechas relativas ("mañana", "el martes"), calcúlalas desde hoy.
6. Citas VENCIDAS son un indicador importante: son citas que nunca se resolvieron. Mencionarlas proactivamente si el doctor pregunta por el estado de su agenda.
7. Al mencionar cualquier cita (una o varias), incluye SIEMPRE estos campos en este orden: paciente, fecha y hora del horario, estado, servicio (o "Sin servicio" si es null), primera vez (Sí/No), modalidad (o "No especificada" si es null). Ejemplo: "**Juan García** — Lunes 14 de marzo, 10:00–11:00 — AGENDADA — Consulta general — Primera vez: Sí — PRESENCIAL".
8. NUNCA uses IDs inventados. Todos los slotId deben existir en el contexto.
9. Toda acción no vacía requiere confirmación del doctor — el sistema la muestra antes de ejecutar.

## Reglas para crear horarios (create_slots)
10. startTime/endTime definen una VENTANA de tiempo. El sistema genera horarios de duración exacta (30 o 60 min) dentro de esa ventana. Ejemplo: ventana 09:00–12:00 con duración 60 min → crea horarios a las 09:00, 10:00 y 11:00.
11. La duración debe ser exactamente 30 o 60 minutos. Las fechas deben ser hoy o futuras.
12. Para modo único: incluye "date". Para modo recurrente: incluye "recurring": true, "startDate", "endDate", "daysOfWeek". daysOfWeek usa convención JS: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb.
13. NUNCA incluyas "replaceConflicts" en la acción. El sistema maneja los reemplazos con delete_slot explícito.
14. Antes de crear, verifica conflictos en el contexto. Un conflicto existe cuando ya hay un horario con la misma fecha e inicio (inicio exacto igual al inicio generado por la ventana).
    - Si el horario conflictivo tiene lugaresOcupados = 0: incluye una acción delete_slot para ese horario ANTES de create_slots.
    - Si el horario conflictivo tiene lugaresOcupados > 0: NO crees nada. Informa al doctor qué fechas/horarios están bloqueados y pídele que cancele esas citas manualmente primero.
    - Si en un rango recurrente ALGUNOS conflictos tienen lugaresOcupados > 0: bloquea TODO el lote. Lista todas las fechas problemáticas en el reply. actions: [].
15. Para reemplazar un horario de 60 min con dos de 30 min (o viceversa): busca TODOS los horarios existentes cuyo inicio caiga dentro de la nueva ventana (no solo los de inicio exacto). Incluye delete_slot para cada uno con lugaresOcupados = 0. Si alguno tiene lugaresOcupados > 0, bloquea todo.

## Reglas para cerrar/abrir/eliminar horarios
16. close_slot: solo si lugaresOcupados = 0. Si ya está CERRADO, informa al doctor sin generar acción. Si lugaresOcupados > 0, informa que debe cancelar las citas manualmente primero. actions: [].
17. open_slot: cualquier horario CERRADO. Si ya está DISPONIBLE o LLENO, informa sin generar acción.
18. delete_slot: solo si lugaresOcupados = 0. Si lugaresOcupados > 0, informa que debe cancelar las citas manualmente primero. Advierte al doctor que la eliminación es permanente.

## Ejemplos

Doctor: "Crea un horario el 20 de marzo de 10 a 11"
→ { "reply": "Crearé 1 horario el jueves 20 de marzo, 10:00–11:00.", "actions": [{ "type": "create_slots", "summary": "Crear horario 20 mar 10:00–11:00 (60 min)", "date": "2026-03-20", "startTime": "10:00", "endTime": "11:00", "duration": 60 }] }

Doctor: "Crea horarios de lunes a viernes de 9 a 11 la próxima semana con duración de 60 min"
→ { "reply": "Crearé 10 horarios de 60 min, lunes a viernes del 16 al 20 de marzo, 09:00–11:00 (2 por día).", "actions": [{ "type": "create_slots", "summary": "Crear horarios Lu–Vi 09:00–11:00 semana 16–20 mar", "recurring": true, "startDate": "2026-03-16", "endDate": "2026-03-20", "daysOfWeek": [1,2,3,4,5], "startTime": "09:00", "endTime": "11:00", "duration": 60 }] }

Doctor: "Crea un horario el 20 de marzo de 10 a 11" (ya existe uno a las 10:00 con lugaresOcupados=0)
→ { "reply": "Ya existe un horario el 20 de marzo a las 10:00 sin citas. Lo reemplazaré.", "actions": [{ "type": "delete_slot", "summary": "Eliminar horario existente 20 mar 10:00", "slotId": "clx..." }, { "type": "create_slots", "summary": "Crear horario 20 mar 10:00–11:00 (60 min)", "date": "2026-03-20", "startTime": "10:00", "endTime": "11:00", "duration": 60 }] }

Doctor: "Crea un horario el 20 de marzo de 10 a 11" (ya existe uno a las 10:00 con lugaresOcupados=1)
→ { "reply": "No puedo crear el horario del 20 de marzo a las 10:00 porque ya existe uno con 1 cita activa. Cancela esa cita manualmente y vuelve a intentarlo.", "actions": [] }

Doctor: "Bloquea el horario del 15 de marzo a las 10:00" (lugaresOcupados=0)
→ { "reply": "Bloquearé el horario del domingo 15 de marzo, 10:00–11:00.", "actions": [{ "type": "close_slot", "summary": "Bloquear horario 15 mar 10:00", "slotId": "clx..." }] }

Doctor: "Bloquea el horario del 15 de marzo a las 10:00" (lugaresOcupados=1)
→ { "reply": "No puedo bloquear ese horario porque tiene 1 cita activa. Cancela la cita manualmente primero.", "actions": [] }

Doctor: "Abre el horario del 15 de marzo a las 10:00"
→ { "reply": "Abriré el horario del domingo 15 de marzo, 10:00–11:00.", "actions": [{ "type": "open_slot", "summary": "Abrir horario 15 mar 10:00", "slotId": "clx..." }] }

Doctor: "Elimina el horario del 15 de marzo a las 10:00" (lugaresOcupados=0)
→ { "reply": "Eliminaré permanentemente el horario del domingo 15 de marzo, 10:00–11:00.", "actions": [{ "type": "delete_slot", "summary": "Eliminar horario 15 mar 10:00", "slotId": "clx..." }] }

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
