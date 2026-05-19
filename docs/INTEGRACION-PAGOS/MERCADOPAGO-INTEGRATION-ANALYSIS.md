# Mercado Pago Integration Analysis — Deep Dive

**Date:** May 18, 2026
**Project:** Healthcare Platform (docs-front)
**Objective:** Evaluate Mercado Pago as a payment provider alongside Stripe Connect, understand the marketplace model, API capabilities, fees, and determine the best integration strategy for doctors receiving payments from patients.

---

## 1. MERCADO PAGO vs STRIPE — HIGH-LEVEL COMPARISON

| Aspect | Stripe Connect (current) | Mercado Pago Marketplace |
|--------|--------------------------|--------------------------|
| **Model** | Express connected accounts | OAuth-linked seller accounts |
| **Onboarding** | Stripe-hosted KYC (INE, CLABE, RFC) | MercadoPago account + OAuth consent |
| **Payment page** | Stripe-hosted checkout | MercadoPago-hosted checkout (Checkout Pro) or on-site (Checkout API) |
| **Payment methods** | Cards, OXXO, Apple/Google Pay | Cards, OXXO, SPEI, Paycash, Citibanamex, BBVA, Santander, Meses sin Tarjeta, Saldo MP |
| **SPEI support** | NO (not with Payment Links) | YES (native) |
| **Meses sin intereses** | Limited | Native ("Meses sin Tarjeta" included) |
| **Saldo de cuenta** | N/A | Patients can pay with MP balance |
| **Mexico market penetration** | Growing | Dominant (~60%+ of online payments) |
| **SDK** | `stripe` npm (server-side) | `mercadopago` npm v2.12.1 (server-side) + frontend JS SDK |
| **Platform fee** | `application_fee_percent` on Payment Links | `marketplace_fee` (Checkout Pro) or `application_fee` (Checkout API) |
| **Webhook signature** | `stripe-signature` header (HMAC) | `x-signature` header (HMAC-SHA256) |
| **Seller dashboard** | Express Dashboard (limited) | Full MercadoPago account (complete) |
| **Payouts** | Automatic daily (2-day delay) | Automatic (varies by account age) |
| **Node.js requirement** | Any | Node 16+ |

### Key Advantage: Payment Methods

Mercado Pago's biggest advantage for Mexico is **SPEI (bank transfers)** and **saldo de cuenta Mercado Pago**. Many patients already have MP accounts. Stripe does NOT support SPEI with Payment Links.

---

## 2. MERCADO PAGO ARCHITECTURE

### 2.1 Products Available

| Product | Description | Best For |
|---------|-------------|----------|
| **Checkout Pro** | Redirect to MP-hosted payment page | Simplest integration, all payment methods |
| **Checkout API (Orders)** | On-site payment form, full control | Custom UX, no redirect |
| **Checkout Bricks** | Modular UI components | Middle ground between Pro and API |
| **Payment Links (manual)** | Dashboard-generated links | No-code, manual use |
| **Subscriptions** | Recurring payments | Membership plans |

**Recommendation for our use case: Checkout Pro with Marketplace mode** — mirrors our Stripe approach (redirect-based, doctor-specific accounts) while giving access to all Mexican payment methods including SPEI.

### 2.2 Marketplace Model (equivalent to Stripe Connect)

```
Doctor App                    API App                     Mercado Pago
    |                            |                            |
    |-- "Conectar MP" ---------->|                            |
    |                            |-- OAuth redirect URL ------>|
    |<-- Redirect to MP login ---|                            |
    |                            |                            |
    |   (Doctor logs into MP     |                            |
    |    and authorizes app)     |                            |
    |                            |                            |
    |                            |<-- Authorization code ------|
    |                            |-- Exchange for token ------>|
    |                            |<-- access_token (180 days) -|
    |                            |                            |
    |-- "Crear cobro" --------->|                            |
    |                            |-- Create Preference ------->|
    |                            |   (using seller's token)    |
    |                            |<-- Checkout URL ------------|
    |<-- Share URL --------------|                            |
    |                            |                            |
    |                            |<-- Webhook: payment --------|
    |                            |-- Update booking status ----|
```

### 2.3 How It Differs from Stripe Connect

| Aspect | Stripe Connect | MP Marketplace |
|--------|---------------|----------------|
| **Account creation** | Platform creates account via API | Doctor already has MP account, just authorizes via OAuth |
| **KYC** | Stripe handles during onboarding | Already done when doctor created their MP account |
| **Credential type** | `stripeAccountId` (permanent) | `access_token` (180 days) + `refresh_token` |
| **Token renewal** | Not needed | Must refresh every 180 days |
| **Payment creation** | Payment Link on connected account | Preference with seller's `access_token` |
| **Fee collection** | `application_fee_percent` | `marketplace_fee` (absolute amount in preference) |
| **Funds flow** | Direct charge → connected account | Payment → seller's MP account (minus fees) |

---

## 3. API REFERENCE

### 3.1 Base URL

```
https://api.mercadopago.com
```

All requests require `Authorization: Bearer <ACCESS_TOKEN>` header.

