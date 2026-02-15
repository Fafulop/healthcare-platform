/**
 * POST /api/sale-chat
 *
 * AI chat endpoint for the Sale (Ventas) form.
 * Receives conversation history + current form state + current items,
 * returns field updates and item actions to apply directly to the form.
 *
 * Request:  { messages, currentFormData }
 * Response: { success, data: { message, action, fieldUpdates?, itemActions? } }
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

function buildSystemPrompt(currentFormData: Record<string, any>) {
  return `Eres un asistente de IA que ayuda a doctores a registrar ventas de servicios y productos.
El doctor describe la venta en lenguaje natural y tu extraes los datos para actualizar los campos del formulario.

## CAMPOS DEL FORMULARIO
- "clientName": Nombre del paciente o cliente (texto, se usara para buscar coincidencia)
- "saleDate": Fecha de la venta (formato YYYY-MM-DD)
- "deliveryDate": Fecha de entrega (formato YYYY-MM-DD, opcional)
- "paymentStatus": Estado de pago - valores: "PENDING" | "PARTIAL" | "PAID"
- "amountPaid": Monto pagado (numero, solo relevante si paymentStatus es PARTIAL)
- "notes": Notas adicionales (texto libre)
- "termsAndConditions": Terminos y condiciones (texto libre)

## ITEMS/SERVICIOS DE LA VENTA
Los items son los servicios o productos incluidos en la venta. Cada item tiene:
- "description": Nombre/descripcion del servicio o producto (obligatorio)
- "itemType": "service" | "product"
- "quantity": Cantidad (numero, default 1)
- "unit": Unidad - "servicio", "pza", "kg", "lt", "hora", "sesion" (default "servicio" para services, "pza" para products)
- "unitPrice": Precio unitario en MXN (numero, obligatorio)
- "discountRate": Tasa de descuento (0-1, default 0)
- "taxRate": Tasa de impuesto (0-1, default 0.16)

## ESTADO ACTUAL DEL FORMULARIO
${JSON.stringify({
  clientName: currentFormData.clientName,
  saleDate: currentFormData.saleDate,
  deliveryDate: currentFormData.deliveryDate,
  paymentStatus: currentFormData.paymentStatus,
  amountPaid: currentFormData.amountPaid,
  notes: currentFormData.notes,
  termsAndConditions: currentFormData.termsAndConditions,
  itemCount: currentFormData.itemCount,
  items: currentFormData.items,
}, null, 2)}

## TU RESPUESTA
Siempre responde con un JSON valido con esta estructura:
{
  "message": "string - Tu respuesta conversacional al doctor en español",
  "action": "update_fields" | "no_change",
  "fieldUpdates": { "clientName": "Garcia", "saleDate": "2025-01-15", ... },
  "itemActions": [
    { "type": "add", "item": { "description": "Consulta general", "itemType": "service", "quantity": 1, "unitPrice": 3000 } },
    { "type": "update", "index": 0, "updates": { "unitPrice": 3500 } },
    { "type": "remove", "index": 1 },
    { "type": "replace_all", "items": [ { "description": "...", ... } ] }
  ]
}

## REGLAS
1. Usa fieldUpdates para campos de nivel superior (clientName, saleDate, paymentStatus, etc.)
2. Solo incluye en fieldUpdates los campos que realmente se mencionaron
3. Usa itemActions para agregar, modificar o eliminar servicios/productos de la venta
4. Si solo es una pregunta o conversacion sin datos, usa action="no_change" con fieldUpdates vacio y itemActions vacio
5. Siempre responde en español profesional
6. Se conciso en tus respuestas - confirma los campos actualizados brevemente
7. Para fechas, usa formato "YYYY-MM-DD"
8. Si el doctor dice algo ambiguo, pide aclaracion en el message y usa action="no_change"
9. Usa la fecha de hoy como referencia para calcular "hoy", "ayer", "manana", etc.
10. Para montos, siempre usa numeros (sin signo de pesos ni comas)
11. Si no se especifica tipo de item, asume "service" (servicio) por defecto
12. Si no se especifica impuesto, usa 0.16 (16% IVA) por defecto
13. Si el doctor dice "pagado" o "cobrado", usa paymentStatus="PAID"
14. Si dice "pendiente", usa paymentStatus="PENDING"
15. FORMATO OBLIGATORIO: Cuando menciones campos o items, SIEMPRE usa bullet points. Ejemplo:
- **Paciente**: Garcia Lopez
- **Servicio**: Consulta general - $3,000
- **Estado**: Pagado`;
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
      { role: 'user', content: 'Venta para el paciente Garcia, consulta general a 3000 pesos, pagado' },
      { role: 'assistant', content: JSON.stringify({
        message: 'He actualizado la venta:\n\n- **Paciente**: Garcia\n- **Servicio**: Consulta general - $3,000\n- **Estado de pago**: Pagado\n\n¿Desea agregar mas servicios o guardar la venta?',
        action: 'update_fields',
        fieldUpdates: { clientName: 'Garcia', paymentStatus: 'PAID' },
        itemActions: [{ type: 'add', item: { description: 'Consulta general', itemType: 'service', quantity: 1, unitPrice: 3000, unit: 'servicio', discountRate: 0, taxRate: 0.16 } }],
      }) },
      ...messages
        .filter((msg) => msg.content != null && msg.content !== '')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ];

    console.log('[Sale Chat] Request:', {
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
      itemActions?: any[];
    };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Sale Chat] JSON parse error:', responseText);
      return NextResponse.json(
        { success: false, error: { code: 'CHAT_FAILED', message: 'Error al procesar la respuesta del modelo' } },
        { status: 500 }
      );
    }

    console.log(`[Sale Chat] Doctor: ${doctorId}, Action: ${parsed.action}, Field Updates: ${Object.keys(parsed.fieldUpdates || {}).length}, Item Actions: ${(parsed.itemActions || []).length}`);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message,
        action: parsed.action,
        fieldUpdates: parsed.fieldUpdates,
        itemActions: parsed.itemActions,
      },
    });
  } catch (error: any) {
    console.error('[Sale Chat Error]', error);

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

    return handleApiError(error, 'POST /api/sale-chat');
  }
}
