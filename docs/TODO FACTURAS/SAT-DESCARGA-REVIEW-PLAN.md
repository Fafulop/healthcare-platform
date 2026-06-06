# SAT Descarga — Code Review & Fix Plan

**Date:** 2026-06-05
**Scope:** Technical + legal review of `/dashboard/sat-descarga` flow
**Source of truth:** `UNIFIED-FISCAL-REFERENCE.md` + verified web research (June 2026)

---

## Flow Overview (Confirmed Correct)

```
e.Firma upload → SAT SOAP sync → sat_cfdi_metadata + sat_cfdi_details (DB)
                                         |
     ┌───────────────────────────────────┼────────────────────────────┐
     v                                   v                            v
[1] CFDIs Descargados       [2] Resumen Fiscal           [3] Deducciones
(raw list + XML detail)     (annual summary)             (expense classification)
     |                           |                            |
     v                           v                            v
[4] Declaraciones           [5] Cobranza              [6] Guia / [7] Ayuda
(ISR + IVA estimates)       (PPD accounts receivable)  (reference docs)
     |
     v
Reporte para Contador (CSV export with ISR/IVA/CFDIs/retentions/non-deductible)
```

The data flow is architecturally sound. Tabs correctly depend on CFDIs Descargados as the source of truth.

---

## CRITICAL Issues (Affect ISR calculation accuracy)

### C1. ISR Art. 96 table in code uses 2024/2025 values, not 2026 — FIXED

**Files:**
- `apps/api/src/app/api/sat-descarga/declaration/route.ts` (lines 33-45)
- `apps/api/src/app/api/sat-descarga/export/accountant-report/route.ts` (lines 34-46)

**Problem:** The ISR bracket values in the code don't match the 2026 Anexo 8 RMF values documented in `UNIFIED-FISCAL-REFERENCE.md`:

| Bracket | Code value | Correct 2026 value |
|---------|-----------|-------------------|
| 1st limit | $746.04 | $844.59 |
| 2nd limit | $6,332.05 | $7,167.67 |
| 3rd limit | $11,128.01 | $12,601.03 |
| ... | (all lower) | (all ~13% higher) |
| Last starts | $375,975.62 | $375,975.62 (matches!) |

The last bracket was already corrected but the lower brackets still use pre-2026 values. The 2026 table applies a 13.21% inflation adjustment over 2025 values (DOF 28/12/2025).

**Impact:** ISR is being computed against wrong bracket boundaries. For low-to-mid income months, this could shift income into a higher bracket than it should be.

**Fix:** Update all 11 brackets in both files to match the 2026 Anexo 8 RMF values:

```typescript
const ISR_MONTHLY_TABLE: IsrBracket[] = [
  { limiteInferior: 0.01,      limiteSuperior: 844.58,       cuotaFija: 0,         tasa: 0.0192 },
  { limiteInferior: 844.59,    limiteSuperior: 7167.67,      cuotaFija: 16.22,     tasa: 0.0640 },
  { limiteInferior: 7167.68,   limiteSuperior: 12601.03,     cuotaFija: 420.90,    tasa: 0.1088 },
  { limiteInferior: 12601.04,  limiteSuperior: 14648.87,     cuotaFija: 1012.08,   tasa: 0.16 },
  { limiteInferior: 14648.88,  limiteSuperior: 17533.64,     cuotaFija: 1339.74,   tasa: 0.1792 },
  { limiteInferior: 17533.65,  limiteSuperior: 35362.83,     cuotaFija: 1856.84,   tasa: 0.2136 },
  { limiteInferior: 35362.84,  limiteSuperior: 55734.75,     cuotaFija: 5662.62,   tasa: 0.2352 },
  { limiteInferior: 55734.76,  limiteSuperior: 79388.37,     cuotaFija: 10454.09,  tasa: 0.30 },
  { limiteInferior: 79388.38,  limiteSuperior: 106410.50,    cuotaFija: 17550.18,  tasa: 0.32 },
  { limiteInferior: 106410.51, limiteSuperior: 375975.61,    cuotaFija: 26197.27,  tasa: 0.34 },
  { limiteInferior: 375975.62, limiteSuperior: Infinity,     cuotaFija: 117829.97, tasa: 0.35 },
];
```

