# Database Architecture Guide

**Last Updated:** 2026-02-19

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

### Push Full Schema to Railway via CLI (Step by Step)

When you want to sync your entire `schema.prisma` to the deployed Railway database:

#### 1. Make sure Railway CLI is installed and you're logged in

```powershell
railway --version
railway whoami
```

If not logged in, run:
```powershell
railway login
```

#### 2. Verify you're linked to the correct project

```powershell
railway status
```

Expected output:
```
Project: DOCTORES-SEO-PACIENTE-MGMT
Environment: production
Service: @healthcare/doctor
```

#### 3. Navigate to the database package

```powershell
cd packages/database
```

#### 4. Set the DATABASE_URL to the Railway **public** URL and push

```powershell
$env:DATABASE_URL="postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"; npx prisma db push
```

> **Important:** You MUST use the **public** Railway URL (`yamanote.proxy.rlwy.net`).
> Do NOT use `railway run npx prisma db push` — it injects the **internal** URL (`pgvector.railway.internal`) which is only accessible between Railway services, not from your local machine.

#### 5. Verify success

Expected output:
```
Datasource "db": PostgreSQL database "railway", schemas "llm_assistant, medical_records, practice_management, public" at "yamanote.proxy.rlwy.net:51502"

Your database is now in sync with your Prisma schema. Done in 6.10s
```

The Prisma Client will also be regenerated automatically.

**Get the Railway public URL from:**
- `packages/database/.env` → `LLM_DATABASE_URL`
- Or Railway Dashboard → pgvector service → Variables → `DATABASE_PUBLIC_URL`

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

**Error: `500 Internal Server Error` on a POST that writes to multiple tables**
- A new field was added to `schema.prisma` but the SQL migration was never run against Railway
- The Prisma client was built with the new fields, but the actual DB columns don't exist yet
- Fix: create and run a SQL migration with `ADD COLUMN IF NOT EXISTS` before deploying the code
- See the "Production Deployment Checklist" section below

---

## ⚠️ Production Deployment Checklist

> This checklist exists because of a real incident (2026-02-19) where the ventas feature
> caused cascading 500 errors in production. Root cause: fields added to `schema.prisma`
> were never migrated to the Railway database before the code was deployed.

### What happened

The `LedgerEntry` model had these fields added to `schema.prisma`:

```
transactionType, saleId, purchaseId, clientId, supplierId, paymentStatus, amountPaid
```

No SQL migration files were created for them. The code was deployed and every POST to
`/api/practice-management/ventas` failed with a 500 because Prisma tried to insert into
columns that didn't exist in the production database.

Additionally, because `sale.create()` runs **before** `ledgerEntry.create()` in the handler,
each failed attempt left behind an orphaned `Sale` record. This caused a secondary failure:
a unique constraint violation on `sale_number` on every subsequent attempt.

### The rule: schema changes MUST reach the DB before the code

```
WRONG order:                        CORRECT order:
1. Add fields to schema.prisma  →   1. Add fields to schema.prisma
2. Write code that uses them    →   2. Create SQL migration file
3. git push + Railway deploys   →   3. Run migration against Railway DB  ← do this first
4. 500 errors in production     →   4. git push + Railway deploys
                                →   5. Works
```

### Checklist before every deploy that touches schema.prisma

- [ ] Every new field or table in `schema.prisma` has a corresponding SQL migration file
- [ ] The migration file uses `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` (safe to re-run)
- [ ] The migration has been executed against Railway **before** pushing the code:
  ```powershell
  npx prisma db execute --file packages/database/prisma/migrations/your-file.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
  ```
- [ ] The migration file is committed to git alongside the code change

### Adding columns to an existing table

When adding fields to an existing model (not a new table), the SQL is simpler:

```sql
-- Migration: Add new columns to existing_table
-- Purpose: Brief description
-- Date: YYYY-MM-DD

ALTER TABLE "schema_name"."table_name"
  ADD COLUMN IF NOT EXISTS "column_one" VARCHAR(20) DEFAULT 'default_value',
  ADD COLUMN IF NOT EXISTS "column_two" INTEGER,
  ADD COLUMN IF NOT EXISTS "column_three" DECIMAL(12,2) DEFAULT 0;

-- Add foreign keys if needed (wrapped in DO block so it's safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'table_fk_name'
  ) THEN
    ALTER TABLE "schema_name"."table_name"
      ADD CONSTRAINT "table_fk_name"
      FOREIGN KEY ("column_two") REFERENCES "schema_name"."other_table"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
```

### If you forgot and already deployed (recovery steps)

1. **Identify missing columns** — look at the 500 error in Railway Deploy Logs for the Prisma field name
2. **Create the migration SQL** with `ADD COLUMN IF NOT EXISTS`
3. **Run it against Railway** before doing anything else
4. **Clean up orphaned records** if the failed handler created partial data:
   ```sql
   -- Example: delete sales with no corresponding ledger entry
   DELETE FROM practice_management.sales
   WHERE id IN (
     SELECT s.id FROM practice_management.sales s
     LEFT JOIN practice_management.ledger_entries le ON le.sale_id = s.id
     WHERE le.id IS NULL
   );
   ```
5. **Redeploy** — Railway will pick up the new code, which will now find the columns

---

## Quick Reference

| Task | Command |
|---|---|
| Push schema to local DB | `cd packages/database && pnpm prisma db push` |
| Push schema to Railway | `$env:DATABASE_URL="RAILWAY_URL"; cd packages/database; npx prisma db push` |
| Run migration on Railway | `npx prisma db execute --file packages/database/prisma/migrations/file.sql --url "RAILWAY_URL"` |
| Regenerate Prisma client | `pnpm db:generate` |
| View current schema | `packages/database/prisma/schema.prisma` |
