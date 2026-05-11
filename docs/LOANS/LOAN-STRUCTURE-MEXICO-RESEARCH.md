# Loan Structure Research — Préstamos para Médicos en México

> Research date: 2026-05-11
> Status: Initial Investigation

---

## 1. Market Overview

The Mexican market for professional loans to doctors is **underserved**. Most lending products are either:
- Generic personal loans (bancos tradicionales)
- SME/PyME loans (fintechs like Konfío, Credijusto)
- Patient-facing medical financing (Mend, Alivio Capital)

There is **one notable bank product** specifically for doctors (Inbursa), and **no fintech** currently specializes in physician lending in Mexico. This represents a clear market gap.

---

## 2. Existing Players

### 2.1 Banks — Products Targeting Doctors

| Player | Product | Amount | Term | Rate | Notes |
|--------|---------|--------|------|------|-------|
| **Inbursa** | Crédito Express Médicos | Min $50,000 MXN (max sujeto a capacidad) | 48 meses | Tasa fija (not publicly disclosed) | Comisión 1.5% + IVA. Requires cédula profesional + consultorio |
| **Inbursa** | Tarjeta Enlace Médico | Credit card | Revolving | Variable | Tarjeta específica para médicos |
| **BBVA** | Préstamo Personal Inmediato | Up to ~$1.5M MXN | 12-60 meses | 25.75% – 39.95% anual sin IVA | Generic, not doctor-specific |
| **Scotiabank** | Crédito Simple | Up to $500,000 MXN | Up to 60 meses | Variable | Generic personal loan |
| **Credifiel** | Créditos sector salud pública | Variable | 12-48 meses | Variable | For IMSS/ISSSTE workers via nómina |

### 2.2 Fintechs — General Lending (potential competitors or models)

| Player | Focus | Loan Size | Rate Range | Structure |
|--------|-------|-----------|------------|-----------|
| **Konfío** | SME/PyME credit | $100K – $50M MXN | Not disclosed publicly | SOFOM ENR. Uses transactional data, bank statements, tax filings for underwriting |
| **Credijusto** (now Covalto) | SME lending | $500K – $50M MXN | ~18% – 36% | Uses business performance metrics, not just personal credit |
| **Creze** | SME lending | $100K – $5M MXN | ~24% – 42% | Fast online approval |
| **Yotepresto** | P2P personal loans | $10K – $300K MXN | 8.9% – 38.9% anual sin IVA | P2P model, fixed rate, subject to credit evaluation |
| **Kueski** | Personal micro-loans | Up to $20K MXN | Very high (>100% anual) | Short-term, payday-style |

### 2.3 Patient-Facing Medical Financing (NOT lending to doctors)

| Player | Model |
|--------|-------|
| **Mend** | Patient pays surgery in monthly installments |
| **Alivio Capital** | Patient financing for treatments/surgeries |
| **Red Médica Pro** | Interest-free financing for patients |

