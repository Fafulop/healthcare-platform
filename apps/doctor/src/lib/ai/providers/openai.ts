/**
 * OpenAI implementation of ChatProvider and EmbeddingProvider
 */

import OpenAI from 'openai';
import type {
  ChatProvider,
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
  ): Promise<string> {
    const { model = 'gpt-4o', temperature = 0, maxTokens = 4096, jsonMode = false } = options;

    const completion = await getOpenAI().chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
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
