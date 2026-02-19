# LLM Assistant — Docs Sync Guide

**Last Updated:** 2026-02-19

---

## What This Is

The LLM Assistant uses **RAG (Retrieval-Augmented Generation)**. Before the AI can answer questions about the app, markdown documentation files in `docs/llm-assistant/` must be chunked, embedded via OpenAI, and stored as vectors in the Railway pgvector database.

This guide explains how to sync those docs and how the local vs. deployed structure works.

---

## Architecture

### Where Vectors Live

All vector embeddings live exclusively in the **Railway pgvector database** — both in local development and in production. There is no local vector store.

```
Local Development
  pnpm dev:doctor
    ├── App data (patients, appts, etc.) ──► LOCAL PostgreSQL (localhost:5432)
    └── LLM vectors (RAG, cache, memory) ──► RAILWAY pgvector (yamanote.proxy.rlwy.net)

Production (Railway)
  All services ──► RAILWAY pgvector (single database, multiple schemas)
```

### Why Railway Even Locally?

pgvector is hard to install on Windows (requires Docker or compiling from source). Instead, both local and production point to the same Railway pgvector for vector operations. This means:

- Vector data is always live — changes made locally are visible in production immediately
- You don't need a local pgvector setup
- `LLM_DATABASE_URL` in `.env.local` points to the Railway public URL

### Database Clients

| Client | Env Variable | Used By |
|---|---|---|
| Main Prisma | `DATABASE_URL` | All app tables (patients, appointments, etc.) |
| LLM Prisma (`apps/doctor/src/lib/llm-assistant/db.ts`) | `LLM_DATABASE_URL` → fallback `DATABASE_URL` | Vector search, cache, memory |

In production Railway, `LLM_DATABASE_URL` is not set — it falls back to `DATABASE_URL` (same pgvector DB).

---

## The Docs Sync CLI

All sync operations use a single CLI entry point:

```
scripts/docs-sync.ts
```

Called via the `pnpm docs:*` scripts defined in the root `package.json`.

### Available Commands

| Command | What It Does |
|---|---|
| `pnpm docs:sync-all` | Sync only changed files (hash-based skip) |
| `pnpm docs:sync-all --force` | Re-ingest ALL files regardless of changes |
| `pnpm docs:sync <moduleId>` | Sync a single module only |
| `pnpm docs:status` | Show total chunks, files, modules, last sync |
| `pnpm docs:list` | Show per-module chunk and file counts |
| `pnpm docs:history` | Show version history of syncs |
| `pnpm docs:purge` | Delete ALL chunks and file hashes (use before clean re-ingest) |

---

## How to Sync Docs to Railway

Because the CLI needs Railway environment variables (`DATABASE_URL`, `OPENAI_API_KEY`), all sync commands must be prefixed with `railway run`. This injects the production env vars and runs the command locally against Railway.

### Prerequisites

1. Railway CLI installed: `npm install -g @railway/cli`
2. Logged in: `railway login`
3. Project linked: `railway link` (select `DOCTORES-SEO-PACIENTE-MGMT`)

### Standard Workflow: After Editing a Doc File

```powershell
# Sync only changed files (skips unchanged based on SHA-256 hash)
railway run pnpm docs:sync-all

# Verify
railway run pnpm docs:status
```

### Force Full Re-Ingest

Use this after major doc rewrites or when you want to guarantee all chunks are fresh:

```powershell
railway run pnpm docs:sync-all --force
```

### Clean Slate Re-Ingest (Purge + Sync)

Use this when:
- You suspect stale/ghost chunks from old file paths are polluting search results
- The chunk count in `docs:status` is higher than expected (more than the number of eligible `.md` files)

```powershell
# Step 1: Delete everything
railway run pnpm docs:purge

# Step 2: Re-ingest all from scratch
railway run pnpm docs:sync-all --force

# Step 3: Verify clean state
railway run pnpm docs:status
```

Expected output after a clean ingest:
```
Total chunks:    26
Total files:     26
Modules:         9
Cache entries:   0
```

---

## How the Pipeline Works

### 1. File Discovery

