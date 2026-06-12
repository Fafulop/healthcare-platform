# Consolidated Money Model — Implementation Plan

> **Goal:** Make `LedgerEntry` the single source of truth for all real income and expenses, fed by multiple input channels with deduplication and progressive enrichment.

---

## Current State Summary

### LedgerEntry Origins (7 sources today)

| Origin | Auto-creates? | Dedup guard | Notes |
|--------|--------------|-------------|-------|
| `sat_recibido` / `sat_emitido` | Manual (user clicks "Registrar") | `satCfdiUuid` UNIQUE + match-before-create (score >= 70/120) | Has matching engine but requires user action |
| `banco` (PDF import) | Yes (bulk) | **NONE** — blindly creates | Major gap |
| `banco` (CSV conciliacion) | Match-first | `bank-matching.ts` engine (4 priority levels, 0.00-1.00 confidence) | Already does what we want |
| `cita` | On booking completion (client-side `POST /ledger`) | Unique `bookingId` | Created from `useBookings.ts` when doctor completes appointment |
| `webhook_pago` | On payment webhook (server-side `createPaymentLedgerEntry`) | Idempotent via `bookingId` | Created from Stripe/MercadoPago webhooks |
| `venta` | Auto (atomic) | `saleId` FK | Low usage, potential SAT overlap |
| `compra` | Auto (atomic) | `purchaseId` FK | Low usage, potential SAT overlap |
| `manual` | User creates | Duplicate detection (amount +/-1%, date +/-3 days) | Working |

> **Note on `cita` vs `webhook_pago`:** These are two separate creation paths, not one.
> - `cita`: booking is marked complete by doctor → `useBookings.ts` calls `POST /ledger` with `origin: 'cita'`
> - `webhook_pago`: patient pays online → Stripe/MP webhook calls `createPaymentLedgerEntry()` with `origin: 'webhook_pago'`
> - Both use unique `bookingId` to prevent duplicates. If both fire for the same booking, the second one is a no-op.

### The Two Primary Sources (Equal Priority)

1. **SAT Descarga Masiva** — Fiscal truth. Every real factura flows through SAT.
2. **Bank Statement Import** — Financial truth. Every real money movement flows through the bank.

### Key Insight

A single real-world transaction will appear in BOTH systems:
- SAT: as a CFDI (factura emitida or recibida)
- Bank: as a deposit or withdrawal line

The system must recognize these as the **same movement** and merge them, not create two entries.

---

## Architecture: Source Priority & Lifecycle

```
TIER 1 — Primary Sources (create entries)
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   SAT Descarga Masiva       │     │   Bank Statement Import     │
│   (fiscal truth)            │     │   (financial truth)         │
│                             │     │                             │
│  Auto-create on sync        │     │  Match-first, then create   │
│  origin: sat_recibido/      │     │  origin: banco              │
│          sat_emitido        │     │                             │
└──────────┬──────────────────┘     └──────────┬──────────────────┘
           │                                    │
           │         ┌──────────────┐           │
           └────────►│ LEDGER ENTRY │◄──────────┘
                     │ (source of   │
                     │  truth)      │
                     └──────▲───────┘
                            │
TIER 2 — Automatic Sources (create, with own guards)
┌───────────────┐  ┌────────────────┐
│ Citas         │  │ Webhook Pagos  │
│ origin: cita  │  │ origin:        │
│ guard:        │  │ webhook_pago   │
│ bookingId UK  │  │ guard:         │
│               │  │ bookingId UK   │
└───────────────┘  └────────────────┘

TIER 3 — Secondary Sources (create, may overlap with SAT)
┌───────────────┐  ┌────────────────┐
│ Ventas        │  │ Compras        │
│ origin: venta │  │ origin: compra │
│ transType:    │  │ transType:     │
│ VENTA         │  │ COMPRA         │
└───────────────┘  └────────────────┘

TIER 4 — Enrichment Only (link to existing entries, never create)
┌───────────────┐  ┌────────────────┐
│ Facturas      │  │ Pagos          │
│ (CfdiEmitted) │  │ (amountPaid)   │
│ link via      │  │ update payment │
│ ledgerEntryId │  │ status on      │
│               │  │ existing entry │
└───────────────┘  └────────────────┘
```

---

## Phase 1: SAT Auto-Creation on Sync ✅ IMPLEMENTED

