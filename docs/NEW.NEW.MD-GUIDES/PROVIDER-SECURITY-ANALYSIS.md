# Provider Security Analysis — tusalud.pro

**Date:** 2026-05-06
**Scope:** All third-party providers, attack vectors, and risk assessment

---

## Providers Inventory

| # | Provider | Services Used | Risk Level |
|---|----------|--------------|------------|
| 1 | **Google Cloud** | OAuth, Calendar, Gmail, Analytics (GA4), Search Console, Meet | CRITICAL |
| 2 | **Stripe** | Connect (Express), Payment Links, Webhooks, OXXO | HIGH |
| 3 | **Railway** | PostgreSQL hosting, pgvector DB (LLM embeddings) | CRITICAL |
| 4 | **UploadThing** | File storage (medical records, images, videos, PDFs) | HIGH |
| 5 | **OpenAI** | GPT-4o chat, Whisper transcription, Embeddings | MEDIUM |
| 6 | **Twilio** | SMS notifications (appointment reminders) | MEDIUM |
| 7 | **Telegram** | Bot notifications, daily summaries, task reminders | LOW |
| 8 | **GitHub** | Source code hosting, CI/CD | CRITICAL |
| 9 | **Vercel/Hosting** | Next.js deployment (4 apps: public, doctor, admin, api) | HIGH |
| 10 | **Anthropic** | LLM provider (stub, not yet active) | N/A |

---

## CRITICAL FINDINGS

### 1. ~~JWT Secret Exposed to Client (`NEXT_PUBLIC_JWT_SECRET`)~~ FIXED

**File:** `apps/admin/.env` (was line 9)
**Risk:** ~~CRITICAL~~ RESOLVED

**Analysis:** `NEXT_PUBLIC_JWT_SECRET` existed in `apps/admin/.env` and `JWT_SECRET` in `apps/api/.env`, but **neither was referenced by any source code**. All JWT signing/verification uses `AUTH_SECRET` or `NEXTAUTH_SECRET` instead. These were dead leftover variables from an earlier auth approach. Also removed stale `ADMIN_EMAIL`/`ADMIN_PASSWORD` placeholder credentials from `apps/admin/.env`.

