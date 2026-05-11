# Yield & Economics Model — Doctor Loan Product

> Research date: 2026-05-11
> Status: Initial Investigation
> Depends on: [LOAN-STRUCTURE-MEXICO-RESEARCH.md](./LOAN-STRUCTURE-MEXICO-RESEARCH.md), [RISK-PROFILE-RESEARCH.md](./RISK-PROFILE-RESEARCH.md)

---

## 1. Key Economic Parameters (May 2026)

| Parameter | Value | Source |
|-----------|-------|--------|
| **Banxico target rate** | 8.50% (expected cut to 8.25%) | Banxico May 2026 |
| **CETES 28 days** | ~8.50% | Banxico/CETES Directo |
| **CETES 91 days** | ~8.67% | Banxico/CETES Directo |
| **Inflation (annual)** | ~4.53% | INEGI Q1 2026 |
| **Banxico target inflation** | 3% ± 1pp | Banxico mandate |
| **SOFOM avg lending rate (fintech)** | ~39% annual (weighted avg) | CNBV/Fintech benchmarks |

> **Note on rates:** Banxico has been in a cutting cycle since late 2024. As of May 2026, the reference rate is at ~8.50% (down from 11.25% peak). CETES at 28 days yield ~8.49%, 91 days ~8.67%. Further cuts expected if inflation converges toward 3%.

---

## 2. Loan Pricing Waterfall

This is how we build the interest rate charged to the doctor, from cost of capital up to target return.

### 2.1 Cost Stack Per Loan

| Component | % of Portfolio (Annual) | Notes |
|-----------|------------------------|-------|
| **Cost of Funds (CoF)** | 12% – 18% | See section 3 for funding sources |
| **Provision for Credit Losses (PCL)** | 3% – 6% | Expected loss based on default rate × LGD |
| **Operating Expenses (OpEx)** | 5% – 8% | Origination, servicing, tech, collections |
| **Origination Fee Credit** | (1% – 2%) | Offsets some OpEx (amortized) |
| **Target Return on Capital** | 5% – 8% | Pre-tax profit margin |
| **= Required Gross Yield** | **24% – 38%** | Interest rate charged to borrower |

### 2.2 Pricing by Risk Tier

| Tier | Rate Charged | CoF | PCL | OpEx | Origination Fee | Net Spread | Pre-Tax ROA |
|------|-------------|-----|-----|------|----------------|------------|-------------|
| **A — Premium** | 24% | 14% | 2% | 5% | 2% | 5% | ~5% |
| **B — Standard** | 30% | 14% | 4% | 5% | 2% | 9% | ~7% |
| **C — Moderate** | 36% | 14% | 6% | 6% | 2% | 12% | ~8% |
| **D — High Risk** | 42% | 14% | 9% | 7% | 2% | 14% | ~7% (higher default offsets) |

*Net Spread = Rate Charged - CoF - PCL - OpEx + Origination Fee*

---

## 3. Cost of Funds — Funding Sources

Since a new SOFOM (or SA de CV) cannot take deposits, capital must come from:

### 3.1 Funding Options (Ranked by Cost)

| Source | Estimated Cost | Availability | Min Commitment | Notes |
|--------|---------------|--------------|---------------|-------|
| **Founder/equity capital** | 0% explicit (but high opportunity cost) | Immediate | — | Bootstrapping phase; implicit cost = CETES + risk premium (~15%) |
| **Family office / angel debt** | 12% – 16% | Moderate | $5M – $20M MXN | Personal relationships, flexible terms |
| **Credit line from bank** | 14% – 20% | Hard for new SOFOM | $10M+ MXN | Banks want 12+ months track record |
| **Institutional debt facility** | 12% – 18% | Medium-term (6-12 months track record) | $20M+ MXN | Fondos de inversión, family offices, DFIs |
| **Securitization (bursatilización)** | 10% – 14% | Long-term (24+ months, $100M+ portfolio) | $50M+ MXN | Cheapest at scale, requires credit rating |
| **P2P / crowdfunding** | 14% – 20% | Via IFT license (Fintech Law) | Variable | Complex regulatory path |
| **Development bank lines (Nafin, FND)** | 8% – 12% | Medium-term | Varies | Government programs; favorable but slow |

