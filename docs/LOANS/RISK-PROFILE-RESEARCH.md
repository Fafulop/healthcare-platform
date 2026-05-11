# Risk Profile Research — Scoring Model for Doctor Loans

> Research date: 2026-05-11
> Status: Initial Investigation
> Depends on: [LOAN-STRUCTURE-MEXICO-RESEARCH.md](./LOAN-STRUCTURE-MEXICO-RESEARCH.md)

---

## 1. Risk Scoring Philosophy

Our key advantage is **dual-source scoring**: combining traditional bureau data with proprietary in-app behavioral data that no other lender in Mexico has access to. This gives us:

1. **Better risk assessment** — we see real practice economics, not just credit history
2. **Faster underwriting** — much of the data is already in-app, no document collection needed
3. **Earlier signals of default risk** — declining appointment volume or revenue trends are leading indicators

---

## 2. Credit Bureau Integration (External Data)

### 2.1 Available Bureaus in Mexico

| Bureau | Founded | Coverage | Preferred By | Score Range |
|--------|---------|----------|-------------|-------------|
| **Buró de Crédito** | 1996 | ~27M personas físicas, 48M créditos | Banks, traditional lenders | 356 – 848 (recalibrated late 2025) |
| **Círculo de Crédito** | 2005 | ~75M+ records | Fintechs, modern lenders | 300 – 850 (FICO Score 4) |

**Recommendation:** Use **Círculo de Crédito** — preferred by fintechs, has a developer-friendly API Hub, and uses FICO Score 4.

### 2.2 Círculo de Crédito API Products

