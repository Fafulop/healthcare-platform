# Stripe Connect Integration Plan & Security Audit

**Date:** May 5, 2026
**Project:** Healthcare Platform (docs-front)
**Objective:** Integrate Stripe Connect (Express) so doctors can receive payments via payment links generated from the doctor app, and identify/fix security gaps before handling payment flows.

---

## 1. CURRENT ARCHITECTURE

### 1.1 Monorepo Structure

```
docs-front/                          (pnpm + Turborepo)
  apps/
    api/          Next.js 15 (API-only, port 3003)   — Railway
    doctor/       Next.js 15 (Doctor dashboard, port 3001) — Railway
    admin/        Next.js 15 (Admin panel, port 3002) — Railway
    public/       Next.js 15 (Patient-facing site, port 3000) — Railway
  packages/
    database/     Prisma ORM (PostgreSQL on Railway)
    auth/         Shared NextAuth v5 config
    types/        Shared TypeScript types
    ui/           Shared UI components
```

### 1.2 Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth v5 (Google OAuth) → JWT tokens |
| ORM | Prisma (PostgreSQL) |
| Database | Railway PostgreSQL (multi-schema: public, practice_management, medical_records, llm_assistant, analytics) |
| File uploads | UploadThing |
| SMS | Twilio |
| Notifications | Telegram bot |
| Package manager | pnpm 10.x |
| Deployment | Railway |

### 1.3 Authentication Flow

```
1. Doctor/Admin logs in via Google OAuth (NextAuth v5)
2. NextAuth creates encrypted JWE session cookie
3. Doctor app has /api/auth/get-token endpoint:
   - Decrypts JWE session → extracts payload
   - Signs a new JWT (HS256) with AUTH_SECRET
   - Returns signed JWT to client
4. Client uses authFetch() helper → attaches JWT as Bearer token
5. API app validates JWT signature + checks user in DB
6. Session versioning for kill-all-sessions support
```

### 1.4 API Route Protection

| Category | Auth Method | Files |
|---|---|---|
| Doctor profile CRUD | `requireDoctorAuth` / `getAuthenticatedDoctor` | ~15 routes |
| Admin-only | `requireAdminAuth` | users, settings, analytics |
| Staff (doctor+admin) | `requireStaffAuth` | LLM usage, feature tracking |
| Cron jobs | `CRON_SECRET` Bearer token | 4 cron routes |
| Public endpoints (intentional) | None | doctor profile GET, services, slots GET, booking POST, reviews, articles GET |
| Webhook endpoints | Service-specific validation | Telegram, Google Calendar |

### 1.5 Database Schema (relevant tables)

- **User** — email, role (ADMIN/DOCTOR), doctorId, sessionVersion, Google OAuth tokens
- **Doctor** — profile, clinic info, settings, linked to User 1:1
- **Service** — doctor services with prices and duration
- **Booking** — patient appointments with contact info
- **AppointmentSlot** — availability with pricing (basePrice, finalPrice)
- **Patient** (medical_records schema) — EMR data
- **LedgerEntry** (practice_management) — financial records

---

## 2. SECURITY AUDIT — GAPS FOUND

### 2.1 CRITICAL — Unprotected Endpoints That Modify Data

#### `/api/auth/consent` (POST) — NO AUTH
**File:** `apps/api/src/app/api/auth/consent/route.ts`
**Risk:** Anyone can send `{ email: "any@email.com" }` and set privacy consent for any user.
**Impact:** GDPR/LFPDPPP compliance bypass — forged consent records.
**Fix:** Add `validateAuthToken()` — only the authenticated user should consent for themselves.

#### `/api/auth/user` (POST) — NO AUTH
**File:** `apps/api/src/app/api/auth/user/route.ts`
**Risk:** Anyone can POST `{ email, name }` to create a user or retrieve user info. If email matches ADMIN_EMAILS, an admin account is created.
**Impact:** User enumeration, potential admin account creation if ADMIN_EMAILS are guessed.
**Fix:** This endpoint is called during NextAuth sign-in flow. It should either:
  - Be called only server-side (from NextAuth callbacks, not exposed as public API), OR
  - Validate that the request comes from a trusted origin with a shared secret