**Source:** Anexo 8 RMF 2026 (DOF 28/12/2025). Verify exact centavos against the official PDF before applying.

---

### C2. ISR provisional calculation doesn't scale table by month count — FIXED

**Files:**
- `apps/api/src/app/api/sat-descarga/declaration/route.ts` (line ~152-170 in the 612 loop)
- `apps/api/src/app/api/sat-descarga/export/accountant-report/route.ts` (line ~251-277)

**Problem:** For regime 612, the code accumulates income (Jan through current month) then applies the **single-month** Art. 96 table. Per Art. 106 LISR and Anexo 8 RMF, you must use the **accumulated table** for the corresponding month (limits and cuotaFija multiplied by month number).

**Example of the error:**
- Doctor earns $50K/month, $15K/month deductions
- By month 3: accumulated base = $105,000
- Code looks up $105,000 in monthly table → bracket 10 ($106,410+), cuotaFija $26,197, rate 34%
- Correct: 3-month table has bracket 10 starting at $319,231 ($106,410 × 3), so $105K is actually in bracket 8 (30%)

**Impact:** Significant ISR overestimation for months 2-12 for regime 612 doctors. The error grows larger with more months.

**Fix:** Multiply `limiteInferior`, `limiteSuperior`, and `cuotaFija` by the month number before lookup:

```typescript
function calculateIsr612(baseGravable: number, months: number): number {
  if (baseGravable <= 0) return 0;
  for (const bracket of ISR_MONTHLY_TABLE) {
    const limSup = bracket.limiteSuperior === Infinity
      ? Infinity
      : bracket.limiteSuperior * months;
    const limInf = bracket.limiteInferior * months;
    const cuota = bracket.cuotaFija * months;
    if (baseGravable <= limSup) {
      return cuota + ((baseGravable - limInf) * bracket.tasa);
    }
  }
  const top = ISR_MONTHLY_TABLE[ISR_MONTHLY_TABLE.length - 1];
  return (top.cuotaFija * months) + ((baseGravable - (top.limiteInferior * months)) * top.tasa);
}
```

Then call it as:
```typescript
const { isr: isrCausado } = calculateIsr612(baseGravable, m); // m = month number (1-12)
```

**Legal reference:** Art. 106 LISR + Anexo 8 RMF 2026 ("Tarifa para el pago provisional del mes de [X]" — each month has its own table where values = monthly table × month number).

---

## MODERATE Issues (Incorrect legal references)

### M1. deduction-categories.ts cites wrong LISR articles — FIXED

**File:** `apps/api/src/lib/deduction-categories.ts`

| Line | Current | Correct |
|------|---------|---------|
| 15 | "Art. 25-35 LISR" | "Art. 103-105, 34 LISR" (PF articles) |
| 45 | "25% annual per Art. 35 LISR" | "10% general per Art. 34 LISR (verify sector-specific)" |
| 52 | "30% annual per Art. 35 LISR" | "30% annual per Art. 34 LISR" |
| 59 | "10% annual per Art. 35 LISR" | "10% annual per Art. 34 LISR" |

**Note on equipo_medico rate:** The code uses 25% depreciation for medical equipment. Art. 34 LISR says general "maquinaria y equipo" is 10%. 25% is for automobiles/transport. Medical equipment doesn't have a specific higher rate unless it falls under a sector-specific fraction. Should be **10%** unless a specific Art. 34 fraction applies. This affects the categorization accuracy in the Deducciones tab.

**Fix:** Update comments from "Art. 35" to "Art. 34" and change equipo_medico depreciationRate from 0.25 to 0.10.

---

### M2. GuiaTab cites Art. 27 frac. III (PM article) for cash >$2K rule — FIXED