### 3.2 Core Endpoints We Need

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/oauth/token` | POST | Exchange auth code for access_token, refresh tokens |
| `/checkout/preferences` | POST | Create payment preference (payment link equivalent) |
| `/checkout/preferences/{id}` | GET | Get preference details |
| `/checkout/preferences/{id}` | PUT | Update preference |
| `/v1/payments/{id}` | GET | Get payment details (after webhook) |
| `/v1/payments/search` | GET | Search payments |
| `/v1/payment_methods` | GET | List available payment methods |
| `/v1/refunds` | POST | Create refund |
| `/v1/chargebacks/{id}` | GET | Get chargeback details |

### 3.3 OAuth Flow (Seller Onboarding)

#### Step 1: Redirect Doctor to MP Authorization

```
https://auth.mercadopago.com/authorization?client_id=APP_ID&response_type=code&platform_id=mp&state=RANDOM_ID&redirect_uri=https://your-api.com/api/mercadopago/oauth/callback
```

| Parameter | Description |
|-----------|-------------|
| `client_id` | Your MP application ID |
| `response_type` | Always `code` |
| `platform_id` | Always `mp` |
| `state` | Random unique ID (CSRF protection) |
| `redirect_uri` | Must match app config exactly |

Optional PKCE parameters (recommended):
- `code_challenge` — SHA256-encoded Base64URL of `code_verifier`
- `code_challenge_method` — `S256` or `Plain`

#### Step 2: Exchange Authorization Code for Token

```typescript
// POST https://api.mercadopago.com/oauth/token
{
  "client_id": "YOUR_APP_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTHORIZATION_CODE",        // from redirect, valid 10 minutes
  "grant_type": "authorization_code",
  "redirect_uri": "YOUR_REDIRECT_URI",
  "code_verifier": "YOUR_VERIFIER"      // if using PKCE
}

// Response:
{
  "access_token": "APP_USR-...",         // valid 180 days
  "token_type": "Bearer",
  "expires_in": 15552000,               // 180 days in seconds
  "scope": "read write offline_access",
  "user_id": 123456789,                 // seller's MP user ID
  "refresh_token": "TG-...",
  "public_key": "APP_USR-..."
}
```

#### Step 3: Refresh Token (before 180-day expiry)

```typescript
// POST https://api.mercadopago.com/oauth/token
{
  "client_id": "YOUR_APP_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "grant_type": "refresh_token",
  "refresh_token": "TG-..."
}
```

**CRITICAL difference from Stripe:** Stripe account IDs are permanent. MP access tokens expire every 180 days and MUST be refreshed. Need a cron job or proactive refresh strategy.

### 3.4 Creating a Payment Preference (Payment Link Equivalent)

```typescript
// POST https://api.mercadopago.com/checkout/preferences
// Authorization: Bearer SELLER_ACCESS_TOKEN  (NOT platform token)

{
  "items": [
    {
      "id": "consulta-123",
      "title": "Consulta Médica - Dr. García",
      "description": "Consulta de cardiología",
      "quantity": 1,
      "unit_price": 1000,
      "currency_id": "MXN"
    }
  ],
  "payer": {
    "name": "Juan",
    "surname": "Pérez",
    "email": "paciente@email.com"
  },
  "back_urls": {
    "success": "https://doctor-app.com/pagos?status=success",
    "failure": "https://doctor-app.com/pagos?status=failure",
    "pending": "https://doctor-app.com/pagos?status=pending"
  },
  "auto_return": "approved",
  "notification_url": "https://api-app.com/api/mercadopago/webhook?doctor_id=xxx",
  "external_reference": "booking-abc123",
  "marketplace_fee": 50,              // Platform fee in MXN (absolute, not %)
  "payment_methods": {
    "excluded_payment_types": [],
    "excluded_payment_methods": [],
    "installments": 12,               // Max installments allowed
    "default_installments": 1
  },
  "binary_mode": false,               // true = only approved/rejected (no pending)
  "expires": true,
  "expiration_date_from": "2026-05-18T00:00:00.000-05:00",
  "expiration_date_to": "2026-05-25T23:59:59.000-05:00"
}

// Response:
{
  "id": "787997534-6dad21a1-6145-4f0d-ac21-66bf7a5e7a58",
  "init_point": "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=787997534-...",
  "sandbox_init_point": "https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=787997534-...",
  // ... all fields echoed back
}
```

**`init_point`** is the URL to share with patients — equivalent to Stripe's Payment Link URL.

### 3.5 Key Preference Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | YES | Products/services (title, quantity, unit_price, currency_id) |
| `items[].id` | string | NO | Your internal ID for the item |
| `items[].title` | string | YES | What the patient sees |
| `items[].quantity` | number | YES | Always 1 for consultations |
| `items[].unit_price` | number | YES | Amount in MXN |
| `items[].currency_id` | string | YES | `"MXN"` for Mexico |
| `payer` | object | NO | Pre-fill patient info (email, name) |
| `back_urls` | object | NO | Redirect URLs after payment (success/failure/pending) |
| `auto_return` | string | NO | `"approved"` — auto-redirect on success |
| `notification_url` | string | NO | Webhook URL for this specific preference |
| `external_reference` | string | NO | Your internal reference (booking ID) |
| `marketplace_fee` | number | NO | Platform commission in MXN (absolute amount) |
| `payment_methods` | object | NO | Restrict/configure payment methods |
| `binary_mode` | boolean | NO | `true` = no pending status, only approved/rejected |
| `expires` | boolean | NO | Whether the preference expires |
| `expiration_date_from` | string | NO | ISO 8601 datetime |
| `expiration_date_to` | string | NO | ISO 8601 datetime |

---

## 4. WEBHOOKS

### 4.1 Available Events (relevant to our integration)

| Topic | Event | Description |
|-------|-------|-------------|
| `payment` | `payment.created` | New payment attempt |
| `payment` | `payment.updated` | Payment status changed (approved, rejected, refunded) |
| `topic_merchant_order_wh` | — | Order status changes |
| `topic_chargebacks_wh` | — | Chargeback created/updated |
| `topic_claims_integration_wh` | — | Dispute/claim opened |
| `mp-connect` | — | OAuth account linked/unlinked |
| `stop_delivery_op_wh` | — | Fraud alert — stop delivery |

### 4.2 Webhook Payload

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "date_created": "2026-05-18T10:04:58.396-05:00",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.updated",
  "data": {
    "id": "999999999"
  }
}
```

