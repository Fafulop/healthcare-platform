# Database Architecture Guide

**Last Updated:** 2026-02-02

---

## Overview

The project uses **PostgreSQL** with the **pgvector** extension for vector embeddings. There are two database environments: local development and deployed (Railway).

---

## Deployed Database (Railway)

A **single pgvector-pg17** database on Railway holds everything:

```
Railway Project: DOCTORES-SEO-PACIENTE-MGMT

  @healthcare/api ──┐
  @healthcare/doctor ──┐
  @healthcare/admin ───┼── DATABASE_URL ──► pgvector-pg17
  @healthcare/public ──┘                   (single database)

                                           Schemas:
                                           ├── public (users, doctors, appointments, blog, etc.)
                                           ├── medical_records (patients, encounters, prescriptions, templates)
                                           ├── practice_management (clients, sales, purchases, products, ledger)
                                           └── llm_assistant (embeddings, cache, memory, vector search)
```

- All Railway app services connect via `DATABASE_URL`
- pgvector extension is enabled (v0.8.1) for vector similarity search
- HNSW indexes and SQL functions (`search_chunks`, `detect_modules`) are available
- `LLM_DATABASE_URL` is **not needed** in production — the LLM Prisma client falls back to `DATABASE_URL`

**Railway pgvector public URL:**
```
postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway
```

---

## Local Development Database

Local development uses **two database connections**:

```
Local Machine (pnpm dev:doctor)

  Main App Modules ── DATABASE_URL ──────► Local PostgreSQL (localhost:5432)
  (patients, appts,                        All app tables (no pgvector)
   medical records,
   practice mgmt)

  LLM Assistant ───── LLM_DATABASE_URL ──► Railway pgvector (yamanote.proxy.rlwy.net:51502)
  (embeddings, RAG,                        LLM tables + pgvector extension
   chat, cache)
```

### Why two connections locally?

- pgvector is difficult to install on Windows (requires Docker or building from source)
- The main app works perfectly without pgvector
- The LLM Assistant connects to the Railway DB remotely for vector operations
- Regular development workflow stays simple and unchanged

### Prisma Clients

| Client | Import Path | Env Variable | Used By |
|---|---|---|---|
| Main | `@healthcare/database` | `DATABASE_URL` | All app code |
| LLM | `apps/doctor/src/lib/llm-assistant/db.ts` | `LLM_DATABASE_URL` (fallback: `DATABASE_URL`) | LLM assistant only |

Both are generated from the same `schema.prisma` but connect to different databases at runtime.

---

## PostgreSQL Schemas

| Schema | Purpose | Example Tables |
|---|---|---|
| `public` | Core app tables | users, doctors, appointments, bookings, articles, reviews |
| `medical_records` | EMR module | patients, encounters, prescriptions, templates, media |
| `practice_management` | Business module | clients, sales, purchases, products, suppliers, ledger |
| `llm_assistant` | AI/vector features | docs_chunks, module_summaries, query_cache, conversation_memory |

---

## Environment Variables

### Local Development

**`packages/database/.env`**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docs_mono"
LLM_DATABASE_URL="postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

**`apps/doctor/.env.local`**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docs_mono"
LLM_DATABASE_URL="postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

### Production (Railway)

Set on each Railway app service:
```env
DATABASE_URL="${{pgvector.DATABASE_URL}}"
# LLM_DATABASE_URL is NOT set — falls back to DATABASE_URL automatically
```

---

## Pushing Schema Changes to Databases

### ⚠️ IMPORTANT: DO NOT Use `prisma db push`

**DO NOT run `pnpm prisma db push` or `npx prisma db push`** — it will fail with the error:
```
Error: ERROR: type "vector" does not exist
```

**Why it fails:**
- `prisma db push` tries to sync the ENTIRE schema to one database
- Your local PostgreSQL doesn't have the pgvector extension
- It fails when trying to create LLM tables with vector types

