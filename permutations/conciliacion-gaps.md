# Conciliacion Analysis — Correctness Verification & Gap Report

This document analyzes whether our reconciliation logic is correct and identifies gaps in the income flow.

---

## How Conciliacion Works Today

### Bank → Ledger Matching (4-Priority Algorithm)

Located in `/apps/api/src/lib/bank-matching.ts`

```
Priority 1 (confidence 0.99):
  bankMovement.reference === ledgerEntry.bankMovementId
  + amounts match (within 0.01)
  + dates within +/- 1 day

Priority 2 (confidence 0.85):
  Same exact date
  + amounts match

Priority 3 (confidence 0.70):
  Dates within +/- 2 days
  + amounts match

Priority 4 (confidence 0.50-0.65):
  Dates within +/- 7 days
  + amounts match
  + concept word overlap >= 30%
  confidence = 0.50 + (overlap * 0.15), max 0.65
```

Greedy algorithm: highest confidence matches assigned first, each entry claimed once.

### SAT → System Matching

Located in `/apps/api/src/app/api/sat-descarga/reconciliation/route.ts`

Cross-references `CfdiEmitted.uuid` against `SatCfdiMetadata.uuid` (direction=emitted):

| Category | Meaning |
| -------- | ------- |
| matched | In both system AND SAT, satStatus=Vigente |
| missingFromSat | In system but NOT in SAT downloads |
| cancelledInSat | In system (active) but SAT shows Cancelado |
| onlyInSat | In SAT but not in system CfdiEmitted |

---

## CONFIRMED GAPS

### GAP 1: Cash payments can never be bank-reconciled — FIXED

**Severity: Design limitation (acceptable)**

**Status: RESOLVED**

When `formaDePago = "efectivo"`, there is no bank movement to match against. The reconciliation ceiling for cash income is "Documented" level (comprobante uploaded).

**Fix applied:** The Completeness API (`/api/practice-management/ledger/completeness`) now returns a `bankReconciliation` object that excludes cash (`formaDePago = 'efectivo'`) and webhook (`origin = 'webhook_pago'`) entries from the reconciliation denominator. The CompletenessTab shows a 4th evidence layer ("Capa 4: Conciliacion Bancaria") with the honest percentage and explains how many entries were excluded and why.

