# pgvector Railway Setup Guide

**Date completed:** 2026-01-26
**Status:** Fully configured and verified

---

## Overview

The LLM Assistant requires PostgreSQL with the **pgvector** extension for vector similarity search. Since the local Windows PostgreSQL 17 does not have pgvector installed, we deployed a separate **pgvector-pg17** service on Railway and configured the LLM Assistant to connect to it remotely while the rest of the app continues using the local database.

This document covers every step that was performed, the reasoning behind each decision, and how to reproduce or troubleshoot the setup.

---

## Prerequisites

Before starting, the following was already in place:

- **Railway account** logged in via CLI (`railway whoami` → `Gerardo López`)
- **Railway project** linked: `DOCTORES-SEO-PACIENTE-MGMT`
- **Local PostgreSQL 17** running on `localhost:5432` with database `docs_mono`
- **Railway CLI** installed (`railway.exe` available in PATH)
- **pnpm** monorepo with Prisma configured in `packages/database/`

---

## Why a Separate Railway Service?

### Railway's standard PostgreSQL does NOT include pgvector

Railway's default PostgreSQL image does not ship with the pgvector extension files. Running `CREATE EXTENSION vector;` on the standard service fails with:

```
ERROR: could not open extension control file
"/usr/share/postgresql/17/extension/vector.control": No such file or directory
```

This is a known Railway limitation. The pgvector extension **cannot be added** to an existing standard PostgreSQL service. Railway's team is working on improving extension support, but as of January 2026, the only option is to deploy a service from the **pgvector template**.

### Why not migrate everything to the pgvector DB?

For **production**, that is the plan — a single pgvector-pg17 database for everything (see Production Setup section below).

For **local development**, we keep two databases:
- Local PostgreSQL → all regular app data (patients, appointments, medical records, etc.)
- Railway pgvector-pg17 → LLM Assistant data only (embeddings, cache, conversation memory)

This avoids mixing local dev data with remote data and keeps the regular development workflow unchanged.

---

## Step-by-Step Setup (What Was Done)

### Step 1: Deploy pgvector-pg17 on Railway

1. Opened the Railway dashboard
2. Navigated to the template marketplace
3. Selected **pgvector-pg17** (PostgreSQL 17 with pgvector pre-installed)
4. Clicked **Deploy** — one-click deployment

The template uses the `pgvector/pgvector:pg17` Docker image, which is the official pgvector image with PostgreSQL 17.

After deployment, the new service appeared in the project as **`pgvector`** alongside the existing services:

| Service | Type |
|---|---|
| @healthcare/admin | App |
| @healthcare/doctor | App |
| @healthcare/public | App |
| @healthcare/api | App |
| Postgres | Database (original, no pgvector) |
| **pgvector** | **Database (new, with pgvector)** |

### Step 2: Get the Public Connection String

From the Railway dashboard, navigated to the **pgvector** service → **Variables** tab and copied the `DATABASE_PUBLIC_URL`:

```
postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway
```

**Important:** The internal URL (`pgvector.railway.internal:5432`) only works from within Railway's network. For local development, you must use the **public** URL which routes through Railway's TCP proxy (`yamanote.proxy.rlwy.net:51502`).

### Step 3: Create the Separate Prisma Client

Created `apps/doctor/src/lib/llm-assistant/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForLlmPrisma = globalThis as unknown as {
  llmPrisma: PrismaClient | undefined;
};

const datasourceUrl = process.env.LLM_DATABASE_URL || process.env.DATABASE_URL;

export const prisma =
  globalForLlmPrisma.llmPrisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForLlmPrisma.llmPrisma = prisma;
}
```

This client:
- Reads `LLM_DATABASE_URL` first, falls back to `DATABASE_URL`
- Uses the singleton pattern with `globalThis` to prevent multiple instances during Next.js hot reload
- Uses a separate global key (`llmPrisma`) so it doesn't collide with the main app's Prisma client

Then updated **6 files** to import from this new client instead of `@healthcare/database`:
- `ingestion/pipeline.ts`
- `query/cache.ts`
- `query/memory.ts`
- `query/retriever.ts`
- `query/module-detector.ts`
- `sync/index.ts`