**The Solution:** Use standalone SQL migration files instead.

---

### Development Workflow: Adding Non-LLM Tables

When adding new tables to the `public`, `medical_records`, or `practice_management` schemas:

#### 1. Add the Model to `schema.prisma`

```prisma
model YourNewModel {
  id          String   @id @default(cuid())
  doctorId    String   @map("doctor_id")
  // ... your fields

  doctor      Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@index([doctorId])
  @@map("your_table_name")
  @@schema("public")  // or "medical_records" or "practice_management"
}
```

#### 2. Create a SQL Migration File

Create a file in `packages/database/prisma/migrations/` with a descriptive name (e.g., `add-your-table.sql`):

```sql
-- Migration: Add your_table_name to public schema
-- Purpose: Brief description
-- Date: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS public.your_table_name (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    -- your columns here
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT your_table_name_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS your_table_name_doctor_id_idx
    ON public.your_table_name(doctor_id);
```

**Prisma to PostgreSQL Type Mapping:**
- `String` → `TEXT`
- `String @db.VarChar(N)` → `VARCHAR(N)`
- `Int` → `INTEGER`
- `Boolean` → `BOOLEAN`
- `DateTime` → `TIMESTAMP(3)`
- `Decimal @db.Decimal(10,2)` → `DECIMAL(10,2)`
- `Json` → `JSONB`
- `String[]` → `TEXT[]`

#### 3. Execute Against Local Database

```powershell
cd packages/database
npx prisma db execute --file prisma/migrations/your-file.sql --schema prisma/schema.prisma
```

**Expected output:**
```
Script executed successfully.
```

#### 4. Regenerate Prisma Client

```powershell
pnpm db:generate
```

#### 5. Test Locally

Verify the table exists and your code works with it.

---

### Production Deployment: Syncing to Railway

**Only push to Railway after testing locally!**

When you're ready to deploy your schema changes to the Railway database:

```powershell
cd packages/database
npx prisma db execute --file prisma/migrations/your-file.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
```

**Expected output:**
```
Script executed successfully.
```

**Get the Railway URL from:**
- Railway Dashboard → pgvector service → Variables → `DATABASE_PUBLIC_URL`
- Or use the URL from `packages/database/.env` → `LLM_DATABASE_URL`

---

### Important Notes

- **Always test locally first** before pushing to Railway
- **Create separate migration files** for each schema change
- **Use the `--schema` flag** for local execution to specify the schema file
- **Use the `--url` flag** for Railway execution with the public URL
- **Commit migration files to git** so other developers can run them too
- **Never use `--force`** as it can cause data loss

### When to Push to Railway

Push schema changes to Railway when:
- You've tested the changes locally and everything works
- You're about to deploy code that depends on the schema changes
- After merging a PR that includes new database models

---

### Adding LLM Tables (Advanced)

For LLM tables in the `llm_assistant` schema (with vector types):
- Create SQL migration with `vector(1536)` types
- Execute ONLY against Railway pgvector database (skip local)
- See `docs/llm-assistant/database-management-guide.md` for details

---

### Troubleshooting

**Error: `type "vector" does not exist`**
- You tried to use `prisma db push` — use SQL migrations instead
- Or you tried to push an LLM table to local database — only push to Railway

**Error: `relation does not exist`**
- The table hasn't been created yet — run the migration
- Check you're using the correct schema name in the SQL file

**Error: `node is not recognized`**
- Run the command from PowerShell or VS Code terminal
- Ensure Node.js is installed and in your PATH

---

## Quick Reference

| Task | Command |
|---|---|
| Push schema to local DB | `cd packages/database && pnpm prisma db push` |
| Push schema to Railway | `$env:DATABASE_URL="RAILWAY_URL"; cd packages/database; npx prisma db push` |
| Regenerate Prisma client | `pnpm db:generate` |
| View current schema | `packages/database/prisma/schema.prisma` |
