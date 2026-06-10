# PPD Declaration Fix — Implementation Plan

**Date:** 2026-06-10
**Status:** Planned
**Priority:** High — affects ISR/IVA calculation accuracy for all doctors

---

## Problem Statement

Our declaration, deductions, and deducibility routes currently treat ALL CFDIs equally regardless of `metodoPago` (PUE vs PPD). Under Mexican tax law (Art. 102 & 105 LISR), personas fisicas operate on **cash basis (flujo de efectivo)** — income and deductions are recognized when **effectively paid**, not when invoiced.

**Current behavior (incorrect):**
- Declaration route sums all efecto='I' CFDIs by `issued_at` month
- PPD invoices (not yet paid) are counted as income/deductions at invoice date
- No distinction between PPD with complemento (paid) vs PPD without complemento (unpaid)
- Same bug exists in 6 routes: declaration, deductions, check-deducibility, summary, export, accountant-report

**Correct behavior:**
- **PUE invoices**: Count at invoice date (payment happens at issuance)
- **PPD with complemento**: Count at complemento payment date, using tax amounts from `ImpuestosDR` nodes
- **PPD without complemento**: Exclude from declarations entirely (no proof of payment)

---

## Data Model Audit

### What we have

| Table | Relevant fields | Status |
|-------|----------------|--------|
| `SatCfdiDetail` | `metodoPago` (PUE/PPD/null), `subtotal`, `ivaTrasladado`, `isrRetenido` | Has metodo_pago |
| `SatCfdiMetadata` | `efecto` (I/E/P), `direction`, `satStatus`, `issuedAt` | P = complemento |
| `SatPago` | `montoPagado`, `fechaPago`, `formaPago`, `facturaUuid`, `numParcialidad`, `saldoAnterior`, `saldoInsoluto` | Missing tax columns |

### What we have (stored as structured data, NOT raw XML)

All SAT-downloaded CFDI data is parsed on-the-fly during sync and stored across structured
tables. The raw XML is discarded after parsing — only extracted fields are persisted.

| Data point | Where stored | Available? |
|------------|-------------|------------|
| Invoice UUID, emisor, receptor, monto, dates | `SatCfdiMetadata` | ✅ |
| Subtotal, total, IVA, ISR, IEPS (invoice level) | `SatCfdiDetail` | ✅ |
| `metodoPago` (PUE/PPD) | `SatCfdiDetail.metodoPago` | ✅ |
| formaPago, usoCfdi, moneda, serie, folio | `SatCfdiDetail` | ✅ |
| Per-concepto taxes (IVA, ISR per line item) | `SatCfdiConcepto` | ✅ |
| Complemento → invoice link | `SatPago.pagoUuid → facturaUuid` | ✅ |
| Payment date | `SatPago.fechaPago` | ✅ |
| Amount paid per installment | `SatPago.montoPagado` | ✅ |
| Balance tracking | `SatPago.saldoAnterior/saldoInsoluto` | ✅ |
| Installment number | `SatPago.numParcialidad` | ✅ |
| Manual link/unlink | `SatPago.unlinkedAt` | ✅ |
| Per-payment tax base (from ImpuestosDR) | — | ❌ Missing |
| Per-payment IVA (from ImpuestosDR) | — | ❌ Missing |
| Per-payment ISR retained (from ImpuestosDR) | — | ❌ Missing |
| Per-payment IVA retained (from ImpuestosDR) | — | ❌ Missing |
| Raw XML content | — | ❌ Not stored |

### Gap 1: Missing per-payment tax data

`SatPago` is missing per-payment tax breakdown columns. The Complemento de Pagos 2.0 XML contains `ImpuestosDR` nodes with exact tax amounts per payment, but our parser (`sat-xml-parser.ts` lines 316-317) only extracts `DoctoRelacionado` attributes and ignores the tax child nodes.

### Gap 2: Wrong calculation logic in 6 routes

All routes that aggregate CFDI financials use the same pattern: sum by `issued_at` month
with no `metodoPago` filter and no join to `SatPago`. Affected routes:

| Route | File | Bug |
|-------|------|-----|
| Declaration | `declaration/route.ts` | ISR/IVA calculation includes unpaid PPD |
| Deductions | `deductions/route.ts` | Categorizes unpaid PPD as deductible |
| Deducibility | `check-deducibility/route.ts` | No flag for PPD sin complemento |
| Summary | `summary/route.ts` | Monthly totals include unpaid PPD |
| Export | `export/route.ts` | Excel export has same wrong totals |
| Accountant Report | `export/accountant-report/route.ts` | Report for contador has wrong totals (2 queries) |

