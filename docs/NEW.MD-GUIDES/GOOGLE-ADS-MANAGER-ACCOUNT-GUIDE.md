  # Google Ads Manager Account — Setup & Operations Guide

**Last Updated:** 2026-03-19

---

## Overview

This guide covers how to manage Google Ads campaigns for tusalud.pro doctors using a **Google Ads Manager Account (MCC)**. It explains the account structure, billing model, how conversion tracking connects to each doctor's profile, and the step-by-step process to onboard a new doctor.

---

## What Is a Manager Account (MCC)?

A Manager Account (also called MCC — My Client Center) is a Google Ads "master account" that lets you create and manage multiple Google Ads sub-accounts from a single login. Each sub-account is a fully independent Google Ads account with its own campaigns, budget, billing, and conversion history.

```
Your Manager Account (MCC)
├── Dr. Lopez       → AW-111111111  (his campaigns, his billing)
├── Dr. Garcia      → AW-222222222  (his campaigns, his billing)
└── Dr. Martinez    → AW-333333333  (his campaigns, his billing)
```

You manage all campaigns from one dashboard. Each doctor pays Google independently.

---

## Why Create a New Sub-Account Per Doctor

Even if a doctor already has an existing Google Ads account, creating a fresh sub-account inside your MCC is recommended because:

- **Full control** — you own and manage the account structure, the doctor can't accidentally change campaign settings
- **Clean history** — no contamination from old campaigns unrelated to tusalud.pro
- **Consistent structure** — all doctors have the same conversion actions, naming conventions, and campaign setup
- **One dashboard** — all doctor performance visible from your MCC without switching logins
- **Data retention** — if a doctor leaves, the account and its history stay in your MCC

**The downside:** a fresh account starts with zero Quality Score and audience history. Google's algorithm takes roughly 2–4 weeks to optimize. This is a minor and temporary disadvantage.

**The doctor's original account is not affected in any way.** He simply ends up with two accounts — his original (untouched) and the new one you manage.

---

## Billing — How It Works

This is the most important thing to understand. There are two billing models in Google Ads:

### Option A — Independent Billing (recommended)

Each sub-account has its own billing linked to the **doctor's own payment method**. The doctor pays Google directly.

| Who pays Google | Doctor (directly) |
|---|---|
| Manager sees card details | Never |
| Doctor controls his spending | Yes |
| You charge the doctor | Separate management fee (bank transfer, invoice, etc.) |

This is verified by Google's official documentation:
> *"Card details are confidential information. They are entered directly by the customer in their account."*

### Option B — Consolidated Billing

You pay for all sub-accounts with your own card, then invoice each doctor separately.

| Who pays Google | You |
|---|---|
| You front the money | Yes |
| Billing complexity | High — you track spend per doctor and invoice them |
| Recommended | No — too complex at scale |

**Use Option A.** It is the standard agency model and what Google recommends.

---

## How the Doctor Adds His Card

