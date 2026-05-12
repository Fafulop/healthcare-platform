import type { AmortizationRow, YearSummary, AmortizationType } from "./types";

/**
 * Calculate monthly payment for French amortization.
 * PMT = P * r * (1+r)^n / ((1+r)^n - 1)
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return principal * r * factor / (factor - 1);
}

/**
 * Generate full month-by-month amortization schedule.
 * Supports multiple amortization types used in Mexico:
 *
 * - french: Equal monthly payments (cuota fija). Most common in MX.
 * - equalPrincipal: Equal capital + declining interest (sistema aleman).
 * - interestOnly: Grace period of interest-only, then French for remaining term.
 * - flat: Interest calculated on original principal every month (tasa flat).
 *
 * If prepaymentMonth > 0, the loan is fully paid off at that month.
 */
export function generateAmortization(
  principal: number,
  annualRate: number,
  termMonths: number,
  prepaymentMonth: number = 0,
  amortizationType: AmortizationType = "french",
  gracePeriodMonths: number = 3
): AmortizationRow[] {
  switch (amortizationType) {
    case "equalPrincipal":
      return generateEqualPrincipal(principal, annualRate, termMonths, prepaymentMonth);
    case "interestOnly":
      return generateInterestOnly(principal, annualRate, termMonths, prepaymentMonth, gracePeriodMonths);
    case "flat":
      return generateFlat(principal, annualRate, termMonths, prepaymentMonth);
    default:
      return generateFrench(principal, annualRate, termMonths, prepaymentMonth);
  }
}

// ─── French (Sistema Frances) ───
// Equal payments, declining interest, increasing capital.
function generateFrench(
  principal: number,
  annualRate: number,
  termMonths: number,
  prepaymentMonth: number
): AmortizationRow[] {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  const schedule: AmortizationRow[] = [];
  let balance = principal;
  const effectiveTerm = prepaymentMonth > 0 ? Math.min(prepaymentMonth, termMonths) : termMonths;

  for (let month = 1; month <= effectiveTerm; month++) {
    const interest = balance * r;
    const isPrepayMonth = prepaymentMonth > 0 && month === prepaymentMonth;

    if (isPrepayMonth) {
      const finalPayment = balance + interest;
      schedule.push({
        month,
        startBalance: round(balance),
        interest: round(interest),
        principal: round(balance),
        payment: round(finalPayment),
        endBalance: 0,
      });
      break;
    }

    const principalPortion = monthlyPayment - interest;
    const endBalance = Math.max(0, balance - principalPortion);

    schedule.push({
      month,
      startBalance: round(balance),
      interest: round(interest),
      principal: round(principalPortion),
      payment: round(monthlyPayment),
      endBalance: round(endBalance),
    });

    balance = endBalance;
  }

  return schedule;
}

// ─── Equal Principal (Sistema Aleman) ───
// Equal capital each month. Interest on declining balance. Total payment decreases.
function generateEqualPrincipal(
  principal: number,
  annualRate: number,
  termMonths: number,
  prepaymentMonth: number
): AmortizationRow[] {
  const r = annualRate / 12;
  const fixedCapital = principal / termMonths;
  const schedule: AmortizationRow[] = [];
  let balance = principal;
  const effectiveTerm = prepaymentMonth > 0 ? Math.min(prepaymentMonth, termMonths) : termMonths;

  for (let month = 1; month <= effectiveTerm; month++) {
    const interest = balance * r;
    const isPrepayMonth = prepaymentMonth > 0 && month === prepaymentMonth;

    if (isPrepayMonth) {
      const finalPayment = balance + interest;
      schedule.push({
        month,
        startBalance: round(balance),
        interest: round(interest),
        principal: round(balance),
        payment: round(finalPayment),
        endBalance: 0,
      });
      break;
    }

    const payment = fixedCapital + interest;
    const endBalance = Math.max(0, balance - fixedCapital);

    schedule.push({
      month,
      startBalance: round(balance),
      interest: round(interest),
      principal: round(fixedCapital),
      payment: round(payment),
      endBalance: round(endBalance),
    });

    balance = endBalance;
  }

  return schedule;
}

