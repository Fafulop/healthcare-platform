/**
 * Chunk Deduplicator
 * Removes near-duplicate chunks based on section headings and content similarity
 */

import type { RetrievedChunk } from '../types';

/**
 * Compute Jaccard similarity between two strings (word-level).
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate retrieved chunks.
 * Uses two strategies:
 * 1. Section-based: removes chunks from same file+section (keeps highest similarity)
 * 2. Content-based: removes chunks with high Jaccard overlap
 */
export function deduplicateChunks(
  chunks: RetrievedChunk[],
  jaccardThreshold: number = 0.8
): RetrievedChunk[] {
  if (chunks.length <= 1) return chunks;

  // Sort by similarity descending (keep best first)
  const sorted = [...chunks].sort((a, b) => b.similarity - a.similarity);

  // Step 1: Section-based dedup — keep best chunk per file+section combo
  const sectionMap = new Map<string, RetrievedChunk>();
  const afterSectionDedup: RetrievedChunk[] = [];

  for (const chunk of sorted) {
    const key = `${chunk.filePath}::${chunk.section || ''}`;

    if (!sectionMap.has(key)) {
      sectionMap.set(key, chunk);
      afterSectionDedup.push(chunk);
    }
    // If same section, skip (already have the higher-similarity one)
  }

  // Step 2: Content-based dedup — remove high-overlap chunks
  const result: RetrievedChunk[] = [];

  for (const chunk of afterSectionDedup) {
    let isDuplicate = false;

    for (const kept of result) {
      if (jaccardSimilarity(chunk.content, kept.content) >= jaccardThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(chunk);
    }
  }

  return result;
}
