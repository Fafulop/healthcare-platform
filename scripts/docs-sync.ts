/**
 * CLI Script for LLM Assistant Documentation Sync
 *
 * Usage:
 *   pnpm docs:sync <moduleId>        — Sync a single module
 *   pnpm docs:sync-all               — Sync all modules
 *   pnpm docs:sync-all --force       — Force full re-sync of all modules
 *   pnpm docs:status                 — Show sync status
 *   pnpm docs:list                   — List all modules with counts
 *   pnpm docs:history [moduleId]     — Show version history
 */

import { syncModule, syncAll, listModules, getStatus, showHistory, purgeAll } from '../apps/doctor/src/lib/llm-assistant/sync';

const args = process.argv.slice(2);
const command = args[0];
const force = args.includes('--force');

async function main() {
  switch (command) {
    case 'sync': {
      const moduleId = args[1];
      if (!moduleId || moduleId.startsWith('--')) {
        console.error('Usage: docs-sync sync <moduleId> [--force]');
        process.exit(1);
      }
      console.log(`Syncing module: ${moduleId}${force ? ' (force)' : ''}`);
      const result = await syncModule(moduleId, { force });
      console.log('\nResult:', JSON.stringify(result, null, 2));
      break;
    }

    case 'sync-all': {
      console.log(`Syncing all modules${force ? ' (force)' : ''}...`);
      const results = await syncAll({ force });
      console.log('\n=== Summary ===');
      for (const r of results) {
        console.log(`  ${r.moduleId}: ${r.filesProcessed} files, +${r.chunksAdded} -${r.chunksRemoved} chunks`);
      }
      const totalChunks = results.reduce((s, r) => s + r.chunksAdded, 0);
      console.log(`\nTotal new chunks: ${totalChunks}`);
      break;
    }

    case 'list': {
      console.log('Modules:\n');
      const modules = await listModules();
      for (const m of modules) {
        const synced = m.lastSynced ? m.lastSynced.toISOString() : 'never';
        console.log(`  ${m.moduleId.padEnd(25)} ${String(m.chunkCount).padStart(4)} chunks  ${String(m.fileCount).padStart(3)} files  last: ${synced}`);
      }
      break;
    }

    case 'status': {
      const status = await getStatus();
      console.log('LLM Assistant Sync Status:');
      console.log(`  Total chunks:    ${status.totalChunks}`);
      console.log(`  Total files:     ${status.totalFiles}`);
      console.log(`  Modules:         ${status.modules}`);
      console.log(`  Cache entries:   ${status.cacheEntries}`);
      console.log(`  Last sync:       ${status.lastSync?.toISOString() ?? 'never'}`);
      break;
    }

    case 'history': {
      const moduleId = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      const history = await showHistory(moduleId);
      console.log(`Version history${moduleId ? ` for ${moduleId}` : ''}:\n`);
      for (const h of history) {
        console.log(`  v${h.version} [${h.moduleId}] ${h.changeType} — +${h.chunksAdded} -${h.chunksRemoved} chunks — ${h.createdAt.toISOString()}`);
        if (h.filesChanged.length > 0) {
          for (const f of h.filesChanged) {
            console.log(`    → ${f}`);
          }
        }
      }
      break;
    }

    case 'purge': {
      console.log('Purging all chunks and file hashes...');
      const result = await purgeAll();
      console.log(`  Deleted ${result.chunksDeleted} chunks`);
      console.log(`  Deleted ${result.filesDeleted} file hashes`);
      console.log('Done. Run docs:sync-all --force to re-ingest.');
      break;
    }

    default:
      console.log('LLM Assistant Docs Sync CLI\n');
      console.log('Commands:');
      console.log('  sync <moduleId> [--force]    Sync a single module');
      console.log('  sync-all [--force]           Sync all modules');
      console.log('  list                         List all modules');
      console.log('  status                       Show sync status');
      console.log('  history [moduleId]           Show version history');
      console.log('  purge                        Delete all chunks (then re-ingest)');
      process.exit(0);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });
