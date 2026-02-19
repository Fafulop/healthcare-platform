/**
 * Embedding Client for LLM Assistant
 * Uses provider-agnostic abstraction layer
 */

import { getEmbeddingProvider } from '../ai';
import { EMBEDDING_BATCH_SIZE } from './constants';

/**
 * Generate embedding for a single text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return getEmbeddingProvider().generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts in batches.
 * Respects rate limits with configurable delay between batches.
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  return getEmbeddingProvider().generateEmbeddingsBatch(texts, EMBEDDING_BATCH_SIZE);
}

/**
 * Format an embedding vector as a Postgres vector literal.
 * e.g., "[0.1, 0.2, ...]"
 */
export function formatVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