Available at [developer.circulodecredito.com.mx](https://developer.circulodecredito.com.mx):

| Product | What It Returns | Use Case |
|---------|----------------|----------|
| **Reporte de Crédito + FICO Score PF** | Full credit report + FICO score | Primary underwriting |
| **Reporte Consolidado + FICO Score PF** | Consolidated report from both SICs | Comprehensive view |
| **RCC + FICO + PLD Check PF** | Above + anti-money laundering screening | Regulatory compliance |
| **FICO Score standalone** | Score only (no report detail) | Quick pre-screening |

Client libraries: Java, PHP. REST API also available.
Pricing: Not public — requires commercial agreement with Círculo de Crédito.

### 2.3 Bureau Score Interpretation

**Buró de Crédito (new 4-color scale, late 2025):**

| Range | Color | Meaning | Lending Decision |
|-------|-------|---------|-----------------|
| 356 – 380 | Rojo | High risk | Decline |
| 380 – 470 | Naranja | Moderate risk | Decline or high-rate tier |
| 470 – 550 | Amarillo | Acceptable | Standard tier |
| 550 – 848 | Verde | Low risk | Best rate tier |

**Círculo de Crédito (FICO Score):**

| Range | Level | Meaning | Lending Decision |
|-------|-------|---------|-----------------|
| 300 – 460 | Rojo | High risk | Decline |
| 460 – 600 | Amarillo | Moderate | Decline or high-rate tier |
| 600 – 620 | Verde claro | Good | Standard tier |
| 620 – 850 | Verde | Excellent | Best rate tier |

### 2.4 Bureau Data Points for Our Model

From the credit report, extract:
- **FICO Score** — primary external risk signal
- **Number of open accounts** — credit utilization context
- **Max delinquency (last 12/24 months)** — payment behavior
- **Total outstanding debt** — leverage/capacity
- **Credit age** — time since first account opened
- **Recent inquiries** — credit-seeking behavior (too many = risk)
- **Public records** — bankruptcies, judgments

---

## 3. In-App Data (Internal/Proprietary Data)

This is our **competitive moat**. We have real-time operational data on each doctor's practice.

### 3.1 Available Data Points from Our Schema

#### A. Practice Activity (from `Booking`, `AppointmentSlot`)

| Signal | Source | Risk Indicator |
|--------|--------|---------------|
| **Monthly booking count** | `Booking` (status = CONFIRMED) | Volume = revenue proxy |
| **Booking trend (3/6/12 months)** | `Booking` time series | Growing = low risk, declining = warning |
| **No-show / cancellation rate** | `Booking` (CANCELLED / NO_SHOW vs total) | High cancellation = unstable practice |
| **Slot utilization rate** | `AppointmentSlot.currentBookings / maxBookings` | High utilization = healthy demand |
| **Average appointment price** | `AppointmentSlot.finalPrice` or `Booking.finalPrice` | Revenue per visit |
| **Appointment modes** | `Doctor.appointmentModes` | Telemedicine capability = modern practice |
| **Time on platform** | `Doctor.createdAt` | Longer tenure = more data, more trust |
| **Booking frequency consistency** | Std deviation of weekly bookings | Stable = lower risk |

#### B. Revenue & Financial Health (from `Sale`, `LedgerEntry`, `Purchase`)

| Signal | Source | Risk Indicator |
|--------|--------|---------------|
| **Monthly gross revenue** | `Sale.total` aggregated | Primary income signal |
| **Revenue trend (3/6/12 months)** | `Sale` time series | Growth trajectory |
| **Payment collection rate** | `Sale.amountPaid / Sale.total` | High collection = healthy cash flow |
| **Overdue receivables** | `Sale` where `paymentStatus = PENDING` and age > 30 days | Cash flow stress indicator |
| **Net cash flow** | `LedgerEntry` (ingresos - egresos) | Actual liquidity |
| **Cash flow volatility** | Std deviation of monthly net ledger | Stability measure |
| **Expense ratio** | `Purchase.total / Sale.total` | Operational efficiency |
| **Payment forms used** | `LedgerEntry.formaDePago` | Cash-heavy = less traceable |

#### C. Patient Base (from `Patient`, `ClinicalEncounter`)

| Signal | Source | Risk Indicator |
|--------|--------|---------------|
| **Total active patients** | `Patient` where status = 'active' | Practice size |
| **New patient acquisition rate** | `Patient.createdAt` monthly | Growth indicator |
| **Patient retention** | Patients with >1 encounter | Repeat business = stability |
| **Average encounters per patient** | `ClinicalEncounter` count / patient count | Engagement depth |
| **Patient activity trend** | `Patient.lastVisitDate` distribution | Active vs stagnant practice |

#### D. Platform Engagement (from `Doctor` profile + activity)

| Signal | Source | Risk Indicator |
|--------|--------|---------------|
| **Profile completeness** | Doctor fields filled vs total | Serious = more committed |
| **Stripe integration** | `Doctor.stripeOnboardingComplete` | Payment infrastructure maturity |
| **Google Calendar connected** | `Doctor.googleCalendarEnabled` | Organized practice |
| **Telegram notifications active** | `Doctor.telegramChatId` exists | Engaged with platform |
| **Blog articles published** | `Article` count | Marketing investment = growth mindset |
| **Fiscal profile set up** | `DoctorFiscalProfile` exists | Tax-compliant = formal economy |
| **Multiple clinic locations** | `ClinicLocation` count | Expanding practice |
| **Services catalog completeness** | `Service` count and pricing set | Professional setup |

---

## 4. Composite Scoring Model

### 4.1 Score Components (Weighted)

| Component | Weight | Source | Range |
|-----------|--------|--------|-------|
| **Bureau Score** | 30% | Círculo de Crédito FICO | 0 – 100 (normalized) |
| **Revenue Health** | 25% | Sales, Ledger, Bookings | 0 – 100 |
| **Practice Stability** | 20% | Booking trends, patient retention | 0 – 100 |
| **Platform Engagement** | 15% | Profile, integrations, tenure | 0 – 100 |
| **Financial Behavior** | 10% | Collection rate, cash flow, expense ratio | 0 – 100 |

**Composite Score: 0 – 100**

### 4.2 Risk Tiers

| Tier | Composite Score | Rate (annual) | Max Amount | Max Term |
|------|----------------|---------------|------------|----------|
| **A — Premium** | 80 – 100 | 24% | $500,000 | 36 months |
| **B — Standard** | 65 – 79 | 30% | $300,000 | 24 months |
| **C — Moderate** | 50 – 64 | 36% | $150,000 | 18 months |
| **D — High Risk** | 35 – 49 | 42% | $75,000 | 12 months |
| **Decline** | < 35 | — | — | — |

### 4.3 Hard Filters (Auto-Decline)

Before scoring, these disqualify immediately:

| Filter | Threshold | Rationale |
|--------|-----------|-----------|
| Bureau score | FICO < 460 (Rojo) | Too risky regardless of in-app data |
| Platform tenure | < 3 months | Insufficient behavioral data |
| Active bookings last 3 months | = 0 | Inactive practice |
| Bureau delinquency | 90+ days in last 12 months | Recent serious default |
| PLD/AML flag | Any | Regulatory requirement |

### 4.4 Soft Signals (Adjust Score Up/Down)

| Signal | Adjustment | Direction |
|--------|-----------|-----------|
| Stripe connected + active payouts | +5 pts | Positive |
| CFDI/Facturación active | +5 pts | Positive (formal economy) |
| Revenue growing >10% MoM (3 months) | +5 pts | Positive |
| Multiple clinic locations | +3 pts | Positive |
| High cancellation rate (>30%) | -5 pts | Negative |
| Declining revenue 3 consecutive months | -10 pts | Negative |
| No patients added in 60 days | -5 pts | Negative |
| Cash-only payments (>80% efectivo) | -3 pts | Negative (harder to verify) |

---

## 5. Doctor Income Context (Mexico)

Understanding our borrower's income is crucial for capacity-to-pay calculations.

### 5.1 Official Data (ENOE Q1 2025)

| Metric | Value |
|--------|-------|
| Average salary (all physicians) | $8,910 MXN/month |
| Average salary (specialists) | $8,670 MXN/month |
| Top-paying states | Chihuahua ($43,300), Nayarit ($18,100), Guerrero ($16,400) |
| Gender split | 52% male ($9,150), 48% female ($8,650) |
| Primary workplace | 90% in medical offices (consultorios) |

**Important caveat:** These are ENOE survey averages that include public-sector and part-time doctors. Private-practice specialists (our target) earn significantly more — typically **$30,000 – $150,000+ MXN/month** depending on specialty, city, and patient volume.

### 5.2 Income Estimation from In-App Data

We can estimate a doctor's actual income more accurately than any bureau by computing:

```
Estimated Monthly Income =
  (Monthly Confirmed Bookings × Average Booking Price)
  + Monthly Sales Total (non-appointment revenue)
  - Monthly Purchases Total (operating costs)
  = Net Operating Income
```

This is verifiable against their `LedgerEntry` records and gives us a **real-time debt-to-income ratio**.

### 5.3 Debt-to-Income (DTI) Limits

| DTI Range | Decision |
|-----------|----------|
| < 30% | Approve — healthy capacity |
| 30% – 40% | Approve with caution — may reduce max amount |
| 40% – 50% | Only Tier A/B doctors, reduced amount |
| > 50% | Decline — over-leveraged |

*DTI = (Proposed monthly payment + existing monthly debt) / Estimated monthly income*

---

## 6. Alternative Data Opportunities (Future)

Beyond what we already have, these could enhance scoring:

| Data Source | Signal | Integration |
|-------------|--------|-------------|
| **SAT (tax authority)** | Declared income, tax compliance | API via FIEL/e.firma |
| **Bank statements (Open Banking)** | Actual cash flows | Open Finance APIs (coming to Mexico) |
| **Google Reviews** | Reputation, patient satisfaction | Google API |
| **Social media presence** | Professional visibility | LinkedIn/Instagram APIs |
| **Medical school / specialty verification** | Credential validation | CONACEM, DGP databases |
| **Insurance panels** | Accepted by GNP, AXA, etc. | Manual or partnership |

---

## 7. Anti-Fraud Considerations

| Risk | Mitigation |
|------|-----------|
| Fake bookings to inflate volume | Cross-reference with unique patient emails/phones; check for self-bookings |
| Inflated sales records | Match sales against ledger entries and Stripe payouts |
| Identity theft | PLD Check via Círculo de Crédito + INE verification |
| Multiple loan stacking | Bureau check for recent inquiries + existing obligations |
| Cédula profesional fraud | Verify against SEP/DGP database |

---

## 8. Implementation Phases

### Phase 1 — MVP (Manual + Bureau)
- Manual application form in-app
- Círculo de Crédito API integration (FICO Score + Report)
- Basic in-app metrics dashboard (bookings, revenue, tenure)
- Manual underwriting decision by credit team
- **Turnaround: 24-48 hours**

### Phase 2 — Semi-Automated
- Automated in-app data aggregation into risk scorecard
- Composite score calculation (bureau + in-app)
- Auto-decline for hard filters
- Manual review only for borderline cases (score 45-55)
- **Turnaround: Same day**

### Phase 3 — Fully Automated
- Real-time scoring engine
- Instant pre-approval based on in-app data
- Bureau pull only at formal application
- Dynamic credit limits (adjust as practice grows/shrinks)
- Monitoring: automated alerts for deteriorating signals
- **Turnaround: Minutes**

---

## 9. Monitoring & Collections Signals

Post-disbursement, we can detect early warning signs:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Booking volume drops >30% vs 3-month avg | Early warning | Proactive outreach |
| Revenue declines 2 consecutive months | Warning | Review account |
| Doctor stops using platform (no logins 14+ days) | Elevated risk | Contact immediately |
| Stripe payouts disabled | Critical | Escalate to collections |
| Missed payment (1st) | Standard | Automated reminder |
| Missed payment (2nd consecutive) | Elevated | Phone call + restructuring offer |
| 90+ days past due | Default | Legal/collections process |

---

## 10. Next Steps

- [ ] **Yield & Economics Model** — Cost of capital, expected returns, unit economics per tier
- [ ] **Legal Entity Research** — SOFOM ENR requirements, setup timeline, costs
- [ ] **Círculo de Crédito Integration** — Developer portal onboarding, sandbox testing
- [ ] **Scorecard Validation** — Backtest composite model against existing doctor data
- [ ] **MVP Wireframes** — In-app loan application flow design

---

## Sources

- [Círculo de Crédito — Developer API Hub](https://developer.circulodecredito.com.mx)
- [Círculo de Crédito — FICO Score API](https://developer.circulodecredito.com.mx/producto/fico-score)
- [Círculo de Crédito — Reporte + FICO Score PF](https://developer.circulodecredito.com.mx/producto/reporte-de-credito-ficor-score-personas-fisicas)
- [Círculo de Crédito — RCC + FICO + PLD Check](https://developer.circulodecredito.com.mx/producto/rcc_fico_score_pld_check_pf)
- [GitHub — API Hub CdC Client Libraries](https://github.com/APIHub-CdC)
- [Creditea — Tabla de Score de Crédito México 2025](https://www.creditea.mx/blog/post/tabla-de-score-de-credito-mexico)
- [Financera — Score Crediticio Rangos](https://financera.mx/prestamos/score-crediticio/)
- [RappiCard — Qué es el Score Crediticio](https://rappicard.mx/2025/10/12/que-es-score-crediticio/)
- [Data México — Médicos Generales y Especialistas](https://www.economia.gob.mx/datamexico/es/profile/occupation/medicos-generales-y-especialistas)
- [Data México — Médicos Especialistas](https://www.economia.gob.mx/datamexico/es/profile/occupation/medicos-especialistas)
- [Milenio — Sueldo de un Médico México 2025](https://www.milenio.com/negocios/sueldo-de-un-medico-cuanto-ganan-los-doctores-en-mexico-2025)
- [RiskSeal — Alternative Data for Mexican Fintech](https://riskseal.io/regions/alternative-data-mexico)
- [AFI — Alternative Data for Credit Scoring Report](https://www.afi-global.org/wp-content/uploads/2025/02/Alternative-Data-for-Credit-Scoring.pdf)
- [Oscilar — Credit Scoring for Fintechs](https://oscilar.com/blog/credit-scoring-guide)
- [SOFOMES.com — Guía SOFOM México 2026](https://sofomes.com/)
