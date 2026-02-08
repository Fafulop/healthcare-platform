/**
 * POST /api/form-builder-chat
 *
 * AI chat endpoint for the FormBuilder.
 * Receives conversation history + current canvas state,
 * returns structured actions to manipulate fields/metadata.
 *
 * Request:  { messages, currentFields, currentMetadata }
 * Response: { success, data: { message, action, fields?, fieldUpdates?, removeFieldNames?, metadataUpdates? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import OpenAI from 'openai';
import type { FieldDefinition } from '@/types/custom-encounter';

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
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(
  currentFields: FieldDefinition[],
  currentMetadata: { name: string; description: string }
) {
  return `Eres un asistente de IA que ayuda a doctores a construir plantillas de encuentros medicos.
El doctor describe lo que necesita en lenguaje natural y tu generas definiciones de campos (FieldDefinition[]).

## TIPOS DE CAMPO SOPORTADOS (solo estos 9)
text, textarea, number, date, time, dropdown, radio, checkbox, file

## FORMATO FieldDefinition
Cada campo DEBE tener estas propiedades:
- name: string (camelCase, unico, ej: "tipoLesion")
- label: string (etiqueta en español, ej: "Tipo de Lesión")
- labelEs: string (mismo que label)
- type: uno de los 9 tipos soportados
- required: boolean
- order: number (0-indexed)
- section: string (nombre de seccion en español, ej: "Datos Generales")
- width: "full" | "half" | "third"

Propiedades opcionales segun el tipo:
- options: string[] (para dropdown, radio)
- min, max, step: number (para number)
- placeholder: string (para text, textarea)
- helpText: string
- defaultValue: any

## ESTADO ACTUAL DEL CANVAS
Nombre de plantilla: "${currentMetadata.name || '(sin nombre)'}"
Descripcion: "${currentMetadata.description || '(sin descripcion)'}"
Campos actuales (${currentFields.length}):
${currentFields.length > 0 ? JSON.stringify(currentFields, null, 2) : '(vacio - no hay campos)'}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "set_fields" | "update_fields" | "remove_fields" | "set_metadata" | "no_change",
  "fields": [...],           // Solo para action=set_fields: array COMPLETO de FieldDefinition (reemplaza todo)
  "fieldUpdates": [...],     // Solo para action=update_fields: array de { name: string, updates: Partial<FieldDefinition> }
  "removeFieldNames": [...], // Solo para action=remove_fields: array de nombres (name) a eliminar
  "metadataUpdates": {...}   // Solo para action=set_metadata: { name?, description? }
}

## REGLAS
1. Cuando el doctor pide una plantilla nueva o describe campos desde cero, usa action=set_fields con TODOS los campos
2. Cuando pide agregar campos a los existentes, usa action=set_fields incluyendo los campos existentes MAS los nuevos
3. Cuando pide modificar un campo especifico, usa action=update_fields
4. Cuando pide eliminar campos, usa action=remove_fields
5. Cuando pide cambiar nombre o descripcion de la plantilla, usa action=set_metadata
6. Si solo es una pregunta o conversacion, usa action=no_change
7. NO incluyas la propiedad "id" en los campos - el sistema la genera automaticamente
8. Asegura que los "name" sean unicos y en camelCase
9. Las etiquetas (label, labelEs) deben estar en español
10. Usa secciones logicas para organizar los campos
11. Asigna widths sensatos: campos cortos (fecha, hora, numero) como "half" o "third", textos largos como "full"
12. Siempre responde en español profesional medico`;
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
      currentFields = [],
      currentMetadata = { name: '', description: '' },
    } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      currentFields: FieldDefinition[];
      currentMetadata: { name: string; description: string };
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(currentFields, currentMetadata);

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    console.log('[FormBuilder Chat] Request:', {
      doctorId,
      messagesCount: messages.length,
      currentFieldsCount: currentFields.length,
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
        { success: false, error: { code: 'CHAT_FAILED', message: 'No se recibió respuesta del modelo' } },
        { status: 500 }
      );
    }

    let parsed: {
      message: string;
      action: string;
      fields?: any[];
      fieldUpdates?: { name: string; updates: Record<string, any> }[];
      removeFieldNames?: string[];
      metadataUpdates?: { name?: string; description?: string };
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[FormBuilder Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[FormBuilder Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Fields: ${parsed.fields?.length ?? 0}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fields: parsed.fields,
        fieldUpdates: parsed.fieldUpdates,
        removeFieldNames: parsed.removeFieldNames,
        metadataUpdates: parsed.metadataUpdates,
      },
    });
  } catch (error: any) {
    console.error('[FormBuilder Chat Error]', error);

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

    return handleApiError(error, 'POST /api/form-builder-chat');
  }
}
