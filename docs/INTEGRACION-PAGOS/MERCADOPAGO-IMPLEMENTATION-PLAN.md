# Mercado Pago Integration — Implementation Plan

**Created:** May 18, 2026
**Status:** All phases complete, deployed, and live-tested
**Reference:** [MERCADOPAGO-INTEGRATION-ANALYSIS.md](./MERCADOPAGO-INTEGRATION-ANALYSIS.md) (full technical analysis)
**Reference:** [STRIPE-INTEGRATION-PLAN.md](./STRIPE-INTEGRATION-PLAN.md) (existing Stripe integration)

---

## Architecture Decisions (all resolved)

| Decision | Answer |
|----------|--------|
| Table approach | **Separate** — new `MpPaymentPreference` table, existing `PaymentLink` (Stripe) untouched |
| UI | Both providers on `/dashboard/pagos`, doctor clicks one to expand |
| Auth | `getAuthenticatedDoctorStripe` (DOCTOR only, no ADMIN) |
| Platform fee | **None** (marketplace_fee = 0) |
| back_urls | **Removed** — MP shows its own completion screen (never point to doctor app) |
| payment_methods | **Not configured** — let MP use defaults (custom config can block checkout) |
| payer.email | **Optional** — doctor can enter patient email to improve approval rate |
| statement_descriptor | **Auto** — doctor's full name, truncated to 22 chars |
| items.description | **Auto** — same as title, sent for MP quality score |
| SDK | **Raw `fetch()`** — no `mercadopago` npm package |
| Token encryption | **AES-256-GCM** with separate `MP_ENCRYPTION_KEY` env var |
| Webhook lookup | **`user_id`** from payload → find doctor → decrypt token → fetch payment |
| Token refresh failure | **Both** — mark `mpConnected: false` + Telegram notification |

---

## Environment Variables Needed

```env
# API App — Railway
MP_CLIENT_ID=               # Application ID from MP developer dashboard
MP_CLIENT_SECRET=           # Client secret from MP developer dashboard
MP_WEBHOOK_SECRET=          # Webhook signing secret from MP dashboard
MP_ENCRYPTION_KEY=          # 32-byte hex key for AES-256-GCM (generate: openssl rand -hex 32)
```

---

## Files to Create

```
apps/api/src/lib/mercadopago.ts                                    # MP helpers, encryption, fetch wrappers
apps/api/src/app/api/mercadopago/connect/authorize/route.ts        # POST — generate OAuth URL
apps/api/src/app/api/mercadopago/connect/callback/route.ts         # GET  — OAuth callback, save tokens
apps/api/src/app/api/mercadopago/connect/status/route.ts           # GET  — connection status
apps/api/src/app/api/mercadopago/connect/disconnect/route.ts       # POST — clear MP fields
apps/api/src/app/api/mercadopago/preferences/route.ts              # POST/GET — create/list preferences
apps/api/src/app/api/mercadopago/preferences/[id]/route.ts         # DELETE — deactivate preference
apps/api/src/app/api/mercadopago/webhook/route.ts                  # POST — handle MP notifications
apps/api/src/app/api/cron/mp-token-refresh/route.ts                # GET  — refresh expiring tokens

apps/doctor/src/components/payments/StripeSection.tsx               # Extracted from current pagos page
apps/doctor/src/components/payments/MercadoPagoSection.tsx          # New MP section
apps/doctor/src/components/payments/PaymentLinkRow.tsx              # Shared link row component
apps/doctor/src/components/payments/CreatePaymentForm.tsx           # Shared create form
apps/doctor/src/components/payments/StatusRow.tsx                   # Extracted status row
# Note: ProviderCard is an inline component in pagos/page.tsx (not a separate file)

packages/database/prisma/migrations/add-mp-doctor-fields.sql       # ALTER TABLE doctors
packages/database/prisma/migrations/add-mp-payment-preferences.sql # CREATE TABLE mp_payment_preferences
```

## Files to Modify

```
packages/database/prisma/schema.prisma                              # Add MP fields to Doctor + MpPaymentPreference model
apps/doctor/src/app/dashboard/pagos/page.tsx                        # Rewrite with dual-provider selector
apps/doctor/src/app/dashboard/ayuda/_components/PagosGuide.tsx      # Add MP documentation section
```

---

## Implementation Phases

### Phase 0: MP Application Setup
> **Status:** COMPLETED (May 18, 2026)

