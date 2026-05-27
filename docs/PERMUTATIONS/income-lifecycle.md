# Income Lifecycle — Every Path from Origin to Full Conciliacion

This document maps every way income enters the system, what evidence is required at each stage, and what "fully reconciled" means for each path.

---

## The 3 Pillars of a Fully Reconciled Income

For an income entry to be **fully reconciled**, it needs up to 3 confirmations:

| Pillar | What it proves | Field/Model |
| ------ | -------------- | ----------- |
| **1. Ledger Entry** | Doctor recorded the income | `LedgerEntry` (origin, paymentStatus=PAID) |
| **2. Evidence** | Proof the money moved | `hasComprobante=true` OR `hasFactura=true` OR linked `BankMovement` |
| **3. Bank Match** | Bank confirms the deposit | `BankMovement.matchStatus=matched_confirmed` linked to the LedgerEntry |

Optional 4th pillar for fiscal compliance:
| **4. CFDI** | SAT-compliant invoice emitted | `CfdiEmitted` linked via `ledgerEntryId` OR `hasFactura=true` |

---

## Income Entry Points (6 Origins)

```
                    +------------------+
                    |   INCOME ENTERS  |
                    +------------------+
                            |
        +-------------------+-------------------+
        |         |         |         |         |
   [1. cita] [2. manual] [3. venta] [4. webhook] [5. banco] [6. sat_recibido]
        |         |         |         |           |           |
        v         v         v         v           v           v
   LedgerEntry LedgerEntry LedgerEntry LedgerEntry LedgerEntry LedgerEntry
   (auto)      (manual)    (auto)     (auto)      (auto)      (auto)
```

---

## Origin 1: `cita` — Appointment Completion

### How it starts
Doctor clicks "Completar" on a CONFIRMED booking in the appointments page.

### CompleteBookingModal inputs
- **Monto cobrado (MXN)** — editable, defaults to `booking.finalPrice`
- **Forma de pago** — 1 of 5: efectivo, transferencia, tarjeta, cheque, deposito
- **Emitir factura (CFDI)** — checkbox, only visible if patient has complete fiscal data

### Steps executed
1. PATCH `/api/appointments/bookings/[id]` → status: `COMPLETED`
2. POST `/api/practice-management/ledger` → creates LedgerEntry

### LedgerEntry created with
```
entryType: "ingreso"
amount: <monto cobrado>
concept: "<service name> - <patient name>"
formaDePago: <selected>
transactionDate: <appointment date>
paymentStatus: "PAID"
amountPaid: <same as amount>
bookingId: <booking.id>
origin: "cita"
area: "Consultas Medicas"
subarea: <service name> || "Consulta General"
hasComprobante: false
hasFactura: false
```

### CFDI emission (optional, Step 3)
Only if patient has ALL fiscal fields AND doctor checks "Emitir factura":

| Patient field | Required |
| ------------- | -------- |
| `requiereFactura` | `true` |
| `rfc` | 13 chars max |
| `razonSocial` | non-empty |
| `regimenFiscal` | SAT code (e.g. "612") |
| `usoCfdi` | SAT code (e.g. "D01") |
| `codigoPostalFiscal` | 5 chars |

POST `/api/facturacion/cfdi` with:
- `cfdiType: "I"` (ingreso)
- `paymentMethod: "PUE"` (pago unico efectuado)
- `paymentForm:` SAT code mapped from forma de pago
- `items:` productCode `85121800` (medical services), unitCode `E48`
- `ledgerEntryId:` links CFDI to the ledger entry

Result: `CfdiEmitted` record created, LedgerEntry marked `hasFactura: true`

### Permutation matrix (10 combinations)

| Forma de Pago | Emitir Factura | SAT formaPago | Result |
| ------------- | -------------- | ------------- | ------ |
| efectivo | No | - | Ledger only |
| efectivo | Yes | 01 | Ledger + CFDI |
| transferencia | No | - | Ledger only |
| transferencia | Yes | 03 | Ledger + CFDI |
| tarjeta | No | - | Ledger only |
| tarjeta | Yes | 04 | Ledger + CFDI |
| cheque | No | - | Ledger only |
| cheque | Yes | 02 | Ledger + CFDI |
| deposito | No | - | Ledger only |
| deposito | Yes | 03 | Ledger + CFDI |

### What's missing for full reconciliation
- `hasComprobante` starts as `false` — doctor must manually upload receipt in Flujo de Dinero
- Bank match: only happens when doctor uploads bank statement CSV and the matching algorithm finds this entry
- If paid in cash (`efectivo`): no bank movement will ever exist — cannot be bank-reconciled

### Doctor checklist (cita origin)
- [x] Booking completed
- [x] Ledger entry created (automatic)
- [ ] Upload comprobante (receipt/ticket) — manual step in Flujo de Dinero
- [ ] Emit CFDI if patient requires factura — optional at completion time
- [ ] Bank statement uploaded and matched — only for non-cash payments

---

## Origin 2: `manual` — Flujo de Dinero Manual Entry

### How it starts
Doctor navigates to Flujo de Dinero > "Nuevo Movimiento"

### Form inputs
| Field | Required | Notes |
| ----- | -------- | ----- |
| Tipo de Movimiento | Yes | Ingreso / Egreso |
| Monto (MXN) | Yes | > 0 |
| Fecha | Yes | defaults to today |
| Concepto | No | max 500 chars |
| Area | No | filtered by entry type |
| Subarea | No | cascading from Area |
| Cuenta Bancaria | No | free text |
| Forma de Pago | Yes | efectivo/transferencia/tarjeta/cheque/deposito |
| Estado de Pago | Yes | Cobrado or Por Cobrar |
| ID Mov. Bancario | No | bank reference for matching |

### LedgerEntry created with
```
entryType: "ingreso"
origin: "manual"
paymentStatus: "PAID" or "PENDING" (from Estado de Pago)
amountPaid: <amount> if PAID, <0> if PENDING
hasComprobante: false
hasFactura: false
```

### Post-creation actions (all manual)
1. **Upload comprobante** — POST `/api/practice-management/ledger/{id}/attachments`
2. **Upload factura PDF** — POST `/api/practice-management/ledger/{id}/facturas`
3. **Upload CFDI XML** — POST `/api/practice-management/ledger/{id}/facturas-xml` (auto-parsed)
4. **Emit CFDI** — Navigate to `/dashboard/facturacion?from=ledger&ledgerId=...` with pre-filled data

### Doctor checklist (manual origin)
- [x] Ledger entry created (manual)
- [ ] Set correct area/subarea
- [ ] Upload comprobante
- [ ] Upload or emit factura/CFDI
- [ ] Bank statement uploaded and matched

---

## Origin 3: `venta` — Sales Module

### How it starts
Doctor completes a sale in the Sales module (products/services sold to patient).

### LedgerEntry created automatically with
```
entryType: "ingreso"
origin: "venta"
transactionType: "VENTA"
saleId: <sale.id>
clientId: <patient/client id>
paymentStatus: computed from amountPaid vs amount
```

### Payment status tracking
- Sale tracks its own payment status
- When doctor updates payment on sale, LedgerEntry syncs:
  - `amountPaid >= amount` → PAID
  - `amountPaid > 0` → PARTIAL
  - `amountPaid = 0` → PENDING

### Doctor checklist (venta origin)
- [x] Sale created
- [x] Ledger entry auto-created
- [ ] Collect payment and update amountPaid
- [ ] Upload comprobante
- [ ] Upload or emit factura
- [ ] Bank match (if paid via transfer/card)

---

## Origin 4: `webhook_pago` — Online Payment (Stripe / Mercado Pago)

### How it starts
Patient pays via payment link. Webhook fires automatically.

### Stripe flow
1. Doctor creates payment link → POST `/api/stripe/payment-links`
2. Patient pays via Stripe Checkout
3. Webhook: `checkout.session.completed` (card) or `checkout.session.async_payment_succeeded` (OXXO)
4. `PaymentLink.status` → `PAID`
5. `createPaymentLedgerEntry()` called automatically

