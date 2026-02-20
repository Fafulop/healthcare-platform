/**
 * POST /api/ledger-chat
 *
 * AI chat endpoint for the Ledger Entry (Flujo de Dinero) form.
 * Receives conversation history + current form state + accumulated batch entries,
 * returns field updates and entry actions to apply directly to the form.
 *
 * Request:  { messages, currentFormData, accumulatedEntries }
 * Response: { success, data: { message, action, fieldUpdates?, entryActions? } }
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
  currentFormData: Record<string, any>,
  accumulatedEntries: Record<string, any>[]
) {
  return `Eres un asistente de IA que ayuda a doctores a registrar movimientos de dinero (ingresos y egresos).
El doctor describe movimientos en lenguaje natural y tu extraes los datos para actualizar los campos del formulario o crear multiples movimientos.

## CAMPOS DEL FORMULARIO (movimiento unico)
- "entryType": Tipo de movimiento - valores: "ingreso" | "egreso"
- "amount": Monto en MXN (numero positivo)
- "concept": Descripcion del movimiento (max 500 caracteres)
- "transactionDate": Fecha de transaccion (formato YYYY-MM-DD)
- "area": Area/categoria del movimiento (depende del tipo)
- "subarea": Subcategoria (depende del area seleccionada)
- "bankAccount": Cuenta bancaria (texto libre)
- "formaDePago": Forma de pago - valores: "efectivo" | "transferencia" | "tarjeta" | "cheque" | "deposito"
- "bankMovementId": Referencia bancaria (texto libre)
- "paymentOption": Estado de pago - valores: "paid" | "pending"

## ESTADO ACTUAL DEL FORMULARIO
${JSON.stringify({
  entryType: currentFormData.entryType,
  amount: currentFormData.amount,
  concept: currentFormData.concept,
  transactionDate: currentFormData.transactionDate,
  area: currentFormData.area,
  subarea: currentFormData.subarea,
  bankAccount: currentFormData.bankAccount,
  formaDePago: currentFormData.formaDePago,
  bankMovementId: currentFormData.bankMovementId,
  paymentOption: currentFormData.paymentOption,
}, null, 2)}

## MOVIMIENTOS ACUMULADOS EN LOTE (${accumulatedEntries.length})
${JSON.stringify(accumulatedEntries, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { "entryType": "ingreso", "amount": 5000, ... },
  "entryActions": [
    { "type": "add", "entry": { "entryType": "ingreso", "amount": 5000, "concept": "...", ... } },
    { "type": "update", "index": 0, "updates": { "amount": 6000 } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "entries": [ { "entryType": "ingreso", ... }, ... ] }
  ]
}

## REGLAS
1. Cuando el doctor menciona UN solo movimiento, usa fieldUpdates para actualizar el formulario unico
2. Solo incluye en fieldUpdates los campos que realmente se mencionaron
3. Cuando el doctor menciona MULTIPLES movimientos (ej: "registra 3 movimientos: ..."), usa entryActions con "add" para cada uno
4. entryActions gestiona la lista de movimientos en lote (acumulados)
5. Si solo es una pregunta o conversacion sin datos, usa action="no_change" con fieldUpdates vacio y entryActions vacio
6. Para modificar un movimiento acumulado existente, usa "update" con el index correcto
7. Para eliminar un movimiento acumulado, usa "remove" con el index correcto
8. Para reemplazar todos los movimientos acumulados, usa "replace_all"
9. Siempre responde en español profesional
10. Se conciso en tus respuestas - confirma los campos y movimientos actualizados brevemente
11. Para fechas, usa formato "YYYY-MM-DD"
12. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
13. Usa la fecha de hoy como referencia para calcular "hoy", "ayer", "manana", etc.
14. Para el campo "amount", siempre usa un numero (sin signo de pesos ni comas)
15. Si no se especifica forma de pago, usa "efectivo" por defecto
16. Si no se especifica tipo, intenta inferirlo del contexto (consulta=ingreso, compra material=egreso)
17. FORMATO OBLIGATORIO: Cuando menciones campos o movimientos (actualizados, pendientes, o listados), SIEMPRE usa bullet points. Ejemplo:
- **Tipo**: Ingreso
- **Monto**: $5,000
- **Concepto**: Consulta general`;
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
      accumulatedEntries = [],
    } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      currentFormData: Record<string, any>;
      accumulatedEntries: Record<string, any>[];
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Se requiere al menos un mensaje' } },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(currentFormData, accumulatedEntries);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // Few-shot example
      { role: 'user', content: 'Ingreso de 5000 pesos por consulta, transferencia' },
      { role: 'assistant', content: JSON.stringify({
        message: 'He actualizado el formulario:\n\n- **Tipo**: Ingreso\n- **Monto**: $5,000\n- **Concepto**: Consulta\n- **Forma de pago**: Transferencia\n\n¿Desea agregar mas detalles o registrar el movimiento?',
        action: 'update_fields',
        fieldUpdates: { entryType: 'ingreso', amount: 5000, concept: 'Consulta', formaDePago: 'transferencia' },
        entryActions: [],
      }) },
      ...messages
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ];

    console.log('[Ledger Chat] Request:', {
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
      endpoint: 'ledger-chat',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
      usage,
    });

    let parsed: {
      message: string;
      action: string;
      fieldUpdates?: Record<string, any>;
      entryActions?: any[];
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Ledger Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[Ledger Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Field Updates: ${Object.keys(parsed.fieldUpdates || {}).length}, Entry Actions: ${(parsed.entryActions || []).length}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fieldUpdates: parsed.fieldUpdates,
        entryActions: parsed.entryActions,
      },
    });
  } catch (error: any) {
    console.error('[Ledger Chat Error]', error);

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

    return handleApiError(error, 'POST /api/ledger-chat');
  }
}
