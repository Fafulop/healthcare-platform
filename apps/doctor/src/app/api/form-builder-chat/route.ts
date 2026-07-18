/**
 * POST /api/form-builder-chat
 *
 * AI chat endpoint for the FormBuilder, on Anthropic (claude-sonnet-5) with
 * native tool_use as the protocol: the model manipulates the canvas through
 * four schema-enforced tools instead of a free-form JSON blob (the old
 * gpt-4o-mini jsonMode protocol let the model flatten the update shape and
 * "apply" nothing while claiming success).
 *
 * Request:  { messages, currentFields, currentMetadata }
 * Response: { success, data: { message, actions: Action[] } }
 * Action:   { type: 'set_fields', fields }        — full replacement
 *         | { type: 'update_fields', patches: [{ name, changes }] }
 *         | { type: 'remove_fields', names }
 *         | { type: 'set_metadata', metadata: { name?, description? } }
 *
 * A turn can carry SEVERAL actions (e.g. set_metadata + set_fields when
 * creating a template from scratch). Invalid actions are dropped server-side
 * with a visible note in the message — never forwarded to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import { validateCustomFields } from '@/lib/custom-template-validation';
import { callClaude, type AnthropicTool, type AnthropicMessage } from '@/lib/agenda-agent/anthropic';
import type { FieldDefinition } from '@/types/custom-encounter';

const MODEL =
  process.env.FORM_BUILDER_CHAT_MODEL ||
  process.env.AGENDA_AGENT_MODEL ||
  'claude-sonnet-5';
const MAX_TOKENS = 8192; // a full template can be a large fields array

// -----------------------------------------------------------------------------
// Tools (the protocol — nested shapes are schema-enforced, not prompt-suggested)
// -----------------------------------------------------------------------------

const FIELD_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', description: 'camelCase, único, ej: "tipoLesion"' },
    label: { type: 'string', description: 'Etiqueta en español' },
    labelEs: { type: 'string', description: 'Igual que label' },
    type: {
      type: 'string',
      enum: ['text', 'textarea', 'number', 'date', 'time', 'dropdown', 'radio', 'checkbox', 'file'],
    },
    required: { type: 'boolean' },
    order: { type: 'number', description: '0-indexed' },
    section: { type: 'string', description: 'Sección en español, ej: "Datos Generales"' },
    width: { type: 'string', enum: ['full', 'half', 'third'] },
    options: { type: 'array', items: { type: 'string' }, description: 'Solo dropdown/radio' },
    min: { type: 'number' },
    max: { type: 'number' },
    step: { type: 'number' },
    placeholder: { type: 'string' },
    helpText: { type: 'string' },
    defaultValue: {},
  },
  required: ['name', 'label', 'labelEs', 'type', 'required', 'order', 'section', 'width'],
  additionalProperties: false,
};

/** The only field props the model may set — unknown keys are stripped so
 * invented props never reach the saved customFields JSON. */
const FIELD_KEYS = Object.keys(FIELD_SCHEMA.properties);

function stripUnknownKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FIELD_KEYS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

const TOOLS: AnthropicTool[] = [
  {
    name: 'set_fields',
    description:
      'Reemplaza TODOS los campos del canvas con el array dado. Úsalo para plantillas nuevas y para AGREGAR campos (incluye los existentes MÁS los nuevos). NO incluyas "id".',
    input_schema: {
      type: 'object',
      properties: { fields: { type: 'array', items: FIELD_SCHEMA } },
      required: ['fields'],
    },
  },
  {
    name: 'update_fields',
    description:
      'Modifica campos existentes. Cada patch identifica el campo por su "name" actual y da SOLO las propiedades que cambian en "changes".',
    input_schema: {
      type: 'object',
      properties: {
        patches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'El "name" ACTUAL del campo a modificar (del estado del canvas)' },
              changes: {
                type: 'object',
                description: 'Solo las propiedades que cambian (label, required, options, etc.). Nunca "id".',
                properties: FIELD_SCHEMA.properties,
                additionalProperties: false,
              },
            },
            required: ['name', 'changes'],
            additionalProperties: false,
          },
        },
      },
      required: ['patches'],
    },
  },
  {
    name: 'remove_fields',
    description: 'Elimina campos existentes por su "name".',
    input_schema: {
      type: 'object',
      properties: { names: { type: 'array', items: { type: 'string' } } },
      required: ['names'],
    },
  },
  {
    name: 'set_metadata',
    description: 'Cambia el nombre y/o la descripción de la plantilla.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
  },
];

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------

function buildSystemPrompt(
  currentFields: FieldDefinition[],
  currentMetadata: { name: string; description: string }
) {
  return `Eres un asistente de IA que ayuda a doctores a construir plantillas de formularios médicos (consultas, formularios pre-cita y recetas).
El doctor describe lo que necesita en lenguaje natural y tú manipulas el canvas con las herramientas disponibles.

## ESTADO ACTUAL DEL CANVAS (la única verdad — ignora versiones anteriores en la conversación)
Nombre de plantilla: "${currentMetadata.name || '(sin nombre)'}"
Descripción: "${currentMetadata.description || '(sin descripción)'}"
Campos actuales (${currentFields.length}):
${currentFields.length > 0 ? JSON.stringify(currentFields.map(({ id: _id, ...f }) => f), null, 2) : '(vacío - no hay campos)'}

## REGLAS
1. Plantilla nueva o campos desde cero → set_fields con TODOS los campos (y set_metadata si el doctor dio nombre/tema).
2. Agregar campos → set_fields con los existentes MÁS los nuevos (set_fields REEMPLAZA todo).
3. Modificar campos específicos → update_fields, identificándolos por su "name" EXACTO del estado actual.
4. Eliminar campos → remove_fields con los "name" exactos.
5. Cambiar nombre/descripción de la plantilla → set_metadata.
6. Pregunta o conversación sin cambios → responde solo con texto, sin herramientas.
7. Los "name" son camelCase y únicos; las etiquetas en español; secciones lógicas; widths sensatos (fecha/hora/número como "half" o "third", textos largos "full").
8. Puedes usar varias herramientas en un mismo turno cuando la petición lo amerite.
9. Acompaña SIEMPRE tus acciones con una respuesta breve en español profesional describiendo lo que hiciste.`;
}

