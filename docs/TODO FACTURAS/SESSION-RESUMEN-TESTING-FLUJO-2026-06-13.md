# Session Resumen — Testing Flujo de Dinero (CFDI + Banco)

**Date:** 2026-06-13 (testing session, follows the build session)
**Context for:** next LLM session continuing the Consolidated Money Model.
**Companion docs:**
- Build handoff: `docs/TODO FACTURAS/SESSION-RESUMEN-COUNTERPARTY-SETTLEMENT.md`
- **Permutation map (NEW this session):** `docs/TODO FACTURAS/flujo permutations/` (7 docs — read the README first)
- Master plan: `docs/TODO FACTURAS/CONSOLIDATED-MONEY-MODEL.md`

---

## What this session did
Ran a guided end-to-end test **as a new doctor in production** (zero ledger entries), replicating
a coffee company's real CFDIs as appointments (fine — the matcher only sees RFC/name/amount/date).
Also built a full permutation/flow map of the section.

## ✅ Validated in prod
1. **CFDI auto-match** via the **"Registrar pendientes"** button (sync panel) = `backfill-ledger`
   → `autoRegisterCfdisToLedger` (auto-links ≥0.67, needsReview 0.50–0.66, creates <0.50):
   - Cita entry **with** patient RFC → linked. ✓
   - Cita entry **without** RFC (name+amount+date only) → linked. ✓
   - **No duplicates** created. Gap 1 confirmed working.
   - ⚠️ Note: the per-row **"Registrar"** button is the *suggestion-only* path; the auto-link is
     the **"Registrar pendientes"** button. Don't confuse them.
2. **PDF bank import → conciliación** now works end-to-end (was the blocker from last session).
3. **Manual bank link** (`link_existing` via the "Vincular" popover) works — entry gets
   `hasComprobante` + `paymentStatus=PAID`.
4. **Persistence:** the statement detail page `/dashboard/practice/conciliacion-bancaria/[id]`
   (`[id]` = BankStatement id) is fully DB-backed; closing it loses nothing.

## 🔧 Fix applied this session (IMPORTANT — DB state)
PDF import 404 (last session's URL fix `ed1d2f26`) was only the surface. The real blocker was a
**missing migration**: `bank_movements` lacked `matched_at` / `matched_by` / `match_history` on
Railway → 500 `P2022`. **Fixed by applying `packages/database/prisma/migrations/add-bank-movement-audit-trail.sql`
(idempotent, additive nullable cols) to Railway** via
`npx prisma db execute --file ... --url <LLM_DATABASE_URL from packages/database/.env>`.
No redeploy/cleanup needed (statement+movements are created in one `$transaction` → rolled back
cleanly on the failed attempts). **Local DB parity not re-verified** — confirm local has these 3
columns if testing locally.

## 🐞 Gaps found & documented (NOT fixed — parked for after testing)
- **`flujo permutations/05-appointment-rfc-gap.md`** — walk-in/new appointments without a linked
  expediente carry **no RFC** (and an expediente's RFC is optional) → degraded CFDI match.
  `completeBooking` (`useBookings.ts:249-251`) sources RFC only from `booking.patient.rfc`.
  Graceful (name fallback + manual link), so quality gap not correctness. Proposed fix: capture
  RFC at booking when `requiereFactura`.
- **`flujo permutations/06-bank-matcher-gaps.md`** — TWO findings from a live case
  (`SPEI RECIBIDO PEGASUS CONTROL +$2,150 @ 09-jun` vs cita entry `$2,150 @ 14-jun`, same name,
  showed "Sin match"):
  1. **`matchMovements` (`bank-matching.ts`) ignores `counterpartyName`/`counterpartyRfc`** — only
     uses `concept` word-overlap, and only when dates >2 days. So exact amount + same counterparty
     name but a few days apart does NOT auto-match. The Gap-1 identity fields were wired into the
     CFDI matcher (motor 2) but **never into the bank matcher (motor 3)**. Also the upload matcher
     and the per-movement suggestion endpoint use *different* scorers (inconsistent verdicts).
     **Proposed:** feed counterparty fields into `LedgerEntryForMatch` as a strong, date-independent
     signal; unify the two scorers like `scoreCfdiMatch` did.
  2. **UX:** the statement "match" column shows `categorizeMovement` category guesses (área/subárea),
     not entry-matches — misleading. **Proposed:** separate "Conciliación" from "Categoría sugerida".

## ⏸️ Where we stopped — NEXT: Step 5 (bank reconciliation scenarios)
Import works; one deposit manually linked. Not yet exercised on purpose:
- **1:1 exact** auto-match (entry amount = deposit, **date = deposit date**, within 0–2 days),
- **card-fee** match (`formaDePago='tarjeta'` entry whose gross is ~2–3% ABOVE a deposit),
- **"Varios" N:1 settlement** (one deposit = sum of 2–3 smaller entries, **none equal to the
  deposit**; canonical 3×$1,000 → $3,000).

**To resume:** ask the user for **3–4 deposit amounts + real dates** from the uploaded statement,
then have them create matching appointments/entries **dated = the deposit date** (the 5-day drift
in the PEGASUS case was a test artifact that pushed it off the strong match tiers).

## Open items (carried over + new)
- Delete unused `apps/doctor/src/app/api/bank-statement-import/route.ts` (PDF flow uses the unified path).
- Implement the two motor-3 enhancements above (doc 06) and the booking-RFC capture (doc 05).
- AI-agent (Haiku 4.5) layer not started — prompt drafted in `flujo permutations/04-llm-assistant-prompt.md`.
- Verify whether the Conciliación page is reachable from the nav menu (user thought it wasn't, then
  found it — re-confirm the entry point exists and is obvious).

## Gotchas (still apply)
- Doctor→api calls MUST use `${NEXT_PUBLIC_API_URL}`; local doctor routes (e.g. `bank-statement-parse`) stay relative.
- **Schema before deploy:** any new `schema.prisma` field needs an idempotent SQL migration run on
  Railway BEFORE the code that uses it (see `docs/NEW.MD-GUIDES/database-architecture.md`). This
  session's 500 was exactly this class of bug.
- `apps/api` tsc needs `NODE_OPTIONS=--max-old-space-size=8192`; 3 pre-existing `openai` type errors in doctor app are unrelated.

---
*Note:* this doc and the `flujo permutations/` folder are untracked (local), like the other docs in
the working tree. Not committed unless the user asks.
</content>
