// ─── Loan Simulator Types ───

export interface LoanParams {
  principal: number;
  annualRate: number; // e.g. 0.30 for 30%
  termMonths: number;
  originationFeeRate: number; // e.g. 0.02 for 2%
  cofRate: number; // annual cost of funds, e.g. 0.12
  defaultRate: number; // probability of default, e.g. 0.04
  recoveryRate: number; // recovery on defaulted loans, e.g. 0.30
  defaultMonth: number; // average month of default
  originationCost: number; // MXN per loan
  annualServicingCost: number; // MXN per year
  collectionCost: number; // MXN per defaulted loan
}

export interface AmortizationRow {
  month: number;
  startBalance: number;
  interest: number;
  principal: number;
  payment: number;
  endBalance: number;
}

export interface YearSummary {
  year: number;
  totalInterest: number;
  totalPrincipal: number;
  totalPayments: number;
  avgOutstanding: number;
}

export interface CofBreakdown {
  year1: number;
  year2: number;
  year3: number;
  total: number;
}

export interface LoanProfitResult {
  // Revenue
  totalInterest: number;
  originationFee: number;
  grossRevenue: number;

  // Costs
  cofTotal: number;
  cofBreakdown: CofBreakdown;
  provisionAmount: number;
  opExTotal: number;

  totalCosts: number;

  // Profit
  netProfit: number;
  profitMargin: number; // 0-1
  monthlyProfit: number;
  annualizedROI: number; // on principal deployed
  monthlyPayment: number;

  // Amortization
  schedule: AmortizationRow[];
  yearSummaries: YearSummary[];
}

export interface DefaultScenarioResult {
  defaultMonth: number;
  paymentsReceived: number;
  interestEarned: number;
  principalRepaid: number;
  outstandingAtDefault: number;
  recoveryAmount: number;
  cofPaid: number;
  collectionCost: number;
  netResult: number; // positive = still profitable, negative = loss
  originationFee: number;
}

export interface SensitivityCell {
  rate: number;
  cof: number;
  profit: number;
  margin: number;
}

export interface PortfolioParams {
  numLoans: number;
  avgLoanSize: number;
  tierMix: { a: number; b: number; c: number; d: number }; // percentages summing to 1
  monthlyOriginationRate: number;
  fundingSource: "equity" | "angel" | "institutional" | "securitization" | "blended";
  fixedMonthlyCosts: number;
}

export interface MonthlyProjection {
  month: number;
  activeLoans: number;
  portfolioOutstanding: number;
  monthlyRevenue: number;
  monthlyCof: number;
  monthlyProvisions: number;
  monthlyOpex: number;
  monthlyFixedCosts: number;
  monthlyNetIncome: number;
  cumulativeProfit: number;
}

export interface Scenario {
  id: string;
  name: string;
  params: LoanParams;
  result: LoanProfitResult;
}

export type FundingPreset = "equity" | "angel" | "institutional" | "securitization";

export const FUNDING_PRESETS: Record<FundingPreset, { label: string; cofRate: number; description: string }> = {
  equity: { label: "Capital Propio", cofRate: 0.085, description: "Costo de oportunidad ~CETES 8.5%" },
  angel: { label: "Deuda Angel / Family Office", cofRate: 0.16, description: "Inversionista privado 16%" },
  institutional: { label: "Facilidad Institucional", cofRate: 0.12, description: "Fondo o banca de desarrollo 12%" },
  securitization: { label: "Bursatilizacion", cofRate: 0.10, description: "Bonos respaldados por cartera 10%" },
};

export const TIER_PRESETS = {
  a: { label: "Tier A - Premium", rate: 0.24, defaultRate: 0.02, maxAmount: 500000, maxTerm: 36 },
  b: { label: "Tier B - Standard", rate: 0.30, defaultRate: 0.04, maxAmount: 300000, maxTerm: 24 },
  c: { label: "Tier C - Moderate", rate: 0.36, defaultRate: 0.06, maxAmount: 150000, maxTerm: 18 },
  d: { label: "Tier D - High Risk", rate: 0.42, defaultRate: 0.09, maxAmount: 75000, maxTerm: 12 },
};