#### `/api/dev/fix-admin-role` (GET, POST) — DEV ONLY but deployed
**File:** `apps/api/src/app/api/dev/fix-admin-role/route.ts`
**Risk:** Protected by `NODE_ENV !== 'development'` check, but if Railway ever sets NODE_ENV=development (or it's misconfigured), it exposes:
  - GET: Lists all users with emails, roles, and IDs
  - POST: Promotes any email to ADMIN role
**Fix:** DELETE this file entirely. It's marked "DELETE THIS FILE after use."

### 2.2 HIGH — Debug Logging in Production

#### Auth debug logging exposes secrets
**File:** `apps/api/src/lib/auth.ts:54-77`
```typescript
console.log('[AUTH DEBUG] Token received (first 50 chars):', token.substring(0, 50) + '...');
console.log('[AUTH DEBUG] AUTH_SECRET exists:', !!process.env.AUTH_SECRET);
console.log('[AUTH DEBUG] Using secret (first 20 chars):', secret.substring(0, 20) + '...');
console.log('[AUTH DEBUG] Token header:', decoded?.header);
console.log('[AUTH DEBUG] Token payload email:', (decoded?.payload as any)?.email);
```
**Risk:** Logs JWT tokens, secret prefixes, and user emails to Railway logs. Anyone with Railway log access (or if logs leak) can reconstruct secrets.
**Fix:** Remove ALL debug console.log lines from auth.ts. Use a proper logger with log levels if needed.

### 2.3 HIGH — No Rate Limiting on API App

**Finding:** The API app (`apps/api`) has ZERO rate limiting on any endpoint.
- Rate limiting exists only on doctor app's AI chat routes (in-memory, per-user)
- No rate limiting on: login, booking creation, slot creation, review submission, etc.

**Risk for Stripe:** Without rate limiting, an attacker could:
- Spam payment link creation
- Brute-force doctor account endpoints
- DDoS the booking/payment flow

**Fix:** Add rate limiting middleware (recommended: `@upstash/ratelimit` with Redis, or in-memory with `lru-cache`). Priority endpoints:
1. `/api/auth/*` — prevent brute force
2. `/api/appointments/bookings` POST — prevent booking spam
3. Future `/api/stripe/*` endpoints — prevent payment link spam

### 2.4 MEDIUM — CORS Configuration

**File:** `apps/api/src/middleware.ts`
**Finding:** CORS uses `ALLOWED_ORIGINS` env var, falling back to localhost defaults. This is correct but:
- When origin is NOT allowed, the response still proceeds (no `Access-Control-Allow-Origin` header set, but request processes)
- The middleware doesn't block requests without Origin header (server-to-server, curl, Postman)

**Risk for Stripe:** Low — Stripe webhooks don't use CORS, and auth tokens protect endpoints anyway. But CORS alone is NOT a security boundary.

### 2.5 MEDIUM — Sensitive Data in .env.local Files

**Finding:** While `.env.local` files are gitignored, they contain:
- `NEXT_PUBLIC_JWT_SECRET` in doctor app (exposes JWT secret to browser bundle if used)
- OpenAI API keys, Google OAuth secrets, Twilio credentials, UploadThing tokens, Railway DB passwords

**Current status:** `NEXT_PUBLIC_JWT_SECRET` is NOT actually used in code (verified via grep). It's a leftover.
**Fix:** Remove `NEXT_PUBLIC_JWT_SECRET` from `.env.local`. Never prefix secrets with `NEXT_PUBLIC_`.

### 2.6 HIGH — No Field-Level Encryption for Sensitive Data

**Finding:** The database stores sensitive data in plaintext:
- **Google OAuth tokens** (`User.googleAccessToken`, `User.googleRefreshToken`) — plaintext
- **Medical data** (patient names, allergies, medications, diagnoses) — plaintext
- **Financial data** (bank accounts, RFC tax IDs) — plaintext
- **Prescription signatures** — URL references, no encryption

**Risk for Stripe:** When adding `stripeAccountId` to the Doctor model, it will also be stored in plaintext. While Stripe account IDs are not secret per se, the pattern of no encryption means if the DB is breached, all data is exposed.

**Fix (long-term):** Consider Prisma encryption middleware or application-level encryption for sensitive fields. For Stripe specifically, `stripeAccountId` is low-risk as it's not a secret.

### 2.7 HIGH — No Database Row-Level Security (RLS)

**Finding:** PostgreSQL RLS is not enabled on any table. All access control is application-level only (Prisma queries filtered by `doctorId`). If app-level auth is bypassed, all data across all doctors is exposed.

**Fix (long-term):** Implement PostgreSQL RLS policies for doctor data isolation. This is a larger project but important for defense-in-depth.

### 2.8 MEDIUM — `/api/auth/google-calendar/tokens` Unprotected

**File:** `apps/api/src/app/api/auth/google-calendar/tokens/route.ts`
**Risk:** POST endpoint that stores Google OAuth tokens by email lookup — no JWT auth check.
**Fix:** Add `validateAuthToken()` to ensure only the authenticated user can store their own tokens.

### 2.9 MEDIUM — `/api/settings` GET Unprotected

**File:** `apps/api/src/app/api/settings/route.ts`
**Finding:** GET is public (no auth), PATCH requires admin. Exposes all system settings to unauthenticated clients.
**Fix:** Add `requireStaffAuth()` to the GET handler.

### 2.10 MEDIUM — Practice Management Auth Gaps

**Finding:** Some practice management routes in `apps/api/src/app/api/practice-management/` use auth but the auth check pattern varies. Most use `getAuthenticatedDoctor()` which is correct, but need to verify ALL routes consistently scope data to the authenticated doctor's ID.

### 2.11 LOW — No Security Headers

**File:** `apps/api/next.config.ts`
**Finding:** Only `poweredByHeader: false` is set. Missing:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

**Fix:** Add security headers in middleware or next.config.ts.

### 2.12 LOW — No Input Validation Library

**Finding:** No centralized input validation (no Zod, Joi, or similar). Request bodies are parsed with `request.json()` and fields extracted directly. Some routes check for required fields, but no schema validation.

**Risk for Stripe:** Stripe webhook payloads MUST be validated with Stripe's signature verification. Without a validation pattern, there's risk of forgetting this.

---

## 3. SECURITY FIXES REQUIRED BEFORE STRIPE

These must be resolved before adding payment infrastructure:

### Priority 1 — Must Fix (before any Stripe code)

| # | Issue | Action | File |
|---|---|---|---|
| 1 | `/api/auth/consent` unprotected | Add `validateAuthToken()` | `apps/api/src/app/api/auth/consent/route.ts` |
| 2 | `/api/auth/user` unprotected | Move to server-side NextAuth callback or add secret validation | `apps/api/src/app/api/auth/user/route.ts` |
| 3 | `/api/dev/fix-admin-role` exists | Delete the file entirely | `apps/api/src/app/api/dev/fix-admin-role/route.ts` |
| 4 | Auth debug logging | Remove all console.log in auth.ts | `apps/api/src/lib/auth.ts` |
| 5 | Remove `NEXT_PUBLIC_JWT_SECRET` | Delete from `.env.local` | `apps/doctor/.env.local` |
| 6 | `/api/auth/google-calendar/tokens` unprotected | Add `validateAuthToken()` | `apps/api/src/app/api/auth/google-calendar/tokens/route.ts` |
| 7 | `/api/settings` GET unprotected | Add `requireStaffAuth()` to GET | `apps/api/src/app/api/settings/route.ts` |

### Priority 2 — Should Fix (before going live with payments)

| # | Issue | Action |
|---|---|---|
| 8 | No rate limiting | Add rate limiting to API app (at minimum on auth + future Stripe endpoints) |
| 9 | No input validation | Add Zod validation for Stripe-related endpoints (at minimum) |
| 10 | No security headers | Add standard security headers in API middleware |

### Priority 3 — Good to Have

| # | Issue | Action |
|---|---|---|
| 11 | CORS doesn't block non-browser requests | Not a real issue (auth protects), but document this |
| 12 | Practice management auth consistency | Audit all PM routes for consistent doctor scoping |
| 13 | No field-level encryption | Add encryption for OAuth tokens and sensitive medical data |
| 14 | No database RLS | Implement PostgreSQL RLS policies for doctor data isolation |

---

## 4. STRIPE CONNECT INTEGRATION PLAN

### 4.1 Overview

```
Doctor App                    API App                     Stripe
    |                            |                          |
    |-- "Activar cobros" ------->|                          |
    |                            |-- Create Connect Account ->|
    |                            |<-- Account Link URL -------|
    |<-- Redirect to Stripe -----|                          |
    |                            |                          |
    |   (Doctor completes        |                          |
    |    Stripe onboarding)      |                          |
    |                            |                          |
    |-- "Crear link de pago" --->|                          |
    |                            |-- Create Payment Link ---->|
    |                            |<-- Payment Link URL -------|
    |<-- Share URL --------------|                          |
    |                            |                          |
    |                            |<-- Webhook: payment -------|
    |                            |-- Update booking status --|
```

### 4.2 Database Changes

Add to Prisma schema (`packages/database/prisma/schema.prisma`):

```prisma
// Add to Doctor model:
model Doctor {
  // ... existing fields ...

  // Stripe Connect
  stripeAccountId       String?   @unique @map("stripe_account_id")
  stripeOnboardingComplete Boolean @default(false) @map("stripe_onboarding_complete")
  stripeChargesEnabled  Boolean   @default(false) @map("stripe_charges_enabled")
  stripePayoutsEnabled  Boolean   @default(false) @map("stripe_payouts_enabled")
}

// New model for payment links
model PaymentLink {
  id              String   @id @default(cuid())
  doctorId        String   @map("doctor_id")
  doctor          Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  // Stripe data
  stripePaymentLinkId   String  @unique @map("stripe_payment_link_id")
  stripePaymentLinkUrl  String  @map("stripe_payment_link_url")

  // Link metadata
  description     String?
  amount          Decimal  @db.Decimal(10, 2)
  currency        String   @default("MXN") @db.VarChar(3)
  isActive        Boolean  @default(true) @map("is_active")

  // Optional: link to a specific booking or service
  bookingId       String?  @unique @map("booking_id")
  booking         Booking? @relation(fields: [bookingId], references: [id])
  serviceId       String?  @map("service_id")
  service         Service? @relation(fields: [serviceId], references: [id])

  // Tracking
  status          PaymentLinkStatus @default(PENDING)
  paidAt          DateTime?         @map("paid_at")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([doctorId])
  @@map("payment_links")
  @@schema("public")
}

enum PaymentLinkStatus {
  PENDING
  PAID
  EXPIRED
  CANCELLED

  @@schema("public")
}
```

### 4.3 New API Endpoints

All under `apps/api/src/app/api/stripe/`:

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/stripe/connect/create-account` | POST | `requireDoctorAuth` | Create Stripe Connect Express account for doctor |
| `/api/stripe/connect/account-link` | POST | `requireDoctorAuth` | Generate onboarding link (or re-onboarding) |
| `/api/stripe/connect/status` | GET | `requireDoctorAuth` | Check onboarding status & account capabilities |
| `/api/stripe/payment-links` | POST | `requireDoctorAuth` | Create a payment link for a specific amount/service |
| `/api/stripe/payment-links` | GET | `requireDoctorAuth` | List doctor's payment links with status |
| `/api/stripe/payment-links/[id]` | DELETE | `requireDoctorAuth` | Deactivate a payment link |
| `/api/stripe/webhook` | POST | Stripe signature | Handle Stripe events (payment completed, account updated) |

### 4.4 API Implementation Details

#### Connect Account Creation

> **Note on `type: 'express'` vs `controller` properties (verified May 2026):**
> Stripe's API marks the `type` parameter as "deprecated" in favor of `controller` properties.
> However, the migration guide states migration is **optional** and fully backwards-compatible.
> Our code uses `type: 'express'` which is correct for our use case.
>
> The `controller` equivalent for Express is: `losses.payments: 'application'`, `fees.payer: 'application'`,
> `requirement_collection: 'stripe'`, `stripe_dashboard.type: 'express'` — but this means the **platform**
> absorbs losses and pays fees, which is NOT our model.
>
> For our model (Stripe handles losses, doctor pays fees), the controller equivalent would be a Standard
> account (`stripe_dashboard.type: 'full'`), but we intentionally use Express for the simpler doctor experience.
> With direct charges, the doctor's account pays Stripe fees directly regardless.
>
> **Conclusion: Keep `type: 'express'`. Do NOT migrate to controller properties.**

```typescript
// POST /api/stripe/connect/create-account
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const { doctor } = await getAuthenticatedDoctor(request);

  // Check if already has Stripe account
  if (doctor.stripeAccountId) {
    return NextResponse.json({ error: 'Already connected' }, { status: 400 });
  }

  // Using type: 'express' (not controller properties — see note above)
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'MX',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
      oxxo_payments: { requested: true },
    },
    business_profile: {
      mcc: '8011', // Doctors
      name: doctor.doctorFullName,
    },
  });

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { stripeAccountId: account.id },
  });

  // Generate onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.DOCTOR_APP_URL}/pagos?refresh=true`,
    return_url: `${process.env.DOCTOR_APP_URL}/pagos?success=true`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
