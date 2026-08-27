/**
 * Precios de los modelos LLM y conversión de una fila de `llm_token_usage` a dólares.
 *
 * ⚠️ ESTIMACIÓN, no facturación. El costo se calcula al LEER, con los precios de HOY: si un
 * proveedor cambia sus tarifas y actualizamos esta tabla, el costo de los meses pasados cambia
 * con ella. Sirve para decidir ("¿qué doctor nos cuesta más?"), no para cuadrar una factura.
 *
 * Precios verificados 2026-08-27:
 *   · Anthropic — claude-haiku-4-5 $1/$5 · claude-sonnet-5 $2/$10 por millón de tokens.
 *   · OpenAI    — gpt-4o $2.50/$10 · gpt-4o-mini $0.15/$0.60 · whisper-1 $0.006/minuto.
 *
 * Al agregar un modelo, agrégalo AQUÍ. Un modelo que no esté en la tabla NO cuesta cero:
 * `costOfUsd` devuelve `null` y quien lo consuma tiene que decir "no sé" en vez de sumar 0
 * (un costo faltante y un costo real de $0 se ven idénticos si los dos son 0).
 */

/** USD por 1M de tokens. */
interface TokenPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

const TOKEN_PRICES: Record<string, TokenPrice> = {
  // Anthropic
  'claude-haiku-4-5': { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  'claude-sonnet-5': { inputPerMTok: 2.0, outputPerMTok: 10.0 },
  // OpenAI
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10.0 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
};

/** Modelos que NO se cobran por token. Whisper se cobra por minuto de audio. */
const PER_MINUTE_PRICES: Record<string, number> = {
  'whisper-1': 0.006,
};

/** Lo que necesita `costOfUsd` de una fila de `llm_token_usage`. */
export interface UsageRowForCost {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  /**
   * Tokens PONDERADOS POR COSTO (equivalentes a token de input base):
   * uncached×1 · cache read×0.1 · cache write×1.25 · output×5.
   * Solo lo llenan los endpoints con caché (hoy el asistente).
   */
  budgetTokens: number | null;
  durationSeconds: number | null;
}

/**
 * Costo en USD de UNA fila (o de un grupo ya sumado del MISMO modelo).
 * Devuelve `null` cuando el modelo no está en la tabla — nunca 0.
 *
 * Tres caminos, porque las tres cosas se cobran distinto:
 *
 * 1. **Whisper** — por minuto. Sus filas traen 0 tokens y un `durationSeconds`; contarlas por
 *    token daría $0.00 mientras se gasta dinero de verdad.
 *
 * 2. **Anthropic con `budgetTokens`** — `budgetTokens` YA es el costo, expresado en tokens de
 *    input base: sus pesos (0.1 lectura de caché · 1.25 escritura · 5 output) son exactamente
 *    los múltiplos de precio de Anthropic, y el output vale 5× el input tanto en Haiku 4.5
 *    ($1/$5) como en Sonnet 5 ($2/$10). Así que basta multiplicar por el precio de input.
 *    🔴 **No usar `promptTokens` aquí**: guarda el volumen de input COMPLETO, incluidas las
 *    lecturas de caché, que se cobran al 10%. El prefijo cacheado es la mayor parte del input
 *    del asistente, así que cobrarlo completo lo sobreestima varias veces.
 *
 * 3. **Todo lo demás** — input y output a su precio.
 *
 * ⚠️ Sesgo conocido, en una dirección que se puede nombrar: OpenAI cobra el input cacheado a la
 * mitad (gpt-4o $1.25 vs $2.50), pero `lib/ai/providers/openai.ts` no guarda
 * `prompt_tokens_details.cached_tokens`, así que aquí TODO el input de OpenAI se cobra completo.
 * El número de OpenAI es un techo, no una estimación centrada. Se arregla capturando ese campo.
 */
export function costOfUsd(row: UsageRowForCost): number | null {
  const perMinute = PER_MINUTE_PRICES[row.model];
  if (perMinute !== undefined) {
    // Sin duración no hay nada que cobrar; 0 aquí es un costo real, no un dato faltante.
    return ((row.durationSeconds ?? 0) / 60) * perMinute;
  }

  const price = TOKEN_PRICES[row.model];
  if (!price) return null;

  if (row.provider === 'anthropic' && row.budgetTokens !== null) {
    return (row.budgetTokens / 1_000_000) * price.inputPerMTok;
  }

  return (
    (row.promptTokens / 1_000_000) * price.inputPerMTok +
    (row.completionTokens / 1_000_000) * price.outputPerMTok
  );
}

/** ¿Sabemos cobrar este modelo? Para distinguir "cuesta poco" de "no lo sé cobrar". */
export function isModelPriced(model: string): boolean {
  return model in TOKEN_PRICES || model in PER_MINUTE_PRICES;
}
