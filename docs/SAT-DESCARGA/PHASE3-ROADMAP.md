# SAT Descarga — Phase 3+ Roadmap

**Date:** 2026-05-16
**Status:** PLANNED
**Depends on:** Phase 2 (COMPLETE — metadata + XML download working)

---

## 1. Export to CSV/Excel

**Goal:** Let doctors download their CFDI data as files to share with accountants.

### Scope
- Export CFDI list (metadata) as CSV — filtered by month, direction, status
- Export Resumen Fiscal as CSV — monthly breakdown with tax columns
- Export XML details (conceptos) as CSV — one row per concepto across all CFDIs

### Implementation
- **API:** `GET /api/sat-descarga/export?format=csv&month=2026-04&direction=received`
  - Streams CSV response with `Content-Type: text/csv` and `Content-Disposition: attachment`
  - Reuse existing metadata query + join with details for enriched export
  - Columns: Fecha, Emisor, RFC Emisor, Receptor, RFC Receptor, UUID, Subtotal, IVA, ISR Ret, IVA Ret, Total, MetodoPago, FormaPago, UsoCFDI, Status
- **UI:** "Exportar CSV" button in CFDI list tab and Resumen Fiscal tab
- **No new tables** — reads existing data

### Files to modify
- New: `apps/api/src/app/api/sat-descarga/export/route.ts`
- Modify: `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (add export buttons)

### Effort: Small (1-2 hours)

---

## 2. Auto-sync Cron

**Goal:** Automatically sync the current month every 3 days so doctors don't have to manually trigger.

### Scope
- Cron job checks all doctors with active fiscal profiles (fielUploaded = true)
- Creates sync jobs for current month (both directions, type "full") if no completed job exists for that month in the last 3 days
- Respects SAT rate limits — staggers requests across doctors

### Implementation
- **API:** `POST /api/cron/sat-auto-sync` (protected by CRON_SECRET)
  - Query all doctors with `fielUploaded = true`
  - For each doctor, check if a completed job exists for current month in last 3 days
  - If not, create pending jobs (received + emitted, metadata + xml)
  - Limit: max 5 doctors per cron run to avoid SAT throttling
- **Cron schedule:** Every 3 days (or configurable)
- **Doctor opt-out:** Add `autoSyncEnabled` boolean to DoctorFiscalProfile (default true)

### Files to modify
- New: `apps/api/src/app/api/cron/sat-auto-sync/route.ts`
- Modify: `packages/database/prisma/schema.prisma` (add autoSyncEnabled field)
- New migration: add `auto_sync_enabled BOOLEAN DEFAULT TRUE` to doctor_fiscal_profiles

### Effort: Medium (2-3 hours)

---

## 3. Alerts (Cancellations & New CFDIs)

**Goal:** Notify doctors when CFDIs get cancelled or new ones appear since last sync.

### Scope
- After each sync completes, compare with previous sync results
- Detect: new CFDIs not seen before, status changes (Vigente → Cancelado)
- Store alerts in a lightweight table
- Show alert badge on SAT Descarga nav item + alert list in UI

### Implementation

#### DB
```sql
CREATE TABLE practice_management.sat_alerts (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'new_cfdi' | 'cancelled' | 'new_month_available'
  uuid VARCHAR(36),
  direction VARCHAR(10),
  issuer_name VARCHAR(300),
  monto DECIMAL(14,2),
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Logic
- In worker, after metadata parsing: compare UUIDs with previous sync
- New UUIDs → create alert type 'new_cfdi'
- UUIDs with changed status → create alert type 'cancelled'
- Worker already knows the old data (it's in the DB), so diff is cheap

#### UI
- Bell icon with unread count in SAT Descarga header
- Dropdown or section showing recent alerts
- "Marcar como leido" action

### Files to modify
- New: migration SQL
- New: `apps/api/src/app/api/sat-descarga/alerts/route.ts` (GET list, PATCH mark read)
- Modify: worker route (add diff logic after metadata parse)
- Modify: page.tsx (add alerts badge + dropdown)

### Effort: Medium (3-4 hours)

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

#### DB
```sql
CREATE TABLE practice_management.sat_pagos (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  pago_uuid VARCHAR(36) NOT NULL,        -- UUID of the complement CFDI
  factura_uuid VARCHAR(36) NOT NULL,     -- UUID of the invoice being paid
  serie VARCHAR(25),
  folio VARCHAR(40),
  fecha_pago TIMESTAMP,
  forma_pago VARCHAR(10),
  monto_pagado DECIMAL(14,2),
  saldo_anterior DECIMAL(14,2),
  saldo_insoluto DECIMAL(14,2),
  num_parcialidad INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(doctor_id, pago_uuid, factura_uuid)
);
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

## 5. Historical Backfill (Enero 2025 to Date)

**Goal:** One-click to download all history from January 2025 to current month.

### Scope
- Button: "Descargar historico (Ene 2025 — hoy)"
- Creates sync jobs for every month from 2025-01 to current month
- Both directions (emitted + received), type "full" (metadata + XML)
- Shows progress: X of Y months completed
- Worker processes them in order, 3 per cron run as usual

### Implementation
- **API:** `POST /api/sat-descarga/backfill`
  - Body: `{ fromMonth: "2025-01" }` (default: 2025-01)
  - Calculates all months from start to current
  - Creates pending jobs for each month/direction/type that doesn't already have a completed job
  - Returns count of jobs created
- **UI:** Button in sync trigger section or dedicated section
  - Shows "Descargando historico: 8/32 meses completados" progress
  - Queries jobs list to count completed vs total for the backfill range

### Rate limiting considerations
- SAT allows multiple pending requests, but too many can cause rejections
- Create jobs in batches: only create next 2 months of pending jobs when previous ones complete
- Alternative: create all at once, worker naturally throttles at 3/run �� every 15min
  - 32 months × 4 jobs each = 128 jobs ÷ 3/run = ~43 runs × 15min = ~10 hours total
  - Acceptable for a one-time backfill

### Files to modify
- New: `apps/api/src/app/api/sat-descarga/backfill/route.ts`
- Modify: page.tsx (add backfill button + progress indicator)

### Effort: Small-Medium (2-3 hours)

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

#### DB (optional)
```sql
CREATE TABLE practice_management.sat_declarations (
  id SERIAL PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL,    -- YYYY-MM
  type VARCHAR(5) NOT NULL,      -- 'ISR' | 'IVA'
  amount DECIMAL(14,2),
  declared_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- pending | declared | late
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(doctor_id, period, type)
);
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
- **Lista 69-B:** SAT publishes CSV quarterly. Store locally and check against it.
  - Download: http://omawww.sat.gob.mx/cifras_sat/Paginas/datos/vinculoEntworka/69B/Listado_69_B.zip
  - ~20K records, can store in DB or load in memory
- **Rules engine:** Simple function that takes a CFDI + detail and returns flags[]
- **UI:** Warning icon on flagged CFDIs, detail shows reason

### Files to modify
- New: `apps/api/src/lib/deducibility-checker.ts`
- New: `apps/api/src/app/api/sat-descarga/check-deducibility/route.ts`
- New: migration for lista_69b table (or in-memory)
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
