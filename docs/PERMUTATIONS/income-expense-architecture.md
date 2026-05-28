# Income & Expense Architecture — Source of Truth & Evidence Model

> **Related documents:**
> - [income-lifecycle.md](income-lifecycle.md) — Full income lifecycle across all 6 origins
> - [income-permutations.md](income-permutations.md) — Appointment payment & CFDI permutations
> - [conciliacion-gaps.md](conciliacion-gaps.md) — Gap analysis of reconciliation logic

---

## Core Principle

Every financial movement (ingreso or egreso) has **1 source of truth** and up to **3 evidence attachments**:

```
+---------------------+
|   SOURCE OF TRUTH   |  The movement itself (the anchor record)
+---------------------+
         |
    +----+----+----+
    |         |         |
[Comprobante] [Factura] [Banco]
  (Layer 1)   (Layer 2)  (Layer 3)
```

| Layer | What it is | Where it comes from |
|-------|-----------|---------------------|
| **Source of truth** | LedgerEntry | Varies by type (see below) |
| **Evidence 1: Comprobante** | Screenshot, photo of receipt, transfer proof | Manual upload |
| **Evidence 2: Factura (CFDI)** | SAT-compliant invoice | Facturama emission or SAT descarga |
| **Evidence 3: Movimiento bancario** | Bank deposit/withdrawal | Bank statement CSV import + matching |

A movement can have **none, some, or all** evidence layers attached. The source of truth exists independently.

---

## Source of Truth by Type

### Ingresos (Income)

**Primary source: Servicios (from doctor profile)**

The doctor's services defined in `/dashboard/mi-perfil` (Servicios tab) are the catalog of everything the practice charges for. Each ingreso should reference which service generated it.

| Origin | How it enters | Service link |
|--------|--------------|--------------|
| `cita` | Booking completed | Automatic — booking already has `serviceId` + `serviceName` |
| `manual` | Doctor creates in Flujo de Dinero | Manual — doctor selects service from dropdown |
| `venta` | Sales module | Via sale items (products/services sold) |
| `webhook_pago` | Stripe/MP payment | Via booking's service (if payment link tied to booking) |
| `banco` | Bank statement deposit → "Crear entrada" | Manual — doctor selects service when creating |
| `sat_recibido` | SAT sync → "Registrar en Ledger" | Manual — not typically tied to a specific service |

### Egresos (Expenses)

**Primary source: Manual input + Bank statements**

There is no "service catalog" equivalent for expenses. The real money flow IS the source of truth.

| Origin | How it enters | Notes |
|--------|--------------|-------|
| `manual` | Doctor creates in Flujo de Dinero | Most common: rent, supplies, insurance, etc. |
| `banco` | Bank statement withdrawal → "Crear entrada" | Auto-categorized with built-in rules |
| `sat_recibido` | Received CFDI registered to ledger | Auto-creates egreso, links supplier |
| `compra` | Purchase module | Auto-creates egreso with `transactionType: "COMPRA"` |

**Why not facturas as source of truth for expenses?**
- Not all expenses have a factura (cash purchases, informal services)
- Facturas can have errors or be issued late
- The real money flow (manual entry or bank statement) is more reliable
- Facturas are evidence that gets **attached to** the expense, not the expense itself

---

## Schema Change: Service Reference on LedgerEntry

### Current state (indirect path only)
```
LedgerEntry.bookingId → Booking.serviceId → Service
                         Booking.serviceName (denormalized)
```
Only works for `origin: "cita"` entries. Manual entries have no service link.

### New state (direct reference)
```
LedgerEntry.serviceId → Service
LedgerEntry.serviceName (denormalized)
```
Works for ANY ingreso entry, regardless of origin.

### New fields on LedgerEntry

| Field | Type | DB Column | Purpose |
|-------|------|-----------|---------|
| `serviceId` | `String?` | `service_id TEXT` | FK to Service (nullable, onDelete: SetNull) |
| `serviceName` | `String?` | `service_name VARCHAR(255)` | Denormalized copy — survives service deletion |

**Why denormalize serviceName?**
- Same pattern used by Booking (stores both `serviceId` and `serviceName`)
- If doctor deletes/renames a service, historical ledger entries keep the original name
- Avoids JOINs for table display — serviceName is directly on the row

### Population rules

| Origin | How serviceId/serviceName get set |
|--------|----------------------------------|
| `cita` | Copied from `booking.serviceId` + `booking.serviceName` at creation time |
| `manual` | Doctor selects from service dropdown in "Nuevo Movimiento" form |
| `venta` | Not set (sales have their own product/service items) |
| `webhook_pago` | Copied from booking's service (if bookingId exists) |
| `banco` | Doctor optionally selects when creating entry from bank movement |
| `sat_recibido` | Not set (received invoices aren't tied to doctor's own services) |
| Any `egreso` | Not set — egresos don't reference income services |

---

## Evidence Attachment Model (symmetric for both types)

### Layer 1: Comprobante (proof of transaction)

| Field | Model | Notes |
|-------|-------|-------|
| `hasComprobante` | LedgerEntry (Boolean) | Flag updated when file uploaded |
| Actual files | `LedgerAttachment[]` | Multiple files per entry |

**Auto-set to true for:**
- `origin: "webhook_pago"` — webhook itself is proof
- `origin: "banco"` — bank statement is proof

### Layer 2: Factura (CFDI)

| Field | Model | Notes |
|-------|-------|-------|
| `hasFactura` | LedgerEntry (Boolean) | Flag updated on upload/emission |
| PDF files | `LedgerFactura[]` | Uploaded factura PDFs |
| XML files | `LedgerFacturaXml[]` | Uploaded CFDI XMLs (auto-parsed) |
| Emitted | `CfdiEmitted[]` | System-emitted CFDIs via Facturama |
| SAT UUID | `satCfdiUuid` | Links to SAT-downloaded CFDI |

