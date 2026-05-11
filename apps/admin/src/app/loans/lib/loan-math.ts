import type {
  LoanParams,
  LoanProfitResult,
  CofBreakdown,
  DefaultScenarioResult,
  SensitivityCell,
} from "./types";
import {
  generateAmortization,
  summarizeByYear,
  calculateTotalInterest,
  calculateMonthlyPayment,
} from "./amortization";
import { MARKET } from "./constants";

/**
 * Calculate cost of funds from year summaries.
 */
function calculateCofBreakdown(
  yearSummaries: { year: number; avgOutstanding: number }[],
  cofRate: number,
  termMonths: number
): CofBreakdown {
  const lastYearMonths = termMonths % 12 || 12;
  const result: CofBreakdown = { year1: 0, year2: 0, year3: 0, total: 0 };

  yearSummaries.forEach((ys) => {
    const months = ys.year === yearSummaries.length ? lastYearMonths : 12;
    const cof = ys.avgOutstanding * cofRate * (months / 12);
    if (ys.year === 1) result.year1 = Math.round(cof * 100) / 100;
    else if (ys.year === 2) result.year2 = Math.round(cof * 100) / 100;
    else if (ys.year === 3) result.year3 = Math.round(cof * 100) / 100;
  });

  result.total = Math.round((result.year1 + result.year2 + result.year3) * 100) / 100;
  return result;
}

/**
 * Full loan profit calculation.
 */
export function calculateLoanProfit(params: LoanParams): LoanProfitResult {
  const schedule = generateAmortization(params.principal, params.annualRate, params.termMonths);
  const yearSummaries = summarizeByYear(schedule);
  const totalInterest = calculateTotalInterest(schedule);
  const monthlyPayment = calculateMonthlyPayment(params.principal, params.annualRate, params.termMonths);

  // Revenue
  const originationFee = params.principal * params.originationFeeRate * (1 + MARKET.ivaRate);
  const grossRevenue = totalInterest + originationFee;

  // Costs
  const cofBreakdown = calculateCofBreakdown(yearSummaries, params.cofRate, params.termMonths);
  const lgd = 1 - params.recoveryRate;
  const provisionAmount = params.principal * params.defaultRate * lgd;
  const termYears = params.termMonths / 12;
  const opExTotal = params.originationCost + params.annualServicingCost * termYears;

  const totalCosts = cofBreakdown.total + provisionAmount + opExTotal;

  // Profit
  const netProfit = grossRevenue - totalCosts;
  const profitMargin = grossRevenue > 0 ? netProfit / grossRevenue : 0;
  const monthlyProfit = netProfit / params.termMonths;
  const annualizedROI = (netProfit / params.principal / termYears);

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    originationFee: Math.round(originationFee * 100) / 100,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    cofTotal: cofBreakdown.total,
    cofBreakdown,
    provisionAmount: Math.round(provisionAmount * 100) / 100,
    opExTotal: Math.round(opExTotal * 100) / 100,
    totalCosts: Math.round(totalCosts * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin,
    monthlyProfit: Math.round(monthlyProfit * 100) / 100,
    annualizedROI,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    schedule,
    yearSummaries,
  };
}

/**
 * What happens if a loan defaults at a specific month?
 */
export function calculateDefaultAtMonth(
  params: LoanParams,
  atMonth: number
): DefaultScenarioResult {
  const schedule = generateAmortization(params.principal, params.annualRate, params.termMonths);

  // Payments received up to default month
  const rowsBeforeDefault = schedule.slice(0, atMonth);
  const paymentsReceived = rowsBeforeDefault.reduce((s, r) => s + r.payment, 0);
  const interestEarned = rowsBeforeDefault.reduce((s, r) => s + r.interest, 0);
  const principalRepaid = rowsBeforeDefault.reduce((s, r) => s + r.principal, 0);
  const outstandingAtDefault = schedule[atMonth - 1]?.endBalance ?? 0;

  // Recovery
  const recoveryAmount = outstandingAtDefault * params.recoveryRate;

  // CoF paid up to default
  // Approximate: avg outstanding over the months before default × monthly CoF
  const avgOutstandingBeforeDefault =
    rowsBeforeDefault.reduce((s, r) => s + r.startBalance, 0) / Math.max(rowsBeforeDefault.length, 1);
  const cofPaid = avgOutstandingBeforeDefault * params.cofRate * (atMonth / 12);

  const originationFee = params.principal * params.originationFeeRate * (1 + MARKET.ivaRate);

  // Net = (total cash received) - (total cash out)
  // Cash in:  paymentsReceived + recovery + originationFee
  // Cash out: principal advanced + cofPaid + collectionCost
  const net =
    paymentsReceived +
    recoveryAmount +
    originationFee -
    params.principal -
    cofPaid -
    params.collectionCost;

  return {
    defaultMonth: atMonth,
    paymentsReceived: Math.round(paymentsReceived * 100) / 100,
    interestEarned: Math.round(interestEarned * 100) / 100,
    principalRepaid: Math.round(principalRepaid * 100) / 100,
    outstandingAtDefault: Math.round(outstandingAtDefault * 100) / 100,
    recoveryAmount: Math.round(recoveryAmount * 100) / 100,
    cofPaid: Math.round(cofPaid * 100) / 100,
    collectionCost: params.collectionCost,
    netResult: Math.round(net * 100) / 100,
    originationFee: Math.round(originationFee * 100) / 100,
  };
}

/**
 * Generate sensitivity matrix: rate charged vs cost of funds.
 */
export function generateSensitivityMatrix(
  baseParams: LoanParams,
  rateRange: number[], // e.g. [0.24, 0.27, 0.30, 0.33, 0.36]
  cofRange: number[] // e.g. [0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20]
): SensitivityCell[][] {
  return cofRange.map((cof) =>
    rateRange.map((rate) => {
      const result = calculateLoanProfit({ ...baseParams, annualRate: rate, cofRate: cof });
      return {
        rate,
        cof,
        profit: result.netProfit,
        margin: result.profitMargin,
      };
    })
  );
}

/**
 * Generate default impact curve — net result at each possible default month.
 */
export function generateDefaultCurve(params: LoanParams): DefaultScenarioResult[] {
  const results: DefaultScenarioResult[] = [];
  for (let m = 1; m <= params.termMonths; m++) {
    results.push(calculateDefaultAtMonth(params, m));
  }
  return results;
}

/**
 * Format number as MXN currency.
 */
export function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format as percentage.
 */
export function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