```

#### Payment Link Creation
```typescript
// POST /api/stripe/payment-links
export async function POST(request: Request) {
  const { doctor } = await getAuthenticatedDoctor(request);

  if (!doctor.stripeAccountId || !doctor.stripeChargesEnabled) {
    return NextResponse.json(
      { error: 'Stripe account not fully set up' },
      { status: 400 }
    );
  }

  const { amount, description, serviceId, bookingId } = await request.json();

  // Validate with Zod
  // ...

  // Create a Stripe Payment Link on the connected account
  const product = await stripe.products.create(
    { name: description || 'Consulta Medica' },
    { stripeAccount: doctor.stripeAccountId }
  );

  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: Math.round(amount * 100), // centavos
      currency: 'mxn',
    },
    { stripeAccount: doctor.stripeAccountId }
  );

  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      payment_method_types: ['card', 'oxxo'],
      // Optional: application_fee_percent: 5, // your cut
    },
    { stripeAccount: doctor.stripeAccountId }
  );

  // Save to database
  await prisma.paymentLink.create({
    data: {
      doctorId: doctor.id,
      stripePaymentLinkId: paymentLink.id,
      stripePaymentLinkUrl: paymentLink.url,
      description,
      amount,
      serviceId,
      bookingId,
    },
  });

  return NextResponse.json({ url: paymentLink.url, id: paymentLink.id });
}
```

#### Webhook Handler
```typescript
// POST /api/stripe/webhook
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  // CRITICAL: Verify webhook signature
  const event = stripe.webhooks.constructEvent(
    body,
    sig!,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  switch (event.type) {
    case 'checkout.session.completed':
      // Update payment link status to PAID
      break;
    case 'account.updated':
      // Update doctor's Stripe status (charges_enabled, payouts_enabled)
      break;
  }

  return NextResponse.json({ received: true });
}
```

### 4.5 Doctor App UI Changes

New pages/components in `apps/doctor/`:

| Component | Location | Description |
|---|---|---|
| Pagos page | `src/app/pagos/page.tsx` | Main payments dashboard |
| StripeOnboarding | `src/components/payments/StripeOnboarding.tsx` | "Activar cobros" button + status |
| CreatePaymentLink | `src/components/payments/CreatePaymentLink.tsx` | Form: amount, description, service selector |
| PaymentLinksList | `src/components/payments/PaymentLinksList.tsx` | Table of created links with status, copy URL, share buttons |
| PaymentLinkActions | `src/components/payments/PaymentLinkActions.tsx` | Share via WhatsApp, copy link, deactivate |

### 4.6 Environment Variables Needed

```env
# API App (.env.local)
STRIPE_SECRET_KEY=sk_live_...          # Stripe secret key (NEVER prefix with NEXT_PUBLIC_)
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook endpoint signing secret
STRIPE_CONNECT_CLIENT_ID=ca_...        # Connect platform client ID (if using OAuth flow)

