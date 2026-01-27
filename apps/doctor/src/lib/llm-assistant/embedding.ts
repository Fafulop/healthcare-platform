/**
 * OpenAI Embedding Client for LLM Assistant
 */

import OpenAI from 'openai';
import {
  EMBEDDING_MODEL,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_RATE_LIMIT_MS,
} from './constants';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Generate embedding for a single text string.
 * Returns a 1536-dimensional vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches.
 * Respects rate limits with configurable delay between batches.
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    for (const item of response.data) {
      results.push(item.embedding);
    }

    // Rate limit between batches
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, EMBEDDING_RATE_LIMIT_MS));
    }
  }

  return results;
}

/**
 * Format an embedding vector as a Postgres vector literal.
 * e.g., "[0.1, 0.2, ...]"
 */
export function formatVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