### Mercado Pago flow
1. Doctor creates preference → POST `/api/mercadopago/preferences`
2. Patient pays via MP checkout
3. Webhook: payment notification → fetch payment from MP API
4. `MpPaymentPreference.status` → `PAID`
5. `createPaymentLedgerEntry()` called automatically

### LedgerEntry created automatically with
```
entryType: "ingreso"
origin: "webhook_pago"
area: "Consultas Medicas"
subarea: "Pago en Linea"
formaDePago: mapped from provider
  - Stripe card → "tarjeta"
  - Stripe OXXO → "efectivo"
  - MP credit/debit card → "tarjeta"
  - MP bank_transfer/account_money/digital_wallet → "transferencia"
  - MP ticket/atm → "efectivo"
paymentStatus: "PAID"
amountPaid: <full amount>
hasComprobante: true  (webhook itself is proof)
bookingId: <if payment link was tied to a booking>
```

### Idempotency
- If `bookingId` provided: checks if LedgerEntry already exists for that booking
- Skips creation if duplicate (prevents webhook retry issues)

### Doctor checklist (webhook_pago origin)
- [x] Payment link created
- [x] Patient paid
- [x] Ledger entry auto-created
- [x] hasComprobante = true (automatic)
- [ ] Emit CFDI if patient requires factura
- [ ] Bank match (Stripe/MP deposit to bank account may appear days later)

---

## Origin 5: `banco` — Bank Statement Import

### How it starts
Doctor uploads bank CSV in Conciliacion Bancaria. Unmatched deposit movements can be converted to ledger entries.

### Movement → LedgerEntry creation
Doctor clicks "Crear entrada" on an unmatched bank deposit movement.

### LedgerEntry created with
```
entryType: "ingreso"
origin: "banco"
formaDePago: "transferencia"
amount: <bank movement amount>
transactionDate: <bank movement date>
area: <from categorization suggestion>
subarea: <from categorization suggestion>
concept: <from categorization suggestion>
hasComprobante: true (bank statement is proof)
paymentStatus: "PAID"
amountPaid: <full amount>
```

### Automatic match
- The new LedgerEntry is immediately linked to the BankMovement
- `BankMovement.matchStatus = "matched_confirmed"`, `matchConfidence = 1.0`

### Doctor checklist (banco origin)
- [x] Bank statement uploaded
- [x] Movement converted to ledger entry
- [x] Bank match confirmed (automatic)
- [x] hasComprobante = true (automatic)
- [ ] Set correct area/subarea (may need refinement from suggestion)
- [ ] Upload or emit factura/CFDI

---

## Origin 6: `sat_recibido` — SAT Descarga Masiva

### How it starts
Doctor syncs received CFDIs from SAT via e.Firma (FIEL). A received CFDI can be registered to the ledger.

### Flow
1. Doctor uploads FIEL (e.Firma) → POST `/api/sat-descarga/fiel`
2. Creates sync job → POST `/api/sat-descarga/sync`
3. System downloads CFDI metadata from SAT
4. Doctor reviews received CFDIs in dashboard
5. Clicks "Registrar en Ledger" → POST `/api/sat-descarga/register-to-ledger`

### LedgerEntry created with
```
entryType: depends on CFDI direction/effect
origin: "sat_recibido"
satCfdiUuid: <CFDI UUID>
hasFactura: true (the CFDI itself is the factura)
```

### Doctor checklist (sat_recibido origin)
- [x] SAT sync completed
- [x] CFDI registered to ledger
- [x] hasFactura = true (automatic)
- [ ] Bank match (if payment visible in bank statement)
- [ ] Upload comprobante (optional, CFDI may suffice)

---

## Evidence Status Matrix

What evidence each origin starts with vs. what needs manual action:

| Origin | hasComprobante | hasFactura | Bank Match | CFDI Emitted |
| ------ | -------------- | ---------- | ---------- | ------------ |
| `cita` | false (manual) | false (optional at completion) | manual (upload CSV) | optional |
| `manual` | false (manual) | false (manual) | manual (upload CSV) | manual |
| `venta` | false (manual) | false (manual) | manual (upload CSV) | manual |
| `webhook_pago` | **true (auto)** | false (manual) | manual (upload CSV) | manual |
| `banco` | **true (auto)** | false (manual) | **confirmed (auto)** | manual |
| `sat_recibido` | false (manual) | **true (auto)** | manual (upload CSV) | N/A (received, not emitted) |

---

## Completeness Scoring

The CompletenessTab in Flujo de Dinero shows:
- % entries with comprobante
- % entries with factura
- % entries categorized (area/subarea set)
- Origin breakdown
- Alerts for missing evidence (severity: high/medium)

### What makes an income entry "complete"?

| Level | Requirements |
| ----- | ------------ |
| **Basic** | LedgerEntry exists, paymentStatus=PAID |
| **Documented** | Basic + (hasComprobante=true OR hasFactura=true) |
| **Categorized** | Documented + area and subarea set |
| **Invoiced** | Categorized + CFDI emitted (CfdiEmitted linked) |
| **Bank-Reconciled** | Categorized + BankMovement matched_confirmed |
| **Fully Reconciled** | Invoiced + Bank-Reconciled |

---

## Payment Method Impact on Reconciliation

| Forma de Pago | SAT Code | Can be bank-matched? | Notes |
| ------------- | -------- | -------------------- | ----- |
| efectivo | 01 | NO | Cash leaves no bank trace |
| transferencia | 03 | YES | SPEI/wire shows in bank statement |
| tarjeta | 04 | YES | Card processor deposits to bank |
| cheque | 02 | YES | Deposit shows when cashed |
| deposito | 03 | YES | Direct deposit to bank |

**Cash (efectivo) is the only forma de pago that CANNOT be bank-reconciled.** For cash income, the reconciliation ceiling is "Invoiced" level.

---

## CFDI Types in the System

| Type | Code | Use Case | Created From |
| ---- | ---- | -------- | ------------ |
| **Ingreso** | I | Standard income invoice | Appointments, Ledger, Standalone |
| **Egreso** | E | Credit note (refund/discount) | Standalone (Nota de Credito tab) |
| **Pago** | P | Payment receipt (for PPD invoices) | Standalone (REP tab) |
| **Traslado** | T | Transfer of goods | Not implemented |

### CFDI Payment Method Combinations

| metodoPago | Meaning | When used |
| ---------- | ------- | --------- |
| PUE | Pago Unico Efectuado | Single payment at time of invoice (default from appointments) |
| PPD | Pago Parcialmente Diferido | Deferred/partial payment — requires REP complement later |

---

## The Full Income Journey (Happy Path)

```
[Patient Books Appointment]
        |
        v
[Doctor Confirms Booking] → status: CONFIRMED
        |
        v
[Optional: Collect Fiscal Data] → FiscalFormButton → patient fills RFC etc.
        |
        v
[Doctor Completes Booking] → CompleteBookingModal
        |
   +----+----+
   |         |
   v         v
[LedgerEntry]  [CfdiEmitted] (if factura checked)
   |              |
   v              v
[Doctor uploads comprobante in Flujo de Dinero]
   |
   v
[Doctor uploads bank CSV in Conciliacion Bancaria]
   |
   v
[Matching algorithm finds the LedgerEntry]
   |
   v
[Doctor confirms match]
   |
   v
[FULLY RECONCILED]
```

---

## Cross-Module Navigation

| From | To | How |
| ---- | -- | --- |
| Appointments → Ledger | Automatic on "Completar" | origin="cita", bookingId linked |
| Ledger → Facturacion | "Facturar" button | URL params: ledgerId, concept, amount |
| Bank Statement → Ledger | "Crear entrada" action | origin="banco", auto-linked |
| SAT Descarga → Ledger | "Registrar en Ledger" | origin="sat_recibido", satCfdiUuid |
| Pagos → Ledger | Webhook automatic | origin="webhook_pago", bookingId if applicable |
| Sales → Ledger | Automatic on sale creation | origin="venta", saleId, clientId |
