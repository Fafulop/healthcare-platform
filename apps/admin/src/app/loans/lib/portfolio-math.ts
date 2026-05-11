import type {
  PortfolioParams,
  MonthlyProjection,
  PortfolioSummary,
  StressScenario,
} from "./types";
import { calculateMonthlyPayment } from "./amortization";

/**
 * Simulate a lending portfolio month-by-month.
 *
 * Model: each month we originate `monthlyOriginationRate` new loans.
 * Each loan pays fixed monthly payments (French amortization) for `avgTermMonths`.
 * Defaults are applied as a monthly probability derived from the annual blended rate.
 */
export function projectPortfolio(params: PortfolioParams): PortfolioSummary {
  const {
    avgLoanSize,
    avgTermMonths,
    avgRate,
    monthlyOriginationRate,
    cofRate,
    blendedDefaultRate,
    recoveryRate,
    originationFeeRate,
    originationCostPerLoan,
    annualServicingCostPerLoan,
    fixedMonthlyCosts,
    projectionMonths,
  } = params;

  const monthlyPaymentPerLoan = calculateMonthlyPayment(avgLoanSize, avgRate, avgTermMonths);

  // Monthly default probability from annual rate: 1 - (1 - annual)^(1/12)
  const monthlyDefaultProb = 1 - Math.pow(1 - blendedDefaultRate, 1 / 12);
  const monthlyCofRate = cofRate / 12;
  const monthlyServicingPerLoan = annualServicingCostPerLoan / 12;

  // Track cohorts: each cohort = { originMonth, remainingLoans, outstandingBalance, monthsElapsed }
  interface Cohort {
    originMonth: number;
    activeLoans: number;
    outstandingPerLoan: number; // avg outstanding per surviving loan
    monthsElapsed: number;
  }

  const cohorts: Cohort[] = [];
  const projections: MonthlyProjection[] = [];
  let cumulativeProfit = 0;
  let cumulativeDisbursed = 0;
  let cumulativeDefaults = 0;

  for (let month = 1; month <= projectionMonths; month++) {
    // 1. Originate new cohort
    const newLoans = monthlyOriginationRate;
    cohorts.push({
      originMonth: month,
      activeLoans: newLoans,
      outstandingPerLoan: avgLoanSize,
      monthsElapsed: 0,
    });

    const disbursedThisMonth = newLoans * avgLoanSize;
    cumulativeDisbursed += disbursedThisMonth;

    // 2. Process each cohort
    let totalActiveLoans = 0;
    let totalOutstanding = 0;
    let monthlyInterest = 0;
    let monthlyOriginationFees = 0;
    let monthlyDefaults = 0;
    let monthlyPrincipalRepaid = 0;

    for (let i = cohorts.length - 1; i >= 0; i--) {
      const c = cohorts[i];
      c.monthsElapsed++;

      // Cohort has matured — remove it
      if (c.monthsElapsed > avgTermMonths) {
        cohorts.splice(i, 1);
        continue;
      }

      // Defaults this month for this cohort
      const defaultingLoans = c.activeLoans * monthlyDefaultProb;
      c.activeLoans -= defaultingLoans;
      monthlyDefaults += defaultingLoans;

      if (c.activeLoans < 0.001) {
        cohorts.splice(i, 1);
        continue;
      }

      // Interest portion of payment this month
      const monthlyRate = avgRate / 12;
      const interestThisMonth = c.outstandingPerLoan * monthlyRate * c.activeLoans;
      const paymentThisMonth = monthlyPaymentPerLoan * c.activeLoans;
      const principalThisMonth = paymentThisMonth - interestThisMonth;

      monthlyInterest += interestThisMonth;
      monthlyPrincipalRepaid += principalThisMonth;

      // Update outstanding balance per loan
      c.outstandingPerLoan = Math.max(0, c.outstandingPerLoan - (monthlyPaymentPerLoan - c.outstandingPerLoan * monthlyRate));

      totalActiveLoans += c.activeLoans;
      totalOutstanding += c.outstandingPerLoan * c.activeLoans;
    }

    // Origination fees (collected on new loans this month)
    monthlyOriginationFees = newLoans * avgLoanSize * originationFeeRate;

    // Revenue
    const monthlyRevenue = monthlyInterest + monthlyOriginationFees;

    // Costs
    const monthlyCof = totalOutstanding * monthlyCofRate;
    const monthlyProvisions = monthlyDefaults * avgLoanSize * (1 - recoveryRate);
    const monthlyOpex = totalActiveLoans * monthlyServicingPerLoan + newLoans * originationCostPerLoan;

    const monthlyNetIncome = monthlyRevenue - monthlyCof - monthlyProvisions - monthlyOpex - fixedMonthlyCosts;
    cumulativeProfit += monthlyNetIncome;
    cumulativeDefaults += monthlyDefaults;

    projections.push({
      month,
      newLoans,
      activeLoans: Math.round(totalActiveLoans * 100) / 100,
      portfolioOutstanding: Math.round(totalOutstanding),
      totalDisbursed: Math.round(cumulativeDisbursed),
      monthlyInterestRevenue: Math.round(monthlyInterest),
      monthlyOriginationFees: Math.round(monthlyOriginationFees),
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyCof: Math.round(monthlyCof),
      monthlyProvisions: Math.round(monthlyProvisions),
      monthlyOpex: Math.round(monthlyOpex),
      monthlyFixedCosts: fixedMonthlyCosts,
      monthlyNetIncome: Math.round(monthlyNetIncome),
      cumulativeProfit: Math.round(cumulativeProfit),
      cumulativeDisbursed: Math.round(cumulativeDisbursed),
      cumulativeDefaults: Math.round(cumulativeDefaults * 100) / 100,
    });
  }

  // Summary
  const breakEvenMonth = projections.find((p) => p.cumulativeProfit > 0)?.month ?? null;
  const totalRevenue = projections.reduce((s, p) => s + p.monthlyRevenue, 0);
  const totalCosts = projections.reduce(
    (s, p) => s + p.monthlyCof + p.monthlyProvisions + p.monthlyOpex + p.monthlyFixedCosts,
    0
  );
  const peakOutstanding = Math.max(...projections.map((p) => p.portfolioOutstanding));
  const avgOutstanding = projections.reduce((s, p) => s + p.portfolioOutstanding, 0) / projections.length;
  const avgROA = avgOutstanding > 0 ? (cumulativeProfit / projectionMonths * 12) / avgOutstanding : 0;

  return {
    projections,
    breakEvenMonth,
    totalDisbursed: Math.round(cumulativeDisbursed),
    totalRevenue: Math.round(totalRevenue),
    totalCosts: Math.round(totalCosts),
    totalProfit: Math.round(cumulativeProfit),
    peakOutstanding,
    totalDefaults: Math.round(cumulativeDefaults * 100) / 100,
    avgROA,
  };
}

/**
 * Run portfolio projection under a stress scenario.
 */
export function projectWithStress(
  baseParams: PortfolioParams,
  scenario: StressScenario
): PortfolioSummary {
  return projectPortfolio({ ...baseParams, ...scenario.modifiers });
}
