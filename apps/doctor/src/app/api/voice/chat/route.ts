/**
 * POST /api/voice/chat
 *
 * Conversational AI endpoint for the chat-based voice assistant.
 * Receives conversation history and returns AI response with structured data.
 *
 * Request: { sessionType, messages, currentData?, context? }
 * Response: { success: true, data: { message, structuredData, fieldsExtracted, isComplete } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@healthcare/database';
import { getChatProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai';

import { getChatSystemPrompt } from '@/lib/voice-assistant/prompts';
import {
  generateCustomTemplateSystemPrompt,
  getCustomTemplateFields,
} from '@/lib/voice-assistant/custom-template-prompts';
import {
  type VoiceSessionType,
  type VoiceSessionContext,
  type VoiceStructuredData,
  type ChatRequest,
  EXTRACTABLE_FIELDS,
} from '@/types/voice-assistant';
import type { FieldDefinition } from '@/types/custom-encounter';

// Configuration
const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.3; // Slightly creative for conversation, but still focused

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const { doctorId } = await requireDoctorAuth(request);

    // 2. Parse request body
    const body: ChatRequest & { templateId?: string } = await request.json();
    const { sessionType, messages, currentData, context, templateId } = body;

    // 3. Validate session type
    const validSessionTypes: VoiceSessionType[] = ['NEW_PATIENT', 'NEW_ENCOUNTER', 'NEW_PRESCRIPTION', 'CREATE_APPOINTMENT_SLOTS', 'CREATE_LEDGER_ENTRY', 'CREATE_SALE', 'CREATE_PURCHASE', 'NEW_TASK'];
    if (!validSessionTypes.includes(sessionType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: `Tipo de sesión inválido. Use: ${validSessionTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // 4. Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Se requiere al menos un mensaje',
          },
        },
        { status: 400 }
      );
    }

    // 5. Check if using template (custom or system)
    let template: any = null;
    let extractableFields: string[] = [];

    if (templateId && sessionType === 'NEW_ENCOUNTER') {
      // Fetch template (could be custom or system)
      template = await prisma.encounterTemplate.findFirst({
        where: {
          id: templateId,
          doctorId,
          isActive: true,
        },
      });

      if (!template) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: 'Plantilla no encontrada',
            },
          },
          { status: 404 }
        );
      }
    }

    // 6. Build system prompt with current data context and date
    let systemPrompt: string;

    if (template && template.isCustom && template.customFields) {
      // Use dynamic chat prompt for custom template
      const fields = template.customFields as FieldDefinition[];
      const basePrompt = generateCustomTemplateSystemPrompt(
        template.name,
        template.description,
        fields
      );

      // Add chat-specific instructions
      systemPrompt = `${basePrompt}

## CONVERSATIONAL MODE

You are now in CONVERSATIONAL mode. The doctor can refine and update the data through conversation.

### CURRENT DATA CONTEXT
${currentData ? `The following data has been extracted so far:\n\`\`\`json\n${JSON.stringify(currentData, null, 2)}\n\`\`\`` : 'No data extracted yet.'}

### YOUR RESPONSE FORMAT
Return a JSON object with this structure:
{
  "message": string,              // Your response to the doctor (in Spanish)
  "structuredData": object | null, // Updated structured data (merge with current data)
  "isComplete": boolean           // true if all required fields are filled
}

### CONVERSATIONAL RULES
1. **Be concise and helpful** - Keep responses brief and medical-professional
2. **Extract updates** - If the doctor mentions new information, add it to structuredData
3. **Clarify missing fields** - If required fields are empty, ask about them naturally
4. **Confirm completeness** - Set isComplete:true only when all required fields have values
5. **Natural Spanish** - Respond in professional Mexican Spanish medical tone

### CURRENT DATE
Today is ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current time: ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
`;

      extractableFields = getCustomTemplateFields(fields);
    } else {
      // Use standard chat prompt
      systemPrompt = getChatSystemPrompt(sessionType, currentData, new Date());
      extractableFields = EXTRACTABLE_FIELDS[sessionType];
    }

    // Log for debugging
    console.log('[Voice Chat] Request:', {
      sessionType,
      messagesCount: messages.length,
      hasCurrentData: !!currentData,
      currentDataFields: currentData ? Object.keys(currentData).filter(k => (currentData as Record<string, unknown>)[k] != null) : [],
      lastUserMessage: messages[messages.length - 1]?.content?.substring(0, 100)
    });

    // 6. Build messages for chat provider
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // 7. Call AI provider
    const responseText = await getChatProvider().chatCompletion(chatMessages, {
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      jsonMode: true,
    });

    // 8. Parse JSON response
    let parsed: {
      message: string;
      structuredData: VoiceStructuredData | null;
      isComplete: boolean;
    };

    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Voice Chat] JSON parse error:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHAT_FAILED',
            message: 'Error al procesar la respuesta del modelo',
          },
        },
        { status: 500 }
      );
    }

    // 10. Apply context (pre-fill doctor info for prescriptions)
    if (sessionType === 'NEW_PRESCRIPTION' && context && parsed.structuredData) {
      const prescriptionData = parsed.structuredData as any;
      if (!prescriptionData.doctorFullName && context.doctorName) {
        prescriptionData.doctorFullName = context.doctorName;
      }
      if (!prescriptionData.doctorLicense && context.doctorLicense) {
        prescriptionData.doctorLicense = context.doctorLicense;
      }
    }

    // 11. Calculate extracted fields
    const fieldsExtracted = analyzeExtractedFields(parsed.structuredData, extractableFields);

    // 12. Log for audit
    console.log(
      `[Voice Chat] Doctor: ${doctorId}, Type: ${sessionType}, ` +
        `Extracted: ${fieldsExtracted.length} fields, Complete: ${parsed.isComplete}`
    );

    // 13. Return success response
    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        structuredData: parsed.structuredData,
        fieldsExtracted,
        isComplete: parsed.isComplete,
      },
    });
  } catch (error: any) {
    console.error('[Voice Chat Error]', error);

    // Handle OpenAI-specific errors
    if (error?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.',
          },
        },
        { status: 429 }
      );
    }

    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHAT_FAILED',
            message: 'Error de conexión. Verifique su internet e intente nuevamente.',
          },
        },
        { status: 503 }
      );
    }

    return handleApiError(error, 'POST /api/voice/chat');
  }
}

/**
 * Analyze which fields were extracted from structured data
 */
function analyzeExtractedFields(
  data: VoiceStructuredData | null,
  allFields: string[]
): string[] {
  if (!data) return [];

  const extracted: string[] = [];

  for (const field of allFields) {
    const value = (data as any)[field];
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    ) {
      extracted.push(field);
    }
  }

  return extracted;
}