### 3.2 Recommended Funding Strategy by Phase

| Phase | Source | Estimated CoF | Portfolio Size |
|-------|--------|--------------|----------------|
| **Pilot (0-6 months)** | Equity / founder capital | ~15% (opportunity cost) | $1M – $5M MXN |
| **Growth (6-18 months)** | Family office debt + bank line | 14% – 16% | $5M – $30M MXN |
| **Scale (18-36 months)** | Institutional facility + Nafin | 12% – 14% | $30M – $100M MXN |
| **Mature (36+ months)** | Securitization + multi-source | 10% – 13% | $100M+ MXN |

---

## 4. Credit Loss Expectations

### 4.1 Default Rate Benchmarks (Mexico)

| Segment | IMOR (Delinquency Index) | Source |
|---------|--------------------------|--------|
| Banking sector — personal loans | ~4.5% | CNBV 2025 |
| Banking sector — credit cards | ~3.2% | CNBV 2025 |
| SOFOMes (large, >$1B portfolio) | ~3.2% median | ASOFOM benchmark |
| Fintech consumer (Klar, Nu) | 10% – 30%+ | Public reports |
| SOFIPO sector average | ~10.3% | CNBV 2025 |
| **Our target (doctors)** | **3% – 6%** | Estimated (see below) |

### 4.2 Why We Expect Lower Default Rates

Doctors are a **prime professional segment** with characteristics that reduce credit risk:

1. **High education** — 8+ years of university, residency, fellowship
2. **Stable income** — healthcare demand is inelastic; recessions don't eliminate patients
3. **Professional reputation at stake** — default damages their career and social standing
4. **Multiple income sources** — many have private practice + hospital/institutional salary
5. **In-app monitoring** — we detect distress signals early (declining bookings, revenue)
6. **Verified professional credentials** — cédula profesional required

### 4.3 Expected Loss Calculation

| Parameter | Conservative | Base Case | Optimistic |
|-----------|-------------|-----------|------------|
| **Probability of Default (PD)** | 6% | 4% | 2.5% |
| **Loss Given Default (LGD)** | 70% | 60% | 50% |
| **Expected Loss (EL = PD × LGD)** | **4.2%** | **2.4%** | **1.25%** |
| **PCL provision (buffer over EL)** | 6% | 4% | 2% |

*LGD assumes unsecured lending with pagaré. Recovery through legal collection is possible but slow (Mexico courts average 12-18 months for mercantile claims).*

---

## 5. Operating Expenses Breakdown

### 5.1 Cost per Loan (Estimated)

| Expense | Per Loan (MXN) | As % of $200K Avg Loan | Notes |
|---------|---------------|----------------------|-------|
| **Círculo de Crédito API call** | $50 – $150 | 0.05% – 0.08% | Per-query fee for FICO + report |
| **Identity verification (INE)** | $20 – $50 | 0.01% – 0.03% | KYC/AML compliance |
| **Origination processing** | $500 – $1,000 | 0.25% – 0.50% | Staff time, document review |
| **Tech/platform cost** | $200 – $500 | 0.10% – 0.25% | Server, integration maintenance |
| **Payment processing (SPEI)** | $5 – $20 | 0.003% – 0.01% | Disbursement + collections |
| **Collections (performing)** | $100 – $300/year | 0.05% – 0.15% | Automated reminders, monitoring |
| **Collections (delinquent)** | $2,000 – $5,000 | 1% – 2.5% | Only for defaulted loans; call center, legal |
| **Legal/compliance overhead** | $300 – $500 | 0.15% – 0.25% | CONDUSEF reporting, contract generation |
| **Total per performing loan** | ~$1,200 – $2,500 | **0.6% – 1.25%** | Origination year |
| **Annual servicing (year 2+)** | ~$500 – $1,000 | **0.25% – 0.50%** | Ongoing |

### 5.2 Portfolio-Level Operating Expense Ratio