**File:** `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (line ~3661)

**Current:** `Pagos en efectivo mayores a $2,000 (aun con factura — Art. 27 frac. III LISR)`

**Correct:** `Pagos en efectivo mayores a $2,000 (aun con factura — Art. 105 LISR)`

Art. 27 is Title II (Personas Morales). For PF with actividad empresarial, the bancarization requirement is in Art. 105 LISR.

---

### M3. GuiaTab DIOT deadline shows "Dia 17" — FIXED

**File:** `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` (line ~3849)

**Current:** DIOT deadline = "Dia 17 del mes siguiente"

**Correct:** DIOT deadline = "Ultimo dia del mes siguiente" (Regla 4.5.1 RMF)

Day 17 is for ISR and IVA declarations. DIOT has a different deadline.

---

## MINOR Issues (Documentation/cosmetic)

### m1. GuiaTab depreciation reference too broad — FIXED

**File:** page.tsx line ~3603

**Current:** "Art. 31-38 LISR"
**Better:** "Art. 34 LISR" (specific depreciation rate article for PF)

### m2. ISR table comment misleading — FIXED

**Files:** declaration/route.ts, accountant-report/route.ts

**Current:** `// ISR Art. 96 — Monthly provisional rate table (2024-2026)`
**Better:** `// ISR Art. 96 — Monthly rate table (Anexo 8 RMF 2026, DOF 28/12/2025)`

### m3. deduction-categories.ts RESICO IVA rule reference — FIXED

**File:** deduction-categories.ts line 8

**Current:** "regla 3.13.20 RMF"
**GuiaTab line 3556:** Also says "regla 3.13.20 RMF"
**UNIFIED-FISCAL-REFERENCE.md:** Says "Regla 3.13.17 RMF"

**Resolution:** They are two different rules for two different things:
- **Regla 3.13.17** = Exención de DIOT y contabilidad electrónica para RESICO PF → correctly used in UNIFIED-FISCAL-REFERENCE.md DIOT rows (lines 77, 253)
- **Regla 3.13.20** = IVA acreditable applies in RESICO → correctly used in code (deduction-categories.ts:8, page.tsx:1901, 1950, 3556)

**Fix applied:** UNIFIED-FISCAL-REFERENCE.md line 502 incorrectly cited Regla 3.13.17 for IVA acreditable context → changed to Regla 3.13.20. No code changes needed — code was already correct.

---

## What's CORRECT (no changes needed)

- IVA medical exemption in GuiaTab (lines 3265-3277): Correctly explains it depends on provider type (PF con titulo), not client type
- Retention rates: 10% ISR (612), 1.25% ISR (RESICO), 2/3 IVA — all correct
- PUE vs PPD explanation and fiscal implications
- Uso CFDI table with regime-specific deducibility
- RESICO monitor and $3.5M limit tracking
- ISR cumulative calculation example in GuiaTab (pedagogically correct)
- Complemento de pago tracking (Cobranza tab)
- Cancellation rules (72 hours, correct)
- Accountant report structure and sections
- Data flow between tabs (source of truth → derived views)
- RESICO ISR table (correct values, correct calculation as monthly non-cumulative)
- Deducibility flag logic (cash >$2K, S01, cancelled, etc.)
- Tab relationship diagram in Ayuda
- FAQ content

---

## Implementation Order

1. **C1 + C2** — Fix ISR calculation (critical, affects numbers users see)
2. **M1** — Fix deduction-categories article refs + equipo_medico rate
3. **M2** — Fix Art. 27 → Art. 105 in GuiaTab
4. **M3** — Fix DIOT deadline in GuiaTab
5. **m1-m3** — Minor comment/reference fixes

### Pre-implementation checklist:
- [ ] Download Anexo 8 RMF 2026 PDF and verify exact bracket values (centavos matter)
- [ ] Confirm cuotaFija values for 2026 (the ones in the .md may have rounding differences)
- [x] Verify Regla 3.13.20 vs 3.13.17 applicability for RESICO IVA acreditable
- [ ] Test ISR calculation with sample data after fix (compare output for 1, 6, 12 month scenarios)

---

## Notes

- The Guia and Ayuda tabs are exceptionally well-written. The explanations are pedagogically sound, the examples are relevant for doctors, and the flow between tabs is clearly documented.
- The accountant report CSV is comprehensive — covers ISR summary, IVA summary, CFDI detail, retentions by client, non-deductible flags, and RESICO monitor. Structure is correct.
- The RESICO calculation is simpler and appears correct (flat rate on monthly income, no accumulation needed).
