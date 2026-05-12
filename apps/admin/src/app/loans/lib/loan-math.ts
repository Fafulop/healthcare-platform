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
  const schedule = generateAmortization(
    params.principal,
    params.annualRate,
    params.termMonths,
    params.prepaymentMonth
  );
  const effectiveTermMonths = schedule.length;
  const yearSummaries = summarizeByYear(schedule);
  const totalInterest = calculateTotalInterest(schedule);
  const monthlyPayment = calculateMonthlyPayment(params.principal, params.annualRate, params.termMonths);

  // Revenue
  const originationFee = params.principal * params.originationFeeRate * (1 + MARKET.ivaRate);
  const grossRevenue = totalInterest + originationFee;

  // EAD: exposure at default — use outstanding balance at expected default month
  const defaultIdx = Math.min(params.defaultMonth, effectiveTermMonths) - 1;
  const ead = defaultIdx >= 0 ? schedule[defaultIdx].endBalance : params.principal;

  // Costs
  const cofBreakdown = calculateCofBreakdown(yearSummaries, params.cofRate, effectiveTermMonths);
  const lgd = 1 - params.recoveryRate;
  const provisionAmount = ead * params.defaultRate * lgd; // EAD-based provision
  const termYears = effectiveTermMonths / 12;
  const opExTotal = params.originationCost + params.annualServicingCost * termYears;

  const totalCosts = cofBreakdown.total + provisionAmount + opExTotal;

  // Profit
  const netProfit = grossRevenue - totalCosts;
  const profitMargin = grossRevenue > 0 ? netProfit / grossRevenue : 0;
  const monthlyProfit = netProfit / effectiveTermMonths;
  const annualizedROI = (netProfit / params.principal / termYears);

  // Advanced Metrics
  const avgOutstanding = schedule.reduce((s, r) => s + r.startBalance, 0) / schedule.length;

  // IRR: build cash flow array from lender's perspective
  const monthlyCofCost = cofBreakdown.total / effectiveTermMonths;
  const monthlyProvision = provisionAmount / effectiveTermMonths;
  const monthlyOpex = opExTotal / effectiveTermMonths;
  const cashFlows: number[] = [-params.principal + originationFee];
  for (let i = 0; i < effectiveTermMonths; i++) {
    const payment = schedule[i].payment;
    cashFlows.push(payment - monthlyCofCost - monthlyProvision - monthlyOpex);
  }
  const monthlyIRR = calculateIRR(cashFlows);
  const irr = Math.pow(1 + monthlyIRR, 12) - 1; // annualize

  // MOIC: total cash received / total cash invested
  const totalPaymentsReceived = schedule.reduce((s, r) => s + r.payment, 0);
  const totalCashIn = totalPaymentsReceived + originationFee;
  const totalCashOut = params.principal + cofBreakdown.total + provisionAmount + opExTotal;
  const moic = totalCashOut > 0 ? totalCashIn / totalCashOut : 0;

  // Spread: simple rate differential
  const spread = params.annualRate - params.cofRate;

  // NIM: net interest income / avg outstanding (annualized)
  const netInterestIncome = totalInterest - cofBreakdown.total;
  const nim = avgOutstanding > 0 ? (netInterestIncome / termYears) / avgOutstanding : 0;

  // Profitability Ratios
  const roe = params.principal > 0 ? (netProfit / termYears) / params.principal : 0;
  const roa = avgOutstanding > 0 ? (netProfit / termYears) / avgOutstanding : 0;
  const portfolioYield = avgOutstanding > 0 ? (grossRevenue / termYears) / avgOutstanding : 0;
  const oss = totalCosts > 0 ? grossRevenue / totalCosts : 0;

  // Efficiency & Regulatory
  const oer = avgOutstanding > 0 ? (opExTotal / termYears) / avgOutstanding : 0;
  const costPerLoanPct = params.principal > 0 ? totalCosts / params.principal : 0;

  // CAT: Costo Anual Total
  const borrowerFlows: number[] = [params.principal - originationFee];
  for (let i = 0; i < effectiveTermMonths; i++) {
    borrowerFlows.push(-schedule[i].payment);
  }
  const monthlyCAT = calculateIRR(borrowerFlows);
  const cat = Math.pow(1 + monthlyCAT, 12) - 1;

  // ── NEW METRICS ──

  // DTI: debt-to-income ratio
  const dti = params.doctorMonthlyIncome > 0 ? monthlyPayment / params.doctorMonthlyIncome : 0;

  // DSCR: debt service coverage ratio (assume 70% of income is disposable for debt)
  const disposableIncome = params.doctorMonthlyIncome * 0.7;
  const dscr = monthlyPayment > 0 ? disposableIncome / monthlyPayment : 0;

  // RAROC: risk-adjusted return on capital
  // (Revenue - Expected Loss - OpEx - CoF) / Capital at risk
  const expectedLoss = ead * params.defaultRate * lgd;
  const raroc = params.principal > 0
    ? ((grossRevenue - expectedLoss - opExTotal - cofBreakdown.total) / termYears) / params.principal
    : 0;

  // WAL: weighted average life (in years)
  // Sum of (month * principal_repaid) / total_principal_repaid
  const totalPrincipalRepaid = schedule.reduce((s, r) => s + r.principal, 0);
  const wal = totalPrincipalRepaid > 0
    ? schedule.reduce((s, r) => s + (r.month / 12) * r.principal, 0) / totalPrincipalRepaid
    : 0;

  // Payback Period: first month where cumulative net cash flow >= 0
  let cumCashFlow = -params.principal + originationFee;
  let paybackMonth = 0;
  for (let i = 0; i < effectiveTermMonths; i++) {
    cumCashFlow += schedule[i].payment - monthlyCofCost - monthlyProvision - monthlyOpex;
    if (cumCashFlow >= 0 && paybackMonth === 0) {
      paybackMonth = i + 1;
    }
  }

  // Duration: approximate modified duration
  // How much does profit change per 100bps change in rate?
  const bumpUp = calculateLoanProfitSimple({ ...params, annualRate: params.annualRate + 0.01 });
  const bumpDown = calculateLoanProfitSimple({ ...params, annualRate: params.annualRate - 0.01 });
  const duration = netProfit !== 0
    ? -((bumpUp - bumpDown) / (2 * 0.01)) / netProfit
    : 0;

  // Break-even loans: how many performing loans needed to cover 1 full default
  // A full default means losing: principal - recovery - payments_before_default
  const fullDefaultLoss = params.principal * lgd; // simplified worst case
  const profitPerPerformingLoan = netProfit;
  const breakEvenLoans = profitPerPerformingLoan > 0
    ? Math.ceil(fullDefaultLoss / profitPerPerformingLoan)
    : Infinity;

  // Hurdle rate comparison
  const hurdleCleared = irr >= params.hurdleRate;

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
    irr,
    moic: Math.round(moic * 100) / 100,
    spread,
    nim,
    avgOutstanding: Math.round(avgOutstanding),
    roe,
    roa,
    portfolioYield,
    oss: Math.round(oss * 100) / 100,
    oer,
    costPerLoanPct,
    cat,
    dti,
    dscr: Math.round(dscr * 100) / 100,
    raroc,
    ead: Math.round(ead * 100) / 100,
    wal: Math.round(wal * 100) / 100,
    paybackMonth,
    duration: Math.round(duration * 100) / 100,
    breakEvenLoans: breakEvenLoans === Infinity ? 999 : breakEvenLoans,
    hurdleCleared,
    schedule,
    yearSummaries,
  };
}