> **Status:** Fully implemented and deployed (2026-06-12). Migration applied to Railway + local.
> **Bug fix:** `register-to-ledger/route.ts` payment defaults aligned with auto-register (received=PENDING).

**Problem:** CFDIs are downloaded into `SatCfdiMetadata` but only become LedgerEntries when the user manually selects and clicks "Registrar."

**Solution:** After each SAT sync job completes, automatically run the register-to-ledger logic for all newly synced CFDIs.

### Changes

#### 1.1 New function: `autoRegisterCfdisToLedger(doctorId, syncJobId)` ✅

**File:** `apps/api/src/lib/sat-auto-register.ts` (created)

Logic:
1. Query all `SatCfdiMetadata` from the sync job that are:
   - `satStatus = 'Vigente'`
   - `efecto IN ('I', 'E')` — skip Pagos (P), Traslados (T), Nomina (N)
   - NOT already linked to a LedgerEntry (`uuid NOT IN (SELECT satCfdiUuid FROM ledger_entries)`)
2. For each CFDI, run the existing match-before-create logic from `register-to-ledger/route.ts`:
   - Search for existing unlinked entries (amount +/-1%, date +/-7 days, same entryType)
   - Score candidates on 0-120 scale (amount: 0-40, date: 0-30, RFC: 0-30, concept: 0-20)
   - **Normalize** score to 0.00-1.00 before storing: `confidence = score / 120`
   - If normalized >= 0.67 (raw 80+) → **Auto-link** (set `satCfdiUuid`, `hasFactura=true`, `needsReview=false`)
   - If normalized 0.50-0.66 (raw 60-79) → **Auto-link BUT flag for review** (set `satCfdiUuid`, `hasFactura=true`, `needsReview=true`)
   - If normalized < 0.50 (raw < 60) → **Auto-create** new LedgerEntry (no match found)
3. Store `autoLinkedConfidence` on every auto-linked entry for audit
4. Return summary: `{ autoLinked: N, autoLinkedNeedsReview: N, created: N }`

> **Decision (resolves 1.1 vs 1.4 contradiction):** Medium-confidence matches (60-79) DO auto-link
> and create the CFDI association, but they set `needsReview=true` so the user can verify and
> unlink if wrong. We do NOT defer creation — every CFDI gets processed immediately. The
> `needsReview` flag is the user's cue to check, not a blocker.

#### 1.2 Hook into sync completion ✅

**File:** `apps/api/src/app/api/cron/sat-sync-worker/route.ts` (two hook points)

Hooked at two completion points in the sync worker:
- After metadata sync completion (~line 491)
- After XML detail sync completion (~line 674)

Both wrapped in try/catch so auto-register failures don't crash the sync worker:
```typescript
try {
  const autoResult = await autoRegisterCfdisToLedger(job.doctorId, job.id);
  console.log(`[sat-sync-worker] Auto-register: linked=${autoResult.autoLinked}, review=${autoResult.autoLinkedNeedsReview}, created=${autoResult.created}`);
} catch (err) {
  console.error(`[sat-sync-worker] Auto-register failed:`, err);
}
```

#### 1.3 CFDIs to skip ✅

Do NOT auto-create entries for:
- **Complementos de Pago (efecto=P):** These are payment receipts, not new transactions. They should enrich existing PPD entries instead.
- **Traslados (efecto=T):** Transfer documents, not income/expense.
- **Nomina (efecto=N):** Payroll, handled separately.
- **Cancelados:** Already filtered by `satStatus = 'Vigente'`.

#### 1.4 Auto-link thresholds ✅

All scores are on the raw 0-120 scale, normalized to 0.00-1.00 for storage.

| Raw score | Normalized | Action | `needsReview` |
|-----------|-----------|--------|---------------|
| 80-120 | 0.67-1.00 | Auto-link silently | `false` |
| 60-79 | 0.50-0.66 | Auto-link + flag for review | `true` |
| < 60 | < 0.50 | No match → auto-create new entry | `false` |

This is more aggressive than the current manual flow (which requires raw >= 70 for suggestions). The rationale: in automatic mode, we want fewer false negatives (missed matches) at the cost of occasional false positives that the user can review and unlink.

**Both SAT and bank matching use the same `autoLinkedConfidence` field.** Bank matching already produces 0.00-1.00 scores natively (from `bank-matching.ts`), so no normalization needed for bank matches.

#### 1.5 Backfill strategy for existing data ✅

