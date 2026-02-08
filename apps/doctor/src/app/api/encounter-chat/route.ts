/**
 * POST /api/encounter-chat
 *
 * AI chat endpoint for the Encounter form.
 * Receives conversation history + current form state,
 * returns field updates to apply directly to the form.
 *
 * Request:  { messages, currentFormData, templateInfo }
 * Response: { success, data: { message, action, fieldUpdates? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import OpenAI from 'openai';
import { ENCOUNTER_FIELDS } from '@/constants/encounter-fields';

// Lazy-initialize OpenAI client to avoid build-time crash
let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TemplateInfo {
  type: 'standard' | 'custom';
  name?: string;
  /** For standard templates: which fields are visible */
  fieldVisibility?: Record<string, boolean>;
  /** For custom templates: field definitions */
  customFields?: {
    name: string;
    label: string;
    type: string;
    options?: string[];
  }[];
}

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(
  currentFormData: Record<string, any>,
  templateInfo: TemplateInfo
) {
  let fieldsDescription: string;

  if (templateInfo.type === 'custom' && templateInfo.customFields) {
    // Custom template: list custom fields
    fieldsDescription = templateInfo.customFields
      .map((f) => {
        let desc = `- "${f.name}" (${f.type}): ${f.label}`;
        if (f.options?.length) desc += ` [opciones: ${f.options.join(', ')}]`;
        return desc;
      })
      .join('\n');
  } else {
    // Standard template: list EncounterFormData fields filtered by visibility
    const visibility = templateInfo.fieldVisibility || {};
    const visibleFields = ENCOUNTER_FIELDS.filter((f) => {
      // Always-visible fields (canHide === false) are always included
      if (!f.canHide) return true;
      // Check visibility map
      return visibility[f.key] !== false;
    });

    fieldsDescription = visibleFields
      .map((f) => `- "${f.key}": ${f.labelEs} (${f.label})`)
      .join('\n');
  }

  return `Eres un asistente de IA que ayuda a doctores a llenar formularios de consultas medicas.
El doctor describe informacion del paciente en lenguaje natural y tu extraes los datos para actualizar los campos del formulario.

## CAMPOS DISPONIBLES DEL FORMULARIO
${fieldsDescription}

## ESTADO ACTUAL DEL FORMULARIO
${JSON.stringify(currentFormData, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { "nombreCampo": "valor", ... }
}

## REGLAS
1. Cuando el doctor menciona datos del paciente, extrae los valores y usa action="update_fields" con fieldUpdates
2. Solo incluye en fieldUpdates los campos que realmente se mencionaron o se pueden inferir
3. Si solo es una pregunta o conversacion sin datos para el formulario, usa action="no_change"
4. Para signos vitales numericos (frecuencia cardiaca, temperatura, peso, altura, saturacion), usa numeros sin unidades
5. Para presion arterial, usa formato "120/80"
6. Para fechas, usa formato "YYYY-MM-DD"
7. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
8. Siempre responde en español profesional medico
9. Se conciso en tus respuestas - confirma los campos actualizados brevemente
10. Para campos de texto largo (notas clinicas, SOAP, motivo de consulta), puedes agregar al contenido existente o reemplazarlo segun el contexto
11. Los campos de tipo "customData" para plantillas personalizadas se actualizan con el nombre exacto del campo definido en la plantilla`;
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
      templateInfo = { type: 'standard' },
    } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      currentFormData: Record<string, any>;
      templateInfo: TemplateInfo;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(currentFormData, templateInfo);

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ];

    console.log('[Encounter Chat] Request:', {
      doctorId,
      messagesCount: messages.length,
      templateType: templateInfo.type,
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100),
    });

    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: openaiMessages,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'No se recibio respuesta del modelo' } },
        { status: 500 }
      );
    }

    let parsed: {
      message: string;
      action: string;
      fieldUpdates?: Record<string, any>;
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Encounter Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[Encounter Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Updates: ${Object.keys(parsed.fieldUpdates || {}).length}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fieldUpdates: parsed.fieldUpdates,
      },
    });
  } catch (error: any) {
    console.error('[Encounter Chat Error]', error);

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

    return handleApiError(error, 'POST /api/encounter-chat');
  }
}