---

## Implementation Phases

### Phase 1: Schema + Migration + Parser

**Goal:** Add tax columns to `SatPago`, extend XML parser to extract `ImpuestosDR`.

#### 1a. SQL Migration

**File:** `packages/database/migrations/YYYYMMDD_add_pago_tax_columns.sql`

```sql
-- Add per-payment tax breakdown columns to sat_pago
-- Using DECIMAL(14,2) to match existing columns (monto_pagado, saldo_anterior, etc.)
ALTER TABLE practice_management.sat_pago
  ADD COLUMN IF NOT EXISTS base_dr DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS iva_trasladado_dr DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS isr_retenido_dr DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS iva_retenido_dr DECIMAL(14,2);

-- Index for declaration queries that join on fecha_pago
CREATE INDEX IF NOT EXISTS idx_sat_pago_fecha_pago
  ON practice_management.sat_pago (doctor_id, fecha_pago);
```

**Deploy:** Run against Railway before code deploy (per database-architecture.md workflow).

#### 1b. Prisma Schema Update

**File:** `packages/database/prisma/schema.prisma` — `SatPago` model (~line 2689)

Add fields (after `numParcialidad`, before `source`):
```prisma
baseDr          Decimal?  @map("base_dr") @db.Decimal(14, 2)
ivaTrasladadoDr Decimal?  @map("iva_trasladado_dr") @db.Decimal(14, 2)
isrRetenidoDr   Decimal?  @map("isr_retenido_dr") @db.Decimal(14, 2)
ivaRetenidoDr   Decimal?  @map("iva_retenido_dr") @db.Decimal(14, 2)
```

Run `npx prisma generate` after.

#### 1c. XML Parser Extension

**File:** `apps/api/src/lib/sat-xml-parser.ts` — `parsePagoComplement()` (~line 291)

Current `PagoDoctoRelacionado` interface (line 269) needs new fields:
```typescript
export interface PagoDoctoRelacionado {
  // existing fields (keep as-is)
  facturaUuid: string;
  serie: string | null;
  folio: string | null;
  montoPagado: number | null;
  saldoAnterior: number | null;
  saldoInsoluto: number | null;
  numParcialidad: number | null;
  // NEW: tax breakdown from ImpuestosDR
  baseDr: number | null;
  ivaTrasladadoDr: number | null;
  isrRetenidoDr: number | null;
  ivaRetenidoDr: number | null;
}
```

Extract `ImpuestosDR > TrasladosDR > TrasladoDR` and `RetencionesDR > RetencionDR` child nodes:
- `TrasladoDR` where `ImpuestoDR="002"` (IVA) → `ivaTrasladadoDr`
- `RetencionDR` where `ImpuestoDR="001"` (ISR) → `isrRetenidoDr`
- `RetencionDR` where `ImpuestoDR="002"` (IVA) → `ivaRetenidoDr`
- `BaseDR` attribute → `baseDr`

#### 1d. Sync Worker Update

**File:** `apps/api/src/app/api/cron/sat-sync-worker/route.ts` (~line 590-635)

Update the upsert call that writes to `SatPago` to include the new tax columns from the parsed complement data.

---

### Phase 2: Backfill Existing Complemento Data

**Goal:** Populate the new tax columns for existing `SatPago` rows.

**IMPORTANT:** Raw XML content is NOT stored after sync. The sync worker receives XMLs
from SAT ZIP downloads, parses them on-the-fly (`entry.data` in sat-sync-worker),
and discards the raw XML after extracting fields. Therefore we CANNOT re-parse old XMLs.

**Two options:**

**Option A — Re-download complemento XMLs from SAT (recommended):**
Trigger a targeted re-sync of complemento XMLs (efecto='P') for each doctor. The updated
parser (Phase 1c) will extract ImpuestosDR on the new download, and the updated sync worker
(Phase 1d) will write the tax columns on upsert. Since the upsert uses the unique key
`(doctorId, pagoUuid, facturaUuid)`, existing rows will be updated with the new tax data.

