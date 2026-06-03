# Visor Fiscal Integration Plan — Tailored for Doctors

**Date:** 2026-06-03
**Reference:** [Konta Visor Fiscal](https://konta.com/visor-fiscal) — $50 USD/month product that shows fiscal compliance status, categorized deductions, and CFDI sync.
**Our advantage:** We already have Pilar 3 (CFDI sync via SAT Descarga Masiva) fully built. Pilars 1 and 2 are additive features on top of existing data.

### Cross-References
- `docs/TODO-FACTURAS/PLAN-FACTURACION-CFDI.md` — Full facturación implementation plan (all phases complete, sandbox tested)
- `docs/TODO-FACTURAS/GUIA-FACTURACION-DOCTORES.md` — User-facing invoicing guide (needs RESICO updates)
- `docs/NEW.MD-GUIDES/database-architecture.md` — DB architecture, migration workflow, deployment checklist

### Verified Gaps from Existing Docs
1. ~~**ISR retention hardcoded at 10%**~~ **FIXED (Phase 1)** — ISR rate now dynamic per régimen (10% for 612, 1.25% for RESICO) with user override. Both frontend and backend updated.
2. **IVA exemption not auto-enforced** — Both docs say medical services are "generally exempt" but defer to contador. The UI defaults to 16% IVA trasladado but rate is now editable. Should auto-default to exempt when receiver is persona física and service is medical. **(Phase 1 partial: rate is editable, auto-detection pending.)**
3. ~~**No RESICO-specific content in user guide**~~ **FIXED (Phase 0)** — Both Facturación GuiaTab and SAT Descarga ContableTab now include régimen-specific educational content (ISR rates, deduction rules, obligations by régimen, common errors).
4. **Migration workflow** — Per `database-architecture.md`: SQL migration files, run on Railway BEFORE deploy, never `prisma db push`. New tables for opinión de cumplimiento must follow this pattern.

---

## Table of Contents

1. [Current State — What We Already Have](#1-current-state)
2. [Target Regímenes and Their Differences](#2-target-regímenes)
3. [Facturación Railways per Régimen](#3-facturación-railways-per-régimen)
4. [Pilar 1 — Opinión de Cumplimiento SAT](#4-pilar-1--opinión-de-cumplimiento-sat)
5. [Pilar 2 — Deducciones Categorizadas para Médicos](#5-pilar-2--deducciones-categorizadas-para-médicos)
6. [Deductibles Railways per Régimen](#6-deductibles-railways-per-régimen)
7. [Implementation Plan](#7-implementation-plan)

---

## 1. Current State

### SAT Descarga Masiva (fully built)
- e.Firma authentication with SAT SOAP services
- Download metadata + XML for emitted and received CFDIs
- Parse and store in `sat_cfdi_metadata`, `sat_cfdi_details`, `sat_cfdi_concepto`
- Monthly sync + historical backfill (from 2025-01)
- Background worker processes jobs every 15 min
- Smart matching to link SAT CFDIs to internal ledger entries
- Resumen Fiscal tab with annual summary by month (ingresos, gastos, IVA, ISR, retenciones)
- Alerts for cancellations
- Payment status tracking for PPD invoices (complementos de pago)

### Facturación / CFDI Emission (fully built via Facturama)
- **CFDI Types supported:** Ingreso (I), Egreso (E), Pago/REP (P)
- **NOT supported:** Nómina (N), Traslado (T)
- **PAC:** Facturama Multiemisor API (sandbox + production)
- **CSD management:** Upload .cer/.key to Facturama for timbrado
- **e.Firma management:** Stored encrypted (AES-256) locally for SAT Descarga
- **Folio:** Auto-generated sequentially per fiscal profile
- **Currency:** MXN only (no multi-currency)

#### Hardcoded Doctor Defaults
| Field | Default Value | Notes |
|-------|--------------|-------|
| Producto/Servicio | 85121800 (Servicios médicos) | Can be changed per line item |
| Unidad | E48 (Servicio) | Can be changed |
| Moneda | MXN | Fixed |
| Exportación | 01 (No aplica) | Fixed, domestic only |
| IVA | 16% trasladado (default) | Editable per invoice |
| ISR Retención | Régimen-based default (10% for 612, 1.25% for RESICO) | Editable per invoice |
| Uso CFDI default | D01 (Honorarios médicos) | Changeable by user |

#### Público en General Handling (RFC: XAXX010101000)
- Auto-forces Uso CFDI → S01 (Sin efectos fiscales)
- Auto-forces Régimen Fiscal → 616 (Sin obligaciones fiscales)
- Requires GlobalInformation (periodicity, month, year)
- Tax zip code = issuer's expedition place

#### Available Régimen Fiscal Codes (current)
| Code | Description |
|------|-------------|
| 601 | General de Ley Personas Morales |
| 603 | Personas Morales con Fines no Lucrativos |
| 605 | Sueldos y Salarios |
| 606 | Arrendamiento |
| 608 | Demás ingresos |
| **612** | **Personas Físicas con Actividades Empresariales y Profesionales** |
| 616 | Sin obligaciones fiscales |
| 621 | Incorporación Fiscal |
| 625 | Actividades Empresariales vía Plataformas Tecnológicas |
| **626** | **Régimen Simplificado de Confianza (RESICO)** |

#### Available Uso CFDI Codes (current — medical-focused subset)
| Code | Description | When used |
|------|-------------|-----------|
| D01 | Honorarios médicos, dentales y hospitalarios | Default for medical |
| D02 | Gastos médicos por incapacidad/discapacidad | Medical disability |
| G03 | Gastos en general | Generic |
| S01 | Sin efectos fiscales | Público en General |
| CP01 | Pagos | REP type P |
| G02 | Devoluciones/descuentos/bonificaciones | Credit notes (auto) |

#### Available Forma de Pago Codes (current)
| Code | Description |
|------|-------------|
| 01 | Efectivo |
| 02 | Cheque nominativo |
| 03 | Transferencia electrónica (default) |
| 04 | Tarjeta de crédito |
| 28 | Tarjeta de débito |
| 99 | Por definir |

#### Cancellation Motives
| Code | Description |
|------|-------------|
| 01 | Errores con relación (requires replacement UUID) |
| 02 | Errores sin relación |
| 03 | No se llevó a cabo |
| 04 | Factura global |

---

## 2. Target Regímenes

Our platform serves **doctors** (personas físicas). The only two regímenes where a persona física doctor can emit CFDIs for professional services are **612** and **626**. No other persona física régimen applies:

- **605 (Sueldos y Salarios)** — hospital employees only, cannot emit CFDIs for private services
- **606 (Arrendamiento)** — rental income, not medical services
- **608 (Demás ingresos)** — sporadic/occasional income, not a primary activity
- **621 (Incorporación Fiscal)** — discontinued in 2022, replaced by RESICO
- **625 (Plataformas Tecnológicas)** — gig economy, not applicable to doctors

**Edge case:** A doctor can be multi-régimen (e.g., 605 as hospital employee + 612 for private practice), but they would emit CFDIs under 612 or 626. Our facturación only needs to handle these two.

The two regímenes we must specialize for are:

### Régimen 612 — Personas Físicas con Actividades Empresariales y Profesionales

**Who:** Doctors with no income cap, full deduction rights, full accounting obligations.

**Characteristics:**
- No income limit
- Full deduction of business expenses against income
- Monthly provisional ISR payments (based on income minus deductions)
- Monthly IVA declaration
- Annual declaration (April)
- Must keep formal accounting (contabilidad electrónica)
- Can deduct: rent, supplies, equipment (depreciation), salaries, insurance, professional development, vehicle (up to $175k), software, marketing
- IVA: Medical services to personas físicas are **exempt** (0% IVA). Services to personas morales charge 16% IVA.
- Retenciones: When billing personas morales, the moral retains 10% ISR and 2/3 of IVA
- **Can have employees** → must emit nómina CFDIs (N), retain ISR, pay IMSS/INFONAVIT
- DIOT obligatory (monthly informativa to SAT about IVA from suppliers)

### Régimen 626 — RESICO (Régimen Simplificado de Confianza)

**Who:** Doctors earning less than $3.5M MXN/year who want simplified taxation.

**Characteristics:**
- Income cap: $3,500,000 MXN annual
- **No deductions** — ISR is calculated on gross income at reduced rates (1% to 2.5%)
- No monthly ISR provisionals based on profit — just flat rate on income
- Still must declare IVA monthly (IVA works the same as 612)
- Annual declaration simplified
- No contabilidad electrónica required
- **Cannot bill to government entities** or large institutional clients (some restrictions)
- **Can have employees** → same nómina obligations as 612
- If income exceeds $3.5M, SAT can force migration to 612
- DIOT still obligatory
- **Key limitation:** Cannot deduct business expenses for ISR purposes — this fundamentally changes the deductibles feature

### Key Differences Summary

| Aspect | 612 (Act. Empresarial) | 626 (RESICO) |
|--------|----------------------|---------------|
| Income limit | None | $3.5M/year |
| ISR calculation | Income - Deductions × progressive rate | Gross income × flat rate (1-2.5%) |
| Deductions for ISR | Full | **None** |
| IVA treatment | Same | Same |
| IVA medical exemption | Yes (PF patients) | Yes (PF patients) |
| Retenciones received | 10% ISR + 2/3 IVA (from PM) | 1.25% ISR (from PM) |
| Contabilidad electrónica | Required | Not required |
| Nómina | Yes if has employees | Yes if has employees |
| DIOT | Required | Required |
| Annual declaration | April, full | April, simplified |
| Factura types | I, E, P, N | I, E, P, N |

---

## 3. Facturación Railways per Régimen

This section maps how the **existing facturación features** work (or should work) differently per régimen.

### Railway A — Ingreso (I) Invoice Creation

#### 612 — Actividad Empresarial
```
Doctor creates invoice:
├── Patient is Persona Física (PF)
│   ├── IVA: Exempt (medical services to PF = 0% IVA)
│   ├── ISR Retención: None (PF don't retain)
│   ├── Uso CFDI: D01 (honorarios médicos) — most common
│   └── Total = Subtotal (no tax added)
│
├── Patient/Client is Persona Moral (PM)
│   ├── IVA: 16% trasladado
│   ├── ISR Retención: 10% of subtotal (PM retains)
│   ├── IVA Retención: 2/3 of IVA (PM retains)
│   ├── Uso CFDI: D01 or G03
│   └── Total = Subtotal + IVA - ISR ret. - IVA ret.
│
└── Público en General (XAXX010101000)
    ├── IVA: Must include 16% in price (not itemized separately for tax < $100)
    ├── Uso CFDI: S01 (auto-forced)
    ├── Régimen receptor: 616 (auto-forced)
    └── Requires GlobalInformation block
```

#### 626 — RESICO
```
Doctor creates invoice:
├── Patient is Persona Física (PF)
│   ├── IVA: Exempt (same as 612)
│   ├── ISR Retención: None
│   ├── Uso CFDI: D01
│   └── Same as 612
│
├── Patient/Client is Persona Moral (PM)
│   ├── IVA: 16% trasladado (same as 612)
│   ├── ISR Retención: **1.25%** of subtotal (NOT 10% — RESICO special rate)
│   ├── IVA Retención: 2/3 of IVA (same as 612)
│   └── Total = Subtotal + IVA - ISR ret. - IVA ret.
│
└── Público en General (XAXX010101000)
    └── Same as 612
```

**Status: DONE (Phase 1).** ISR retention rate now defaults by régimen (10% for 612, 1.25% for RESICO) and is editable by the user for edge cases. IVA rate also editable (default 16%). Backend logs a warning when custom ISR rate is used but does not reject. Both NuevaFacturaTab and EgresoTab support editable rates.

### Railway B — Egreso (E) Credit Note

Same for both regímenes — credit notes reference the original invoice and reverse the same tax structure. No régimen-specific logic needed.

### Railway C — Pago/REP (P) Payment Receipt

Same for both regímenes — REP complements reference the original PPD invoice. The tax structure follows the original. No régimen-specific logic needed.

### Railway D — Nómina (N) Payroll (**NOT YET SUPPORTED**)

Both 612 and 626 can have employees. Nómina CFDI requirements are identical regardless of employer régimen:
- Complemento de Nómina 1.2
- Must retain ISR from employee salary (progressive table)
- Must report IMSS/INFONAVIT contributions
- Monthly or biweekly emission
- This is a **major feature** to build — requires its own PAC integration, employee management, ISR calculation tables, and IMSS/INFONAVIT integration. **Out of scope for now.**

### Facturación Gaps to Fix

| Gap | Priority | Status | Files Changed |
|-----|----------|--------|---------------|
| ISR retention rate should be 1.25% for RESICO doctors billing PM | High | **DONE** | `cfdi/route.ts` (soft validation + warning), `facturacion/page.tsx` (NuevaFacturaTab — dynamic default + editable) |
| IVA rate should be editable for edge cases | High | **DONE** | `facturacion/page.tsx` (NuevaFacturaTab + EgresoTab — editable IVA rate, default 16%) |
| Doctor's régimen should drive default tax configuration in "Nueva Factura" | Medium | **DONE** | `facturacion/page.tsx` (reads `profile.regimenFiscal`, sets ISR default, syncs on régimen change) |
| IVA exemption for medical services to PF should be auto-detected | Medium | Pending | `facturacion/page.tsx` (detect PF RFC pattern 13 chars, auto-set TaxObject to "01") |
| Update `GUIA-FACTURACION-DOCTORES.md` with RESICO-specific sections | Medium | Pending | `docs/TODO-FACTURAS/GUIA-FACTURACION-DOCTORES.md` |
| Update `PLAN-FACTURACION-CFDI.md` Consideraciones Fiscales section | Low | Pending | `docs/TODO-FACTURAS/PLAN-FACTURACION-CFDI.md` |
| No nómina support | Low (future) | Pending | New module entirely |
| No multi-currency | Low | Not needed | N/A |

---

## 4. Pilar 1 — Opinión de Cumplimiento SAT

### What It Is
The Opinión de Cumplimiento is an official SAT document that states whether a taxpayer is current on all obligations (declarations, payments, etc.). It's like a credit score but for tax compliance.

**Statuses:**
- **Positiva** — All obligations met, no debts
- **Negativa** — Has pending obligations or debts
- **En suspensión de actividades** — RFC suspended
- **No registrado** — RFC not found or no obligations
- **Inscrito sin obligaciones** — Registered but no fiscal obligations

### Why Doctors Need It
- Banks require it for loans and credit lines
- Hospitals and clinics may require it for credentialing
- Government contracts require it
- Insurance companies may check it
- General peace of mind

### Technical Implementation

#### Option A — SAT Web Service (recommended)
The SAT exposes a SOAP endpoint for consulting the Opinión de Cumplimiento.

**Endpoint:** `https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc` (or dedicated opinion endpoint)

**Requirements:**
- Doctor's e.Firma (we already have it encrypted in `doctorFiscalProfile`)
- SOAP request signed with e.Firma (we already do this for Descarga Masiva)
- Parse response: status (positiva/negativa), date, observations

**Advantages:** Official, reliable data. Same auth infrastructure we already use.
**Disadvantages:** SAT instability. Endpoint documentation is poor. May require additional SAT permissions.

#### Option B — Facturama API
Check if Facturama exposes an Opinión de Cumplimiento endpoint in their Multiemisor API. Some PACs offer this as value-add.

**Action item:** Check Facturama API docs for compliance/opinion endpoints.

#### Option C — Manual Upload
Allow doctors to upload their Opinión de Cumplimiento PDF (downloaded from SAT portal) and we parse it or just store + display.

**Advantages:** Zero SAT dependency. Works immediately.
**Disadvantages:** Not real-time. Requires manual action from doctor.

### Proposed Approach
Start with **Option C** (manual upload) as MVP, then add **Option A** (SAT web service) as enhancement. This gives immediate value while we figure out the SAT endpoint stability.

### Data Model Addition
```sql
CREATE TABLE sat_opinion_cumplimiento (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   TEXT NOT NULL REFERENCES public.doctors(id),
  status      TEXT NOT NULL,          -- 'positiva', 'negativa', 'suspension', etc.
  consulted_at TIMESTAMPTZ NOT NULL,  -- when SAT was consulted
  valid_until TIMESTAMPTZ,            -- opinions are typically valid 30 days
  pdf_url     TEXT,                    -- stored PDF if uploaded manually
  raw_response JSONB,                 -- full SAT response for audit
  source      TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'sat_ws', 'facturama'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### UI — New Tab in SAT Descarga
**Tab name:** "Cumplimiento SAT"

**Content:**
- Status badge: large colored card (green = Positiva, red = Negativa, gray = Not consulted)
- Last consulted date + valid until date
- "Consultar SAT" button (if Option A is implemented)
- "Subir PDF" button (Option C)
- History of past consultations
- Alert if status is Negativa with guidance on common causes

---

## 5. Pilar 2 — Deducciones Categorizadas para Médicos

### Core Concept
Show doctors how much they've spent (gastos deducibles) categorized by type, accumulated monthly, with remaining capacity against legal limits. **This only applies to Régimen 612.** RESICO doctors cannot deduct expenses for ISR purposes.

### Data Source
All data comes from **received CFDIs** already stored in `sat_cfdi_metadata` + `sat_cfdi_details` + `sat_cfdi_concepto`. We filter for:
- Direction: `received`
- Status: `Vigente`
- The doctor is the **receiver** (these are expenses they paid)

### Deduction Categories for Doctors (612)

We classify expenses using `claveProdServ` from SAT catalog + supplier RFC patterns + concepto descriptions.

#### Category 1 — Renta de Consultorio
**SAT Claves:** 80131500-80131599 (arrendamiento), 80141600-80141699
**Keywords in concepto:** renta, arrendamiento, local, consultorio, oficina
**Deduction rule:** 100% deductible. Must be indispensable for activity.
**IVA:** 16% acreditable.

#### Category 2 — Insumos y Material Médico
**SAT Claves:** 42000000-42999999 (medical equipment & supplies)
**Keywords:** material médico, insumos, guantes, jeringas, gasas, material de curación, reactivos
**Deduction rule:** 100% deductible as cost of goods.
**IVA:** 0% (most medical supplies are exempt) or 16%.

#### Category 3 — Equipo Médico (depreciable)
**SAT Claves:** 42130000-42189999 (medical instruments), 42200000-42299999 (imaging/diagnostic)
**Keywords:** equipo médico, ultrasonido, electrocardiógrafo, baumanómetro, estetoscopio
**Deduction rule:** Depreciable. Medical equipment at **25% annual** (4-year depreciation per Art. 35 LISR).
**IVA:** 16% acreditable in month of purchase.

#### Category 4 — Equipo de Cómputo y Software
**SAT Claves:** 43210000-43239999 (computers), 43230000-43239999 (software)
**Keywords:** computadora, laptop, software, licencia, sistema, impresora
**Deduction rule:** Depreciable at **30% annual** (3.3 years per Art. 35 LISR).
**IVA:** 16% acreditable.

#### Category 5 — Mobiliario y Equipo de Oficina
**SAT Claves:** 56100000-56129999 (furniture)
**Keywords:** escritorio, silla, archivero, mueble, recepción
**Deduction rule:** Depreciable at **10% annual** (10 years per Art. 35 LISR).
**IVA:** 16% acreditable.

#### Category 6 — Servicios Profesionales (terceros)
**SAT Claves:** 80100000-80199999 (management services), 85100000-85149999 (healthcare services)
**Keywords:** honorarios, consultoría, asesoría, contabilidad, legal, laboratorio
**Deduction rule:** 100% deductible. Must be related to medical activity.
**IVA:** 16% acreditable.

#### Category 7 — Seguros y Fianzas
**SAT Claves:** 84130000-84139999 (insurance)
**Keywords:** seguro, póliza, responsabilidad civil, seguro de consultorio
**Deduction rule:** 100% deductible if related to activity.
**IVA:** Exempt (insurance is IVA exempt in Mexico).

#### Category 8 — Servicios Básicos (proporcionados)
**SAT Claves:** 83100000-83119999 (utilities)
**Keywords:** luz, electricidad, agua, teléfono, internet, gas
**Deduction rule:** Proportional deduction (% used for medical activity vs personal). Common split: 50-80%.
**IVA:** 16% acreditable on the proportional part.

#### Category 9 — Capacitación y Desarrollo Profesional
**SAT Claves:** 86130000-86139999 (education/training)
**Keywords:** curso, congreso, diplomado, capacitación, certificación, colegiatura
**Deduction rule:** 100% deductible if related to medical specialty.
**IVA:** Exempt (education is IVA exempt).

#### Category 10 — Vehículo y Transporte
**SAT Claves:** 78100000-78189999 (transportation), 25170000-25179999 (vehicles)
**Keywords:** gasolina, combustible, mantenimiento vehicular, estacionamiento, casetas
**Deduction rule:** Vehicle purchase capped at $175,000 MXN (depreciation at 25%). Gas and maintenance proportional to business use.
**IVA:** 16% acreditable on proportional part.

#### Category 11 — Sueldos y Nómina
**Source:** Emitted nómina CFDIs (type N) — doctor is the issuer.
**Deduction rule:** 100% deductible (salary + employer contributions). Must retain ISR and pay IMSS/INFONAVIT.
**Note:** We don't currently support nómina emission. This category would show only if we detect nómina CFDIs in the SAT download (emitted direction, efecto N).

#### Category 12 — Otros Gastos Deducibles
Everything that doesn't fit above but is clearly business-related:
**Keywords:** papelería, limpieza, mantenimiento, publicidad, marketing, uniformes
**Deduction rule:** 100% if indispensable. Must have valid CFDI.

### Deduction Limits (612)

For **personas físicas actividad empresarial**, there is no global cap on business deductions like there is for personal deductions. However:
- Each expense must be **indispensable** for the activity
- Must be **bancarized** if over $2,000 MXN (paid via transfer/card, not cash)
- Must have a valid **CFDI a nombre del contribuyente**
- Supplier must be **active in RFC** (not in blacklist — Art. 69-B)
- Vehicle cap: $175,000 MXN for purchase deduction
- Meals/entertainment: 50% deductible, max $1,000/day per receipt
- Cash payments: NOT deductible if > $2,000 MXN

### Non-Deductible Expenses (flag these)
- Personal expenses (not related to medical activity)
- CFDIs where the doctor is NOT the receiver
- Cash purchases > $2,000 MXN (forma de pago = 01 and amount > 2000)
- Suppliers in SAT blacklist (69-B)
- Cancelled CFDIs
- Expenses without CFDI

---

## 6. Deductibles Railways per Régimen

### Régimen 612 — Full Deductions Dashboard

```
Deducciones Tab (new in sat-descarga)
├── Summary Cards
│   ├── Total Gastos Deducibles (YTD)
│   ├── Total IVA Acreditable (YTD)
│   ├── Top 3 Categories by spend
│   └── Alertas (non-deductible flagged, cash > $2k, cancelled)
│
├── Category Breakdown Table
│   ├── Category name
│   ├── # of CFDIs
│   ├── Subtotal acumulado
│   ├── IVA acreditable
│   ├── % of total expenses
│   └── Click to expand → list of CFDIs in that category
│
├── Monthly Trend Chart
│   ├── Stacked bar: deductions by category per month
│   └── Line overlay: monthly income for context
│
├── Alerts / Flags
│   ├── Cash payments > $2,000 (not deductible)
│   ├── Cancelled CFDIs still counted
│   ├── Missing XML details (can't classify)
│   └── Proportional expenses reminder (utilities, vehicle)
│
└── Depreciation Tracker (future)
    ├── Equipment purchases with depreciable rates
    ├── Monthly/annual depreciation schedule
    └── Remaining book value
```

### Régimen 626 (RESICO) — No Deductions, Different View

RESICO doctors **cannot deduct expenses for ISR**, so showing a deductions dashboard would be misleading. Instead, show:

```
Gastos Tab (RESICO variant)
├── Banner: "En RESICO, tus gastos no son deducibles para ISR.
│            Tu ISR se calcula sobre ingresos brutos a tasa fija."
│
├── Summary Cards
│   ├── Total Gastos del Periodo (informational only)
│   ├── IVA Acreditable (YES — IVA acrediting still works in RESICO)
│   └── ISR Tasa Efectiva (show the flat rate they pay)
│
├── Expense Breakdown (informational, not "deducible")
│   ├── Same categories as 612 but without deductibility flags
│   └── Useful for business intelligence even if not tax-deductible
│
├── IVA Section
│   ├── IVA Trasladado (cobrado in invoices)
│   ├── IVA Acreditable (paid in expenses)
│   ├── IVA a Pagar = Trasladado - Acreditable
│   └── This IS relevant for RESICO — IVA declaration works the same
│
└── RESICO Regime Monitor
    ├── YTD Income vs $3.5M limit
    ├── Progress bar: "70% del límite RESICO"
    ├── Alert if approaching threshold
    └── Recommendation to consider switching to 612 if close
```

---

## 7. Implementation Plan

### Phase 0 — In-App Educational Content (both modules) **DONE**

Both the **Facturación** module and the **SAT Descarga** module guide tabs were expanded with régimen-specific educational content.

**Facturación module — GuiaTab updated:**
- File: `apps/doctor/src/app/dashboard/facturacion/page.tsx` (GuiaTab component)
- Added: "Tu régimen fiscal y cómo afecta tu facturación" (612 vs 626 differences)
- Added: "IVA en servicios médicos" (exemptions, retentions, cosmetic vs medical)
- Added: "Cuándo usar PUE vs PPD" (payment timing, REP obligations)
- Added: "Errores comunes al facturar" (wrong RFC, wrong ISR rate, IVA on exempt services, missing REPs)
- Added: Retention comparison table (612: 10% ISR, 626: 1.25% ISR)

**SAT Descarga module — ContableTab updated:**
- File: `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (ContableTab component)
- Added: Régimen overview section with color-coded 612/626 cards
- Added: "Deducciones según tu régimen" (what's deductible per régimen)
- Added: "Obligaciones periódicas según régimen" (monthly/annual obligations)
- Added: RESICO caveat about no deductions for ISR
- Removed: Defunct régimen 621 (Incorporación Fiscal, discontinued 2022)

**Static docs:** `GUIA-FACTURACION-DOCTORES.md` and `PLAN-FACTURACION-CFDI.md` still pending updates.

### Phase 1 — Régimen-Aware Facturación Fixes (1 day) **DONE**

1. **ISR retention rate — dynamic + editable:** **DONE**
   - Default: 612 → 10%, 626 (RESICO) → 1.25%
   - User can override rate via editable `%` input next to ISR checkbox
   - "restaurar" button resets to régimen default when custom rate is used
   - Amber warning in totals section when custom rate is active
   - `useEffect` syncs rate when `profile.regimenFiscal` changes
   - **Backend:** `cfdi/route.ts` — soft validation (console.warn if rate differs from expected, does not reject)
   - **Frontend:** `facturacion/page.tsx` — NuevaFacturaTab ISR rate state derived from profile

2. **IVA rate — editable:** **DONE**
   - Default: 16% for both regímenes
   - Same editable input pattern as ISR (input, restore button, amber warning)
   - Applied to both NuevaFacturaTab and EgresoTab
   - No hardcoded `0.16` remains in tax calculations

3. **IVA exemption auto-detection for medical services to PF:** Pending
   - When receiver RFC is PF pattern (13 chars), should auto-default IVA to exempt
   - Low effort, deferred to avoid scope creep

4. **Store régimen in fiscal profile** (already exists as `regimenFiscal` field in `DoctorFiscalProfile`) — no changes needed

5. **Update user-facing documentation:** Pending
   - `docs/TODO-FACTURAS/GUIA-FACTURACION-DOCTORES.md` — Add RESICO-specific sections
   - `docs/TODO-FACTURAS/PLAN-FACTURACION-CFDI.md` — Update Consideraciones Fiscales

6. **No schema changes needed** — all fields already exist

### Phase 2 — Pilar 2: Deducciones Tab for 612 (2-3 days)

1. **New API route:** `GET /api/sat-descarga/deductions?year=2026`
   - Query `sat_cfdi_metadata` + `sat_cfdi_concepto` for received, vigente CFDIs
   - Classify each CFDI into categories using `claveProdServ` + keyword matching
   - Aggregate by category, month
   - Flag non-deductible items (cash > $2k, cancelled, etc.)
   - Return: categories[], monthlyBreakdown[], alerts[], totals{}
2. **New tab in sat-descarga:** "Deducciones" (only visible for 612 doctors)
3. **RESICO variant:** Same tab but with informational framing + IVA focus + income limit tracker

### Phase 3 — Pilar 1: Opinión de Cumplimiento (1-2 days)

1. **MVP (manual upload):**
   - New API route: `POST /api/sat-descarga/opinion-cumplimiento` (upload PDF)
   - New API route: `GET /api/sat-descarga/opinion-cumplimiento` (latest status)
   - New tab in sat-descarga: "Cumplimiento SAT"
   - Simple status card + upload button + history
2. **Database migration required:**
   - New table `sat_opinion_cumplimiento` (see data model in Section 4)
   - Add to `schema.prisma` under `@@schema("public")`
   - Create SQL file: `packages/database/prisma/migrations/add-opinion-cumplimiento-table.sql`
   - **Per `database-architecture.md`:** Run migration on Railway BEFORE deploying code
   - Use `CREATE TABLE IF NOT EXISTS`, `TEXT PRIMARY KEY` (cuid), standard pattern
3. **Enhancement (SAT web service — later):**
   - Research SAT SOAP endpoint for opinion consultation
   - Implement using existing e.Firma infrastructure in `apps/api/src/lib/sat-descarga.ts`
   - Auto-refresh monthly

### Phase 4 — RESICO Income Monitor (1 day)

1. **New API route:** `GET /api/sat-descarga/resico-monitor?year=2026`
   - Sum all emitted Ingreso CFDIs YTD
   - Compare against $3.5M limit
   - Return: totalIncome, limit, percentage, monthlyBreakdown[]
2. **Widget in Deducciones tab** (RESICO variant only)

### Phase 5 — Nómina Support (future, major feature)

Out of scope for now. Requires:
- Employee management module
- ISR payroll calculation tables
- IMSS/INFONAVIT contribution calculator
- Nómina CFDI complemento 1.2 generation
- Biweekly/monthly emission schedule
- Integration with Facturama for nómina timbrado

---

## File Impact Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/api/src/app/api/sat-descarga/deductions/route.ts` | Deductions API (categorize, aggregate, flag) |
| `apps/api/src/app/api/sat-descarga/opinion-cumplimiento/route.ts` | Opinion upload/query |
| `apps/api/src/app/api/sat-descarga/resico-monitor/route.ts` | RESICO income limit tracker |
| `apps/api/src/lib/deduction-categories.ts` | Category classification logic (claveProdServ mappings) |
| Migration: `add-opinion-cumplimiento-table.sql` | New table for opinion history |

### Modified Files
| File | Change | Status |
|------|--------|--------|
| `apps/doctor/src/app/dashboard/facturacion/page.tsx` | Phase 0: GuiaTab régimen content. Phase 1: Editable IVA/ISR rates in NuevaFacturaTab + EgresoTab | **DONE** |
| `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` | Phase 0: ContableTab régimen content. Phase 2+: Add Deducciones/Cumplimiento tabs | Phase 0 **DONE**, Phase 2+ pending |
| `apps/api/src/app/api/facturacion/cfdi/route.ts` | Phase 1: ISR rate soft validation (warn if custom rate used) | **DONE** |
| `apps/api/src/lib/facturama.ts` | Pass régimen-aware tax config | Pending (not needed — frontend sends correct rates) |

### No Changes Needed
| File | Reason |
|------|--------|
| SAT Descarga Masiva lib/routes | Already complete — data source is ready |
| Database schema for CFDIs | `sat_cfdi_concepto.claveProdServ` already stored |
| e.Firma management | Already works for SAT auth |
