# Legal Entity & MVP Lending Path

> Research date: 2026-05-11
> Status: Initial Investigation
> Depends on: [LOAN-STRUCTURE-MEXICO-RESEARCH.md](./LOAN-STRUCTURE-MEXICO-RESEARCH.md), [RISK-PROFILE-RESEARCH.md](./RISK-PROFILE-RESEARCH.md), [YIELD-AND-ECONOMICS-MODEL.md](./YIELD-AND-ECONOMICS-MODEL.md)

---

## 1. The Core Question

How do we start lending to doctors **fast** without the 3-4 month SOFOM constitution process and $85K–$500K MXN setup cost?

Answer: **There are 3 viable paths**, ranging from simplest (MVP) to most robust (full SOFOM). We should start with Path 1 or 2, then graduate to Path 3 as volume justifies it.

---

## 2. Three Legal Paths Compared

| | **Path 1: Contrato de Mutuo** | **Path 2: SA de CV Lender** | **Path 3: SOFOM ENR** |
|---|---|---|---|
| **What is it** | Private loan contract between parties | Standard corporation that lends | Licensed non-bank financial entity |
| **Legal basis** | Código Civil / Código de Comercio | LGSM + LFPIORPI | LGTOC + LGOAAC + LFPIORPI |
| **License needed** | None | None | CONDUSEF registration (SIPRES) |
| **Setup time** | Days | 2-4 weeks (if entity exists, immediate) | 3-4 months |
| **Setup cost** | ~$0 (contract drafting) | ~$15K–$30K MXN (if new entity) | $85K–$500K MXN |
| **AML/PLD obligations** | Minimal (SAT portal if >$600K/year) | LFPIORPI compliance (significant since 2025 reform) | Full PLD program + CONDUSEF oversight |
| **Consumer protection** | PROFECO | PROFECO | CONDUSEF (stricter, but more credibility) |
| **Can charge interest** | Yes (contrato de mutuo con interés) | Yes | Yes |
| **Bureau access** | No (need SIC contract) | Possible (but SICs prefer SOFOMs) | Yes (required to have SIC contract) |
| **Funding sources** | Own capital only | Own capital, some debt | Full range (banks, facilities, securitization) |
| **Max practical portfolio** | $5M–$10M MXN | $10M–$50M MXN | Unlimited |
| **Credibility with doctors** | Low (feels informal) | Medium | High (regulated entity) |
| **Best for** | First 5-10 loans (proof of concept) | MVP pilot (10-50 loans) | Scale (50+ loans) |

---

## 3. Path 1: Contrato de Mutuo (Simplest MVP)

### What It Is

A **contrato de mutuo con interés** (loan agreement with interest) is a standard civil/commercial contract where one party (mutuante/lender) transfers money to another (mutuario/borrower) who commits to repay with interest. This is the simplest legal vehicle — no entity formation required.

### Legal Framework

- **Código Civil Federal** Art. 2384-2397 — defines the mutuo contract
- **Código de Comercio** — if between merchants (commercial act), enables higher interest
- No government authorization needed
- No minimum capital requirements
- Interest rates are freely agreed between parties (no usury cap in commercial loans in Mexico)

### How It Works for MVP

1. Doctor applies through our platform
2. We evaluate risk using in-app data (no bureau pull at this stage)
3. We draft a **contrato de mutuo con interés** + **pagaré** (promissory note)
4. Both parties sign digitally (e.firma/FIEL or NOM-151 compliant e-signature)
5. We disburse via SPEI from a company bank account
6. Doctor repays monthly via SPEI or domiciliación (direct debit)

### Required Documents

| Document | Purpose |
|----------|---------|
| **Contrato de mutuo con interés** | Main loan agreement (terms, rate, schedule) |
| **Pagaré** | Negotiable instrument; enables faster legal collection |
| **Tabla de amortización** | Payment schedule (attached to contract) |
| **Constancia de situación fiscal** | Verify RFC of borrower |
| **Cédula profesional** | Verify doctor identity |
| **INE/IFE** | Official ID |

### Fiscal Implications

**For the lender (us):**
- Interest received is **ingreso acumulable** (taxable income)
- Must issue CFDI (factura) for interest charged
- If lending > $600K MXN total per year → must report to SAT

