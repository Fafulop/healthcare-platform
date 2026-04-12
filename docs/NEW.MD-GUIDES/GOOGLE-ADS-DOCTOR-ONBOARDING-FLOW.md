# Google Ads — New Doctor Onboarding Flow

**Last Updated:** 2026-04-12

> For full explanations of why each step works this way, see `GOOGLE-ADS-CREATE-DOCTOR-SUBACCOUNT.md`.

---

## PART 1 — DOCTOR

*Send this to the doctor. They do this once, takes ~15 minutes.*

---

### 1. Create a Google Ads account

1. Go to [ads.google.com](https://ads.google.com) signed in with your Gmail
2. If you already have a Google Ads account: click your **account name at the top → "+ Create new account"**
3. Go through Google's campaign wizard — fill in the minimum:
   - Website: your tusalud.pro profile URL (`https://tusalud.pro/doctores/[your-slug]`)
   - Headlines: your name and specialty
   - Descriptions: any sentence about your practice
   - Budget: $50 (does not matter, gets paused immediately)

### 2. Add your payment method

When Google asks for payment:
- If you already have another Google Ads account → select **"Use existing payments profile"**
- If this is your first account → enter your credit or debit card

> Google will charge this card for all future ad spend. The agency never sees your card details.

### 3. Pause the placeholder campaign

As soon as your account is created:
1. Find the campaign just created
2. Click the **green status dot** next to its name
3. Select **"Pause"** → Confirm

### 4. Send your Customer ID to the agency

1. Look at the **top right corner** of your Google Ads account
2. You will see a 10-digit number formatted like `XXX-XXX-XXXX` — that is your Customer ID
3. Send it to the agency (screenshot or copy-paste)

### 5. Accept the manager request

After the agency sends a link request from their side:
1. You will receive an **email from Google** about a manager request
2. In Google Ads: **Admin icon → Access and security → Managers tab**
3. Find the agency's account under **"Link requests"**
4. Click **Accept**

**Doctor's part is done.**

---

## PART 2 — MCC OWNER

*Do this after receiving the doctor's Customer ID.*

---

### 1. Send the manager link request

1. Log into your MCC at [ads.google.com](https://ads.google.com)
2. Click the **"+" button** in the accounts list
3. Select **"Link existing account"**
4. Enter the doctor's Customer ID (`XXX-XXX-XXXX`)
5. Click **Send request**
6. Notify the doctor so they accept (see Doctor Step 5 above)

### 2. Accept confirmation and locate the account

Once the doctor accepts, their account appears in your MCC list.

### 3. Link GA4

1. Navigate into the doctor's account from your MCC
2. **Tools → Linked accounts → Google Analytics**
3. Find `G-PM03GGVRZS` (tusalud.pro) → click **Link**
4. Select the tusalud.pro web stream → Confirm

### 4. Create conversion actions

**conversion action 1:**
- Goals → Conversions → New conversion action → Website
- Name: `contact_click` — Category: Lead — Count: One — Value: blank
- Do NOT install the tag

**Conversion action 2:**
- Goals → Conversions → New conversion action → Website
- Name: `booking_complete` — Category: Purchase — Count: One — Value: Different value per conversion — Currency: MXN
- Do NOT install the tag

### 5. Add the AW ID to tusalud.pro admin

1. In the doctor's account, copy the **Customer ID** from the top right (`XXX-XXX-XXXX`)
2. Convert it: remove dashes, add `AW-` prefix → `AW-XXXXXXXXXX`
3. tusalud.pro admin → **Doctors → [doctor] → Ads** → paste the ID → Save

### 6. Delete the placeholder campaign

Inside the doctor's account, delete the placeholder campaign created during setup.

### 7. Build the real campaign

Create a new Search campaign:

| Setting | Value |
|---|---|
| Goal | Conversions (`contact_click` or `booking_complete`) |
| Network | Search only |
| Location | Doctor's city + surrounding area |
| Language | Spanish |
| Bid strategy | Conversions — no target CPA for first 3–4 weeks |
| Daily budget | As agreed with the doctor |
| Final URL | `https://tusalud.pro/doctores/[slug]` |

---

## Checklist

| # | Step | Who | Done? |
|---|---|---|---|
| 1 | Google Ads account created | Doctor | ☐ |
| 2 | Payment method added | Doctor | ☐ |
| 3 | Placeholder campaign paused | Doctor | ☐ |
| 4 | Customer ID sent to agency | Doctor | ☐ |
| 5 | Manager link request sent from MCC | You | ☐ |
| 6 | Doctor accepted the manager request | Doctor | ☐ |
| 7 | GA4 linked to doctor's account | You | ☐ |
| 8 | `contact_click` conversion action created | You | ☐ |
| 9 | `booking_complete` conversion action created | You | ☐ |
| 10 | `AW-XXXXXXXXXX` ID added in tusalud.pro admin | You | ☐ |
| 11 | Placeholder campaign deleted | You | ☐ |
| 12 | Real campaign live | You | ☐ |
