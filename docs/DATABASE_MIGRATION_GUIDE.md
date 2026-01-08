# Database Migration Guide

## Current Development Approach

During development, we're using **`pnpm prisma db push`** to quickly apply schema changes without creating migration files.

### What this means:
- ✅ **Fast development**: Changes apply immediately to the database
- ✅ **No migration file clutter**: Easier to iterate on features
- ❌ **No migration history**: Database changes aren't tracked in version control
- ❌ **Can't deploy safely**: Production won't have migration files to run

---

## ⚠️ BEFORE DEPLOYING TO PRODUCTION

**You MUST create proper migration files before each deployment!**

### Step-by-Step Process:

#### 1. Stop using `db push` before deployment
Once you're ready to deploy, don't use `db push` anymore.

#### 2. Create a comprehensive migration from current schema

```bash
cd packages/database

# Create migration file that captures ALL current schema changes
pnpm prisma migrate dev --name production_baseline_YYYY_MM_DD

# This will:
# - Generate a migration file with all schema changes
# - Apply it to your dev database
# - Track it in git
```

#### 3. Commit the migration files

```bash
git add packages/database/prisma/migrations/
git commit -m "Add production baseline migration"
```

#### 4. Deploy to production

When deploying, run:

```bash
# In production environment
pnpm prisma migrate deploy
```

This will apply all migration files to production safely.

---

## Development Workflow

### During Feature Development (What we're doing now)
```bash
# Make changes to schema.prisma
# Then:
cd packages/database
pnpm prisma db push
```

### Before Pushing to Main/Deploying
```bash
# Create proper migration
cd packages/database
pnpm prisma migrate dev --name describe_your_changes

# Commit the migration
git add prisma/migrations/
git commit -m "Add migration: describe_your_changes"
```

---

## Features Currently Using `db push` (No migrations yet)

The following features were built using `db push` and **don't have migration files**:

1. ✅ Phase 1: Areas & Subareas
2. ✅ Phase 2: Clients (CRM)
3. ✅ Phase 3: Products Catalog
4. ✅ Phase 4: Quotations & Sales
5. ✅ Phase 5: Purchases & Suppliers
6. ✅ Phase 6: Cash Flow (Flujo de Dinero) - **Current**
7. ✅ Phase 6.1: Ledger-Sales-Purchases Integration - **Current**

**Action Required**: Before deploying, create ONE comprehensive migration that includes all these features.

---

## Example: Creating Production Baseline

```bash
cd packages/database

# 1. Make sure your schema.prisma is up to date with all features
# 2. Create the baseline migration
pnpm prisma migrate dev --name production_baseline_2026_01_07

# 3. Verify the migration file
cat prisma/migrations/XXXXXX_production_baseline_2026_01_07/migration.sql

# 4. Commit to git
git add prisma/migrations/
git commit -m "Add production baseline migration with all Practice Management features"
```

---

## Summary

- **Development**: Use `pnpm prisma db push` for speed
- **Before Deployment**: Create migration with `pnpm prisma migrate dev`
- **Production**: Run `pnpm prisma migrate deploy`
- **Remember**: Migration files = deployment safety! Don't skip this step.

---

## Additional Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [db push vs migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate/db-push)
- [Production Migration Best Practices](https://www.prisma.io/docs/guides/deployment/production-migrations)
