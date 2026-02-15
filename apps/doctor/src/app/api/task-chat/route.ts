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

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(
  currentFormData: Record<string, any>,
  accumulatedTasks: Record<string, any>[]
) {
  return `Eres un asistente de IA que ayuda a doctores a crear tareas pendientes.
El doctor describe tareas en lenguaje natural y tu extraes los datos para actualizar los campos del formulario o crear multiples tareas.

## CAMPOS DEL FORMULARIO (tarea unica)
- "title": Titulo de la tarea (obligatorio)
- "description": Descripcion detallada
- "dueDate": Fecha de vencimiento (formato YYYY-MM-DD)
- "startTime": Hora de inicio (formato HH:mm)
- "endTime": Hora de fin (formato HH:mm)
- "priority": Prioridad - valores: ALTA, MEDIA (default), BAJA
- "category": Categoria - valores: SEGUIMIENTO, ADMINISTRATIVO, LABORATORIO, RECETA, REFERENCIA, PERSONAL, OTRO (default)

## ESTADO ACTUAL DEL FORMULARIO
${JSON.stringify({
  title: currentFormData.title,
  description: currentFormData.description,
  dueDate: currentFormData.dueDate,
  startTime: currentFormData.startTime,
  endTime: currentFormData.endTime,
  priority: currentFormData.priority,
  category: currentFormData.category,
}, null, 2)}

## TAREAS ACUMULADAS EN LOTE (${accumulatedTasks.length})
${JSON.stringify(accumulatedTasks, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { "title": "valor", ... },
  "taskActions": [
    { "type": "add", "task": { "title": "...", "dueDate": "...", ... } },
    { "type": "update", "index": 0, "updates": { "title": "..." } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "tasks": [ { "title": "...", ... }, ... ] }
  ]
}

## REGLAS
1. Cuando el doctor menciona UNA sola tarea, usa fieldUpdates para actualizar el formulario unico
2. Solo incluye en fieldUpdates los campos que realmente se mencionaron
3. Cuando el doctor menciona MULTIPLES tareas (ej: "crea 3 tareas: ..."), usa taskActions con "add" para cada una
4. taskActions gestiona la lista de tareas en lote (acumuladas)
5. Si solo es una pregunta o conversacion sin datos, usa action="no_change" con fieldUpdates vacio y taskActions vacio
6. Para modificar una tarea acumulada existente, usa "update" con el index correcto
7. Para eliminar una tarea acumulada, usa "remove" con el index correcto
8. Para reemplazar todas las tareas acumuladas, usa "replace_all"
9. Siempre responde en español profesional
10. Se conciso en tus respuestas - confirma los campos y tareas actualizados brevemente
11. Para fechas, usa formato "YYYY-MM-DD". Para horas, usa formato "HH:mm"
12. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
13. Usa la fecha de hoy como referencia para calcular "manana", "el viernes", etc.
14. FORMATO OBLIGATORIO: Cuando menciones campos o tareas (actualizados, pendientes, o listados), SIEMPRE usa bullet points. Ejemplo:
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
      currentFormData = {},
      accumulatedTasks = [],
    } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      currentFormData: Record<string, any>;
      accumulatedTasks: Record<string, any>[];
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(currentFormData, accumulatedTasks);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // Few-shot example
      { role: 'user', content: 'Revisar resultados de laboratorio manana a las 10' },
      { role: 'assistant', content: JSON.stringify({
        message: 'He actualizado el formulario:\n\n- **Titulo**: Revisar resultados de laboratorio\n- **Categoria**: LABORATORIO\n- **Hora de inicio**: 10:00\n\n¿Desea agregar mas detalles o crear la tarea?',
        action: 'update_fields',
        fieldUpdates: { title: 'Revisar resultados de laboratorio', category: 'LABORATORIO', startTime: '10:00' },
        taskActions: [],
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

    const responseText = await getChatProvider().chatCompletion(chatMessages, {
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      jsonMode: true,
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
