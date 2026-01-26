/**
 * Documentation Sync Module
 * Provides incremental and full sync capabilities
 */

import { prisma } from '../db';
import { runIngestionPipeline } from '../ingestion/pipeline';
import { MODULE_DEFINITIONS, getAllModuleIds } from '../modules';
import type { SyncResult } from '../types';

/**
 * Sync a single module's documentation.
 */
export async function syncModule(
  moduleId: string,
  options?: { force?: boolean }
): Promise<SyncResult> {
  const moduleDef = MODULE_DEFINITIONS.find(m => m.id === moduleId);
  if (!moduleDef) {
    throw new Error(`Unknown module: ${moduleId}`);
  }

  // Count existing chunks before sync
  const beforeCount = await prisma.llmDocsChunk.count({
    where: { module: moduleId },
  });

  const results = await runIngestionPipeline({
    force: options?.force,
    moduleFilter: moduleId,
  });

  // Count after sync
  const afterCount = await prisma.llmDocsChunk.count({
    where: { module: moduleId },
  });

  const chunksAdded = Math.max(0, afterCount - beforeCount);
  const chunksRemoved = Math.max(0, beforeCount - afterCount);

  // Record version
  const lastVersion = await prisma.llmDocsVersion.findFirst({
    where: { moduleId },
    orderBy: { version: 'desc' },
  });

  await prisma.llmDocsVersion.create({
    data: {
      version: (lastVersion?.version ?? 0) + 1,
      moduleId,
      changeType: options?.force ? 'full_sync' : 'incremental',
      filesChanged: results.map(r => r.filePath),
      chunksAdded,
      chunksRemoved,
    },
  });

  // Invalidate query cache for this module
  await prisma.$executeRawUnsafe(
    `DELETE FROM llm_assistant.llm_query_cache WHERE $1 = ANY(modules_used)`,
    moduleId
  );

  return {
    moduleId,
    filesProcessed: results.length,
    chunksAdded,
    chunksRemoved,
    unchanged: moduleDef.filePaths.length - results.length,
  };
}

/**
 * Sync all modules.
 */
export async function syncAll(
  options?: { force?: boolean }
): Promise<SyncResult[]> {
  const moduleIds = getAllModuleIds();
  const results: SyncResult[] = [];

  for (const moduleId of moduleIds) {
    console.log(`\nSyncing module: ${moduleId}`);
    const result = await syncModule(moduleId, options);
    results.push(result);
    console.log(`  Files: ${result.filesProcessed}, Added: ${result.chunksAdded}, Removed: ${result.chunksRemoved}, Unchanged: ${result.unchanged}`);
  }

  return results;
}

/**
 * List all modules with their current chunk counts.
 */
export async function listModules(): Promise<Array<{
  moduleId: string;
  name: string;
  chunkCount: number;
  fileCount: number;
  lastSynced: Date | null;
}>> {
  const results = [];

  for (const moduleDef of MODULE_DEFINITIONS) {
    const chunkCount = await prisma.llmDocsChunk.count({
      where: { module: moduleDef.id },
    });

    const fileCount = await prisma.llmDocsFileHash.count({
      where: { moduleId: moduleDef.id },
    });

    const lastFile = await prisma.llmDocsFileHash.findFirst({
      where: { moduleId: moduleDef.id },
      orderBy: { lastSynced: 'desc' },
    });

    results.push({
      moduleId: moduleDef.id,
      name: moduleDef.name,
      chunkCount,
      fileCount,
      lastSynced: lastFile?.lastSynced ?? null,
    });
  }

  return results;
}

/**
 * Get overall sync status.
 */
export async function getStatus(): Promise<{
  totalChunks: number;
  totalFiles: number;
  modules: number;
  lastSync: Date | null;
  cacheEntries: number;
}> {
  const totalChunks = await prisma.llmDocsChunk.count();
  const totalFiles = await prisma.llmDocsFileHash.count();
  const cacheEntries = await prisma.llmQueryCache.count();

  const lastFile = await prisma.llmDocsFileHash.findFirst({
    orderBy: { lastSynced: 'desc' },
  });

  return {
    totalChunks,
    totalFiles,
    modules: MODULE_DEFINITIONS.length,
    lastSync: lastFile?.lastSynced ?? null,
    cacheEntries,
  };
}

/**
 * Show version history for a module.
 */
export async function showHistory(
  moduleId?: string,
  limit: number = 10
): Promise<Array<{
  version: number;
  moduleId: string;
  changeType: string;
  filesChanged: string[];
  chunksAdded: number;
  chunksRemoved: number;
  createdAt: Date;
}>> {
  const where = moduleId ? { moduleId } : {};

  return prisma.llmDocsVersion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