Implementation: Add a "Re-sync complementos" button or auto-trigger after deploy that
creates `SatSyncJob` entries for `requestType: 'xml'` filtered to tipo P CFDIs.

**Option B — Proportional estimation fallback:**
For `SatPago` rows where `base_dr IS NULL` after re-sync (e.g., pre-2022 complementos
without ImpuestosDR nodes), estimate proportionally from the parent invoice:
```sql
UPDATE practice_management.sat_pago p
SET
  base_dr = (p.monto_pagado / d.total) * d.subtotal,
  iva_trasladado_dr = (p.monto_pagado / d.total) * d.iva_trasladado,
  isr_retenido_dr = (p.monto_pagado / d.total) * d.isr_retenido,
  iva_retenido_dr = (p.monto_pagado / d.total) * d.iva_retenido
FROM practice_management.sat_cfdi_details d
WHERE LOWER(d.uuid) = LOWER(p.factura_uuid)
  AND d.doctor_id = p.doctor_id
  AND p.base_dr IS NULL
  AND d.total > 0;
```

**Recommendation:** Option A first, then Option B as fallback for any remaining NULLs.

---

### Phase 3: Fix Declaration Route

**File:** `apps/api/src/app/api/sat-descarga/declaration/route.ts`

**Current query (lines 70-88):** Single query sums ALL efecto IN ('I','E') by month.

**New approach — split into 3 queries:**

#### Query 1: PUE invoices (count at invoice date)
```sql
SELECT
  EXTRACT(MONTH FROM m.issued_at)::int AS month,
  m.direction, m.efecto,
  COUNT(*)::bigint AS count,
  SUM(d.subtotal)::float AS sum_subtotal,
  SUM(d.iva_trasladado)::float AS sum_iva_trasladado,
  SUM(d.isr_retenido)::float AS sum_isr_retenido,
  SUM(d.iva_retenido)::float AS sum_iva_retenido
FROM practice_management.sat_cfdi_details d
JOIN practice_management.sat_cfdi_metadata m
  ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
WHERE d.doctor_id = ${doctorId}
  AND m.sat_status = 'Vigente'
  AND m.efecto IN ('I', 'E')
  AND (d.metodo_pago = 'PUE' OR d.metodo_pago IS NULL)
  AND EXTRACT(YEAR FROM m.issued_at) = ${year}
GROUP BY EXTRACT(MONTH FROM m.issued_at), m.direction, m.efecto
```

#### Query 2: PPD invoices WITH complemento (count at payment date)
```sql
SELECT
  EXTRACT(MONTH FROM p.fecha_pago)::int AS month,
  m.direction,
  m.efecto,
  COUNT(DISTINCT p.id)::bigint AS count,
  -- Use ImpuestosDR tax data if available, fall back to proportional from parent invoice
  SUM(COALESCE(p.base_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.subtotal))::float AS sum_subtotal,
  SUM(COALESCE(p.iva_trasladado_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.iva_trasladado))::float AS sum_iva_trasladado,
  SUM(COALESCE(p.isr_retenido_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.isr_retenido))::float AS sum_isr_retenido,
  SUM(COALESCE(p.iva_retenido_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.iva_retenido))::float AS sum_iva_retenido
FROM practice_management.sat_pago p
JOIN practice_management.sat_cfdi_metadata m
  ON m.doctor_id = p.doctor_id AND LOWER(m.uuid) = LOWER(p.factura_uuid)
JOIN practice_management.sat_cfdi_details d
  ON d.doctor_id = p.doctor_id AND LOWER(d.uuid) = LOWER(p.factura_uuid)
WHERE p.doctor_id = ${doctorId}
  AND m.sat_status = 'Vigente'
  AND m.efecto IN ('I', 'E')            -- handle both Ingreso and Egreso PPDs
  AND p.unlinked_at IS NULL             -- respect manual unlinks
  AND EXTRACT(YEAR FROM p.fecha_pago) = ${year}
GROUP BY EXTRACT(MONTH FROM p.fecha_pago), m.direction, m.efecto
```

**Key details:**
- COALESCE ensures query works even when `base_dr` is NULL (pre-backfill or pre-2022 complementos)
- Proportional fallback: `(montoPagado / total) * ivaTrasladado` from parent invoice
- NULLIF guards against division by zero if parent invoice total is 0
- Includes `efecto IN ('I', 'E')` to handle rare PPD Egresos (credit notes) with sign=-1
- Joins `sat_cfdi_details` to access parent invoice tax amounts for fallback

