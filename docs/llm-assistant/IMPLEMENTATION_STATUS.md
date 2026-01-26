# LLM In-App Help Assistant — Implementation Status

**Last updated:** 2026-01-26
**Status:** Code complete, pending Railway pgvector-pg17 deployment + migration

---

## What Has Been Done

All 6 phases of the implementation plan are **code-complete**. Every file listed below has been created and is ready. The blocker is that the PostgreSQL database needs the `pgvector` extension installed before migrations can run.

### Phase 1: Database Foundation ✅ (code written, not yet applied)

**Files created:**

- `packages/database/prisma/schema.prisma` — EDITED: added `"llm_assistant"` to schemas array, added 6 new models
- `packages/database/prisma/migrations/20260125000000_enable_pgvector/migration.sql` — Enables `vector` extension
- `packages/database/prisma/migrations/20260125000001_add_llm_assistant_schema/migration.sql` — Creates:
  - Schema `llm_assistant`
  - Tables: `llm_docs_chunks`, `llm_module_summaries`, `llm_query_cache`, `llm_conversation_memory`, `llm_docs_versions`, `llm_docs_file_hashes`
  - HNSW vector indexes on `llm_docs_chunks.embedding` and `llm_module_summaries.embedding`
  - SQL functions: `search_chunks()` and `detect_modules()`

**Prisma models added:**

| Model | Table | Purpose |
|-------|-------|---------|
| `LlmDocsChunk` | `llm_docs_chunks` | Document chunks with 1536-dim vector embeddings |
| `LlmModuleSummary` | `llm_module_summaries` | Module descriptions with embeddings for detection |
| `LlmQueryCache` | `llm_query_cache` | SHA-256 response cache with TTL |
| `LlmConversationMemory` | `llm_conversation_memory` | Sliding window conversation context |
| `LlmDocsVersion` | `llm_docs_versions` | Sync version tracking |
| `LlmDocsFileHash` | `llm_docs_file_hashes` | File hash for incremental sync |

**Migration status:** NOT YET APPLIED — requires pgvector extension first.

---

### Phase 2: Core Library ✅

All files in `apps/doctor/src/lib/llm-assistant/`:

| File | Purpose |
|------|---------|
| `constants.ts` | Config: `gpt-4o-mini`, `text-embedding-3-small`, chunk sizes, token budgets, thresholds |
| `types.ts` | All TypeScript interfaces + `LLMAssistantError` class |
| `modules.ts` | 7 module definitions (medical-records, appointments, practice-management, blog, voice-assistant, navigation, general) with keywords, submodules, file paths |
| `tokenizer.ts` | Simple token estimator (words × 1.3), `countTokens()`, `truncateToTokens()` |
| `errors.ts` | Error classification with Spanish user messages and HTTP status codes |
| `embedding.ts` | OpenAI `text-embedding-3-small` client — single + batch with rate limiting |
| `llm-client.ts` | OpenAI `gpt-4o-mini` chat completions client (temp 0.1, max 1024 tokens) |

---

### Phase 3: Ingestion Pipeline ✅

| File | Purpose |
|------|---------|
| `apps/doctor/src/lib/llm-assistant/ingestion/pipeline.ts` | Discovers markdown files in `docs/llm-assistant/`, parses by headings, chunks with overlap, generates embeddings, stores in DB |
| `apps/doctor/src/lib/llm-assistant/sync/index.ts` | Incremental sync with hash-based change detection, version tracking, cache invalidation |
| `scripts/docs-sync.ts` | CLI script with commands: `sync <module>`, `sync-all`, `list`, `status`, `history` |

**Root `package.json`** — EDITED: added scripts `docs:sync`, `docs:sync-all`, `docs:list`, `docs:status`, `docs:history` + added `tsx` devDependency.

---

### Phase 4: Query Pipeline ✅

All files in `apps/doctor/src/lib/llm-assistant/query/`:

