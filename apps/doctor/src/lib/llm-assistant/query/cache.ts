/**
 * Query Cache
 * SHA-256 based caching with TTL for LLM responses
 */

import { createHash } from 'crypto';
import { prisma } from '../db';
import { CACHE_TTL_HOURS } from '../constants';
import type { CachedResponse } from '../types';

/**
 * Normalize and hash a query for cache lookup.
 */
export function hashQuery(query: string): string {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[¿?¡!.,;:]/g, '');

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Check cache for a matching query. Returns null if miss or expired.
 */
export async function checkCache(query: string): Promise<CachedResponse | null> {
  const hash = hashQuery(query);

  const cached = await prisma.llmQueryCache.findUnique({
    where: { queryHash: hash },
  });

  if (!cached) return null;

  // Check expiry
  if (cached.expiresAt < new Date()) {
    // Expired — delete and return null
    await prisma.llmQueryCache.delete({ where: { queryHash: hash } }).catch(() => {});
    return null;
  }

  // Increment hit count
  await prisma.llmQueryCache.update({
    where: { queryHash: hash },
    data: { hitCount: { increment: 1 } },
  }).catch(() => {});

  return {
    response: cached.response,
    modulesUsed: cached.modulesUsed,
    chunksUsed: cached.chunksUsed,
  };
}

/**
 * Save a response to cache with TTL.
 */
export async function saveToCache(
  query: string,
  response: string,
  modulesUsed: string[],
  chunksUsed: number[]
): Promise<void> {
  const hash = hashQuery(query);
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  await prisma.llmQueryCache.upsert({
    where: { queryHash: hash },
    create: {
      queryHash: hash,
      queryText: query,
      response,
      modulesUsed,
      chunksUsed,
      expiresAt,
    },
    update: {
      response,
      modulesUsed,
      chunksUsed,
      expiresAt,
      hitCount: 0,
    },
  });
}

/**
 * Invalidate all cache entries that reference a given module.
 */
export async function invalidateCacheForModule(moduleId: string): Promise<number> {
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM llm_assistant.llm_query_cache WHERE $1 = ANY(modules_used)`,
    moduleId
  );
  return result as number;
}
