# Income Permutations — Appointments Payment & Facturacion Flow

> **Related documents:**
> - [income-lifecycle.md](income-lifecycle.md) — Full income lifecycle across ALL origins (cita, manual, venta, webhook, banco, SAT)
> - [conciliacion-gaps.md](conciliacion-gaps.md) — Gap analysis and correctness verification of reconciliation logic

## Booking Status State Machine

```
PENDING -> CONFIRMED -> COMPLETED  (happy path)
                     -> NO_SHOW
                     -> CANCELLED
PENDING -> CANCELLED
```

Terminal states: `COMPLETED`, `NO_SHOW`, `CANCELLED` (no further transitions).

---

## Payment Methods (Forma de Pago) — 5 options

| Value          | Label          | SAT Code |
| -------------- | -------------- | -------- |
| `efectivo`     | Efectivo       | 01       |
| `cheque`       | Cheque         | 02       |
| `transferencia`| Transferencia  | 03       |
| `tarjeta`      | Tarjeta        | 04       |
| `deposito`     | Deposito       | 03 (same as transferencia) |

---

## Complete Booking Flow — 3 Permutations

### Flow 1: Complete WITHOUT invoice (patient has no fiscal data)

1. Doctor clicks "Completar" on a CONFIRMED booking
2. Enters **monto cobrado** (defaults to `booking.finalPrice`)
3. Selects **forma de pago** (1 of 5)
4. "Emitir factura" checkbox is **hidden** (patient lacks fiscal data)
5. PATCH booking -> `COMPLETED`
6. POST ledger -> creates `LedgerEntry` with `origin: "cita"`, `paymentStatus: "PAID"`, `hasFactura: false`

### Flow 2: Complete WITHOUT invoice (patient HAS fiscal data, but doctor unchecks)

1. Same as Flow 1, but checkbox **is shown** (patient has `requiereFactura=true` + all 5 fiscal fields)
2. Doctor **unchecks** "Emitir factura"
3. Same result: ledger entry created, `hasFactura: false`

### Flow 3: Complete WITH CFDI invoice

1. Same start, but doctor **checks** "Emitir factura"
2. Steps 1-2 same (booking -> COMPLETED, ledger created)
3. **Step 3:** POST `/api/facturacion/cfdi` with:
   - `receiver:` patient's fiscal data (rfc, razonSocial, regimenFiscal, usoCfdi, codigoPostalFiscal)
   - `paymentForm:` SAT code mapped from selected forma de pago
   - `paymentMethod: "PUE"` (always single payment)
   - `cfdiType: "I"` (ingreso)
   - `items:` service line (productCode `85121800`, unitCode `E48`)
   - `ledgerEntryId:` from step 2
4. Facturama API emits the CFDI, returns UUID
5. `CfdiEmitted` record saved, ledger marked `hasFactura: true`

---

## Fiscal Data Requirements (for CFDI checkbox to appear)

Patient must have ALL of:

- `requiereFactura: true`
- `rfc` (max 13 chars)
- `razonSocial`
- `regimenFiscal` (SAT catalog code, e.g. "612")
- `usoCfdi` (SAT catalog code, e.g. "D01")
- `codigoPostalFiscal`

These are collected via a **FiscalFormButton** that generates a link the doctor sends to the patient (WhatsApp/clipboard) while the booking is still CONFIRMED.

---

## Payment Integration Points (Online)

Beyond the in-office flow, bookings can also link to:

| Provider        | Model                 | Status Enum                          |
| --------------- | --------------------- | ------------------------------------ |
| **Stripe**      | `PaymentLink`         | PENDING -> PAID / EXPIRED / CANCELLED |
| **Mercado Pago**| `MpPaymentPreference` | PENDING -> PAID / EXPIRED / CANCELLED |

When paid via webhook, a ledger entry is created with `origin: "webhook_pago"`.

---

## Ledger Entry Origins (how money enters the system)

| Origin         | Source                              |
| -------------- | ----------------------------------- |
| `cita`         | Booking completion (this flow)      |
| `manual`       | Doctor creates in Flujo de Dinero   |
| `venta`        | Sales module                        |
| `sat_recibido` | SAT Descarga Masiva sync            |
| `banco`        | Bank statement reconciliation       |
| `webhook_pago` | Stripe/MP webhook                   |

---

## Full Permutation Matrix

| Forma de Pago  | Emitir Factura | SAT formaPago | SAT metodoPago | Result         |
| -------------- | -------------- | ------------- | -------------- | -------------- |
| efectivo       | No             | —             | —              | Ledger only    |
| efectivo       | Yes            | 01            | PUE            | Ledger + CFDI  |
| transferencia  | No             | —             | —              | Ledger only    |
| transferencia  | Yes            | 03            | PUE            | Ledger + CFDI  |
| tarjeta        | No             | —             | —              | Ledger only    |
| tarjeta        | Yes            | 04            | PUE            | Ledger + CFDI  |
| cheque         | No             | —             | —              | Ledger only    |
| cheque         | Yes            | 02            | PUE            | Ledger + CFDI  |
| deposito       | No             | —             | —              | Ledger only    |
| deposito       | Yes            | 03            | PUE            | Ledger + CFDI  |

That's **10 permutations** at the CompleteBookingModal level (5 payment methods x 2 invoice choices), plus the "checkbox hidden" variant when the patient lacks fiscal data.

---

## Key File Paths

### Core Booking UI
- `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` — Main bookings table & filters
- `apps/doctor/src/app/appointments/_components/CompleteBookingModal.tsx` — Payment & CFDI emission
- `apps/doctor/src/app/appointments/_components/FiscalFormButton.tsx` — Fiscal data form link

### Hooks
- `apps/doctor/src/app/appointments/_hooks/useBookings.ts` — Booking state management (completeBooking, emitCfdi)

### API Routes
- `apps/api/src/app/api/appointments/bookings/[id]/route.ts` — Booking CRUD & status transitions
- `apps/api/src/app/api/practice-management/ledger/route.ts` — Ledger CRUD
- `apps/api/src/app/api/facturacion/cfdi/route.ts` — CFDI emission

### Libraries
- `apps/api/src/lib/facturama.ts` — Facturama API client
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/_components/ledger-types.ts` — Type definitions

### Database
- `packages/database/prisma/schema.prisma` — All models (Booking, Patient, LedgerEntry, CfdiEmitted, etc.)