# Doctor App (.env.local)
# No Stripe keys needed — all API calls go through the API app
# Only needs NEXT_PUBLIC_API_URL (already exists)
```

### 4.7 Security Measures for Stripe

| Measure | Implementation |
|---|---|
| Stripe keys server-side only | Keys only in API app, never in doctor/public apps |
| Webhook signature verification | `stripe.webhooks.constructEvent()` on every webhook |
| Connected account validation | Always verify `doctor.stripeAccountId` matches the authenticated doctor |
| Payment link ownership | Only the doctor who created a link can view/deactivate it |
| Rate limiting | Add rate limits to `/api/stripe/*` endpoints |
| Input validation | Zod schemas for amount, currency, description |
| No raw SQL | Use Prisma for all Stripe-related queries |
| Audit logging | Log all payment link creation/deactivation |
| Idempotency | Use Stripe idempotency keys for account/link creation |

---

## 5. IMPLEMENTATION PHASES

### Phase 0: Security Fixes (BEFORE Stripe) — COMPLETED May 5, 2026
**Scope: 9 files changed, 1 file deleted | Reviewed & verified**

- [x] Delete `apps/api/src/app/api/dev/fix-admin-role/route.ts`
- [x] Add auth to `/api/auth/consent` (validateAuthToken, uses authenticated email only)
- [x] Secure `/api/auth/user` (both API + doctor app: requires auth, returns only own user data, removed user creation — handled by NextAuth PrismaAdapter)
- [x] Add auth to `/api/auth/google-calendar/tokens` (validateAuthToken, only updates own tokens)
- [x] Add auth to `/api/settings` GET (requireAdminAuth + fixed admin page to use authFetch)
- [x] Remove debug console.logs from `apps/api/src/lib/auth.ts` (7 lines removed that leaked JWT tokens and secret prefixes)
- [x] Remove `NEXT_PUBLIC_JWT_SECRET` from doctor `.env.local`
- [x] Add security headers to API middleware (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy)
- [x] Fix settings PATCH error handling (replaced brittle string matching with `instanceof AuthError` — found during code review)

### Phase 1: Stripe Connect Onboarding — COMPLETED May 5, 2026
**Scope: 7 new files, 3 modified files | Reviewed & verified**
**Deployed: May 5, 2026 | Migrations applied to Railway DB**

- [x] Install `stripe` package in API app (v22.1.0)
- [x] Add Stripe fields to Doctor model (`stripeAccountId`, `stripeOnboardingComplete`, `stripeChargesEnabled`, `stripePayoutsEnabled`) + migration SQL
- [x] Create `/api/stripe/connect/create-account` endpoint (POST, requireDoctorAuth, creates Express account + onboarding link)
- [x] Create `/api/stripe/connect/account-link` endpoint (POST, requireDoctorAuth, generates re-onboarding link)
- [x] Create `/api/stripe/connect/status` endpoint (GET, requireDoctorAuth, syncs status from Stripe API to local DB)
- [x] Create `/api/stripe/webhook` endpoint (POST, Stripe signature verification, handles `account.updated`)
- [x] Create Stripe SDK singleton (`apps/api/src/lib/stripe.ts`)
- [x] Build Pagos page in doctor app (`/dashboard/pagos`) with 3 states: not connected, onboarding incomplete, fully connected
- [x] Add "Pagos" nav item to sidebar (CreditCard icon, between Reportes and practice management)
- [x] Configure Stripe webhook in Stripe Dashboard (events: `account.updated`, `checkout.session.completed`)
- [x] Set Railway env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DOCTOR_APP_URL`
- [x] Test onboarding with Stripe test mode

### Phase 2: Payment Links — COMPLETED May 5, 2026
**Scope: 3 new API routes, 1 page rewrite, 1 webhook update | Reviewed & verified**
**Deployed: May 5, 2026 | Migrations applied to Railway DB**

- [x] Create PaymentLink model + PaymentLinkStatus enum (prisma migration — `add-payment-links.sql`)
- [x] Create `/api/stripe/payment-links` POST endpoint (creates product + price + payment link on connected account)
- [x] Create `/api/stripe/payment-links` GET endpoint (lists doctor's links with Decimal→string serialization)
- [x] Create `/api/stripe/payment-links/[id]` DELETE endpoint (deactivates on Stripe + marks CANCELLED)
- [x] Handle `checkout.session.completed` webhook event (marks links as PAID)
- [x] Build CreatePaymentLink form in Pagos page (amount + description, validates 1–100k MXN)
- [x] Build PaymentLinksList with status tracking (PENDING/PAID/EXPIRED/CANCELLED)
- [x] Add share actions (WhatsApp, copy link, deactivate)
- [x] Fix `getAuthenticatedDoctor()` to throw `AuthError` instead of plain `Error`
- [x] Document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DOCTOR_APP_URL` in `.env.example`
- [x] Test full payment flow with Stripe test cards

### Phase 2.5: Test → Live Migration — COMPLETED May 8, 2026
**No code changes required — configuration + data cleanup only**

- [x] Create live webhook endpoint in Stripe Dashboard (Cuentas conectadas scope)
  - URL: `https://healthcareapi-production-fb70.up.railway.app/api/stripe/webhook`
  - Events: `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
  - **IMPORTANT:** Scope must be "Cuentas conectadas" (not "Tu cuenta") — all events come from connected doctor accounts
- [x] Get live API keys from Stripe Dashboard (`sk_live_...`, `pk_live_...`)
  - Only `sk_live_...` is needed — publishable key is not used (all Stripe calls are server-side)
- [x] Update Railway env vars: `STRIPE_SECRET_KEY` (sk_live), `STRIPE_WEBHOOK_SECRET` (new whsec from live webhook)
- [x] Clean test Stripe data from production DB:
  - Reset 1 doctor's Stripe fields (Dr. Diego Morales Gutiérrez, `acct_1TTtqRPGwIjAFb7e`) → set all to null/false
  - Deleted 1 test payment link ($500 MXN, status PENDING)
- [x] Complete Stripe Connect platform profile (required for live mode, not needed in test):
  - https://dashboard.stripe.com/settings/connect/platform-profile — accept loss responsibility
  - https://dashboard.stripe.com/connect/accounts/overview — complete platform questionnaire
- [x] First doctor live onboarding (real Stripe KYC: INE, CLABE, RFC)
- [x] First live payment link created ($11 MXN test)
- [ ] First real payment processed

### Phase 2.75: Robustness & Self-Service — COMPLETED May 8, 2026
**Scope: 4 modified files, 1 new endpoint | Improves doctor self-service, reduces TuSalud support load**

- [x] **Double-payment prevention**: Added `restrictions.completed_sessions.limit: 1` to payment link creation — each link can only be paid once
- [x] **Express Dashboard access**: New `/api/stripe/connect/dashboard-link` endpoint generates single-use login links for doctors to access their Stripe Express Dashboard (balance, payouts, refunds, disputes, bank account)
- [x] **Detailed account status**: Enhanced `/api/stripe/connect/status` to return `disabledReason`, `currentlyDue`, `pastDue`, `errors`, `currentDeadline`, and last payout info
- [x] **New webhook handlers**: Added handlers for `checkout.session.expired`, `charge.dispute.created`, `charge.dispute.closed`, `charge.refunded`, `payout.paid`, `payout.failed`, `account.application.deauthorized`
- [x] **Telegram notifications**: Doctors get notified via Telegram for: payment received, dispute opened/closed, payout failed, account restricted/disabled
- [x] **Account deauthorization**: If doctor disconnects from platform, Stripe fields are cleared automatically
- [x] **Pagos UI overhaul**: Account alerts (restricted/disabled/rejected with actionable messages), "Mi Stripe" dashboard button, last payout info, Stripe self-service info section
- [ ] **Add new webhook events in Stripe Dashboard** (see below)

#### Stripe Dashboard Webhook Update Required

Add these events to the **live webhook** (Cuentas conectadas scope):
- `checkout.session.expired`
- `charge.dispute.created`
- `charge.dispute.closed`
- `charge.refunded`
- `payout.paid`
- `payout.failed`
- `account.application.deauthorized`

URL: `https://healthcareapi-production-fb70.up.railway.app/api/stripe/webhook`

### Phase 3: Enhanced Features (Optional, future)
- [ ] Link payment links to specific bookings
- [ ] Auto-generate payment link when booking is created
- [ ] Payment status visible in booking details
- [ ] Add rate limiting to Stripe endpoints
- [ ] Add Zod validation to all Stripe endpoints
- [ ] Platform fee configuration (admin setting)
- [ ] Payment analytics in admin dashboard
- [ ] Meses sin intereses support

---

## 5.1 DEPLOYMENT & SETUP NOTES

### Stripe Connect Setup (completed May 5, 2026)

1. **Activate Connect:** Go to https://dashboard.stripe.com/connect → "Empezar"
2. **Platform type:** Select "Crea una plataforma" (doctors are businesses receiving payments directly from patients)
3. **Test webhook:** Created at Stripe Dashboard → Developers → Webhooks (test mode)
   - URL: `https://healthcareapi-production-fb70.up.railway.app/api/stripe/webhook`
   - Events: `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`

### Live Mode Setup (completed May 8, 2026)

1. **Platform profile:** Complete questionnaire at https://dashboard.stripe.com/settings/connect/platform-profile (accept loss responsibility, describe platform)
2. **Platform questionnaire:** Complete at https://dashboard.stripe.com/connect/accounts/overview (required before creating live connected accounts)
3. **Live webhook:** Created at Stripe Dashboard → Developers → Webhooks (live mode)
   - URL: `https://healthcareapi-production-fb70.up.railway.app/api/stripe/webhook`
   - Events: `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - **Scope: "Cuentas conectadas" only** (NOT "Tu cuenta" — all events originate from connected doctor accounts)
   - **NOTE:** Test mode and live mode have separate webhooks with separate signing secrets
4. **Test data cleanup:** Reset all test `stripeAccountId` values and deleted test payment links from production DB

### Railway Environment Variables (API app)

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | From Stripe Dashboard → Developers → API keys (live mode). Was `sk_test_...` before May 8, 2026. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From **live** webhook endpoint signing secret. Must match the live webhook, not the test one. |
| `DOCTOR_APP_URL` | `https://your-doctor-app.up.railway.app` | No trailing slash. Used for Stripe onboarding redirects to `/dashboard/pagos` |

### Live Mode Gotchas (discovered May 8, 2026)

| Issue | Detail |
|-------|--------|
| **Platform profile required** | Stripe requires completing the platform profile + questionnaire before any live connected accounts can be created. Test mode skips this. Error: "You must complete your platform profile to use Connect" |
| **Webhook scope matters** | Must select "Cuentas conectadas" when creating the webhook — "Tu cuenta" won't receive events from connected doctor accounts |
| **Publishable key not needed** | `pk_live_...` is not used anywhere — all Stripe calls are server-side via `sk_live_...` |
| **Test accounts invalid in live** | Test Stripe account IDs (`acct_...` from test mode) don't work in live mode — doctors must re-onboard |
| **Minimum amount $10 MXN** | Stripe Mexico enforces a minimum charge of $10.00 MXN. Amounts below this fail with `amount_too_small`. Validated in both API and doctor app UI. |

### Account Capabilities Explained

| Capability | Stripe field | Meaning |
|------------|-------------|---------|
| **Cargos habilitados** | `charges_enabled` | Account can accept payments (charge customers). Required to create payment links. |
| **Pagos habilitados** | `payouts_enabled` | Account can receive payouts to bank account. Until Stripe verifies the account (1-2 business days), collected money stays in Stripe balance. |

### Accessing Stripe Balance & Payouts

- **Platform balance:** https://dashboard.stripe.com/balance
- **Connected accounts:** Dashboard → Connect → Accounts → click doctor's account → see their balance and payout status
- **Manual payouts:** Available from the balance page once `payouts_enabled` is active
- Payouts happen automatically on Stripe's schedule (daily by default) once enabled

### Deployment Order (CRITICAL)

Per the [database-architecture.md](../NEW.MD-GUIDES/database-architecture.md) deployment checklist:

```
CORRECT order:
1. Run SQL migrations against Railway DB
2. git push (triggers Railway deploy)
3. Verify app works

WRONG order:
1. git push first → 500 errors if new columns don't exist yet
```

Migration files for this feature:
- `packages/database/prisma/migrations/add-stripe-connect-fields.sql` (Phase 1)
- `packages/database/prisma/migrations/add-payment-links.sql` (Phase 2)
- `packages/database/prisma/migrations/fix-payment-links-updated-at-default.sql` (fix)
- `packages/database/prisma/migrations/add-payment-links-composite-index.sql` (performance)

All migrations are idempotent (safe to re-run).

### Security Hardening (May 5, 2026)

After a full system-level analysis across all apps, the following issues were identified and resolved:

#### Fixed (HIGH priority)

| Issue | Description | Fix |
|-------|-------------|-----|
| Admin privilege escalation | `getAuthenticatedDoctor()` allows ADMIN role, meaning admins could create Stripe accounts or payment links for any doctor | Created `getAuthenticatedDoctorStripe()` that restricts to `role === 'DOCTOR'` only |
| OXXO payments not tracked | OXXO is async (pay at store within 72h). `checkout.session.completed` fires with `payment_status: 'unpaid'` for OXXO. Actual payment confirmation needs separate event | Added `checkout.session.async_payment_succeeded` and `async_payment_failed` webhook handlers |
| Duplicate bookingId race condition | `bookingId` has `@unique` constraint. Concurrent requests could create orphaned Stripe objects | Added pre-check for existing active link before creating |
| Missing composite index | Queries filter by `doctorId + status` but only `doctorId` was indexed | Added `@@index([doctorId, status])` |
| Minimum amount not validated | Stripe Mexico requires min $10 MXN. Amounts below caused 500 error (`amount_too_small`) | Added validation in API (min 10) + doctor app UI (min="10" + client check). Discovered May 8, 2026. |
| Stripe errors returned as 500 | Stripe `StripeInvalidRequestError` (client errors) were caught as generic 500s | Added `isStripeError()` helper in `stripe.ts` — Stripe errors now return 400 with message |
| Internal error details leaked | `create-account` endpoint included Stripe error message in client response | Changed to generic Spanish error message, details only in server logs |

#### Evaluated & Accepted (not bugs)

| Finding | Why it's not an issue |
|---------|----------------------|
| CORS blocks webhook | FALSE POSITIVE — CORS only affects browser requests. Stripe sends server-to-server with no Origin header. Webhook already works. |
| Body parser breaks signature | FALSE POSITIVE — Next.js App Router `request.text()` correctly preserves raw body. |
| JWT expires during onboarding | NextAuth sessions last 30 days. Onboarding takes 5-15 min. |
| `__pending__` placeholder stuck | Rollback on failure + unique constraint prevents corruption. Extremely unlikely edge case. |
| Webhook arrives before DB record | Customer takes 30+ seconds to pay. DB record created in <1s. |
| No charges_enabled re-check | Stripe itself rejects payments if charges disabled. |
| No webhook idempotency table | `updateMany` with `status: 'PENDING'` is naturally idempotent. |

#### Pending actions (do when needed, not now)

| Action | When to do it | Notes |
|--------|---------------|-------|
| Add OXXO webhook events in Stripe Dashboard | When OXXO support is needed | Add `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`. Code handlers already exist in `webhook/route.ts` but Stripe won't send events until configured. Card payments work without this. |
| Run `fix-payment-links-updated-at-default.sql` on Railway | Optional / never | Adds DEFAULT to `updated_at`. Not needed because Prisma always provides the value client-side. Only matters for raw SQL inserts. |
| Run `add-payment-links-composite-index.sql` on Railway | When payment_links table grows large | Performance index on `[doctorId, status]`. Not needed with a handful of links. |

#### Future improvements (Phase 3)

| Item | Priority |
|------|----------|
| ~~Stripe disconnect endpoint~~ | ~~Done — handled via `account.application.deauthorized` webhook~~ |
| Rate limiting on Stripe endpoints | Medium — prevent spam (Stripe has its own limits) |
| Webhook event ID deduplication | Low — add `processed_events` table |
| Zod validation on all inputs | Low — defence-in-depth |
| ~~Express Dashboard access~~ | ~~Done — `/api/stripe/connect/dashboard-link` + "Mi Stripe" button~~ |
| ~~Doctor guide for payments~~ | ~~Done — PagosGuide.tsx with 13 sections covering all edge cases~~ |

---

## 6. RISK MATRIX

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unprotected endpoints exploited before Stripe | Medium | Critical | Phase 0 security fixes |
| Stripe account swapping (change stripeAccountId) | Low | High | Auth + DB constraint (only via onboarding flow) |
| Webhook spoofing | Low | High | Stripe signature verification |
| Payment link spam | Medium | Medium | Rate limiting |
| Leaked Stripe keys | Low | Critical | Server-side only, env vars, no NEXT_PUBLIC_ |
| Doctor creates links with absurd amounts | Low | Low | Validated: min $10 MXN (Stripe minimum), max $100,000 MXN |
| Patient disputes/chargebacks | Medium | Medium | Stripe handles, doctor dashboard shows status, Telegram notification on dispute |
| Double payment on same link | N/A | N/A | Eliminated — `completed_sessions.limit: 1` enforced |
| Payout failure (wrong CLABE) | Medium | Medium | Telegram notification + Express Dashboard for bank update |
| Account disabled by Stripe | Low | High | Pagos page shows alert with reason + action button, Telegram notification |
| Doctor disconnects from platform | Low | Low | `account.application.deauthorized` webhook clears Stripe fields |

---

## 7. FILES TO CREATE/MODIFY

### New Files
```
apps/api/src/app/api/stripe/connect/create-account/route.ts
apps/api/src/app/api/stripe/connect/account-link/route.ts
apps/api/src/app/api/stripe/connect/status/route.ts
apps/api/src/app/api/stripe/connect/dashboard-link/route.ts  (Phase 2.75 — Express Dashboard login link)
apps/api/src/app/api/stripe/payment-links/route.ts
apps/api/src/app/api/stripe/payment-links/[id]/route.ts
apps/api/src/app/api/stripe/webhook/route.ts
apps/api/src/lib/stripe.ts                      (Stripe SDK singleton + isStripeError helper)
apps/doctor/src/app/dashboard/pagos/page.tsx
```

### Modified Files
```
packages/database/prisma/schema.prisma          (add Stripe fields + PaymentLink model)
apps/api/src/middleware.ts                       (add security headers)
apps/api/src/lib/auth.ts                         (remove debug logs, add getAuthenticatedDoctorStripe)
apps/api/src/app/api/auth/consent/route.ts       (add auth)
apps/api/src/app/api/auth/user/route.ts          (secure)
apps/api/src/app/api/auth/google-calendar/tokens/route.ts (add auth)
apps/api/src/app/api/settings/route.ts           (add auth to GET)
apps/api/package.json                            (add stripe dependency)
apps/doctor/src/components/sidebar.tsx           (add Pagos nav item)
apps/doctor/src/app/dashboard/ayuda/_components/PagosGuide.tsx (comprehensive guide rewrite)
```

### Deleted Files
```
apps/api/src/app/api/dev/fix-admin-role/route.ts (security risk)
```

---

## 8. STRIPE TEAM CONSULTATION FINDINGS (May 10, 2026)

Research conducted with Stripe support team + verified against official Stripe documentation.

### 8.1 `type: 'express'` vs `controller` Properties

**Stripe team recommended** using `controller` properties instead of legacy `type`:
```javascript
// Stripe team suggestion (DO NOT USE — invalid combination)
controller: {
  losses: { payments: 'stripe' },
  fees: { payer: 'account' },
  requirement_collection: 'stripe',
  stripe_dashboard: { type: 'express' }
}
```

**Official docs say this combination is INVALID.** Per the migration guide, `stripe_dashboard.type: 'express'` is incompatible with `fees.payer: 'account'`. Valid combinations:

| Type | losses.payments | fees.payer | requirement_collection | stripe_dashboard.type |
|------|-----------------|-----------|------------------------|----------------------|
| Standard | `stripe` | `account` | `stripe` | `full` |
| Express | `application` | `application` | `stripe` | `express` |
| Custom | `application` | `application` | `application` | `none` |

**Decision: Keep `type: 'express'`.** Migration is optional per Stripe docs. Our setup works correctly — with direct charges, the doctor's connected account pays Stripe fees directly, and Stripe handles losses on Express accounts.

### 8.2 Re-onboarding with `collection_options`

Added `collection_options: { fields: 'currently_due' }` to the `account-link` route. This ensures that when a doctor needs to provide additional info (e.g., expired INE, missing documents), Stripe only asks for what's missing — not the full onboarding flow.

**File changed:** `apps/api/src/app/api/stripe/connect/account-link/route.ts`

### 8.3 Payment Methods Available in Mexico

| Method | Type | Confirmation | Limit | Notes |
|--------|------|-------------|-------|-------|
| Visa / Mastercard | Card | Instant | Per card limit | National & international |
| American Express | Card | Instant | Per card limit | National & international |
| Carnet | Card (Mexican) | Instant | Per card limit | Mexican debit card network |
| OXXO | Cash voucher | Next business day | $10,000 MXN max | 72h to pay, exact amount required |
| Apple Pay | Digital wallet | Instant | Per linked card | iPhone, iPad, Mac only |
| Google Pay | Digital wallet | Instant | Per linked card | Android only |
| Link (Stripe) | Digital wallet | Instant | Per linked card | Stripe's fast checkout |

**SPEI (bank transfers):** Not confirmed to work with Payment Links on connected accounts. Omitted until verified.

**Payment method display:** Stripe automatically shows available methods based on the patient's device. Apple Pay only on Apple devices, Google Pay only on Android. Cards and OXXO always shown.

### 8.4 Fee Structure (Mexico, as of May 2026)

| Method | Fee | Notes |
|--------|-----|-------|
| National card (Visa/MC/Amex/Carnet) | 3.6% + $3.00 MXN | Cards issued in Mexico |
| International card | 4.5% + $3.00 MXN | Cards issued outside Mexico |
| Apple Pay / Google Pay | 3.6% + $3.00 MXN | Same as national card (billed to linked card) |
| OXXO | $10.00 MXN flat | Per transaction |
| Chargeback (lost dispute) | $150.00 MXN | Plus the refunded amount |
| Refund | Free | But original commission is NOT returned |
| Account opening | Free | No monthly fees, no setup fees |

**Source:** stripe.com/mx/pricing — rates may change, always verify.

**Example:** $1,000 MXN consultation paid with national card → Stripe fee: $39.00 → Doctor receives: $961.00

### 8.5 Onboarding Requirements for Mexican Doctors

**Basic (always required):**
- Full legal name and date of birth
- Address (clinic or fiscal domicile)
- Phone number and email
- RFC (Registro Federal de Contribuyentes)
- CLABE bancaria (18 digits) for receiving deposits
- Estimated monthly income (AML regulations)

**Identity verification (may be requested):**
- INE or official ID (front and back)
- Proof of address (< 6 months old)

**If operating as a company (persona moral):**
- Razon social, company RFC, fiscal domicile
- Legal representative info
- Beneficial owners with 25%+ participation
- Acta constitutiva or SAT registration proof

Most individual doctors complete onboarding with basic info only. Stripe requests additional documents only when automatic verification fails.

### 8.6 Transaction Statuses & Edge Cases

#### PaymentIntent Statuses (what happens behind the scenes)

| Status | Meaning | Action |
|--------|---------|--------|
| `succeeded` | Payment completed | Service confirmed, doctor notified |
| `processing` | Being processed (OXXO, some banks) | Wait — webhook will confirm |
| `requires_action` | 3D Secure authentication needed | Patient completes bank verification |
| `requires_payment_method` | Card declined or failed | Patient must try another method |

#### Common Card Decline Reasons

| Code | Patient Message | Resolution |
|------|----------------|------------|
| `card_declined` | Tarjeta rechazada | Try another card |
| `insufficient_funds` | Fondos insuficientes | Use another card or OXXO |
| `incorrect_cvc` | CVV incorrecto | Re-enter card details |
| `expired_card` | Tarjeta vencida | Use a different card |
| `do_not_honor` | Banco rechazo la transaccion | Contact bank or try another card |
| `processing_error` | Error temporal | Try again in a few minutes |

**Important:** These errors are handled by Stripe's checkout page automatically. The patient sees a user-friendly message and can retry. The doctor doesn't need to do anything — the link stays active until paid or cancelled.

#### OXXO-specific Edge Cases

| Scenario | What happens |
|----------|-------------|
| Patient generates voucher but doesn't pay in 72h | `checkout.session.async_payment_failed` → link status changes to EXPIRED |
| Patient pays at OXXO on Friday evening | Confirmation arrives Monday (next business day) |
| Patient tries to pay more/less than voucher amount | OXXO rejects — exact amount required |
| Patient loses voucher | Can re-open the link and generate a new voucher (if link still active) |

### 8.7 Payout Management (Doctor's Money)

Doctors manage payouts from their Express Dashboard ("Mi Stripe" button). The platform does NOT intervene.

| Feature | Details |
|---------|---------|
| Automatic payouts | Default: daily with 2-day delay. Configurable: daily, weekly, monthly |
| First payout | ~7 days (Stripe holds funds while verifying new accounts) |
| Manual payouts | Available from Express Dashboard |
| Instant payouts | Not available in Mexico currently |
| Change bank account | Doctor updates CLABE from Express Dashboard |
| Payout failure | Telegram notification sent, doctor must update bank info in Express Dashboard |

### 8.8 What Doctors Can Do From Express Dashboard

- View balance and deposit history
- Change bank account (CLABE)
- Configure payout frequency (daily/weekly/monthly)
- View payment details (amount, method, date, Stripe fee)
- Issue refunds (partial or full)
- Respond to disputes with evidence
- Download Stripe fee invoices (deductible)
- Update personal/business information