1. You create the sub-account (see steps below) and select **"Create new billing setup"** — leave it blank
2. You add the doctor as a user on his sub-account (Admin access)
3. The doctor logs into his sub-account at [ads.google.com](https://ads.google.com)
4. He goes to **Billing → Billing settings** and adds his own credit/debit card
5. Google charges him directly — you are never involved in the payment

---

## How It Connects to tusalud.pro

The tusalud.pro platform is already built to support per-doctor Google Ads. Here is the full data flow:

```
Doctor's sub-account created in MCC
    │
    ▼
Copy AW-XXXXXXXXXX from sub-account
    │
    ▼
Paste into doctor's profile in Admin panel → google_ads_id field
    │
    ▼
Stored in DB: doctors.google_ads_id
    │
    ▼
Public app loads doctor profile
    │  gtag('config', 'AW-XXXXXXXXXX')  ← initializes the account tag
    ▼
Patient clicks WhatsApp or books appointment
    │  gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXXX/contact_click' })
    │  gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXXX/booking_complete' })
    ▼
Conversion recorded in doctor's Google Ads sub-account
```

**Fallback behavior:**

| Doctor has `google_ads_id` in DB? | Global `NEXT_PUBLIC_GOOGLE_ADS_ID` set? | Result |
|---|---|---|
| Yes | Yes | Uses doctor's ID (takes priority) |
| Yes | No | Uses doctor's ID |
| No | Yes | Uses global ID |
| No | No | No Ads conversion tracking (GA4 still works) |

---

## Conversion Actions — Required Setup

The conversion events fired by tusalud.pro use these labels:

| Event | `send_to` value | Meaning |
|---|---|---|
| WhatsApp / phone click | `AW-XXXXXXXXXX/contact_click` | Patient tried to contact the doctor |
| Booking completed | `AW-XXXXXXXXXX/booking_complete` | Patient successfully booked an appointment |

**These labels must exist as conversion actions inside the doctor's sub-account.** If they don't exist, the events fire from the site but Google silently discards them — no error, no warning.

### What still works WITHOUT conversion actions:
- Remarketing audiences — Google knows the user visited the doctor's profile
- GA4 events — `contact_click` and `booking_complete` still record in GA4
- Traffic attribution — GA4 can still tell a visitor came from a paid Google click

### What does NOT work without conversion actions:
- Google Ads conversion-based bidding (Smart Bidding) — Google can't optimize toward people who convert

---

## Step-by-Step: Onboarding a New Doctor

### Step 1 — Create the sub-account

1. Log into your Manager Account at [ads.google.com](https://ads.google.com)
2. Click **"+"** → **"New account"** → **"Create new account"**
3. Fill in:
   - **Account name:** `Dr. [Name] - tusalud.pro`
   - **Country:** Mexico
   - **Timezone:** America/Mexico_City (GMT-6)
   - **Currency:** Mexican Peso (MXN)
4. **Billing:** select **"Create new billing setup"** — leave it empty for the doctor to fill in
5. Click **Create**

### Step 2 — Create conversion actions

Inside the new sub-account:

1. Go to **Goals → Conversions → New conversion action → Website**
2. Create first action:
   - **Name:** `contact_click`
   - **Category:** Lead
   - **Count:** One (one conversion per click)
   - **Value:** Don't assign a value (or use a fixed estimate)
3. Create second action:
   - **Name:** `booking_complete`
   - **Category:** Purchase
   - **Count:** One
   - **Value:** Use the appointment price (dynamic value sent by the site)
4. **Do not install the tag** — tusalud.pro already handles this

### Step 3 — Copy the account ID

1. In the sub-account, go to **Settings → Account settings**
2. Copy the **Customer ID** — it looks like `123-456-7890`
3. Format it as `AW-1234567890` (remove dashes, add `AW-` prefix)

### Step 4 — Add the ID in admin

1. Log into the tusalud.pro admin panel
2. Go to **Doctors** → find the doctor → click **Ads** button
3. Paste the `AW-XXXXXXXXXX` ID → Save

The site immediately starts loading the doctor's tag and firing conversion events on his profile.

### Step 5 — Doctor adds his payment method

1. Add the doctor as a user on his sub-account: **Access and security → Users → Add user** (use his Google email, role: Admin)
2. Ask him to log into [ads.google.com](https://ads.google.com) and go to **Billing → Billing settings**
3. He adds his credit/debit card — Google charges him directly from this point

---

## Verifying It Works

### Check the tag loads on the doctor's profile

1. Open the doctor's public profile on tusalud.pro
2. Chrome DevTools → **Network** tab → filter by `google`
3. On page load you should see a request containing `AW-XXXXXXXXXX`
4. Click the WhatsApp button → look for a `conversion` event with `contact_click`

### Use Google Tag Assistant

Install the **Google Tag Assistant** Chrome extension → visit the doctor's profile → it shows all tags firing and flags any issues.

### Check Google Ads for conversions

In the doctor's sub-account → **Goals → Conversions** → after real visits the status changes from "Unverified" to "Recording conversions" (can take 24–48h).

---

## Traffic Attribution (Did a Patient Come From an Ad?)

When someone clicks a Google Ad, Google appends a `gclid` parameter to the URL:
```
tusalud.pro/doctores/dr-lopez?gclid=Cj0KCQj...
```

GA4 sees this and marks the session as **google / cpc** (paid traffic). So even without conversion actions set up, you can already see in GA4 which profile visits came from paid Google clicks.

To see full campaign details (which keyword, which ad), the GA4 property must be **linked to the doctor's Google Ads sub-account**:

- GA4 → Admin → **Google Ads Links** → Add the sub-account
- This is a one-time setup per doctor
- No code changes required

---

## FAQ

**Q: The doctor already has his own Google Ads account. Do I use that?**
You can either link his existing account to your MCC, or create a fresh sub-account. If his existing account has campaigns unrelated to tusalud.pro, creating a fresh sub-account keeps things clean. His original account is not affected.

**Q: Can I link his existing account to my MCC instead of creating a new one?**
Yes. In your MCC → "+" → "Link existing account" → enter his Customer ID. His existing billing stays intact. You get management access, he keeps full ownership.

**Q: What if I want to manage billing centrally and invoice doctors myself?**
Use Consolidated Billing — your MCC pays for all sub-accounts and receives one invoice. You then invoice each doctor separately. This is more work and not recommended unless you have a specific reason.

**Q: If a doctor leaves, what happens to the sub-account?**
The sub-account stays in your MCC. You pause all campaigns. The conversion history and audience data are preserved. You can transfer the account back to the doctor if needed via a Billing Transfer.

**Q: Does the doctor need to do anything on the tusalud.pro side?**
No. Once you add the `AW-XXXXXXXXXX` ID in admin, everything is automatic. The site handles the rest.

---

## Key Google Ads Terms

| Term | Definition |
|---|---|
| **MCC / Manager Account** | Master account that manages multiple sub-accounts |
| **Sub-account** | Individual Google Ads account for one doctor |
| **Customer ID** | The `XXX-XXX-XXXX` number identifying a Google Ads account |
| **AW-XXXXXXXXXX** | The conversion tracking format of a Customer ID (used in gtag) |
| **Billing Setup** | The link between a Google Ads account and a Payments account |
| **Payments Profile** | The entity (doctor) legally responsible for costs; holds card details |
| **Independent Billing** | Each sub-account has its own billing — doctor pays Google directly |
| **Consolidated Billing** | Manager pays for all sub-accounts, receives one combined invoice |
| **Conversion Action** | A specific action tracked in Google Ads (e.g. `contact_click`) |
| **Conversion Label** | The identifier of a specific conversion action (used in `send_to`) |
| **gclid** | Google Click ID — appended to URLs when someone clicks an ad |
| **Quality Score** | Google's rating of ad relevance; improves over time with account history |
| **Smart Bidding** | Automated bidding that optimizes toward conversions — requires conversion data |