All changed from:
```typescript
import { prisma } from '@healthcare/database';
```
to:
```typescript
import { prisma } from '../db';
```

### Step 4: Add `LLM_DATABASE_URL` to Environment Files

Added the Railway pgvector connection string to two files:

**`apps/doctor/.env.local`** (for the Next.js doctor app):
```env
# LLM Assistant Database (Railway pgvector-pg17)
LLM_DATABASE_URL="postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway"
```

**`packages/database/.env`** (for CLI scripts like `pnpm docs:sync-all`):
```env
# LLM Assistant Database (Railway pgvector-pg17)
LLM_DATABASE_URL="postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway"
```

The existing `DATABASE_URL` in both files was left unchanged — it still points to `localhost:5432/docs_mono`.

### Step 5: Enable pgvector Extension on Railway DB

Ran from the project root (`C:\Users\52331\docs-front`):

```powershell
npx prisma db execute --file packages/database/prisma/migrations/20260125000000_enable_pgvector/migration.sql --url "postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway"
```

This executed:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Output: `Script executed successfully.`

**Note:** We used `--url` to pass the public Railway URL directly, rather than `railway run` (which injects the internal URL that doesn't work from outside Railway's network).

### Step 6: Create LLM Assistant Schema, Tables, Indexes, and Functions

```powershell
npx prisma db execute --file packages/database/prisma/migrations/20260125000001_add_llm_assistant_schema/migration.sql --url "postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway"
```

This created:

**Schema:**
- `llm_assistant`

**Tables (6):**

| Table | Purpose |
|---|---|
| `llm_docs_chunks` | Document chunks with 1536-dim vector embeddings |
| `llm_module_summaries` | Module descriptions with embeddings for detection |
| `llm_query_cache` | SHA-256 response cache with 24h TTL |
| `llm_conversation_memory` | Sliding window conversation context (2 turns) |
| `llm_docs_versions` | Sync version tracking |
| `llm_docs_file_hashes` | File hash for incremental sync |

**Indexes:**
- Unique indexes on `module_id`, `query_hash`, `session_id`, `file_path`
- Performance indexes on `module`, `file_path`, `doc_type`, `expires_at`, `user_id`, `module_id`
- **HNSW vector indexes** on `llm_docs_chunks.embedding` and `llm_module_summaries.embedding` (cosine distance, m=16, ef_construction=64)

**SQL Functions (2):**
- `llm_assistant.search_chunks()` — Vector similarity search with optional module filter
- `llm_assistant.detect_modules()` — Module detection by embedding similarity

Output: `Script executed successfully.`

### Step 7: Regenerate Prisma Client

```powershell
pnpm db:generate
```

Output: `✔ Generated Prisma Client (v6.19.1)` — confirms the client was regenerated with all models including the 6 LLM assistant models.

### Step 8: Verify the Setup

Ran a test script that confirmed:

```
pgvector extension: [ { extname: 'vector', extversion: '0.8.1' } ]
LLM tables: [
  'llm_conversation_memory',
  'llm_docs_chunks',
  'llm_docs_file_hashes',
  'llm_docs_versions',
  'llm_module_summaries',
  'llm_query_cache'
]
SQL functions: [ 'detect_modules', 'search_chunks' ]
```

All 6 tables, 2 functions, and pgvector 0.8.1 confirmed working.

### Step 9: Switch Railway CLI Back to API Service

**IMPORTANT:** After working with the pgvector service, the Railway CLI was left linked to it. This must be switched back so that future `railway up` deploys go to the correct app service:

```powershell
railway service @healthcare/api
```

You can verify with:
```powershell
railway status
```

Expected output:
```
Project: DOCTORES-SEO-PACIENTE-MGMT
Environment: production
Service: @healthcare/api
```

If you forget this step and run `railway up`, it would attempt to deploy to the pgvector database service instead of the API — which would fail but could cause confusion.

---

## Final Configuration State

### Environment Variables

