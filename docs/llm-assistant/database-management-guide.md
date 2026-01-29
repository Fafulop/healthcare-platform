# Database Management Guide: Local vs Deployed

**Last Updated:** 2026-01-28
**Purpose:** Guidelines for managing schema changes across local and deployed databases

---

## Table of Contents

1. [Current Database Architecture](#current-database-architecture)
2. [Understanding the Dual Database Setup](#understanding-the-dual-database-setup)
3. [Adding New Tables: Decision Tree](#adding-new-tables-decision-tree)
4. [Local Development: Adding Non-LLM Tables](#local-development-adding-non-llm-tables)
5. [Local Development: Adding LLM Tables](#local-development-adding-llm-tables)
6. [Production Deployment: Schema Changes](#production-deployment-schema-changes)
7. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
8. [Migration Checklist](#migration-checklist)

---

## Current Database Architecture

### Local Development Environment

```
┌─────────────────────────────────┐
│    Local Development Setup      │
│                                 │
│  Next.js App (pnpm dev:doctor)  │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Main App  │  │    LLM     │  │
│  │  Modules  │  │ Assistant  │  │
│  └─────┬─────┘  └─────┬──────┘  │
│        │               │         │
│   DATABASE_URL    LLM_DATABASE_URL
│        │               │         │
└────────┼───────────────┼─────────┘
         │               │
         ▼               ▼
  ┌──────────────┐ ┌───────────────────┐
  │ Local PG 17  │ │ Railway           │
  │ localhost    │ │ pgvector-pg17     │
  │ :5432        │ │ (remote)          │
  │              │ │                   │
  │ ✅ Main app  │ │ ✅ LLM tables     │
  │   tables     │ │   - chunks        │
  │ - patients   │ │   - summaries     │
  │ - encounters │ │   - cache         │
  │ - templates  │ │   - memory        │
  │ - doctors    │ │   - versions      │
  │ - etc.       │ │   - file hashes   │
  │              │ │                   │
  │ ❌ NO        │ │ ✅ pgvector 0.8.1 │
  │   pgvector   │ │                   │
  └──────────────┘ └───────────────────┘
```

### Production Environment (Railway) - Current State

```
┌─────────────────────────────────────────┐
│    Production (Railway) - CURRENT       │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │ @healthcare  │  │ @healthcare  │    │
│  │ /doctor      │  │ /api         │    │
│  └──────┬───────┘  └──────┬───────┘    │
│         │                 │             │
│         │    DATABASE_URL │             │
│         └────────┬────────┘             │
│                  │                      │
│                  ▼                      │
│  ┌────────────────────┐  ┌───────────┐ │
│  │  Postgres          │  │ pgvector  │ │
│  │  (original)        │  │ (new)     │ │
│  │                    │  │           │ │
│  │  ✅ All app tables │  │ ✅ LLM    │ │
│  │  ❌ NO pgvector    │  │   tables  │ │
│  │                    │  │ ✅ vector │ │
│  │  🔗 Connected to   │  │           │ │
│  │     all services   │  │ 🔗 NOT    │ │
│  │                    │  │   connected│ │
│  └────────────────────┘  └───────────┘ │
└─────────────────────────────────────────┘
```

**⚠️ IMPORTANT:** Production currently has TWO separate databases that are NOT connected. The LLM Assistant **will not work** in production until the migration is complete.

### Production Environment (Railway) - Future State

After migration (see `railway-db-migration-plan.md`):

```
┌─────────────────────────────────────────┐
│    Production (Railway) - FUTURE        │
│                                         │
│  All Railway services connect to        │
│  ONE database with everything:          │
│                                         │
│  ┌──────────────────────────────┐      │
│  │  pgvector (consolidated)     │      │
│  │                              │      │
│  │  ✅ All app tables           │      │
│  │  ✅ All LLM tables           │      │
│  │  ✅ pgvector extension       │      │
│  │                              │      │
│  │  🔗 All services connect here│      │
│  └──────────────────────────────┘      │
└─────────────────────────────────────────┘
```

---

## Understanding the Dual Database Setup

### Why Two Databases in Local Development?

**The Problem:**
- The LLM Assistant requires PostgreSQL with the **pgvector** extension
- pgvector is complex to install on Windows (requires Docker or building from source)
- The rest of the app works fine without pgvector

**The Solution:**
- **Main app data** → Local PostgreSQL (easy setup, no pgvector)
- **LLM data only** → Railway pgvector database (cloud-hosted, has pgvector)

**The Benefit:**
- No complex local setup required
- Regular development workflow unchanged
- LLM features work via remote database connection

### Database Schemas

Both databases use PostgreSQL schemas for organization:

| Schema Name | Purpose | Tables |
|---|---|---|
| `public` | Default schema | users, doctors, articles, reviews, appointments, bookings |
| `medical_records` | EMR module | patients, encounters, prescriptions, templates, media |
| `practice_management` | Business module | clients, sales, purchases, products, ledger |
| `llm_assistant` | AI features | docs_chunks, module_summaries, query_cache, memory |

### Prisma Clients

The application uses **TWO separate Prisma client instances**:

| Client | Import Path | Env Variable | Used By |
|---|---|---|---|
| Main client | `@healthcare/database` | `DATABASE_URL` | All app code (API routes, pages, components) |
| LLM client | `apps/doctor/src/lib/llm-assistant/db.ts` | `LLM_DATABASE_URL` (fallback: `DATABASE_URL`) | LLM assistant code only |

**Key Point:** Both clients are generated from the same `schema.prisma` file, but they connect to different databases at runtime using the `datasourceUrl` option.

---

## Adding New Tables: Decision Tree

When adding a new feature that requires database tables, follow this decision tree:

```
┌─────────────────────────────────────────┐
│  I need to add a new table/model        │
└─────────────┬───────────────────────────┘
              │
              ▼
      ┌───────────────────┐
      │ Is this table for │
      │ LLM/AI features?  │
      │ (embeddings, RAG, │
      │  vector search)   │
      └─────┬─────────────┘
            │
        ┌───┴────┐
        │        │
       YES      NO
        │        │
        ▼        ▼
   ┌─────────┐ ┌──────────────────┐
   │ LLM     │ │ Regular app      │
   │ Table   │ │ table            │
   └────┬────┘ └────┬─────────────┘
        │           │
        │           ▼
        │      ┌─────────────────────────┐
        │      │ Add to schema.prisma    │
        │      │ in appropriate schema:  │
        │      │ - public                │
        │      │ - medical_records       │
        │      │ - practice_management   │
        │      └────┬────────────────────┘
        │           │
        │           ▼
        │      ┌─────────────────────────┐
        │      │ Create SQL migration    │
        │      │ file for JUST this      │
        │      │ table                   │
        │      └────┬────────────────────┘
        │           │
        │           ▼
        │      ┌─────────────────────────┐
        │      │ Execute against LOCAL   │
        │      │ PostgreSQL              │
        │      └────┬────────────────────┘
        │           │
        ▼           ▼
   ┌────────────────────────────────┐
   │ See "Adding LLM Tables"        │
   │ section below                  │
   └────────────────────────────────┘
```

---

## Local Development: Adding Non-LLM Tables

### Step-by-Step Process

#### 1. Add the Model to Prisma Schema

Edit `packages/database/prisma/schema.prisma`:

```prisma
model YourNewModel {
  id          String   @id @default(cuid())
  doctorId    String   @map("doctor_id")

  // Your fields here
  name        String   @db.VarChar(100)
  description String?  @db.Text

  // Timestamps
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  doctor      Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  // Indexes and constraints
  @@index([doctorId])
  @@map("your_table_name")
  @@schema("medical_records")  // or "public" or "practice_management"
}
```

**Important:** Choose the correct schema using `@@schema()`:
- `public` → General tables (users, doctors, reviews)
- `medical_records` → EMR features
- `practice_management` → Business/accounting features
- `llm_assistant` → AI/vector features (requires special handling)

#### 2. Update Related Models

If your new model has relations, update the related models:

```prisma
model Doctor {
  // ... existing fields

  yourNewModels YourNewModel[]  // Add this relation

  // ... rest of model
}
```

#### 3. Create a Standalone SQL Migration File

**DO NOT use `npx prisma db push`** — it will fail trying to push LLM tables with vector types to your local database.

Instead, create a migration file manually:

```sql
-- Migration: Add your_table_name to [schema_name] schema
-- Purpose: Brief description of what this table does
-- Date: 2026-01-XX

CREATE TABLE IF NOT EXISTS schema_name.your_table_name (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    -- Foreign keys
    CONSTRAINT your_table_name_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS your_table_name_doctor_id_idx
    ON schema_name.your_table_name(doctor_id);
```

**Prisma to PostgreSQL Type Mapping:**

| Prisma | PostgreSQL |
|---|---|
| `String` | `TEXT` |
| `String @db.VarChar(N)` | `VARCHAR(N)` |
| `String @db.Text` | `TEXT` |
| `Int` | `INTEGER` |
| `Boolean` | `BOOLEAN` |
| `DateTime` | `TIMESTAMP(3)` |
| `Decimal @db.Decimal(10,2)` | `DECIMAL(10,2)` |
| `Json` | `JSONB` |
| `String[]` | `TEXT[]` |

**Default Value Mapping:**

| Prisma | SQL |
|---|---|
| `@default(now())` | `DEFAULT CURRENT_TIMESTAMP` |
| `@default(cuid())` | No default (app generates) |
| `@default(true)` | `DEFAULT true` |
| `@default(0)` | `DEFAULT 0` |

#### 4. Execute the Migration Against Local Database

```powershell
cd packages/database
npx prisma db execute --file prisma/migrations/your_migration_file.sql --schema prisma/schema.prisma
```

This uses the `DATABASE_URL` from `packages/database/.env` which points to your local PostgreSQL.

**Verify success:**
```
Script executed successfully.
```

#### 5. Regenerate Prisma Client

```powershell
pnpm db:generate
```

This updates the Prisma client with your new model.

#### 6. Verify in Database

```powershell
# Connect to local database
psql -U postgres -d docs_mono

# Check the table exists
\dt schema_name.*

# Check the table structure
\d schema_name.your_table_name
```

---

## Local Development: Adding LLM Tables

### When to Add LLM Tables

Only when you're adding new AI/ML features that require:
- Vector embeddings (1536-dimensional arrays)
- Similarity search
- Vector indexes (HNSW)

### Step-by-Step Process

#### 1. Add Model to Prisma Schema

```prisma
model YourLlmModel {
  id          Int      @id @default(autoincrement())
  content     String   @db.Text
  embedding   Unsupported("vector(1536)")?  // pgvector type
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([metadata])
  @@map("your_llm_table")
  @@schema("llm_assistant")  // MUST use llm_assistant schema
}
```

**Note:** Use `Unsupported("vector(1536)")` for embedding columns.

#### 2. Create SQL Migration for Railway pgvector Database

Create migration file targeting the Railway database:

```sql
-- Migration: Add your_llm_table to llm_assistant schema
-- Target: Railway pgvector database
-- Date: 2026-01-XX

CREATE TABLE IF NOT EXISTS llm_assistant.your_llm_table (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),  -- pgvector type
    metadata JSONB,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Vector similarity index (HNSW)
CREATE INDEX IF NOT EXISTS your_llm_table_embedding_idx
    ON llm_assistant.your_llm_table
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Metadata index
CREATE INDEX IF NOT EXISTS your_llm_table_metadata_idx
    ON llm_assistant.your_llm_table USING gin (metadata);
```

#### 3. Execute Against Railway pgvector Database

```powershell
# Use the public Railway URL
npx prisma db execute --file prisma/migrations/your_llm_migration.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

**Get the URL from:** Railway dashboard → pgvector service → Variables → `DATABASE_PUBLIC_URL`

#### 4. Update LLM Prisma Client Code

If you need to query this new table, update the code in `apps/doctor/src/lib/llm-assistant/`:

```typescript
import { prisma } from '../db';  // LLM-specific client

export async function queryYourLlmTable() {
  const results = await prisma.$queryRaw`
    SELECT id, content, metadata
    FROM llm_assistant.your_llm_table
    WHERE embedding IS NOT NULL
    LIMIT 10
  `;
  return results;
}
```

#### 5. Regenerate Prisma Client

```powershell
pnpm db:generate
```

---

## Production Deployment: Schema Changes

### Current Production State

⚠️ **Production has TWO separate databases:**
- Original `Postgres` service → All app tables, NO pgvector
- New `pgvector` service → Only LLM tables, has pgvector

**This means:**
- New non-LLM tables must be added to BOTH databases
- New LLM tables go only to the pgvector database
- The app services only connect to the original Postgres (for now)

### Adding Non-LLM Tables to Production

You must add the table to **both** Railway databases until migration is complete:

#### 1. Execute Against Original Postgres Database

```powershell
# Get the original Postgres public URL from Railway dashboard
npx prisma db execute --file prisma/migrations/your_migration.sql --url "ORIGINAL_POSTGRES_PUBLIC_URL"
```

#### 2. Execute Against pgvector Database

```powershell
npx prisma db execute --file prisma/migrations/your_migration.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

#### 3. Redeploy App Services

Railway should auto-deploy when you push to git, but you can manually trigger:

```powershell
railway service @healthcare/api
railway redeploy
```

### Adding LLM Tables to Production

Execute only against the pgvector database:

```powershell
npx prisma db execute --file prisma/migrations/your_llm_migration.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

### After Production Migration is Complete

Once you've completed the migration plan in `railway-db-migration-plan.md`:
- Only ONE database exists (pgvector with everything)
- Schema changes only need to execute against that one database
- Process becomes simpler

---

## Common Pitfalls and Solutions

### Pitfall 1: Using `npx prisma db push` in Local Development

**Problem:**
```
npx prisma db push
❌ Error: type "vector" does not exist
```

**Why it happens:**
- `prisma db push` tries to sync the ENTIRE schema to one database
- Your local PostgreSQL doesn't have pgvector
- It fails when trying to create LLM tables with vector types

**Solution:**
- Never use `prisma db push` for local development
- Always create standalone SQL migration files
- Execute migrations selectively against the appropriate database

### Pitfall 2: Forgetting to Add Tables to Both Production Databases

**Problem:**
```
Production app can't find the new table
```

**Why it happens:**
- You added the table to only ONE of the two production databases
- The app services connect to the original Postgres
- If you only added it to pgvector, the app won't see it

**Solution:**
- Until migration is complete, always add non-LLM tables to BOTH production databases
- Use the checklist in the next section

### Pitfall 3: Using Wrong Database URL

**Problem:**
```
Can't reach database server at pgvector.railway.internal:5432
```

**Why it happens:**
- Railway CLI commands inject the internal URL
- Internal URLs only work from within Railway's network
- You're trying to connect from your local machine

**Solution:**
- Use `--url` with the PUBLIC URL (`.proxy.rlwy.net`)
- Get the public URL from Railway dashboard → Service → Variables → `DATABASE_PUBLIC_URL`

### Pitfall 4: Wrong Prisma Client Import in LLM Code

**Problem:**
```typescript
// ❌ WRONG - uses local database
import { prisma } from '@healthcare/database';

// In LLM assistant code, this connects to localhost, not Railway
```

**Why it happens:**
- LLM assistant code needs to use the separate LLM client
- Using the main client connects to the wrong database

**Solution:**
```typescript
// ✅ CORRECT - uses LLM database
import { prisma } from '../db';

// This connects to Railway pgvector via LLM_DATABASE_URL
```

### Pitfall 5: Missing JSONB Type for Json Fields

**Problem:**
```sql
-- ❌ WRONG
field_config JSON

-- In PostgreSQL, JSON type is less efficient
```

**Solution:**
```sql
-- ✅ CORRECT
field_config JSONB

-- JSONB supports indexing and is more efficient
```

**Always use `JSONB` for JSON columns in PostgreSQL.**

---

## Migration Checklist

### Adding a Non-LLM Table (Local Development)

- [ ] Add model to `schema.prisma` with correct `@@schema()` directive
- [ ] Update related models with relation fields
- [ ] Create standalone SQL migration file
- [ ] Execute migration against local database using `--schema prisma/schema.prisma`
- [ ] Verify with `Script executed successfully`
- [ ] Run `pnpm db:generate`
- [ ] Test in local development
- [ ] Commit migration file to git

### Adding a Non-LLM Table (Production - Current State)

- [ ] Complete all local development steps above
- [ ] Get original Postgres public URL from Railway dashboard
- [ ] Execute migration against original Postgres: `--url ORIGINAL_URL`
- [ ] Get pgvector public URL from Railway dashboard
- [ ] Execute migration against pgvector database: `--url PGVECTOR_URL`
- [ ] Redeploy affected Railway services
- [ ] Verify production app works correctly
- [ ] Monitor logs for errors

### Adding an LLM Table

- [ ] Add model to `schema.prisma` with `@@schema("llm_assistant")`
- [ ] Use `Unsupported("vector(1536)")` for embedding fields
- [ ] Create SQL migration with vector types and HNSW indexes
- [ ] Execute against Railway pgvector database: `--url PGVECTOR_URL`
- [ ] Update LLM assistant code to import from `../db`
- [ ] Run `pnpm db:generate`
- [ ] Test locally (connects to Railway pgvector)
- [ ] Commit changes to git

### After Production Migration (Future)

Once migration is complete, the process simplifies:

- [ ] Add model to `schema.prisma`
- [ ] Create SQL migration file
- [ ] Execute against single pgvector database: `--url PGVECTOR_URL`
- [ ] Run `pnpm db:generate`
- [ ] Test locally
- [ ] Deploy to Railway (auto-deploy via git push)

---

## Environment Variable Reference

### Local Development

**File:** `packages/database/.env`
```env
# Main app data (localhost PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docs_mono"

# LLM Assistant data (Railway pgvector)
LLM_DATABASE_URL="postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

**File:** `apps/doctor/.env.local`
```env
# Same as above
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docs_mono"
LLM_DATABASE_URL="postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

### Production (Railway) - Current State

**Services:** `@healthcare/api`, `@healthcare/doctor`, etc.

```env
# Points to original Postgres service (no pgvector)
DATABASE_URL="${{Postgres.DATABASE_URL}}"

# Not set - LLM features won't work in production yet
# LLM_DATABASE_URL=(not set)
```

### Production (Railway) - After Migration

```env
# Points to pgvector service (has everything)
DATABASE_URL="${{pgvector.DATABASE_URL}}"

# Not needed - LLM client falls back to DATABASE_URL
# LLM_DATABASE_URL=(not set or same as DATABASE_URL)
```

---

## Quick Reference Commands

### Execute Migration on Local Database
```powershell
cd packages/database
npx prisma db execute --file prisma/migrations/YOUR_FILE.sql --schema prisma/schema.prisma
```

### Execute Migration on Railway pgvector
```powershell
npx prisma db execute --file prisma/migrations/YOUR_FILE.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

### Execute Migration on Railway Original Postgres
```powershell
npx prisma db execute --file prisma/migrations/YOUR_FILE.sql --url "ORIGINAL_POSTGRES_PUBLIC_URL"
```

### Regenerate Prisma Client
```powershell
pnpm db:generate
```

### Check Local Database Tables
```powershell
psql -U postgres -d docs_mono -c "\dt medical_records.*"
```

### Check Railway Database Tables (via CLI)
```powershell
railway service pgvector
railway run psql -c "\dt llm_assistant.*"
```

---

## Related Documentation

- **Dual Database Architecture:** `docs/llm-assistant/dual-database-architecture.md`
- **pgvector Setup Guide:** `docs/llm-assistant/pgvector-railway-setup.md`
- **Production Migration Plan:** `docs/llm-assistant/railway-db-migration-plan.md`
- **LLM Assistant Technical Spec:** `docs/llm-assistant/TECHNICAL_SPEC.md`

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check the error message carefully
2. Review the [Common Pitfalls](#common-pitfalls-and-solutions) section
3. Verify your environment variables are set correctly
4. Check Railway dashboard for database service status
5. Review Railway logs for connection errors

**Remember:** The dual database setup is temporary for local development convenience. Production will eventually use a single pgvector database for everything.
