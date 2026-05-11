import type { AmortizationRow, YearSummary } from "./types";

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
 */
export function generateAmortization(
  principal: number,
  annualRate: number,
  termMonths: number
): AmortizationRow[] {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  const schedule: AmortizationRow[] = [];
  let balance = principal;

  for (let month = 1; month <= termMonths; month++) {
    const interest = balance * r;
    const principalPortion = monthlyPayment - interest;
    const endBalance = Math.max(0, balance - principalPortion);

    schedule.push({
      month,
      startBalance: Math.round(balance * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principalPortion * 100) / 100,
      payment: Math.round(monthlyPayment * 100) / 100,
      endBalance: Math.round(endBalance * 100) / 100,
    });

    balance = endBalance;
  }

  return schedule;
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