`discoverMarkdownFiles()` walks `docs/llm-assistant/` and returns all `.md` files except those in `DOCS_SKIP_FILES` (developer/setup docs that shouldn't be searchable by doctors):

```typescript
// constants.ts
export const DOCS_SKIP_FILES = [
  'TECHNICAL_SPEC.md',
  'IMPLEMENTATION_STATUS.md',
  'pgvector-railway-setup.md',
  'dual-database-architecture.md',
  'railway-db-migration-plan.md',
  'database-management-guide.md',
];
```

### 2. Hash Check (skipped with `--force`)

Each file's SHA-256 hash is compared to the stored hash in `llm_docs_file_hashes`. If unchanged, the file is skipped. With `--force`, all files are processed.

### 3. Delete → Embed → Insert

For each processed file:
1. **DELETE** all existing chunks for that `file_path` from `llm_docs_chunks`
2. Parse markdown into sections (split by headings)
3. Chunk sections into ~300–500 token chunks
4. **Batch embed** all chunks via OpenAI `text-embedding-3-small`
5. **INSERT** new chunks with embedding vectors

### 4. Module Assignment

Each file is assigned to a module based on `MODULE_DEFINITIONS` in `modules.ts`. The module ID determines which chunks are searched when a query is detected to be about that topic.

Current modules: `medical-records`, `appointments`, `practice-management`, `pendientes`, `profile`, `blog`, `voice-assistant`, `navigation`, `general`

---

## Ghost Chunk Problem

**What it is:** Old chunks from files that were previously ingested but are now in `DOCS_SKIP_FILES` (or have been deleted/renamed) persist in the DB because the pipeline never calls DELETE for skipped files.

**How to detect:** Run `docs:status`. If `Total chunks` is significantly higher than the number of eligible `.md` files, there are ghost chunks.

**How to fix:** Run purge + sync-all (see Clean Slate workflow above).

**Why it matters:** The RAG retriever searches ALL chunks by cosine similarity. Ghost chunks from developer docs (pgvector setup guides, Railway architecture docs) can appear in search results for unrelated user queries.

---

## Path Alias Resolution (`@/` imports)

The sync CLI runs from the monorepo root via `tsx scripts/docs-sync.ts`. The source files in `apps/doctor/src/lib/llm-assistant/` use `@/` path aliases (e.g., `@/lib/ai`), which are normally resolved by the Next.js build but NOT by tsx running from the root.

### Fix Applied

A root-level `tsconfig.json` was created at the monorepo root to teach tsx how to resolve `@/`:

```json
// tsconfig.json (monorepo root)
{
  "compilerOptions": {
    "baseUrl": "apps/doctor/src",
    "paths": {
      "@/*": ["*"]
    },
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}
```

With this in place, `@/lib/ai` resolves to `apps/doctor/src/lib/ai` when tsx runs from the root.

**Do not delete this file.** Without it, `railway run pnpm docs:sync-all` will fail with `Cannot find module '@/lib/...'`.

---

## Troubleshooting

### `Cannot find module '@/lib/...'`

The root `tsconfig.json` is missing or the `baseUrl`/`paths` are wrong. Verify `tsconfig.json` exists at the monorepo root with `baseUrl: "apps/doctor/src"`.

### `'pnpm' is not recognized`

Run the command from **PowerShell**, not Git Bash. Git Bash doesn't have pnpm in PATH on this machine.

### `railway: command not found`

Railway CLI not installed. Run: `npm install -g @railway/cli`, then `railway login`.

### `Error: Unknown module: <moduleId>`

The moduleId passed to `docs:sync <moduleId>` doesn't exist in `MODULE_DEFINITIONS`. Run `docs:list` to see valid module IDs.

### Chunk count higher than expected after sync

Ghost chunks from previously ingested files. Run purge + sync-all.

### `OPENAI_API_KEY` missing

The command was run without `railway run` prefix. Always use `railway run pnpm docs:*` to inject env vars.

---

## File Map

```
monorepo root
├── tsconfig.json                          ← Root tsconfig for @/ alias resolution (DO NOT DELETE)
├── package.json                           ← docs:* scripts
└── scripts/
    └── docs-sync.ts                       ← CLI entry point

apps/doctor/src/lib/llm-assistant/
├── sync.ts                                ← syncAll, syncModule, purgeAll, getStatus, listModules
├── ingestion/
│   └── pipeline.ts                        ← File discovery, chunking, embedding, DB insert
├── query/
│   └── retriever.ts                       ← Vector similarity search
├── modules.ts                             ← MODULE_DEFINITIONS (9 modules)
└── constants.ts                           ← DOCS_SKIP_FILES, chunk sizes, thresholds

docs/llm-assistant/                        ← Source markdown files (26 eligible files)
├── index.md
├── faq.md
├── features/
│   ├── navigation.md
│   └── voice-assistant.md
└── modules/
    ├── blog.md
    ├── pendientes.md
    ├── profile.md
    ├── appointments/
    ├── medical-records/
    └── practice-management/
```

---

## Quick Reference

| Task | Command (PowerShell) |
|---|---|
| Sync changed docs | `railway run pnpm docs:sync-all` |
| Force re-ingest all | `railway run pnpm docs:sync-all --force` |
| Clean slate | `railway run pnpm docs:purge` then `railway run pnpm docs:sync-all --force` |
| Check status | `railway run pnpm docs:status` |
| Per-module counts | `railway run pnpm docs:list` |
| Sync one module | `railway run pnpm docs:sync medical-records --force` |