**Important:** The webhook only sends the `data.id` — you must query the full payment details:

```typescript
// GET https://api.mercadopago.com/v1/payments/999999999
// Authorization: Bearer SELLER_ACCESS_TOKEN

// Response includes: status, status_detail, transaction_amount, payment_method_id, etc.
```

### 4.3 Payment Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| `approved` | Payment completed | Mark as PAID, notify doctor |
| `pending` | Awaiting payment (OXXO, SPEI) | Keep as PENDING |
| `in_process` | Being reviewed (fraud check) | Keep as PENDING |
| `rejected` | Payment declined | Keep as PENDING (patient can retry) |
| `refunded` | Full refund issued | Mark as REFUNDED |
| `cancelled` | Payment cancelled | Mark as CANCELLED |
| `charged_back` | Chargeback initiated | Notify doctor |

### 4.4 Signature Verification

```typescript
// x-signature header format:
// ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839

import crypto from 'crypto';

function verifyWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  // 1. Parse header
  const parts = xSignature.split(',');
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
  const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  // 2. Build manifest template
  // Format: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // 3. Generate HMAC-SHA256
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // 4. Compare
  return hmac === v1;
}
```

### 4.5 Webhook Configuration

Two methods:
1. **Dashboard:** Configure globally in "Tus integraciones" (test + production URLs)
2. **Per-preference:** Set `notification_url` when creating the preference

For marketplace, use `notification_url` on each preference with a query param to identify the doctor:
```
https://api.tusitio.com/api/mercadopago/webhook?doctor_id=abc123
```

### 4.6 Retry Policy

- Must respond with HTTP 200/201 within **22 seconds**
- First retry: **15 minutes** after no response
- Continues retrying with increasing intervals after 3rd attempt

---

## 5. FEE STRUCTURE — MERCADO PAGO MEXICO

> **Note:** Exact rates may vary. These are the publicly documented rates as of May 2026. Verify at mercadopago.com.mx/ayuda/costo-recibir-pagos_220.

### 5.1 Estimated Commission Rates

| Method | MP Fee (estimated) | Notes |
|--------|--------------------|-------|
| National debit card | ~2.49% + $4.00 MXN | Visa, MC, Carnet |
| National credit card | ~3.49% + $4.00 MXN | Visa, MC, Amex |
| International card | ~4.49% + $4.00 MXN | Cards issued outside Mexico |
| OXXO | ~3.49% + $4.00 MXN | Cash payment at convenience store |
| SPEI | ~2.49% + $4.00 MXN | Bank transfer |
| Saldo Mercado Pago | ~3.49% + $4.00 MXN | Patient's MP balance |
| Meses sin Tarjeta | Higher rate | MP's buy-now-pay-later product |

### 5.2 Comparison with Stripe Mexico

| Method | Stripe | Mercado Pago (est.) | Winner |
|--------|--------|---------------------|--------|
| National card | 3.6% + $3 MXN | ~3.49% + $4 MXN | Similar |
| International card | 4.5% + $3 MXN | ~4.49% + $4 MXN | Similar |
| OXXO | $10 MXN flat | ~3.49% + $4 MXN | Stripe (for high amounts) |
| SPEI | NOT AVAILABLE | ~2.49% + $4 MXN | **MP (exclusive)** |
| Apple/Google Pay | 3.6% + $3 MXN | Via cards (same) | Similar |
| MP Balance | N/A | ~3.49% + $4 MXN | **MP (exclusive)** |
| Chargeback | $150 MXN | Varies | — |

### 5.3 Payout Timing

| Scenario | Timing |
|----------|--------|
| Cards (approved) | Available in MP balance immediately, withdrawal to bank in 1-2 business days |
| OXXO | Available after confirmation (next business day) |
| SPEI | Available after confirmation (minutes to hours) |
| New accounts | First withdrawal may take 7+ days |
| Withdrawal to bank | Doctors do this from their own MP account |

---

## 6. PAYMENT METHODS DEEP DIVE

### 6.1 Methods Available via Checkout Pro (Mexico)

| Method | Type | Confirmation | Patient Experience |
|--------|------|-------------|-------------------|
| Visa / Mastercard (debit) | Card | Instant | Enter card details on MP page |
| Visa / Mastercard (credit) | Card | Instant | Enter card details, optional MSI |
| American Express | Card | Instant | Enter card details |
| Carnet | Card (Mexican) | Instant | Mexican debit network |
| SPEI | Bank transfer | Minutes-hours | Patient gets CLABE + reference, pays from banking app |
| OXXO | Cash voucher | Next business day | Patient gets voucher, pays at OXXO store |
| Paycash | Cash | Next business day | Pay at convenience stores |
| Citibanamex | Bank | Hours | Bank-specific flow |
| BBVA Bancomer | Bank | Hours | Bank-specific flow |
| Santander | Bank | Hours | Bank-specific flow |
| Saldo Mercado Pago | Digital wallet | Instant | Patient pays from MP balance |
| Meses sin Tarjeta | BNPL | Instant | MP's installment product (no credit card needed) |