**Files changed:**
- `apps/api/src/app/api/practice-management/ledger/completeness/route.ts` — added 4 new parallel queries, `bankReconciliation` response object, `bank_unmatched` alert
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/_components/CompletenessTab.tsx` — added 5th summary card, 4th progress bar with exclusion explanation

---

### GAP 2: No reverse matching (Ledger → Bank)

**Severity: Medium**

Matching is one-way only: when a bank statement is uploaded, it matches against existing ledger entries. But if a ledger entry is created AFTER the bank statement was already imported, it remains unmatched.

**Scenario:**
1. Doctor uploads May bank statement on June 1
2. On June 3, doctor manually creates a ledger entry for a May 15 payment they forgot
3. That entry will NOT auto-match the existing bank movement from the May statement
4. Both the bank movement and ledger entry sit unmatched

**Current workaround:** Doctor must manually go to the bank movement detail and "confirm match" or "create entry" — but they'd need to find the right movement first.

**Recommendation:** Add a "re-match" button on bank statements, or run matching automatically when new ledger entries are created within the statement's date range.

---

### GAP 3: LedgerEntry.bankMovementId is a String, not a FK

**Severity: Low (data model smell)**

`LedgerEntry.bankMovementId` is `String?` — a text field for the bank reference number, NOT a foreign key to `BankMovement.id` (which is Int).

The actual FK relationship goes from `BankMovement.ledgerEntryId → LedgerEntry.id`.

This means:
- You can find which bank movement matches a ledger entry via `BankMovement WHERE ledgerEntryId = X`
- But `LedgerEntry.bankMovementId` is just a free-text reference string (e.g. "REF123456") used by the Priority 1 matching algorithm
- These are two different concepts stored with a confusingly similar name

**Recommendation:** Rename `LedgerEntry.bankMovementId` to `bankReference` to avoid confusion.

---

### GAP 4: No reconciliation of received CFDIs (expenses)

**Severity: High**

The SAT reconciliation endpoint ONLY handles **emitted** CFDIs (direction=emitted). There is NO reconciliation for **received** CFDIs (invoices from vendors/suppliers).

**What exists:**
- `SatCfdiMetadata` stores both `direction: 'emitted'` and `direction: 'received'`
- Received CFDIs can be registered to the ledger via `register-to-ledger`
- BUT there's no automated matching between received CFDIs and bank withdrawal movements

**What's missing:**
- When doctor pays a vendor (egreso), the bank movement shows the withdrawal
- The received CFDI from that vendor sits in SAT metadata
- No logic connects the two automatically
- Doctor must manually: (1) create ledger entry from bank movement, (2) upload the CFDI XML to that entry

**Impact:** Expense reconciliation is entirely manual. For income this is less critical (doctor controls when they emit), but for expenses this creates significant audit gaps.

---

### GAP 5: Webhook payments have delayed bank matching

**Severity: Medium**

When a patient pays via Stripe/MP:
1. Webhook fires immediately → LedgerEntry created with `origin: "webhook_pago"`
2. Stripe/MP batches payouts (daily or weekly depending on configuration)
3. Payout arrives in doctor's bank account 2-7 days later
4. Bank statement shows the payout (not individual payments)

**Problem:** The bank movement amount is the AGGREGATED payout (sum of multiple payments minus fees), NOT individual transaction amounts. The matching algorithm compares exact amounts, so:
- Individual payment: $2,500
- Bank payout: $47,325 (sum of 20 payments minus 3% fees)
- Match: IMPOSSIBLE with current algorithm

**Current state:** Webhook payments get `hasComprobante: true` automatically, so they're "documented" even without bank matching. They are now **excluded from bank reconciliation KPIs** (see GAP 1 fix), so they no longer inflate the "sin match" count.

**Remaining work:** For full payout reconciliation in the future, consider:
- Add a "payment provider payout" concept that aggregates webhook entries for matching, OR
- Allow bank movements to match against MULTIPLE ledger entries (sum matching)

---

### GAP 6: No handling of partial payments in bank matching

**Severity: Medium**

The matching algorithm requires exact amount match (within 0.01). But:
- A `LedgerEntry` can have `paymentStatus: "PARTIAL"` with `amountPaid < amount`
- If the patient pays in installments, each installment is a separate bank movement
- The first installment amount won't match the total ledger amount

**Scenario:**
1. Doctor creates entry: amount=$5,000, amountPaid=$2,500, paymentStatus=PARTIAL
2. Bank shows $2,500 deposit
3. Matching looks for $5,000 in bank → no match
4. Later, another $2,500 deposit arrives
5. Still no match (algorithm matches against `amount`, not `amountPaid` or remaining balance)

**Recommendation:** Add matching against `amountPaid` or `amount - amountPaid` as a secondary check.

---

### GAP 7: Duplicate bank movement risk across statements

**Severity: Low**

Bank statements are checked for uniqueness at the statement level (doctorId + bank + account + month + year). But if a doctor uploads overlapping date ranges (e.g., a daily export + monthly statement), movements can be duplicated.

**Current safeguard:** The unique constraint prevents exact duplicate statements, but different file formats or partial exports could create movement duplication.

**Recommendation:** Add movement-level deduplication by (transactionDate + amount + reference + description) hash.

---

### GAP 8: No audit trail for manual match overrides

**Severity: Medium**

When a doctor performs these actions, there's no record of WHO did it or WHY:
- `confirm_match` — just flips matchStatus
- `unmatch` — clears the link
- `ignore` — marks as not relevant
- `create_entry` — creates entry and links

If an accountant reviews later, they can't see:
- When was this match confirmed?
- Who confirmed it?
- Was it ever unmatched and re-matched?
- Why was a movement ignored?

**Recommendation:** Add `matchedAt`, `matchedBy`, `matchHistory` (JSON array of actions) to BankMovement.

---

### GAP 9: CFDI emission is disconnected from conciliacion

**Severity: Medium**

The CFDI emission and bank reconciliation are two parallel tracks with no cross-validation:

- A LedgerEntry can be `hasFactura: true` (CFDI emitted) but NOT bank-matched
- A LedgerEntry can be bank-matched but NOT have a CFDI
- There's no view that shows "entries with CFDI but no bank proof" or vice versa

**What would be ideal:**
```
Entry has CFDI?    + Bank matched?    = Status
Yes                  Yes               FULLY RECONCILED
Yes                  No                INVOICED BUT UNMATCHED (fiscal risk: can't prove payment)
No                   Yes               MATCHED BUT NO INVOICE (fiscal risk: income without CFDI)
No                   No                UNDOCUMENTED (highest risk)
```

This matrix doesn't exist anywhere in the UI.

---

### GAP 10: No conciliacion for "cita" entries created before bank upload

**Severity: Low-Medium**

The matching window when uploading a bank statement is:
- Fetch ledger entries from `statementStartDate - 7 days` to `statementEndDate + 7 days`

But if an appointment was completed and its ledger entry `transactionDate` is outside this window (e.g., doctor completed a past appointment retroactively), it won't be included in the match candidates.

---

## WHAT'S WORKING CORRECTLY

### Correct: Booking → Ledger link integrity
- `bookingId` is unique on LedgerEntry — one booking = one ledger entry
- Webhook idempotency checks prevent duplicate entries from webhook retries

### Correct: Bank matching priority order
- Priority 1 (reference match) is the strongest and most reliable
- Greedy algorithm prevents double-matching
- Confidence scores give doctors useful information about match quality

### Correct: CFDI ↔ SAT cross-referencing
- UUID matching is deterministic and reliable
- Detecting "cancelled in SAT but active in system" catches real fiscal problems
- Detecting "only in SAT" catches manually-issued-outside-system invoices

### Correct: Auto-categorization with learned rules
- Doctor-specific rules take priority over built-in rules
- Pattern extraction (removing dates/numbers) creates reusable rules
- Rules improve over time as doctor categorizes more movements

### Correct: Evidence tracking
- `hasComprobante` and `hasFactura` flags are updated atomically with uploads
- CompletenessTab gives visibility into documentation gaps
- Bank reconciliation KPIs properly exclude non-reconcilable entries (cash, webhook) from the denominator

---

## SUMMARY: What a Doctor Needs to Do (by origin)

### From Appointments (`cita`)
```
[x] Complete booking (auto: ledger entry)
[ ] Upload comprobante in Flujo de Dinero
[ ] Emit CFDI (if patient has fiscal data)
[ ] Upload bank CSV when statement available
[ ] Confirm bank match
```

### From Manual Entry (`manual`)
```
[x] Create entry in Flujo de Dinero
[ ] Set area/subarea
[ ] Upload comprobante
[ ] Upload/emit factura
[ ] Upload bank CSV
[ ] Confirm bank match
```

### From Sales (`venta`)
```
[x] Create sale (auto: ledger entry)
[ ] Update payment status as payments received
[ ] Upload comprobante
[ ] Upload/emit factura
[ ] Upload bank CSV
[ ] Confirm bank match
```

### From Online Payment (`webhook_pago`)
```
[x] Create payment link
[x] Patient pays (auto: ledger entry + comprobante)
[ ] Emit CFDI (if patient has fiscal data)
[ ] Bank match: NOT POSSIBLE with current algorithm (aggregated payouts)
```

### From Bank Import (`banco`)
```
[x] Upload bank CSV
[x] Convert unmatched deposits to ledger entries (auto: bank match + comprobante)
[ ] Set correct area/subarea
[ ] Upload/emit factura
```

### From SAT Sync (`sat_recibido`)
```
[x] Sync from SAT (auto: metadata downloaded)
[x] Register to ledger (auto: hasFactura)
[ ] Upload bank CSV
[ ] Confirm bank match
```

---

## PRIORITY FIXES

| Priority | Gap | Effort | Impact | Status |
| -------- | --- | ------ | ------ | ------ |
| ~~P3~~ | ~~GAP 1: Cash excluded from KPIs~~ | ~~Low~~ | ~~Misleading conciliacion %~~ | **DONE** |
| P1 | GAP 9: No cross-view CFDI + Bank | Medium | Doctors can't see full reconciliation status | Pending |
| P2 | GAP 2: No reverse matching | Medium | Late entries stay unmatched | Pending |
| P2 | GAP 4: No received CFDI reconciliation | High | Expense side completely manual | Pending |
| P2 | GAP 6: Partial payment matching | Medium | Installment payments unmatched | Pending |
| P2 | GAP 5: Webhook payout aggregation | High | Full payout reconciliation (KPI fix done, deep matching pending) | Partial |
| P3 | GAP 8: No audit trail | Medium | Accountant can't verify | Pending |
| P3 | GAP 3: Field naming confusion | Low | Developer confusion | Pending |
| P4 | GAP 7: Movement deduplication | Low | Edge case | Pending |
| P4 | GAP 10: Date window edge cases | Low | Rare scenario | Pending |