| Phase | OpEx as % of Portfolio | Target |
|-------|----------------------|--------|
| Year 1 (pilot, low volume) | 10% – 15% | High fixed costs, low scale |
| Year 2 (growth) | 6% – 8% | Scale benefits kick in |
| Year 3+ (mature) | 4% – 5% | Automation, volume efficiencies |

---

## 6. Unit Economics — Single Loan Example

### Scenario: Tier B Loan, $200,000 MXN, 24 months, 30% annual

#### Revenue Side

```
Loan Amount:               $200,000 MXN
Interest Rate:             30% annual (fixed)
Term:                      24 months
Monthly Payment (French):  $11,150 MXN (approx)
Total Payments:            $267,600 MXN
Total Interest Earned:     $67,600 MXN
Origination Fee (2%+IVA):  $4,640 MXN (2% × $200K × 1.16)
─────────────────────────────────────
Gross Revenue per Loan:    $72,240 MXN
```

#### Cost Side

```
Cost of Funds (14% × 2yr avg outstanding):
  Average outstanding balance ≈ $108,000
  CoF = $108,000 × 14% × 2 =    $30,240 MXN

Provision for Credit Losses:
  4% × $200,000 =                $8,000 MXN

Operating Expenses:
  Origination:                    $1,500 MXN
  Annual servicing ($700 × 2yr):  $1,400 MXN
  Total OpEx:                     $2,900 MXN
─────────────────────────────────────
Total Cost per Loan:              $41,140 MXN
```

#### Net Economics

```
Gross Revenue:           $72,240
Total Cost:             -$41,140
─────────────────────────
Pre-Tax Profit per Loan: $31,100 MXN
Pre-Tax ROA:             ~15.6% (on $200K)
Pre-Tax Margin:          ~43%
```

### Sensitivity Analysis

| Variable | Base | Pessimistic | Optimistic |
|----------|------|------------|------------|
| Default rate | 4% | 8% | 2% |
| CoF | 14% | 18% | 10% |
| OpEx | $2,900 | $4,500 | $2,000 |
| **Pre-tax profit** | **$31,100** | **$17,500** | **$42,200** |
| **Pre-tax ROA** | **15.6%** | **8.8%** | **21.1%** |

---

## 7. Portfolio Economics — Scaling Scenarios

### 7.1 Year 1 (Pilot) — 50 Loans

```
Average loan size:         $150,000 MXN
Total disbursed:           $7,500,000 MXN ($7.5M)
Gross yield (blended):     30%
CoF:                       15% (equity/angels)
PCL:                       5%
OpEx ratio:                10%
Net margin:                0% (breakeven target)
Origination fees:          $174,000

Capital needed:            $7.5M MXN (~$420K USD)
Expected losses:           $375,000 MXN
```

### 7.2 Year 2 (Growth) — 200 Loans (cumulative active ~220)

```
New disbursements:         $40,000,000 MXN ($40M)
Outstanding portfolio:     ~$35,000,000 MXN
Gross yield (blended):     30%
CoF:                       14% (debt facility)
PCL:                       4%
OpEx ratio:                7%
Net margin:                ~5%
Annual net income:         ~$1,750,000 MXN

Capital needed:            ~$35M MXN ($2M USD) in credit facility
Expected losses:           $1,400,000 MXN
```

### 7.3 Year 3 (Scale) — 500+ Loans (cumulative active ~550)

```
Outstanding portfolio:     ~$100,000,000 MXN ($100M)
Gross yield (blended):     29% (more Tier A as portfolio seasons)
CoF:                       12% (institutional + Nafin)
PCL:                       3.5%
OpEx ratio:                5%
Net margin:                ~8.5%
Annual net income:         ~$8,500,000 MXN (~$475K USD)

Capital needed:            ~$100M MXN in multi-source funding
Expected losses:           $3,500,000 MXN
```

---

## 8. Key Performance Indicators (KPIs)

### 8.1 Portfolio Health