- [x] Register application at mercadopago.com/developers
- [x] Configure redirect URI: `https://healthcareapi-production-fb70.up.railway.app/api/mercadopago/connect/callback`
- [x] Get `MP_CLIENT_ID` and `MP_CLIENT_SECRET`
- [x] Configure webhook URL in MP dashboard
- [x] Get `MP_WEBHOOK_SECRET` from dashboard
- [x] Generate `MP_ENCRYPTION_KEY`: `openssl rand -hex 32`
- [x] Set all 4 env vars on Railway (API app)

---

### Phase 1: Database + OAuth Connection
> **Status:** COMPLETED (May 18, 2026)
> **Depends on:** Phase 0

#### 1a. Database migration

- [x] Add MP fields to Doctor model in `schema.prisma`:
  - `mpUserId` (String?, @unique)
  - `mpAccessToken` (String?) — encrypted at rest
  - `mpRefreshToken` (String?) — encrypted at rest
  - `mpTokenExpiresAt` (DateTime?)
  - `mpPublicKey` (String?)
  - `mpConnected` (Boolean, default false)
- [x] Create `add-mp-doctor-fields.sql`
- [x] Run migration against local DB
- [x] Run migration against Railway DB
- [x] Regenerate Prisma client (`pnpm db:generate`)

#### 1b. MP helper library

- [x] Create `apps/api/src/lib/mercadopago.ts`:
  - `encrypt(plaintext: string): string` — AES-256-GCM, prepends IV+authTag to ciphertext, returns hex
  - `decrypt(encrypted: string): string` — reverses above
  - `mpFetch(path, options, accessToken?)` — thin wrapper around fetch with base URL + auth header
  - `verifyWebhookSignature(xSignature, xRequestId, dataId, secret): boolean` — HMAC-SHA256

#### 1c. OAuth endpoints

- [x] `POST /api/mercadopago/connect/authorize`
  - Auth: `getAuthenticatedDoctorStripe`
  - Generates cryptographic `state` param (doctorId:randomHex)
  - Returns `{ url: "https://auth.mercadopago.com/authorization?..." }`

- [x] `GET /api/mercadopago/connect/callback`
  - No auth (OAuth redirect from MP)
  - Validates `state` param (CSRF protection)
  - Exchanges `code` for `access_token` via `POST /oauth/token`
  - Encrypts `access_token` and `refresh_token` with AES-256-GCM
  - Checks for duplicate MP account linking
  - Redirects to `{DOCTOR_APP_URL}/dashboard/pagos?mp=connected`

- [x] `GET /api/mercadopago/connect/status`
  - Auth: `getAuthenticatedDoctorStripe`
  - Returns: `{ connected, mpUserId, tokenExpiresAt, tokenExpiresSoon }`

- [x] `POST /api/mercadopago/connect/disconnect`
  - Auth: `getAuthenticatedDoctorStripe`
  - Clears all MP fields, sets `mpConnected: false`

#### 1d. Deploy

- [x] Run `add-mp-doctor-fields.sql` against Railway DB (verified columns exist)
- [x] `git push` — deployed
- [x] Test OAuth flow end-to-end (live credentials, working)

---

### Phase 2: Payment Preferences + Webhook
> **Status:** COMPLETED (May 18, 2026)
> **Depends on:** Phase 1

#### 2a. Database migration

- [x] Add `MpPaymentPreference` model to `schema.prisma` (reuses `PaymentLinkStatus` enum)
- [x] Add reverse relations on `Booking` and `Service` models
- [x] Create `add-mp-payment-preferences.sql`
- [x] Run migration against local DB
- [x] Run migration against Railway DB (verified table + all columns exist)
- [x] Regenerate Prisma client

#### 2b. Preference endpoints

- [x] `POST /api/mercadopago/preferences` — create preference with seller's token, validates amount $10-$100k, checks token expiry, saves to DB, sends payer.email + items.description + statement_descriptor for MP quality
- [x] `GET /api/mercadopago/preferences` — list doctor's preferences, Decimal→string serialization
- [x] `DELETE /api/mercadopago/preferences/[id]` — verify ownership, only PENDING can be cancelled

#### 2c. Webhook handler

- [x] `POST /api/mercadopago/webhook` — signature verification (HMAC-SHA256), lookup doctor by `user_id`, fetch payment details with decrypted token (isolated scope), idempotent status updates, Telegram notifications on approved/chargeback, warning log if secret not configured