### 6.2 SPEI — The Killer Feature

SPEI is Mexico's real-time interbank transfer system. **This is the #1 reason to add MP alongside Stripe.**

- Available to anyone with a Mexican bank account (universal coverage)
- Near-instant confirmation
- Lower fees than cards
- No card needed — patient just transfers from their banking app
- Stripe does NOT support SPEI with Payment Links

### 6.3 Meses sin Tarjeta

MP's proprietary buy-now-pay-later product. Patients can pay in installments without a credit card — using only their MP account and CLABE. This is unique to Mercado Pago and very popular in Mexico.

---

## 7. PROPOSED INTEGRATION PLAN

### 7.1 Architecture Decision: Checkout Pro + Marketplace + Separate Tables

**Why Checkout Pro (not Checkout API):**
- Mirrors our Stripe approach — redirect-based, no PCI scope
- All payment methods available automatically (SPEI, OXXO, cards, MP balance)
- MP handles the entire payment page (less code to maintain)
- Mobile-optimized checkout out of the box

**Why Marketplace model:**
- Each doctor has their own MP account
- Platform can charge a commission via `marketplace_fee`
- Payments go directly to doctor's MP account
- Equivalent to our Stripe Connect Express model

**Why separate tables (not unified PaymentLink):**
- Existing `PaymentLink` model is tightly coupled to Stripe (has `stripePaymentLinkId`, `stripePaymentLinkUrl`)
- MP preferences have different fields (preference ID, init_point, payment method tracking, external_reference)
- Avoids risky migration on a production table with live data
- Keeps each provider's code and data independent — easier to maintain/debug
- Both tables reuse the same `PaymentLinkStatus` enum (`PENDING`, `PAID`, `EXPIRED`, `CANCELLED`)

### 7.2 Database Changes

```prisma
// ── Add to Doctor model (new fields alongside existing Stripe fields): ──
model Doctor {
  // ... existing fields ...

  // Stripe Connect (existing)
  stripeAccountId            String?   @unique @map("stripe_account_id")
  stripeOnboardingComplete   Boolean   @default(false)
  stripeChargesEnabled       Boolean   @default(false)
  stripePayoutsEnabled       Boolean   @default(false)
  paymentLinks               PaymentLink[]    // existing Stripe payment links

  // Mercado Pago Marketplace (NEW)
  mpUserId              String?   @unique @map("mp_user_id")
  mpAccessToken         String?   @map("mp_access_token")        // MUST be encrypted at rest
  mpRefreshToken        String?   @map("mp_refresh_token")       // MUST be encrypted at rest
  mpTokenExpiresAt      DateTime? @map("mp_token_expires_at")
  mpPublicKey           String?   @map("mp_public_key")
  mpConnected           Boolean   @default(false) @map("mp_connected")
  mpPaymentPreferences  MpPaymentPreference[]  // NEW relation
}

// ── NEW model — separate from existing PaymentLink (Stripe) ──
model MpPaymentPreference {
  id                String   @id @default(cuid())
  doctorId          String   @map("doctor_id")
  doctor            Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  // MP data
  mpPreferenceId    String   @unique @map("mp_preference_id")
  mpInitPoint       String   @map("mp_init_point")          // the shareable URL (equivalent to stripePaymentLinkUrl)
  mpPaymentId       String?  @map("mp_payment_id")          // set when paid

  // Link metadata (same pattern as PaymentLink)
  description       String?
  amount            Decimal  @db.Decimal(10, 2)
  currency          String   @default("MXN") @db.VarChar(3)
  isActive          Boolean  @default(true) @map("is_active")

  // Optional links to booking/service (same pattern as PaymentLink)
  bookingId         String?  @unique @map("booking_id")
  booking           Booking? @relation(fields: [bookingId], references: [id])
  serviceId         String?  @map("service_id")
  service           Service? @relation(fields: [serviceId], references: [id])

  // Tracking
  status            PaymentLinkStatus @default(PENDING)      // reuses existing enum
  paymentMethod     String?           @map("payment_method") // "credit_card", "debit_card", "bank_transfer", "ticket", etc.
  paidAt            DateTime?         @map("paid_at")

  externalReference String?  @map("external_reference")      // "booking-{id}" for webhook matching
  marketplaceFee    Decimal? @db.Decimal(10, 2) @map("marketplace_fee")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@index([doctorId])
  @@index([doctorId, status])
  @@map("mp_payment_preferences")
  @@schema("public")
}

// ── Existing model stays UNTOUCHED ──
// model PaymentLink { ... }  (Stripe — no changes)
// enum PaymentLinkStatus { PENDING, PAID, EXPIRED, CANCELLED }  (shared by both)
```

### 7.2.1 SQL Migration Files

