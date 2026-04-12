# Google Ads — Onboard a Doctor Step by Step

**Last Updated:** 2026-04-12

---

## Part 1 — Understanding the Building Blocks

Google Ads is made up of 4 separate layers. Most confusion about billing comes from assuming these are the same thing — they are not.

```
Google Account (Gmail)
    └── Google Ads Account        ← where campaigns live
            └── Billing Setup     ← links the Ads account to a payer
                    └── Payments Profile   ← the actual payer: name, address, card
```

### Layer 1 — Google Account (Gmail)

This is just a Gmail. It is an identity. It does not have campaigns, budgets, or billing on its own. A person can have a Gmail without having any Google Ads account at all.

### Layer 2 — Google Ads Account

This is where campaigns, ad groups, keywords, and ads live. It has a **Customer ID** (format: `123-456-7890`). Every doctor needs one of these. Having an Ads account does not mean it has billing set up — a new account can exist with zero billing configured.

### Layer 3 — Billing Setup

This is the active connection between an Ads account and a Payments Profile. It defines:
- Which Payments Profile is responsible for this account's spend
- Which manager account (if any) administers the billing

There can only be **one active Billing Setup per Ads account at any time**. This is the layer most people skip thinking about, and it is the source of almost all billing problems.

### Layer 4 — Payments Profile

This is the actual payer. It contains:
- The legal name of the person or business being charged
- Their billing address
- Their payment instrument (credit card, debit card, bank account)
- Tax and contact information

A Payments Profile is created automatically the first time someone enters their card details in any Google product (Google Ads, Google Workspace, Google Cloud). One person can have one Payments Profile linked to many Ads accounts.

**One Payments Profile, multiple Ads accounts:** A doctor who already has an Ads account (and therefore already has a Payments Profile) does not need to enter their card again when creating a second account. During billing setup for the new account, Google offers the option to reuse the existing Payments Profile. Both Ads accounts are charged to the same card.

```
Doctor's Gmail
    ├── Ads Account A  (old account, unrelated to tusalud.pro)
    │       └── Billing Setup → Payments Profile (Dr. Ríos, Visa ending 4242)
    │
    └── Ads Account B  (new account for tusalud.pro)
            └── Billing Setup → same Payments Profile (Dr. Ríos, Visa ending 4242)
```

### How They Connect

```
Dr. García's Gmail
    └── Dr. García's Google Ads Account  (Customer ID: 456-789-0123)
            └── Billing Setup  (created when Dr. García entered his card)
                    └── Dr. García's Payments Profile  (his name, address, card)

Your MCC (Manager Account)
    └── Linked to Dr. García's Ads Account as manager
            └── You can create/edit/pause all campaigns
            └── You are NOT connected to his Billing Setup at all
```

**The Paying Manager** is the account responsible for the billing setup. In this model, Dr. García's own account is the paying entity — not your MCC. Your MCC only has management access.

---

## Part 2 — The Three Possible Structures

There are three ways an agency can manage Google Ads campaigns for a client. Here is what each one means and why we chose the one we did.

---

### Structure A — Client creates account, invites agency as manager ✅ Chosen

```
Doctor creates their own Google Ads account
    └── Doctor's card is added → Payments Profile created → Doctor is the payer
    └── Doctor invites your MCC as manager
            └── You accept the invite
            └── You manage all campaigns from your MCC
            └── Doctor receives all Google invoices directly
            └── You never appear in their billing at all
```

**How billing works:** Google charges the doctor's card directly. You have zero involvement in their billing. If the doctor's card fails, their campaigns pause — it does not affect your MCC or any other doctor's account.

**Pros:**
- Doctor owns and pays for their account from day one — no transfers, no workarounds
- You manage campaigns without ever being the payer
- Clean legal separation: doctor's financial relationship with Google is direct
- If a doctor leaves, you simply remove manager access — nothing else changes
- One doctor's billing problem cannot cascade to others

**Cons:**
- Doctor must do a one-time 15-minute setup (create account, add card, send invite)
- Requires coordination — you cannot do it entirely yourself

---

### Structure B — Agency creates sub-account in MCC, billing transferred later ❌ Not recommended

```
Your MCC creates a new sub-account
    └── Your MCC becomes the "Paying Manager" automatically ← the problem
    └── Your card gets charged
    └── You initiate a Billing Transfer
            └── Google emails the doctor
            └── Doctor must accept the email AND create a Payments Profile
            └── Only after acceptance: doctor's card replaces yours
```