| File | Purpose |
|------|---------|
| `cache.ts` | SHA-256 query hashing, cache lookup/save with 24h TTL |
| `module-detector.ts` | Hybrid keyword + embedding module detection (max 3 modules per query) |
| `retriever.ts` | Vector similarity search via `search_chunks()` SQL function, enforces token budget |
| `deduplicator.ts` | Section-based + Jaccard content deduplication |
| `memory.ts` | Sliding window conversation memory (2 turns), load/update/clear/format |
| `prompt-assembler.ts` | Builds system prompt (Spanish), static context, memory, docs, question |
| `pipeline.ts` | Full RAG orchestration: validate → cache → embed → detect → retrieve → dedup → memory → prompt → LLM → cache → memory |

---

### Phase 5: API Endpoints ✅

| File | Method | Auth | Purpose |
|------|--------|------|---------|
| `apps/doctor/src/app/api/llm-assistant/chat/route.ts` | POST | Doctor required | Main chat — `{ question, sessionId }` → `{ answer, sources, confidence, cached }` |
| `apps/doctor/src/app/api/llm-assistant/memory/route.ts` | DELETE | Doctor required | Clear conversation memory by sessionId |
| `apps/doctor/src/app/api/llm-assistant/ingest/route.ts` | POST | Admin only | Trigger ingestion pipeline |

---

### Phase 6: Frontend Chat Widget ✅

| File | Purpose |
|------|---------|
| `apps/doctor/src/hooks/useLlmChat.ts` | Hook: manages messages array, API calls, session ID, loading/error state |
| `apps/doctor/src/components/llm-assistant/ChatWidget.tsx` | Floating blue bubble (bottom-right) + expandable panel with suggestion chips |
| `apps/doctor/src/components/llm-assistant/ChatMessage.tsx` | Message bubble with basic markdown rendering (bold, lists) + source badges |
| `apps/doctor/src/components/llm-assistant/ChatInput.tsx` | Text input with Enter-to-send + send button |
| `apps/doctor/src/components/llm-assistant/ChatSources.tsx` | Module badge source attribution (Expedientes, Citas, Consultorio, etc.) |

**`apps/doctor/src/app/dashboard/layout.tsx`** — EDITED: imported and added `<ChatWidget />` so it appears on all dashboard pages.

---

## Where We Are Now

### Dual-Database Architecture (Implemented)

The LLM assistant uses a **separate Prisma client** (`apps/doctor/src/lib/llm-assistant/db.ts`) that reads `LLM_DATABASE_URL`, falling back to `DATABASE_URL` when not set.

| Env variable | Local development | Production (Railway) |
|---|---|---|
| `DATABASE_URL` | Local PostgreSQL (no pgvector) | Railway pgvector-pg17 |
| `LLM_DATABASE_URL` | Railway pgvector-pg17 | Same as `DATABASE_URL` (or omitted) |

This keeps the local dev experience unchanged for all regular app features (patients, appointments, etc.) while the LLM assistant connects to a remote pgvector-enabled database.

### Additional Migration Issue

