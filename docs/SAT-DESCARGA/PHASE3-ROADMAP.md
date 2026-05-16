# SAT Descarga — Phase 3+ Roadmap

**Date:** 2026-05-16
**Status:** IN PROGRESS (4 of 9 features complete)
**Depends on:** Phase 2 (COMPLETE — metadata + XML download working)

---

## Database Context

All SAT tables live in the `practice_management` schema on a single Railway PostgreSQL (pgvector-pg17).
FKs reference `public.doctors(id)` cross-schema.

**Existing tables (Phase 1+2):**
- `practice_management.sat_sync_jobs` — job queue
- `practice_management.sat_cfdi_metadata` — metadata from TXT (UUID uppercase)
- `practice_management.sat_cfdi_details` — parsed XML fields (UUID lowercase)
- `practice_management.sat_cfdi_conceptos` — line items per CFDI
- `practice_management.doctor_fiscal_profiles` — e.Firma storage + config

**Migration workflow (see `docs/NEW.MD-GUIDES/database-architecture.md`):**
1. Add model to `packages/database/prisma/schema.prisma` with `@@schema("practice_management")`
2. Create SQL file in `packages/database/prisma/migrations/` with `CREATE TABLE IF NOT EXISTS`
3. Run against Railway: `npx prisma db execute --file ... --url "RAILWAY_URL"`
4. Regenerate client: `pnpm db:generate`
5. Then push code

**Key gotcha:** UUID case mismatch — metadata has UPPERCASE, details has lowercase. Always use `LOWER()` in JOINs.

---

## 1. Export to CSV/Excel — COMPLETE

**Status:** DONE (deployed 2026-05-16)

**What was built:**
- `GET /api/sat-descarga/export?month=YYYY-MM&type=details|metadata|resumen&direction=emitted|received`
- Three export modes: metadata (basic), details (enriched with XML fields), resumen (annual fiscal)
- CSV injection prevention: all text fields escaped
- Frontend: ExportButton component with authenticated blob download
- Buttons in CfdiList tab (details + metadata) and Resumen Fiscal tab

**Files:**
- `apps/api/src/app/api/sat-descarga/export/route.ts`
- `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (ExportButton component + buttons)

---

## 2. Auto-sync Cron — COMPLETE

**Status:** DONE (deployed 2026-05-16, migration applied)

**What was built:**
- `POST /api/cron/sat-auto-sync` — protected by CRON_SECRET
- Queries doctors with `fielUploaded=true` AND `autoSyncEnabled=true` (limit 5/run)
- For each: checks if completed job exists in last 3 days, skips active jobs
- Creates metadata + XML jobs for both directions (current month)
- Migration: `auto_sync_enabled BOOLEAN DEFAULT TRUE` on `doctor_fiscal_profiles`

**Railway cron integration:**
```typescript
// Add to Railway cron script after sat-sync-worker calls:
const dayOfMonth = new Date().getUTCDate();
if (dayOfMonth % 3 === 0 && hourUtc === 6) {
  await callEndpoint("sat-auto-sync", "/api/cron/sat-auto-sync");
}
```

**Files:**
- `apps/api/src/app/api/cron/sat-auto-sync/route.ts`
- `packages/database/prisma/migrations/add-auto-sync-enabled.sql`
- `packages/database/prisma/schema.prisma` (autoSyncEnabled field)

---

## 3. Alerts (Cancellations & New CFDIs) — COMPLETE

**Status:** DONE (deployed 2026-05-16, migration applied)

**What was built:**
- Table: `practice_management.sat_alerts` with partial index on `(doctor_id, read) WHERE read = FALSE`
- Worker integration: after metadata upsert, checks if UUID is new or status changed to Cancelado
  - Creates alert type `new_cfdi` or `cancelled` with message and monto
  - Skips alert generation if >50 new items (prevents flooding on first-time sync)
- API: `GET /api/sat-descarga/alerts` — returns alerts list + unread count
- API: `PATCH /api/sat-descarga/alerts` — mark read by `{ ids: [...] }` or `{ all: true }`
- UI: AlertsBell component in page header
  - Bell icon with red unread badge (9+ cap)
  - Dropdown with color-coded alerts (green=new, red=cancelled)
  - "Marcar leídas" button to dismiss all
  - Timestamps in es-MX locale

**Files:**
- `packages/database/prisma/migrations/add-sat-alerts.sql`
- `packages/database/prisma/schema.prisma` (SatAlert model + Doctor relation)
- `apps/api/src/app/api/sat-descarga/alerts/route.ts`
- `apps/api/src/app/api/cron/sat-sync-worker/route.ts` (alert generation in downloadAndParseMetadata)
- `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (AlertsBell component)

