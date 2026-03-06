 # Code Efficiency Session — 2026-03-04

## Overview

Full code efficiency pass on `apps/doctor` and `apps/api`, focused on the financial / practice-management area. Goal: eliminate duplication, extract shared logic, split monolithic pages — without changing any behavior.

---

## 1. API Shared Utilities — `apps/api/src/lib/practice-utils.ts`

Created a single utility file eliminating duplication across 6+ route files.

**Exports:**
- `generateSaleNumber(tx?)` — sequential with retry loop inside transaction
- `generatePurchaseNumber(tx?)`
- `generateQuotationNumber(tx?)`
- `generateLedgerInternalId(tx?)`
- `calculatePaymentStatus(amount, amountPaid)` → `'PENDING' | 'PARTIAL' | 'PAID'`
- `computeItemTotals(items)` — subtotal, tax, tax2, total
- `parsePagination(searchParams)` — reads `page` / `limit` query params
- `buildPaginationMeta(total, page, limit)` — standard pagination envelope

---

## 2. API Route Rewrites

All routes now use `prisma.$transaction()` for atomic writes and `practice-utils.ts` for shared logic.

| Route | Changes |
|-------|---------|
| `ventas/route.ts` | POST: Sale + LedgerEntry in single transaction; GET paginated (default 50) |
| `ventas/[id]/route.ts` | Enum guard (`VALID_STATUSES`); PUT/DELETE in transaction |
| `compras/route.ts` | Same pattern; `VALID_STATUSES` for compras |
| `compras/[id]/route.ts` | Enum guard; transaction |
| `cotizaciones/route.ts` | Same pattern |
| `cotizaciones/[id]/route.ts` | Enum guard; deleteItems + update in single transaction |
| `ledger/route.ts` | GET: count + findMany in transaction; paginated |
| `clients/route.ts` | Paginated (default 200) |
| `proveedores/route.ts` | Paginated (default 200) |
| `products/route.ts` | Paginated (default 200) |

**Key patterns:**
- `VALID_STATUSES` array → 400 if status not in array (prevents enum corruption)
- Sequential number generation inside `prisma.$transaction()` with 10-attempt retry loop for collision prevention
- Pagination opt-in via `?page=1&limit=50`; master data defaults to 200 for dropdown use

---

## 3. Chat Hook Refactor — `useBasePracticeChat`

**Created:** `apps/doctor/src/hooks/useBasePracticeChat.ts`

Base hook that centralizes voice + chat message infrastructure previously duplicated across 4 hooks.

```ts
useBasePracticeChat({
  idPrefix: string,
  makeApiCall: (conversation, text) => Promise<{ message, actionSummary? }>
})
```

- Manages `messages`, `isLoading`, voice recording state
- Uses `makeApiCallRef` to avoid stale closures on the API call function
- Auto-sends message when voice recording stops

**Thinned hooks (all now ~60-70 lines each):**
- `useLedgerChat.ts`
- `useSaleChat.ts`
- `usePurchaseChat.ts`
- `useQuotationChat.ts`

---

## 4. Flujo de Dinero — Full Page Split

**Before:** `page.tsx` — 2321 lines
**After:** `page.tsx` — 154 lines + 8 focused files in `_components/`

| File | Lines | Purpose |
|------|-------|---------|
| `ledger-types.ts` | ~60 | `LedgerEntry`, `Area`, `Subarea`, `Balance`, `FORMAS_DE_PAGO` |
| `ledger-utils.ts` | ~80 | `formatCurrency`, `formatDate`, `processEstadoResultados`, `getAvailableAreasForEntry` |
| `useLedgerPage.ts` | ~420 | All state (20+ vars), fetches, 3 inline-edit flows, selection, sorting, PDF exports, derived state |
| `BalanceSummaryCards.tsx` | ~40 | 3 balance cards |
| `LedgerFilters.tsx` | ~80 | Mobile toggle + 5-field filter panel |
| `BatchActionBar.tsx` | ~30 | Selection count + delete/export; renders null when empty |
| `LedgerTable.tsx` | ~400 | Day navigator, mobile cards, desktop 15-col table, inline editing |
| `EstadoDeResultados.tsx` | ~210 | Date filter, ingresos, egresos, balance general sections |
| `EntryDetailModal.tsx` | ~165 | Bottom-sheet modal with VENTA/COMPRA transaction block |

