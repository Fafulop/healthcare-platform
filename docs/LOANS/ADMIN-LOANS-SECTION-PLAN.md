# Plan: Admin App — Loans Section

> Date: 2026-05-11
> Status: Plan

---

## 1. Overview

Create a new `/loans` section in the admin app (`apps/admin`) with:
- **Interactive loan scenario simulator** — adjust parameters, compare scenarios side-by-side
- **Lending theory reference** — educational content about loan mechanics
- **Competitor research dashboard** — Mexico market players, rates, terms
- **Unit economics calculator** — per-loan and portfolio-level P&L

All client-side only (no database, no API). Pure React state + calculations.

---

## 2. Architecture

```
apps/admin/src/app/loans/
├── page.tsx                          # Main loans hub with tab navigation
├── components/
│   ├── LoansNavTabs.tsx              # Tab navigation for sub-sections
│   │
│   ├── simulator/
│   │   ├── LoanSimulator.tsx         # Main simulator container
│   │   ├── ParameterPanel.tsx        # Sliders/inputs for all parameters
│   │   ├── AmortizationTable.tsx     # Full month-by-month table
│   │   ├── CostWaterfall.tsx         # Visual cost stack (revenue → costs → profit)
│   │   ├── ScenarioComparison.tsx    # Side-by-side scenario cards
│   │   ├── SensitivityMatrix.tsx     # Rate vs CoF matrix
│   │   ├── DefaultScenarios.tsx      # What-if default at month X
│   │   └── PortfolioProjection.tsx   # Scale from 10 to 500 loans
│   │
│   ├── theory/
│   │   ├── LendingTheory.tsx         # Educational content container
│   │   ├── FrenchAmortization.tsx    # How French amortization works (interactive)
│   │   ├── CostOfFundsExplainer.tsx  # What is CoF, why it matters
│   │   ├── RiskScoringBasics.tsx     # PD, LGD, EL explained
│   │   ├── RegulatoryOverview.tsx    # SOFOM vs SA de CV vs Mutuo
│   │   └── Glossary.tsx             # Terms dictionary
│   │
│   ├── competitors/
│   │   ├── CompetitorDashboard.tsx   # Market overview
│   │   ├── CompetitorCard.tsx        # Individual player card
│   │   ├── RateComparison.tsx        # Our rates vs market (chart)
│   │   └── MarketGapAnalysis.tsx     # Where we fit
│   │
│   └── shared/
│       ├── CurrencyFormat.tsx        # MXN formatting utility
│       ├── ChartWrapper.tsx          # Recharts wrapper
│       └── types.ts                  # TypeScript interfaces for loan params
│
├── lib/
│   ├── loan-math.ts                  # All calculation functions (pure math, no UI)
│   ├── amortization.ts              # French amortization generator
│   ├── scenarios.ts                  # Pre-built scenario definitions
│   ├── competitors-data.ts          # Static competitor data
│   └── constants.ts                 # Market rates, defaults, ranges
```

---

## 3. Tab Structure

The `/loans` page has **4 tabs**:

| Tab | Name | Description |
|-----|------|-------------|
| 1 | **Simulador** | Interactive loan calculator with parameter sliders |
| 2 | **Portfolio** | Scale projections, break-even analysis, multi-loan modeling |
| 3 | **Teoría** | Educational content about lending mechanics |
| 4 | **Competencia** | Mexico market players, comparison charts |

---

## 4. Tab 1: Simulador — Detailed Spec

### 4.1 Parameter Panel (Left Side)

All adjustable via sliders + number inputs:

**Loan Parameters:**
| Parameter | Range | Default | Step |
|-----------|-------|---------|------|
| Loan amount (MXN) | $25,000 – $1,000,000 | $200,000 | $25,000 |
| Annual interest rate | 12% – 60% | 30% | 1% |
| Term (months) | 6 – 60 | 24 | 6 |
| Origination fee | 0% – 5% | 2% | 0.5% |