> These are relevant as **complementary services** (help the doctor's patients pay), not as competitors to doctor lending.

---

## 3. Typical Loan Structures in Mexico

### 3.1 Interest Rates (Market Benchmarks)

| Segment | Typical Annual Rate |
|---------|-------------------|
| Bank personal loans (prime clients) | 20% – 35% |
| Bank personal loans (general) | 30% – 50% |
| Fintech SME loans | 24% – 42% |
| Fintech personal loans (P2P) | 9% – 39% |
| Fintech micro-loans (Kueski-style) | 80% – 120%+ |
| **Weighted avg fintech lending** | **~39% annual** |
| Banco de México reference rate (2026) | ~10.5% – 11% |

### 3.2 Common Loan Terms

| Parameter | Typical Range |
|-----------|--------------|
| **Term** | 12 – 60 months |
| **Payment frequency** | Monthly (most common), biweekly (nómina loans) |
| **Amortization** | Fixed equal payments (pagos fijos iguales) — French amortization |
| **Origination fee** | 1% – 3% + IVA of disbursed amount |
| **Early repayment** | Generally allowed without penalty (by law for consumer credit) |
| **Late payment fee** | Typically IVA-inclusive penalty on unpaid balance |
| **Collateral** | Unsecured (personal/SME), or pagaré (promissory note) |
| **Insurance** | Optional life/disability insurance bundled |

### 3.3 Amortization Type

The standard in Mexico is **French amortization** (pagos fijos):
- Equal monthly payments throughout the life of the loan
- Early payments are mostly interest, later payments mostly principal
- This is what Inbursa uses for Crédito Express Médicos

---

## 4. Legal/Regulatory Structure for Lending

### 4.1 Vehicle Options

| Structure | Description | Regulation Level | Best For |
|-----------|-------------|-----------------|----------|
| **SOFOM ENR** | Sociedad Financiera de Objeto Múltiple, No Regulada | Light regulation (CONDUSEF, PROFECO, Banxico reporting) | Most fintechs use this. Can do credit, leasing, factoring. No public savings. |
| **SOFOM ER** | Same but regulated (tied to bank group) | Full CNBV supervision | Bank subsidiaries |
| **IFT (Fintech Law)** | Institución de Tecnología Financiera | CNBV regulated | Crowdfunding/P2P platforms |
| **Bank** | Institución de Banca Múltiple | Fully regulated | Full banking services |

**For our case:** A SOFOM ENR is the most practical starting point. It allows credit origination without heavy regulatory burden. The Ley Fintech (2018) created the IFT category but that's more for marketplace/P2P models.

### 4.2 Key Regulations

- **Ley General de Organizaciones y Actividades Auxiliares del Crédito** — governs SOFOMs
- **Ley Fintech (LRITF)** — governs fintech institutions
- **CONDUSEF** — consumer protection, mandatory registration, CAT disclosure
- **Banxico** — reporting requirements for interest rates
- **CAT (Costo Anual Total)** — must be disclosed to borrowers; includes rate + fees + insurance

---

## 5. Proposed Loan Structure for Our Platform

### 5.1 Target Product Parameters (Initial Hypothesis)

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| **Target** | Doctors with cédula profesional on our platform | Known income via app data |
| **Loan amount** | $50,000 – $500,000 MXN | Covers equipment, remodelación, working capital |
| **Term** | 12 – 36 months | Shorter than bank (48-60) to reduce risk |
| **Interest rate** | 24% – 36% annual (depending on risk tier) | Competitive with fintechs, below bank generic |
| **Origination fee** | 2% + IVA | Market standard |
| **Payment frequency** | Monthly | Standard, aligned with doctor income cycles |
| **Amortization** | French (fixed payments) | Standard, simple to understand |
| **Early repayment** | Allowed, no penalty | Required by law for consumer credit |
| **Collateral** | Unsecured + pagaré | Standard for this segment |
| **Use of funds** | Equipo médico, remodelación consultorio, capital de trabajo, emergencias | Flexible like Inbursa |

### 5.2 Key Advantages We Have

1. **In-app data for risk scoring** — we know the doctor's:
   - Appointment volume and trends
   - Revenue (ventas, facturación)
   - Patient base size and retention
   - Practice maturity (time on platform)
   - Payment history (if Stripe-linked)
2. **Distribution** — doctors are already on the platform, zero acquisition cost
3. **Sticky relationship** — loan creates retention and platform dependency
4. **Underserved niche** — Inbursa is the only real competitor for doctor-specific credit

---

## 6. Use Cases for Doctor Loans

| Use Case | Typical Amount | Term |
|----------|---------------|------|
| Medical equipment purchase | $100K – $500K | 24 – 36 months |
| Office remodel/expansion | $100K – $300K | 18 – 36 months |
| Working capital / cash flow bridge | $50K – $150K | 6 – 12 months |
| Marketing/patient acquisition | $30K – $100K | 6 – 12 months |
| Second location opening | $200K – $500K | 24 – 36 months |
| Emergency / personal | $50K – $200K | 12 – 24 months |

---

## 7. Next Steps

- [ ] **Risk Profile Research** — Define scoring model using in-app data + bureau data (separate doc)
- [ ] **Yield & Economics Model** — Unit economics, cost of capital, expected returns
- [ ] **Legal Entity Research** — SOFOM ENR setup process, costs, timeline
- [ ] **Competitive Deep Dive** — Detailed comparison with Inbursa and fintech alternatives
- [ ] **MVP Definition** — Minimum viable loan product for pilot

---

## Sources

- [Inbursa — Crédito Express Médicos](https://www.inbursa.com/sites/gfi/credito-express-medicos)
- [Inbursa — Tarjeta Enlace Médico](https://www.inbursa.com/sites/gfi/tdc-enlacemedico)
- [BBVA — Préstamo Personal Inmediato](https://www.bbva.mx/personas/productos/creditos/prestamos-personales/prestamo-personal-inmediato.html)
- [Yotepresto — Créditos personales](https://www.yotepresto.com/creditos-personales)
- [Credifiel — Préstamos sector salud](https://www.credifiel.com.mx/m/creditos/salud-publica)
- [Konfío](https://konfio.mx/)
- [Chambers — Fintech 2025 Mexico](https://practiceguides.chambers.com/practice-guides/fintech-2025/mexico)
- [Legal Paradox — Lending Fintechs in Mexico](https://www.legalparadox.com/categories/lending)
- [RiskSeal — Consumer Loans in Mexico](https://riskseal.io/blog/consumer-loans-in-mexico)
- [Dinero MX — Mejores préstamos personales 2025](https://dinero.mx/prestamos-personales/mejores-prestamos-personales/)
- [Mend — Paga tu cirugía a meses](https://www.mend.com.mx/)
- [Alivio Capital](https://www.aliviocapital.com/)
- [CONDUSEF — Simulador de Crédito](https://phpapps.condusef.gob.mx/condusef_personalnomina/)
- [SOFOMES.com — Guía SOFOM México 2026](https://sofomes.com/)