When Phase 1 is first deployed, there may be hundreds of existing `SatCfdiMetadata` records never registered to the ledger. Options:

1. **One-time API endpoint:** `POST /api/sat-descarga/backfill-ledger` — runs `autoRegisterCfdisToLedger` for all unlinked CFDIs for the doctor. Includes per-doctor in-memory lock (returns 429 if already running). Triggered manually from the SAT Descarga UI with a "Registrar todos los pendientes" button.
2. **Gradual:** Only process new syncs going forward. Users can still manually register old CFDIs via the existing "Registrar" button.

**Recommendation:** Option 1 (one-time endpoint). Most doctors will want their historical CFDIs registered immediately. The backfill should run in batches (e.g., 50 at a time) to avoid timeouts, and should set `needsReview=true` on ALL backfill auto-links since there's no sync-context to validate against.

#### 1.6 Balance impact ✅

Auto-created entries follow differentiated payment defaults. This means the balance summary will change immediately after a SAT sync for emitted CFDIs, but received CFDIs stay PENDING until confirmed.

This is **correct behavior** — if a CFDI exists in SAT, the transaction happened. However, for received CFDIs (expenses), the doctor may not have paid yet. Consider:
- **Emitted CFDIs (income):** Default to `PAID` — the doctor issued the invoice, money was received
- **Received CFDIs (expense):** Default to `PENDING` — the doctor received an invoice but may not have paid yet

This aligns with the real-world flow: receiving an invoice doesn't mean paying it immediately. The doctor can update `amountPaid` later via inline editing in the ledger table or when the bank statement confirms the payment.

### Schema changes

```prisma
// Add to LedgerEntry
autoLinkedConfidence  Decimal?  @map("auto_linked_confidence") @db.Decimal(5, 4)
needsReview           Boolean   @default(false) @map("needs_review")
```

> **Why `DECIMAL(5,4)`:** Stores 0.0000-9.9999. Both SAT scores (normalized from 0-120 to 0.00-1.00) and bank scores (native 0.00-1.00) fit comfortably. Avoids the DECIMAL(3,2) issue where max 9.99 looks like a percentage but bank-matching uses 0.00-0.99.

This lets the UI show a "needs review" badge on entries that were auto-linked with medium confidence.

---

## Phase 2: Bank Import Match-First (PDF Path)

**Problem:** `POST /api/bank-statement-import` bulk-creates LedgerEntries blindly. If SAT-origin entries already exist for those movements, duplicates are created.

**Solution:** Apply the same match-first logic that `conciliacion-bancaria` (CSV path) already uses.

### Changes

#### 2.1 Unify PDF and CSV import paths (recommended approach)

> **Cross-app issue:** The current PDF import (`bank-statement-import/route.ts`) lives in `apps/doctor`
> (frontend app), but the matching engine (`bank-matching.ts`) lives in `apps/api`. Rather than
> duplicating matching logic or adding cross-app calls, the cleanest solution is to route PDF
> imports through the same `conciliacion-bancaria` pipeline that CSV already uses.

**Approach:** Make the PDF import create `BankStatement` + `BankMovement` records first, then use the existing matching/review flow:

1. PDF upload → GPT-4o parse → `POST /api/practice-management/conciliacion-bancaria` (create `BankStatement` + `BankMovement` records from parsed data)
2. Run `bank-matching.ts` against existing LedgerEntries (already implemented for CSV)
3. User reviews in the conciliacion detail page `/conciliacion-bancaria/[id]` (already built)
4. User confirms matches / creates new entries via existing movement actions

This eliminates the separate `bank-statement-import` endpoint and uses the existing, more sophisticated matching infrastructure in `apps/api`.

**Files to modify:**
- `apps/doctor/src/app/api/bank-statement-parse/route.ts` — Keep as-is (GPT-4o PDF parsing)
- `apps/doctor/.../conciliacion-bancaria/_components/usePdfImport.ts` — After parsing, call `POST /api/practice-management/conciliacion-bancaria` with parsed movements instead of `bank-statement-import`
- `apps/api/src/app/api/practice-management/conciliacion-bancaria/route.ts` — Accept both CSV content and pre-parsed movement arrays
- **DELETE** `apps/doctor/src/app/api/bank-statement-import/route.ts` — No longer needed

#### 2.2 Enrich existing entry when matched

