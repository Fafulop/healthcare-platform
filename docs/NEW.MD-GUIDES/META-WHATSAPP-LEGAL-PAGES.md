# Meta WhatsApp API — Legal Pages Setup

**Last Updated:** 2026-03-19

---

## Why These Pages Exist

To create a Meta App and connect it to the WhatsApp Business API, Meta requires three publicly accessible URLs before it will approve your app for production use:

1. **Privacy Policy URL**
2. **Terms of Service URL**
3. **User Data Deletion Instructions URL**

Without these three pages live and returning HTTP 200, Meta will reject the app during review and the WhatsApp API integration cannot go live. These pages are also shown directly to users during the WhatsApp Embedded Signup flow — the consent screen that business users see when onboarding through your app displays your app name, privacy policy, and terms of service.

Additionally, Mexican law (LFPDPPP — Ley Federal de Protección de Datos Personales en Posesión de los Particulares) independently requires that any digital platform collecting personal data publish a privacy notice explaining what data is collected, how it is used, and how users can exercise their rights. These pages satisfy both Meta's requirements and the Mexican legal requirement simultaneously.

---

## What Was Created

Three static Next.js server component pages were added to `apps/public`:

| Page | Route | File |
|---|---|---|
| Privacy Policy | `/privacidad` | `apps/public/src/app/privacidad/page.tsx` |
| Terms of Service | `/terminos` | `apps/public/src/app/terminos/page.tsx` |
| Data Deletion Instructions | `/eliminacion-de-datos` | `apps/public/src/app/eliminacion-de-datos/page.tsx` |

All three are **server components** (no `"use client"`), fully static, no API calls, no JavaScript required on the client. They render instantly and are crawlable by Meta's bots.

---

## Meta's Specific Requirements (from official docs)

Meta enforces these rules for all three URLs:

- Must return **HTTP 200** — no redirects, no 404s
- Must be **publicly accessible** — no login, no paywall, no password
- Must **not be geo-blocked** — must load from anywhere in the world
- Must allow **Meta's crawlers** — do not block bots
- Must be **your own document** — cannot link to Meta's, Google's, or any third party's policy
- Must be entered in **App Dashboard → Settings → Basic**

Failure on any of these results in automatic rejection during App Review.

### Data Deletion page specifically

Meta gives two options for data deletion:

| Option | What it is |
|---|---|
| **Callback URL** | Server endpoint that Meta POSTs to automatically when a user deletes their Facebook account. Requires code to handle the signed request and return JSON confirmation. |
| **Instructions URL** | A static page explaining how users can manually request deletion. No code required. |

**tusalud.pro uses the Instructions URL** because tusalud.pro does not use Facebook Login — users authenticate via Google OAuth only. Meta's automatic callback is only triggered when a user deletes their Facebook account after having logged into your app via Facebook. Since that flow doesn't exist in tusalud.pro, the Instructions URL is the correct and sufficient option.

---

## Page-by-Page Content Decisions

### `/privacidad` — Privacy Policy

**What it covers:**
- Who tusalud.pro is and the responsible party for data
- Data collected from patients: name, email, phone, appointment details, navigation behavior
- Data collected from doctors: profile info, Google OAuth account, Google Calendar tokens, clinical records, practice management data (sales, purchases, quotations)
- Automatically collected data: IP, browser type, conversion events
- Third-party table: Google (OAuth, Analytics, Ads, Calendar), Railway, UploadThing, WhatsApp/Meta — with what data each receives
- Explicit statement: "No vendemos tus datos personales a terceros"
- Retention: 2 years after last interaction for patients; deletion within 30 business days from identity verification
- User rights under LFPDPPP + GDPR: Access, Rectification, Cancellation, Opposition, Portability
- Response time for rights requests: 20 business days (per LFPDPPP)
- Cross-link to `/eliminacion-de-datos`
- Cookie/tracking disclosure: GA4 first-party cookies, no behavioral advertising cookies for patients
- Security: Railway PostgreSQL with encryption in transit, Google tokens stored encrypted

**Why these specific items:**
Meta's privacy policy requirements state the policy must explain what data is collected, how it is processed, why it is collected, and how users can request deletion. The LFPDPPP requires the same plus a description of data transfers to third parties. The third-party table covers both requirements explicitly.

---

### `/terminos` — Terms of Service