---

## 4. Complementos de Pago Tracking

**Goal:** Link payment complement CFDIs (type P) to their parent invoices, showing which invoices are paid/pending.

### Scope
- Parse payment complements (pago20: namespace in XML) to extract:
  - Related document UUID (the invoice being paid)
  - Amount paid (ImpPagado)
  - Payment date
  - Remaining balance (ImpSaldoInsoluto)
- Show payment status on PPD invoices: Paid / Partially paid / Pending
- UI: badge on PPD invoices showing payment progress

### Implementation

#### Migration (`packages/database/prisma/migrations/add-sat-pagos.sql`)
```sql
-- Migration: Add sat_pagos table for payment complement tracking
-- Date: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS practice_management.sat_pagos (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  pago_uuid VARCHAR(36) NOT NULL,        -- UUID of the complement CFDI (type P)
  factura_uuid VARCHAR(36) NOT NULL,     -- UUID of the invoice being paid
  serie VARCHAR(25),
  folio VARCHAR(40),
  fecha_pago TIMESTAMP,
  forma_pago VARCHAR(10),
  monto_pagado DECIMAL(14,2),
  saldo_anterior DECIMAL(14,2),
  saldo_insoluto DECIMAL(14,2),
  num_parcialidad INT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_pagos_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE
);

-- Unique: one payment complement can pay one invoice once per parcialidad
CREATE UNIQUE INDEX IF NOT EXISTS sat_pagos_unique_idx
  ON practice_management.sat_pagos(doctor_id, pago_uuid, factura_uuid);

-- Find all payments for a given invoice
CREATE INDEX IF NOT EXISTS sat_pagos_factura_idx
  ON practice_management.sat_pagos(doctor_id, factura_uuid);
```

#### Prisma model
```prisma
model SatPago {
  id              Int       @id @default(autoincrement())
  doctorId        String    @map("doctor_id")
  pagoUuid        String    @map("pago_uuid") @db.VarChar(36)
  facturaUuid     String    @map("factura_uuid") @db.VarChar(36)
  serie           String?   @db.VarChar(25)
  folio           String?   @db.VarChar(40)
  fechaPago       DateTime? @map("fecha_pago")
  formaPago       String?   @map("forma_pago") @db.VarChar(10)
  montoPagado     Decimal?  @map("monto_pagado") @db.Decimal(14, 2)
  saldoAnterior   Decimal?  @map("saldo_anterior") @db.Decimal(14, 2)
  saldoInsoluto   Decimal?  @map("saldo_insoluto") @db.Decimal(14, 2)
  numParcialidad  Int?      @map("num_parcialidad")
  createdAt       DateTime  @default(now()) @map("created_at")

  doctor          Doctor    @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@unique([doctorId, pagoUuid, facturaUuid])
  @@index([doctorId, facturaUuid])
  @@map("sat_pagos")
  @@schema("practice_management")
}
```

#### Parser changes
- Extend `sat-xml-parser.ts` to detect `<pago20:Pagos>` section
- Extract `<pago20:Pago>` → fecha, forma, monto
- Extract `<pago20:DoctoRelacionado>` → IdDocumento (related UUID), ImpPagado, ImpSaldoInsoluto

#### UI
- PPD invoices show colored badge: "Pagado" (green), "Parcial $X/$Y" (yellow), "Pendiente" (red)
- Expandable section shows payment history timeline

### Files to modify
- New: migration SQL
- Modify: `apps/api/src/lib/sat-xml-parser.ts` (add pago20 parsing)
- Modify: worker (store pago records after XML parse)
- New: `apps/api/src/app/api/sat-descarga/pagos/route.ts` (GET payments for a factura)
- Modify: page.tsx (payment status badge + detail)

### Effort: Large (4-6 hours)

---

## 5. Historical Backfill (Enero 2025 to Date) — COMPLETE

**Status:** DONE (deployed 2026-05-16)

**What was built:**
- `POST /api/sat-descarga/backfill` — creates jobs for all months from 2025-01 to now
  - Body: `{ fromMonth?: "YYYY-MM" }` (defaults to "2025-01")
  - Skips months with completed or active jobs
  - Returns: `{ months, created, skipped, total }`
