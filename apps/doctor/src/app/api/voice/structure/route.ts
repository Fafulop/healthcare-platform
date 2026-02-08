/**
 * POST /api/voice/structure
 *
 * Converts transcript to structured form data using LLM.
 *
 * Request: { transcript, transcriptId, sessionType, context? }
 * Response: { success: true, data: { sessionId, structuredData, fieldsExtracted, fieldsEmpty, confidence } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@healthcare/database';
import { getChatProvider } from '@/lib/ai';

import { getSystemPrompt, getUserPrompt } from '@/lib/voice-assistant/prompts';
import {
  generateCustomTemplateSystemPrompt,
  getCustomTemplateFields,
} from '@/lib/voice-assistant/custom-template-prompts';
import {
  type VoiceSessionType,
  type VoiceSessionContext,
  type VoiceStructuredData,
  EXTRACTABLE_FIELDS,
} from '@/types/voice-assistant';
import type { FieldDefinition } from '@/types/custom-encounter';

// Configuration
const MODEL = 'gpt-4o'; // Use GPT-4o for best accuracy with medical content
const MAX_TOKENS = 4096;
const TEMPERATURE = 0; // Deterministic output

// Request body type
interface StructureRequestBody {
  transcript: string;
  transcriptId: string;
  sessionType: VoiceSessionType;
  context?: VoiceSessionContext;
  templateId?: string; // For custom encounter templates
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const { doctorId } = await requireDoctorAuth(request);

    // 2. Parse request body
    const body: StructureRequestBody = await request.json();
    const { transcript, transcriptId, sessionType, context, templateId } = body;

    // 3. Validate required fields
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TRANSCRIPT',
            message: 'Transcripción inválida o vacía',
          },
        },
        { status: 400 }
      );
    }

    if (!transcriptId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TRANSCRIPT',
            message: 'ID de transcripción requerido',
          },
        },
        { status: 400 }
      );
    }

    // 4. Validate session type
    const validSessionTypes: VoiceSessionType[] = ['NEW_PATIENT', 'NEW_ENCOUNTER', 'NEW_PRESCRIPTION', 'CREATE_APPOINTMENT_SLOTS', 'CREATE_LEDGER_ENTRY', 'CREATE_SALE', 'CREATE_PURCHASE', 'NEW_TASK'];
    if (!validSessionTypes.includes(sessionType)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SESSION_TYPE',
            message: `Tipo de sesión inválido. Use: ${validSessionTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // 5. Generate session ID for audit trail
    const sessionId = crypto.randomUUID();

    // 6. Check if using template (custom or system)
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

    // 7. Get appropriate system prompt with current date context
    let systemPrompt: string;
    let userPrompt: string;

    if (template && template.isCustom && template.customFields) {
      // Use dynamic prompt for custom template
      const fields = template.customFields as FieldDefinition[];
      systemPrompt = generateCustomTemplateSystemPrompt(
        template.name,
        template.description,
        fields
      );
      userPrompt = getUserPrompt(transcript, new Date());
      extractableFields = getCustomTemplateFields(fields);
    } else {
      // Use standard prompts (system templates or no template)
      systemPrompt = getSystemPrompt(sessionType);
      userPrompt = getUserPrompt(transcript, new Date());
      extractableFields = EXTRACTABLE_FIELDS[sessionType];
    }

    // Debug: Log the date context being sent to LLM
    // Extract just the date lines from the prompt for clearer logging
    const dateContextMatch = userPrompt.match(/## CURRENT DATE CONTEXT[\s\S]*?(?=\n\nTRANSCRIPT)/);
    console.log('[Voice Structure] Date context:', dateContextMatch ? dateContextMatch[0] : 'NOT FOUND');

    // 7. Call AI provider
    const responseText = await getChatProvider().chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: MODEL,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
        jsonMode: true,
      }
    );

    // 8. Parse JSON response
    let structuredData: VoiceStructuredData;
    try {
      structuredData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Voice Structure] JSON parse error:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STRUCTURING_FAILED',
            message: 'Error al procesar la respuesta del modelo',
          },
        },
        { status: 500 }
      );
    }

    // 10. Apply context (pre-fill doctor info for prescriptions)
    if (sessionType === 'NEW_PRESCRIPTION' && context) {
      const prescriptionData = structuredData as any;
      if (!prescriptionData.doctorFullName && context.doctorName) {
        prescriptionData.doctorFullName = context.doctorName;
      }
      if (!prescriptionData.doctorLicense && context.doctorLicense) {
        prescriptionData.doctorLicense = context.doctorLicense;
      }
    }

    // 11. Calculate which fields were extracted vs empty
    const { fieldsExtracted, fieldsEmpty } = analyzeExtractedFields(structuredData, extractableFields);

    // 12. Calculate confidence based on extraction ratio
    const confidence = calculateConfidence(fieldsExtracted.length, extractableFields.length, sessionType);

    // 13. Log for audit (in production, store in database)
    console.log(
      `[Voice Structure] Doctor: ${doctorId}, SessionID: ${sessionId}, ` +
        `Type: ${sessionType}${template ? ` (Template: ${template.name}, Custom: ${template.isCustom})` : ''}, ` +
        `Extracted: ${fieldsExtracted.length}/${extractableFields.length}, Confidence: ${confidence}`
    );

    // 14. Return success response
    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        structuredData,
        fieldsExtracted,
        fieldsEmpty,
        confidence,
      },
    });
  } catch (error: any) {
    console.error('[Voice Structure Error]', error);

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
            code: 'NETWORK_ERROR',
            message: 'Error de conexión. Verifique su internet e intente nuevamente.',
          },
        },
        { status: 503 }
      );
    }

    // Use standard error handler for auth and other errors
    return handleApiError(error, 'POST /api/voice/structure');
  }
}

/**
 * Analyze which fields were extracted vs left empty
 */
