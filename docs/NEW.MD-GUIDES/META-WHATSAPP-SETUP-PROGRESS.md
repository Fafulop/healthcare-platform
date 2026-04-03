# Meta WhatsApp API — Setup Progress

**Last Updated:** 2026-04-03 (session in progress)

---

## Why We Are Doing This

tusalud.pro needs access to the **WhatsApp Business Cloud API** to send messages to patients and doctors — appointment reminders, notifications, and other business communications.

To get production access to the WhatsApp API, Meta requires a structured setup that cannot be skipped or done out of order:

1. A professional business email (not a personal Gmail)
2. A Facebook account created with that professional email
3. A verified Meta Business Portfolio
4. A Meta App with legal pages live and returning HTTP 200
5. A WhatsApp Business Account (WABA) linked to the portfolio
6. App Review approval from Meta
7. Approved Message Templates before sending anything

The legal pages (privacy policy, terms of service, data deletion) were already built and are documented in `META-WHATSAPP-LEGAL-PAGES.md`. This document picks up from where that left off.

---

## Correct Order of Operations

The correct sequence before Meta will approve any WhatsApp API access is:

```
Professional Email
       ↓
Facebook Account (with professional email)
       ↓
Meta Business Portfolio
       ↓
Meta Business Verification (company documents)
       ↓
Meta App + legal pages
       ↓
WhatsApp Business Account (WABA)
       ↓
App Review
       ↓
WhatsApp API access
```

We are currently at step 4 (Business Verification) — steps 1, 2, and 3 are complete.

---

## Step 1 — Professional Email Setup ✅

### Why a professional email first

Meta's App Review and Business Verification processes are tied to the identity of the business. Using a personal Gmail (`lopez.fafutis@gmail.com`) to create the Meta Business Portfolio creates a weak link between the business identity and the Meta account. A `@tusalud.pro` email:

- Makes the Facebook account look like a business account, not a personal one
- Is required for the legal pages contact (`privacidad@tusalud.pro` is referenced in the live pages)
- Is more likely to pass Meta's credibility checks during App Review
- Is the professional standard Meta expects from businesses requesting API access

### Why not Google Workspace

Google Workspace Business Starter is $6 USD/month in the US but is priced at ~$396–$528 MXN/month in Mexico — roughly $19–$26 USD/month due to regional pricing. This is significantly more expensive than the US price and unnecessary for the volume of email tusalud.pro needs right now.

### Solution: Hostinger Business Email

tusalud.pro's domain is already managed through **Hostinger**, which offers its own email hosting. The **Starter Business Email** plan was purchased:

- **Price:** $9 MXN/month (48-month plan) — less than $0.50 USD/month
- **Renewal:** $21 MXN/month
- **Storage:** 10 GB per mailbox
- **Aliases:** Up to 50 per mailbox
- **Forwarding:** Up to 10 rules

### What was created

| Type | Address | Purpose |
|---|---|---|
| Mailbox (primary) | `hola@tusalud.pro` | Main business inbox, used to create Facebook/Meta account |
| Alias | `privacidad@tusalud.pro` | Legal pages contact — already referenced in `/privacidad`, `/terminos`, `/eliminacion-de-datos` |
| Forwarding rule | `hola@tusalud.pro` → `lopez.fafutis@gmail.com` | All mail lands in existing Gmail inbox — no need to manage a separate inbox |

### Why alias instead of a second mailbox

`privacidad@tusalud.pro` only needs to **receive** emails (data deletion and privacy rights requests from users). An alias routes those emails into the `hola@tusalud.pro` mailbox at no extra cost. A second mailbox would cost an additional $9 MXN/month and is not necessary since the address does not need its own login or separate storage.

### Difference between alias and mailbox

| Feature | Alias | Mailbox |
|---|---|---|
| Receives emails | ✓ | ✓ |
| Has own storage | ✗ | ✓ (10 GB) |
| Can send as that address | ✗ | ✓ |
| Has own login | ✗ | ✓ |

### Can this be migrated to Google Workspace later?

Yes. The email addresses are tied to the domain `tusalud.pro`, not to Hostinger. To migrate:
1. Sign up for Google Workspace
2. Update the MX DNS records in Hostinger from Hostinger's mail servers to Google's
3. The same addresses (`hola@tusalud.pro`, `privacidad@tusalud.pro`) continue working
4. No need to update anything in the Meta dashboard or legal pages