| KPI | Definition | Target |
|-----|-----------|--------|
| **IMOR (Delinquency Index)** | Cartera vencida / Cartera total | < 5% |
| **IMOR 30+** | Loans 30+ days past due / Total | < 8% |
| **IMOR 90+** | Loans 90+ days past due / Total | < 3% |
| **Net Charge-Off Rate** | Defaults written off (net of recovery) / Avg portfolio | < 4% |
| **Recovery Rate** | Amount recovered from defaulted loans / Total defaulted | > 30% |
| **Portfolio at Risk (PAR 30)** | Outstanding balance of 30+ DPD loans / Total portfolio | < 10% |

### 8.2 Profitability

| KPI | Definition | Target |
|-----|-----------|--------|
| **Net Interest Margin (NIM)** | (Interest income - Interest expense) / Avg portfolio | > 14% |
| **Operating Expense Ratio** | Operating expenses / Avg portfolio | < 6% (Year 2+) |
| **Return on Assets (ROA)** | Net income / Avg portfolio | > 5% |
| **Return on Equity (ROE)** | Net income / Equity invested | > 20% |
| **Cost-to-Income Ratio** | OpEx / (Interest income + Fee income) | < 40% |

### 8.3 Growth & Efficiency

| KPI | Definition | Target |
|-----|-----------|--------|
| **Monthly disbursement volume** | New loans originated per month | Growing MoM |
| **Average loan size** | Total disbursed / Number of loans | $150K – $250K MXN |
| **Approval rate** | Approved / Applications received | 40% – 60% |
| **Time to disburse** | Application to money-in-account | < 48h (Phase 1), < 4h (Phase 3) |
| **Customer Acquisition Cost (CAC)** | $0 (already on platform) | Near-zero |
| **Repeat borrowing rate** | Doctors who take 2nd loan | > 30% at 18 months |

---

## 9. CAT (Costo Anual Total) Disclosure

Mexican law requires disclosure of the **CAT** — the all-in annual cost including rate, fees, insurance, and commissions.

### CAT Calculation (Simplified)

For a Tier B loan ($200K, 30% annual, 2% origination fee, 24 months):

```
CAT ≈ Interest Rate + Annualized Fees
    ≈ 30% + (2% / 2 years) + insurance (if any)
    ≈ 31% – 33% annual (sin IVA)
```

The exact CAT must be calculated using Banxico's official methodology (Circular 21/2009). The formula considers all cash flows (disbursement, payments, fees) to compute the effective annual cost.

**Competitive comparison:**
- Inbursa Crédito Express Médicos: CAT not publicly disclosed
- BBVA personal loans: CAT 35% – 55%
- Yotepresto: CAT 12% – 50%
- Kueski: CAT 100%+

Our target CAT of **31% – 45%** (depending on tier) is competitive for unsecured professional lending.

---

## 10. Revenue Diversification Opportunities

Beyond pure lending interest:

| Revenue Stream | Estimated Contribution | Timeline |
|----------------|----------------------|----------|
| **Origination fees** | 2% per loan | Day 1 |
| **Late payment fees** | IVA-inclusive penalty on overdue | Day 1 |
| **Loan insurance (vida/invalidez)** | Commission from insurer, ~0.5-1% of loan | Phase 2 |
| **Cross-sell: patient financing** | Refer doctor's patients to Mend/Alivio-like product | Phase 2 |
| **Cross-sell: equipment leasing** | Higher-ticket, asset-backed (lower risk) | Phase 3 |
| **Data insights** | Aggregate practice benchmarks (anonymized) | Phase 3 |

---

## 11. Break-Even Analysis

### When Does the Lending Business Break Even?

**Key assumptions:**
- Average loan: $175,000 MXN
- Blended yield: 30%
- CoF: 14%
- PCL: 4%
- Fixed costs (team, legal, compliance): ~$200,000 MXN/month

```
Contribution margin per loan (annual):
  NIM: 30% - 14% = 16%
  Less PCL: -4%
  Less variable OpEx: -2%
  = 10% net contribution on avg outstanding

Average outstanding per loan: ~$95,000 MXN
Annual contribution per loan: $95,000 × 10% = $9,500 MXN

Loans needed to cover $200K/month fixed costs:
  $200,000 × 12 / $9,500 = ~253 active performing loans

At $175K avg loan size = ~$44M MXN portfolio
```

