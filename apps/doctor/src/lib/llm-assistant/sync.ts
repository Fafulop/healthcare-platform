/**
 * LLM Assistant Docs Sync
 * High-level sync functions used by the CLI (scripts/docs-sync.ts)
 */

import { runIngestionPipeline } from './ingestion/pipeline';
import { prisma } from './db';
import { MODULE_DEFINITIONS } from './modules';

export interface SyncResult {
  moduleId: string;
  filesProcessed: number;
  chunksAdded: number;
  chunksRemoved: number;
}

export interface ModuleSyncStatus {
  moduleId: string;
  chunkCount: number;
  fileCount: number;
  lastSynced: Date | null;
}

export interface AssistantStatus {
  totalChunks: number;
  totalFiles: number;
  modules: number;
  cacheEntries: number;
  lastSync: Date | null;
}

export interface VersionHistoryEntry {
  id: number;
  version: number;
  moduleId: string;
  changeType: string;
  filesChanged: string[];
  chunksAdded: number;
  chunksRemoved: number;
  createdAt: Date;
}

/**
 * Sync all modules. Respects file hashes to skip unchanged files unless --force.
 */
export async function syncAll(options?: { force?: boolean }): Promise<SyncResult[]> {
  const results = await runIngestionPipeline({ force: options?.force });

  // Group results by module
  const byModule = new Map<string, { files: number; chunks: number }>();
  for (const r of results) {
    const existing = byModule.get(r.module) ?? { files: 0, chunks: 0 };
    byModule.set(r.module, {
      files: existing.files + 1,
      chunks: existing.chunks + r.chunksCreated,
    });
  }

  return Array.from(byModule.entries()).map(([moduleId, data]) => ({
    moduleId,
    filesProcessed: data.files,
    chunksAdded: data.chunks,
    chunksRemoved: 0,
  }));
}

/**
 * Sync a single module by ID.
 */
export async function syncModule(moduleId: string, options?: { force?: boolean }): Promise<SyncResult> {
  const results = await runIngestionPipeline({
    force: options?.force,
    moduleFilter: moduleId,
  });

  return {
    moduleId,
    filesProcessed: results.length,
    chunksAdded: results.reduce((s, r) => s + r.chunksCreated, 0),
    chunksRemoved: 0,
  };
}

/**
 * List all modules with their current chunk and file counts.
 */
export async function listModules(): Promise<ModuleSyncStatus[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    module_id: string;
    chunk_count: bigint;
    file_count: bigint;
    last_synced: Date | null;
  }>>(
    `SELECT
       fh.module_id,
       COUNT(DISTINCT c.id)  AS chunk_count,
       COUNT(DISTINCT fh.id) AS file_count,
       MAX(fh.last_synced)   AS last_synced
     FROM llm_assistant.llm_docs_file_hashes fh
     LEFT JOIN llm_assistant.llm_docs_chunks c ON c.file_path = fh.file_path
     GROUP BY fh.module_id
     ORDER BY fh.module_id`
  );

  return rows.map(r => ({
    moduleId: r.module_id,
    chunkCount: Number(r.chunk_count),
    fileCount: Number(r.file_count),
    lastSynced: r.last_synced,
  }));
}

/**
 * Return aggregate sync status.
 */
export async function getStatus(): Promise<AssistantStatus> {
  const [chunkRes, fileRes, cacheRes, syncRes] = await Promise.all([
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM llm_assistant.llm_docs_chunks`
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM llm_assistant.llm_docs_file_hashes`
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM llm_assistant.llm_query_cache`
    ),
    prisma.$queryRawUnsafe<[{ last_sync: Date | null }]>(
      `SELECT MAX(last_synced) AS last_sync FROM llm_assistant.llm_docs_file_hashes`
    ),
  ]);

  return {
    totalChunks: Number(chunkRes[0].count),
    totalFiles: Number(fileRes[0].count),
    modules: MODULE_DEFINITIONS.length,
    cacheEntries: Number(cacheRes[0].count),
    lastSync: syncRes[0].last_sync,
  };
}

/**
 * Clear all query cache entries.
 * Use after re-ingesting docs to force fresh pipeline runs.
 */
export async function clearCache(): Promise<{ entriesDeleted: number }> {
  const [res] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count FROM llm_assistant.llm_query_cache`
  );
  await prisma.$executeRawUnsafe(`DELETE FROM llm_assistant.llm_query_cache`);
  return { entriesDeleted: Number(res.count) };
}

/**
 * Purge all chunks and file hashes from the database.
 * Use before a full re-ingest to guarantee a clean slate.
 */
export async function purgeAll(): Promise<{ chunksDeleted: number; filesDeleted: number }> {
  const [chunksRes] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count FROM llm_assistant.llm_docs_chunks`
  );
  const [filesRes] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count FROM llm_assistant.llm_docs_file_hashes`
  );

  await prisma.$executeRawUnsafe(`DELETE FROM llm_assistant.llm_docs_chunks`);
  await prisma.$executeRawUnsafe(`DELETE FROM llm_assistant.llm_docs_file_hashes`);
  await prisma.$executeRawUnsafe(`DELETE FROM llm_assistant.llm_query_cache`);

  return {
    chunksDeleted: Number(chunksRes.count),
    filesDeleted: Number(filesRes.count),
  };
}

/**
 * Show version history, optionally filtered by module.
 */
export async function showHistory(moduleId?: string): Promise<VersionHistoryEntry[]> {
  const rows = moduleId
    ? await prisma.$queryRawUnsafe<Array<{
        id: number;
        version: number;
        module_id: string;
        change_type: string;
        files_changed: string[];
        chunks_added: number;
        chunks_removed: number;
        created_at: Date;
      }>>(
        `SELECT id, version, module_id, change_type, files_changed, chunks_added, chunks_removed, created_at
         FROM llm_assistant.llm_docs_versions
         WHERE module_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        moduleId
      )
    : await prisma.$queryRawUnsafe<Array<{
        id: number;
        version: number;
        module_id: string;
        change_type: string;
        files_changed: string[];
        chunks_added: number;
        chunks_removed: number;
        created_at: Date;
      }>>(
        `SELECT id, version, module_id, change_type, files_changed, chunks_added, chunks_removed, created_at
         FROM llm_assistant.llm_docs_versions
         ORDER BY created_at DESC
         LIMIT 50`
      );

  return rows.map(r => ({
    id: r.id,
    version: r.version,
    moduleId: r.module_id,
    changeType: r.change_type,
    filesChanged: r.files_changed,
    chunksAdded: r.chunks_added,
    chunksRemoved: r.chunks_removed,
    createdAt: r.created_at,
  }));
}
