// ─── Market Constants (Mexico, May 2026) ───

export const MARKET = {
  banxicoRate: 0.085, // 8.50% target rate (May 2026, expected cut)
  cetes28: 0.0849,
  cetes91: 0.0867,
  inflation: 0.0453, // annual, Q1 2026
  fintechAvgRate: 0.39, // weighted avg fintech lending rate
  ivaRate: 0.16, // 16% IVA
};

export const PARAM_RANGES = {
  principal: { min: 25000, max: 1000000, step: 25000, default: 200000 },
  annualRate: { min: 0.12, max: 0.60, step: 0.01, default: 0.30 },
  termMonths: { min: 6, max: 60, step: 6, default: 24 },
  originationFeeRate: { min: 0, max: 0.05, step: 0.005, default: 0.02 },
  cofRate: { min: 0, max: 0.25, step: 0.005, default: 0.12 },
  defaultRate: { min: 0, max: 0.20, step: 0.005, default: 0.04 },
  recoveryRate: { min: 0, max: 0.80, step: 0.05, default: 0.30 },
  defaultMonth: { min: 3, max: 24, step: 1, default: 10 },
  originationCost: { min: 500, max: 5000, step: 250, default: 1500 },
  annualServicingCost: { min: 200, max: 3000, step: 100, default: 700 },
  collectionCost: { min: 1000, max: 10000, step: 500, default: 4000 },
  doctorMonthlyIncome: { min: 30000, max: 500000, step: 5000, default: 120000 },
  hurdleRate: { min: 0.05, max: 0.40, step: 0.01, default: 0.15 },
  prepaymentMonth: { min: 0, max: 60, step: 1, default: 0 },
  redeploymentMonths: { min: 0, max: 6, step: 1, default: 2 },
};

export const DEFAULT_LOAN_PARAMS = {
  principal: PARAM_RANGES.principal.default,
  annualRate: PARAM_RANGES.annualRate.default,
  termMonths: PARAM_RANGES.termMonths.default,
  originationFeeRate: PARAM_RANGES.originationFeeRate.default,
  cofRate: PARAM_RANGES.cofRate.default,
  defaultRate: PARAM_RANGES.defaultRate.default,
  recoveryRate: PARAM_RANGES.recoveryRate.default,
  defaultMonth: PARAM_RANGES.defaultMonth.default,
  originationCost: PARAM_RANGES.originationCost.default,
  annualServicingCost: PARAM_RANGES.annualServicingCost.default,
  collectionCost: PARAM_RANGES.collectionCost.default,
  doctorMonthlyIncome: PARAM_RANGES.doctorMonthlyIncome.default,
  hurdleRate: PARAM_RANGES.hurdleRate.default,
  prepaymentMonth: PARAM_RANGES.prepaymentMonth.default,
  redeploymentMonths: PARAM_RANGES.redeploymentMonths.default,
};