**For the borrower (doctor):**
- Interest paid may be **deductible** if loan is for business purposes (equipo médico, consultorio)
- Must receive CFDI from lender for deductibility
- Loan itself is not income (must keep contract as proof for SAT)

### Limitations

- **No bureau access** — we can't pull Círculo de Crédito/Buró without a SIC contract (typically requires SOFOM)
- **Funding limited to own capital** — no institutional debt facilities will lend to a party without financial entity
- **Perception** — doctors may be hesitant to borrow from a "non-financial" entity
- **Scale ceiling** — practical limit of ~$5-10M MXN before PLD obligations become burdensome
- **Collection** — pagaré gives legal rights, but without CONDUSEF, disputes go to civil courts (slower)

### When to Use

- **First 5-10 loans** to prove demand and test operations
- **Total portfolio < $5M MXN**
- **Timeline: Can start within 1-2 weeks**

---

## 4. Path 2: SA de CV Lender (Recommended MVP)

### What It Is

A standard **Sociedad Anónima de Capital Variable** (SA de CV) that includes lending as part of its corporate purpose (objeto social). This is the most common structure for early-stage fintech lenders in Mexico.

**Key legal fact:** Any SA de CV in Mexico can originate loans without permission from CNBV or any financial regulator. There is no licensing requirement to lend money in Mexico.

### Why It's Better Than Path 1

1. **Formal entity** — contracts are between a company and the doctor (more professional)
2. **Can open dedicated bank accounts** for lending operations
3. **Can potentially negotiate SIC access** (Círculo de Crédito works with some SA de CVs)
4. **Can issue CFDIs** systematically for interest income
5. **Can receive debt funding** from angels/family offices more easily
6. **Clear corporate governance** — board, bylaws, formal decision-making

### Setup Process

| Step | Time | Cost | Notes |
|------|------|------|-------|
| 1. Draft bylaws (acta constitutiva) with lending in objeto social | 1-2 weeks | $10K–$20K MXN | Notary fees. Include: "otorgamiento de créditos, préstamos, y financiamientos" |
| 2. Register with SAT (RFC) | 1 week | Free | |
| 3. Open bank account | 1-2 weeks | Free | Dedicated account for lending operations |
| 4. Register on SAT PLD portal | 1 week | Free | Required under LFPIORPI for lending activities |
| 5. Draft standard loan contract templates | 1 week | $5K–$15K MXN | Lawyer review of mutuo + pagaré templates |
| **Total** | **3-5 weeks** | **$15K–$35K MXN** | |

**Note:** If we already have an SA de CV (our existing company), we may only need to amend the objeto social to include lending activities — even faster.

### 2025 LFPIORPI Reform — AML Obligations

The July 2025 reform to Mexico's anti-money laundering law significantly increased obligations for SA de CV lenders:

| Obligation | Detail |
|------------|--------|
| **Client identification (KYC)** | Verify identity with official documents (INE, RFC, proof of address) |
| **Beneficial owner identification** | For legal entities, identify UBO (ultimate beneficial owner) |
| **Risk-based evaluation** | Document a risk methodology for each client |
| **Transaction monitoring** | Automated monitoring for suspicious patterns |
| **Record keeping** | Retain all documents for **10 years** |
| **SAT PLD Portal registration** | Mandatory; submit reports in official formats |
| **Suspicious activity reports** | File within **24 hours** of suspicion |
| **Annual training** | Staff must be trained on AML/PLD |
| **Annual audit** | Internal or external audit if high-risk |
| **Compliance officer** | Designate a PLD officer |

**Practical impact:** For a small MVP lending operation, the 2025 reform makes compliance non-trivial. Budget ~$5K-$10K/month for a part-time compliance officer or outsourced service.

### Consumer Protection

- SA de CV lenders fall under **PROFECO** (not CONDUSEF)
- Must comply with **Ley Federal de Protección al Consumidor**
- Must disclose CAT (Costo Anual Total) — though technically CAT is a CONDUSEF requirement, best practice is to disclose it anyway
- Disputes go through PROFECO conciliation or civil courts

### Bureau Access as SA de CV

This is the trickiest part. SICs (Círculo de Crédito, Buró de Crédito) typically require:
- A financial entity status (SOFOM, bank, etc.) for **full report access**
- Some SICs offer **limited products** to non-financial entities (e.g., identity verification, basic score)
- **Workaround:** Partner with a SOFOM that has SIC access and operate under their umbrella for bureau pulls