- `GET /api/sat-descarga/backfill` — returns progress (completedMonths/totalMonths/activeJobs)
- Frontend: BackfillSection with progress bar + "Descargar historico" button
  - Shows X of Y months completed, hides button when all done
  - Shows active job count

**Rate limiting:** Worker processes 3 jobs/15min run. 17 months × 4 jobs = 68 jobs ÷ 3/run ≈ 6 hours total.

**Files:**
- `apps/api/src/app/api/sat-descarga/backfill/route.ts`
- `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (BackfillSection component)

---

## 6. Declaracion Helper

**Goal:** Pre-calculate monthly ISR/IVA amounts ready for declaration, matching SAT's format.

### Scope
- Monthly view showing exactly what to enter in the SAT portal for ISR and IVA declarations
- ISR provisional: Ingresos acumulados − Deducciones acumuladas − Retenciones = Base × Tasa − Pagos anteriores
- IVA mensual: IVA trasladado cobrado − IVA acreditable pagado − IVA retenido = IVA a pagar/favor
- Compares with what should have been declared (detects missing declarations)

### Implementation
- Extends Resumen Fiscal tab or creates a new "Declaraciones" sub-view
- Uses existing summary endpoint data + adds cumulative calculations
- May need to store declaration history (what was actually declared) for comparison

#### Migration (optional — `packages/database/prisma/migrations/add-sat-declarations.sql`)
```sql
-- Migration: Add sat_declarations table for tracking filed declarations
-- Date: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS practice_management.sat_declarations (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  period VARCHAR(7) NOT NULL,    -- YYYY-MM
  type VARCHAR(5) NOT NULL,      -- 'ISR' | 'IVA'
  amount DECIMAL(14,2),
  declared_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- pending | declared | late
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sat_declarations_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS sat_declarations_unique_idx
  ON practice_management.sat_declarations(doctor_id, period, type);
```

#### Calculations
- **ISR provisional mensual:**
  - Ingresos del mes (subtotal emitidos tipo I, vigentes, efectivamente cobrados PUE + complementos PPD)
  - − Deducciones del mes (subtotal recibidos tipo I, vigentes, efectivamente pagados)
  - = Utilidad fiscal
  - × Tasa ISR segun tabla (1.92% a 35%)
  - − ISR retenido del mes (ya pagado por personas morales)
  - − Pagos provisionales anteriores
  - = ISR a pagar

- **IVA mensual:**
  - IVA trasladado cobrado (PUE del mes + complementos de pago recibidos en el mes)
  - − IVA acreditable pagado (IVA de gastos pagados en el mes)
  - − IVA retenido (ya enterado por personas morales)
  - = IVA a pagar (o saldo a favor)

### Files to modify
- New: `apps/api/src/app/api/sat-descarga/declaration/route.ts`
- Modify: page.tsx (new tab or sub-view in Resumen Fiscal)
- Optional: migration for declarations tracking table

### Effort: Large (5-8 hours) — complex tax logic

---

## 7. Deducibility Checker

**Goal:** Automatically flag received CFDIs that might NOT be deducible.

### Scope
- Rules engine that checks each received CFDI against deducibility criteria
- Flags with reasons: "Pago en efectivo >$2,000", "Proveedor en lista 69-B", "Sin relacion con actividad", etc.
- Visual indicator in CFDI list (warning icon)

### Rules to implement
1. **Efectivo >$2,000** — FormaPago="01" AND total > 2,000 → not deducible
2. **Lista 69-B** — Check issuerRfc against SAT's published list of fraudulent providers
3. **Factura cancelada** — satStatus="Cancelado" → obviously not deducible
4. **Proveedor inactivo** — RFC lookup against SAT's l_RFC endpoint (future)
5. **Descripcion generica** — NLP/keyword check for overly vague descriptions
6. **Periodo incorrecto** — Paid in a different fiscal year than declared

### Implementation
- **Lista 69-B:** SAT publishes CSV quarterly. Store in DB and check against it.
  - Download: http://omawww.sat.gob.mx/cifras_sat/Paginas/datos/vinculoEntworka/69B/Listado_69_B.zip
  - ~20K records, store in `practice_management.sat_lista_69b`
- **Rules engine:** Simple function that takes a CFDI + detail and returns flags[]
- **UI:** Warning icon on flagged CFDIs, detail shows reason

### Migration (`packages/database/prisma/migrations/add-sat-lista-69b.sql`)
```sql
-- Migration: Add lista 69-B table for deducibility checking
-- Date: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS practice_management.sat_lista_69b (
  id SERIAL PRIMARY KEY,
  rfc VARCHAR(13) NOT NULL,
  nombre VARCHAR(500),
  tipo_listado VARCHAR(50),  -- 'definitivo' | 'presunto' | 'desvirtuado' | 'sentencia_favorable'
  fecha_publicacion DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sat_lista_69b_rfc_idx
  ON practice_management.sat_lista_69b(rfc);
```

### Files to modify
- New: `apps/api/src/lib/deducibility-checker.ts`
- New: `apps/api/src/app/api/sat-descarga/check-deducibility/route.ts`
- New: `packages/database/prisma/migrations/add-sat-lista-69b.sql`
- Modify: `packages/database/prisma/schema.prisma` (add SatLista69B model)
- Modify: page.tsx (warning indicators)

### Effort: Large (6-8 hours)

---

## 8. Cash Flow Projection

**Goal:** Based on PPD invoices pending payment, project expected income timeline.

### Scope
- Identify all emitted PPD invoices that haven't received full payment
- Show projected income: "Pending to collect: $X across Y invoices"
- Timeline view: expected collection dates based on payment terms
- Aging report: 0-30 days, 30-60, 60-90, 90+ overdue

### Implementation
- Requires Complementos de Pago tracking (#4) to know what's been paid
- Compare emitted PPD invoice totals vs sum of received payments
- Difference = pending to collect

### Dependencies
- Requires feature #4 (Complementos de Pago) to be built first

### Files to modify
- New: `apps/api/src/app/api/sat-descarga/cashflow/route.ts`
- Modify: page.tsx (new tab or card in Resumen Fiscal)

### Effort: Medium (3-4 hours, after #4 is done)

---

## 9. Tax Calendar Reminders

**Goal:** Alert doctors before fiscal deadlines (day 17 declarations, annual, DIOT).

### Scope
- Pre-configured calendar of fiscal obligations
- Push notifications / in-app alerts 3 days before deadline
- Shows what needs to be declared and estimated amounts (from #6)
- Marks as "done" when doctor confirms they declared

### Implementation

#### Fixed deadlines (no DB needed for rules)
- Day 17 of each month: ISR provisional + IVA mensual + DIOT
- April 30: Declaracion anual personas fisicas
- Day 3-5 of second month: Contabilidad electronica

#### Notification system
- Check current date against upcoming deadlines
- If within 3 days of deadline, show banner in dashboard
- Optional: email notification (requires email service)

### Files to modify
- New: `apps/api/src/app/api/sat-descarga/calendar/route.ts`
- Modify: page.tsx or dashboard layout (show reminder banner)
- Optional: email notification integration

### Effort: Small-Medium (2-3 hours for in-app, more for email)

---

## Priority & Dependency Order

```
Standalone (can build in any order):
  1. Export CSV        ��� Small, high value for accountants
  2. Auto-sync        — Small, quality of life
  5. Backfill         — Small, one-time setup value
  9. Tax Calendar     — Small, simple logic

Sequential (build in order):
  4. Complementos de Pago → 8. Cash Flow Projection
  3. Alerts �� (enhances everything)

Complex (save for later):
  6. Declaracion Helper  — Needs careful tax logic validation
  7. Deducibility Check  — Needs 69-B data + rules engine
```

### Suggested build order:
1. **Export CSV** (immediate value, tiny effort)
2. **Backfill** (one-time, unlocks historical data)
3. **Auto-sync** (set and forget)
4. **Tax Calendar** (simple, high perceived value)
5. **Alerts** (builds on sync infrastructure)
6. **Complementos de Pago** (enables cash flow)
7. **Cash Flow Projection** (uses #6)
8. **Declaracion Helper** (complex, validate with accountant)
9. **Deducibility Checker** (complex, validate with accountant)

---

## Deployment Checklist (for features with DB changes)

For features #2, #3, #4, #6, #7 that add new tables/columns:

```
1. Add Prisma model to schema.prisma (@@schema("practice_management"))
2. Create SQL migration file in packages/database/prisma/migrations/
3. Test locally:
   npx prisma db execute --file prisma/migrations/your-file.sql --schema prisma/schema.prisma
4. Regenerate client: pnpm db:generate
5. Run migration on Railway BEFORE pushing code:
   npx prisma db execute --file prisma/migrations/your-file.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
6. git push (Railway auto-deploys)
```

Features #1, #5, #8, #9 need NO DB changes — just new API routes and UI.
