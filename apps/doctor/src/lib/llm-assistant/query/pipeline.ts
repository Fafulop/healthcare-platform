/**
 * Query Pipeline
 * Orchestrates all steps from user question to grounded answer.
 *
 * Layer architecture:
 *   1. Capability map  → deterministic rules (primary source of truth)
 *   2. RAG documents   → explanations and how-to content
 *   3. UI context      → where the user is right now
 */

import { generateEmbedding } from '../embedding';
import { callLLM } from '../llm-client';
import { createError } from '../errors';
import { logTokenUsage } from '../../ai/log-token-usage';
import { LLM_MODEL } from '../constants';
import { countTokens } from '../tokenizer';
import { checkCache, saveToCache } from './cache';
import { detectModulesWithText } from './module-detector';
import { retrieveChunks, retrieveChunksUnfiltered } from './retriever';
import { deduplicateChunks } from './deduplicator';
import { loadMemory, updateMemory } from './memory';
import { assemblePrompt, extractSources } from './prompt-assembler';
import {
  formatCapabilityMapForPrompt,
  getModulesFromPath,
} from '../capabilities';
import type { UserQuery, AssistantResponse } from '../types';

const MAX_QUESTION_TOKENS = 200;

/**
 * Process a user query through the full RAG + capability map pipeline.
 *
 * Steps:
 *  1. Validate input
 *  2. Check cache
 *  3. Generate query embedding
 *  4. Detect relevant modules (augmented with UI context path)
 *  5. Retrieve document chunks
 *  6. Deduplicate chunks
 *  7. Load conversation memory
 *  8. Build capability map for detected modules
 *  9. Assemble prompt (capability map + docs + memory + UI context)
 * 10. Call LLM
 * 11. Save to cache
 * 12. Update memory
 */
export async function processQuery(query: UserQuery): Promise<AssistantResponse> {
  const { question, sessionId, userId, doctorId, uiContext } = query;

  // --- Step 1: Validate ---
  const trimmed = question.trim();
  if (!trimmed) {
    throw createError('EMPTY_QUERY');
  }

  if (countTokens(trimmed) > MAX_QUESTION_TOKENS) {
    throw createError('QUERY_TOO_LONG');
  }

  // --- Step 2: Check cache ---
  // Include current module path in cache key for context-sensitive answers
  const cacheKey = uiContext?.currentPath
    ? `[${uiContext.currentPath}] ${trimmed}`
    : trimmed;

  const cached = await checkCache(cacheKey);
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
  // Augment detected modules with any module implied by the current URL path
  const pathModules = uiContext ? getModulesFromPath(uiContext.currentPath) : [];
  const detectedModules = await detectModulesWithText(trimmed, queryEmbedding);
  const detectedIds = detectedModules.map(m => m.moduleId);

  // Merge path-based modules at the front (higher priority), deduplicate
  const moduleIds = [
    ...pathModules,
    ...detectedIds.filter(id => !pathModules.includes(id)),
  ];

  // --- Step 5: Retrieve chunks ---
  let chunks = await retrieveChunks(
    queryEmbedding,
    moduleIds.length > 0 ? moduleIds : undefined
  );

  // Fallback to unfiltered only if no results at all
  if (chunks.length === 0 && moduleIds.length > 0) {
    chunks = await retrieveChunksUnfiltered(queryEmbedding);
  }

  // --- Step 6: Deduplicate ---
  const uniqueChunks = deduplicateChunks(chunks);

  // --- Step 7: Load memory ---
  const memory = await loadMemory(sessionId);

  // --- Step 8: Build capability map ---
  // All detected + path modules get their capability rules injected
  const allModuleIds = [
    ...new Set([
      ...pathModules,
      ...detectedIds,
      ...uniqueChunks.map(c => c.module),
    ]),
  ];
  const capabilityMapText = formatCapabilityMapForPrompt(allModuleIds);

  // --- Step 9: Assemble prompt ---
  const messages = assemblePrompt({
    question: trimmed,
    chunks: uniqueChunks,
    memory,
    capabilityMapText: capabilityMapText || undefined,
    uiContext,
  });

  // --- Step 10: Call LLM ---
  let answer: string;
  try {
    const result = await callLLM(messages);
    answer = result.content;
    if (doctorId) {
      logTokenUsage({
        doctorId,
        endpoint: 'llm-assistant',
        model: LLM_MODEL,
        provider: process.env.LLM_PROVIDER || 'openai',
        usage: result.usage,
      });
    }
  } catch (err) {
    console.error('LLM call failed:', err);
    throw createError('LLM_FAILED');
  }

  // --- Step 11: Extract sources and determine confidence ---
  const sources = extractSources(uniqueChunks);
  const modulesUsed = [...new Set(uniqueChunks.map(c => c.module))];
  const chunkIds = uniqueChunks.map(c => c.id);
  const confidence = determineConfidence(uniqueChunks);

  // --- Step 12: Save to cache ---
  await saveToCache(cacheKey, answer, modulesUsed, chunkIds).catch(err => {
    console.error('Cache save failed:', err);
  });

  // --- Step 13: Update memory ---
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
