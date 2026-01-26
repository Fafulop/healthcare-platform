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
import OpenAI from 'openai';

import { getChatSystemPrompt } from '@/lib/voice-assistant/prompts';
import {
  type VoiceSessionType,
  type VoiceSessionContext,
  type VoiceStructuredData,
  type ChatRequest,
  EXTRACTABLE_FIELDS,
} from '@/types/voice-assistant';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const TEMPERATURE = 0.3; // Slightly creative for conversation, but still focused

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const { doctorId } = await requireDoctorAuth(request);

    // 2. Parse request body
    const body: ChatRequest = await request.json();
    const { sessionType, messages, currentData, context } = body;

    // 3. Validate session type
    const validSessionTypes: VoiceSessionType[] = ['NEW_PATIENT', 'NEW_ENCOUNTER', 'NEW_PRESCRIPTION', 'CREATE_APPOINTMENT_SLOTS', 'CREATE_LEDGER_ENTRY', 'CREATE_SALE', 'CREATE_PURCHASE'];
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

    // 5. Build system prompt with current data context and date
    const systemPrompt = getChatSystemPrompt(sessionType, currentData, new Date());

    // Log for debugging
    console.log('[Voice Chat] Request:', {
      sessionType,
      messagesCount: messages.length,
      hasCurrentData: !!currentData,
      currentDataFields: currentData ? Object.keys(currentData).filter(k => currentData[k] != null) : [],
      lastUserMessage: messages[messages.length - 1]?.content?.substring(0, 100)
    });

    // 6. Build messages for OpenAI
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // 7. Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: openaiMessages,
      response_format: { type: 'json_object' },
    });

    // 8. Extract response
    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHAT_FAILED',
            message: 'No se recibió respuesta del modelo',
          },
        },
        { status: 500 }
      );
    }

    // 9. Parse JSON response
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
    const fieldsExtracted = analyzeExtractedFields(parsed.structuredData, sessionType);

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
  sessionType: VoiceSessionType
): string[] {
  if (!data) return [];

  const allFields = EXTRACTABLE_FIELDS[sessionType];
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