When a bank movement matches an existing entry (e.g., from SAT), the existing conciliacion `PATCH .../movements/[movId]` `create_entry` action needs a new action: `link_existing`.

When `matchStatus` is confirmed:

```typescript
// 1. Enrich the existing LedgerEntry with bank data
await prisma.ledgerEntry.update({
  where: { id: matchedEntry.id },
  data: {
    bankAccount: bankName,
    bankMovementId: movement.reference,
    hasComprobante: true,
    // Don't overwrite: amount, concept, area, origin, satCfdiUuid
  }
});

// 2. Link the BankMovement record to the LedgerEntry via FK
await prisma.bankMovement.update({
  where: { id: movement.id },
  data: {
    ledgerEntryId: matchedEntry.id,
    matchStatus: 'matched_confirmed',
    matchedAt: new Date(),
  }
});
```

> **BankMovement FK clarification:** LedgerEntry has TWO bank-related fields:
> - `bankMovementId` (String) — just a text reference number from the bank (e.g., "REF-12345")
> - `bankMovement` relation (1:1 FK via `BankMovement.ledgerEntryId`) — proper relational link to the `BankMovement` record
>
> When matching, we set BOTH: the text reference for display, and the FK for the proper relation.
> The entry keeps its original `origin` (e.g., `sat_recibido`) but gains bank reconciliation data.

#### 2.3 Update review UI to show matches

The conciliacion detail page (`/conciliacion-bancaria/[id]`) already shows match status per movement via `MovementActions.tsx`. It already supports:
- `matched_auto` — system found a match (user can confirm or reject)
- `matched_confirmed` — user confirmed the match
- `unmatched` — no match found, user can create new entry or link manually

No major UI changes needed — the existing flow handles this. The only addition is ensuring PDF-imported movements flow through this same page instead of the separate `PdfReviewTable`.

#### 2.4 Transition plan for PdfReviewTable

Short-term: keep `PdfReviewTable` working but add a deprecation notice.
Medium-term: redirect PDF uploads to the conciliacion flow. The `PdfReviewTable` can be removed once the unified flow is validated.

---

## Phase 3: Cross-Source Deduplication Rules

### 3.1 SAT vs Bank (most critical)

Already handled by Phases 1 and 2. The flow:

```
Month starts:
  SAT sync runs → CFDIs auto-create LedgerEntries (Phase 1)

Month ends:
  User uploads bank statement PDF
  → System matches bank lines to existing SAT entries (Phase 2)
  → Matched: enrich with bank data
  → Unmatched: create new entry (probably cash or non-invoiced)
```

### 3.2 SAT vs Citas/Webhooks

**Scenario:** Doctor completes appointment → webhook creates entry (`origin: webhook_pago`). Later, SAT sync downloads the CFDI for the same service.

**Solution:** Phase 1's auto-register already handles this. The match-before-create will find the cita/webhook entry by:
- Amount match (exact — same service price)
- Date match (same day or +1-2 days for CFDI issuance delay)
- Auto-link: set `satCfdiUuid` and `hasFactura=true` on the existing cita entry

**No new code needed** — Phase 1 covers this naturally.

### 3.3 SAT vs Ventas/Compras

**Scenario:** Doctor creates a Venta → auto-creates entry (`origin: venta`). Later, the emitted CFDI for that sale is downloaded from SAT.

**Solution:** Same as 3.2 — Phase 1's matching will find the venta entry. The match signals:
- Amount: exact match (sale total = CFDI monto)
- Date: close (sale date ~ CFDI issuedAt)
- RFC: exact (client RFC = CFDI receiver RFC)

High confidence → auto-link.

### 3.4 Bank vs Citas/Webhooks

**Scenario:** Webhook creates entry for online payment. Bank statement shows the same deposit.

**Solution:** Phase 2's bank matching handles this. The webhook entry already exists; bank import matches and enriches it with bank data.

### 3.5 Preventing future duplicates from Ventas/Compras

**Optional consideration:** Since SAT is now the primary fiscal source, we could:
- Keep Ventas/Compras auto-creating ledger entries (useful for immediate tracking before SAT sync)
- When SAT auto-links to a venta/compra entry, mark it as "fiscally confirmed"
- Add a warning in Ventas/Compras creation if a matching SAT CFDI already created an entry

For now, the existing dedup in `POST /ledger` (amount +/-1%, date +/-3 days) is sufficient.

---

## Phase 4: Enrichment Model

