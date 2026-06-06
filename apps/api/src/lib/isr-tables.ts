/**
 * ISR rate tables and calculation functions for Mexican tax regimes.
 *
 * Shared between declaration route and accountant report to avoid table drift.
 *
 * Sources:
 *   - Art. 96 LISR (monthly table)
 *   - Art. 106 LISR (provisional payments — scale by month number)
 *   - Art. 113-E LISR (RESICO)
 *   - Anexo 8 RMF 2026 (DOF 28/12/2025)
 */

// ---------------------------------------------------------------------------
// ISR Art. 96 — Monthly rate table (Anexo 8 RMF 2026, DOF 28/12/2025)
// For provisional payments (Art. 106), multiply limits & cuotaFija by month #
// ---------------------------------------------------------------------------

export interface IsrBracket {
  limiteInferior: number;
  limiteSuperior: number;
  cuotaFija: number;
  tasa: number; // percentage over excess (e.g. 0.0192 = 1.92%)
}

export const ISR_MONTHLY_TABLE: IsrBracket[] = [
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

// RESICO monthly ISR table (Art. 113-E LISR)
export interface ResicoBracket {
  limiteInferior: number;
  limiteSuperior: number;
  tasa: number;
}

export const RESICO_MONTHLY_TABLE: ResicoBracket[] = [
  { limiteInferior: 0.01,      limiteSuperior: 25000.00,     tasa: 0.01 },
  { limiteInferior: 25000.01,  limiteSuperior: 50000.00,     tasa: 0.011 },
  { limiteInferior: 50000.01,  limiteSuperior: 83333.33,     tasa: 0.015 },
  { limiteInferior: 83333.34,  limiteSuperior: 208333.33,    tasa: 0.02 },
  { limiteInferior: 208333.34, limiteSuperior: 291666.67,    tasa: 0.025 },
];

/**
 * Calculate ISR for regime 612 using the accumulated table.
 * Per Art. 106 LISR + Anexo 8 RMF, the monthly table limits and cuotaFija
 * are multiplied by the month number to get the accumulated table.
 */
export function calculateIsr612(baseGravable: number, months: number = 1): { isr: number; bracket: IsrBracket | null } {
  if (baseGravable <= 0) return { isr: 0, bracket: null };

  for (const bracket of ISR_MONTHLY_TABLE) {
    const limSup = bracket.limiteSuperior === Infinity ? Infinity : bracket.limiteSuperior * months;
    const limInf = bracket.limiteInferior * months;
    const cuota = bracket.cuotaFija * months;
    if (baseGravable <= limSup || limSup === Infinity) {
      const excedente = baseGravable - limInf;
      const isr = cuota + (excedente * bracket.tasa);
      return { isr, bracket };
    }
  }
  // Fallback to top bracket
  const top = ISR_MONTHLY_TABLE[ISR_MONTHLY_TABLE.length - 1];
  const limInf = top.limiteInferior * months;
  const cuota = top.cuotaFija * months;
  return { isr: cuota + ((baseGravable - limInf) * top.tasa), bracket: top };
}

/**
 * Calculate ISR for RESICO (regime 626).
 * Flat rate on monthly gross income, NOT cumulative.
 */
export function calculateIsrResico(ingresosMensuales: number): { isr: number; tasa: number } {
  if (ingresosMensuales <= 0) return { isr: 0, tasa: 0 };

  for (const bracket of RESICO_MONTHLY_TABLE) {
    if (ingresosMensuales <= bracket.limiteSuperior) {
      return { isr: ingresosMensuales * bracket.tasa, tasa: bracket.tasa };
    }
  }
  const top = RESICO_MONTHLY_TABLE[RESICO_MONTHLY_TABLE.length - 1];
  return { isr: ingresosMensuales * top.tasa, tasa: top.tasa };
}
