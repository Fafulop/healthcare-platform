# Dual-Database Architecture for LLM Assistant

**Date:** 2026-01-26
**Scope:** Local development database isolation for the LLM Assistant module

---

## Problem

The LLM Assistant requires PostgreSQL with the **pgvector** extension to store and query vector embeddings (1536-dimensional vectors from OpenAI's `text-embedding-3-small` model). The local development PostgreSQL 17 on Windows does not have pgvector installed, and installing it locally requires either Docker, building from source with Visual Studio C++ tools, or using a cloud database.

Meanwhile, the rest of the application (patients, appointments, medical records, practice management, blog, etc.) works perfectly on the local PostgreSQL without pgvector.

The original design had all code — including the LLM Assistant — using a single `DATABASE_URL` via the shared Prisma client from `@healthcare/database`. This meant that to use the LLM Assistant locally, you'd have to either:

1. **Point everything to a remote DB** — which would mix local development data with production/remote data for all modules, not just the LLM assistant.
2. **Install pgvector locally** — which adds friction to the development setup.

Neither option is ideal.

---

## Solution: Separate Prisma Client with `LLM_DATABASE_URL`

The LLM Assistant now uses its own dedicated Prisma client that reads from a separate environment variable: `LLM_DATABASE_URL`. If that variable is not set, it falls back to `DATABASE_URL`.

This allows two independent database connections to coexist:

| Component | Prisma Client | Env Variable | Local Dev Target | Production Target |
|---|---|---|---|---|
| Main app (patients, appointments, etc.) | `@healthcare/database` | `DATABASE_URL` | Local PostgreSQL | Railway pgvector-pg17 |
| LLM Assistant (embeddings, RAG) | `lib/llm-assistant/db.ts` | `LLM_DATABASE_URL` → `DATABASE_URL` | Railway pgvector-pg17 | Same as `DATABASE_URL` |

### In local development

```
┌─────────────────────────────────┐
│         Next.js App             │
│    (pnpm dev:doctor)            │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Main App  │  │    LLM     │  │
│  │  Modules  │  │ Assistant  │  │
│  └─────┬─────┘  └─────┬──────┘  │
│        │               │        │
│   DATABASE_URL    LLM_DATABASE_URL
│        │               │        │
└────────┼───────────────┼────────┘
         │               │
         ▼               ▼
  ┌──────────────┐ ┌───────────────────┐
  │ Local        │ │ Railway           │
  │ PostgreSQL   │ │ pgvector-pg17     │
  │ (port 5432)  │ │ (remote)          │
  │              │ │                   │
  │ - patients   │ │ - llm_docs_chunks │
  │ - appts      │ │ - llm_module_sum. │
  │ - medical    │ │ - llm_query_cache │
  │ - practice   │ │ - llm_conv_memory │
  │ - blog       │ │ - llm_docs_vers.  │
  │ - etc.       │ │ - llm_docs_hashes │
  └──────────────┘ └───────────────────┘
```

### In production (Railway)

```
┌─────────────────────────────────┐
│         Next.js App             │
│    (Railway deployment)         │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Main App  │  │    LLM     │  │
│  │  Modules  │  │ Assistant  │  │
│  └─────┬─────┘  └─────┬──────┘  │
│        │               │        │
│   DATABASE_URL    LLM_DATABASE_URL
│        │          (not set, falls │
│        │           back to        │
│        │           DATABASE_URL)  │
└────────┼───────────────┼────────┘
         │               │
         ▼               ▼
     ┌──────────────────────┐
     │  Railway             │
     │  pgvector-pg17       │
     │  (single database)   │
     │                      │
     │  ALL tables:         │
     │  - patients          │
     │  - appointments      │
     │  - llm_docs_chunks   │
     │  - etc.              │
     └──────────────────────┘
```

---

## What Changed

### New file: `apps/doctor/src/lib/llm-assistant/db.ts`

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

**Key design decisions:**

1. **Singleton pattern with `globalThis`** — Same pattern used by the main Prisma client in `packages/database/src/index.ts`. Prevents multiple PrismaClient instances during hot reload in Next.js development mode. Uses a separate global key (`llmPrisma`) so it doesn't collide with the main client.

2. **`datasourceUrl` override** — Prisma's `PrismaClient` constructor accepts a `datasourceUrl` option that overrides the `url` in `schema.prisma`. This lets us point the same Prisma schema (with all models) to a different database at runtime.

3. **Fallback to `DATABASE_URL`** — If `LLM_DATABASE_URL` is not set, the client uses `DATABASE_URL`. This means production deployments don't need any extra configuration — the LLM assistant automatically uses the same database as everything else.

4. **Reduced logging** — The LLM client only logs `error` and `warn` in development (not `query`), to avoid noise from vector operations in the console. The main Prisma client logs queries in development for debugging regular app operations.

### Updated files (import path change)

Six files had their import changed from:

```typescript
import { prisma } from '@healthcare/database';
```

to:

```typescript
import { prisma } from '../db';
```

The variable name stays `prisma` so no other code in these files needed to change. The files:

| File | Database Operations |
|---|---|
| `ingestion/pipeline.ts` | File hash lookup, chunk DELETE/INSERT (raw SQL for vectors), file hash upsert, module summary upsert |
| `query/cache.ts` | Cache findUnique, delete (expired), update (hit count), upsert (save), raw SQL delete (module invalidation) |
| `query/memory.ts` | Memory findUnique, delete (expired/clear), upsert (sliding window) |
| `query/retriever.ts` | Raw SQL: `llm_assistant.search_chunks()` function call |
| `query/module-detector.ts` | Raw SQL: `llm_assistant.detect_modules()` function call |
| `sync/index.ts` | Chunk count, file hash count, version findFirst/create, cache delete, file hash findFirst, version findMany |

### Files NOT changed

These files do not use the database and needed no changes:

- `constants.ts` — Configuration values only
- `types.ts` — TypeScript interfaces only
- `tokenizer.ts` — Pure computation
- `errors.ts` — Error definitions only
- `embedding.ts` — OpenAI API calls only (no DB)
- `llm-client.ts` — OpenAI API calls only (no DB)
- `modules.ts` — Static module definitions
- `query/pipeline.ts` — Orchestrator, uses the other query modules (no direct DB imports)
- `query/deduplicator.ts` — Pure computation
- `query/prompt-assembler.ts` — String building only
- `scripts/docs-sync.ts` — CLI entry point, imports from sync module (no direct DB imports)
- All API routes (`chat/route.ts`, `memory/route.ts`, `ingest/route.ts`) — Delegate to library functions

---

## Environment Configuration

### Local development `.env`

Add `LLM_DATABASE_URL` to your environment. This can go in:
- `packages/database/.env` (Prisma reads this)
- `.env.local` at the project root (Next.js reads this)
- Both locations if needed

```env
# Existing — points to local PostgreSQL (unchanged)
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/docs_mono?schema=public"

# New — points to Railway pgvector-pg17 service
LLM_DATABASE_URL="postgresql://postgres:RAILWAY_PASSWORD@RAILWAY_HOST:RAILWAY_PORT/railway"
```

### Production environment (Railway)

No changes needed. `LLM_DATABASE_URL` does not need to be set. The LLM Prisma client falls back to `DATABASE_URL` automatically, which should point to the pgvector-pg17 database (after migrating all data to it).

If you prefer to be explicit, you can set `LLM_DATABASE_URL` to the same value as `DATABASE_URL` in the Railway service environment variables.

---

## Why Not Use a Completely Separate Prisma Schema?

An alternative approach would be to create a second `schema.prisma` file with only the LLM models and generate a separate Prisma client package. This was considered but rejected because:

1. **Same models, same schema** — The 6 LLM models are already defined in the main `schema.prisma`. Duplicating them into a second schema would create maintenance burden and risk drift.

2. **Prisma's `datasourceUrl` is sufficient** — The `PrismaClient` constructor accepts a runtime database URL override, so we can reuse the same generated client with a different connection.

3. **Simpler migration path** — In production, everything lives in one database. The dual-connection is a local development convenience only. A second schema would add permanent complexity for a local-only concern.

4. **Schema isolation already exists** — The LLM tables live in the `llm_assistant` PostgreSQL schema (not `public`). They are logically separated at the database level regardless of which Prisma client connects.

---

## Schema Isolation

The LLM Assistant tables use their own PostgreSQL schema: `llm_assistant`. This is separate from the other schemas used by the app:

| PostgreSQL Schema | Used By |
|---|---|
| `public` | Default tables (patients, users, etc.) |
| `medical_records` | Medical records module |
| `practice_management` | Practice management module |
| `llm_assistant` | LLM Assistant (embeddings, cache, memory) |

This means even when both Prisma clients point to the same database (production), the LLM tables are isolated in their own namespace and won't collide with anything.

---

## Limitations and Trade-offs

1. **Two connections in dev** — Local development now opens two database connections: one to local PostgreSQL, one to Railway. This is negligible for development but worth being aware of.

2. **Network latency for LLM queries** — In local dev, the LLM assistant's database operations go over the network to Railway. This adds latency to RAG queries. However, since the LLM assistant also calls OpenAI's API (which is also remote), the additional DB latency is a small fraction of total response time.

3. **Prisma client size** — Both Prisma clients share the same generated code (all models). The LLM client technically has access to all models (patients, appointments, etc.) on the remote DB, even though it only uses the `Llm*` models. This is not a security concern for development, but something to be aware of.

4. **Migrations must target the right DB** — When applying LLM-related migrations, you must ensure they run against the pgvector database, not the local one. See the setup steps in `IMPLEMENTATION_STATUS.md`.