**Cost of Funds:**
| Parameter | Range | Default | Step |
|-----------|-------|---------|------|
| Funding source preset | Equity / Angel / Institutional / Securitization | Institutional | — |
| CoF rate (annual) | 0% – 25% | 12% | 0.5% |

**Risk Parameters:**
| Parameter | Range | Default | Step |
|-----------|-------|---------|------|
| Default rate (PD) | 0% – 20% | 4% | 0.5% |
| Recovery rate (LGD inverse) | 0% – 80% | 30% | 5% |
| Default timing (avg month) | 3 – term | 10 | 1 |

**Operating Costs:**
| Parameter | Range | Default | Step |
|-----------|-------|---------|------|
| Origination cost (MXN) | $500 – $5,000 | $1,500 | $250 |
| Annual servicing cost | $200 – $3,000 | $700 | $100 |
| Collection cost (defaulted) | $1,000 – $10,000 | $4,000 | $500 |

### 4.2 Results Panel (Right Side)

**Summary Cards (top):**
- Monthly payment (doctor pays)
- Total interest earned
- Net profit per loan
- Profit margin %
- Annualized ROI

**Amortization Table:**
- Full month-by-month breakdown (expandable/collapsible)
- Columns: Month, Start Balance, Interest, Principal, Payment, End Balance
- Highlighted: Year 1 subtotal, Year 2 subtotal
- Color-coded: interest portion (red) vs principal (green)

**Cost Waterfall Chart:**
- Stacked horizontal bar showing: Gross Revenue → CoF → Provisions → OpEx → Net Profit
- Visual representation of where the money goes

**Cash Flow Timeline:**
- Line chart showing monthly: money received from doctor vs money paid to funder
- Cumulative profit line overlay

### 4.3 Scenario Comparison Mode

- Button: "Save as Scenario" — saves current params as Scenario A, B, C (up to 4)
- Side-by-side cards showing key metrics for each saved scenario
- Highlight differences in green/red
- "Compare" table with all parameters and results aligned

### 4.4 Sensitivity Matrix

- 2D grid: rows = CoF rates (8%–20%), columns = Interest rates charged (24%–42%)
- Each cell shows net profit per loan
- Color gradient: green (high profit) → yellow → red (low/negative)
- Click any cell to load those params into the simulator

### 4.5 Default Impact Panel

- Interactive: "What if the doctor defaults at month X?"
- Slider: default month (1 – term)
- Shows: payments received, outstanding balance, recovery amount, total P&L
- Chart: profit/loss curve across all possible default months
- Line showing break-even month (after which even defaults are profitable)

---

## 5. Tab 2: Portfolio — Detailed Spec

### 5.1 Portfolio Builder

| Parameter | Range | Default |
|-----------|-------|---------|
| Number of loans | 5 – 1,000 | 100 |
| Average loan size | $50K – $500K | $175K |
| Tier mix (A/B/C/D %) | 4 sliders summing to 100% | 20/40/30/10 |
| Monthly origination rate | 5 – 50 new loans/month | 15 |
| Funding source | Equity / Angel / Institutional / Blended | Blended |
| Fixed monthly costs | $50K – $500K | $200K |

### 5.2 Portfolio Outputs

**Summary:**
- Total portfolio value (outstanding)
- Monthly gross revenue
- Monthly net income
- Break-even month (when cumulative profit > 0)
- Break-even # of loans

**Projections Chart (36 months):**
- Lines: portfolio size growth, cumulative revenue, cumulative profit
- Shaded area: break-even zone
- Monthly bars: new originations

**P&L Table by Year:**
- Year 1, 2, 3 P&L with all line items
- Revenue, CoF, provisions, OpEx, fixed costs, net income

**Tier Breakdown:**
- Pie chart: portfolio composition by tier
- Table: contribution per tier (revenue, profit, default cost)

### 5.3 Stress Testing

- Buttons: "Normal", "Recession (2x defaults)", "Rate Shock (+4pp CoF)", "Catastrophic (both + volume drop)"
- Each recalculates the portfolio with stressed params
- Side-by-side comparison of scenarios

---

## 6. Tab 3: Teoría — Detailed Spec

Interactive educational content, each section expandable/collapsible:

### 6.1 Sections

1. **French Amortization Explained**
   - Interactive mini-calculator showing how payment splits between interest/principal
   - Animated bar chart that updates as you change rate/term
   - Comparison: French vs flat-rate vs bullet payment

2. **Cost of Funds**
   - What it is, why it's the #1 cost
   - Visual: funding source ladder (CETES → equity → angel → institutional → securitization)
   - How CoF changes with scale and track record
   - Current Mexico rates (CETES, Banxico reference)

3. **Credit Risk Fundamentals**
   - PD (Probability of Default) — what drives it
   - LGD (Loss Given Default) — recovery expectations
   - EL (Expected Loss) = PD × LGD — the provision formula
   - How in-app data improves PD estimation

4. **Regulatory Paths in Mexico**
   - Infographic: Contrato de Mutuo → SA de CV → SOFOM ENR → Bank
   - Each card: setup time, cost, capabilities, limitations
   - Decision tree: "Which structure do you need?"

5. **Key Metrics**
   - NIM, ROA, ROE, IMOR, PAR30, CAT explained
   - How they relate to each other
   - Benchmark values for Mexico

6. **Glossary**
   - Searchable terms dictionary
   - Spanish + English terms
   - Cross-linked to relevant sections

---

## 7. Tab 4: Competencia — Detailed Spec

### 7.1 Market Map

Visual grid showing all players by type:

| Category | Players |
|----------|---------|
| Doctor-specific bank products | Inbursa Crédito Express Médicos, Inbursa Enlace Médico |
| Generic bank personal loans | BBVA, Scotiabank, Banorte, Santander |
| Fintech SME lending | Konfío, Credijusto/Covalto, Creze |
| P2P lending | Yotepresto |
| Nómina sector salud | Credifiel |
| Patient financing (complementary) | Mend, Alivio Capital, Red Médica Pro |
| **Us** | Doctor-specific fintech with in-app data |

### 7.2 Competitor Cards

Each player gets a card with:
- Logo + name
- Product type
- Rate range
- Amount range
- Term range
- Requirements
- Our advantage over them

### 7.3 Rate Comparison Chart

- Horizontal bar chart: all players sorted by rate range (min–max)
- Our position highlighted
- Filtered by: loan amount, term, doctor profile

### 7.4 Market Gap Analysis

- 2×2 matrix: (Doctor-specific vs Generic) × (Digital-first vs Traditional)
- Shows where each player sits
- Our position: Doctor-specific + Digital-first (empty quadrant)

### 7.5 Competitive Advantages Table

| Advantage | Us | Inbursa | BBVA | Konfío |
|-----------|-----|---------|------|--------|
| Doctor-specific | Yes | Yes | No | No |
| In-app risk data | Yes | No | No | No |
| Digital application | Yes | No | Yes | Yes |
| Bureau-free pre-screening | Yes | No | No | No |
| Revenue-based advance option | Yes | No | No | No |
| Integrated with practice mgmt | Yes | No | No | No |
| Zero CAC | Yes | No | No | No |

---

## 8. Tech Stack & Dependencies

### New Dependencies Needed

```json
{
  "recharts": "^2.x",        // Charts (already used in analytics?)
  "lucide-react": "existing", // Icons (already installed)
  "tailwindcss": "existing"   // Styling (already installed)
}
```

Check if `recharts` is already installed in the admin app. If not, add it. No other new deps needed — all calculations are pure TypeScript math functions.

### Key Design Decisions

1. **No database** — all data is static constants + real-time calculations
2. **No API routes** — everything runs client-side
3. **Pure functions for math** — `lib/loan-math.ts` and `lib/amortization.ts` are testable, framework-agnostic
4. **URL state** — persist simulator params in URL searchParams so scenarios are shareable
5. **Responsive** — works on desktop (primary) but doesn't break on tablet

---

## 9. Implementation Order

### Phase 1: Core Math + Simulator (Priority)