**Auto-set to true for:**
- `origin: "sat_recibido"` — the CFDI itself is the factura
- When CFDI is emitted via CompleteBookingModal

### Layer 3: Movimiento Bancario (bank confirmation)

| Field | Model | Notes |
|-------|-------|-------|
| `bankMovement` | `BankMovement` (relation via `ledgerEntryId`) | Bank statement row |
| Match status | `BankMovement.matchStatus` | `matched_auto`, `matched_confirmed`, `ignored` |
| Match confidence | `BankMovement.matchConfidence` | 0.50 to 0.99 |

**Auto-linked for:**
- `origin: "banco"` — entry created FROM the bank movement

**Cannot be linked for:**
- `formaDePago: "efectivo"` — cash leaves no bank trace

---

## Flujo de Dinero Table — Service Column Addition

### Columns (desktop) — IMPLEMENTED
1. Checkbox, 2. Fecha, 3. Acciones, 4. Tipo, **5. Servicio**, 6. Evidencia, 7. Monto,
8. Area, 9. Concepto, 10. Estado Pago, 11. Forma de Pago,
12. Cobrado, 13. Por Cobrar, 14. Pagado, 15. Por Pagar,
16. Paciente, 17. Proveedor

**Servicio column:** Shows `serviceName` (or "—" if null). Sortable. Also shown in mobile card view below concept.

**Pending:** Add service filter dropdown in LedgerFilters.

---

## "Nuevo Movimiento" Form — Service Dropdown

### Form fields — IMPLEMENTED
1. Tipo de Movimiento (ingreso/egreso)
2. **Servicio** (only for ingresos, only if doctor has active services)
3. Monto
4. Fecha
5. Concepto
6. Area / Subarea
7. Cuenta Bancaria
8. Forma de Pago
9. Estado de Pago
10. ID Mov. Bancario
11. Archivos Adjuntos

**Servicio dropdown:**
- **Data source:** GET `/api/practice-management/areas` (services piggybacked on same auth'd endpoint)
- **Options:** Doctor's active services (serviceName + price), plus "Otro ingreso (sin servicio)"
- **Auto-fill on select:** Monto (service.price), Concepto (serviceName), Area ("Consultas Medicas"), Subarea (serviceName)
- **Cleared when:** entryType changes to "egreso"

---

## Estado de Resultados Impact

The Estado de Resultados tab currently breaks down by Area/Subarea. With the service reference:

### Ingresos breakdown options
1. **By Area/Subarea** (current) — "Consultas Medicas > Consulta General"
2. **By Service** (new) — "Consulta General ($1,500)", "Cirugia Laser ($25,000)"

### Egresos breakdown
- Stays as Area/Subarea — no service reference for expenses
- Categories: Gastos Fijos, Gastos Operativos, Impuestos, etc.

---

## Implementation Status

| Step | What | Status |
|------|------|--------|
| 1 | Schema: add `serviceId` + `serviceName` to LedgerEntry | **DONE** |
| 2 | SQL migration + deploy to Railway (with backfill) | **DONE** |
| 3 | API: accept serviceId in POST/PUT/PATCH, resolve serviceName | **DONE** |
| 4 | Backfill: existing cita-origin entries populated from bookings | **DONE** (in migration) |
| 5 | Table: Servicio column in LedgerTable (desktop + mobile) | **DONE** |
| 6 | Form: service dropdown in "Nuevo Movimiento" with auto-fill | **DONE** |
| 7 | CompleteBookingModal: passes serviceId/serviceName to ledger | **DONE** |
| 8 | Webhook flow: pass serviceId/serviceName from booking | **DONE** |
| 9 | Estado de Resultados: add "by service" breakdown | **DONE** |
| 10 | LedgerFilters: add service filter dropdown | **DONE** |

---

## Completeness Levels (Updated)

| Level | Ingresos | Egresos |
|-------|----------|---------|
| **Basic** | LedgerEntry exists, paymentStatus=PAID | LedgerEntry exists, paymentStatus=PAID |
| **Categorized** | Basic + area/subarea + serviceName set | Basic + area/subarea set |
| **Documented** | Categorized + (hasComprobante OR hasFactura) | Categorized + (hasComprobante OR hasFactura) |
| **Invoiced** | Documented + CFDI emitted | Documented + received CFDI attached |
| **Bank-Reconciled** | Documented + BankMovement matched | Documented + BankMovement matched |
| **Fully Reconciled** | Invoiced + Bank-Reconciled | Invoiced + Bank-Reconciled |

Cash (efectivo) income ceiling: Invoiced (no bank match possible).
Cash expense ceiling: Documented (no bank match, may not have factura).

---

## Key File Paths

### Schema & Migrations
- `packages/database/prisma/schema.prisma` — LedgerEntry (line 1110), Service (line 331)
- `packages/database/prisma/migrations/` — SQL migration files

### Flujo de Dinero UI
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/page.tsx` — main page
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/_components/LedgerTable.tsx` — table
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/new/page.tsx` — new entry form
- `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/_components/EntryDetailModal.tsx` — detail

### Services
- `apps/doctor/src/components/profile/ServicesSection.tsx` — profile services tab
- `apps/api/src/app/api/doctors/[slug]/services/route.ts` — services API

### Ledger API
- `apps/api/src/app/api/practice-management/ledger/route.ts` — GET/POST
- `apps/api/src/app/api/practice-management/ledger/[id]/route.ts` — GET/PUT/PATCH/DELETE

### Booking → Ledger Creation
- `apps/doctor/src/app/appointments/_hooks/useBookings.ts` — completeBooking
- `apps/doctor/src/app/appointments/_components/CompleteBookingModal.tsx`
