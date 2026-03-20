# Google Ads — Create a Doctor Sub-Account Step by Step

**Last Updated:** 2026-03-19

---

## Billing — The Doctor Always Pays, Not You

This is the most important thing to understand before starting.

**You never need to add a payment method.** The doctor adds his own card directly to his sub-account. Google charges him. You are never involved in billing.

### Why this matters during setup

Google's account creation flow forces you through a campaign wizard that ends with a payment step. If your card fails or you skip it, the account gets created but stays in an **incomplete state** — and Google then blocks you from doing anything else in the account (adding users, managing campaigns) until billing is resolved.

The way to avoid this entirely is to **add the doctor's Gmail during the setup flow itself** (Step 3 below). Google sends him an invitation email at that point, before billing is even required. He then logs in independently and adds his own card — which unblocks the account from his end.

### What happens if payment fails during setup

- The sub-account is still created and visible in your MCC ✓
- The draft campaign is stuck in incomplete state
- You cannot add users or do anything in the account
- **Solution:** contact the doctor, confirm he received the Google Ads invite email, ask him to log in at ads.google.com and go to Billing → Billing settings to add his card

### The correct billing flow

```
You create the sub-account
    │
    ▼
You enter doctor's Gmail during setup → Google sends him an invite
    │
    ▼
Doctor accepts invite → logs into ads.google.com
    │
    ▼
Doctor goes to Billing → Billing settings → adds his own card
    │
    ▼
Google charges the doctor directly — forever
You are never involved in billing again
```

---

## Overview

This guide walks through creating a new Google Ads sub-account for a doctor inside your Manager Account (MCC). Google forces you through a campaign creation flow to create the account — you cannot skip it. The strategy is to get through the flow with minimal real settings, create the account, and then **immediately pause the campaign** so nothing spends.

---

## Before You Start — What You Need

- The doctor's full name
- The doctor's public profile slug (e.g. `dr-jose-cruz-ruiz`)
- The doctor's Gmail address (to give him access to his account)
- A credit card to get through account creation (the doctor will replace it with his own later)
- A rough idea of which city/area the doctor works in

---

## Step 1 — Log Into Your Manager Account