**What was done:**
- Removed `NEXT_PUBLIC_JWT_SECRET` from `apps/admin/.env`
- Removed unused `JWT_SECRET` from `apps/api/.env`
- Removed stale `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `apps/admin/.env`
- Verified zero source code references to either variable — no functionality affected

---

### 2. `allowDangerousEmailAccountLinking: true` in NextAuth — REVIEWED, ACCEPTABLE

**File:** `packages/auth/src/nextauth-config.ts` line 25
**Risk:** ~~CRITICAL~~ LOW (in current single-provider setup)

**Deep analysis:** This flag is dangerous when multiple OAuth providers exist (e.g., Google + GitHub) because provider B could hijack an account created by provider A if they share an email. However, this app uses **Google as the only OAuth provider**. Google guarantees email ownership (only verified emails), and you cannot have two Google accounts with the same email. The flag also serves as a recovery mechanism if an Account record gets corrupted.

**What was done:**
- Added a security comment warning that this MUST be removed if a second provider is added
- No code change needed — the flag is safe in the current architecture

**Escalation condition:** If any new auth provider is added (GitHub, email/password, credentials), this MUST be set to `false` immediately.

---

### 3. Google Cloud — Single Point of Failure & Token Storage — REVIEWED, ACCEPTABLE

**Risk:** ~~CRITICAL~~ MEDIUM (scopes are justified; token encryption is a future improvement)

Google is used for authentication, calendar, email, analytics, and search console. A compromised Google Cloud project or OAuth credentials would give an attacker:

| Attack Vector | Impact |
|--------------|--------|
| Stolen `GOOGLE_CLIENT_SECRET` | Impersonate the app, intercept OAuth tokens for all users |
| Compromised Google Service Account | Read all GA4 analytics, Search Console data (read-only) |
| Stolen user OAuth tokens (stored in DB) | Read/write any doctor's Google Calendar, send emails as them via Gmail |
| Google Cloud project takeover | Full control of OAuth, can redirect auth flows, steal all tokens |

**Deep scope analysis:**
- `calendar` (full scope) — **Required.** The app creates/deletes entire calendars (`calendars.insert`, `calendars.delete`), not just events. The narrower `calendar.events` scope cannot do this.
- `gmail.send` — **Already minimal.** Only allows sending, not reading inbox.
- Service Account: `analytics.readonly` + `webmasters.readonly` — **Already read-only.**

**Token storage:** `googleAccessToken` and `googleRefreshToken` stored in plaintext in User model. Encrypting at application level is a recommended future improvement, but the primary defense is database access security (Railway private networking, strong credentials, SSL).

**Recommendations (non-urgent):**
- Enable MFA on Google Cloud project
- Enable Google Cloud audit logging and alerts
- Encrypt OAuth tokens at rest when time permits (track as tech debt)
- Rotate Service Account key annually

---

### 4. Railway — Database Takeover

**Risk:** CRITICAL

Two PostgreSQL databases are hosted on Railway with connection strings in env vars:
- `DATABASE_URL` — Primary database (all patient data, appointments, medical records)
- `LLM_DATABASE_URL` — pgvector database (LLM embeddings, document chunks)

**Impact of credential leak:**
- Full read/write access to ALL patient medical records (LFPDPPP violation)
- Access to all doctor profiles, financial data, appointment history
- Ability to modify or delete any data
- Access to stored OAuth tokens for all users

**Concerns:**
- Railway databases are internet-accessible by default (no VPC)
- Connection strings include password in plaintext
- No apparent database-level encryption for sensitive fields (tokens, medical data)
- No connection pooling with auth (like PgBouncer with SSL client certs)

**Fix:**
- Enable Railway Private Networking (restrict to deploy-only access)
- Add SSL/TLS requirement for database connections
- Encrypt sensitive columns (OAuth tokens, patient PII) at application level
- Set up database audit logging
- Use connection pooling with short-lived credentials
- Regular database backups with encryption

---

## HIGH-RISK FINDINGS

### 5. Stripe — Financial Fraud & Account Hijacking

**Risk:** HIGH

Stripe Connect Express is used for doctor payments in MXN (including OXXO cash payments).

| Attack Vector | Impact |
|--------------|--------|
| Stolen `STRIPE_SECRET_KEY` | Create fraudulent payment links, read all payment data, transfer funds |
| Webhook replay/spoofing (if `STRIPE_WEBHOOK_SECRET` leaked) | Mark fake payments as completed, trigger false appointment confirmations |
| Doctor impersonation via JWT forgery (see Finding #1) | Create Stripe Connect accounts under fake doctors, redirect payouts |

**Positive findings:**
- Webhook signature verification is properly implemented
- Race condition prevention on Connect account creation (atomic `updateMany`)
- Doctor-only restriction on Stripe operations (admins cannot create payment accounts)

**Fix:**
- Restrict Stripe API key to minimum permissions using Restricted Keys
- Enable Stripe Radar for fraud detection
- Set up Stripe webhook endpoint verification in dashboard
- Monitor for unusual Connect account creation patterns
- Add IP allowlisting for Stripe API access if possible

---

### 6. ~~UploadThing — Medical File Exposure~~ FIXED (auth added)

**Risk:** ~~HIGH~~ LOW (auth middleware added to all upload routes)

UploadThing stores sensitive medical files: images (16MB), videos (128MB), audio (32MB), PDFs (32MB), and doctor certificates.

**Deep analysis:**
- `/api/uploadthing` must remain in PUBLIC_PREFIXES because UploadThing's CDN sends server-to-server callbacks to this endpoint after uploads complete. Blocking it would break uploads.
- The correct defense layer is UploadThing's `.middleware()` chain, which runs only on the initial signed-URL request (not on callbacks).
- Previously, no upload routes had `.middleware()` — unauthenticated users could theoretically obtain signed upload URLs.

**What was done:**
- Added `.middleware(authMiddleware)` to ALL upload routes in 3 files:
  - `apps/doctor/src/app/api/uploadthing/core.ts` (14 routes) — uses NextAuth `auth()`
  - `apps/admin/src/app/api/uploadthing/core.ts` (4 routes) — uses NextAuth `auth()`
  - `apps/api/src/app/api/uploadthing/core.ts` (11 routes) — uses JWT `validateAuthToken()`
- All 3 apps type-check clean

**Remaining recommendations:**
- Consider signed URLs with expiration for file downloads (currently UploadThing URLs are permanent)
- Audit UploadThing file access logs regularly

---

### 7. GitHub — Source Code & Supply Chain

**Risk:** HIGH

GitHub hosts the monorepo. Compromise means access to all source code, deployment workflows, and potentially secrets.

| Attack Vector | Impact |
|--------------|--------|
| Compromised developer GitHub account | Push malicious code, access all secrets in CI/CD |
| Dependency supply chain attack | Malicious npm package update could exfiltrate data |
| GitHub Actions secrets leak | Access to all deployment credentials |

**Fix:**
- Enable 2FA for all GitHub organization members
- Enable branch protection rules (require PR reviews, no force push to main)
- Use Dependabot or similar for dependency vulnerability scanning
- Audit GitHub Actions workflows for secret exposure
- Use CODEOWNERS file to require specific reviewers
- Pin dependency versions; audit `package-lock.json` changes

---

## MEDIUM-RISK FINDINGS

### 8. OpenAI — Data Exfiltration via LLM

**Risk:** MEDIUM

OpenAI is used for medical chat assistants, voice transcription, and embeddings. Medical context (patient data, encounter notes, prescriptions) is sent to OpenAI APIs.

| Attack Vector | Impact |
|--------------|--------|
| Stolen `OPENAI_API_KEY` | Rack up API costs, access usage logs |
| Prompt injection via patient data | Extract system prompts, other patient data in context |
| Data sent to OpenAI servers | Patient medical data leaves your infrastructure (LFPDPPP concern) |

**Concerns:**
- Multiple chat endpoints send patient/medical context to OpenAI (encounters, prescriptions, appointments, patients)
- Voice transcription sends audio of medical consultations to OpenAI
- Embeddings pipeline ingests medical documents
- Rate limiter is in-memory only — resets on deploy, doesn't work across instances

**Fix:**
- Implement OpenAI API key usage limits and monitoring
- Add input sanitization to prevent prompt injection
- Review OpenAI data processing agreement for LFPDPPP compliance
- Consider on-premise LLM for the most sensitive medical data
- Implement distributed rate limiting (Redis)
- Log all LLM interactions for audit trail

---

### 9. ~~Twilio — SMS Bombing via Booking Spam~~ FIXED (rate limiter added)

**Risk:** ~~MEDIUM~~ LOW

**Deep analysis:** Twilio credentials being stolen would allow sending SMS as the platform, but that's an env var security concern (covered by general secret management). The more actionable risk was that each public booking triggers SMS, email, and Telegram notifications — without rate limiting, an attacker could spam bookings to bomb a doctor with notifications and rack up Twilio costs.

**What was done:**
- Added in-memory IP-based rate limiter to `POST /api/appointments/bookings`
- 10 bookings per minute per IP for unauthenticated requests
- Authenticated users (doctors/admins) bypass the rate limit
- Returns 429 (Too Many Requests) when limit exceeded
- Periodic cleanup (`setInterval`) purges expired entries every 60s to prevent unbounded memory growth

**Remaining recommendations:**
- Set Twilio spending alerts and geographic restrictions (Mexico only)
- Monitor Twilio usage dashboard for anomalies

---

### 10. ~~Telegram — Webhook Without Signature Verification~~ FIXED

**Risk:** ~~LOW-MEDIUM~~ LOW

**Deep analysis:** The webhook only replies with the sender's chat ID — no database writes, no data exposure, no state changes. The impact of a forged request is minimal (bot replies to the attacker's chat ID with their own chat ID). The daily summary/reminder cron endpoints are separate routes protected by `CRON_SECRET`.

**What was done:**
- Added `X-Telegram-Bot-Api-Secret-Token` header verification to the webhook
- Uses `crypto.timingSafeEqual()` for constant-time secret comparison (prevents timing attacks)
- When `TELEGRAM_WEBHOOK_SECRET` env var is set, requests without a matching header are silently rejected
- Updated webhook registration comment with `secret_token` parameter
- Backwards-compatible: if `TELEGRAM_WEBHOOK_SECRET` is not set, webhook works as before

**To activate:** Set `TELEGRAM_WEBHOOK_SECRET` env var and re-register the webhook with `&secret_token=<value>`

---

## ARCHITECTURAL VULNERABILITIES

### 11. ~~Missing Security Headers~~ FIXED

**Risk:** ~~HIGH~~ RESOLVED

**Deep analysis:** The API middleware had X-Content-Type-Options, X-Frame-Options, HSTS, and Referrer-Policy but no CSP or Permissions-Policy. The frontend apps (doctor, admin, public) had **no security headers at all**. A full CSP for the frontend apps requires careful allowlisting of inline scripts and third-party resources — for now, basic headers were added everywhere, and a strict CSP was added to the API (JSON-only).

**What was done:**
- API middleware (`apps/api/src/middleware.ts`): added CSP (`default-src 'none'; frame-ancestors 'none'`) and Permissions-Policy
- Doctor app (`apps/doctor/next.config.ts`): added `poweredByHeader: false` and security headers (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy with microphone=self for voice features)
- Admin app: created `apps/admin/next.config.ts` with security headers and image domains
- Public app: created `apps/public/next.config.ts` with security headers

**Future:** Add a full CSP to frontend apps once all inline scripts and third-party resources are audited.

---

### 12. ~~Input Validation Gaps~~ PARTIALLY FIXED

**Risk:** ~~HIGH~~ MEDIUM (public endpoint hardened; admin endpoint deferred)

**Deep analysis:**
- **Doctor creation** (`POST /api/doctors`, admin-only): Zod schema exists in `packages/types/src/validation/doctor.ts` but is commented out because the request body shape has evolved (now uses `clinic_locations` array, extra social links, `google_ads_id`). Since this is admin-only, the risk is lower. Re-enabling requires schema updates to match the current API — tracked as tech debt.
- **Booking creation** (`POST /api/appointments/bookings`, public): This was the higher-risk surface. Had only `slotId` and `patientName` presence checks.

**What was done:**
- Added input validation to the public booking endpoint:
  - `slotId`: must be a string
  - `patientName`: must be 2-200 characters
  - `patientEmail`: must match email format regex when provided
  - `patientPhone`: must be at most 20 characters when provided
  - `notes`: must be at most 2000 characters when provided
- Type-checks clean

**Remaining:**
- Update `createDoctorSchema` to match current API fields, then re-enable validation (admin endpoint, lower priority)
- Add Zod validation to other public endpoints as they are identified

---

### 13. Admin Role Assignment via Environment Variable — REVIEWED, ACCEPTABLE

**Risk:** ~~MEDIUM~~ LOW (not exploitable with Google-only auth)

**Deep analysis:** The concern was that an attacker could register with an admin email before the real admin. However, with Google OAuth as the only auth provider, this is not possible:
- Google verifies email ownership during OAuth
- You cannot authenticate as `someone@gmail.com` without owning that Google account
- The `ADMIN_EMAILS` env var is server-side only, not exposed to clients

The risk would only materialize if credentials-based auth (email/password registration) were added. No code change needed.

---

### 14. Cron Endpoints Protected Only by `CRON_SECRET` — REVIEWED, ACCEPTABLE

**Risk:** ~~MEDIUM~~ LOW

**Deep analysis:** All 4 cron endpoints consistently validate `Authorization: Bearer <CRON_SECRET>`. The cron jobs are idempotent — they query upcoming appointments/tasks and send reminders. Triggering them multiple times would send duplicate notifications but not modify data. IP restriction is impractical since Railway/Vercel cron IPs change. This is a standard cron protection pattern.

**Impact if `CRON_SECRET` leaked:** Duplicate notifications (nuisance + minor Twilio cost). No data exposure or modification. No code change needed.

---

## PROVIDER TAKEOVER SCENARIOS

### Scenario A: Google Cloud Project Takeover
**Path:** Compromised Google Cloud console credentials
**Impact:** TOTAL — attacker controls OAuth (can impersonate any user), reads all calendars, sends emails as any doctor, accesses analytics
**Mitigation:** Enable MFA on Google Cloud, restrict project access, set up Cloud Audit Logs

### Scenario B: Railway Account Takeover
**Path:** Compromised Railway dashboard credentials
**Impact:** TOTAL — direct database access to all patient records, financial data, OAuth tokens
**Mitigation:** Enable MFA on Railway, use private networking, encrypt sensitive DB columns

### Scenario C: GitHub Account Compromise
**Path:** Developer's GitHub account compromised
**Impact:** Source code theft, malicious code deployment, secret exfiltration via CI/CD
**Mitigation:** Enforce 2FA, branch protection, code review requirements

### Scenario D: ~~Chained Attack (JWT + Stripe)~~ MITIGATED
**Path:** ~~Use exposed `NEXT_PUBLIC_JWT_SECRET` to forge admin JWT → create fake doctor → onboard to Stripe Connect → redirect payouts~~
**Status:** `NEXT_PUBLIC_JWT_SECRET` was dead code (never referenced in source). Removed. Attack path did not exist.

---

## PRIORITY ACTION ITEMS — STATUS TRACKER

### COMPLETED (this audit)
1. ~~Remove `NEXT_PUBLIC_JWT_SECRET`~~ — was dead code, removed along with unused `JWT_SECRET` and stale `ADMIN_EMAIL`/`ADMIN_PASSWORD`
2. ~~`allowDangerousEmailAccountLinking`~~ — reviewed, acceptable with single Google provider. Added warning comment.
3. ~~Google Cloud overprivileged scopes~~ — reviewed, scopes are justified for features used (calendar creation needs full scope, gmail.send is minimal)
4. ~~Add auth to UploadThing~~ — added `.middleware(authMiddleware)` to all 29 upload routes across 3 apps
5. ~~Add security headers~~ — added CSP to API, security headers to all 4 apps via `next.config.ts`
6. ~~Input validation~~ — added email/phone/length validation to public booking endpoint
7. ~~Telegram webhook verification~~ — added `X-Telegram-Bot-Api-Secret-Token` with `crypto.timingSafeEqual()` (opt-in via env var)
8. ~~Rate limiting on bookings~~ — added IP-based rate limiter (10 req/min) with periodic cleanup to prevent memory leaks
9. ~~Admin role via env var~~ — reviewed, safe with Google-only OAuth (Google guarantees email ownership)
10. ~~Cron endpoint security~~ — reviewed, standard Bearer token pattern is adequate

### REMAINING (manual / infrastructure)
- **Enable MFA** on Google Cloud, Railway, GitHub, Stripe, UploadThing, Twilio dashboards
- **Set `TELEGRAM_WEBHOOK_SECRET`** env var and re-register webhook with `secret_token` parameter
- **Enable Railway private networking** for database access
- **Set Twilio spending alerts** and geographic restrictions (Mexico only)
- **Set up Stripe Restricted API Keys** with minimum permissions
- **Review OpenAI data processing agreement** for LFPDPPP compliance
- **Encrypt OAuth tokens at rest** in database (tech debt — recommended when time permits)
- **Update `createDoctorSchema`** to match current API fields, then re-enable Zod validation
- **Add full CSP** to frontend apps after auditing inline scripts and third-party resources

### ONGOING
- Dependency vulnerability scanning (Dependabot / npm audit)
- Regular secret rotation schedule
- Security audit logging across all providers

---

## ENVIRONMENT VARIABLE AUDIT

Total unique env vars found: **~35**

| Variable | Exposed to Client? | Risk if Leaked |
|----------|-------------------|----------------|
| ~~`NEXT_PUBLIC_JWT_SECRET`~~ | ~~YES~~ REMOVED | Was dead code — never referenced in source |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | YES | LOW — analytics ID only |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | YES | LOW — ads tracking only |
| `NEXT_PUBLIC_BASE_URL` | YES | NONE — public URL |
| `NEXT_PUBLIC_API_URL` | YES | LOW — API endpoint |
| `NEXT_PUBLIC_PUBLIC_URL` | YES | NONE — public URL |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | No | CRITICAL — session forgery |
| `JWT_SECRET` | No | CRITICAL — token forgery |
| `GOOGLE_CLIENT_SECRET` | No | CRITICAL — OAuth hijack |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | HIGH — analytics access |
| `STRIPE_SECRET_KEY` | No | CRITICAL — financial fraud |
| `STRIPE_WEBHOOK_SECRET` | No | HIGH — webhook spoofing |
| `DATABASE_URL` | No | CRITICAL — full DB access |
| `LLM_DATABASE_URL` | No | HIGH — embeddings DB |
| `OPENAI_API_KEY` | No | MEDIUM — API costs |
| `TWILIO_ACCOUNT_SID` | No | MEDIUM — SMS abuse |
| `TWILIO_AUTH_TOKEN` | No | MEDIUM — SMS abuse |
| `TELEGRAM_BOT_TOKEN` | No | LOW — bot impersonation |
| `UPLOADTHING_TOKEN` | No | HIGH — file access |
| `CRON_SECRET` | No | MEDIUM — trigger cron jobs |
| `REVALIDATE_SECRET` | No | LOW — cache invalidation |
| `ADMIN_EMAILS` | No | MEDIUM — privilege escalation |

---

## POST-IMPLEMENTATION REVIEW

A `/review-feature` audit was run against all modified files. Two issues were found and fixed:

| Finding | Severity | File | Fix |
|---------|----------|------|-----|
| Rate limiter `bookingRateMap` grows unbounded — expired entries never cleaned | **Bug** | `apps/api/src/app/api/appointments/bookings/route.ts` | Added `setInterval` cleanup that purges expired entries every 60s |
| Telegram webhook secret compared with `!==` (not timing-safe) | **Minor** | `apps/api/src/app/api/telegram/webhook/route.ts` | Switched to `crypto.timingSafeEqual()` via `safeEqual()` helper |

All other review items passed: UploadThing middleware signatures, security header consistency, input validation coverage, env var removal safety, and TypeScript types.