// ─── Interest Only + French (Periodo de Gracia) ───
// First N months: only interest (no capital). Then French amortization for remaining term.
function generateInterestOnly(
  principal: number,
  annualRate: number,
  termMonths: number,
  prepaymentMonth: number,
  gracePeriodMonths: number
): AmortizationRow[] {
  const r = annualRate / 12;
  const schedule: AmortizationRow[] = [];
  let balance = principal;
  const effectiveGrace = Math.min(gracePeriodMonths, termMonths - 1);
  const amortTerm = termMonths - effectiveGrace;
  const effectiveTerm = prepaymentMonth > 0 ? Math.min(prepaymentMonth, termMonths) : termMonths;

  // Phase 1: Interest-only (grace period)
  for (let month = 1; month <= Math.min(effectiveGrace, effectiveTerm); month++) {
    const interest = balance * r;
    const isPrepayMonth = prepaymentMonth > 0 && month === prepaymentMonth;

    if (isPrepayMonth) {
      schedule.push({
        month,
        startBalance: round(balance),
        interest: round(interest),
        principal: round(balance),
        payment: round(balance + interest),
        endBalance: 0,
      });
      return schedule;
    }

    schedule.push({
      month,
      startBalance: round(balance),
      interest: round(interest),
      principal: 0,
      payment: round(interest),
      endBalance: round(balance),
    });
  }

  // Phase 2: French amortization on remaining balance for remaining term
  const monthlyPayment = calculateMonthlyPayment(balance, annualRate, amortTerm);

  for (let i = 0; i < amortTerm; i++) {
    const month = effectiveGrace + i + 1;
    if (month > effectiveTerm) break;

    const interest = balance * r;
    const isPrepayMonth = prepaymentMonth > 0 && month === prepaymentMonth;

    if (isPrepayMonth) {
      schedule.push({
        month,
        startBalance: round(balance),
        interest: round(interest),
        principal: round(balance),
        payment: round(balance + interest),
        endBalance: 0,
      });
      break;
    }

    const principalPortion = monthlyPayment - interest;
    const endBalance = Math.max(0, balance - principalPortion);

    schedule.push({
      month,
      startBalance: round(balance),
      interest: round(interest),
      principal: round(principalPortion),
      payment: round(monthlyPayment),
      endBalance: round(endBalance),
    });

    balance = endBalance;
  }

  return schedule;
}

// ─── Flat Rate (Tasa Flat / Sobre Saldo Original) ───
// Interest is always calculated on the ORIGINAL principal, not the declining balance.
// This makes the effective rate much higher than the stated rate.
// Common in some Mexican informal lending and retail financing.
function generateFlat(
  principal: number,
  annualRate: number,
  termMonths: number,
  prepaymentMonth: number
): AmortizationRow[] {
  const monthlyInterest = principal * annualRate / 12; // always on original
  const fixedCapital = principal / termMonths;
  const fixedPayment = fixedCapital + monthlyInterest;
  const schedule: AmortizationRow[] = [];
  let balance = principal;
  const effectiveTerm = prepaymentMonth > 0 ? Math.min(prepaymentMonth, termMonths) : termMonths;

  for (let month = 1; month <= effectiveTerm; month++) {
    const isPrepayMonth = prepaymentMonth > 0 && month === prepaymentMonth;

    if (isPrepayMonth) {
      // On prepay, interest is still flat but you pay off remaining balance
      const finalPayment = balance + monthlyInterest;
      schedule.push({
        month,
        startBalance: round(balance),
        interest: round(monthlyInterest),
        principal: round(balance),
        payment: round(finalPayment),
        endBalance: 0,
      });
      break;
    }

    const endBalance = Math.max(0, balance - fixedCapital);

    schedule.push({
      month,
      startBalance: round(balance),
      interest: round(monthlyInterest),
      principal: round(fixedCapital),
      payment: round(fixedPayment),
      endBalance: round(endBalance),
    });

    balance = endBalance;
  }

  return schedule;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Summarize amortization by year.
 */
export function summarizeByYear(schedule: AmortizationRow[]): YearSummary[] {
  const years: YearSummary[] = [];
  const totalYears = Math.ceil(schedule.length / 12);

  for (let y = 0; y < totalYears; y++) {
    const yearRows = schedule.slice(y * 12, (y + 1) * 12);
    const totalInterest = yearRows.reduce((sum, r) => sum + r.interest, 0);
    const totalPrincipal = yearRows.reduce((sum, r) => sum + r.principal, 0);
    const totalPayments = yearRows.reduce((sum, r) => sum + r.payment, 0);
    const avgOutstanding = yearRows.reduce((sum, r) => sum + r.startBalance, 0) / yearRows.length;

    years.push({
      year: y + 1,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPrincipal: Math.round(totalPrincipal * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      avgOutstanding: Math.round(avgOutstanding * 100) / 100,
    });
  }

  return years;
}

/**
 * Calculate total interest earned over the loan life.
 */
export function calculateTotalInterest(schedule: AmortizationRow[]): number {
  return Math.round(schedule.reduce((sum, r) => sum + r.interest, 0) * 100) / 100;
}