`pnpm db:migrate` (which uses Prisma's shadow database) also fails due to a **pre-existing migration ordering bug**: migration `20260105212158_add_per_item_discount_remove_quotation_discount` references `practice_management` schema tables but sorts before `20260105213451_add_practice_management_schema` which creates that schema. This is unrelated to the LLM assistant work. Workaround: use `pnpm db:push` instead of `pnpm db:migrate`.

---

## Setup: Railway pgvector-pg17

Railway's standard PostgreSQL image does **not** include pgvector. You need to deploy a separate **pgvector-pg17** service from the Railway template marketplace.

### Step 1: Deploy pgvector-pg17 on Railway

1. Go to the Railway dashboard
2. Deploy the **pgvector-pg17** template (one-click deploy)
3. Once deployed, get the new service's `DATABASE_URL` from the Variables tab

### Step 2: Configure local environment

Add `LLM_DATABASE_URL` to your local `.env` files:

```bash
# In packages/database/.env (or project root .env)
LLM_DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
```

The main `DATABASE_URL` stays pointing to your local PostgreSQL — nothing changes for the rest of the app.

### Step 3: Apply migrations on the pgvector database

Run the migration SQL files against the **Railway pgvector DB** (not the local DB). You can do this by temporarily setting `DATABASE_URL` for the prisma commands, or by connecting directly via psql:

```bash
# Option A: Use psql directly against the Railway DB
psql "YOUR_LLM_DATABASE_URL" -f packages/database/prisma/migrations/20260125000000_enable_pgvector/migration.sql
psql "YOUR_LLM_DATABASE_URL" -f packages/database/prisma/migrations/20260125000001_add_llm_assistant_schema/migration.sql

# Option B: Use Prisma with a temporary DATABASE_URL override
cd packages/database
DATABASE_URL="YOUR_LLM_DATABASE_URL" npx prisma db execute --file prisma/migrations/20260125000000_enable_pgvector/migration.sql --schema prisma/schema.prisma
DATABASE_URL="YOUR_LLM_DATABASE_URL" npx prisma db execute --file prisma/migrations/20260125000001_add_llm_assistant_schema/migration.sql --schema prisma/schema.prisma
```

### Step 4: Regenerate Prisma client and ingest docs

```bash
# Regenerate Prisma client
pnpm db:generate

# Ingest documentation into vector DB
pnpm docs:sync-all --force

# Start dev server and test
pnpm dev:doctor
```

### Production Setup

In production (Railway), migrate everything to the pgvector-pg17 database:
1. Deploy pgvector-pg17 service
2. Migrate existing data: `pg_dump` from old DB → `pg_restore` to new DB
3. Update the app service's `DATABASE_URL` to point to the new pgvector DB
4. `LLM_DATABASE_URL` is not needed (falls back to `DATABASE_URL`)
5. Remove the old PostgreSQL service

Then open the doctor dashboard in the browser — the blue help bubble should appear in the bottom-right corner.

---

## File Inventory (all new/modified files)

```
MODIFIED:
  packages/database/prisma/schema.prisma                          (added llm_assistant schema + 6 models)
  apps/doctor/src/app/dashboard/layout.tsx                        (added ChatWidget import + render)
  package.json                                                    (added tsx dep + docs:* scripts)

NEW — Database Migrations:
  packages/database/prisma/migrations/20260125000000_enable_pgvector/migration.sql
  packages/database/prisma/migrations/20260125000001_add_llm_assistant_schema/migration.sql

NEW — Core Library (apps/doctor/src/lib/llm-assistant/):
  db.ts                                                          (separate Prisma client using LLM_DATABASE_URL)
  constants.ts
  types.ts
  modules.ts
  tokenizer.ts
  errors.ts
  embedding.ts
  llm-client.ts
  ingestion/pipeline.ts
  sync/index.ts
  query/cache.ts
  query/module-detector.ts
  query/retriever.ts
  query/deduplicator.ts
  query/memory.ts
  query/prompt-assembler.ts
  query/pipeline.ts

NEW — API Endpoints (apps/doctor/src/app/api/llm-assistant/):
  chat/route.ts
  memory/route.ts
  ingest/route.ts

NEW — Frontend (apps/doctor/src/components/llm-assistant/):
  ChatWidget.tsx
  ChatMessage.tsx
  ChatInput.tsx
  ChatSources.tsx

NEW — Hook:
  apps/doctor/src/hooks/useLlmChat.ts

NEW — CLI Script:
  scripts/docs-sync.ts
```

---

## Architecture Overview

```
User asks question in ChatWidget
  → useLlmChat hook calls POST /api/llm-assistant/chat
    → requireDoctorAuth() validates session
    → processQuery() orchestrates RAG pipeline:
        1. Validate input
        2. Check SHA-256 query cache (llm_query_cache)
        3. Generate embedding via OpenAI text-embedding-3-small
        4. Detect modules (hybrid keyword + embedding)
        5. Retrieve chunks via search_chunks() SQL function (pgvector HNSW)
        6. Deduplicate (section + Jaccard)
        7. Load conversation memory (last 2 turns)
        8. Assemble prompt (system + static + memory + docs + question)
        9. Call OpenAI gpt-4o-mini
       10. Save to cache
       11. Update conversation memory
    → Return { answer, sources, confidence, cached }
  → ChatWidget renders answer with source badges
```
