# Railway Database Services — Current State & Migration Plan

**Date:** 2026-01-26
**Status:** Local development fully working. Production migration pending.

---

## Current State of Railway Services

The Railway project `DOCTORES-SEO-PACIENTE-MGMT` currently has **two separate, unconnected** database services:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Railway Project                                   │
│                    DOCTORES-SEO-PACIENTE-MGMT                       │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ @healthcare  │  │ @healthcare  │  │ @healthcare  │  ...more     │
│  │ /api         │  │ /doctor      │  │ /admin       │  services    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         │    DATABASE_URL │                 │                       │
│         └────────┬────────┘─────────────────┘                       │
│                  │                                                   │
│                  ▼                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐            │
│  │  Postgres            │      │  pgvector             │            │
│  │  (original service)  │      │  (new service)        │            │
│  │                      │      │                       │            │
│  │  ✅ All app tables:  │      │  ❌ NO app tables     │            │
│  │  - patients          │      │                       │            │
│  │  - appointments      │      │  ✅ LLM tables only:  │            │
│  │  - medical_records   │      │  - llm_docs_chunks    │            │
│  │  - practice_mgmt     │      │  - llm_module_summ.   │            │
│  │  - users             │      │  - llm_query_cache    │            │
│  │  - blog              │      │  - llm_conv_memory    │            │
│  │  - etc.              │      │  - llm_docs_versions  │            │
│  │                      │      │  - llm_docs_hashes    │            │
│  │  ❌ NO pgvector      │      │                       │            │
│  │  (can't install it)  │      │  ✅ pgvector 0.8.1    │            │
│  │                      │      │  ✅ HNSW indexes      │            │
│  │                      │      │  ✅ SQL functions      │            │
│  └──────────────────────┘      └──────────────────────┘            │
│         ▲                              ▲                            │
│         │                              │                            │
│  All Railway app                 Nothing points                     │
│  services connect                here yet (only                     │
│  here via DATABASE_URL           local dev uses it                  │
│                                  via LLM_DATABASE_URL)              │
└─────────────────────────────────────────────────────────────────────┘
```

### What each service contains

**Postgres (original):**
- All application data: patients, users, appointments, medical records, practice management, blog, etc.
- All Prisma migrations applied
- Connected to all Railway app services (`@healthcare/api`, `@healthcare/doctor`, `@healthcare/admin`, `@healthcare/public`)
- **Cannot** install pgvector — Railway's standard PostgreSQL image doesn't include it

**pgvector (new):**
- Only the 6 LLM assistant tables in the `llm_assistant` schema
- pgvector 0.8.1 extension enabled
- HNSW vector indexes and SQL functions (`search_chunks`, `detect_modules`)
- 63 document chunks with embeddings (ingested from 24 markdown files)
- **Not connected** to any Railway app service
- Only used by local development via `LLM_DATABASE_URL`

### The problem

The two services are completely separate databases. They don't share data, connections, or schemas. For the LLM Assistant to work in **production** (deployed on Railway), the app needs access to both the regular tables AND the vector tables in the same database — or the app needs to be configured to use two connections (like we did for local development).

---

## Current Local Development Setup (Working)

Local development uses the dual-database architecture:

```
┌─────────────────────────────────┐
│    Local Machine (dev)          │
│                                 │
│  pnpm dev:doctor                │
│                                 │
│  Main app ──DATABASE_URL──────► Local PostgreSQL (localhost:5432)
│                                 │  All app tables
│                                 │
│  LLM Assistant ─LLM_DATABASE_URL──► Railway pgvector (yamanote.proxy.rlwy.net:51502)
│                                      │  LLM tables + embeddings
└─────────────────────────────────┘
```

This works because:
- `db.ts` reads `LLM_DATABASE_URL` for the LLM Prisma client
- The main app uses `DATABASE_URL` via `@healthcare/database`
- Two separate Prisma client instances, two separate connections

---

## What Needs to Happen for Production

### The Goal

One database (pgvector-pg17) with **everything** — all app tables + all LLM tables + pgvector extension:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Railway Project (AFTER migration)                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ @healthcare  │  │ @healthcare  │  │ @healthcare  │              │
│  │ /api         │  │ /doctor      │  │ /admin       │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         │    DATABASE_URL │                 │                       │
│         └────────┬────────┘─────────────────┘                       │
│                  │                                                   │
│                  ▼                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐            │
│  │  Postgres            │      │  pgvector             │            │
│  │  (DELETED)           │      │  (single database)    │            │
│  │                      │      │                       │            │
│  │  ██████████████████  │      │  ✅ All app tables    │            │
│  │  ██  REMOVED   ████  │      │  ✅ All LLM tables    │            │
│  │  ██████████████████  │      │  ✅ pgvector 0.8.1    │            │
│  │                      │      │  ✅ HNSW indexes      │            │
│  └──────────────────────┘      │  ✅ SQL functions      │            │
│                                │  ✅ All data           │            │
│                                └──────────────────────┘            │
│                                        ▲                            │
│                                        │                            │
│                                 All Railway app                     │
│                                 services connect                    │
│                                 here via DATABASE_URL               │
└─────────────────────────────────────────────────────────────────────┘
```

After migration:
- `LLM_DATABASE_URL` is **not needed** in production (the LLM client falls back to `DATABASE_URL`)
- One database, one connection, all data in one place
- The old Postgres service is deleted

---

## Migration Steps

### Prerequisites

- `psql` and `pg_dump` installed locally (comes with PostgreSQL installation, or install standalone)
- Public connection URLs for both Railway database services
- A maintenance window (the app should be briefly paused during the switchover)

### Step 1: Get both public connection strings

From the Railway dashboard:

| Service | Where to find the URL |
|---|---|
| **Postgres** (original) | Service → Variables → `DATABASE_PUBLIC_URL` |
| **pgvector** (new) | Service → Variables → `DATABASE_PUBLIC_URL` |

The pgvector public URL is already known:
```
postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway
```

You need the original Postgres public URL too. It will look similar but with a different host/port.

### Step 2: Dump the original database

```powershell
pg_dump "ORIGINAL_POSTGRES_PUBLIC_URL" --no-owner --no-acl --clean --if-exists > backup.sql
```

Flags explained:
- `--no-owner` — Don't include ownership commands (Railway uses the `postgres` user for both)
- `--no-acl` — Don't include permission grants
- `--clean --if-exists` — Add DROP IF EXISTS before CREATE, so it's safe to re-run

This creates a `backup.sql` file with all schemas, tables, data, indexes, and constraints from the original database.

### Step 3: Restore into the pgvector database

```powershell
psql "postgresql://postgres:vax7afoxoyns8umlhkbpehxmq7nty7mv@yamanote.proxy.rlwy.net:51502/railway" < backup.sql
```

This imports all the app tables into the pgvector database. The LLM tables already exist there, so they will be preserved (the `--clean --if-exists` flags only drop tables that exist in the dump, and the LLM tables are NOT in the dump since they were never in the original database).

**Expected result:** The pgvector database now has:
- All app schemas: `public`, `medical_records`, `practice_management`
- All app tables: patients, users, appointments, etc.
- All LLM tables: `llm_assistant` schema (already there)
- pgvector extension (already there)

### Step 4: Verify the data

Connect to the pgvector database and verify:

```powershell
# Check app tables exist
psql "PGVECTOR_PUBLIC_URL" -c "SELECT table_schema, count(*) FROM information_schema.tables WHERE table_schema IN ('public', 'medical_records', 'practice_management', 'llm_assistant') GROUP BY table_schema ORDER BY table_schema;"

# Check row counts for critical tables
psql "PGVECTOR_PUBLIC_URL" -c "SELECT count(*) as patients FROM public.patients;"
psql "PGVECTOR_PUBLIC_URL" -c "SELECT count(*) as users FROM public.users;"
```

### Step 5: Update Railway app services' DATABASE_URL

In the Railway dashboard, for **each app service** (`@healthcare/api`, `@healthcare/doctor`, `@healthcare/admin`, `@healthcare/public`):

1. Go to the service → Variables tab
2. Find `DATABASE_URL`
3. Change it to reference the **pgvector** service's internal URL

The recommended approach is to use Railway's **reference variables**:
- Instead of hardcoding the URL, set `DATABASE_URL` to reference the pgvector service: `${{pgvector.DATABASE_URL}}`
- This way if the pgvector service's credentials change, the app services automatically pick up the new value

Alternatively, copy the pgvector service's **internal** URL (not the public one):
```
postgresql://postgres:PASSWORD@pgvector.railway.internal:5432/railway
```

**Important:** Use the **internal** URL (`.railway.internal`) for service-to-service connections within Railway. The public URL (`proxy.rlwy.net`) is only for external access.

### Step 6: Redeploy all app services

After changing the `DATABASE_URL`, Railway should automatically trigger redeployments. If not, manually redeploy each service:

```powershell
railway service @healthcare/api
railway redeploy
railway service @healthcare/doctor
railway redeploy
railway service @healthcare/admin
railway redeploy
railway service @healthcare/public
railway redeploy
```

### Step 7: Verify production is working

- Open the production app in the browser
- Check that patients, appointments, and other data loads correctly
- Test the LLM Assistant chat widget (if deployed)
- Check the API service logs for any database connection errors

### Step 8: Add LLM_DATABASE_URL to Railway (optional)

Since production uses a single database, `LLM_DATABASE_URL` is **not needed** — the LLM Prisma client in `db.ts` falls back to `DATABASE_URL`. However, if you want to be explicit:

- Go to `@healthcare/doctor` service → Variables
- Add: `LLM_DATABASE_URL=${{pgvector.DATABASE_URL}}`

### Step 9: Delete the old Postgres service

**Only after confirming everything works on the pgvector database:**

1. Keep the old service running for a few days as a safety net
2. Once confident, go to the old Postgres service → Settings → Delete Service
3. This is irreversible — make sure you have verified data integrity first

### Step 10: Update local development LLM_DATABASE_URL (if needed)

If the pgvector service's credentials change during the migration, update `LLM_DATABASE_URL` in:
- `apps/doctor/.env.local`
- `packages/database/.env`
- `.env` (root)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Data loss during migration | High | Keep old Postgres service running until verified |
| App downtime during switchover | Medium | Schedule during low-traffic period; change DATABASE_URL and redeploy quickly |
| LLM tables overwritten by restore | Low | LLM tables are in `llm_assistant` schema which doesn't exist in the original DB dump |
| Connection string misconfiguration | Medium | Test with a single service first (e.g., `@healthcare/api`) before updating all |
| Missing Prisma migrations on pgvector DB | Medium | After restore, run `pnpm db:push` against the pgvector DB to ensure schema sync |

---

## After Migration: Updated Local Development Setup

Once production is migrated to the pgvector database, the local development setup remains the same:

| Variable | Local Dev | Production |
|---|---|---|
| `DATABASE_URL` | `localhost:5432/docs_mono` (local PG) | pgvector service internal URL |
| `LLM_DATABASE_URL` | Railway pgvector public URL | Not set (falls back to `DATABASE_URL`) |

Nothing changes for local development — it continues using the local PostgreSQL for the main app and the Railway pgvector service for the LLM assistant.

---

## Timeline Recommendation

1. **Now:** Local development is fully working. No urgency for production migration.
2. **Before deploying LLM Assistant to production:** Complete the migration so the deployed app can access both app data and vector data in one database.
3. **After migration:** Monitor for a few days, then delete the old Postgres service.

The LLM Assistant chat widget is already in the `dashboard/layout.tsx`, so it will appear in production once the doctor app is deployed. However, it will fail to answer questions unless the production database has the LLM tables with ingested data — which requires completing this migration first.