#### Query 3: PPD invoices WITHOUT complemento (excluded — but count for info)
```sql
SELECT COUNT(*) as count, m.direction,
  SUM(d.subtotal)::float AS sum_subtotal
FROM practice_management.sat_cfdi_details d
JOIN practice_management.sat_cfdi_metadata m
  ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
LEFT JOIN practice_management.sat_pago p
  ON p.doctor_id = d.doctor_id
  AND LOWER(p.factura_uuid) = LOWER(d.uuid)
  AND p.unlinked_at IS NULL             -- unlinked pagos don't count as "has complemento"
WHERE d.doctor_id = ${doctorId}
  AND m.sat_status = 'Vigente'
  AND m.efecto = 'I'
  AND d.metodo_pago = 'PPD'
  AND p.id IS NULL
  AND EXTRACT(YEAR FROM m.issued_at) = ${year}
GROUP BY m.direction
```

**Merge strategy:** Combine Query 1 + Query 2 into the same `monthlyRaw` structure. Include Query 3 counts in the response as `ppdExcluded: { emitted: N, received: N, subtotalExcluded: N }`.

---

### Phase 4: Fix All Remaining Routes (5 routes)

#### 4a. Deductions Route

**File:** `apps/api/src/app/api/sat-descarga/deductions/route.ts`

Apply same PUE/PPD split logic for received CFDIs:
- PUE received: deductible at invoice date
- PPD received with complemento: deductible at payment date
- PPD received without complemento: NOT deductible (flag separately)

Also fix the YTD income query at line 296-299 (used for RESICO monitor) — same bug.

#### 4b. Deducibility Route

**File:** `apps/api/src/app/api/sat-descarga/check-deducibility/route.ts`

Add new flag type:
```typescript
{
  type: 'ppd_sin_complemento',
  severity: 'warning',
  message: 'Factura PPD sin complemento de pago — no deducible hasta recibir complemento'
}
```

This requires checking if a received PPD CFDI has any matching `SatPago` rows.

#### 4c. Summary Route

**File:** `apps/api/src/app/api/sat-descarga/summary/route.ts`

Same query pattern as declaration (lines 36-57). Apply identical PUE/PPD split.
This feeds the Resumen tab — must show correct monthly totals.

#### 4d. Export Route

**File:** `apps/api/src/app/api/sat-descarga/export/route.ts`

Same query pattern (lines 219-223). Excel export must match corrected declaration numbers.

#### 4e. Accountant Report Route

**File:** `apps/api/src/app/api/sat-descarga/export/accountant-report/route.ts`

Two queries affected:
- Monthly aggregation (lines 191-195) — same pattern as declaration
- YTD income for RESICO (lines 427-430) — same pattern as deductions

This is the report doctors send to their accountant — critical that numbers are correct.

---

### Phase 5: Frontend Updates

**File:** `apps/doctor/src/app/dashboard/sat-descarga/page.tsx`

#### 5a. Declaration tab
- Show banner if `ppdExcluded.received > 0`: "X facturas PPD recibidas sin complemento excluidas de deducciones ($Y)"
- Show banner if `ppdExcluded.emitted > 0`: "X facturas PPD emitidas sin complemento excluidas de ingresos ($Y)"
- Tooltip or info icon explaining PPD treatment

#### 5b. Deducibility tab
- New alert card for `ppd_sin_complemento` flags
- Show list of PPD invoices missing complemento with provider name and amount
- Action suggestion: "Solicita el complemento de pago a tu proveedor"

#### 5c. PPD/Pagos tab (already has info section)
- Update existing PPD info section to reflect that the system now correctly handles PPD
- Show count of PPD invoices correctly matched to complementos vs pending

---

## Deployment Sequence

Following database-architecture.md patterns:

1. **Run SQL migration** against Railway production DB (new columns are nullable, safe to add)
2. **Deploy code** (parser + schema + sync worker + routes + frontend)
3. **Trigger complemento re-sync** for each doctor (re-downloads tipo P XMLs from SAT)
4. **Run proportional fallback** SQL for any remaining NULLs (pre-2022 complementos)
5. **Verify** declaration numbers match manual calculations for a test doctor
6. **Monitor** — new syncs will automatically populate tax columns going forward

---

## Edge Cases