| File | Variable | Value |
|---|---|---|
| `packages/database/.env` | `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/docs_mono` |
| `packages/database/.env` | `LLM_DATABASE_URL` | `postgresql://postgres:...@yamanote.proxy.rlwy.net:51502/railway` |
| `apps/doctor/.env.local` | `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/docs_mono` |
| `apps/doctor/.env.local` | `LLM_DATABASE_URL` | `postgresql://postgres:...@yamanote.proxy.rlwy.net:51502/railway` |

### Connection Flow

| Component | Reads | Connects To |
|---|---|---|
| Main app (patients, appointments, etc.) | `DATABASE_URL` via `@healthcare/database` | Local PostgreSQL `localhost:5432` |
| LLM Assistant (embeddings, RAG pipeline) | `LLM_DATABASE_URL` via `lib/llm-assistant/db.ts` | Railway pgvector `yamanote.proxy.rlwy.net:51502` |

### Railway Services

| Service | CLI Name | Currently Linked | Purpose |
|---|---|---|---|
| API | `@healthcare/api` | **Yes** (active) | Main backend |
| Doctor | `@healthcare/doctor` | No | Doctor dashboard |
| Admin | `@healthcare/admin` | No | Admin dashboard |
| Public | `@healthcare/public` | No | Public website |
| Postgres | `Postgres` | No | Original database (no pgvector) |
| pgvector | `pgvector` | No | LLM Assistant database (pgvector 0.8.1) |

---

## Production Setup (Future)

For production deployment on Railway, the plan is to consolidate into a single pgvector database:

1. **Deploy pgvector-pg17** (already done)
2. **Migrate existing data** from the original Postgres service:
   ```bash
   # From a machine with psql installed
   pg_dump "ORIGINAL_DB_PUBLIC_URL" --no-owner --no-acl > backup.sql
   psql "PGVECTOR_DB_PUBLIC_URL" < backup.sql
   ```
3. **Update the app services' `DATABASE_URL`** in Railway to point to the pgvector DB
4. **`LLM_DATABASE_URL` is not needed** in production — the LLM client falls back to `DATABASE_URL`
5. **Remove the original Postgres service** once verified

After this, production uses one database for everything — the pgvector-pg17 service which supports both regular tables and vector operations.

---

## Troubleshooting

### "Can't reach database server at pgvector.railway.internal:5432"

This happens when using `railway run` to execute commands. The Railway CLI injects the **internal** URL which only works from inside Railway's network. Use the **public** URL (`yamanote.proxy.rlwy.net:51502`) with `--url` instead.

### "@prisma/client module not found" when running test scripts

This is a pnpm monorepo issue — `@prisma/client` is hoisted to a nested `node_modules/.pnpm/` path. Use `pnpm tsx script.js` instead of `node script.js` to resolve modules correctly.

### "type vector does not exist"

The pgvector extension is not enabled in the target database. Run:
```powershell
npx prisma db execute --file packages/database/prisma/migrations/20260125000000_enable_pgvector/migration.sql --url "YOUR_PGVECTOR_DB_URL"
```

### Railway CLI linked to wrong service

Check with `railway status`. If it shows `Service: pgvector` instead of your app service, switch back:
```powershell
railway service @healthcare/api
```

### LLM Assistant connecting to local DB instead of Railway

Verify that `LLM_DATABASE_URL` is set in both:
- `apps/doctor/.env.local` (for `pnpm dev:doctor`)
- `packages/database/.env` (for CLI scripts like `pnpm docs:sync-all`)

---

## Next Steps

The database infrastructure is ready. The remaining step to make the LLM Assistant fully functional is **ingesting the documentation** into the vector database:

```powershell
pnpm docs:sync-all --force
```

This will:
1. Discover all markdown files in `docs/llm-assistant/`
2. Parse them into sections by headings
3. Chunk sections respecting token limits (300-500 tokens)
4. Generate 1536-dim embeddings via OpenAI `text-embedding-3-small`
5. Store chunks with embeddings in `llm_docs_chunks`
6. Generate module summary embeddings in `llm_module_summaries`

After ingestion, start the dev server with `pnpm dev:doctor` and the blue help bubble should appear in the bottom-right corner of the dashboard.