**File: `packages/database/prisma/migrations/add-mp-doctor-fields.sql`**
```sql
-- Migration: Add Mercado Pago fields to doctors table
-- Purpose: Store MP OAuth credentials for marketplace integration
-- Date: 2026-05-XX

ALTER TABLE "public"."doctors"
  ADD COLUMN IF NOT EXISTS "mp_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_access_token" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_refresh_token" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mp_public_key" TEXT,
  ADD COLUMN IF NOT EXISTS "mp_connected" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "doctors_mp_user_id_key"
  ON "public"."doctors"("mp_user_id");
```

**File: `packages/database/prisma/migrations/add-mp-payment-preferences.sql`**
```sql
-- Migration: Create mp_payment_preferences table
-- Purpose: Store Mercado Pago payment links (separate from Stripe payment_links)
-- Date: 2026-05-XX

CREATE TABLE IF NOT EXISTS public.mp_payment_preferences (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,

    -- MP data
    mp_preference_id TEXT NOT NULL,
    mp_init_point TEXT NOT NULL,
    mp_payment_id TEXT,

    -- Link metadata
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Optional links
    booking_id TEXT,
    service_id TEXT,

    -- Tracking
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_method TEXT,
    paid_at TIMESTAMP(3),

    external_reference TEXT,
    marketplace_fee DECIMAL(10,2),

    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT mp_payment_preferences_doctor_id_fkey
        FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT mp_payment_preferences_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL,
    CONSTRAINT mp_payment_preferences_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS mp_payment_preferences_mp_preference_id_key
    ON public.mp_payment_preferences(mp_preference_id);

CREATE UNIQUE INDEX IF NOT EXISTS mp_payment_preferences_booking_id_key
    ON public.mp_payment_preferences(booking_id);

CREATE INDEX IF NOT EXISTS mp_payment_preferences_doctor_id_idx
    ON public.mp_payment_preferences(doctor_id);

CREATE INDEX IF NOT EXISTS mp_payment_preferences_doctor_id_status_idx
    ON public.mp_payment_preferences(doctor_id, status);
```

**Deployment order (per database-architecture.md):**
1. Run both SQL files against Railway DB
2. `git push` (triggers Railway deploy)
3. Verify

### 7.3 New API Endpoints

All under `apps/api/src/app/api/mercadopago/`:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/mercadopago/connect/authorize` | POST | `getAuthenticatedDoctorStripe`* | Generate OAuth URL + state, return URL for redirect |
| `/api/mercadopago/connect/callback` | GET | None (OAuth redirect) | Receive auth code, exchange for token, save to DB, redirect to pagos |
| `/api/mercadopago/connect/status` | GET | `getAuthenticatedDoctorStripe`* | Check connection status, token expiry, account info |
| `/api/mercadopago/connect/disconnect` | POST | `getAuthenticatedDoctorStripe`* | Clear MP fields from doctor record |
| `/api/mercadopago/preferences` | POST | `getAuthenticatedDoctorStripe`* | Create payment preference (payment link) |
| `/api/mercadopago/preferences` | GET | `getAuthenticatedDoctorStripe`* | List doctor's preferences with status |
| `/api/mercadopago/preferences/[id]` | DELETE | `getAuthenticatedDoctorStripe`* | Cancel/deactivate a preference |
| `/api/mercadopago/webhook` | POST | MP HMAC signature | Handle payment notifications |
| `/api/cron/mp-token-refresh` | GET | `CRON_SECRET` | Refresh tokens expiring within 30 days |

*Uses `getAuthenticatedDoctorStripe` (DOCTOR role only, no ADMIN) — same pattern as Stripe endpoints to prevent privilege escalation on financial operations.

**File structure mirrors Stripe:**
```
apps/api/src/app/api/
  stripe/                              (existing — untouched)
    connect/
      create-account/route.ts
      account-link/route.ts
      status/route.ts
      dashboard-link/route.ts
    payment-links/
      route.ts
      [id]/route.ts
    webhook/route.ts

  mercadopago/                         (NEW — same pattern)
    connect/
      authorize/route.ts
      callback/route.ts
      status/route.ts
      disconnect/route.ts
    preferences/
      route.ts
      [id]/route.ts
    webhook/route.ts

  cron/
    mp-token-refresh/route.ts          (NEW)

apps/api/src/lib/
  stripe.ts                            (existing — untouched)
  mercadopago.ts                       (NEW — MP helpers, encryption utils)
```

### 7.4 Implementation Details

#### OAuth Callback Handler

```typescript
// GET /api/mercadopago/oauth/callback?code=...&state=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state (CSRF protection — match against stored state)

  // Exchange code for token
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.API_URL}/api/mercadopago/oauth/callback`,
    }),
  });

  const data = await response.json();
  // data.access_token — valid 180 days
  // data.refresh_token
  // data.user_id — seller's MP user ID
  // data.public_key
  // data.expires_in — 15552000 (180 days in seconds)

  // Save to doctor record (ENCRYPT tokens before storing)
  await prisma.doctor.update({
    where: { id: doctorId },  // from state lookup
    data: {
      mpUserId: String(data.user_id),
      mpAccessToken: encrypt(data.access_token),
      mpRefreshToken: encrypt(data.refresh_token),
      mpPublicKey: data.public_key,
      mpTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      mpConnected: true,
    },
  });

  // Redirect doctor back to pagos page
  return NextResponse.redirect(`${process.env.DOCTOR_APP_URL}/dashboard/pagos?mp=connected`);
}
```

#### Preference Creation (Payment Link)