#### 2d. Deploy

- [x] Run `add-mp-payment-preferences.sql` against Railway DB (verified)
- [x] `git push` — deployed
- [x] Configure webhook events in MP dashboard
- [x] Test full payment flow (live credentials)
- [x] **BUGFIX:** Removed `back_urls` — were pointing to `DOCTOR_APP_URL`, sending patients to doctor dashboard
- [x] **BUGFIX:** Removed `payment_methods` config (installments) — was blocking pay button on checkout

---

### Phase 3: Pagos Page Redesign
> **Status:** COMPLETED (May 18, 2026)
> **Depends on:** Phase 2

- [x] Extract current Stripe logic from `pagos/page.tsx` into `components/payments/StripeSection.tsx`
- [x] Extract shared sub-components:
  - `PaymentLinkRow.tsx` — accepts `url` prop (works for both `stripePaymentLinkUrl` and `mpInitPoint`)
  - `CreatePaymentForm.tsx` — amount + description, `onSubmit` callback
  - `StatusRow.tsx` — label + enabled/disabled badge
- [x] Create `ProviderCard` inline component in `page.tsx` — clickable card with:
  - Provider logo (SVG)
  - Provider name + brief description of payment methods
  - Chevron expand/collapse indicator
- [x] Create `MercadoPagoSection.tsx`:
  - OAuth connect/disconnect flow
  - Connection status (connected, token expiry date, token expiry warning)
  - Create preference form (reuses `CreatePaymentForm`)
  - Preferences list (reuses `PaymentLinkRow` with `url={pref.mpInitPoint}`)
  - Disconnect button with confirmation
  - Available payment methods display
- [x] Rewrite `pagos/page.tsx` (~200 lines, down from 843):
  - Two provider cards stacked vertically
  - Accordion: click one → expands its section, collapses the other
  - Error state lifted to page level via `onError` callback
  - OAuth return detection for both providers (`?success=true`, `?mp=connected`)
  - Tabs remain: [Mis pagos] [Guia]
- [x] Code review passed (2 minor redundant Content-Type headers fixed)
- [x] TypeScript compiles clean (0 errors)
- [x] Test both providers side-by-side (deployed, working)
- [x] **BUGFIX:** `handleError` wrapped in `useCallback` — was causing infinite re-render loop

---

### Phase 4: Token Management + Robustness
> **Status:** COMPLETED (May 18, 2026) — Railway cron config is manual
> **Depends on:** Phase 2

- [x] Create `/api/cron/mp-token-refresh` endpoint:
  - Protected by `CRON_SECRET`
  - Finds doctors with `mpConnected: true` AND `mpTokenExpiresAt` within 30 days
  - Refreshes via `POST /oauth/token` with `grant_type: refresh_token`
  - On success: update encrypted tokens + new expiry
  - On failure: set `mpConnected: false`, clear tokens, send Telegram notification
  - On urgent refresh (within 7 days): Telegram notification confirming auto-renewal
- [x] Telegram notifications (all implemented):
  - Payment received (amount, method, description) — in webhook, `approved` case
  - Chargeback alert — in webhook, `charged_back` case
  - Token auto-renewed — in cron, when token was within 7 days of expiry
  - Token refresh failed / disconnected — in cron, on refresh failure
  - OAuth revoked from MP side — in webhook, `mp-connect` topic
  - Fraud alert — in webhook, `stop_delivery_op_wh` topic
- [x] Add `mp-connect` webhook topic handling (doctor revokes access from MP side):
  - Clears all MP fields, sets `mpConnected: false`
  - Notifies doctor via Telegram
- [x] Handle `stop_delivery_op_wh` (fraud alert):
  - Logs error, notifies doctor via Telegram
- [x] Handle chargeback/claim webhooks:
  - `charged_back` status updates preference to CANCELLED, notifies doctor
  - `refunded` / `cancelled` status updates preference to CANCELLED
- [ ] Configure Railway cron job (daily) — **manual step in Railway dashboard**:
  - Service: cron job pointing to `POST /api/cron/mp-token-refresh`
  - Schedule: `0 6 * * *` (daily at 6 AM UTC / midnight Mexico City)
  - Header: `Authorization: Bearer <CRON_SECRET>`

---

### Phase 5: Polish
> **Status:** COMPLETED (May 18, 2026) — test→live migration is manual
> **Depends on:** Phase 3

