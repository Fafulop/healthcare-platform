/**
 * Chunk Retriever
 * Performs vector similarity search against document chunks
 */

import { prisma } from '../db';
import {
  RETRIEVAL_TOP_K,
  RETRIEVAL_SIMILARITY_THRESHOLD,
  MAX_CONTEXT_TOKENS,
} from '../constants';
import { formatVectorLiteral } from '../embedding';
import type { RetrievedChunk } from '../types';

/**
 * Retrieve chunks matching a query embedding, optionally filtered by modules.
 * Respects the token budget for context window.
 */
export async function retrieveChunks(
  queryEmbedding: number[],
  moduleIds?: string[]
): Promise<RetrievedChunk[]> {
  const vectorLiteral = formatVectorLiteral(queryEmbedding);

  const filterModules = moduleIds && moduleIds.length > 0 ? moduleIds : null;

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      content: string;
      module: string;
      submodule: string | null;
      section: string | null;
      doc_type: string;
      file_path: string;
      heading: string | null;
      token_count: number;
      chunk_index: number;
      similarity: number;
    }>
  >(
    `SELECT * FROM llm_assistant.search_chunks($1::vector, $2::FLOAT, $3::INT, $4)`,
    vectorLiteral,
    RETRIEVAL_SIMILARITY_THRESHOLD,
    RETRIEVAL_TOP_K,
    filterModules
  );

  // Enforce token budget
  const chunks: RetrievedChunk[] = [];
  let totalTokens = 0;

  for (const row of results) {
    if (totalTokens + row.token_count > MAX_CONTEXT_TOKENS) {
      break;
    }

    chunks.push({
      id: row.id,
      content: row.content,
      module: row.module,
      submodule: row.submodule ?? undefined,
      section: row.section ?? undefined,
      docType: row.doc_type as RetrievedChunk['docType'],
      filePath: row.file_path,
      heading: row.heading ?? undefined,
      tokenCount: row.token_count,
      chunkIndex: row.chunk_index,
      similarity: row.similarity,
    });

    totalTokens += row.token_count;
  }

  return chunks;
}

/**
 * Fallback retrieval without module filter.
 * Used when module-filtered search returns too few results.
 */
export async function retrieveChunksUnfiltered(
  queryEmbedding: number[]
): Promise<RetrievedChunk[]> {
  return retrieveChunks(queryEmbedding, undefined);
}
