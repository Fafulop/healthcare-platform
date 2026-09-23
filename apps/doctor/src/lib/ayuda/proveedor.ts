/**
 * El modelo del widget de Ayuda, intercambiable por UNA variable de entorno:
 * `AYUDA_MODELO` (default `gpt-4o-mini`). Un id que empieza con `claude` va a Anthropic;
 * cualquier otro, a OpenAI (AYUDA WIDGET/01-ARQUITECTURA §3).
 *
 * No usa `getChatProvider()`: ése es un singleton por app elegido con `LLM_PROVIDER`, y
 * este widget tiene que poder cambiar de modelo sin arrastrar a los otros once chats.
 * Tampoco el `AnthropicChatProvider` de `lib/ai`, que es un stub sin implementar: Claude
 * se llama con el `callClaude` del agente, que ya está probado en prod y cachea.
 */

import { OpenAIChatProvider } from '@/lib/ai/providers/openai';
import { callClaude, type TextBlock } from '@/lib/agenda-agent/anthropic';
import type { TokenUsage } from '@/lib/ai/types';

export const MODELO_POR_DEFECTO = 'gpt-4o-mini';

export function modeloAyuda(): string {
  return process.env.AYUDA_MODELO?.trim() || MODELO_POR_DEFECTO;
}

export interface MensajeAyuda {
  role: 'user' | 'assistant';
  content: string;
}

export interface ResultadoModelo {
  texto: string;
  usage: TokenUsage;
  modelo: string;
  proveedor: 'openai' | 'anthropic';
}

const MAX_TOKENS_RESPUESTA = 1200;

export async function responder(input: {
  estable: string;
  volatil: string;
  mensajes: MensajeAyuda[];
}): Promise<ResultadoModelo> {
  const modelo = modeloAyuda();

  if (modelo.startsWith('claude')) {
    // El bloque estable lleva el breakpoint de caché: el manual entero se paga ~0.1× desde
    // la segunda pregunta. El volátil va DESPUÉS para no invalidarlo.
    const system: TextBlock[] = [
      { type: 'text', text: input.estable, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: input.volatil },
    ];
    const res = await callClaude({
      model: modelo,
      system,
      messages: input.mensajes,
      tools: [],
      maxTokens: MAX_TOKENS_RESPUESTA,
      // Sin thinking: esto re-redacta un manual, no razona sobre datos. Con thinking, Haiku
      // subía max_tokens a ~6k y tardaba 20–33 s — más que el timeout de abajo.
      noThinking: true,
      timeoutMs: 30_000,
    });
    const texto = res.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const entrada =
      res.usage.input_tokens +
      (res.usage.cache_read_input_tokens ?? 0) +
      (res.usage.cache_creation_input_tokens ?? 0);
    return {
      texto,
      modelo,
      proveedor: 'anthropic',
      usage: {
        promptTokens: entrada,
        completionTokens: res.usage.output_tokens,
        totalTokens: entrada + res.usage.output_tokens,
      },
    };
  }

  const res = await new OpenAIChatProvider().chatCompletion(
    [
      { role: 'system', content: input.estable },
      { role: 'system', content: input.volatil },
      ...input.mensajes,
    ],
    { model: modelo, temperature: 0, maxTokens: MAX_TOKENS_RESPUESTA, jsonMode: true }
  );
  return { texto: res.content, usage: res.usage, modelo, proveedor: 'openai' };
}
