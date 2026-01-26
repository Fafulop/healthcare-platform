/**
 * Query Pipeline
 * Orchestrates all steps from user question to grounded answer
 */

import { generateEmbedding } from '../embedding';
import { callLLM } from '../llm-client';
import { createError } from '../errors';
import { countTokens } from '../tokenizer';
import { checkCache, saveToCache } from './cache';
import { detectModulesWithText } from './module-detector';
import { retrieveChunks, retrieveChunksUnfiltered } from './retriever';
import { deduplicateChunks } from './deduplicator';
import { loadMemory, updateMemory } from './memory';
import { assemblePrompt, extractSources } from './prompt-assembler';
import type { UserQuery, AssistantResponse } from '../types';

const MAX_QUESTION_TOKENS = 200;
const MIN_CHUNKS_THRESHOLD = 2;

/**
 * Process a user query through the full RAG pipeline.
 *
 * Steps:
 * 1. Validate input
 * 2. Check cache
 * 3. Generate query embedding
 * 4. Detect relevant modules
 * 5. Retrieve document chunks
 * 6. Deduplicate chunks
 * 7. Load conversation memory
 * 8. Assemble prompt
 * 9. Call LLM
 * 10. Save to cache
 * 11. Update memory
 */
export async function processQuery(query: UserQuery): Promise<AssistantResponse> {
  const { question, sessionId, userId } = query;

  // --- Step 1: Validate ---
  const trimmed = question.trim();
  if (!trimmed) {
    throw createError('EMPTY_QUERY');
  }

  if (countTokens(trimmed) > MAX_QUESTION_TOKENS) {
    throw createError('QUERY_TOO_LONG');
  }

  // --- Step 2: Check cache ---
  const cached = await checkCache(trimmed);
  if (cached) {
    return {
      answer: cached.response,
      sources: [],
      confidence: 'high',
      cached: true,
      modulesUsed: cached.modulesUsed,
    };
  }

  // --- Step 3: Generate query embedding ---
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(trimmed);
  } catch (err) {
    console.error('Embedding generation failed:', err);
    throw createError('EMBEDDING_FAILED');
  }

  // --- Step 4: Detect modules ---
  const detectedModules = await detectModulesWithText(trimmed, queryEmbedding);
  const moduleIds = detectedModules.map(m => m.moduleId);

  // --- Step 5: Retrieve chunks ---
  let chunks = await retrieveChunks(
    queryEmbedding,
    moduleIds.length > 0 ? moduleIds : undefined
  );

  // Fallback to unfiltered if too few results
  if (chunks.length < MIN_CHUNKS_THRESHOLD && moduleIds.length > 0) {
    chunks = await retrieveChunksUnfiltered(queryEmbedding);
  }

  // --- Step 6: Deduplicate ---
  const uniqueChunks = deduplicateChunks(chunks);

  // --- Step 7: Load memory ---
  const memory = await loadMemory(sessionId);

  // --- Step 8: Assemble prompt ---
  const messages = assemblePrompt({
    question: trimmed,
    chunks: uniqueChunks,
    memory,
  });

  // --- Step 9: Call LLM ---
  let answer: string;
  try {
    answer = await callLLM(messages);
  } catch (err) {
    console.error('LLM call failed:', err);
    throw createError('LLM_FAILED');
  }

  // --- Step 10: Extract sources and determine confidence ---
  const sources = extractSources(uniqueChunks);
  const modulesUsed = [...new Set(uniqueChunks.map(c => c.module))];
  const chunkIds = uniqueChunks.map(c => c.id);

  const confidence = determineConfidence(uniqueChunks);

  // --- Step 11: Save to cache ---
  await saveToCache(trimmed, answer, modulesUsed, chunkIds).catch(err => {
    console.error('Cache save failed:', err);
  });

  // --- Step 12: Update memory ---
  await updateMemory(
    sessionId,
    userId,
    trimmed,
    answer,
    modulesUsed[0]
  ).catch(err => {
    console.error('Memory update failed:', err);
  });

  return {
    answer,
    sources,
    confidence,
    cached: false,
    modulesUsed,
  };
}

/**
 * Determine response confidence based on retrieved chunks.
 */
function determineConfidence(
  chunks: Array<{ similarity: number }>
): 'high' | 'medium' | 'low' | 'none' {
  if (chunks.length === 0) return 'none';

  const avgSimilarity =
    chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;

  if (avgSimilarity >= 0.75) return 'high';
  if (avgSimilarity >= 0.6) return 'medium';
  return 'low';
}