function analyzeExtractedFields(
  data: VoiceStructuredData,
  allFields: string[]
): { fieldsExtracted: string[]; fieldsEmpty: string[] } {
  const fieldsExtracted: string[] = [];
  const fieldsEmpty: string[] = [];

  // Special handling for batch ledger entries
  const batchData = data as any;
  if (batchData.isBatch && batchData.entries && Array.isArray(batchData.entries)) {
    // For batch, we consider it extracted if we have entries
    if (batchData.entries.length > 0) {
      fieldsExtracted.push('entries', 'isBatch', 'totalCount');
      // Count average fields across all entries
      batchData.entries.forEach((entry: any, index: number) => {
        Object.keys(entry).forEach(key => {
          const value = entry[key];
          if (value !== null && value !== undefined && value !== '') {
            fieldsExtracted.push(`entry${index}_${key}`);
          }
        });
      });
    }
    return { fieldsExtracted, fieldsEmpty: [] };
  }

  // Normal single entry handling
  for (const field of allFields) {
    const value = (data as any)[field];

    // Check if field has a meaningful value
    if (value !== null && value !== undefined && value !== '' &&
        !(Array.isArray(value) && value.length === 0)) {
      fieldsExtracted.push(field);
    } else {
      fieldsEmpty.push(field);
    }
  }

  return { fieldsExtracted, fieldsEmpty };
}

/**
 * Calculate confidence level based on extraction results
 */
function calculateConfidence(
  extractedCount: number,
  totalFields: number,
  sessionType: VoiceSessionType
): 'high' | 'medium' | 'low' {
  // Different thresholds based on session type
  // Prescriptions need fewer fields to be "high" confidence
  // Patients typically have more fields mentioned

  const ratio = extractedCount / totalFields;

  switch (sessionType) {
    case 'NEW_PATIENT':
      // Patient registration typically has many fields
      if (ratio >= 0.4) return 'high';
      if (ratio >= 0.2) return 'medium';
      return 'low';

    case 'NEW_ENCOUNTER':
      // Encounters vary widely - SOAP vs brief notes
      if (ratio >= 0.35) return 'high';
      if (ratio >= 0.15) return 'medium';
      return 'low';

    case 'NEW_PRESCRIPTION':
      // Prescriptions mainly need medications
      if (extractedCount >= 2) return 'high'; // Has diagnosis + medications
      if (extractedCount >= 1) return 'medium';
      return 'low';

    case 'CREATE_APPOINTMENT_SLOTS':
      // Appointment slots need: days, time range, price (minimum)
      if (extractedCount >= 5) return 'high'; // Has most fields
      if (extractedCount >= 3) return 'medium'; // Has essential fields
      return 'low';

    case 'CREATE_LEDGER_ENTRY':
      // Ledger entries need: entryType, amount, concept minimum
      if (extractedCount >= 5) return 'high'; // Has comprehensive details
      if (extractedCount >= 3) return 'medium'; // Has essential fields
      return 'low';

    case 'NEW_TASK':
      // Tasks need: title, dueDate minimum
      if (extractedCount >= 4) return 'high'; // Has title, date, time, and priority/category
      if (extractedCount >= 2) return 'medium'; // Has title and at least one other field
      return 'low';

    case 'CREATE_SALE':
    case 'CREATE_PURCHASE':
      // Sales/purchases need: client/supplier, date, items
      if (extractedCount >= 5) return 'high'; // Has comprehensive details
      if (extractedCount >= 3) return 'medium'; // Has essential fields
      return 'low';

    default:
      return 'medium';
  }
}