**Bugs fixed during review:**
- `clearSelection` was missing from `useLedgerPage` return → added
- `BatchActionBar` had wrong `onClear` wiring in `page.tsx` → fixed
- `EstadoDeResultados` had duplicate import from `ledger-utils` → merged

---

## 5. Ventas Form Pages — Shared Component Extraction

**Before:**
- `ventas/new/page.tsx` — 1514 lines
- `ventas/[id]/edit/page.tsx` — 1042 lines

**After:**
- `ventas/new/page.tsx` — 529 lines (voice + chat + patients logic remains here)
- `ventas/[id]/edit/page.tsx` — 259 lines

**Created `ventas/_components/`:**

| File | Lines | Purpose |
|------|-------|---------|
| `sale-types.ts` | 36 | `Client`, `Product`, `SaleItem` interfaces |
| `useSaleForm.ts` | 237 | All shared state + item management + fetch helpers |
| `SaleItemsSection.tsx` | 170 | Items table with editable tax/qty/price columns |
| `SaleProductModal.tsx` | 75 | Product/service picker modal |
| `SaleCustomItemModal.tsx` | 139 | Custom item modal with type toggle |
| `SaleSummaryCard.tsx` | 96 | Sticky right-column totals + submit button |

**What stays in `new/page.tsx` only:**
- Voice assistant (VoiceRecordingModal + VoiceChatSidebar + handlers)
- Chat IA panel (SaleChatPanel + handleChatFieldUpdates + handleChatItemActions)
- Patient integration (Patient interface, fetchPatients, resolvePatientAsClient)
- Combined patient+client selector with optgroups

**What stays in `edit/page.tsx` only:**
- `fetchSale` + form pre-population from API
- Simple client-only dropdown
- Submit → PUT → redirect to detail page

---

---

## 6. Compras Form Pages — Shared Component Extraction

**Before:**
- `compras/new/page.tsx` — 1363 lines
- `compras/[id]/edit/page.tsx` — 1058 lines

**After:**
- `compras/new/page.tsx` — ~735 lines (voice + chat + supplier logic remains here)
- `compras/[id]/edit/page.tsx` — ~427 lines

**Created `compras/_components/`:**

| File | Lines | Purpose |
|------|-------|---------|
| `purchase-types.ts` | ~35 | `Supplier`, `Product`, `PurchaseItem` interfaces |
| `usePurchaseForm.ts` | ~240 | All shared state + item management + fetch helpers (Supplier instead of Client, purchaseDate instead of saleDate) |
| `PurchaseItemsSection.tsx` | ~170 | Items table with editable tax/qty/price columns |
| `PurchaseProductModal.tsx` | ~75 | Product/service picker modal (type-agnostic, unlike quotation version) |
| `PurchaseCustomItemModal.tsx` | ~140 | Richer custom item modal — colored header, unit dropdowns split by type, subtotal preview |
| `PurchaseSummaryCard.tsx` | ~95 | Sticky right-column totals + submit button |

**Key differences from ventas pattern:**
- Supplier entity (not Client), fetched from `/proveedores` endpoint
- No `productTypeFilter` state (both service+product buttons open same modal type-agnostically)
- `PurchaseCustomItemModal` is richer than sale version (colored header, split unit dropdowns)

---

## 7. Cotizaciones Form Pages — Shared Component Extraction

**Before:**
- `cotizaciones/new/page.tsx` — 1287 lines
- `cotizaciones/[id]/edit/page.tsx` — 1145 lines

**After:**
- `cotizaciones/new/page.tsx` — ~310 lines
- `cotizaciones/[id]/edit/page.tsx` — ~250 lines

**Created `cotizaciones/_components/` (7 files — one extra vs ventas/compras):**