**Break-even: ~250 active loans / ~$44M portfolio** — achievable in Month 14-18 at moderate growth.

---

## 12. Risk Scenarios

### Stress Test: What If Default Rate Doubles?

```
Base case EL:    4% × $100M = $4M MXN loss
Stress case EL:  8% × $100M = $8M MXN loss
Additional loss: $4M MXN

Impact on annual P&L:
  Base net income: $8.5M
  Less additional loss: -$4M
  Stressed net income: $4.5M (still profitable)
```

### Stress Test: CoF Increases 400bps (Banxico hikes)

```
Base CoF:    12% × $100M = $12M
Stress CoF:  16% × $100M = $16M
Additional cost: $4M MXN

Stressed net income: $8.5M - $4M = $4.5M (still profitable)
```

### Catastrophic Scenario: Both Stresses + Volume Drop 30%

```
Portfolio: $70M (down from $100M)
Yield: $70M × 29% = $20.3M
CoF: $70M × 16% = -$11.2M
PCL: $70M × 8% = -$5.6M
OpEx: $70M × 6% = -$4.2M
Net: -$0.7M (small loss, but survivable)
```

Conclusion: The model is **resilient** even under severe stress, mainly because the NIM spread (15-17pp) provides a thick buffer.

---

## 13. Next Steps

- [ ] **Legal Entity Research** — SOFOM ENR vs SA de CV, setup process, costs, timeline
- [ ] **Financial Model Spreadsheet** — Build interactive Excel/Sheets model with scenarios
- [ ] **Círculo de Crédito Commercial Contact** — Get API pricing and commercial terms
- [ ] **Pilot Design** — Select 20-30 doctors for beta, define criteria
- [ ] **Regulatory Checklist** — CONDUSEF registration, CAT calculation, contract templates

---

## Sources

- [Banxico — Tasas de Interés (SIE)](https://www.banxico.org.mx/SieInternet/consultarDirectorioInternetAction.do?accion=consultarCuadro&idCuadro=CF107&sector=22&locale=es)
- [CETES Directo — Valores Gubernamentales](https://www.cetesdirecto.com/tablas/valores_gubernamentales/cetes.html)
- [CETES.app — Rendimientos Mayo 2026](https://cetes.app/educacion/rendimiento-cetes-2026-tasas-actuales)
- [Expansion — Banxico Recorta Tasa, Cae Rendimiento CETES](https://expansion.mx/economia/2026/03/31/caen-rendimientos-de-cetes-banxico)
- [ASOFOM — Benchmark 2025](https://asofom.mx/benchmark-2026/)
- [SOFOMES.com — Mejores SOFOMes México 2026](https://sofomes.com/mejores-sofomes-mexico-2025)
- [EGADE — Crédito se Enfría, Morosidad se Contiene](https://egade.tec.mx/es/egade-ideas/opinion/el-credito-se-enfria-pero-la-morosidad-se-contiene-senales-para-tu-negocio)
- [Banxico — Reporte de Estabilidad Financiera H1 2025](https://www.banxico.org.mx/publicaciones-y-prensa/reportes-sobre-el-sistema-financiero/%7B68ACFA8B-B604-BD70-1808-735C03A155ED%7D.pdf)
- [Financial Models Lab — Fintech KPIs: NIM, NPL, CoF](https://financialmodelslab.com/blogs/kpi-metrics/fintech)
- [Codepole — Unit Economics of Lending](https://www.codepole.com/blog/unit-economics-of-lending-how-tech-can-improve-them-part-2-3)
- [Chambers — Fintech 2025 Mexico](https://practiceguides.chambers.com/practice-guides/fintech-2025/mexico/trends-and-developments)
- [Stripe — Guide to Fintech Lending](https://stripe.com/resources/more/fintech-lending-101-the-benefits-and-challenges-of-this-new-lending-model)
- [La Verdad — CETES 2026 Tasa y Tu Dinero](https://laverdadnoticias.com/dinero-inteligente/inversiones/cetes-2026-tasa)
- [Margin.mx — Las SOFOMes Más Grandes de México](https://www.margin.mx/p/las-sofomes-mas-grandes-de-mexico)
