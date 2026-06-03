# Ledger Entry Lifecycle Flows — Design Document

## Core Principle: "Create Once, Enrich Many"

The `LedgerEntry` table in flujo-de-dinero is the **single aggregation point** for all financial movements. The fundamental rule is:

> **One real-world financial event = exactly ONE LedgerEntry.**
> Subsequent data sources ENRICH that entry (adding evidence) instead of creating duplicates.

---

## Current Problem: Cross-Origin Duplication

Today, each source independently creates entries with no awareness of other sources:

```
Real-world event: "Patient pays $5,000 for consultation"

Current behavior (3 entries created):
  1. Doctor completes booking     -> LedgerEntry (origin: cita)
  2. Bank statement imported      -> LedgerEntry (origin: banco)      [DUPLICATE]
  3. SAT CFDI registered          -> LedgerEntry (origin: sat_recibido) [DUPLICATE]
```

**What's protected today:**
- `cita` <-> `webhook_pago`: share `bookingId` unique constraint (can't duplicate)
- Multiple SAT imports: `satCfdiUuid` unique constraint
- Same bank statement re-upload: statement-level unique constraint

**What's NOT protected (creates duplicates):**
- ANY origin <-> `banco` (bank import always creates new entries)
- ANY origin <-> `sat_recibido` (SAT registration always creates new entries)
- `venta` <-> `cita` (no cross-check)

---

## Evidence Model

Every LedgerEntry can accumulate up to 3 types of evidence:

| Evidence Type | Field(s) | Meaning |
|---|---|---|
| **Comprobante** (payment proof) | `hasComprobante`, `attachments[]` | Receipt, bank slip, payment screenshot |
| **Factura** (fiscal proof) | `hasFactura`, `satCfdiUuid`, `facturasXml[]` | SAT CFDI linked |
| **Banco** (bank reconciliation) | `bankMovement` relation | Matched to bank statement movement |

A "complete" entry has all applicable evidence. The origin field records WHO created it first; the evidence fields record WHAT proof has been attached.

---

## Lifecycle Flows by Origin

### Flow 1: CITA (Appointment)

**Trigger:** Doctor marks booking as COMPLETED in the appointments UI.

```
CREATION
  1. completeBooking() fires
  2. POST /api/practice-management/ledger
     - origin: "cita"
     - bookingId: unique (prevents webhook_pago duplicate)
     - entryType: "ingreso"
     - amount: booking.finalPrice
     - area: "Ingresos Consulta" / serviceName
     - paymentStatus: "PAID", amountPaid: full

ENRICHMENT (later, automatic)
  3. Bank statement imported -> matching engine finds this entry by amount+date
     -> LINK (confirm_match), don't create new entry
     -> Sets: bankMovement relation, hasComprobante=true

  4. SAT CFDI imported -> register-to-ledger checks existing entries first
     -> LINK (set satCfdiUuid + hasFactura=true), don't create new entry
     OR: CfdiSuggestionPopover suggests match -> user links

COMPLETE STATE
  [x] Entry exists (origin: cita)
  [x] Comprobante (bank statement linked)
  [x] Factura (CFDI linked)
  [x] Banco (bank movement matched)
```

### Flow 2: WEBHOOK_PAGO (Online Payment)

**Trigger:** Stripe/MercadoPago webhook fires on successful payment.

```
CREATION
  1. Webhook receives payment.approved
  2. createPaymentLedgerEntry() helper
     - Checks bookingId: if entry already exists (from cita), returns null [PROTECTED]
     - Otherwise creates entry with origin: "webhook_pago"
     - hasComprobante: true (payment provider is the proof)

ENRICHMENT (same as cita)
  3. Bank statement -> match by amount+date -> LINK
  4. SAT CFDI -> match and link

NOTE: If cita already created the entry, webhook does NOT create a second one.
      This is the only cross-origin dedup that works today.
```

### Flow 3: VENTA (Sale)

**Trigger:** Doctor creates a Sale in the Ventas module.

```
CREATION
  1. POST /api/practice-management/ventas
  2. Creates Sale + LedgerEntry atomically in transaction
     - origin: "venta"
     - transactionType: "VENTA"
     - saleId: links to Sale record
     - clientId: links to Client
     - paymentStatus: calculated from amountPaid

ENRICHMENT (later)
  3. Bank statement -> match by amount+date -> LINK
     -> Confirms the sale payment arrived in bank
  4. SAT CFDI -> match and link
     -> Confirms fiscal invoice exists for this sale

IMPORTANT: Ventas support PARTIAL payments and multiple ledger entries per sale.
  - Sale.ledgerEntries is 1:N (multiple payment installments)
  - Each partial payment = separate LedgerEntry with same saleId
  - amountPaid on Sale is the SUM of all linked entries

COMPLETE STATE
  [x] Entry exists (origin: venta)
  [x] Factura (CFDI linked)
  [x] Banco (bank movement matched for each payment)
```

### Flow 4: COMPRA (Purchase)

**Trigger:** Doctor creates a Purchase in the Compras module.

```
CREATION
  1. POST /api/practice-management/compras
  2. Creates Purchase + LedgerEntry atomically
     - origin: "compra"
     - transactionType: "COMPRA"
     - purchaseId: links to Purchase record
     - supplierId: links to Proveedor
     - entryType: "egreso"

ENRICHMENT (later)
  3. Bank statement -> match by amount+date -> LINK
  4. SAT CFDI (received) -> match and link

SAME partial payment model as Ventas (1:N ledger entries per purchase).
```

### Flow 5: MANUAL (Manual Entry)

**Trigger:** Doctor creates entry directly in flujo-de-dinero/new.

```
CREATION
  1. POST /api/practice-management/ledger
     - origin: "manual"
     - All fields user-provided
     - Can be ingreso or egreso
     - Can attach comprobante files

ENRICHMENT (later)
  2. Bank statement -> match by amount+date -> LINK
  3. SAT CFDI -> CfdiSuggestionPopover or register-to-ledger match -> LINK

USE CASES for manual:
  - Cash income not from appointments (rent received, loan repayment, etc.)
  - Expenses not modeled as Compras (one-off payments, petty cash)
  - Corrections or adjustments
```

### Flow 6: BANCO (Bank Import) — NEEDS REDESIGN

**Trigger:** Doctor uploads bank statement CSV in conciliacion-bancaria.

```
CURRENT BEHAVIOR (problematic):
  1. CSV parsed, movements extracted
  2. Auto-matching engine runs (amount + date + reference, >=0.50 confidence)
  3. Matched movements: linked to existing entries [GOOD]
  4. Unmatched movements: user clicks "Registrar" -> creates NEW entry [DUPLICATION RISK]

PROPOSED BEHAVIOR:
  1. CSV parsed, movements extracted
  2. Auto-matching engine runs (ENHANCED - see below)
  3. Matched movements: linked to existing entries [SAME]
  4. Unmatched movements:
     a. Show "possible matches" from existing entries (looser criteria)
     b. User can LINK to existing entry (new action: "link_existing")
     c. User can create new entry (only if genuinely new)
     d. User can ignore

ENHANCED MATCHING should also check:
  - Entries with origin "venta" or "compra" that match amount+date
  - Entries with origin "cita" that match amount+date
  - Entries already linked to SAT CFDI with matching amount
```

### Flow 7: SAT_RECIBIDO / SAT_EMITIDO (SAT CFDI Import) — NEEDS REDESIGN

**Trigger:** Doctor imports CFDIs from SAT Descarga Masiva.

```
CURRENT BEHAVIOR (problematic):
  1. User selects CFDIs to register
  2. POST /api/sat-descarga/register-to-ledger
  3. Checks if satCfdiUuid already registered [GOOD - prevents SAT-to-SAT dupes]
  4. Creates NEW LedgerEntry for each [DUPLICATION RISK vs other origins]

PROPOSED BEHAVIOR:
  1. User selects CFDIs to register
  2. For each CFDI, system FIRST searches for matching existing entries:
     - Same amount (within 1% tolerance)
     - Same date range (within 3 days)
     - Same entryType (based on direction+efecto mapping)
     - Bonus: matching client/supplier RFC
  3. If match found with HIGH confidence:
     -> Auto-LINK: set satCfdiUuid + hasFactura=true on existing entry
     -> Show to user as "Vinculado a [entry concept]"
  4. If match found with MEDIUM confidence:
     -> SUGGEST: show candidate entries, let user choose to link or create new
  5. If NO match:
     -> CREATE new entry as today (origin: sat_recibido/sat_emitido)

NOTE: The matching algorithm already EXISTS in cfdi-suggestions route.
      We just need to run it IN REVERSE at registration time.
```

---

## Deduplication Rules Matrix

For any pair of origins, this defines whether linking should happen:

| First Entry | Second Source | Action | Mechanism |
|---|---|---|---|
| cita | webhook_pago | BLOCK creation | `bookingId` unique (EXISTS) |
| cita | banco | LINK to existing | Enhanced bank matching (TO BUILD) |
| cita | sat_recibido | LINK to existing | Match-before-create (TO BUILD) |
| venta | banco | LINK to existing | Enhanced bank matching (TO BUILD) |
| venta | sat_recibido | LINK to existing | Match-before-create (TO BUILD) |
| compra | banco | LINK to existing | Enhanced bank matching (TO BUILD) |
| compra | sat_recibido | LINK to existing | Match-before-create (TO BUILD) |
| manual | banco | LINK to existing | Enhanced bank matching (TO BUILD) |
| manual | sat_recibido | LINK to existing | Match-before-create (TO BUILD) |
| webhook_pago | banco | LINK to existing | Enhanced bank matching (TO BUILD) |
| webhook_pago | sat_recibido | LINK to existing | Match-before-create (TO BUILD) |
| banco | sat_recibido | LINK to existing | Match-before-create (TO BUILD) |
| sat_recibido | banco | LINK to existing | Enhanced bank matching (TO BUILD) |

**Pattern:** The first source to create the entry "wins" the origin. All subsequent sources LINK.

---

## Implementation Plan

### Phase 1: SAT Register-to-Ledger — Match Before Create

**File:** `apps/api/src/app/api/sat-descarga/register-to-ledger/route.ts`

Changes:
1. Before creating a new entry for each CFDI, query existing LedgerEntries:
   ```
   WHERE doctorId = X
     AND satCfdiUuid IS NULL (not already linked to a CFDI)
     AND amount BETWEEN (cfdi.monto * 0.99) AND (cfdi.monto * 1.01)
     AND transactionDate BETWEEN (cfdi.issuedAt - 3 days) AND (cfdi.issuedAt + 3 days)
     AND entryType = (mapped from direction+efecto)
   ```
2. If exactly 1 match with high confidence -> auto-link (update entry with satCfdiUuid, hasFactura=true)
3. If multiple matches -> pick best (closest date, then closest amount)
4. If no match -> create new entry (current behavior)
5. Return response indicating which were LINKED vs CREATED

### Phase 2: Bank Reconciliation — Link Existing Entry Action

**File:** `apps/api/src/app/api/practice-management/conciliacion-bancaria/[id]/movements/[movId]/route.ts`

Changes:
1. Add new action: `link_existing` to PATCH handler
   - Accepts `ledgerEntryId` in body
   - Links bank movement to existing entry
   - Updates entry: `hasComprobante=true`
   - Sets matchStatus to `matched_confirmed`
2. Enhance auto-matching to also consider entries with origin != 'banco'
   - Current matching already does this but the UI only shows "Confirmar" or "Registrar"
   - For unmatched movements, show a "Posibles coincidencias" section with existing entries

### Phase 3: UI — Show Match Suggestions for Unmatched Bank Movements

**File:** `apps/doctor/src/app/dashboard/practice/conciliacion-bancaria/_components/MovementActions.tsx`

Changes:
1. For unmatched movements, before showing "Registrar" form, fetch potential matches
2. Show list of candidate entries (amount, date, concept, origin badge)
3. "Vincular" button per candidate -> calls PATCH with action=link_existing
4. "Crear nuevo" button -> falls through to current create_entry flow

### Phase 4: Duplicate Detection Warning (Safety Net)

**File:** `apps/api/src/app/api/practice-management/ledger/route.ts` (POST)

Changes:
1. Before creating ANY new entry, check for potential duplicates:
   ```
   WHERE doctorId = X
     AND amount = newAmount
     AND entryType = newEntryType
     AND transactionDate BETWEEN (date - 3 days) AND (date + 3 days)
   ```
2. If found, return `{ warning: true, potentialDuplicates: [...] }` in response
3. Client shows warning dialog: "This looks similar to existing entry X. Create anyway?"
4. Client can re-submit with `force: true` to bypass

---

## Completeness Indicators

Each entry in the flujo-de-dinero table should visually show its evidence state:

```
Evidencia column (current 3 icons):
  [Origin Badge]  [Comprobante]  [Factura]

Proposed addition — Banco indicator:
  [Origin Badge]  [Banco]  [Comprobante]  [Factura]

States:
  Banco:       green = linked to bank movement, gray = not yet reconciled
  Comprobante: green = has attachment/proof, gray = no proof
  Factura:     green = CFDI linked, gray = no CFDI (+ suggestion popover)
```

---

## Venta vs Cita: Do We Need Both?

**Answer: Yes, both are needed.** They model different business concepts:

| | Cita (Appointment) | Venta (Sale) |
|---|---|---|
| **What** | Payment for a single medical service | Sale of products/packages/multi-item invoices |
| **Items** | 1 service (from booking) | N line items (SaleItem[]) with quantities |
| **Client** | Patient (from booking) | Client (from Clients module) |
| **Partial pay** | No (always PAID on completion) | Yes (PENDING -> PARTIAL -> PAID) |
| **Multiple payments** | No (1 entry per booking) | Yes (N entries per sale, tracks installments) |
| **Trigger** | Complete booking | Create sale |

**Risk of user-error duplication:** A doctor could complete a booking (cita entry) AND create a Venta for the same patient/service. This is unlikely in practice because:
1. Ventas are designed for product sales, not consultations
2. The UI workflows are separate (Appointments vs Ventas module)

But as a safety net, Phase 4's duplicate detection would flag this.

---

## Summary of Changes Needed

| # | What | Where | Effort |
|---|---|---|---|
| 1 | Match-before-create in SAT registration | `register-to-ledger/route.ts` | Medium |
| 2 | `link_existing` action for bank movements | `movements/[movId]/route.ts` | Small |
| 3 | Fetch + show match suggestions in bank UI | `MovementActions.tsx` + new API | Medium |
| 4 | Duplicate detection warning on entry creation | `ledger/route.ts` POST + client | Medium |
| 5 | Add banco indicator to Evidencia column | `LedgerTable.tsx` + types | Small |

Priority order: 1 > 2+3 > 4 > 5 (Phase 1 solves the most common duplication scenario)