**Círculo de Crédito alternative:** Their API Hub offers some products to non-SOFOM entities, but the full credit report + FICO typically requires a financial entity contract. Worth reaching out to their commercial team.

### When to Use

- **10-50 loans** pilot phase
- **Portfolio $5M–$30M MXN**
- **Timeline: 3-5 weeks to be operational**
- **Until SOFOM is justified by volume (50+ loans, $30M+ portfolio)**

---

## 5. Path 3: SOFOM ENR (Scale Path)

### What It Is

A **Sociedad Financiera de Objeto Múltiple, Entidad No Regulada** — the standard financial entity for non-bank lenders in Mexico. Over 240 SOFOM ENRs operate in Mexico currently.

### Why Graduate to SOFOM

| Benefit | Detail |
|---------|--------|
| **Full bureau access** | Required to have SIC contract; can pull full credit reports + FICO |
| **CONDUSEF oversight** | Provides credibility and consumer trust |
| **Institutional funding** | Banks, DFIs, and funds only lend to financial entities |
| **Securitization eligible** | Can issue debt instruments backed by loan portfolio |
| **Factoring + leasing** | Can also do factoraje and arrendamiento (diversification) |
| **NAFIN/FND programs** | Access to government development bank lines at favorable rates |
| **Professional image** | "Entidad financiera regulada" builds trust with doctors |

### What a SOFOM ENR Can Do

1. **Crédito (lending)** — consumer, commercial, professional
2. **Arrendamiento financiero (financial leasing)** — equipment leasing for doctors
3. **Factoraje financiero (factoring)** — purchase of receivables

### Constitution Process

| Step | Time | Cost | Notes |
|------|------|------|-------|
| 1. Constitute SA de CV with SOFOM objeto social | 2-3 weeks | $15K–$30K MXN | Notary. Must include "SOFOM ENR" in name |
| 2. Register with SAT (RFC) | 1 week | Free | |
| 3. Contract with at least 1 SIC | 2-4 weeks | Varies | Círculo de Crédito or Buró de Crédito |
| 4. Register with CONDUSEF (SIPRES) | 10 business days | Free | After submitting all documentation |
| 5. Implement PLD/AML program | 2-4 weeks | $30K–$80K MXN | Compliance manual, officer, training |
| 6. Open bank accounts | 1-2 weeks | Free | Easier as SOFOM |
| 7. CNBV registration (informative) | 2 weeks | Free | Informative only for ENR |
| **Total** | **3-4 months** | **$85K–$500K MXN** | Depending on complexity |

### Ongoing Obligations

| Obligation | Frequency | Cost |
|------------|-----------|------|
| CONDUSEF registration renewal | Annual | Included |
| CONDUSEF quarterly reports | Quarterly | Staff time |
| PLD/AML compliance program | Ongoing | $10K–$20K/month (officer + systems) |
| Annual external audit (PLD) | Annual | $30K–$60K MXN |
| SIC contract fees | Per-query | Varies |
| CNBV reporting (R04, R08) | Monthly/Quarterly | Staff time |
| CAT calculation and disclosure | Per product | Staff time |
| Contract registration with CONDUSEF | Per product | Free |
| Complaints handling (CONDUSEF) | As needed | Staff time |

### Capital Requirements

- **No legal minimum capital** for SOFOM ENR (unlike banks)
- **Practical minimum:** ~$50M MXN for viable lending operation (recommended by industry)
- **For our case:** Can start with much less if portfolio is small; the $50M recommendation is for SOFOMs that want to be competitive at scale

### When to Graduate

Trigger points to move from SA de CV to SOFOM ENR:

| Trigger | Threshold |
|---------|-----------|
| Portfolio size | > $30M MXN |
| Number of active loans | > 50 |
| Need for institutional funding | When angels/equity are insufficient |
| Bureau access requirement | When scoring model needs full credit reports |
| Doctor trust / marketing | "Entidad financiera autorizada" matters for conversion |

---

## 6. Alternative MVP: Revenue-Based Advance (Not a Loan)

### The Concept

Instead of a traditional loan, structure the product as a **purchase of future receivables** — a merchant cash advance (MCA) model. This is **not legally a loan**, which means:

- No contrato de mutuo needed
- No usury concerns
- Different (potentially lighter) regulatory treatment
- Repayment fluctuates with the doctor's actual revenue

### How It Would Work

```
1. Doctor has $50,000/month in confirmed upcoming bookings (visible in our app)
2. We "purchase" $100,000 of their future receivables at a discount
3. We advance $85,000 today (85% advance rate)
4. We collect a fixed % of their daily/weekly Stripe payouts until $100,000 is recovered
5. Factor rate: 1.18 (doctor receives $85K, repays $100K over ~3-4 months)
```

### Key Legal Distinction

| Feature | Loan (Mutuo) | Revenue Advance (Compraventa) |
|---------|-------------|------------------------------|
| **Legal nature** | Extension of credit | Purchase of future receivables |
| **Contract type** | Contrato de mutuo con interés | Contrato de compraventa de derechos de cobro |
| **Interest rate** | Yes (tasa de interés) | No — it's a "discount" or "factor rate" |
| **Fixed repayment** | Yes (tabla de amortización) | No — percentage of actual revenue |
| **Risk transfer** | Borrower bears all risk | Buyer (us) shares risk if revenue drops |
| **Regulatory treatment** | Lending (LFPIORPI applies) | Commercial transaction (lighter regulation) |
| **Usury laws** | Applicable (though no cap in Mexico for commercial) | Not applicable (not a loan) |
| **Bureau reporting** | Expected if SOFOM | Not standard |
| **CAT disclosure** | Required | Not technically required |

### Why This Is Interesting for Our MVP

1. **We already have the data** — confirmed bookings with prices are in `AppointmentSlot` + `Booking`
2. **We already have the collection mechanism** — Stripe Connect payouts
3. **Lighter regulation** — structured as commercial purchase, not credit
4. **Aligned incentives** — if the doctor's practice declines, our collection automatically adjusts
5. **No bureau needed** — risk is based entirely on observable future revenue
6. **Faster iteration** — can test with 5 doctors this month

### Revenue Advance Economics

| Parameter | Value |
|-----------|-------|
| Advance amount | $50K – $200K MXN |
| Advance rate | 80% – 90% of purchased receivables |
| Factor rate | 1.10 – 1.25 (not annualized) |
| Collection | 10% – 20% of daily/weekly Stripe payouts |
| Effective term | 2 – 6 months (depends on revenue) |
| Effective annual cost | ~30% – 50% (comparable to loan, but variable) |

### Limitations

