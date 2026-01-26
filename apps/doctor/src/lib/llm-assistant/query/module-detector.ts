/**
 * Module Detection
 * Hybrid keyword + embedding approach to detect relevant modules for a query
 */

import { prisma } from '../db';
import { MODULE_DEFINITIONS } from '../modules';
import { MODULE_DETECTION_THRESHOLD, MAX_MODULES_PER_QUERY, MODULE_KEYWORD_BOOST } from '../constants';
import { formatVectorLiteral } from '../embedding';
import type { DetectedModule } from '../types';

/**
 * Detect modules using keyword matching.
 * Fast, no API call needed.
 */
export function detectModulesByKeywords(query: string): DetectedModule[] {
  const lower = query.toLowerCase();
  const detected: DetectedModule[] = [];

  for (const moduleDef of MODULE_DEFINITIONS) {
    let matchCount = 0;
    let totalKeywords = moduleDef.keywords.length;

    for (const keyword of moduleDef.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    // Also check submodule keywords
    for (const sub of moduleDef.submodules) {
      for (const keyword of sub.keywords) {
        totalKeywords++;
        if (lower.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(1, (matchCount / Math.max(1, totalKeywords)) * 5);
      detected.push({
        moduleId: moduleDef.id,
        name: moduleDef.name,
        confidence,
        source: 'keyword',
      });
    }
  }

  return detected
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_MODULES_PER_QUERY);
}

/**
 * Detect modules using embedding similarity against module summaries.
 * Requires an API call for query embedding.
 */
export async function detectModulesByEmbedding(
  queryEmbedding: number[]
): Promise<DetectedModule[]> {
  const vectorLiteral = formatVectorLiteral(queryEmbedding);

  const results = await prisma.$queryRawUnsafe<
    Array<{
      module_id: string;
      name: string;
      description: string;
      similarity: number;
    }>
  >(
    `SELECT * FROM llm_assistant.detect_modules($1::vector, $2::FLOAT, $3::INT)`,
    vectorLiteral,
    MODULE_DETECTION_THRESHOLD,
    MAX_MODULES_PER_QUERY
  );

  return results.map(r => ({
    moduleId: r.module_id,
    name: r.name,
    confidence: r.similarity,
    source: 'embedding' as const,
  }));
}

/**
 * Hybrid module detection: keywords first, then embedding for validation/expansion.
 * Returns up to MAX_MODULES_PER_QUERY modules.
 */
export async function detectModulesWithText(
  query: string,
  queryEmbedding: number[]
): Promise<DetectedModule[]> {
  // Step 1: Fast keyword detection
  const keywordModules = detectModulesByKeywords(query);

  // Step 2: Embedding-based detection
  const embeddingModules = await detectModulesByEmbedding(queryEmbedding);

  // Step 3: Merge results, boost keyword matches
  const moduleScores = new Map<string, DetectedModule>();

  for (const mod of embeddingModules) {
    moduleScores.set(mod.moduleId, mod);
  }

  for (const mod of keywordModules) {
    const existing = moduleScores.get(mod.moduleId);
    if (existing) {
      // Boost confidence for modules detected by both methods
      existing.confidence = Math.min(1, existing.confidence + MODULE_KEYWORD_BOOST);
      existing.source = 'hybrid';
    } else {
      moduleScores.set(mod.moduleId, {
        ...mod,
        confidence: Math.min(1, mod.confidence + MODULE_KEYWORD_BOOST),
      });
    }
  }

  return Array.from(moduleScores.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_MODULES_PER_QUERY);
}