1. Go to [ads.google.com](https://ads.google.com)
2. Sign in with the Google account that owns your Manager Account (MCC)
3. You should land on the MCC home screen showing a list of your sub-accounts

---

## Step 2 — Create a New Account

1. On the MCC home screen, click the **blue "+" button** (top left area near the account list)
2. A menu appears with three options:
   - Create new manager account
   - **Create new account** ← click this
   - Link existing account
3. Click **"Create new account"**

---

## Step 3 — Add Business Information

Google shows a form: *"Hi [Name] — Add your information to get started"*

Fill in:
- **Business name:** `Dr. [Full Name] - tusalud.pro`
  Example: `Dr. José Cruz Ruiz - tusalud.pro`
- **Website URL:** the doctor's public profile
  Format: `https://tusalud.pro/doctores/[slug]`
  Example: `https://tusalud.pro/doctores/dr-jose`
- **Phone number:** leave blank
- **Invite users:** enter the doctor's Gmail address, set role to **Admin**

Click **Next**.

---

## Step 4 — Describe the Business

Google shows: *"Describe your business to get better campaign suggestions"*

Google will have already pre-filled a description by scraping the doctor's profile page. It also auto-suggests product/service categories based on the profile content.

- **Leave everything as-is** — the pre-filled content is fine
- Scroll to the bottom and click **Next**

---

## Step 5 — Connect Accounts (Skip)

Google shows: *"Connect Dr. [Name] accounts — Bring in data like audiences and product listings"*

Options shown:
- YouTube channel
- Mobile app
- Google Business Profile
- Phone number

**Click "Skip"** — don't link anything here. These can be connected later if needed.

---

## Step 6 — Link Google Analytics (Important — Do Not Skip)

Google shows: *"We've found Google Analytics tags on your website!"*

It detects the GA4 property already installed on tusalud.pro and shows:
- `524946974 - Google Analytics (GA4)` (or your GA4 property ID)
- Toggle: **Import app and web metrics** → leave **On**
- Toggle: **Import Google Analytics audiences** → leave **On**

**Do not skip this.** Linking GA4 here means:
- Google Ads can see which ad clicks lead to profile visits
- Remarketing audiences from GA4 are available in this account
- Full traffic attribution works (which campaign → which profile view)

Click **Next** or **Save**.

---

## Step 7 — Choose a Campaign Goal

Google shows: *"Choose a goal for this campaign"*

Options:
- Purchases
- Submit lead form
- Phone call leads
- Page views
- Brand awareness

**Choose based on the doctor's main conversion:**

| Doctor's main action | Choose |
|---|---|
| Patients contact via WhatsApp / phone | **Page views** |
| Patients book online via tusalud.pro | **Purchases** |
| Not sure yet | **Page views** (safest default) |

After selecting, Google asks how to measure that goal:
- Select **"Use events from a linked Google Analytics 4 (GA4) property"**
- Choose **`profile_view`** from the dropdown

This tells Google Ads to optimize for people who actually land on the doctor's profile page using the GA4 event tusalud.pro fires automatically on every profile visit.

Click **Next**.

---

## Step 8 — Audience, Locations and Languages

Google shows: *"Describe who and where your ads should reach"*

**Search themes** — add relevant terms (examples for an ophthalmologist in Guadalajara):
- `oftalmólogo Guadalajara`
- `doctor ojos Guadalajara`
- `cirugía cataratas Guadalajara`
- `corrección visión Guadalajara`
- `oftalmólogo cerca de mí`

Adapt the terms to the doctor's specialty and city.

**Locations** — Google may auto-suggest locations based on the profile. Verify they match the doctor's actual coverage area (city + nearby municipalities).

**Languages** — Google defaults to English. Change it:
1. Click on Languages
2. Remove **English**
3. Add **Spanish**

Click **Next**.

---

## Step 9 — Generate Assets with AI (Skip)

Google shows: *"Let Google AI help you generate assets"* with a **Skip** option.

**Click "Skip"** — we don't need AI-generated assets right now. Ads will be set up properly later once the campaign strategy is defined.

---

## Step 10 — Create an Ad

Google shows a form to create the actual ad. There is no skip option — you must fill in the minimum required fields.

**Business name** (max 25 characters):
- Shorten to fit: `Dr. José Cruz Ruiz` ✓

**Headlines** — need minimum 3, max 30 characters each. Examples:
- `Oftalmólogo Guadalajara`
- `Dr. José Cruz Ruiz`
- `Agenda tu Cita Hoy`

Adapt to the doctor's specialty and city.

**Long headline** — max 90 characters. Example:
- `Especialista en cataratas, visión y cirugía ocular en Guadalajara`

**Descriptions** — need minimum 2, max 90 characters each. Examples:
- `Atención oftalmológica integral. Cirugía de cataratas y corrección de visión.`
- `Consultas y cirugías con el Dr. Cruz Ruiz. Agenda tu cita en línea.`

**Everything else — leave empty:**
- Images → skip
- Videos → skip
- Sitelinks → skip
- All other optional fields → skip

> These will be filled in properly when setting up the real campaign. For now the goal is just to get through account creation.

Click **Next**.

---

## Step 11 — Set Bid Strategy

Google shows: *"Set a bid strategy"*

- Select **"Conversions"**
- Leave the target cost per action **blank** — let Google optimize automatically at first
- After a few weeks of real data you can set a specific target CPA

Click **Next**.

---

## Step 12 — Set Daily Budget

Google shows: *"How much do you want to spend per day?"* with a recommended budget.

Since we are going to **immediately pause this campaign**, the budget doesn't matter. Set a minimal amount:

1. Click **"Set custom budget"**
2. Enter **MX$50**

Click **Next**.

---

## Step 13 — Add Payment Information and Launch

Google shows: *"Add payment information and launch your campaign"*

Fill in the non-payment fields first:
- **"Want personalized guidance by phone?"** → **No**
- **"Get tips by email?"** → **No**
- **"EU political ads?"** → **No**

**For the payment method:**

**If the doctor is present or on a call:**
Hand him the screen. He enters his own card directly. Google charges him, you never see the card details.

**If the doctor is not available:**
Enter your own card to complete account creation. The doctor will replace it with his own card later (see Step 15). Since we pause the campaign immediately in the next step, nothing gets charged.

Click **Submit** / **Launch**.

---

## Step 14 — Immediately Pause the Campaign

As soon as the account is created and you land on the campaign overview screen:

1. Find the campaign that was just created
2. Click the **green dot / status toggle** next to the campaign name
3. Select **"Pause"**
4. Confirm

The campaign is now paused. Nothing will spend. You have the account created and ready.

---

## Step 15 — Have the Doctor Add His Own Card

If you used your card in Step 13, the doctor needs to replace it:

1. Add the doctor as a user if not already done (he was invited in Step 3)
2. Ask him to log into [ads.google.com](https://ads.google.com) with his Gmail
3. He goes to **Billing → Billing settings**
4. He removes your card and adds his own
5. From this point Google charges him directly — you have no involvement in billing

---

## Step 16 — Copy the Account ID and Add It to Admin

1. In the sub-account, go to **Settings → Account settings** (or look at the top right corner)
2. Copy the **Customer ID** — format: `123-456-7890`
3. Convert it to Ads format: remove dashes, add `AW-` prefix → `AW-1234567890`
4. Log into the tusalud.pro admin panel
5. Go to **Doctors** → find the doctor → click the **Ads** button
6. Paste the `AW-XXXXXXXXXX` ID → Save

The site now automatically loads the doctor's Google Ads tag on every profile visit and fires conversion events to his account.

---

## Step 17 — Create the Conversion Actions

Inside the doctor's sub-account, create the two conversion actions that tusalud.pro fires:

**Conversion action 1 — Contact click:**
1. Go to **Goals → Conversions → New conversion action → Website**
2. Name: `contact_click`
3. Category: **Lead**
4. Count: **One** (one conversion per click)
5. Value: leave blank or set a fixed estimate
6. Click-through conversion window: 30 days
7. **Do not install the tag** — tusalud.pro already handles this

**Conversion action 2 — Booking complete:**
1. Go to **Goals → Conversions → New conversion action → Website**
2. Name: `booking_complete`
3. Category: **Purchase**
4. Count: **One**
5. Value: **Use different values for each conversion** (the site sends the appointment price)
6. Currency: **MXN**
7. **Do not install the tag** — tusalud.pro already handles this

Once these exist, every WhatsApp click and completed booking on the doctor's profile will register as a conversion in his Google Ads account.

---

## Step 18 — Set Up the Real Campaign

Now the account is ready. When you're ready to actually run ads:

1. Delete or repurpose the placeholder campaign created in the setup flow
2. Create a proper Search campaign from scratch with:
   - Correct keywords for the doctor's specialty and city
   - Proper ad copy reviewed with the doctor
   - Realistic budget agreed with the doctor
   - Correct location targeting
   - Conversion goal set to `contact_click` or `booking_complete`

---

## Summary Checklist

| Step | Done? |
|---|---|
| Sub-account created in MCC | ☐ |
| GA4 linked to sub-account | ☐ |
| Campaign paused immediately | ☐ |
| Doctor's card added (replaced yours if needed) | ☐ |
| `AW-XXXXXXXXXX` copied from sub-account | ☐ |
| ID pasted into doctor's profile in admin | ☐ |
| `contact_click` conversion action created | ☐ |
| `booking_complete` conversion action created | ☐ |
| Real campaign set up when ready | ☐ |

---

## Important Notes

- **The placeholder campaign created during setup does nothing useful** — pause it immediately and build a real one from scratch when ready
- **Never skip the GA4 linking step** — it enables traffic attribution and remarketing audiences
- **The doctor never needs to touch the campaign settings** — he only needs to add his payment method
- **Conversion actions must be named exactly** `contact_click` and `booking_complete` — these are hardcoded in tusalud.pro's analytics library
- **The `AW-XXXXXXXXXX` ID is account-level**, not campaign-level — it works across all campaigns in that sub-account
- **Changing the doctor's ID in admin takes effect immediately** — no redeploy needed