// -----------------------------------------------------------------------------
// Server-side action validation (invalid actions are dropped, with a note)
// -----------------------------------------------------------------------------

type Action =
  | { type: 'set_fields'; fields: Omit<FieldDefinition, 'id'>[] }
  | { type: 'update_fields'; patches: { name: string; changes: Record<string, unknown> }[] }
  | { type: 'remove_fields'; names: string[] }
  | { type: 'set_metadata'; metadata: { name?: string; description?: string } };

function toValidatedAction(toolName: string, input: Record<string, unknown>): { action?: Action; error?: string } {
  switch (toolName) {
    case 'set_fields': {
      const rawFields = input.fields;
      if (!Array.isArray(rawFields)) return { error: 'set_fields sin array de campos' };
      const fields = rawFields.map((f) => stripUnknownKeys(f));
      const validationError = validateCustomFields(fields, { requireId: false });
      if (validationError) return { error: `set_fields inválido: ${validationError}` };
      return { action: { type: 'set_fields', fields: fields as Omit<FieldDefinition, 'id'>[] } };
    }
    case 'update_fields': {
      const rawPatches = input.patches;
      if (!Array.isArray(rawPatches) || rawPatches.length === 0) return { error: 'update_fields sin patches' };
      const patches: { name: string; changes: Record<string, unknown> }[] = [];
      for (const p of rawPatches) {
        if (!p || typeof p.name !== 'string' || !p.name) return { error: 'update_fields: patch sin "name"' };
        if (!p.changes || typeof p.changes !== 'object' || Array.isArray(p.changes)) {
          return { error: `update_fields: patch de "${p.name}" sin "changes"` };
        }
        // id is never model-controlled; unknown props never reach the canvas
        const changes = stripUnknownKeys(p.changes as Record<string, unknown>);
        if (Object.keys(changes).length === 0) {
          return { error: `update_fields: patch de "${p.name}" sin cambios válidos` };
        }
        patches.push({ name: p.name, changes });
      }
      return { action: { type: 'update_fields', patches } };
    }
    case 'remove_fields': {
      const names = input.names;
      if (!Array.isArray(names) || names.length === 0 || names.some((n) => typeof n !== 'string')) {
        return { error: 'remove_fields sin nombres válidos' };
      }
      return { action: { type: 'remove_fields', names } };
    }
    case 'set_metadata': {
      const metadata: { name?: string; description?: string } = {};
      if (typeof input.name === 'string' && input.name) metadata.name = input.name;
      if (typeof input.description === 'string') metadata.description = input.description;
      if (Object.keys(metadata).length === 0) return { error: 'set_metadata vacío' };
      return { action: { type: 'set_metadata', metadata } };
    }
    default:
      return { error: `herramienta desconocida: ${toolName}` };
  }
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

    const anthropicMessages: AnthropicMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log('[FormBuilder Chat] Request:', {
      doctorId,
      messagesCount: messages.length,
      currentFieldsCount: currentFields.length,
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100),
    });

    const response = await callClaude({
      model: MODEL,
      system: buildSystemPrompt(currentFields, currentMetadata),
      messages: anthropicMessages,
      tools: TOOLS,
      maxTokens: MAX_TOKENS,
      temperature: 0.2, // form generation should be near-deterministic (parity with the old endpoint)
      timeoutMs: 90_000,
    });

    logTokenUsage({
      doctorId,
      endpoint: 'form-builder-chat',
      model: MODEL,
      provider: 'anthropic',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    });

    // Collect text + validated actions from the content blocks
    const textParts: string[] = [];
    const actions: Action[] = [];
    const droppedNotes: string[] = [];

    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        textParts.push(block.text.trim());
      } else if (block.type === 'tool_use') {
        const { action, error } = toValidatedAction(block.name, block.input);
        if (action) {
          actions.push(action);
        } else if (error) {
          console.error('[FormBuilder Chat] Dropped invalid action:', error);
          droppedNotes.push(error);
        }
      }
    }

    let message = textParts.join('\n\n');
    if (!message) {
      // tool_use turns can come with no prose — never show an empty bubble
      message = actions.length > 0 ? 'Listo — apliqué los cambios en el canvas.' : 'No entendí la petición, ¿puedes reformularla?';
    }
    if (droppedNotes.length > 0) {
      message += `\n\n⚠️ Una acción no se pudo aplicar (${droppedNotes.join('; ')}). Intenta pedirlo de nuevo.`;
    }

    console.log(`[FormBuilder Chat] Doctor: ${doctorId}, Actions: ${actions.map((a) => a.type).join(',') || 'none'}`);

    return NextResponse.json({
      success: true,
      data: { message, actions },
    });
  } catch (error: any) {
    console.error('[FormBuilder Chat Error]', error);

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.' } },
        { status: 429 }
      );
    }

    if (error?.name === 'TimeoutError' || error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error de conexión. Verifique su internet e intente nuevamente.' } },
        { status: 503 }
      );
    }

    return handleApiError(error, 'POST /api/form-builder-chat');
  }
}