**Why this causes problems:** When you create an account inside your MCC, Google automatically assigns your MCC as the Paying Manager. The doctor's billing panel inside the sub-account is **greyed out** — they literally cannot change it without a formal transfer that you initiate and they accept. This is the root cause of charges landing on your card in the old setup.

**Additional problem:** The billing transfer requires the doctor to already have a Payments Profile. If they have never used Google Ads before, they do not have one. They need to create one first — which requires the same effort as just creating their own account (Structure A). So this structure has all the work of Structure A plus extra steps.

**Pros:**
- You control the account from the start, before the doctor does anything
- Account lives inside your MCC hierarchy

**Cons:**
- Your card gets charged immediately, even before the transfer
- Doctor must accept a transfer email — if they ignore it, your card stays charged
- More steps than Structure A for the same end result
- If transfer fails or stalls, you are liable for spend

---

### Structure C — Agency creates sub-account using client's pre-linked Payments Profile ❌ Too complex

```
Doctor already has a Payments Profile (from an existing Ads account or Google Workspace)
    └── Doctor grants your MCC "link-management permission" on their profile
            └── You create a sub-account in your MCC
                    └── During billing setup, you select the doctor's Payments Profile
                            └── Doctor pays from day one
                            └── Account lives inside your MCC
```

**Why this is not practical for most doctors:** Doctors who have never used Google Ads do not have a Payments Profile. The only way to get one is to either create a Google Ads account (same effort as Structure A) or pay for another Google service (Workspace, Cloud). Additionally, "link-management permission" is an advanced billing setting most doctors will not know how to configure. This structure is designed for sophisticated clients or agencies with existing relationships.

**Pros:**
- Account lives in your MCC hierarchy from the start
- Doctor pays from day one without a transfer

**Cons:**
- Requires the doctor to already have a Payments Profile
- Requires the doctor to grant "link-management permission" — a non-trivial step for a non-technical person
- No real advantage over Structure A for this use case

---

### Why We Chose Structure A

| Criteria | Structure A | Structure B | Structure C |
|---|---|---|---|
| Doctor pays from day one | ✅ | ❌ (transfer needed) | ✅ |
| Your card is never at risk | ✅ | ❌ | ✅ |
| Works for doctors with no prior Google Ads | ✅ | ✅ (with extra steps) | ❌ |
| Doctor setup effort | 15 min once | 15 min + accept email | 15 min + permissions step |
| You can manage all campaigns from MCC | ✅ | ✅ | ✅ |
| Complexity | Low | Medium | High |

Structure A requires the least coordination, puts billing risk on zero parties other than the doctor, and works for any doctor regardless of whether they have ever used Google Ads before.

---

## Part 3 — Step-by-Step: Onboarding a New Doctor

---

### DOCTOR SIDE — Steps the doctor completes (15 minutes)

Send the doctor these steps or walk them through it on a call.

---

#### If the doctor already has a Google Ads account

Some doctors may have run ads before and already have an Ads account linked to their Gmail. They do not use that account — they create a fresh one for tusalud.pro. Here is how:

1. Go to [ads.google.com](https://ads.google.com) — Google lands them inside their existing account
2. Click the **account name / switcher** at the very top of the page
3. A dropdown appears showing all their current accounts
4. At the bottom of the dropdown: click **"+ Create new account"**
5. Google runs the same campaign wizard as a brand new user

When they reach the billing step, Google will offer:
- **"Use existing payments profile"** — their card is already on file, select this
- **"Create new payments profile"** — only if they want a different card for tusalud.pro

In most cases they select **"Use existing payments profile"** — no need to re-enter their card.

---

#### Step 1 — Create a Google Ads account

1. Open [ads.google.com](https://ads.google.com) while signed in with their Gmail
2. Google starts an account creation wizard — go through it

**Getting through the campaign wizard:**

Google forces every new account through a campaign creation flow. Fill in the minimum to get through it — this campaign gets deleted right after.

- **Campaign goal:** choose anything ("Get more website traffic" is fine)
- **Website:** their tusalud.pro profile URL: `https://tusalud.pro/doctores/[slug]`
- **Ad content:** fill in minimum fields with placeholder text (name + specialty as headline, any sentence as description)
- **Budget:** set MX$50 — does not matter, campaign gets paused immediately

#### Step 2 — Add their payment method

When Google asks for a payment method, the doctor enters their own credit or debit card. This step:
- Creates their **Payments Profile** (their name, address, and card on file with Google)
- Makes them the permanent payer for this account

This is the binding step. From this moment, Google charges them — not you, not ever.

#### Step 3 — Pause the placeholder campaign immediately

As soon as the account is created and they land on the campaigns screen:

1. Click the **status dot** next to the placeholder campaign
2. Select **"Pause"**
3. Confirm

Nothing will spend. The account is ready.

#### Step 4 — Invite your MCC as a manager

> **Important:** This is NOT the same as inviting an individual Gmail user. The doctor is linking to your **Manager Account (MCC)** — an organization-level entity identified by a Customer ID, not an email address. See the full explanation below.

##### How to send the invite (exact steps)

1. In their Google Ads account, click the **Admin icon** (gear/wrench) in the left-side navigation
2. Select **"Access and security"**
3. Click the **"Managers" tab** — this is a separate tab from "Users". Do not use the Users tab.
4. Click the **"+" button**
5. Enter your MCC **Customer ID** — format: `XXX-XXX-XXXX` (10 digits)
6. Click **"Send request"**

Google sends a notification to your MCC. The doctor's part is now completely finished.

##### What the doctor will see after sending

Under the Managers tab, your MCC appears with status **"Pending"** until you accept from your side. The doctor does not need to do anything else.

---

#### Understanding: Manager Account invite vs. individual user invite

These are two different mechanisms. It is important to know the difference:

| | Inviting an individual user | Linking a Manager Account (MCC) |
|---|---|---|
| **Found under** | Access and security → **Users tab** | Access and security → **Managers tab** |
| **Identified by** | Email address (Gmail) | Customer ID (XXX-XXX-XXXX) |
| **Who gets access** | That one person only | Your entire MCC — any of your team members you assign to that account |
| **Used for** | Colleagues, contractors, individual people | Agencies managing campaigns professionally |
| **Billing implications** | Depends on access level given | Linking an MCC does not give billing access by default |

The doctor uses the **Managers tab** and enters your **Customer ID** — not an email address.

---

#### Understanding: Access levels

When an individual user is invited (Users tab), the account owner chooses an access level. For MCC links, the access level is managed internally by the MCC — but it is still important to understand what each level means so the doctor knows what they are granting.

| Access Level | Can manage campaigns | Can view reports | Can view billing | Can edit billing | Can manage users | Can link/unlink MCCs |
|---|---|---|---|---|---|---|
| **Admin** | Yes | Yes | Yes | Yes | Yes | Yes |
| **Standard** | Yes | Yes | Yes (view only) | No | No | No |
| **Read Only** | No | Yes | No | No | No | No |
| **Billing** | No | No | Yes | Yes | No | No |
| **Email Only** | No | No | No | No | No | No |

**The correct access level for your MCC is Standard.** This gives full campaign management (create, edit, pause, delete campaigns, ad groups, ads, keywords, adjust bids and budgets) without any ability to touch billing or add/remove other users.

When the MCC link is established, you — as the MCC admin — assign **Standard** access to your team members for that doctor's account from inside your MCC. The doctor does not control your internal team structure.

The doctor retains **Admin** access to their own account at all times. They can:
- See everything you do in their account via **Tools → Change history**
- Remove your MCC access at any time from the Managers tab
- Change their own billing, payment method, and account settings

They cannot accidentally lose access to their own account because you are only a manager, not the owner.

---

Done — the doctor's part is finished.

---

### YOUR SIDE — Steps you complete after receiving the invite

#### Step 5 — Accept the manager invite

1. Log into your MCC at [ads.google.com](https://ads.google.com)
2. Check the notification bell or go to **Accounts → Manager account settings**
3. Find the pending invitation from the doctor's account
4. Accept it

The doctor's account now appears in your MCC account list. You have full campaign management access.

#### Step 6 — Link GA4 to the doctor's account

This enables traffic attribution (which ad → which profile visit → which booking) and makes GA4 audiences available for remarketing. Do not skip this.

1. Inside the doctor's account in your MCC, go to **Tools → Linked accounts → Google Analytics**
2. Find the tusalud.pro GA4 property (`G-PM03GGVRZS`)
3. Click **Link**
4. Select the web data stream for tusalud.pro
5. Confirm

#### Step 7 — Create the two conversion actions

tusalud.pro fires conversion events automatically when patients click WhatsApp or complete a booking. These conversion actions must exist in the Ads account for Google to record them.

**Conversion action 1 — Contact click:**

1. Go to **Goals → Conversions → New conversion action → Website**
2. Name: `contact_click`
3. Category: **Lead**
4. Count: **One**
5. Value: leave blank or set a fixed estimate
6. Click-through window: 30 days
7. **Do not install the tag** — tusalud.pro already handles this

**Conversion action 2 — Booking complete:**

1. Go to **Goals → Conversions → New conversion action → Website**
2. Name: `booking_complete`
3. Category: **Purchase**
4. Count: **One**
5. Value: **Use different values for each conversion** (the site sends the appointment price dynamically)
6. Currency: **MXN**
7. **Do not install the tag** — tusalud.pro already handles this

> The names must be exactly `contact_click` and `booking_complete` — they are hardcoded in tusalud.pro's analytics library. Any variation causes events to fire silently but Google discards them with no error.

#### Step 8 — Copy the account ID and add it to admin

1. In the doctor's account, look at the top-right corner or go to **Settings → Account settings**
2. Copy the **Customer ID** — format: `123-456-7890`
3. Convert to Ads format: remove dashes, add `AW-` prefix → `AW-1234567890`
4. Log into the tusalud.pro admin panel
5. Go to **Doctors** → find the doctor → click the **Ads** button
6. Paste the `AW-XXXXXXXXXX` ID → Save

The site now loads the doctor's Ads tag on every profile visit and fires conversion events to their account automatically. No redeploy needed.

#### Step 9 — Delete the placeholder campaign and build the real one

1. Delete the placeholder campaign created during account setup (Step 1)
2. Create a new Search campaign from scratch:

| Setting | Value |
|---|---|
| Campaign goal | Conversions |
| Conversion action | `contact_click` or `booking_complete` |
| Network | Search only (uncheck Display) |
| Location | Doctor's city + surrounding municipalities |
| Language | Spanish (remove English) |
| Bid strategy | Conversions — leave target CPA blank for first 2–4 weeks |
| Daily budget | As agreed with the doctor |
| Final URL | `https://tusalud.pro/doctores/[slug]` |

**Example keywords for an ophthalmologist in Guadalajara:**
- `oftalmólogo Guadalajara`
- `doctor ojos Guadalajara`
- `cirugía cataratas Guadalajara`
- `corrección visión Guadalajara`
- `oftalmólogo cerca de mí`

Adapt specialty and city to each doctor.

---

## Summary Checklist

| Step | Who | Done? |
|---|---|---|
| Google Ads account created at ads.google.com | Doctor | ☐ |
| Doctor's own card added as payment method | Doctor | ☐ |
| Placeholder campaign paused | Doctor | ☐ |
| MCC manager invite sent | Doctor | ☐ |
| Manager invite accepted from MCC | You | ☐ |
| GA4 (`G-PM03GGVRZS`) linked to doctor's account | You | ☐ |
| `contact_click` conversion action created | You | ☐ |
| `booking_complete` conversion action created | You | ☐ |
| `AW-XXXXXXXXXX` ID pasted into tusalud.pro admin | You | ☐ |
| Placeholder campaign deleted | You | ☐ |
| Real Search campaign created and live | You | ☐ |

---

## Important Notes

- **The doctor owns the account** — you manage it but they own it. This is correct and intentional.
- **You never touch their billing** — Google charges the doctor's card directly. You have no role in their payments.
- **The `AW-XXXXXXXXXX` ID is account-level** — one ID covers all campaigns inside that account.
- **GA4 must be linked per account** — you must repeat Step 6 for each new doctor.
- **New account = zero history** — Google's algorithm takes 2–4 weeks to optimize. Expect higher costs and lower performance initially.
- **Conversion actions must exist before campaigns go live** — if you launch campaigns before creating the conversion actions, Google cannot optimize toward conversions and Smart Bidding will not work.

---

## Fixing Existing Accounts (Where Your Card Is Being Charged)

If you already created accounts from inside your MCC and your card is being charged, the fix is a **Billing Transfer**. This is a formal process where you reassign the billing responsibility from your account to the doctor's.

1. In your MCC, navigate into the affected doctor's account
2. Go to **Billing → Billing transfers**
3. Click **"Change who pays"** (pencil icon)
4. Choose **"Create new billing setup"**
5. Set the transfer date to **"As soon as possible"**
6. Save

Google sends the doctor an email invitation. **The transfer is not final until the doctor accepts it.** Until accepted, your card continues to be charged.

After the doctor accepts:
- They are prompted to enter their own card
- From that point, Google charges them directly
- Your card is removed from their billing

Do not run active campaigns on affected accounts until the transfer is accepted and the doctor has added their own card.
