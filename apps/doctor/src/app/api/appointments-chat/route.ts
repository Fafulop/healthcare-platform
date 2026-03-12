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

interface SlotContext {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  isOpen: boolean;
  currentBookings: number;
  maxBookings: number;
  bookings: {
    id: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    status: string;
    serviceName: string | null;
    serviceId: string | null;
  }[];
}

// -----------------------------------------------------------------------------
// Context fetch
// -----------------------------------------------------------------------------

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
        where: { status: { notIn: ['CANCELLED'] } },
        select: {
          id: true,
          patientName: true,
          patientEmail: true,
          patientPhone: true,
          status: true,
          serviceName: true,
          serviceId: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return slots.map((slot) => ({
    id: slot.id,
    date: slot.date.toISOString().split('T')[0],
    startTime: slot.startTime,
    endTime: slot.endTime,
    duration: slot.duration,
    isOpen: slot.isOpen,
    currentBookings: slot.currentBookings,
    maxBookings: slot.maxBookings,
    bookings: slot.bookings,
  }));
}

// -----------------------------------------------------------------------------
// System prompt sections (edit each section independently)
// -----------------------------------------------------------------------------

const RESPONSE_RULES = `
## Reglas
1. Devuelve ÚNICAMENTE JSON válido con la estructura: { "reply": string, "actions": ActionType[] }
2. "reply" es la respuesta conversacional mostrada al doctor (en español).
3. "actions" es vacío para consultas informativas o de solo lectura.
4. NUNCA inventes IDs de horarios o reservas — usa solo IDs del contexto anterior.
5. Para create_slots: omite el campo "date" si usas recurrencia (usa startDate/endDate/daysOfWeek).
6. Codificación de daysOfWeek: Lunes=0, Martes=1, Miércoles=2, Jueves=3, Viernes=4, Sábado=5, Domingo=6.
7. La duración debe ser 30 o 60 (minutos). No incluyas basePrice — siempre se inyecta como 0.
8. Para reschedule_booking: proporciona bookingId + nueva fecha/hora. El sistema cancela y reagenda automáticamente.
9. Si el doctor pregunta algo ambiguo, haz UNA pregunta de aclaración en "reply" y devuelve actions: [].
10. Para operaciones masivas (bulk_close, bulk_open, bulk_delete): reúne todos los IDs de horarios que coincidan del contexto.
11. maxBookings por defecto es 1 si no se especifica.`.trim();

const DEPENDENCY_RULES = `
## Reglas de dependencia — el orden es aplicado por el sistema; las violaciones serán rechazadas
12. ANTES de close_slot o delete_slot en un horario con reservas activas en el contexto:
    incluye un cancel_booking para cada reserva activa de ese horario, colocado ANTES de la acción de cierre/eliminación.
13. ANTES de bulk_close o bulk_delete: inspecciona cada horario en slotIds.
    Para cualquier horario con reservas activas, agrega acciones cancel_booking individuales antes de la acción masiva.
14. Si cancelas una reserva Y reagendas al paciente en el mismo horario en el mismo lote:
    el cancel_booking DEBE aparecer antes del book_patient.
15. Al crear horarios E inmediatamente agendar un paciente en uno de los nuevos horarios:
    usa instant booking (omite slotId). Nunca hagas referencia a un ID de horario que no existe aún en el contexto.
16. Antes de proponer un reagendamiento a una hora específica, verifica esa hora en el contexto.
    Si ya existe un horario lleno, indícalo en "reply" y pide al doctor que elija otra hora. Devuelve actions: [].
17. Para create_slots que conflictúen con horarios existentes en el contexto:
    solo establece replaceConflicts: true si el doctor pidió explícitamente reemplazar los horarios existentes.
    De lo contrario, reporta el conflicto en "reply" y devuelve actions: [].`.trim();

const FEW_SHOT_EXAMPLES = `
## Ejemplos

### Consulta informativa (sin acciones)
Doctor: "¿Qué horarios tengo disponibles el 25 de marzo?"
Respuesta: { "reply": "El 25 de marzo tienes 3 horarios abiertos: 09:00–10:00, 10:00–11:00 y 15:00–16:00. Los tres están sin reservas.", "actions": [] }

### Crear horario único
Doctor: "Abre un horario el 20 de marzo de 9 a 10"
Respuesta: { "reply": "Creé un horario el 20 de marzo de 09:00 a 10:00.", "actions": [{ "type": "create_slots", "summary": "Crear horario 20 Mar 09:00–10:00", "date": "YYYY-MM-DD", "startTime": "09:00", "endTime": "10:00", "duration": 60 }] }

### Crear horarios recurrentes
Doctor: "Crea horarios de lunes a viernes de 8 a 9 la próxima semana"
Respuesta: { "reply": "Crearé 5 horarios de 08:00 a 09:00 de lunes a viernes.", "actions": [{ "type": "create_slots", "summary": "Lu–Vi 08:00–09:00 semana del 16 Mar", "recurring": true, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "daysOfWeek": [0,1,2,3,4], "startTime": "08:00", "endTime": "09:00", "duration": 60 }] }

### Agendar paciente
Doctor: "Agenda a Carlos López mañana a las 10, dura 30 min, tel 5551234567, carlos@email.com"
Respuesta: { "reply": "Agendé a Carlos López mañana a las 10:00 por 30 minutos.", "actions": [{ "type": "book_patient", "summary": "Agendar Carlos López 10:00", "date": "YYYY-MM-DD", "startTime": "10:00", "duration": 30, "patientName": "Carlos López", "patientEmail": "carlos@email.com", "patientPhone": "5551234567" }] }

### Reagendar cita
Doctor: "Cambia la cita de Ana Pérez del martes a las 11 al jueves a las 9"
Respuesta: { "reply": "Reagendé la cita de Ana Pérez del martes 11:00 al jueves 09:00.", "actions": [{ "type": "reschedule_booking", "summary": "Reagendar Ana Pérez → Jue 09:00", "bookingId": "clx...", "newDate": "YYYY-MM-DD", "newStartTime": "09:00", "newDuration": 60, "patientName": "Ana Pérez", "patientEmail": "ana@email.com", "patientPhone": "5559876543" }] }

### Cancelar reserva
Doctor: "Cancela la cita de María García"
Respuesta: { "reply": "Cancelé la cita de María García (10:00 del 18 de marzo).", "actions": [{ "type": "cancel_booking", "summary": "Cancelar cita de María García", "bookingId": "clx..." }] }

### Cerrar horarios masivamente
Doctor: "Cierra todos los horarios de la semana del 23 al 27 de marzo"
Respuesta: { "reply": "Cerraré 10 horarios de esa semana.", "actions": [{ "type": "bulk_close", "summary": "Cerrar horarios 23–27 Mar", "slotIds": ["clx1","clx2"] }] }`.trim();

function buildSystemPrompt(slots: SlotContext[], today: string): string {
  return [
    `Eres el asistente de IA de citas para una consulta médica.`,
    `Hoy es ${today} (America/Mexico_City).`,
    `\n## Horarios disponibles en esta ventana (hoy−7 a hoy+60)`,
    JSON.stringify(slots, null, 2),
    RESPONSE_RULES,
    DEPENDENCY_RULES,
    FEW_SHOT_EXAMPLES,
  ].join('\n');
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
    const today = now.toISOString().split('T')[0];
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
