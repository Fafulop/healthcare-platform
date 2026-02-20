/**
 * POST /api/patient-chat
 *
 * AI chat endpoint for the Patient registration form.
 * Receives conversation history + current form state,
 * returns field updates to apply directly to the form.
 *
 * Request:  { messages, currentFormData }
 * Response: { success, data: { message, action, fieldUpdates } }
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
  return `Eres un asistente de IA que ayuda a doctores a registrar pacientes nuevos.
El doctor describe los datos del paciente en lenguaje natural y tu extraes los valores para actualizar los campos del formulario.

## CAMPOS DEL FORMULARIO
### Identificacion
- "firstName": Nombres del paciente
- "lastName": Apellidos del paciente
- "dateOfBirth": Fecha de nacimiento (formato YYYY-MM-DD)
- "sex": Sexo del paciente. Valores validos: "male", "female", "other"
- "bloodType": Tipo de sangre. Valores validos: "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"
- "internalId": ID interno del paciente (opcional)

### Contacto
- "phone": Telefono del paciente
- "email": Correo electronico
- "address": Direccion
- "city": Ciudad
- "state": Estado
- "postalCode": Codigo postal

### Contacto de Emergencia
- "emergencyContactName": Nombre del contacto de emergencia
- "emergencyContactPhone": Telefono del contacto de emergencia
- "emergencyContactRelation": Relacion con el paciente (ej: madre, padre, esposo/a, hermano/a)

### Informacion Medica
- "currentAllergies": Alergias conocidas
- "currentChronicConditions": Condiciones cronicas
- "currentMedications": Medicamentos actuales
- "generalNotes": Notas generales
- "tags": Etiquetas (como texto separado por comas, ej: "diabetico, hipertenso")

## ESTADO ACTUAL DEL FORMULARIO
${JSON.stringify(currentFormData, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { "firstName": "valor", "lastName": "valor", ... }
}

## REGLAS
1. Cuando el doctor menciona datos del paciente, extrae los valores y usa action="update_fields"
2. Solo incluye en fieldUpdates los campos que realmente se mencionaron
3. Si solo es una pregunta o conversacion sin datos para el formulario, usa action="no_change" con fieldUpdates vacio
4. Siempre responde en español profesional medico
5. Se conciso en tus respuestas - confirma los campos actualizados brevemente
6. Para fechas, usa formato "YYYY-MM-DD". Si solo se menciona el año, usa "YYYY-01-01"
7. Para sexo, traduce: masculino→"male", femenino→"female", otro→"other"
8. Para tipo de sangre, normaliza al formato correcto (ej: "o positivo"→"O+")
9. Para tags, usa texto separado por comas
10. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
11. FORMATO OBLIGATORIO: Cuando menciones campos actualizados, SIEMPRE usa bullet points. Ejemplo:
- **Nombre**: Juan
- **Apellido**: Perez
- **Sexo**: Masculino`;
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
      // Few-shot example
      { role: 'user', content: 'Paciente Juan Perez, masculino, nacido el 15 de marzo de 1985, alergico a penicilina' },
      { role: 'assistant', content: JSON.stringify({
        message: 'He registrado los datos del paciente:\n\n- **Nombre**: Juan\n- **Apellido**: Perez\n- **Sexo**: Masculino\n- **Fecha de nacimiento**: 1985-03-15\n- **Alergias**: Penicilina\n\n¿Desea agregar mas datos?',
        action: 'update_fields',
        fieldUpdates: {
          firstName: 'Juan',
          lastName: 'Perez',
          sex: 'male',
          dateOfBirth: '1985-03-15',
          currentAllergies: 'Penicilina',
        },
      }) },
      ...messages
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ];

    console.log('[Patient Chat] Request:', {
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
      endpoint: 'patient-chat',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let parsed: {
      message: string;
      action: string;
      fieldUpdates?: Record<string, any>;
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Patient Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[Patient Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Field Updates: ${Object.keys(parsed.fieldUpdates || {}).length}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fieldUpdates: parsed.fieldUpdates,
      },
    });
  } catch (error: any) {
    console.error('[Patient Chat Error]', error);

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

    return handleApiError(error, 'POST /api/patient-chat');
  }
}