| # | Task | Files | Estimate |
|---|------|-------|----------|
| 1 | Create loan math library | `lib/loan-math.ts`, `lib/amortization.ts`, `lib/constants.ts` | Core |
| 2 | Create types | `components/shared/types.ts` | Core |
| 3 | Build parameter panel | `ParameterPanel.tsx` | UI |
| 4 | Build amortization table | `AmortizationTable.tsx` | UI |
| 5 | Build cost waterfall chart | `CostWaterfall.tsx` | UI |
| 6 | Build summary cards | Part of `LoanSimulator.tsx` | UI |
| 7 | Wire up main simulator page | `LoanSimulator.tsx` | Integration |
| 8 | Add tab navigation + `/loans` route | `page.tsx`, `LoansNavTabs.tsx` | Routing |
| 9 | Add to Navbar + Dashboard | `Navbar.tsx`, `dashboard/page.tsx` | Nav |

### Phase 2: Comparison + Advanced Simulator

| # | Task | Files |
|---|------|-------|
| 10 | Scenario save/compare | `ScenarioComparison.tsx` |
| 11 | Sensitivity matrix | `SensitivityMatrix.tsx` |
| 12 | Default impact panel | `DefaultScenarios.tsx` |
| 13 | Cash flow timeline chart | Part of `LoanSimulator.tsx` |

### Phase 3: Portfolio Tab

| # | Task | Files |
|---|------|-------|
| 14 | Portfolio builder params | `PortfolioProjection.tsx` |
| 15 | Portfolio projection chart (36mo) | `PortfolioProjection.tsx` |
| 16 | Stress test scenarios | `PortfolioProjection.tsx` |
| 17 | Break-even calculator | `PortfolioProjection.tsx` |

### Phase 4: Theory + Competitors

| # | Task | Files |
|---|------|-------|
| 18 | Theory sections (content) | `theory/*.tsx` |
| 19 | Interactive amortization explainer | `FrenchAmortization.tsx` |
| 20 | Competitor data + cards | `competitors-data.ts`, `CompetitorCard.tsx` |
| 21 | Rate comparison chart | `RateComparison.tsx` |
| 22 | Market gap analysis visual | `MarketGapAnalysis.tsx` |

---

## 10. `lib/loan-math.ts` — Core Functions Spec

```typescript
// All pure functions, no side effects

// French amortization schedule
generateAmortization(principal, annualRate, termMonths): AmortizationRow[]

// Monthly payment (French)
calculateMonthlyPayment(principal, annualRate, termMonths): number

// Total interest over loan life
calculateTotalInterest(principal, annualRate, termMonths): number

// Average outstanding balance per year
calculateAvgOutstanding(schedule: AmortizationRow[]): { year1: number, year2: number, overall: number }

// Cost of funds for a given loan
calculateCoF(avgOutstanding, cofRate, termYears): { year1: number, year2: number, total: number }

// Expected loss
calculateExpectedLoss(principal, defaultRate, recoveryRate): number

// Provision amount
calculateProvision(principal, defaultRate, lgd): number

// Operating expenses
calculateOpEx(originationCost, annualServicing, termYears): number

// Net profit per loan
calculateLoanProfit(params: LoanParams): LoanProfitResult

// Default scenario at month X
calculateDefaultAtMonth(schedule, month, recoveryRate, cofRate, collectionCost): DefaultResult

// Sensitivity matrix
generateSensitivityMatrix(baseParams, rateRange, cofRange): number[][]

// Portfolio projection over N months
projectPortfolio(params: PortfolioParams): MonthlyProjection[]

// CAT calculation (simplified)
calculateCAT(principal, monthlyPayment, termMonths, originationFee): number

// Break-even analysis
calculateBreakEven(fixedMonthlyCosts, profitPerLoan, originationRate): number
```

---

## 11. Navigation Integration

### Navbar.tsx — Add Link

```tsx
<Link href="/loans" className="text-gray-700 hover:text-blue-600 font-medium transition">
  Préstamos
</Link>
```

### Dashboard — Add Card

```tsx
<Link href="/loans" className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-amber-600 to-orange-600 ...">
  <Banknote className="w-5 h-5" />
  Préstamos — Simulador
</Link>
```
