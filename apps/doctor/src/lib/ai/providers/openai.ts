/**
 * OpenAI implementation of ChatProvider and EmbeddingProvider
 */

import OpenAI from 'openai';
import type {
  ChatProvider,
  ChatCompletionResult,
  EmbeddingProvider,
  ChatMessage,
  ChatCompletionOptions,
} from '../types';
import {
  EMBEDDING_MODEL,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_RATE_LIMIT_MS,
} from '@/lib/llm-assistant/constants';

// Lazy singleton
let _openai: OpenAI;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export class OpenAIChatProvider implements ChatProvider {
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const { model = 'gpt-4o', temperature = 0, maxTokens = 4096, jsonMode = false } = options;

    // Inject current date into the system prompt so the model always knows today's date.
    const today = new Date().toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Mexico_City',
    });
    const dateContext = `\n\nFecha y hora actual: ${today}.`;

    const enrichedMessages = messages.map((m, i) =>
      m.role === 'system' && i === 0
        ? { ...m, content: m.content + dateContext }
        : m
    );

    const completion = await getOpenAI().chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: enrichedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return {
      content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      },
    };
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  }

  async generateEmbeddingsBatch(
    texts: string[],
    batchSize: number = EMBEDDING_BATCH_SIZE
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });

      for (const item of response.data) {
        results.push(item.embedding);
      }

      // Rate limit between batches
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, EMBEDDING_RATE_LIMIT_MS));
      }
    }

    return results;
  }
}
