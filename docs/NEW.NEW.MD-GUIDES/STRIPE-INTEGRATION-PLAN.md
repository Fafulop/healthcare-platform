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
- [ ] Test onboarding with Stripe test mode

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
- [ ] Test full payment flow with Stripe test cards

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
3. **Webhook:** Created at Stripe Dashboard → Developers → Webhooks
   - URL: `https://healthcareapi-production-fb70.up.railway.app/api/stripe/webhook`
   - Events: `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Scope: Both "Tu cuenta" and "Cuentas conectadas y v2"
   - **IMPORTANT:** Add `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed` for OXXO support

### Railway Environment Variables (API app)

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | From Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From webhook endpoint signing secret |
| `DOCTOR_APP_URL` | `https://your-doctor-app.up.railway.app` | No trailing slash. Used for Stripe onboarding redirects to `/dashboard/pagos` |

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
| Stripe disconnect endpoint | Medium — allows doctor to revoke Stripe |
| Rate limiting on Stripe endpoints | Medium — prevent spam (Stripe has its own limits) |
| Webhook event ID deduplication | Low — add `processed_events` table |
| Zod validation on all inputs | Low — defence-in-depth |

---

## 6. RISK MATRIX

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unprotected endpoints exploited before Stripe | Medium | Critical | Phase 0 security fixes |
| Stripe account swapping (change stripeAccountId) | Low | High | Auth + DB constraint (only via onboarding flow) |
| Webhook spoofing | Low | High | Stripe signature verification |
| Payment link spam | Medium | Medium | Rate limiting |
| Leaked Stripe keys | Low | Critical | Server-side only, env vars, no NEXT_PUBLIC_ |
| Doctor creates links with absurd amounts | Low | Low | Optional max amount validation |
| Patient disputes/chargebacks | Medium | Medium | Stripe handles, doctor dashboard shows status |

---

## 7. FILES TO CREATE/MODIFY

### New Files
```
apps/api/src/app/api/stripe/connect/create-account/route.ts
apps/api/src/app/api/stripe/connect/account-link/route.ts
apps/api/src/app/api/stripe/connect/status/route.ts
apps/api/src/app/api/stripe/payment-links/route.ts
apps/api/src/app/api/stripe/payment-links/[id]/route.ts
apps/api/src/app/api/stripe/webhook/route.ts
apps/doctor/src/app/pagos/page.tsx
apps/doctor/src/components/payments/StripeOnboarding.tsx
apps/doctor/src/components/payments/CreatePaymentLink.tsx
apps/doctor/src/components/payments/PaymentLinksList.tsx
apps/doctor/src/components/payments/PaymentLinkActions.tsx
```

### Modified Files
```
packages/database/prisma/schema.prisma          (add Stripe fields + PaymentLink model)
apps/api/src/middleware.ts                       (add security headers)
apps/api/src/lib/auth.ts                         (remove debug logs)
apps/api/src/app/api/auth/consent/route.ts       (add auth)
apps/api/src/app/api/auth/user/route.ts          (secure)
apps/api/src/app/api/auth/google-calendar/tokens/route.ts (add auth)
apps/api/src/app/api/settings/route.ts           (add auth to GET)
apps/api/package.json                            (add stripe dependency)
apps/doctor/src/components/sidebar.tsx           (add Pagos nav item)
```

### Deleted Files
```
apps/api/src/app/api/dev/fix-admin-role/route.ts (security risk)
```