```typescript
// POST /api/mercadopago/preferences
export async function POST(request: Request) {
  const { doctor } = await getAuthenticatedDoctor(request);

  if (!doctor.mpConnected || !doctor.mpAccessToken) {
    return NextResponse.json(
      { error: 'Mercado Pago no conectado' },
      { status: 400 }
    );
  }

  // Check token expiry, refresh if needed
  await refreshTokenIfNeeded(doctor);

  const { amount, description, serviceId, bookingId } = await request.json();
  // Validate with Zod...

  const externalReference = `booking-${bookingId || cuid()}`;

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${decrypt(doctor.mpAccessToken)}`,
    },
    body: JSON.stringify({
      items: [{
        id: externalReference,
        title: description || 'Consulta Médica',
        quantity: 1,
        unit_price: amount,
        currency_id: 'MXN',
      }],
      back_urls: {
        success: `${process.env.DOCTOR_APP_URL}/pagos?status=success`,
        failure: `${process.env.DOCTOR_APP_URL}/pagos?status=failure`,
        pending: `${process.env.DOCTOR_APP_URL}/pagos?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.API_URL}/api/mercadopago/webhook`,
      external_reference: externalReference,
      marketplace_fee: calculatePlatformFee(amount), // e.g., 5% of amount
      payment_methods: {
        installments: 12,
        default_installments: 1,
      },
    }),
  });

  const preference = await response.json();

  // Save to database
  await prisma.mpPaymentPreference.create({
    data: {
      doctorId: doctor.id,
      mpPreferenceId: preference.id,
      mpInitPoint: preference.init_point,
      description,
      amount,
      externalReference,
      marketplaceFee: calculatePlatformFee(amount),
    },
  });

  return NextResponse.json({
    url: preference.init_point,
    id: preference.id,
  });
}
```

#### Webhook Handler

```typescript
// POST /api/mercadopago/webhook
export async function POST(request: Request) {
  const body = await request.json();
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  // Verify signature
  if (!verifyWebhookSignature(xSignature!, xRequestId!, body.data.id, process.env.MP_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (body.type === 'payment') {
    const paymentId = body.data.id;

    // Fetch full payment details from MP
    // Need to use the SELLER's access token for marketplace payments
    const payment = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${decrypt(sellerAccessToken)}`,
        },
      }
    );
    const paymentData = await payment.json();

    switch (paymentData.status) {
      case 'approved':
        await prisma.mpPaymentPreference.updateMany({
          where: {
            externalReference: paymentData.external_reference,
            status: 'PENDING',
          },
          data: {
            status: 'PAID',
            mpPaymentId: String(paymentData.id),
            paymentMethod: paymentData.payment_method_id,
            paidAt: new Date(),
          },
        });
        // Send Telegram notification to doctor
        break;

      case 'rejected':
        // Patient can retry — don't change status
        break;

      case 'refunded':
        await prisma.mpPaymentPreference.updateMany({
          where: { mpPaymentId: String(paymentData.id) },
          data: { status: 'CANCELLED' },
        });
        break;
    }
  }

  return NextResponse.json({ received: true });
}
```

### 7.5 Token Refresh Strategy

Since MP tokens expire every 180 days, we need a proactive refresh mechanism:

```typescript
// Cron job: runs daily, refreshes tokens expiring within 30 days
// GET /api/cron/mp-token-refresh (protected by CRON_SECRET)

export async function GET(request: Request) {
  // Validate CRON_SECRET...

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const doctorsToRefresh = await prisma.doctor.findMany({
    where: {
      mpConnected: true,
      mpTokenExpiresAt: { lte: thirtyDaysFromNow },
      mpRefreshToken: { not: null },
    },
  });

  for (const doctor of doctorsToRefresh) {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: decrypt(doctor.mpRefreshToken!),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          mpAccessToken: encrypt(data.access_token),
          mpRefreshToken: encrypt(data.refresh_token),
          mpTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
      });
    } else {
      // Notify via Telegram — doctor may need to re-authorize
    }
  }
}
```

### 7.6 Environment Variables

```env
# API App (.env.local)
MP_CLIENT_ID=1234567890                  # Application ID from MP dashboard
MP_CLIENT_SECRET=abc123...               # Client secret (NEVER NEXT_PUBLIC_)
MP_WEBHOOK_SECRET=xyz789...              # Webhook signing secret
MP_ENCRYPTION_KEY=...                    # For encrypting stored tokens

# No MP keys needed in doctor app — all calls go through API app
```

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Token Storage

Unlike Stripe (where `stripeAccountId` is not secret), MP `access_token` and `refresh_token` are **sensitive credentials** that grant full payment access to the doctor's account. They MUST be encrypted at rest.

| Data | Stripe | Mercado Pago |
|------|--------|-------------|
| Account ID | Not secret (public) | `user_id` — not secret |
| Access token | N/A (platform uses own key) | Secret — must encrypt in DB |
| Refresh token | N/A | Secret — must encrypt in DB |

**Recommendation:** Use AES-256-GCM encryption for `mpAccessToken` and `mpRefreshToken` fields. The encryption key should be a separate env var (`MP_ENCRYPTION_KEY`), not `AUTH_SECRET`.

### 8.2 Webhook Security

| Aspect | Stripe | Mercado Pago |
|--------|--------|-------------|
| Signature header | `stripe-signature` | `x-signature` |
| Algorithm | HMAC-SHA256 | HMAC-SHA256 |
| Timestamp included | Yes (`t=`) | Yes (`ts=`) |
| Replay protection | Built-in (5min tolerance) | Manual (check `ts`) |
| Raw body needed | Yes (`request.text()`) | No (uses `data.id` from parsed JSON) |

### 8.3 OAuth State Validation

The `state` parameter in the OAuth flow must be:
- Cryptographically random
- Stored server-side (in session or DB) before redirect
- Validated on callback to prevent CSRF attacks

### 8.4 CORS

Same as Stripe — MP webhooks are server-to-server, no CORS issues.

---

## 9. PAGOS PAGE UI DESIGN — DUAL PROVIDER

### 9.1 Current Page Structure (Stripe only)

```
/dashboard/pagos (current)
├── Tabs: [Mis pagos] [Guia]
├── Stripe account status card (not connected / onboarding / connected)
├── Account alerts (if disabled/past-due/rejected)
├── Payment links section (create + list)
└── Stripe self-service info
```

### 9.2 New Page Structure (Stripe + Mercado Pago)

The doctor clicks on one provider and takes it from there. Both providers are shown as equal options.

```
/dashboard/pagos (new)
├── Tabs: [Mis pagos] [Guia]
│
├── Provider cards (always visible, side by side on desktop, stacked on mobile)
│   ├── [Stripe card]
│   │   ├── Logo + "Stripe"
│   │   ├── Status badge (Conectado / No conectado / Pendiente)
│   │   ├── If not connected: "Conectar" button
│   │   ├── If connected: "Ver detalles" button → expands/shows Stripe section
│   │   └── Brief: "Tarjetas, OXXO, Apple Pay, Google Pay"
│   │
│   └── [Mercado Pago card]
│       ├── Logo + "Mercado Pago"
│       ├── Status badge (Conectado / No conectado)
│       ├── If not connected: "Conectar" button → OAuth redirect
│       ├── If connected: "Ver detalles" button → expands/shows MP section
│       └── Brief: "Tarjetas, SPEI, OXXO, Saldo MP, Meses sin Tarjeta"
│
├── Expanded provider section (when doctor clicks one)
│   ├── Account status details
│   ├── Create payment link form (same fields: amount + description)
│   ├── Payment links list (with status, copy, WhatsApp share, deactivate)
│   └── Provider-specific self-service info
│
└── Combined payment links view (optional future enhancement)
```

### 9.3 UI Component Plan

```
apps/doctor/src/app/dashboard/pagos/
  page.tsx                          (rewrite — provider selector + sections)

apps/doctor/src/components/payments/     (NEW folder — extract from monolithic page)
  ProviderCard.tsx                  (reusable card: logo, status, connect/expand button)
  StripeSection.tsx                 (extracted from current page — account status, links, etc.)
  MercadoPagoSection.tsx            (NEW — OAuth status, preferences list, create form)
  PaymentLinkRow.tsx                (extracted — shared between Stripe and MP, accepts url prop)
  CreatePaymentForm.tsx             (shared form component — amount, description, provider-specific submit)
  StatusRow.tsx                     (extracted — reusable)
  AccountAlert.tsx                  (extracted — Stripe-specific, could be extended for MP)
```

### 9.4 Page State Management

```typescript
// New state shape for the pagos page
type ActiveProvider = "none" | "stripe" | "mercadopago";

// page.tsx state
const [activeProvider, setActiveProvider] = useState<ActiveProvider>("none");
const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
const [mpStatus, setMpStatus] = useState<MpStatus | null>(null);

// On mount: fetch both statuses in parallel
useEffect(() => {
  if (sessionStatus === "authenticated") {
    Promise.all([fetchStripeStatus(), fetchMpStatus()]);
  }
}, [sessionStatus]);

// If only one provider connected, auto-expand it
useEffect(() => {
  if (stripeStatus?.connected && !mpStatus?.connected) setActiveProvider("stripe");
  else if (!stripeStatus?.connected && mpStatus?.connected) setActiveProvider("mercadopago");
}, [stripeStatus, mpStatus]);
```

```typescript
// MpStatus interface
interface MpStatus {
  connected: boolean;
  mpUserId: string | null;
  tokenExpiresAt: string | null;   // ISO date — for showing "Expira en X dias"
  tokenExpiresSoon: boolean;       // true if <30 days remaining
}
```

### 9.5 When Both Providers Are Connected

If doctor has both Stripe and MP connected:
- Both provider cards show green "Conectado" badge
- Doctor clicks one to expand its section (accordion-style, only one open at a time)
- Each section has its own "Create link" and links list
- Payment links from each provider show the provider icon/label so doctor knows which is which

### 9.6 Advantages for Doctors

| Scenario | Best Provider | Why |
|----------|--------------|-----|
| Patient has credit card | Either | Similar fees |
| Patient wants SPEI | **Mercado Pago** | Stripe doesn't support it |
| Patient has MP account | **Mercado Pago** | Can pay with balance |
| Patient wants Apple/Google Pay | **Stripe** | Native support |
| Doctor wants Express Dashboard | **Stripe** | Better dashboard UX |
| Doctor already has MP account | **Mercado Pago** | No new account needed, just OAuth |
| International patients | **Stripe** | Better international card support |

---

## 10. IMPLEMENTATION PHASES

### Phase 0: MP Application Setup — COMPLETED May 18, 2026
- [x] Register application at mercadopago.com/developers
- [x] Configure redirect URI
- [x] Get credentials + set 4 env vars on Railway

### Phase 1: Database + OAuth Connection — COMPLETED May 18, 2026
- [x] Create `apps/api/src/lib/mercadopago.ts` (AES-256-GCM encryption, fetch wrapper, HMAC verification)
- [x] Add MP fields to Doctor model in `schema.prisma`
- [x] Create + run SQL migration on local + Railway DB
- [x] Create 4 OAuth endpoints (authorize, callback, status, disconnect)
- [x] Code review passed (1 bug fixed: token isolation in webhook)

### Phase 2: Payment Preferences + Webhook — COMPLETED May 18, 2026
- [x] Create `MpPaymentPreference` model in `schema.prisma` + relations on Booking, Service
- [x] Create + run SQL migration on local + Railway DB
- [x] Create preference endpoints (POST create, GET list, DELETE deactivate)
- [x] Create webhook handler (signature verification, idempotent updates, Telegram notifications)
- [x] Create token refresh cron endpoint
- [ ] Deploy (`git push`) + test payment flow

### Phase 3: Pagos Page Redesign
- [ ] Extract current Stripe code into `StripeSection.tsx` component
- [ ] Create `ProviderCard.tsx` (reusable card with logo, status, connect button)
- [ ] Create `MercadoPagoSection.tsx` (OAuth status, create form, preferences list)
- [ ] Extract shared components: `PaymentLinkRow.tsx`, `CreatePaymentForm.tsx`, `StatusRow.tsx`
- [ ] Rewrite `pagos/page.tsx` with dual-provider selector UI
- [ ] Both statuses fetched in parallel on page load
- [ ] Accordion-style expansion (click provider card → shows its section)
- [ ] Test both providers side-by-side

### Phase 4: Token Management + Robustness
- [ ] Create `/api/cron/mp-token-refresh` (refresh tokens expiring within 30 days)
- [ ] Configure Railway cron for daily token refresh check
- [ ] Telegram notifications: payment received, token expiring, token refresh failed
- [ ] Handle OXXO pending flow (pending → approved/expired via webhook)
- [ ] Handle SPEI confirmation delay
- [ ] Fraud alert handling (`stop_delivery_op_wh` webhook topic)
- [ ] Chargeback/claim handling via webhook

### Phase 5: Polish (optional)
- [ ] Update `PagosGuide.tsx` to include MP documentation alongside Stripe
- [ ] Payment analytics in admin dashboard (both providers)
- [ ] Rate limiting on MP endpoints
- [ ] Platform fee configuration (admin setting, per provider)

---

## 11. RISK MATRIX

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token expiry (180 days) not refreshed | Medium | High | Cron job + Telegram alerts 30 days before |
| Doctor revokes OAuth from MP side | Low | Medium | `mp-connect` webhook to detect, clear DB fields |
| MP access token leaked from DB | Low | Critical | AES-256-GCM encryption at rest |
| Webhook spoofing | Low | High | HMAC-SHA256 signature verification |
| Duplicate payment notifications | Medium | Low | Idempotent webhook handler (check status before update) |
| SPEI/OXXO payment never completed | Medium | Low | Preference expiration dates, status tracking |
| MP API downtime | Low | High | Graceful error handling, retry with backoff |
| Patient disputes/chargebacks | Medium | Medium | Webhook handler + Telegram notification |
| OAuth callback CSRF | Low | Medium | Cryptographic `state` parameter validation |
| Rate limiting by MP (too many API calls) | Low | Medium | Cache preferences, batch token refreshes |

---

## 12. DECISIONS LOG

All questions resolved. No open items.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Unified vs separate tables? | **Separate** (`PaymentLink` for Stripe, `MpPaymentPreference` for MP) | Avoids risky migration on live data, keeps providers independent |
| 2 | Doctor can use both? | **Yes** — both appear on `/dashboard/pagos`, doctor picks one per link | Maximum flexibility, some patients prefer one over the other |
| 3 | Auth pattern? | `getAuthenticatedDoctorStripe` (DOCTOR only, no ADMIN) | Same security pattern as Stripe — prevents privilege escalation |
| 4 | Platform fee? | **No fee** — `marketplace_fee` set to 0 or omitted | Business decision — can add later via admin settings |
| 5 | MP SDK vs raw HTTP? | **Raw `fetch()`** — no `mercadopago` npm package | Only 3-4 endpoints needed; avoids dependency coupling; SDK focuses on Orders API not Checkout Pro preferences |
| 6 | Token encryption? | **AES-256-GCM** helpers in `mercadopago.ts` with separate **`MP_ENCRYPTION_KEY`** env var | Purpose-separated keys; ~15 lines of code; explicit encrypt/decrypt calls; isolated from AUTH_SECRET |
| 7 | Webhook → doctor lookup? | **`user_id`** from webhook payload → `doctor.mpUserId` → decrypt token → fetch payment → match `external_reference` | Solves chicken-and-egg (need token to fetch payment, need payment to find doctor); `user_id` is in every webhook payload |
| 8 | Token refresh failure? | **Both** — mark `mpConnected: false` + clear tokens in DB + send Telegram notification | Clean state prevents dead-token errors; Telegram catches it proactively; same pattern as Stripe's `account.application.deauthorized` |