| File | Lines | Purpose |
|------|-------|---------|
| `quotation-types.ts` | ~42 | `Client`, `Patient`, `Product`, `QuotationItem` interfaces |
| `useQuotationForm.ts` | ~270 | Shared state + logic; exports `resolvePatientAsClient` for chat handler |
| `QuotationClientSection.tsx` | ~120 | Patient/client grouped `<optgroup>` selector + info card + issueDate/validUntil fields |
| `QuotationItemsSection.tsx` | ~155 | Items table with editable tax/qty/price; type-aware add buttons |
| `QuotationProductModal.tsx` | ~75 | Type-aware: title/placeholder/empty message change based on `productTypeFilter` |
| `QuotationCustomItemModal.tsx` | ~120 | Same UI as PurchaseCustomItemModal |
| `QuotationSummaryCard.tsx` | ~80 | Two buttons: "Guardar como Borrador" + primary with `submitLabel`/`submittingLabel` props |

**Key differences:**
- Client+Patient dual-mode selector with `resolvePatientAsClient` (auto-creates client from patient)
- `issueDate`/`validUntil` instead of `saleDate`/`deliveryDate`; no `amountPaid`/`paymentStatus`
- `productTypeFilter` retained (service vs product buttons open modal with type filter)
- `QuotationClientSection` is 7th component — extracted because it's identical in both pages (~120 lines shared)
- Auto-validUntil effect (issueDate+30 days) lives ONLY in `new/page.tsx` to avoid overriding DB value in edit
- `QuotationSummaryCard` has no balance display (unlike ventas/compras)

---

## 8. List Pages — Hook + Table Component Split

All three list pages extracted to hook + table component pattern.

**Results:**

| Page | Before | After | Reduction |
|------|--------|-------|-----------|
| `ventas/page.tsx` | 849 lines | ~140 lines | 83% |
| `compras/page.tsx` | 815 lines | ~140 lines | 83% |
| `cotizaciones/page.tsx` | 703 lines | ~120 lines | 83% |

**Files created:**

| File | Lines | Purpose |
|------|-------|---------|
| `ventas/_components/useVentasPage.ts` | ~290 | All state, handlers, PDF export, formatters, computed totals |
| `ventas/_components/SalesTable.tsx` | ~195 | Empty state, batch bar, mobile cards, desktop table with inline amountPaid click-to-edit |
| `compras/_components/useComprasPage.ts` | ~285 | Same structure; PAID is `bg-green-100` (not blue like ventas) |
| `compras/_components/PurchasesTable.tsx` | ~190 | Same structure; "Por Pagar" uses `text-red-600` |
| `cotizaciones/_components/useCotizacionesPage.ts` | ~245 | No amountPaid inline editing; adds `handleConvertToSale`, `isExpiringSoon`, `isExpired` |
| `cotizaciones/_components/QuotationsTable.tsx` | ~185 | Expiry row highlights, convert-to-sale button, `allCount` for "Mostrando X de Y" footer |

**Shared pattern:**
- Hooks export `deselectAll: () => setSelectedIds(new Set())` for table's `onDeselect` prop
- `fetchSales/fetchPurchases/fetchQuotations` accept optional filter params to avoid stale closure in `useEffect`
- Pages keep inline: header nav links, summary cards (ventas/compras only), filter panel, count footer
- `statusOptions` array computed once at module level (not inside render loop)

---

## Totals

| Area | Before | After | Reduction |
|------|--------|-------|-----------|
| Flujo de dinero page | 2321 lines | 154 lines | 93% |
| Ventas new | 1514 lines | 529 lines | 65% |
| Ventas edit | 1042 lines | 259 lines | 75% |
| Compras new | 1363 lines | ~735 lines | 46% |
| Compras edit | 1058 lines | ~427 lines | 60% |
| Cotizaciones new | 1287 lines | ~310 lines | 76% |
| Cotizaciones edit | 1145 lines | ~250 lines | 78% |
| Ventas list page | 849 lines | ~140 lines | 83% |
| Compras list page | 815 lines | ~140 lines | 83% |
| Cotizaciones list page | 703 lines | ~120 lines | 83% |
| Chat hooks (4 files) | ~800 lines | ~280 lines | 65% |
| API routes (10 files) | high duplication | shared utils | eliminated |

---

## Pending

- `flujo-de-dinero/new/page.tsx` (~722 lines) — single-entry form + voice + LedgerChatPanel + accumulatedEntries batch state
- `flujo-de-dinero/[id]/page.tsx` (~779 lines) — detail/edit with uploadthing file attachments (HIGH RISK — leave last)
- Medical records, appointments, LLM assistant hooks (not yet touched)