| Scenario | Treatment |
|----------|-----------|
| PPD with partial payment (parcialidad 1 of 3) | Count only `montoPagado` from complemento, not full invoice amount |
| PPD complemento issued in different year than invoice | Count at complemento `fechaPago` year/month |
| PPD with complemento but `ImpuestosDR` missing (pre-2022 XMLs) | Fall back to proportional estimation: `(montoPagado / total) * ivaTrasladado` |
| `metodoPago` is NULL in detail | Treat as PUE (legacy data before we parsed this field) |
| Cancelled complemento (satStatus != Vigente) | Exclude — payment not valid |
| Multiple complementos for same PPD invoice | Sum all payments, each counted at its own `fechaPago` |
| Provider never issues complemento (Art. 29-B CFF) | Flag in deducibility, suggest bank statement alternative |
| SatPago row has NULL tax columns (backfill incomplete) | Use proportional estimation from parent invoice as fallback in declaration query |
| Raw XML not stored after sync | Cannot re-parse old XMLs — must re-download from SAT or use proportional fallback |

---

## Files to Modify (Summary)

| File | Phase | Change |
|------|-------|--------|
| `packages/database/migrations/YYYYMMDD_add_pago_tax_columns.sql` | 1a | New migration |
| `packages/database/prisma/schema.prisma` | 1b | Add 4 fields to SatPago |
| `apps/api/src/lib/sat-xml-parser.ts` | 1c | Extract ImpuestosDR from complemento |
| `apps/api/src/app/api/cron/sat-sync-worker/route.ts` | 1d | Write new tax fields on upsert |
| `apps/api/src/app/api/sat-descarga/declaration/route.ts` | 3 | Split PUE/PPD queries |
| `apps/api/src/app/api/sat-descarga/deductions/route.ts` | 4a | Split PUE/PPD for received + RESICO query |
| `apps/api/src/app/api/sat-descarga/check-deducibility/route.ts` | 4b | Add ppd_sin_complemento flag |
| `apps/api/src/app/api/sat-descarga/summary/route.ts` | 4c | Split PUE/PPD queries |
| `apps/api/src/app/api/sat-descarga/export/route.ts` | 4d | Split PUE/PPD queries |
| `apps/api/src/app/api/sat-descarga/export/accountant-report/route.ts` | 4e | Split PUE/PPD (2 queries) |
| `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` | 5 | Banners + alerts for PPD exclusions |

---

## Estimated Complexity

- Phase 1 (Schema + Parser): Medium — straightforward column additions and XML parsing
- Phase 2 (Backfill): Low — re-sync trigger + one-time SQL fallback
- Phase 3 (Declaration): High — core calculation logic changes, must preserve cumulative ISR mechanics
- Phase 4 (All remaining routes): Medium-High — 5 routes, same pattern but each has its own quirks
- Phase 5 (Frontend): Low-Medium — info banners and alert cards

**Risk:** Phases 3-4 are critical — incorrect ISR/IVA calculations directly affect tax payments
and the accountant report. Must validate with known-good manual calculations before deploying.

**Approach:** Consider extracting the PUE/PPD query logic into a shared helper function
(e.g., `buildCashBasisQuery()`) to avoid duplicating the 3-query pattern across 6 routes.

---

## Remaining Gaps After Implementation

These limitations will persist even after all 5 phases are complete:

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **Pre-2022 complementos (Pagos 1.0)** lack `ImpuestosDR` nodes | Tax amounts estimated proportionally, not exact | COALESCE fallback in Query 2; accuracy is ~99% for single-rate IVA invoices |
| **Raw XML not stored** — if we need more data later, must re-download from SAT | Slower iteration on future schema changes | Consider adding `xml_content` column to `SatCfdiDetail` in future |
| **Cross-year PPD payments** — invoice Dec 2025, paid Jan 2026 | Must appear in 2026 declarations, not 2025 | Query 2 groups by `fecha_pago` year so this is handled correctly; verify in deductions route too |
| **Proportional estimation is approximate** | When invoice has mixed IVA rates (16% + 0%) per concepto, proportional estimate may be slightly off | For now acceptable; exact ImpuestosDR data will replace estimates as complementos are re-synced |
| **PPD Egresos (credit notes)** | Rare edge case — PPD credit note paid via complemento | Handled in Query 2 with `efecto IN ('I','E')` and sign=-1, but untested with real data |
