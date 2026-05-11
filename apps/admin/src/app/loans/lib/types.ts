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

  // Advanced Metrics
  irr: number; // internal rate of return (annualized)
  moic: number; // multiple on invested capital (total cash in / cash out)
  spread: number; // loan rate - CoF rate
  nim: number; // net interest margin (net interest / avg outstanding)
  avgOutstanding: number; // weighted avg outstanding over loan life

  // Profitability Ratios
  roe: number; // return on equity (net profit / equity, annualized)
  roa: number; // return on assets (net profit / avg outstanding, annualized)
  portfolioYield: number; // (interest + fees) / avg outstanding, annualized
  oss: number; // operational self-sufficiency: revenue / total costs (>1 = sustainable)

  // Efficiency & Regulatory
  oer: number; // operating expense ratio: opex / avg outstanding
  costPerLoanPct: number; // total costs as % of principal
  cat: number; // Costo Anual Total (all-in annualized cost to borrower, Mexican standard)

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
  avgLoanSize: number;
  avgTermMonths: number;
  avgRate: number; // blended annual rate
  tierMix: { a: number; b: number; c: number; d: number }; // percentages summing to 1
  monthlyOriginationRate: number; // new loans per month
  cofRate: number;
  blendedDefaultRate: number;
  recoveryRate: number;
  originationFeeRate: number;
  originationCostPerLoan: number;
  annualServicingCostPerLoan: number;
  fixedMonthlyCosts: number;
  projectionMonths: number;
}

export interface MonthlyProjection {
  month: number;
  newLoans: number;
  activeLoans: number;
  portfolioOutstanding: number;
  totalDisbursed: number;
  monthlyInterestRevenue: number;
  monthlyOriginationFees: number;
  monthlyRevenue: number;
  monthlyCof: number;
  monthlyProvisions: number;
  monthlyOpex: number;
  monthlyFixedCosts: number;
  monthlyNetIncome: number;
  cumulativeProfit: number;
  cumulativeDisbursed: number;
  cumulativeDefaults: number;
  // Portfolio-level metrics
  par30: number; // portfolio at risk (defaulted / outstanding)
  writeOffRatio: number; // cumulative write-offs / avg portfolio
  collectionRate: number; // cash collected / cash due
  oer: number; // opex / outstanding (annualized)
  imor: number; // indice de morosidad (Mexican standard)
  oss: number; // operational self-sufficiency
  nim: number; // net interest margin
  portfolioYield: number; // revenue / outstanding (annualized)
}

export interface PortfolioSummary {
  projections: MonthlyProjection[];
  breakEvenMonth: number | null;
  totalDisbursed: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  peakOutstanding: number;
  totalDefaults: number;
  avgROA: number;
  // Aggregate metrics
  finalPar30: number;
  finalWriteOffRatio: number;
  avgCollectionRate: number;
  finalOER: number;
  finalOSS: number;
  finalNIM: number;
  finalPortfolioYield: number;
}

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  modifiers: Partial<PortfolioParams>;
}

export const DEFAULT_PORTFOLIO_PARAMS: PortfolioParams = {
  avgLoanSize: 175000,
  avgTermMonths: 24,
  avgRate: 0.30,
  tierMix: { a: 0.20, b: 0.40, c: 0.30, d: 0.10 },
  monthlyOriginationRate: 10,
  cofRate: 0.14,
  blendedDefaultRate: 0.04,
  recoveryRate: 0.30,
  originationFeeRate: 0.02,
  originationCostPerLoan: 1500,
  annualServicingCostPerLoan: 700,
  fixedMonthlyCosts: 200000,
  projectionMonths: 36,
};

export const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: "normal",
    name: "Normal",
    description: "Parametros base sin estres",
    modifiers: {},
  },
  {
    id: "recession",
    name: "Recesion",
    description: "Defaults 2x, originacion -30%",
    modifiers: { blendedDefaultRate: 0.08, monthlyOriginationRate: 7 },
  },
  {
    id: "rate-shock",
    name: "Shock de Tasas",
    description: "CoF +4pp (Banxico sube tasas)",
    modifiers: { cofRate: 0.18 },
  },
  {
    id: "catastrophic",
    name: "Catastrofico",
    description: "2x defaults + CoF +4pp + volumen -40%",
    modifiers: { blendedDefaultRate: 0.08, cofRate: 0.18, monthlyOriginationRate: 6 },
  },
];

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