### 4.1 Facturas (CfdiEmitted) — No changes needed

Current behavior is correct:
- Facturas created in the app do NOT create ledger entries
- They can optionally link to existing entries via `ledgerEntryId`
- When the same factura appears via SAT Descarga, it auto-links to the existing entry
- No duplication risk

### 4.2 Pagos — Enrichment only

Pagos update `amountPaid` and `paymentStatus` on existing entries. This is already correct behavior:
- A Pago is never the source of truth for a movement's existence
- It just tracks how much has been collected/paid against an existing entry
- No changes needed

### 4.3 Completeness scoring update

**File:** `apps/api/src/app/api/practice-management/ledger/completeness/route.ts`

Update the completeness algorithm to reflect the new model:

| Evidence level | Score | Meaning |
|---------------|-------|---------|
| SAT CFDI linked + Bank matched | 100% | Fully reconciled |
| SAT CFDI linked only | 75% | Fiscal proof, pending bank confirmation |
| Bank matched only | 75% | Financial proof, missing fiscal backing |
| Manual with comprobante | 50% | Has proof but not from authoritative source |
| Manual without evidence | 25% | Unverified |

---

## Phase 5: User Review & Reconciliation Dashboard

### 5.1 "Needs Review" indicator in Flujo de Dinero ✅

> **Status:** Implemented (2026-06-12).

- ✅ `GET /ledger` accepts `?needsReview=true|false` query param
- ✅ "Revisión" dropdown filter in LedgerFilters (Todos / Por revisar / Revisados)
- ✅ Yellow "Revisar" badge with AlertTriangle icon in Evidencia column (mobile + desktop)
- ✅ Desktop tooltip shows auto-link confidence percentage
- ✅ Confirm button (✓) — sets `needsReview=false` via PATCH
- ✅ Unlink button (✕) — calls `DELETE /link-cfdi`, clears satCfdiUuid + needsReview + autoLinkedConfidence
- ✅ `PATCH /ledger/:id` accepts `needsReview` field
- ✅ `DELETE /ledger/:id/link-cfdi` clears all auto-link metadata on unlink

### 5.2 Monthly reconciliation summary

Add to the Completitud tab or as a new sub-tab:

```
Month: June 2026
────────────────────────────────────────
SAT CFDIs downloaded:        45
  → Auto-linked to existing:  12
  → Auto-created new:         28
  → Pending review:            5

Bank movements imported:     62
  → Matched to SAT entries:   30
  → Matched to other entries:  8
  → Created new:              20
  → Pending review:            4

Reconciliation:
  Fully reconciled (SAT + Bank):  30 / 62  (48%)
  SAT only (missing bank):       15
  Bank only (missing CFDI):      20
  Unreconciled:                    9
────────────────────────────────────────
```

### 5.3 Merge/split actions

