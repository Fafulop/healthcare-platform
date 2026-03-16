/**
 * POST /api/prescription-chat
 *
 * AI chat endpoint for the Prescription form.
 * Receives conversation history + current form state,
 * returns field updates and medication actions to apply directly to the form.
 *
 * Request:  { messages, currentFormData }
 * Response: { success, data: { message, action, fieldUpdates?, medicationActions? } }
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

function buildSystemPrompt(currentFormData: Record<string, any>) {
  const medications = currentFormData.medications || [];
  const imagingStudies = currentFormData.imagingStudies || [];
  const labStudies = currentFormData.labStudies || [];

  return `Eres un asistente de IA que ayuda a doctores a llenar recetas medicas.
El doctor describe medicamentos, estudios de imagen, estudios de laboratorio y datos de la receta en lenguaje natural y tu extraes los datos para actualizar los campos del formulario.

## CAMPOS PLANOS DEL FORMULARIO
- "prescriptionDate": Fecha de prescripcion (formato YYYY-MM-DD)
- "diagnosis": Diagnostico del paciente
- "clinicalNotes": Notas clinicas adicionales
- "doctorFullName": Nombre completo del doctor
- "doctorLicense": Cedula profesional del doctor
- "expiresAt": Fecha de expiracion de la receta (formato YYYY-MM-DD)

## CAMPOS DE MEDICAMENTO
Cada medicamento tiene estos campos:
- "drugName": Nombre del medicamento (obligatorio)
- "presentation": Presentacion (ej: tabletas, jarabe, capsulas)
- "dosage": Dosis (ej: 500mg) (obligatorio)
- "frequency": Frecuencia (ej: cada 8 horas) (obligatorio)
- "duration": Duracion del tratamiento (ej: 7 dias)
- "quantity": Cantidad (ej: 21 tabletas)
- "instructions": Instrucciones de uso (ej: tomar con alimentos) (obligatorio)
- "warnings": Advertencias (ej: no mezclar con alcohol)

## CAMPOS DE ESTUDIO DE IMAGEN
Cada estudio de imagen tiene estos campos:
- "studyName": Nombre del estudio (obligatorio) (ej: Radiografia de torax, TAC de abdomen, Resonancia magnetica)
- "region": Region del cuerpo (ej: Torax, Abdomen, Columna lumbar)
- "indication": Indicacion clinica (ej: Descartar neumonia)
- "urgency": Urgencia (ej: Urgente, Rutina, Electivo)
- "notes": Notas adicionales

## CAMPOS DE ESTUDIO DE LABORATORIO
Cada estudio de laboratorio tiene estos campos:
- "studyName": Nombre del estudio (obligatorio) (ej: Biometria hematica, Quimica sanguinea, Examen general de orina)
- "indication": Indicacion clinica (ej: Control de diabetes)
- "urgency": Urgencia (ej: Urgente, Rutina)
- "fasting": Instrucciones de ayuno (ej: Ayuno de 8 horas, No requiere ayuno)
- "notes": Notas adicionales

## ESTADO ACTUAL DEL FORMULARIO
Campos planos:
${JSON.stringify({ prescriptionDate: currentFormData.prescriptionDate, diagnosis: currentFormData.diagnosis, clinicalNotes: currentFormData.clinicalNotes, doctorFullName: currentFormData.doctorFullName, doctorLicense: currentFormData.doctorLicense, expiresAt: currentFormData.expiresAt }, null, 2)}

Medicamentos actuales (${medications.length}):
${JSON.stringify(medications, null, 2)}

Estudios de imagen actuales (${imagingStudies.length}):
${JSON.stringify(imagingStudies, null, 2)}

Estudios de laboratorio actuales (${labStudies.length}):
${JSON.stringify(labStudies, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { "diagnosis": "valor", ... },
  "medicationActions": [
    { "type": "add", "medication": { "drugName": "...", "dosage": "...", "frequency": "...", "instructions": "..." } },
    { "type": "update", "index": 0, "updates": { "dosage": "1g" } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "medications": [ ... ] }
  ],
  "imagingStudyActions": [
    { "type": "add", "study": { "studyName": "...", "region": "...", "indication": "...", "urgency": "..." } },
    { "type": "update", "index": 0, "updates": { "urgency": "Urgente" } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "studies": [ ... ] }
  ],
  "labStudyActions": [
    { "type": "add", "study": { "studyName": "...", "indication": "...", "urgency": "...", "fasting": "..." } },
    { "type": "update", "index": 0, "updates": { "fasting": "Ayuno de 8 horas" } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "studies": [ ... ] }
  ]
}

## REGLAS
1. Cuando el doctor menciona datos de la receta, extrae los valores y usa action="update_fields"
2. Solo incluye en fieldUpdates los campos planos que realmente se mencionaron. NUNCA incluyas "medications", "imagingStudies" o "labStudies" en fieldUpdates - usa siempre las acciones correspondientes
3. Si solo es una pregunta o conversacion sin datos para el formulario, usa action="no_change" con todos los arrays vacios
4. Para medicamentos: si el primer slot esta vacio (drugName vacio), usa "update" en index 0 en vez de "add"
5. Para agregar un medicamento/estudio nuevo, usa "add"
6. Para modificar uno existente, usa "update" con el index correcto
7. Para eliminar uno, usa "remove" con el index correcto
8. Para reemplazar todos, usa "replace_all"
9. Siempre responde en español profesional medico
10. Se conciso en tus respuestas - confirma los campos, medicamentos y estudios actualizados brevemente
11. Para fechas, usa formato "YYYY-MM-DD"
12. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
13. Si el doctor menciona un medicamento con dosis, frecuencia y duracion, calcula la cantidad si es posible
14. FORMATO OBLIGATORIO: Cuando menciones campos, medicamentos o estudios (actualizados, pendientes, o listados), SIEMPRE usa bullet points. Ejemplo:
- **Diagnostico**: faringitis aguda
- **Medicamento 1**: Paracetamol 500mg cada 8 horas
- **Estudio de imagen**: Radiografia de torax (Rutina)
- **Estudio de laboratorio**: Biometria hematica (Ayuno de 8 horas)`;
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
    } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      currentFormData: Record<string, any>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(currentFormData);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // Few-shot example to show medication handling
      { role: 'user', content: 'Paracetamol 500mg cada 8 horas por 5 dias, tomar con alimentos' },
      { role: 'assistant', content: JSON.stringify({
        message: 'He agregado el medicamento:\n\n- **Paracetamol** 500mg cada 8 horas por 5 dias\n\n¿Desea agregar otro medicamento o algun dato mas a la receta?',
        action: 'update_fields',
        fieldUpdates: {},
        medicationActions: [
          { type: 'update', index: 0, updates: { drugName: 'Paracetamol', presentation: 'tabletas', dosage: '500mg', frequency: 'cada 8 horas', duration: '5 dias', quantity: '15 tabletas', instructions: 'Tomar con alimentos' } }
        ],
      }) },
      ...messages
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ];

    console.log('[Prescription Chat] Request:', {
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
      endpoint: 'prescription-chat',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let parsed: {
      message: string;
      action: string;
      fieldUpdates?: Record<string, any>;
      medicationActions?: any[];
      imagingStudyActions?: any[];
      labStudyActions?: any[];
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Prescription Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[Prescription Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Field Updates: ${Object.keys(parsed.fieldUpdates || {}).length}, Med Actions: ${(parsed.medicationActions || []).length}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fieldUpdates: parsed.fieldUpdates,
        medicationActions: parsed.medicationActions,
        imagingStudyActions: parsed.imagingStudyActions,
        labStudyActions: parsed.labStudyActions,
      },
    });
  } catch (error: any) {
    console.error('[Prescription Chat Error]', error);

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

    return handleApiError(error, 'POST /api/prescription-chat');
  }
}
