# Healthcare Platform — Full Architecture Overview

> Intended audience: semi-technical team members, new developers, stakeholders.
> Purpose: understand how the project is structured, how the apps relate to each other, how authentication and security work, and what external services are involved.

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [Monorepo Structure](#2-monorepo-structure)
3. [The 4 Applications](#3-the-4-applications)
   - [public — Patient-facing site](#a-public--patient-facing-site-port-3000)
   - [doctor — Doctor portal](#b-doctor--doctor-portal-port-3001)
   - [admin — Admin panel](#c-admin--admin-panel-port-3002)
   - [api — Backend REST API](#d-api--backend-rest-api-port-3003)
4. [The 4 Shared Packages](#4-the-4-shared-packages)
5. [Authentication & Cookies](#5-authentication--cookies)
6. [Middleware — The Security Gate](#6-middleware--the-security-gate)
7. [Database Architecture](#7-database-architecture)
8. [Data Flow — How a Request Travels](#8-data-flow--how-a-request-travels)
9. [File Uploads (UploadThing)](#9-file-uploads-uploadthing)
10. [External Services](#10-external-services)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Railway Deployment](#12-railway-deployment)
13. [Security Summary](#13-security-summary)
14. [Known Risks & Limitations](#14-known-risks--limitations)

---

## 1. What Is This Project?

A **multi-app healthcare platform** that connects patients, doctors, and administrators through three separate web interfaces backed by a shared REST API and a single PostgreSQL database.

**Core capabilities:**
- Patients browse doctor profiles and book appointments
- Doctors manage their profile, appointments, medical records (EMR), practice finances, and use an AI documentation assistant
- Admins manage doctors and view platform analytics

**Tech stack at a glance:**

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Authentication | NextAuth v5 (Google OAuth, JWT) |
| File Uploads | UploadThing v7 |
| AI | OpenAI (primary) / Anthropic (optional) |
| Monorepo | Turborepo + pnpm workspaces |
| Hosting | Railway |

---

## 2. Monorepo Structure

The entire codebase lives in **one repository** but contains multiple independent apps and shared packages. This pattern is called a **monorepo**.

```
healthcare-platform/
│
├── apps/
│   ├── public/          ← Patient-facing website        (port 3000)
│   ├── doctor/          ← Doctor portal                 (port 3001)
│   ├── admin/           ← Admin management panel        (port 3002)
│   └── api/             ← Backend REST API              (port 3003)
│
├── packages/
│   ├── auth/            ← Shared NextAuth configuration
│   ├── database/        ← Shared Prisma client & schema
│   ├── types/           ← Shared TypeScript types & Zod schemas
│   └── ui/              ← Shared React components
│
├── turbo.json           ← Build task orchestration
├── pnpm-workspace.yaml  ← Workspace package linking
└── package.json         ← Root scripts & Node/pnpm requirements
```

**Why a monorepo?**
All apps share authentication logic, database access, and TypeScript types. Instead of publishing separate npm packages, they are linked directly inside the repo. When you change a type in `packages/types`, every app that uses it picks up the change immediately.

**Turborepo** orchestrates build tasks — it knows the dependency order between packages and apps, caches build outputs, and can run tasks in parallel where possible.

---

## 3. The 4 Applications

### A. `public` — Patient-facing site (port 3000)

**Who uses it:** Patients, general public
**Authentication required:** No
**Railway service:** Deployed as its own service

**What it does:**
- Displays a directory of doctors (`/doctores`)
- Individual doctor profile pages (`/doctores/[slug]`)
- Appointment booking flow
- Patient review submission after appointments
- Appointment cancellation page

**Middleware behavior:**
- No auth checking — all routes are public
- Redirects `www.` to the root domain (SEO)
- Upgrades HTTP to HTTPS in production
- Preconnects to critical resources (API, UploadThing CDN, Google fonts) for performance

**Key dependencies:**
- `@healthcare/types` — shared data types
- No NextAuth, no Prisma (reads everything through the API)

**Google integrations:**
- Google Analytics (`GA_MEASUREMENT_ID`)
- Google Ads conversion tracking (`GOOGLE_ADS_ID`)
- Dynamic sitemap for doctor profile pages

---

### B. `doctor` — Doctor portal (port 3001)

**Who uses it:** Doctors (and Admins for testing/support)
**Authentication required:** Yes — `DOCTOR` or `ADMIN` role
**Railway service:** Deployed as its own service

**What it does:**

| Section | Features |
|---------|---------|
| **Mi Perfil** | Edit public profile: bio, services, clinic info, certificates, media gallery |
| **Citas** | Manage availability slots, view bookings, confirm/cancel appointments |
| **Expedientes** | Electronic Medical Records — patients, encounter notes, prescriptions, AI-assisted templates |
| **Flujo de Dinero** | Financial ledger — income/expenses, categorized by area |
| **CRM** | Client management, quotations, sales, purchases, suppliers, products |
| **Asistente IA** | AI chat assistant for documentation help (OpenAI or Anthropic) |
| **Dashboard** | Overview of recent activity, stats |

**Local API routes (same-origin):**
- `/api/auth/[...nextauth]` — NextAuth login handler
- `/api/auth/get-token` — Returns JWT token for downstream API calls
- `/api/auth/user` — User sync endpoint
- `/api/uploadthing` — File upload handler (UploadThing)
- `/api/medical-records/*` — Medical record operations (kept local for data sensitivity)

**Key dependencies:**
- `@healthcare/auth`, `@healthcare/database`, `@healthcare/types`
- `openai` — AI transcription and LLM features
- `@uploadthing/react` + `uploadthing` — File uploads
- `@tiptap/*` — Rich text editor for encounter notes
- `recharts` — Financial charts
- `@dnd-kit/*` — Drag-and-drop for reordering
- `@react-pdf/renderer` + `jspdf` — PDF export
- `jsonwebtoken` — JWT generation for API authentication

---

### C. `admin` — Admin panel (port 3002)

**Who uses it:** Platform administrators only
**Authentication required:** Yes — `ADMIN` role only (doctors are rejected)
**Railway service:** Deployed as its own service

**What it does:**
- Create and manage doctor profiles
- Upload profile images, certificates, clinic photos (via UploadThing)
- View platform-wide analytics and doctor rankings
- System configuration

**Local API routes (same-origin):**
- `/api/auth/[...nextauth]` — NextAuth login handler
- `/api/uploadthing` — File upload handler (separate UploadThing app from doctor)

**Key dependencies:**
- `@healthcare/auth`, `@healthcare/database`, `@healthcare/types`
- `@uploadthing/react` + `uploadthing`
- `recharts` — Analytics charts

> **Note:** Admin and doctor use **different UploadThing accounts** (different `appId` and tokens). Admin uploads go to the admin UploadThing bucket; doctor uploads go to the doctor bucket.

---

### D. `api` — Backend REST API (port 3003)

**Who uses it:** All frontend apps (public, doctor, admin) — not end users directly
**Authentication required:** Per-route (some endpoints are public, most require JWT)
**Railway service:** Deployed as its own service

**What it does:** Serves all data operations as JSON REST endpoints. No UI — pure backend.

**Middleware behavior (CORS):**
- Every request first goes through the CORS middleware
- Only accepts requests from whitelisted origins: `localhost:3000`, `localhost:3001`, `localhost:3002` (configurable via `ALLOWED_ORIGINS` env var)
- Handles `OPTIONS` preflight requests automatically
- Allows credentials (cookies) in cross-origin requests
- Allowed headers whitelist: `Content-Type`, `Authorization`, UploadThing headers, tracing headers

**API endpoint groups (~55 total):**

| Group | Endpoints | Auth Level |
|-------|-----------|-----------|
| `/api/auth/user` | User creation on first login | None (called by NextAuth) |
| `/api/doctors` | List, get, update doctor profiles | Public GET / Doctor or Admin write |
| `/api/doctors/[slug]/availability` | Appointment slots | Public read |
| `/api/appointments/slots` | Manage availability | Doctor only |
| `/api/appointments/bookings` | Create/manage bookings | Mixed |
| `/api/articles` | Blog posts CRUD | Doctor/Admin write, public read |
| `/api/reviews` | Patient reviews | Public create / Doctor delete |
| `/api/analytics/*` | Platform & per-doctor stats | Admin / Doctor (own) |
| `/api/practice-management/areas` | Income/expense categories | Doctor (own) |
| `/api/practice-management/clients` | CRM clients | Doctor (own) |
| `/api/practice-management/products` | Inventory | Doctor (own) |
| `/api/practice-management/ledger` | Financial ledger | Doctor (own) |
| `/api/practice-management/cotizaciones` | Quotations | Doctor (own) |
| `/api/practice-management/ventas` | Sales | Doctor (own) |
| `/api/practice-management/compras` | Purchases | Doctor (own) |
| `/api/practice-management/proveedores` | Suppliers | Doctor (own) |
| `/api/llm-usage` | AI token usage tracking | Doctor (own) |
| `/api/uploadthing` | File upload handler for API | Token-based |

**Auth helper functions** (used inside route handlers):

```typescript
requireAuth()                       // Any authenticated user
requireAdmin()                      // ADMIN role only
requireDoctor()                     // DOCTOR role only
requireStaff()                      // ADMIN or DOCTOR
requireDoctorOwnership(doctorId)    // Must be the doctor who owns the data, or ADMIN
```

---

## 4. The 4 Shared Packages

### `@healthcare/auth`
The single source of truth for authentication across all apps. Any app that needs NextAuth imports from here.

**Exports:**
- `auth` — The NextAuth instance (used in middleware and server components)
- `handlers` — GET/POST handlers for the `/api/auth/[...nextauth]` route
- `signIn` / `signOut` — Server actions
- `authConfig` — Raw NextAuth configuration
- `requireAuth`, `requireAdmin`, `requireDoctor`, etc. — API route protection helpers

**What it configures:**
- Google OAuth as the only provider
- JWT strategy (no database sessions)
- 30-day token expiry
- JWT callback: after Google login, calls `/api/auth/user` to sync the user and get their `role` and `doctorId`
- Session callback: copies `role` and `doctorId` onto the session object so middleware and client components can read them

---

### `@healthcare/database`
Prisma ORM setup. All apps import the Prisma client from here — there is only one client, pointing to one database.

**Key scripts (run from root):**
```bash
pnpm db:generate       # Regenerate Prisma client after schema changes
pnpm db:push           # Push schema changes to DB (dev, no migration file)
pnpm db:migrate        # Create a migration file (dev)
pnpm db:migrate:deploy # Run migrations (production/Railway)
pnpm db:seed           # Populate test data
pnpm db:studio         # Open Prisma Studio (web DB browser)
```

---

### `@healthcare/types`
Shared TypeScript interfaces and Zod validation schemas. Used by both frontend apps and the API to ensure data shapes are consistent.

- `doctor.ts` — Doctor profile types
- `analytics.ts` — Analytics response types
- `colorPalettes.ts` — UI color scheme definitions
- `validation/` — Zod schemas for form and API input validation

---

### `@healthcare/ui`
Shared React component library. Currently lightweight — mainly provides common UI primitives that may be used across apps.

---

## 5. Authentication & Cookies

### Provider
**Google OAuth only.** There is no username/password login. Every user (doctor or admin) logs in with their Google account.

### Strategy: JWT (JSON Web Tokens)
NextAuth is configured to use **JWT-based sessions**, not database sessions. This means:
- No session table in the database
- The user's identity is encoded in a signed token
- The token is validated on every request by reading and verifying the signature — no DB lookup required

### Full Login Flow

```
1. User visits /login and clicks "Iniciar sesión con Google"
2. Browser redirects to Google's OAuth consent screen
3. User approves → Google redirects back with an authorization code
4. NextAuth exchanges the code for a Google ID token
5. NextAuth's JWT callback fires:
   a. Calls POST /api/auth/user with the Google profile data
   b. API checks if user exists in the database
   c. If new user: creates a record with role = DOCTOR (or ADMIN if email is in ADMIN_EMAILS)
   d. Returns: { userId, role, doctorId }
6. JWT token is created containing: email, name, avatar, userId, role, doctorId, expiry (30 days)
7. Token is stored in an HttpOnly cookie in the browser
8. User is redirected to /dashboard
9. On every subsequent page load, middleware reads the cookie and validates the JWT
```

### What the JWT Contains

```json
{
  "sub": "cuid-from-database",
  "email": "doctor@example.com",
  "name": "Dr. García",
  "picture": "https://lh3.googleusercontent.com/...",
  "userId": "clxxxxxxxxxxxxx",
  "role": "DOCTOR",
  "doctorId": "clxxxxxxxxxxxxx",
  "iat": 1700000000,
  "exp": 1702592000
}
```

### Cookie Security

NextAuth sets two cookies:

| Cookie | Purpose | Security flags |
|--------|---------|---------------|
| `next-auth.session-token` | Stores the JWT | `HttpOnly`, `Secure`, `SameSite=Lax` |
| `next-auth.csrf-token` | CSRF protection | `SameSite=Lax` |

- **`HttpOnly`** — JavaScript running in the browser cannot read this cookie. This means if an attacker injects malicious JavaScript (XSS attack), they cannot steal the token.
- **`Secure`** — The cookie is only sent over HTTPS. In local development (HTTP), it's relaxed automatically by NextAuth.
- **`SameSite=Lax`** — The cookie is not sent on cross-site requests initiated by third-party pages (protects against CSRF attacks).
- **Separate cookies per app** — Because the doctor app runs on port 3001 and the admin app on port 3002, each gets its own independent cookie. Logging into one does not log you into the other.

### Role Assignment

Roles are assigned **once at first login** and stored in the database:

- If the user's email is listed in the `ADMIN_EMAILS` environment variable on the API → role = `ADMIN`
- Otherwise → role = `DOCTOR`

> There is no UI to change roles. Changing a user's role requires modifying the `ADMIN_EMAILS` env var and having them log out and back in, or updating the database directly.

---

## 6. Middleware — The Security Gate

Every Next.js app has a `middleware.ts` file that runs **before any route handler or page renders**. Think of it as a security guard at the door.

### `public` app middleware
```
Any request → Allow through (no auth)
+ Redirect www.domain.com → domain.com
+ Redirect http:// → https://
```

### `doctor` app middleware
```
/login                    → Allow (no auth needed)
/api/auth/*               → Allow (NextAuth internal routes)
/api/uploadthing/*        → Allow (UploadThing handles its own token auth)
Everything else:
  → Read JWT cookie
  → No session?           → Redirect to /login
  → Role not DOCTOR/ADMIN → Sign out + redirect to /login
  → Valid session         → Allow through
```

### `admin` app middleware
```
/login                    → Allow
/api/auth/*               → Allow
/api/uploadthing/*        → Allow
Everything else:
  → Read JWT cookie
  → No session?           → Redirect to /login
  → Role not ADMIN        → Sign out + redirect to /login
  → Valid ADMIN session   → Allow through
```

### `api` app middleware
```
OPTIONS request           → Return CORS preflight response
Any other request:
  → Add CORS headers (only if origin is whitelisted)
  → Pass through to route handler
  (individual route handlers then call requireAuth/requireAdmin/etc.)
```

### Why the `/api/uploadthing` bypass matters
When a user selects a file to upload, `UploadDropzone` makes a POST request to `/api/uploadthing` to get presigned upload URLs from UploadThing's servers. This request is made by the UploadThing library internally — it does not automatically attach the NextAuth session cookie. If the middleware tried to validate the session on this route, the request would be blocked and the upload would silently fail. UploadThing's own `UPLOADTHING_TOKEN` on the server handles security for these routes instead.

---

## 7. Database Architecture

**One PostgreSQL database** shared by all apps, organized into 5 logical schemas:

```
PostgreSQL database: docs_mono
│
├── public schema           ← Core platform data
├── practice_management     ← Financial / CRM data
├── medical_records         ← EMR data
├── llm_assistant           ← AI chat data
└── analytics               ← Usage tracking
```

### `public` schema — Core platform

**`User`** — Staff accounts (doctors and admins)
```
id, email (unique), name, image (Google avatar)
role: ADMIN | DOCTOR
doctorId → links to Doctor profile (1:1)
createdAt, updatedAt
```

**`Doctor`** — Provider profiles (the main entity)
```
id, slug (unique URL identifier), doctorFullName, lastName
primarySpecialty, subspecialties[], cedulaProfesional
heroImage, locationSummary, city, shortBio, longBio
yearsExperience, conditions[], procedures[]
appointmentModes, nextAvailableDate
clinicAddress, clinicPhone, clinicWhatsapp
clinicHours (JSON), clinicGeoLat, clinicGeoLng
colorPalette, googleAdsId
→ has many: services, educationItems, certificates, carouselItems,
            faqs, appointmentSlots, bookings, articles, reviews,
            activityLogs, practice management data, medical records
```

**`AppointmentSlot`** — Doctor availability windows
```
id, doctorId, date, startTime, endTime, durationMinutes
basePrice, discount, discountType, finalPrice (Decimal)
isOpen (boolean), maxBookings, currentBookings
Unique: (doctorId, date, startTime)
```

**`Booking`** — Patient appointments
```
id, slotId, doctorId
patientName, patientEmail, patientPhone, patientWhatsapp
status: PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW
finalPrice, notes
confirmationCode (unique) ← sent to patient
reviewToken (unique) ← one-time token for leaving a review
createdAt, updatedAt
```

**`Article`** — Doctor blog posts
```
id, slug (unique), title, excerpt, content (HTML)
doctorId, status: DRAFT | PUBLISHED
publishedAt, metaDescription, keywords[], views
```

**`Review`** — Patient feedback
```
id, doctorId, bookingId (optional)
patientName (optional), rating (1–5), comment
approved (boolean), createdAt
```

### `practice_management` schema — Financial & CRM

| Table | Purpose |
|-------|---------|
| `Area` | Income/expense categories (INGRESO / EGRESO) |
| `Client` | CRM — business contacts with RFC, address, industry |
| `Product` | Inventory with SKU, price, cost, quantity |
| `LedgerEntry` | Financial transactions linked to areas and clients |
| `Quotation` | Sales quotes with line items |
| `Sale` | Completed sales |
| `Purchase` | Supplier purchases |
| `Proveedor` | Supplier records |

### `medical_records` schema — EMR

| Table | Purpose |
|-------|---------|
| `Patient` | Patient demographics, MRN, contact info, blood type |
| `EncounterTemplate` | Reusable visit note templates (JSON structure) |
| `Encounter` | Individual visit notes (JSON content), DRAFT / SIGNED |
| `Prescription` | Medication prescriptions linked to patients |

### `llm_assistant` schema — AI

| Table | Purpose |
|-------|---------|
| `Conversation` | AI chat history per doctor |
| `LlmTokenUsage` | Token consumption tracking for cost monitoring |

### `analytics` schema — Usage tracking

Platform-wide and per-doctor usage statistics (page views, booking conversion, etc.)

---

## 8. Data Flow — How a Request Travels

### Patient books an appointment

```
1. Patient opens public app (port 3000)
2. Browses /doctores → public app calls GET /api/doctors (port 3003)
3. Clicks doctor → GET /api/doctors/[slug] + GET /api/doctors/[slug]/availability
4. Selects slot, fills form → POST /api/appointments/bookings
5. API creates Booking record in PostgreSQL
6. API calls Twilio → sends SMS confirmation to patient's phone
7. Patient receives confirmation code
```

### Doctor logs in and updates profile

```
1. Doctor visits doctor app /login (port 3001)
2. Clicks Google login → Google OAuth flow
3. NextAuth creates JWT, stores in HttpOnly cookie
4. Middleware validates cookie on every subsequent page load
5. Doctor edits profile on /dashboard/mi-perfil
6. Clicks "Guardar" → doctor app calls PUT /api/doctors/[slug] (port 3003)
7. API validates: requireDoctorOwnership(slug) — is this the right doctor?
8. API updates Doctor record in PostgreSQL
9. Public site immediately reflects changes (reads from same DB)
```

### Doctor uploads a file

```
1. Doctor drops a file on an UploadDropzone component
2. UploadDropzone (client-side) makes POST to /api/uploadthing (same-origin, port 3001)
3. Doctor app middleware: /api/uploadthing is in bypass list → passes through
4. Route handler validates UPLOADTHING_TOKEN on the server
5. Server returns presigned upload URL from UploadThing's CDN
6. Client uploads file directly to UploadThing's servers (bypasses our server)
7. UploadThing calls onUploadComplete → logs the URL
8. Client receives file.url → stores it in form state
9. Doctor saves the profile → URL is saved to PostgreSQL via the API
```

### Admin changes doctor data

```
1. Admin logs in on admin app (port 3002)
2. Middleware: only ADMIN role passes — doctors are rejected
3. Admin edits a doctor profile → admin app calls API (port 3003)
4. API: requireAdmin() — confirms ADMIN role from JWT
5. No ownership check needed — admins can edit any doctor
6. PostgreSQL updated
```

---

## 9. File Uploads (UploadThing)

UploadThing is a managed file upload service. Files are uploaded **directly from the browser to UploadThing's CDN** — they never pass through our servers. Only the resulting CDN URL is stored in our database.

### Upload flow
```
Browser → POST /api/uploadthing (get presigned URL)
       → PUT directly to UploadThing CDN (the actual file)
       → onUploadComplete fires on our server (logs, metadata)
       → URL stored in PostgreSQL via regular API call
```

### Endpoints defined in doctor app (`core.ts`)

| Endpoint | Accepts | Max size | Used for |
|----------|---------|---------|---------|
| `doctorHeroImage` | image | 4 MB | Profile hero image |
| `doctorCertificates` | image | 16 MB (×20) | Degree/certificate photos |
| `clinicPhotos` | image | 8 MB (×20) | Clinic gallery |
| `doctorVideos` | video | 64 MB (×5) | Profile videos |
| `medicalImages` | image | 16 MB (×10) | Medical record images |
| `medicalVideos` | video | 128 MB (×5) | Medical record videos |
| `medicalAudio` | audio | 32 MB (×10) | Voice notes / recordings |
| `medicalDocuments` | pdf | 32 MB (×10) | Medical documents |
| `ledgerAttachments` | image, pdf | 8–16 MB (×10) | Ledger receipts |
| `ledgerFacturasPdf` | pdf | 16 MB (×5) | Invoice PDFs |
| `ledgerFacturasXml` | xml | 2 MB (×5) | SAT XML invoices |

### Important: separate UploadThing accounts
- **Admin app** uses `appId: fu98uhye4e` (its own token)
- **Doctor app** uses `appId: d3geobfeqd` (its own token)

They share the same storage but are tracked under different UploadThing projects.

### Required setup: `NextSSRPlugin`
UploadThing v7 requires `NextSSRPlugin` with `extractRouterConfig` in the root `layout.tsx` of each Next.js app. Without it, the `UploadDropzone` component renders but silently does nothing when a file is selected — the client never receives the router configuration it needs to initiate an upload.

---

## 10. External Services

| Service | Purpose | Which apps |
|---------|---------|-----------|
| **Google OAuth** | User authentication | doctor, admin |
| **PostgreSQL (Railway)** | Primary database | all apps |
| **UploadThing** | File/image uploads | doctor, admin, api |
| **OpenAI** | AI transcription (Whisper), LLM assistant (GPT) | doctor |
| **Anthropic** | Alternative LLM provider (optional) | doctor |
| **Twilio** | SMS appointment confirmations to patients | api |
| **Google Analytics (GA4)** | Patient site traffic tracking | public |
| **Google Ads** | Conversion tracking | public |

---

## 11. Environment Variables Reference

### doctor app

| Variable | Purpose | Example |
|----------|---------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth | `550166...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | `GOCSPX-...` |
| `NEXTAUTH_URL` | Full URL of this app | `https://doctor.railway.app` |
| `NEXTAUTH_SECRET` | JWT signing secret (min 32 chars) | random string |
| `AUTH_SECRET` | NextAuth v5 alias for NEXTAUTH_SECRET | same value |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `NEXT_PUBLIC_API_URL` | API app URL (used by browser) | `https://api.railway.app` |
| `NEXT_PUBLIC_PUBLIC_URL` | Patient site URL | `https://public.railway.app` |
| `OPENAI_API_KEY` | OpenAI for transcription & AI | `sk-proj-...` |
| `UPLOADTHING_TOKEN` | UploadThing auth token | `eyJ...` |
| `LLM_PROVIDER` | AI provider selection | `openai` or `anthropic` |

### admin app

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Same Google app as doctor |
| `GOOGLE_CLIENT_SECRET` | Same Google app as doctor |
| `NEXTAUTH_URL` | Full URL of admin app |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | JWT signing secret (same value as doctor) |
| `DATABASE_URL` | Same database |
| `NEXT_PUBLIC_API_URL` | API app URL |
| `UPLOADTHING_TOKEN` | Admin's UploadThing token (different from doctor) |

### api app

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Must match doctor/admin apps (to verify their JWTs) |
| `NEXTAUTH_URL` | Full URL of API app |
| `ADMIN_EMAILS` | Comma-separated emails that get ADMIN role on first login |
| `ALLOWED_ORIGINS` | Comma-separated URLs allowed by CORS |
| `UPLOADTHING_TOKEN` | For API-side upload handling |
| `TWILIO_ACCOUNT_SID` | Twilio SMS |
| `TWILIO_AUTH_TOKEN` | Twilio SMS |
| `TWILIO_PHONE_NUMBER` | Twilio sender number |

### public app

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | API app URL |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics ID |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads ID |

> **Critical rule:** All apps that share authentication (`NEXTAUTH_SECRET` / `AUTH_SECRET`) must use the **exact same secret value**. The API uses this secret to verify JWT tokens issued by the doctor and admin apps. If they don't match, all API calls will return 401 Unauthorized.

---

## 12. Railway Deployment

Each app is deployed as an **independent Railway service** within the same Railway project. They communicate over the public internet (or Railway's internal network if configured).

```
Railway Project: healthcare-platform
│
├── Service: public-app    → https://public.railway.app
├── Service: doctor-app    → https://doctor.railway.app
├── Service: admin-app     → https://admin.railway.app
├── Service: api-app       → https://api.railway.app
└── Service: PostgreSQL    → Internal Railway DB
```

**Build command per service:**
```bash
cd apps/<appname> && pnpm build
# or with Turborepo:
pnpm turbo run build --filter=@healthcare/<appname>
```

**Environment variables** must be set individually per Railway service. They are not shared automatically unless you use Railway's "Shared Variables" feature (visible in the project settings).

**Common Railway deployment gotchas:**
1. `.env.local` files are **never** deployed — every env var must be in the Railway dashboard
2. `NEXTAUTH_URL` must be the actual Railway HTTPS URL, not `localhost`
3. `AUTH_SECRET` (NextAuth v5) must be set in addition to or instead of `NEXTAUTH_SECRET`
4. `UPLOADTHING_TOKEN` must be set in the doctor service separately from the admin service
5. `ALLOWED_ORIGINS` in the API service must include the deployed Railway URLs of all frontend apps

---

## 13. Security Summary

| Mechanism | What it protects against |
|-----------|-------------------------|
| **HttpOnly JWT cookies** | XSS — JavaScript cannot steal the auth token |
| **SameSite=Lax cookies** | CSRF — malicious sites cannot make authenticated requests |
| **Middleware role checks** | Unauthorized access — wrong role users are blocked at the app entry point before any route executes |
| **CORS whitelist on API** | Unauthorized origins — random websites cannot call our API |
| **`requireDoctorOwnership` in API** | Horizontal privilege escalation — Doctor A cannot read Doctor B's data |
| **`requireAdmin` in API** | Vertical privilege escalation — doctors cannot access admin-only endpoints |
| **UploadThing server-side token** | File upload abuse — only our server-validated routes can generate presigned upload URLs |
| **Zod input validation** | Malformed/malicious input — all API inputs are validated before touching the database |
| **`ADMIN_EMAILS` env var** | Admin role abuse — only explicitly listed emails can ever become admins |
| **HTTPS upgrade (public app)** | Man-in-the-middle — HTTP requests are forcibly redirected to HTTPS |

---

## 14. Known Risks & Limitations

### Single database — single point of failure
All 4 apps connect to one PostgreSQL instance. If the database goes down, the entire platform goes down. No read replicas or fallback configured.

### No UI for role management
Changing a user's role (e.g., promoting a doctor to admin, or revoking access) requires:
1. Updating `ADMIN_EMAILS` env var on the API service in Railway
2. Having the user log out and log back in (or manually updating the DB)

### Environment variables are per-service
Easy to miss a required variable when deploying a new service or rotating secrets. All 4 services must stay in sync on shared values (`NEXTAUTH_SECRET`, `DATABASE_URL`).

### UploadThing route is unauthenticated at middleware level
`/api/uploadthing` bypasses the session check in middleware because UploadThing needs it to be accessible without a NextAuth session cookie. This is intentional and safe — UploadThing validates using its own `UPLOADTHING_TOKEN` on the server. However, it means the upload endpoints are technically reachable by unauthenticated requests (they will be rejected by UploadThing's own validation, not by our middleware).

### NextAuth v5 (beta)
The project uses `next-auth@5.0.0-beta.25`. This is a pre-release version. Breaking changes are possible on upgrade. The stable v5 release may require migration work.

### No refresh token rotation
JWT tokens expire after 30 days. There is no refresh mechanism — once a token expires, the user must log in again. If a token is compromised, it remains valid until expiry (no revocation mechanism).

---

*Last updated: February 2026*
*Architecture version: monorepo with 4 apps, 4 packages, PostgreSQL multi-schema*