---

## Step 2 — Facebook Account ✅

Used the existing `lopez.fafutis@gmail.com` Facebook account (Gerardo Lopez) instead of creating a new one. Reasoning:

- Account already had the correct legal name
- Added `hola@tusalud.pro` as a secondary email via Accounts Center → Personal details
- Avoids Meta's one-account-per-person policy risk
- Existing account has history which can actually help trust signals during Business Verification

---

## Step 3 — Meta Business Portfolio ✅

An existing test Business Portfolio was repurposed instead of creating a new one (Meta enforces a portfolio creation limit per account). Updated with:

- **Business portfolio name:** `tusalud.pro`
- **Business portfolio ID:** `941681454493642`
- **Legal business name:** `Gerardo Lopez Fafutis` (persona física — no SA de CV)
- **RFC / Tax ID:** `LOFG910521283`
- **Address:** Av. Hidalgo 1830, Guadalajara, Jalisco 44650, México
- **Phone:** +523315875992
- **Website:** `https://tusalud.pro`
- **Contact email:** updated from `lopez.fafutis@gmail.com` → `hola@tusalud.pro`

### Why persona física and not SA de CV

The business is registered as a persona física (individual with business activity), not as a moral entity. Meta accepts this — the legal business name must match exactly what appears on the RFC.

---

## Step 4 — Meta Business Verification ⏳ In Progress

Accessed via **Security Center → Business Verification**.

Selected use case: **"App requires access to permissions on Meta for Developers"** — this is the correct option for WhatsApp API access.

### Documents typically required for Mexico (persona física)
- RFC (already on file: `LOFG910521283`)
- INE or pasaporte (government-issued ID matching the legal name)
- Proof of business address (utility bill or bank statement with name + address)
- Website URL (`https://tusalud.pro`)

Verification can take days to weeks. Rejection requires resubmission with different documents.

---

## Step 5 — Meta App (Already Partially Done) ⏳ Pending

The three required legal pages are already live in `apps/public`:

| Page | URL | Status |
|---|---|---|
| Privacy Policy | `https://tusalud.pro/privacidad` | ✅ Built |
| Terms of Service | `https://tusalud.pro/terminos` | ✅ Built |
| Data Deletion | `https://tusalud.pro/eliminacion-de-datos` | ✅ Built |

Once the Meta App is created, these URLs are entered in **App Dashboard → Settings → Basic**.

---

## Step 6 — WhatsApp Business Account (WABA) ⏳ Pending

- Create a WABA linked to the Meta Business Portfolio
- Add a dedicated phone number (must not be registered on any WhatsApp app — personal or business)
- Choose and submit a **Display Name** for the WhatsApp number (Meta reviews this separately)

---

## Step 7 — App Review ⏳ Pending

Meta reviews the app before granting production messaging access. Required:
- Description of use case (what messages will be sent, to whom, how users opted in)
- Proof of opt-in mechanism
- May require screen recordings or a test account

---

## Step 8 — Message Templates ⏳ Pending

All outbound messages to users who have not messaged first must use pre-approved templates. Templates are reviewed separately (usually 24–48 hours). Categories:
- **Utility** — appointment reminders, confirmations (lower cost)
- **Marketing** — promotions (higher cost)
- **Authentication** — OTP codes

---

## Open Items / Blockers

| Item | Status | Notes |
|---|---|---|
| `privacidad@tusalud.pro` mailbox | ✅ Done (alias) | Receives at `hola@tusalud.pro` |
| `hola@tusalud.pro` mailbox | ✅ Done | Forwards to `lopez.fafutis@gmail.com` |
| Facebook account linked to `hola@tusalud.pro` | ✅ Done | Used existing lopez.fafutis account, added professional email |
| Meta Business Portfolio | ✅ Done | Portfolio ID: 941681454493642, repurposed from test |
| Meta Business Verification | ⏳ In Progress | Use case selected, submitting documents next |
| Dedicated WhatsApp phone number | ⏳ Pending | Must not be on any WhatsApp app currently |
| Opt-in mechanism in the platform | ⏳ Pending | Required for App Review |
