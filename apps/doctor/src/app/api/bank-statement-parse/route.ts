/**
 * POST /api/bank-statement-parse
 *
 * Receives a PDF bank statement URL, extracts text with pdf-parse,
 * sends to GPT-4o for structured transaction extraction.
 *
 * Request:  { fileUrl, bank, periodMonth, periodYear }
 * Response: { success, data: { movements: ParsedMovement[] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
import OpenAI from 'openai';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 16384;
const TEMPERATURE = 0;

export interface PdfParsedMovement {
  transactionDate: string;
  concept: string;
  reference: string;
  amount: number;
  movementType: 'deposit' | 'withdrawal';
  balance: number | null;
}

function buildSystemPrompt(bank: string, periodMonth: number, periodYear: number) {
  return `Eres un experto en analisis de estados de cuenta bancarios mexicanos.
Tu tarea es extraer TODOS los movimientos (depositos y retiros) del texto de un estado de cuenta PDF.

## CONTEXTO
- Banco: ${bank}
- Periodo: ${periodMonth}/${periodYear}

## INSTRUCCIONES
1. Analiza el texto del estado de cuenta linea por linea
2. Identifica CADA movimiento individual (deposito o retiro)
3. Para cada movimiento extrae:
   - "transactionDate": fecha en formato "YYYY-MM-DD" (usa el año ${periodYear} si la fecha solo muestra dia/mes)
   - "concept": descripcion/concepto del movimiento (limpia texto innecesario, deja solo la descripcion util)
   - "reference": numero de referencia si existe, o cadena vacia ""
   - "amount": monto absoluto como numero positivo (sin signo, sin comas)
   - "movementType": "deposit" para depositos/abonos/creditos, "withdrawal" para retiros/cargos/debitos
   - "balance": saldo despues del movimiento si aparece, o null si no esta disponible

## REGLAS CRITICAS
- NO omitas ningun movimiento — extrae TODOS los que aparezcan
- Si hay comisiones, intereses, o cargos automaticos, tambien incluyelos
- Montos SIEMPRE positivos (el tipo deposit/withdrawal indica la direccion)
- Si el formato de fecha es DD/MM, conviertelo a YYYY-MM-DD usando el año ${periodYear}
- Si el formato de fecha es DD/MM/YYYY, conviertelo a YYYY-MM-DD
- Ignora encabezados, totales, saldos iniciales/finales — solo movimientos individuales
- Si no puedes leer o no hay movimientos, devuelve un array vacio

## FORMATO DE RESPUESTA
Responde UNICAMENTE con un JSON valido:
{
  "movements": [
    {
      "transactionDate": "2025-01-15",
      "concept": "TRANSFERENCIA SPEI DE JUAN PEREZ",
      "reference": "1234567",
      "amount": 5000.00,
      "movementType": "deposit",
      "balance": 15000.00
    }
  ]
}`;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const body = await request.json();
    const { fileUrl, bank, periodMonth, periodYear } = body as {
      fileUrl: string;
      bank: string;
      periodMonth: number;
      periodYear: number;
    };

    if (!fileUrl || !bank) {
      return NextResponse.json(
        { success: false, error: 'Se requiere fileUrl y banco' },
        { status: 400 },
      );
    }

    // 1. Fetch PDF and convert to base64
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'No se pudo descargar el PDF' },
        { status: 400 },
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfSizeKB = Math.round(pdfBuffer.length / 1024);

    console.log(`[Bank PDF Parse] Doctor: ${doctorId}, Bank: ${bank}, PDF size: ${pdfSizeKB}KB`);

    // 2. Send raw PDF to GPT-4o (it reads PDFs natively)
    const systemPrompt = buildSystemPrompt(bank, periodMonth || new Date().getMonth() + 1, periodYear || new Date().getFullYear());

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza el estado de cuenta PDF adjunto y extrae todos los movimientos.' },
            {
              type: 'file',
              file: {
                filename: 'estado-de-cuenta.pdf',
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      return NextResponse.json(
        { success: false, error: 'El modelo no generó una respuesta' },
        { status: 500 },
      );
    }

    const usage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };

    logTokenUsage({
      doctorId,
      endpoint: 'bank-statement-parse',
      model: MODEL,
      provider: 'openai',
      usage,
    });

    // 4. Parse response
    let parsed: { movements: PdfParsedMovement[] };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[Bank PDF Parse] JSON parse error:', responseText.substring(0, 500));
      return NextResponse.json(
        { success: false, error: 'Error al procesar la respuesta del modelo' },
        { status: 500 },
      );
    }

    if (!Array.isArray(parsed.movements)) {
      parsed.movements = [];
    }

    console.log(`[Bank PDF Parse] Extracted ${parsed.movements.length} movements for doctor ${doctorId}`);

    return NextResponse.json({
      success: true,
      data: {
        movements: parsed.movements,
        meta: {
          pdfSizeKB,
          tokensUsed: usage.totalTokens,
        },
      },
    });
  } catch (error: any) {
    console.error('[Bank PDF Parse Error]', error);

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.' },
        { status: 429 },
      );
    }

    return handleApiError(error, 'POST /api/bank-statement-parse');
  }
}