**What it covers:**
- Acceptance clause
- Platform description + explicit intermediary disclaimer (tusalud.pro is not a medical provider, does not give consultations or diagnoses)
- Doctor registration requirements: valid cédula profesional, accurate profile info, responsibility for clinical data they enter
- Acceptable use rules: lawful purposes, no false information, no unauthorized access, no spam/phishing, no technical interference
- Appointments and payments: tusalud.pro does not process payments between patients and doctors; payment disputes are between the doctor and patient
- User content license: non-exclusive, royalty-free, worldwide license to display content within the platform
- Intellectual property: tusalud.pro owns its design, code, and brand
- Medical disclaimer: content is informational only, not medical advice
- Liability limitation: tusalud.pro not liable for indirect or consequential damages; liability cap set at MX$500 or amounts paid to tusalud.pro (whichever is greater) — the floor of MX$500 was added because patients pay doctors directly, not tusalud.pro, so without a floor the cap would effectively be zero for all patients
- Suspension and termination rights
- Mexican law jurisdiction: courts of Ciudad de México

**Why the medical disclaimer:**
tusalud.pro publishes doctor profiles and health articles. Without an explicit disclaimer, there is legal exposure if a patient makes a health decision based on content published on the platform. The disclaimer is standard for any health-adjacent platform.

---

### `/eliminacion-de-datos` — Data Deletion Instructions

**What it covers:**
- Two options for requesting deletion:
  - **Option 1 (email):** Send to privacidad@tusalud.pro with subject "Solicitud de eliminación de datos", including full name, registered email, and description of what to delete
  - **Option 2 (in-panel):** Doctors can delete clinical records directly from their dashboard; account deletion still requires email
- Four-step process after submitting a request:
  1. Confirmation email within 3 business days
  2. Identity verification (to prevent unauthorized deletion requests)
  3. Deletion/anonymization within 30 business days from identity verification
  4. Final notification when complete
- What gets deleted: name, email, phone, appointment history, doctor profile, clinical records, practice data, Google tokens
- Legal exceptions where deletion may be refused or delayed:
  - SAT fiscal records (Mexican tax law retention requirements)
  - NOM-024-SSA3 clinical record retention requirements
  - Active legal disputes or investigations
- Third-party data: explanation that anonymized GA4 data may persist per Google's own policies, with link to myaccount.google.com
- Cross-link back to `/privacidad`

**Why Meta requires this level of detail:**
Meta's Platform Terms Section 3(d) requires developers to give users "a clear and easily accessible means to request modification or deletion of their Platform Data." Meta's documentation specifically states the page must provide actionable steps, a contact method, a processing timeline, and a legible explanation of any legitimate justification for refusing deletion. A generic "contact us to delete your data" statement is explicitly listed as insufficient and will cause rejection.

**Why the legal exceptions section:**
Mexican law (LFPDPPP) and health regulations (NOM-024-SSA3) impose mandatory retention periods on clinical records. Publishing this in the deletion page protects tusalud.pro from being forced to delete data it is legally required to keep, while still complying with Meta's requirement to explain any refusal to proceed with deletion.

---

## Timeline Consistency

All three pages use the same timeline values, which are internally consistent:

| Action | Timeline | Applicable law/standard |
|---|---|---|
| Response to general ARCO rights requests | 20 business days | LFPDPPP Art. 32 |
| Deletion confirmation email | 3 business days | Internal SLA |
| Full deletion from identity verification | 30 business days | Meta requirement + LFPDPPP |

The privacy policy and the deletion page both state "30 días hábiles contados desde la verificación de identidad del solicitante" — exactly the same wording to avoid any ambiguity.

---

## URLs to Enter in Meta App Dashboard

Once deployed, enter these in **App Dashboard → Settings → Basic**:

| Field | URL |
|---|---|
| Privacy Policy URL | `https://tusalud.pro/privacidad` |
| Terms of Service URL | `https://tusalud.pro/terminos` |
| User Data Deletion | `https://tusalud.pro/eliminacion-de-datos` (Instructions URL option) |

---

## Contact Email

All three pages reference **privacidad@tusalud.pro** as the data protection contact. This mailbox does not exist yet at the time of writing — it must be created before the pages go live. Until then, the pages are deployed but the email cannot receive messages.

---

## Implementation Notes

- Pages are pure server components — no `"use client"`, no hydration, no API calls
- Styling uses a mix of Tailwind utility classes (`max-w-3xl`, `mx-auto`, `px-6`, `py-16`) and inline styles for granular control
- Font is Inter, matching the rest of the public app
- The third-party table in `/privacidad` is rendered from an inline array using `.map()` — no external data dependency
- All internal links use relative paths (`/privacidad`, `/eliminacion-de-datos`)
- The external link to `myaccount.google.com` uses `target="_blank"` with `rel="noopener noreferrer"` for security
- No navigation header or footer — these are standalone legal pages intentionally minimal