/**
 * Simplified profit calculation for duration/sensitivity (returns just netProfit).
 */
function calculateLoanProfitSimple(params: LoanParams): number {
  const schedule = generateAmortization(
    params.principal,
    params.annualRate,
    params.termMonths,
    params.prepaymentMonth
  );
  const effectiveTermMonths = schedule.length;
  const yearSummaries = summarizeByYear(schedule);
  const totalInterest = calculateTotalInterest(schedule);
  const originationFee = params.principal * params.originationFeeRate * (1 + MARKET.ivaRate);
  const grossRevenue = totalInterest + originationFee;
  const cofBreakdown = calculateCofBreakdown(yearSummaries, params.cofRate, effectiveTermMonths);
  const defaultIdx = Math.min(params.defaultMonth, effectiveTermMonths) - 1;
  const ead = defaultIdx >= 0 ? schedule[defaultIdx].endBalance : params.principal;
  const lgd = 1 - params.recoveryRate;
  const provisionAmount = ead * params.defaultRate * lgd;
  const termYears = effectiveTermMonths / 12;
  const opExTotal = params.originationCost + params.annualServicingCost * termYears;
  return grossRevenue - cofBreakdown.total - provisionAmount - opExTotal;
}

/**
 * What happens if a loan defaults at a specific month?
 */
export function calculateDefaultAtMonth(
  params: LoanParams,
  atMonth: number
): DefaultScenarioResult {
  const schedule = generateAmortization(
    params.principal,
    params.annualRate,
    params.termMonths,
    params.prepaymentMonth
  );

  // Payments received up to default month
  const rowsBeforeDefault = schedule.slice(0, atMonth);
  const paymentsReceived = rowsBeforeDefault.reduce((s, r) => s + r.payment, 0);
  const interestEarned = rowsBeforeDefault.reduce((s, r) => s + r.interest, 0);
  const principalRepaid = rowsBeforeDefault.reduce((s, r) => s + r.principal, 0);
  const outstandingAtDefault = schedule[atMonth - 1]?.endBalance ?? 0;

  // Recovery
  const recoveryAmount = outstandingAtDefault * params.recoveryRate;

  // CoF paid up to default
  const avgOutstandingBeforeDefault =
    rowsBeforeDefault.reduce((s, r) => s + r.startBalance, 0) / Math.max(rowsBeforeDefault.length, 1);
  const cofPaid = avgOutstandingBeforeDefault * params.cofRate * (atMonth / 12);

  const originationFee = params.principal * params.originationFeeRate * (1 + MARKET.ivaRate);

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
  rateRange: number[],
  cofRange: number[]
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
  const effectiveTerm = params.prepaymentMonth > 0
    ? Math.min(params.prepaymentMonth, params.termMonths)
    : params.termMonths;
  const results: DefaultScenarioResult[] = [];
  for (let m = 1; m <= effectiveTerm; m++) {
    results.push(calculateDefaultAtMonth(params, m));
  }
  return results;
}

/**
 * Calculate IRR using Newton-Raphson method.
 * Cash flows: negative = money out, positive = money in.
 * Returns the periodic rate (monthly if cash flows are monthly).
 */
function calculateIRR(cashFlows: number[], guess = 0.01, maxIter = 100, tolerance = 1e-7): number {
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / factor;
      dnpv -= t * cashFlows[t] / (factor * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tolerance) return newRate;
    rate = newRate;
  }
  return rate;
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