Allow users to:
- **Merge:** Two entries that are actually the same movement (e.g., one from SAT, one from bank that wasn't auto-matched). Keep one, transfer enrichment data, delete the other.
- **Unlink:** Remove an incorrect SAT or bank match.
- **Force link:** Manually connect a bank movement to an existing entry.

---

## Implementation Order

| Phase | Effort | Impact | Dependencies | Status |
|-------|--------|--------|-------------|--------|
| **Phase 1:** SAT auto-creation | Medium | High — eliminates manual registration | None | ✅ Done (incl. backfill + rate limit) |
| **Phase 2:** Bank match-first | Medium | High — prevents SAT+bank duplicates | Phase 1 | ✅ Done (2.1 PDF unification + 2.2 enrichment) |
| **Phase 3:** Cross-source dedup rules | Low | Medium — covered by Phase 1+2 naturally | Phase 1, 2 | ⏳ Not started |
| **Phase 4:** Enrichment model | Low | Low — mostly already correct | None | ⏳ Not started |
| **Phase 5:** Review dashboard | Medium | Medium — user confidence & oversight | Phase 1, 2 | ✅ 5.1 done (5.2-5.3 pending) |

### Recommended build order:

1. **Phase 1** first — SAT auto-creation is the foundation. Once CFDIs auto-create entries, all other matching becomes possible.
2. **Phase 2** next — Bank import match-first prevents the most common duplication scenario.
3. **Phase 3** is mostly "free" — the dedup rules emerge from Phases 1+2 working together.
4. **Phase 4** is already done — just document the current behavior.
5. **Phase 5** last — polish and user trust.

---

## Schema Changes Summary

> **IMPORTANT:** Follow the deployment workflow from `docs/NEW.MD-GUIDES/database-architecture.md`.
> Schema changes MUST reach the DB BEFORE deploying code. Never use `prisma db push` locally.

### Prisma schema additions

```prisma
// LedgerEntry additions (packages/database/prisma/schema.prisma)
model LedgerEntry {
  // ... existing fields ...

  // Phase 1: Auto-linking metadata
  autoLinkedConfidence  Decimal?  @map("auto_linked_confidence") @db.Decimal(5, 4)
  needsReview           Boolean   @default(false) @map("needs_review")

  // Phase 2: Bank reconciliation enrichment (already have bankAccount, bankMovementId)
  // No new fields needed — existing fields suffice

  // Phase 5: Merge tracking (optional, self-referential)
  mergedFromId          Int?      @map("merged_from_id")
  mergedFrom            LedgerEntry?  @relation("LedgerMerge", fields: [mergedFromId], references: [id], onDelete: SetNull)
  mergedInto            LedgerEntry[] @relation("LedgerMerge")
}
```

### SQL Migration File

**File:** `packages/database/prisma/migrations/add-ledger-auto-link-fields.sql`

```sql
-- Migration: Add auto-link and review fields to ledger_entries
-- Purpose: Support SAT auto-registration and bank reconciliation matching
-- Date: 2026-06-12

ALTER TABLE "practice_management"."ledger_entries"
  ADD COLUMN IF NOT EXISTS "auto_linked_confidence" DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS "needs_review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "merged_from_id" INTEGER;

-- Index for filtering entries that need review (partial index, only where true)
CREATE INDEX IF NOT EXISTS ledger_entries_needs_review_idx
  ON "practice_management"."ledger_entries"("doctor_id", "needs_review")
  WHERE "needs_review" = true;

-- Index for merge tracking lookups
CREATE INDEX IF NOT EXISTS ledger_entries_merged_from_idx
  ON "practice_management"."ledger_entries"("merged_from_id")
  WHERE "merged_from_id" IS NOT NULL;

-- FK for merge tracking (self-referential, ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_merged_from_fkey'
  ) THEN
    ALTER TABLE "practice_management"."ledger_entries"
      ADD CONSTRAINT "ledger_entries_merged_from_fkey"
      FOREIGN KEY ("merged_from_id")
      REFERENCES "practice_management"."ledger_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
```

### Deployment order ✅ COMPLETED

All steps executed on 2026-06-12:
1. ✅ Fields added to `schema.prisma`
2. ✅ SQL migration file created
3. ✅ Migration applied to Railway (via Node.js `$executeRawUnsafe` — `psql` not available on dev machine)
4. ✅ Migration applied to local DB
5. ✅ Type-check passed (0 errors)
6. ⏳ Deploy pending (git push)

> **Note:** Since `psql` is not installed locally, migrations are run via:
> ```js
> // From packages/database/
> node -e "const { PrismaClient } = require('@prisma/client'); ..."
> // Execute each SQL statement individually (Prisma doesn't support multi-statement $executeRawUnsafe)
> ```

---

## Key Files to Modify

### Phase 1 ✅
| File | Change | Status |
|------|--------|--------|
| `apps/api/src/lib/sat-auto-register.ts` | **NEW** — shared scoring (`scoreCfdiMatch`, `normalizeScore`, `resolveEntryType`) + `autoRegisterCfdisToLedger()` | ✅ Done |
| `apps/api/src/app/api/cron/sat-sync-worker/route.ts` | Hook auto-register at 2 completion points (metadata + XML) | ✅ Done |
| `apps/api/src/app/api/sat-descarga/register-to-ledger/route.ts` | Refactored to use shared logic from `sat-auto-register.ts` + fixed payment defaults | ✅ Done |
| `apps/api/src/app/api/sat-descarga/backfill-ledger/route.ts` | **NEW** — one-time backfill endpoint with per-doctor rate limiting | ✅ Done |
| `packages/database/prisma/schema.prisma` | Added `autoLinkedConfidence`, `needsReview`, `mergedFromId` fields + self-relation | ✅ Done |
| `packages/database/prisma/migrations/add-ledger-auto-link-fields.sql` | **NEW** — SQL migration (applied to Railway + local) | ✅ Done |

### Phase 2 ✅
| File | Change | Status |
|------|--------|--------|
| `apps/doctor/.../conciliacion-bancaria/_components/usePdfImport.ts` | After PDF parse, call `POST /api/practice-management/conciliacion-bancaria` instead of `bank-statement-import`. Redirects to detail page on success. | ✅ Done |
| `apps/api/src/app/api/practice-management/conciliacion-bancaria/route.ts` | Accept pre-parsed movement arrays (not just CSV), set `fileType: 'pdf'` dynamically | ✅ Done |
| `apps/doctor/.../conciliacion-bancaria/page.tsx` | Import `useRouter`, redirect to detail page after PDF import | ✅ Done |
| `apps/api/src/app/api/practice-management/conciliacion-bancaria/[id]/movements/[movId]/route.ts` | `link_existing` + `confirm_match` now enrich ledger entry (bankAccount, bankMovementId, paymentStatus→PAID, needsReview→false) | ✅ Done |
| `apps/doctor/src/app/api/bank-statement-import/route.ts` | **DELETE** — replaced by unified conciliacion flow | ⏳ Cleanup |

### Phase 5 (5.1 ✅, 5.2-5.3 ⏳)
| File | Change | Status |
|------|--------|--------|
| `apps/doctor/.../LedgerFilters.tsx` | "Revisión" filter dropdown (Por revisar / Revisados) | ✅ Done |
| `apps/doctor/.../LedgerTable.tsx` | Review badge + confirm ✓ / unlink ✕ buttons (mobile + desktop) | ✅ Done |
| `apps/doctor/.../useLedgerPage.ts` | `reviewFilter` state + `handleConfirmReview` / `handleUnlinkCfdi` handlers | ✅ Done |
| `apps/doctor/.../ledger-types.ts` | Added `needsReview`, `autoLinkedConfidence` to LedgerEntry type | ✅ Done |
| `apps/doctor/.../page.tsx` | Wired all new props to LedgerFilters + LedgerTable | ✅ Done |
| `apps/api/.../ledger/route.ts` | `?needsReview=true\|false` query param on GET | ✅ Done |
| `apps/api/.../ledger/[id]/route.ts` | PATCH accepts `needsReview` for confirm action | ✅ Done |
| `apps/api/.../ledger/[id]/link-cfdi/route.ts` | DELETE clears `needsReview` + `autoLinkedConfidence` | ✅ Done |
| `apps/doctor/.../CompletenessTab.tsx` | Reconciliation summary (Phase 5.2) | ⏳ Not yet |

---

## Risk Mitigations

1. **False auto-links:** Score threshold of raw 80/120 (normalized 0.67) for silent auto-link is conservative. Medium-confidence matches (raw 60-79, normalized 0.50-0.66) auto-link but are flagged with `needsReview=true`. User can always unlink via the ledger table.

2. **Missing matches:** 7-day date window + 1% amount tolerance is generous. If a match is missed, the entry is created as new — user can merge later (Phase 5).

3. **SAT sync timing:** CFDIs may appear in SAT 24-72 hours after issuance. If bank statement is imported before SAT sync, entries are created from bank first. When SAT syncs later, Phase 1 will match and link the CFDI to the existing bank entry.

4. **Complementos de Pago:** Explicitly excluded from auto-creation (efecto=P). These are payment receipts for PPD invoices and should update existing PPD entries' payment status, not create new movements. Handled by the existing PPD ledger system.

5. **Backwards compatibility:** All changes are additive. Existing entries keep their current `origin` and data. New fields (`autoLinkedConfidence`, `needsReview`) default to `null`/`false`.

6. **Balance impact of auto-creation:** Auto-created entries from emitted CFDIs (income) default to `PAID`. Received CFDIs (expenses) default to `PENDING` to reflect that receiving an invoice doesn't mean payment was made. This prevents the balance from showing inflated expenses before actual payment. See Phase 1.6 for details.

7. **Backfill safety:** The one-time backfill endpoint (Phase 1.5) processes in batches of 50 and sets `needsReview=true` on ALL auto-links since there's no recent sync context. This ensures no silent incorrect links on historical data.

8. **Cross-app consistency:** PDF bank import is unified into the `conciliacion-bancaria` pipeline (Phase 2.1), eliminating the split between `apps/doctor` (PDF) and `apps/api` (CSV+matching). All matching logic stays in `apps/api`.