- **Only works for Stripe-connected doctors** — need payment flow we control
- **Smaller amounts** — capped by visible future revenue (can't do $500K advances)
- **Legal gray area** — Mexican courts haven't tested MCA structure extensively; "substance over form" risk
- **Doctor perception** — may feel like a loan regardless of legal structure
- **No credit building** — doesn't report to bureaus (could be pro or con)

### Recommendation

Use as a **parallel offering** alongside traditional loans:
- **Revenue advances** for Stripe-connected doctors who want quick, small amounts ($50K–$150K)
- **Traditional loans (mutuo)** for larger amounts, doctors without Stripe, or those who want formal credit

---

## 7. Recommended MVP Roadmap

### Phase 0: Proof of Concept (Weeks 1-4)

```
Structure:   Contrato de mutuo (Path 1) or Revenue advance
Entity:      Existing company (amend objeto social if needed)
Bureau:      None (in-app data only)
Capital:     Founder equity ($1M–$3M MXN)
Loans:       5-10 hand-picked doctors
Amount:      $50K–$150K each
Risk:        Manual evaluation by founders
Collection:  Manual SPEI or Stripe payout deduction
Legal:       Standard mutuo + pagaré (lawyer-reviewed)
```

**Goal:** Validate demand, test operations, learn default behavior

### Phase 1: Structured MVP (Months 2-6)

```
Structure:   SA de CV with lending objeto social (Path 2)
Entity:      New SA de CV or amended existing entity
Bureau:      Limited (negotiate with Círculo de Crédito)
Capital:     Founder equity + angel debt ($5M–$10M MXN)
Loans:       20-50 doctors
Amount:      $50K–$300K each
Risk:        In-app scorecard + basic bureau (if available)
Collection:  Domiciliación (direct debit) + Stripe
Legal:       Full contract suite, PLD compliance
Compliance:  Part-time PLD officer, SAT portal registration
```

**Goal:** Build portfolio, refine scoring model, prove unit economics

### Phase 2: Scale (Months 6-12)

```
Structure:   SOFOM ENR (Path 3)
Entity:      Constitute SOFOM ENR (start process in Month 4)
Bureau:      Full Círculo de Crédito integration
Capital:     Institutional debt facility ($20M–$50M MXN)
Loans:       100-200 doctors
Amount:      $50K–$500K each
Risk:        Automated composite scoring (bureau + in-app)
Collection:  Automated domiciliación + monitoring
Legal:       Full CONDUSEF compliance, registered contracts
Compliance:  Full-time PLD officer, annual audit
```

**Goal:** Reach break-even (~250 loans), prove model for institutional funding

---

## 8. Comparison: What Can We Do TODAY vs Later?

| Capability | Phase 0 (Today) | Phase 1 (SA de CV) | Phase 2 (SOFOM) |
|------------|-----------------|--------------------|--------------------|
| Lend money | Yes (mutuo) | Yes | Yes |
| Charge interest | Yes | Yes | Yes |
| Pull credit bureau | No | Maybe (limited) | Yes (full) |
| Issue CFDIs for interest | Yes (via existing RFC) | Yes | Yes |
| Offer revenue advances | Yes (if Stripe) | Yes | Yes |
| Receive institutional debt | No | Limited (angels) | Yes (banks, DFIs) |
| Report to CONDUSEF | No | No | Yes (required) |
| Appear as "financial entity" | No | No | Yes |
| Do equipment leasing | No | No (separate license) | Yes (built into SOFOM) |
| Do factoring | Yes (any entity can since 2006) | Yes | Yes |
| CAT obligation | No (but best practice) | No (but best practice) | Yes (mandatory) |

---

## 9. Legal Costs Summary

### One-Time Costs

| Item | Phase 0 | Phase 1 (SA de CV) | Phase 2 (SOFOM ENR) |
|------|---------|--------------------|--------------------|
| Entity formation | $0 | $15K–$30K MXN | $85K–$200K MXN |
| Contract templates (mutuo + pagaré) | $5K–$15K | $10K–$20K | $15K–$30K |
| PLD/AML compliance manual | $0 | $15K–$30K | $30K–$80K |
| SIC contract | N/A | $10K–$30K (if negotiable) | $10K–$30K |
| CONDUSEF registration | N/A | N/A | Included in formation |
| **Total one-time** | **$5K–$15K** | **$50K–$110K** | **$140K–$340K** |

### Monthly Operating Costs

| Item | Phase 0 | Phase 1 | Phase 2 |
|------|---------|---------|---------|
| PLD officer | $0 | $5K–$10K (part-time) | $15K–$25K (full-time) |
| Legal/compliance | $0 | $3K–$5K | $5K–$10K |
| Bureau queries | $0 | $1K–$3K | $3K–$10K |
| CONDUSEF reporting | $0 | $0 | $2K–$5K (staff time) |
| Annual audit (amortized monthly) | $0 | $0 | $3K–$5K |
| **Total monthly** | **~$0** | **$9K–$18K** | **$28K–$55K** |

---

## 10. Key Legal Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **SAT treats advances as loans** (substance over form) | Medium | Medium | Structure contracts carefully; get tax counsel opinion |
| **LFPIORPI non-compliance penalty** | Low-Medium | High | Hire PLD officer from Phase 1; don't skip SAT portal |
| **Doctor disputes via PROFECO** | Low | Medium | Clear contracts, CAT disclosure, professional communication |
| **Revenue advance recharacterized as usury** | Low | Medium | Ensure repayment genuinely fluctuates with revenue |
| **Unauthorized financial activity allegation** | Very Low | High | SA de CV lending is explicitly legal; document corporate purpose |
| **SIC access denied** | Medium | Medium | Start SOFOM process early; use in-app data as primary risk tool |

---

## 11. Immediate Action Items

### This Week

- [ ] **Legal consultation** — 1-hour call with fintech lawyer to validate SA de CV lending path
- [ ] **Amend objeto social** — Check if existing entity can add lending, or decide to create new SA de CV
- [ ] **Draft loan contract** — Contrato de mutuo con interés + pagaré template
- [ ] **Identify 5 pilot doctors** — High-engagement, Stripe-connected, good in-app metrics

### This Month

- [ ] **SAT PLD portal registration** — Register as vulnerable activity entity
- [ ] **Stripe payout integration** — Design automatic repayment collection from Stripe payouts
- [ ] **In-app loan application flow** — Simple form: amount, purpose, term selection
- [ ] **Contact Círculo de Crédito** — Explore SA de CV access to API products

### Next Quarter

- [ ] **Begin SOFOM ENR constitution** — Start the 3-4 month process
- [ ] **Hire part-time PLD officer** — Or outsource to compliance consultancy
- [ ] **Build scoring dashboard** — Aggregate in-app signals into risk scorecard

---

## Sources

- [Legal Paradox — Lending Fintechs in Mexico](https://www.legalparadox.com/categories/lending)
- [Mexico Financial License — Licensing Guide 2025](https://mexicofinanciallicense.com/wp-content/uploads/2025/08/Mexico-Licensing-Guide-2025.pdf)
- [Mexico Financial License — Introduction](https://mexicofinanciallicense.com/introduction/)
- [Chambers — Fintech 2025 Mexico](https://practiceguides.chambers.com/practice-guides/fintech-2025/mexico)
- [Chambers — Financial Services Regulation 2025 Mexico](https://practiceguides.chambers.com/practice-guides/financial-services-regulation-2025/mexico/trends-and-developments)
- [National Law Review — Mexico AML 2025 LFPIORPI Reform](https://natlawreview.com/article/beyond-threshold-how-mitigate-risks-after-reform-reform-mexican-anti-money)
- [Hogan Lovells — Reform of Mexico's AML Law](https://www.hoganlovells.com/en/publications/reform-of-mexicos-antimoney-laundering-law)
- [Ritch Mueller — LFPIORPI Reform Alert](https://www.ritch.com.mx/en/prensa/alerta-para-clientes-reforma-a-la-ley-antilavado-en-mexico-transformacion-normativa-y-repercusiones-estrategicas)
- [ElConta — Préstamos de Dinero: Aspectos Legales y Fiscales](https://elconta.mx/prestamos-de-dinero-aspectos-legales-y-fiscales/)
- [Gestion123 — Cómo Prestar Dinero Legalmente en México](https://gestion123.com/c-mexico/como-prestar-dinero-legalmente-en-mexico/)
- [AskRobin — Cómo Ser Prestamista](https://mx.askrobin.com/prestar-dinero)
- [SAT — Mutuo, Préstamo o Crédito (PLD)](https://sppld.sat.gob.mx/pld/interiores/mutuo.html)
- [PractiFinanzas — Contrato Mutuo y SAT](https://practifinanzas.com/2019/09/contrato-mutuo-prestamos-personales/)
- [FinTech Mexico — Declarar Préstamo SAT 2025](https://fintech-mx.com/bancos/declarar-prestamo-sat-mexico/)
- [SOFOMES.com — Guía SOFOM México 2026](https://sofomes.com/)
- [SOFOMES.com — Mejores SOFOMes México 2026](https://sofomes.com/mejores-sofomes-mexico-2025)
- [Elyex — Requisitos Constituir SOFOM México 2026](https://elyex.com/requisitos-para-constituir-una-sofom-en-mexico/)
- [FAM Value — Cómo Constituir una SOFOM](https://famvalue.com.mx/como-constituir-una-sofom/)
- [GP&H Legal — Obligaciones para Crear SOFOM](https://www.gphlegal.mx/2021/08/23/principales-obligaciones-para-crear-una-sofom/)
- [Naat Tech — Requisitos para Construir SOFOM](https://www.naat.tech/blog/requisitos-para-construir-una-sofom-en-mexico)
- [CONDUSEF — Mitos o Realidades SOFOM ENR](https://www.condusef.gob.mx/?p=contenido&idc=989&idcat=1)
- [GOB.MX — Preguntas Frecuentes SOFOM ENR](https://www.gob.mx/cms/uploads/attachment/file/104908/Preguntas_frecuentes_Sofom_ENR.pdf)
- [FinTech Weekly — MCAs Are Not Loans (2026)](https://www.fintechweekly.com/magazine/articles/merchant-cash-advances-not-loans-legal-distinction-court-2026)
- [KYC Systems — Factoraje Financiero México 2026](https://kyc-systems.com/blog/factoraje-financiero)
