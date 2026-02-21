/**
 * POST /api/task-chat
 *
 * AI chat endpoint for the Task (Pendientes) form.
 * Receives conversation history + current form state + accumulated batch tasks,
 * returns field updates and task actions to apply directly to the form.
 *
 * Request:  { messages, currentFormData, accumulatedTasks }
 * Response: { success, data: { message, action, fieldUpdates?, taskActions? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { getChatProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai';
import { logTokenUsage } from '@/lib/ai/log-token-usage';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(
  accumulatedTasks: Record<string, any>[]
) {
  return `Eres un asistente de IA que ayuda a doctores a crear tareas pendientes.
El doctor describe tareas en lenguaje natural y tu las agregas a la lista de pendientes.

## CAMPOS DE CADA TAREA
- "title": Titulo de la tarea (obligatorio)
- "description": Descripcion detallada
- "dueDate": Fecha de vencimiento (formato YYYY-MM-DD)
- "startTime": Hora de inicio (formato HH:mm)
- "endTime": Hora de fin (formato HH:mm)
- "priority": Prioridad - valores: ALTA, MEDIA (default), BAJA
- "category": Categoria - valores: SEGUIMIENTO, ADMINISTRATIVO, LABORATORIO, RECETA, REFERENCIA, PERSONAL, OTRO (default)

## TAREAS ACUMULADAS EN LOTE (${accumulatedTasks.length})
${JSON.stringify(accumulatedTasks, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "taskActions": [
    { "type": "add", "task": { "title": "...", "dueDate": "...", ... } },
    { "type": "update", "index": 0, "updates": { "title": "..." } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "tasks": [ { "title": "...", ... }, ... ] }
  ]
}

## REGLAS
1. SIEMPRE usa taskActions con "add" para agregar tareas a la lista - ya sea 1 o muchas. NUNCA uses fieldUpdates.
2. Cada tarea mencionada por el doctor debe tener su propio "add" en taskActions
3. Si solo es una pregunta o conversacion sin datos de tareas, usa action="no_change" y taskActions vacio
4. Para modificar una tarea acumulada existente, usa "update" con el index correcto
5. Para eliminar una tarea acumulada, usa "remove" con el index correcto
6. Para reemplazar todas las tareas acumuladas, usa "replace_all"
7. Siempre responde en español profesional
8. Se conciso en tus respuestas - confirma las tareas agregadas o modificadas brevemente
9. Para fechas, usa formato "YYYY-MM-DD". Para horas, usa formato "HH:mm"
10. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
11. Usa la fecha de hoy como referencia para calcular "manana", "el viernes", etc.
12. FORMATO OBLIGATORIO: Cuando menciones tareas (agregadas, pendientes, o listadas), SIEMPRE usa bullet points. Ejemplo:
- **Titulo**: Revisar resultados
- **Fecha**: 2025-01-15
- **Prioridad**: ALTA`;
}

// -----------------------------------------------------------------------------
// Route handler
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const body = await request.json();
    const {
      messages,
      accumulatedTasks = [],
    } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      accumulatedTasks: Record<string, any>[];
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(accumulatedTasks);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // Few-shot example
      { role: 'user', content: 'Revisar resultados de laboratorio manana a las 10' },
      { role: 'assistant', content: JSON.stringify({
        message: 'He agregado el pendiente a la lista:\n\n- **Titulo**: Revisar resultados de laboratorio\n- **Categoria**: LABORATORIO\n- **Hora de inicio**: 10:00\n\n¿Deseas agregar mas pendientes o ya los creo?',
        action: 'update_fields',
        taskActions: [{ type: 'add', task: { title: 'Revisar resultados de laboratorio', category: 'LABORATORIO', startTime: '10:00' } }],
      }) },
      ...messages
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ];

    console.log('[Task Chat] Request:', {
      doctorId,
      messagesCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100),
    });

    const { content: responseText, usage } = await getChatProvider().chatCompletion(chatMessages, {
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      jsonMode: true,
    });
    logTokenUsage({
      doctorId,
      endpoint: 'task-chat',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let parsed: {
      message: string;
      action: string;
      fieldUpdates?: Record<string, any>;
      taskActions?: any[];
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Task Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[Task Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Field Updates: ${Object.keys(parsed.fieldUpdates || {}).length}, Task Actions: ${(parsed.taskActions || []).length}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fieldUpdates: parsed.fieldUpdates,
        taskActions: parsed.taskActions,
      },
    });
  } catch (error: any) {
    console.error('[Task Chat Error]', error);

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.' } },
        { status: 429 }
      );
    }

    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error de conexion. Verifique su internet e intente nuevamente.' } },
        { status: 503 }
      );
    }

    return handleApiError(error, 'POST /api/task-chat');
  }
}