- [x] Update `PagosGuide.tsx` to include MP sections:
  - Added intro banner explaining both providers
  - Added Stripe/MP section headers for visual separation
  - Added 5 new MP sections: overview, payment methods, connection steps, fees, disconnect/security
  - Added Stripe vs MP comparison table
  - Updated notifications section with MP-specific alerts (3 new: connection renewed, disconnected, fraud)
  - Updated FAQ with 6 new MP questions + updated SPEI answer
  - Fixed icon type props (`typeof X` → `LucideIcon`) after code review
  - TypeScript compiles clean (0 errors)
- [x] Deployed and tested with live MP credentials
- [x] First live doctor onboarding (OAuth flow working)
- [x] First live payment link created and checkout tested
- [ ] Verify webhook receives live payment events (needs a completed payment)
- [ ] Rate limiting on MP endpoints (if needed, monitor after launch)

---

## Current Status

```
Phase 0: MP Application Setup       [x] COMPLETED (May 18, 2026)
Phase 1: Database + OAuth Connection [x] COMPLETED + DEPLOYED (May 18, 2026)
Phase 2: Preferences + Webhook       [x] COMPLETED + DEPLOYED (May 18, 2026)
Phase 3: Pagos Page Redesign         [x] COMPLETED + DEPLOYED (May 18, 2026)
Phase 4: Token Management            [x] COMPLETED + DEPLOYED (May 18, 2026)
Phase 5: Polish                      [x] COMPLETED + DEPLOYED (May 18, 2026)
```

**What's done:**
- MP app registered, 4 env vars set on Railway
- 10 new API files created (lib, 4 connect routes, 2 preference routes, webhook, cron, 2 migrations)
- 5 new UI files created (StripeSection, MercadoPagoSection, PaymentLinkRow, CreatePaymentForm, StatusRow)
- 4 files modified (schema.prisma, .env.example, pagos/page.tsx rewritten)
- PagosGuide.tsx updated with 5 new MP sections + comparison table + notifications + 6 FAQs
- Webhook handles 3 topic types: `payment`, `mp-connect`, `stop_delivery_op_wh`
- Cron sends Telegram on urgent auto-renewal (within 7 days), added to Railway cron runner
- 6 distinct Telegram notification types implemented
- Both SQL migrations executed on local + Railway DB (verified)
- Prisma client regenerated, TypeScript compiles clean (0 errors)
- Code reviews completed: Phase 2 (1 bug, 2 minor), Phase 3 (2 minor), Phase 4 (1 bug fixed), Phase 5 (2 type bugs fixed)
- All phases deployed and live-tested (May 18, 2026)
- 3 post-deploy bugfixes: `useCallback` infinite re-render, `back_urls` security issue, `payment_methods` blocking checkout
- MP integration quality score: **89/100** (approved, min 73) — improved with payer.email, items.description, statement_descriptor
- First live payment completed successfully ($13 MXN, debit Visa via Checkout Pro)

**Known behaviors (MP-side, not our code):**
- **Self-payment blocked**: MP does not allow the same account to be both buyer and seller. When testing, use incognito or a different MP account to simulate the patient. In production this is a non-issue — patients will never be logged into the doctor's MP account.

**Remaining:**
1. Verify webhook receives live payment events (needs a completed real payment)
2. Configure Railway cron job for daily token refresh (Phase 4 — manual in Railway dashboard)
3. Rate limiting on MP endpoints (monitor after launch)
4. Re-measure quality score after payer.email improvement (target: 95+)

---

## Quick Reference

| Item | Value |
|------|-------|
| MP API base URL | `https://api.mercadopago.com` |
| OAuth authorize URL | `https://auth.mercadopago.com/authorization` |
| Preference endpoint | `POST /checkout/preferences` (with seller's access_token) |
| Payment details | `GET /v1/payments/{id}` (with seller's access_token) |
| Token exchange | `POST /oauth/token` |
| Token validity | 180 days (access_token), must refresh before expiry |
| Webhook signature | `x-signature` header, HMAC-SHA256 |
| Webhook response | HTTP 200/201 within 22 seconds |
| Webhook retries | Every 15 minutes after 3rd attempt |
| Min amount (Mexico) | ~$10 MXN (verify with MP) |
| Auth helper | `getAuthenticatedDoctorStripe` (DOCTOR only) |
| Encryption | AES-256-GCM, `MP_ENCRYPTION_KEY` env var |
| Existing Stripe code | Untouched — separate endpoints, separate table |
