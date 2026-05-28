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
import { getChatProvider } from '@/lib/ai';
import type { ChatMessage } from '@/lib/ai';
import { logTokenUsage } from '@/lib/ai/log-token-usage';
// @ts-ignore — pdfjs-dist legacy build has no type declarations for .mjs
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker — we run server-side in Node.js
(GlobalWorkerOptions as any).workerSrc = '';

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

    // 1. Fetch PDF and extract text
    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'No se pudo descargar el PDF' },
        { status: 400 },
      );
    }

    const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());
    const doc = await getDocument({ data: pdfBuffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
    const numpages = doc.numPages;

    // Extract text from all pages
    const pageTexts: string[] = [];
    for (let i = 1; i <= numpages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ');
      pageTexts.push(text);
    }
    const pdfText = pageTexts.join('\n\n');
    doc.destroy();

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json(
        { success: false, error: 'El PDF no contiene texto legible. Puede ser un PDF escaneado (imagen).' },
        { status: 400 },
      );
    }

    console.log(`[Bank PDF Parse] Doctor: ${doctorId}, Bank: ${bank}, Pages: ${numpages}, Text length: ${pdfText.length}`);

    // 2. Truncate text if too long for context window (keep ~60k chars)
    const maxChars = 60000;
    const truncatedText = pdfText.length > maxChars
      ? pdfText.substring(0, maxChars) + '\n\n[... texto truncado ...]'
      : pdfText;

    // 3. Send to GPT-4o for structured extraction
    const systemPrompt = buildSystemPrompt(bank, periodMonth || new Date().getMonth() + 1, periodYear || new Date().getFullYear());

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Aqui esta el texto extraido del estado de cuenta PDF:\n\n${truncatedText}` },
    ];

    const { content: responseText, usage } = await getChatProvider().chatCompletion(chatMessages, {
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
      jsonMode: true,
    });

    logTokenUsage({
      doctorId,
      endpoint: 'bank-statement-parse',
      model: MODEL,
      provider: process.env.LLM_PROVIDER || 'openai',
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
          pages: numpages,
          textLength: pdfText.length,
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
