# SEO Analysis & Plan — Doctor Public Profiles

**Date:** 2026-04-24
**Project:** TuSalud.pro — Doctor Public Portals
**Goal:** Make each individual doctor profile rank high for "specialty + city" queries in Google organic search
**Context:** 3 doctors currently live — no catalog/directory approach (too few doctors). Each profile must rank on its own.

---

## Architecture Overview

- **Framework:** Next.js 16.0.10, React 19.2.1
- **Rendering:** SSR layouts + SSG pages with ISR (1-hour revalidation)
- **Styling:** Tailwind CSS v4
- **Images:** Next.js Image component, hosted on UploadThing CDN (`utfs.io`, `*.ufs.sh`)
- **Database:** Prisma 6.19.1 ORM, data fetched via API
- **Domain:** `https://tusalud.pro`
- **Language:** Spanish (es_MX)

---

## Current Routes

| Route | File | Purpose |
|-------|------|---------|
| `/` | `apps/public/src/app/page.tsx` | Landing page |
| `/doctores` | `apps/public/src/app/doctores/page.tsx` | Doctor directory (3-column grid) |
| `/doctores/[slug]` | `apps/public/src/app/doctores/[slug]/page.tsx` | Individual doctor profile |
| `/doctores/[slug]/blog` | `apps/public/src/app/doctores/[slug]/blog/page.tsx` | Doctor's blog listing |
| `/doctores/[slug]/blog/[articleSlug]` | `apps/public/src/app/doctores/[slug]/blog/[articleSlug]/page.tsx` | Individual blog article |

- All pages use ISR with `revalidate: 3600` (1 hour)
- `/doctors/:path*` redirects to `/doctores/:path*` (301)

---

## Doctor Profile Page — Current Sections

The profile page (`DoctorProfileClient.tsx`) renders the following sections:

1. **Hero Section** (`HeroSection.tsx`) — Doctor name (H1), priority image (LCP), experience badge, star rating, booking buttons
2. **Quick Navigation** (`QuickNav.tsx`) — Jump links to major sections
3. **Media Carousel** (`MediaCarousel.tsx`) — Image gallery + video support, lazy loaded, client-side only
4. **Services** (`ServicesSection.tsx`) — Medical services with descriptions, duration, pricing
5. **Conditions Treated** (`ConditionsSection.tsx`) — Conditions and procedures (high-value SEO keywords)
6. **Patient Reviews** (`ReviewsSection.tsx`) — Aggregate rating, individual reviews with stars, paginated
7. **Biography** (`BiographySection.tsx`) — Long-form bio, years of experience (E-E-A-T signal)
8. **Clinic Location** (`ClinicLocationSection.tsx`) — Address, map, opening hours, multiple locations
9. **Education** (`EducationSection.tsx`) — Schools, degrees, programs
10. **Credentials/Diplomas** (`CredentialsSection.tsx`) — Certificate carousel with thumbnails, lightbox
11. **FAQ** (`FAQSection.tsx`) — Q&A pairs (eligible for rich snippets)

**Sidebar (Desktop):** Booking widget, CTA buttons (call, WhatsApp, book), contact info
**Mobile:** Sticky bottom CTA bar

---

## Current SEO Implementation

### Meta Tags (`lib/seo.ts`)

- **Title template:** `{doctor_full_name} | {primary_specialty} | {city}`
- **Description:** ~155 chars with specialty, city, bio snippet, action verbs
- **Canonical URL:** `{baseUrl}/doctores/{slug}`
- **Keywords:** Specialty, city, subspecialties, "medico", "consulta medica", "citas medicas", "salud"
- **Open Graph:** title, description, url, image (1200x630), site_name ("TuSalud.pro"), locale ("es_MX"), type ("profile")
- **Twitter Cards:** summary_large_image, @tusaludpro

### Structured Data (`lib/structured-data.ts`)

All injected as `<script type="application/ld+json">` in SSR layout:

| Schema Type | Content |
|-------------|---------|
| **Physician** | Name, specialty, description, URL, image, address, phone, price range, aggregate rating, social links |
| **MedicalBusiness** | Opening hours (normalized to 24h), geo coordinates, phone, address |
| **ProfilePage** | Links to Physician entity via `@id` |
| **BreadcrumbList** | Home -> Doctors -> Doctor Name (3 levels) |
| **AggregateRating** | Average rating (1-5), total review count |
| **Review** (individual) | Author, rating, comment, published date |
| **FAQPage** | Question/Answer pairs (if FAQs exist) |
| **VideoObject** | Name, description, duration, thumbnail, content URL, upload date |
| **BlogPosting** | Headline, description, image, author, date, keywords, main entity link |

### Sitemap (`app/sitemap.ts`)

- Dynamic generation
- Includes: static pages, all doctor profiles (priority 0.8, weekly), blog listings (priority 0.7, weekly), individual articles (priority 0.7, monthly)
- Excludes test/junk slugs ("fffffffff", "dr-prueba")
- Revalidates every 1 hour

### Robots (`app/robots.ts`)

- Allow: `/`
- Disallow: `/api/`, `/_next/`, `/admin/`
- Sitemap reference included

### Image Optimization

| Location | Strategy |
|----------|----------|
| Hero image | `priority` flag, `fetchPriority="high"`, responsive sizes |
| Directory cards | Next.js Image, fill layout, responsive sizes |
| Media carousel | Lazy loading (except first), video with poster |
| Credentials | All thumbnails in DOM for SEO, first 4 eager |
| Blog articles | **Native `<img>` (NOT optimized)** |

### Font & Performance

- Preconnect to `utfs.io`, `fonts.googleapis.com`, `fonts.gstatic.com`
- Preload 2 critical fonts (Inter, Vollkorn)
- `font-display: swap`

### Analytics

- Google Analytics (GA4) via `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Per-doctor Google Ads configuration
- Profile view tracking

---

## Blog System

- **Listing:** `/doctores/[slug]/blog` — all published articles for a doctor
- **Article:** `/doctores/[slug]/blog/[articleSlug]` — full content, author info, date, views
- **Components:** `ArticleCard.tsx`, `ArticleContent.tsx`, `BlogLayoutClient.tsx`, `BlogViewTracker.tsx`
- **Data:** `getArticlesByDoctorSlug()`, `getArticle()` — cached with 60s revalidation
- **Linking:** Blog -> Profile (breadcrumbs), Profile -> Blog (quick nav)
- **Schema:** BlogPosting JSON-LD with author, date, keywords

---

## Google Official SEO References

### 1. Google SEO Starter Guide
> https://developers.google.com/search/docs/fundamentals/seo-starter-guide

Key takeaways:
- Well-organized, readable content with proper heading structure
- Unique page titles including name, specialty, and location
- Meta descriptions highlighting key benefits (qualifications, services, experience)
- Verify indexing with `site:yourdomain.com`
- Submit XML sitemaps
- Use canonical URLs to avoid duplicate content
- Mobile-friendly design and page speed optimization
- Descriptive URLs (e.g., `/doctores/dr-patricia-roldan-mora` not numeric IDs)

### 2. Structured Data Introduction
> https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

Key takeaways:
- JSON-LD is Google's recommended format
- Prioritize **fewer but complete and accurate properties** over exhaustive coverage
- Validate with Google's Rich Results Test
- Monitor with Rich Result status reports in Search Console
- Allow 2+ weeks for changes to impact rankings

### 3. LocalBusiness Structured Data
> https://developers.google.com/search/docs/appearance/structured-data/local-business

Key takeaways:
- Required fields: `name`, `address` (full PostalAddress)
- Recommended: `telephone`, `url`, `openingHoursSpecification`, `geo` (5+ decimal places), `priceRange`
- Use most specific subtype: `Physician` or `MedicalBusiness` (already implemented)
- Include `aggregateRating` and `review` properties when available

---

## Code Review Corrections (2026-04-24)

> The original plan was based on inspecting the live HTML output. A follow-up code review of the actual components found 3 factual errors and 1 missed issue:
>
> **Errors corrected:**
> 1. **"Junk H2 tags" (task 1.6) — REMOVED.** Experience badge and rating in `HeroSection.tsx` are `<span>` inside `<div>`, not H2 tags. The live-page inspection was wrong.
> 2. **"Empty certificate alt tags" (tasks 1.8, 1B.4) — REMOVED.** `CredentialsSection.tsx` already has a fallback: `certificate.alt || 'Certificado: {issued_by} ({year})'`. Auto-generates alt text when the doctor leaves it blank.
> 3. **"Sitemap missing lastModified" (task 2.3) — CORRECTED.** Sitemap already includes `lastModified`, but most entries use `new Date()` (always "now") instead of real database timestamps. Task re-scoped to fix fake timestamps.
>
> **Issue added:**
> - **Empty H2 bug:** `HeroSection.tsx` renders the `<h2>` unconditionally. If `primary_specialty` is null/empty, an empty `<h2></h2>` tag appears in the DOM.
>
> **Net result:** 3 tasks removed (1.6, 1.8, 1B.4), 1 task re-scoped (2.3), 1 task corrected (1.9). Core diagnosis unchanged — on-page keyword signals remain the primary gap.

---

## Gap Analysis — Per-Profile Strategy

### What's Working Well

| Area | Rating | Notes |
|------|--------|-------|
| Structured Data | Strong | 8 schema types, comprehensive coverage |
| Meta Tags | Strong | Title with name+specialty+city, OG, Twitter |
| Rendering | Strong | SSR + ISR, great crawlability |
| Sitemap | Good | Dynamic, blog-aware |
| Robots.txt | Good | Proper disallows |
| E-E-A-T Signals | Good | Credentials, education, experience, reviews |
| URL Structure | Good | Clean slugs, English->Spanish redirect |
| Image Optimization | Good | Priority hero, lazy loading, alt text |
| Blog System | Good | Per-doctor, schema, linked to profile |

### Live Page Verification (2026-04-24)

All 3 live profiles were fetched and analyzed to verify the diagnosis:

#### Dr. Jose Cruz Ruiz — Oftalmologo, Guadalajara
> https://tusalud.pro/doctores/dr-jose

- **Title:** "Dr. Jose Cruz Ruiz | Oftalmologia | Guadalajara | TuSalud.pro" -- GOOD
- **Meta desc:** Includes specialty + city -- GOOD
- **H1:** "Dr. Jose Cruz Ruiz" -- name only, no specialty/city
- **H2:** "Oftalmologia" -- no city
- **H2s (sections):** "Servicios", "Condiciones y Procedimientos", "Acerca de...", "Ubicacion de la Clinica", "Educacion y Formacion", "Certificaciones y Diplomas", "Preguntas Frecuentes" -- all generic
- **Intro paragraph:** Partial — short bio visible ("Soy el Dr. Jose Cruz Ruiz, especialista en oftalmologia...") but not structured as a prominent above-fold paragraph
- **Services on mobile:** Hidden behind "Ver mas" -- bad for mobile-first indexing
- **Structured data:** ProfilePage, BreadcrumbList, Physician, MedicalBusiness, FAQPage -- GOOD
- **Image alt:** "Dr. Jose Cruz Ruiz - Oftalmologia" -- GOOD

#### Dra. Patricia Roldan Mora — Cirujana Bariatra, Guadalajara
> https://tusalud.pro/doctores/dra-patricia-roldan-mora

- **Title:** "Dra. Patricia Roldan Mora | CIRUJANA BARIATRA, GASTROINTESTINAL Y ENDOSCOPIA BARIATRICA | Guadalajara | TuSalud.pro" -- GOOD but ALL CAPS looks like keyword stuffing
- **Meta desc:** Includes specialty + city -- GOOD
- **H1:** "Dra. Patricia Roldan Mora" -- name only
- **H2:** "CIRUJANA BARIATRA, GASTROINTESTINAL Y ENDOSCOPIA BARIATRICA" -- ALL CAPS is a problem, and no city
- **~~JUNK H2s:~~** *(CORRECTED: Experience badge and rating are rendered as `<span>` inside `<div>`, NOT H2 tags. This was a misdiagnosis from inspecting the live page — the actual component code confirms they are not headings.)*
- **H2s (sections):** Generic ("Servicios", "Condiciones y Procedimientos", etc.)
- **Intro paragraph:** No prominent intro above fold
- **Services on mobile:** Hidden behind "Ver mas"
- **Structured data:** ProfilePage, BreadcrumbList, Physician, MedicalBusiness, VideoObject (3), Review (7) -- GOOD
- **ALL CAPS specialty:** Throughout the page, the specialty is in ALL CAPS. This looks unprofessional and may signal low quality to Google

#### Dra. Adriana Michelle — Cirugia General, Monterrey
> https://tusalud.pro/doctores/dra-adriana-michelle

- **Title:** "Dra. Adriana Michelle | Cirugia General y Laparoscopia Gastrointestinal | Monterrey | TuSalud.pro" -- GOOD
- **Meta desc:** Includes specialty + city -- GOOD
- **H1:** "Dra. Adriana Michelle" -- name only
- **H2 for specialty:** The `<h2>` tag is always rendered unconditionally in `HeroSection.tsx`. If Adriana's specialty didn't show as an H2 on the live page, it may be a data issue (empty `primary_specialty`), not a component issue. **Note:** the H2 renders even when the field is empty/null, which is a minor bug (empty heading tag in DOM)
- **H2s (sections):** Generic ("Servicios", "Condiciones y Procedimientos", etc.)
- **Intro paragraph:** None above fold
- **Services on mobile:** Hidden behind "Ver mas"
- **Years of experience:** NOT SHOWN — missing E-E-A-T signal
- **Certificate image alt tags:** *(CORRECTED: `CredentialsSection.tsx` already has a fallback: `certificate.alt || 'Certificado: {issued_by} ({year})'`. Empty alt text from the doctor is auto-filled at render time.)*
- **Structured data:** ProfilePage, BreadcrumbList, Physician (with aggregateRating 5.0/17), MedicalBusiness, Review (17), VideoObject (2) -- GOOD

#### Verified Issues Summary

| Issue | Dr. Jose | Dra. Patricia | Dra. Adriana | Severity |
|-------|----------|---------------|--------------|----------|
| H1 = name only (no specialty/city) | YES | YES | YES | CRITICAL |
| H2 missing city | YES | YES | YES | HIGH |
| Specialty not even an H2 | no | no | YES | HIGH |
| Specialty in ALL CAPS | no | YES | no | MEDIUM |
| ~~Junk content in H2 tags~~ | ~~no~~ | ~~YES~~ | ~~no~~ | ~~REMOVED — misdiagnosis, they are `<span>` not H2~~ |
| No intro paragraph above fold | partial | YES | YES | HIGH |
| Generic section headings | YES | YES | YES | MEDIUM |
| Service descriptions hidden on mobile | YES | YES | YES | MEDIUM |
| ~~Empty certificate alt tags~~ | ~~no~~ | ~~not checked~~ | ~~YES~~ | ~~REMOVED — `CredentialsSection.tsx` already has auto-fallback~~ |
| Missing years of experience | no | no | YES | LOW |

---

### Dashboard Profile Editor Analysis (`/dashboard/mi-perfil`)

The doctor dashboard (apps/doctor) is where profile data gets created. Several SEO issues trace back to how this form is structured.

**Dashboard app:** `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`
**Components:** `apps/doctor/src/components/profile/`
**API:** `apps/api/src/app/api/doctors/[slug]/route.ts`

#### Profile Tabs (9 total)
1. Info General — name, specialty, city, bio, experience, hero image, color palette
2. Servicios — service name, description, duration, price, booking toggle
3. Clinica — locations (max 2), address, phone, hours, geo coords, conditions, procedures
4. Formacion — education items, certificate uploads
5. Multimedia — clinic photos, videos (carousel)
6. FAQs y Social — FAQ pairs, social media links
7. Opiniones — reviews management
8. Integraciones — Google Calendar, Telegram, sessions
9. Receta PDF — prescription template

#### Root Cause Issues Found

**1. Specialty is FREE TEXT — no validation or normalization**
- `primary_specialty` is a plain text input, no dropdown, no casing rules
- This is WHY Patricia's specialty is ALL CAPS: "CIRUJANA BARIATRA, GASTROINTESTINAL Y ENDOSCOPIA BARIATRICA"
- Doctor typed it in caps, system stored it as-is, public page renders it as-is
- **Fix needed:** Either normalize to title case on save/render, or switch to a dropdown + custom option

**2. `subspecialties` field exists in DB but NOT exposed in dashboard UI**
- The schema has `subspecialties String[]` and the public page renders them as badges
- But doctors CANNOT edit them — the field is missing from the form
- Subspecialties are high-value SEO keywords (e.g., "cirugia de cataratas", "glaucoma")
- **Fix needed:** Add subspecialties input to the General Info tab

**3. `short_bio` field exists in DB but NOT editable in dashboard**
- Schema has both `shortBio` and `longBio`
- Dashboard only shows `long_bio` textarea
- `short_bio` is exactly what should be used for the hero intro paragraph (Gap #3 in on-page SEO)
- **Fix needed:** Add `short_bio` field to dashboard, or auto-generate from first 2-3 sentences of `long_bio`

**4. `location_summary` field exists in DB but NOT shown in dashboard**
- This is the text that appears next to the MapPin icon in the hero: "Guadalajara, Mexico"
- Doctors can't edit it — it's either auto-generated or manually set in DB
- **Fix needed:** Either auto-generate from city + state, or expose in form

**5. Certificate alt text is 100% manual — doctors leave it empty**
- Each certificate has an `alt` text input with placeholder "Descripcion"
- Doctors don't fill it in (Adriana's are all empty)
- **Fix needed:** Auto-generate from available data: "Certificado de {issued_by} - {doctor_name} ({year})"

**6. No formatting guidance or character limits on any text field**
- No hint about ideal bio length for SEO (~150-300 words)
- No guidance on specialty naming conventions
- No preview of how the profile will look publicly
- Service descriptions have no min/max guidance

**7. Carousel item alt text uses filename, not descriptive text**
- Photos uploaded to carousel get `file.name` as alt text (e.g., "IMG_2034.jpg")
- Not descriptive for SEO or accessibility
- **Fix needed:** Auto-generate: "Consultorio de {doctor_name} en {city}" or prompt doctor for description

#### Data Flow Summary

```
Doctor Dashboard Form
  |
  v
PUT /api/doctors/[slug]  (Prisma transaction)
  |
  v
Database (PostgreSQL)
  |
  v
GET /api/doctors/[slug]  (public API, cached 60s)
  |
  v
Public Profile Page (SSR + ISR 1hr)
  |
  v
Google Crawler
```

Key insight: Any fix can happen at 3 levels:
- **Dashboard level:** Better form fields, validation, guidance (prevents bad data)
- **API level:** Normalize data on save (title case, auto-generate missing fields)
- **Public page level:** Transform/format data at render time (quick fix, but doesn't fix source)

Best practice: Fix at the earliest possible level (dashboard > API > public page).

---

### Critical On-Page Gaps (Why Profiles Don't Rank for "Specialty + City")

#### 1. H1 Contains Only the Doctor Name (CRITICAL)

**Current:** `<h1>Dr. Jose Toro</h1>`
**Problem:** Google uses H1 as a primary signal for page topic. The H1 says nothing about ophthalmology or Guadalajara.
**Fix:** Change H1 to include specialty context, e.g., `<h1>Dr. Jose Toro</h1>` with a visible subtitle/tagline that Google reads as part of the H1 context, or restructure the heading hierarchy.

**Options to consider:**
- **Option A:** H1 = "Dr. Jose Toro — Oftalmologo en Guadalajara" (most direct, but may feel redundant with H2)
- **Option B:** Keep H1 as name, but add a prominent `<p>` intro paragraph right below with natural keyword text: "Oftalmologo especialista en Guadalajara con X anos de experiencia..." (Google reads surrounding text heavily)
- **Option C:** Keep H1 as name, make H2 = "Oftalmologo en Guadalajara" instead of just "Oftalmologo"

#### 2. H2 Missing Location Keyword (HIGH)

**Current:** `<h2>Oftalmologo</h2>`
**Problem:** The city is only shown in a separate `<span>` with a MapPin icon. Google doesn't strongly associate the specialty with the location.
**Fix:** H2 = "Oftalmologo en Guadalajara" — simple, natural, and SEO-powerful.

#### 3. No Introductory Paragraph Above the Fold (HIGH)

**Problem:** After the H1 and H2, the page goes straight to badges, buttons, and navigation. There's no natural prose paragraph that Google can read to understand: "This is a page about an ophthalmologist in Guadalajara who treats cataracts, glaucoma, etc."
**Fix:** Add a 2-3 sentence intro paragraph using `short_bio` or auto-generated text, placed between the hero subtitle and the CTA buttons. Example:
> "El Dr. Jose Toro es oftalmologo en Guadalajara, Jalisco, con mas de 15 anos de experiencia en cirugia de cataratas, tratamiento de glaucoma y salud visual integral. Agenda tu cita hoy."

This paragraph serves double duty: it helps SEO (keyword-rich natural text above the fold) and helps patients understand the doctor at a glance.

#### 4. Section Headings Are Generic (MEDIUM)

**Current:** "Servicios", "Condiciones y Procedimientos"
**Problem:** Every doctor profile on the internet has these generic headings. Google can't differentiate.
**Fix:** Personalize headings with the doctor's context:
- "Servicios" -> "Servicios de Oftalmologia" or "Servicios del Dr. Toro"
- "Condiciones y Procedimientos" -> "Condiciones y Procedimientos Oftalmologicos"
- "Ubicacion del Consultorio" -> "Consultorio en Guadalajara"

#### 5. Service Descriptions Hidden on Mobile (MEDIUM)

**Current:** On mobile, service cards show only the name + "Ver mas" button. The description is `hidden md:block`.
**Problem:** Google uses **mobile-first indexing**. Content that is hidden on mobile gets deprioritized or ignored. Those service descriptions contain valuable SEO keywords.
**Fix:** Show at least a truncated version of the description on mobile (first 100 chars + "..."), or use CSS `line-clamp` instead of `hidden`.

#### 6. Biography Section Too Far Down (MEDIUM)

**Problem:** The long bio (which contains natural keyword-rich text about the doctor's specialty, location, and experience) is section #7 — below services, conditions, and reviews. Google gives more weight to content higher on the page.
**Fix:** Either move biography higher (after services, before conditions), or add the intro paragraph in the hero (Gap #3) which solves this more elegantly.

#### 7. Blog Article Images Use Native `<img>` (LOW-MEDIUM)

**Current:** `ArticleCard.tsx` uses `<img>` instead of Next.js `<Image>`
**Fix:** Switch to Next.js `<Image>` for automatic optimization, WebP conversion, responsive sizing, and lazy loading.

#### 8. Missing Favicon / Web Manifest (LOW)

No favicon or PWA manifest. Minor brand presence issue.

#### 9. Sitemap Missing `lastModified` Dates (LOW)

Sitemap entries don't include real last-modified timestamps from API data.

---

## Implementation Plan (Revised — Per-Profile Focus)

**Context:** With only 3 doctors, there is no value in directory/catalog pages. Each doctor's profile page must independently rank for "specialty + city" queries. The strategy is: make each profile the best, most complete, most keyword-relevant page on the internet for that doctor's specialty in their city.

### Phase 1: On-Page SEO Optimization — DONE (2026-04-24)

All on-page SEO tasks implemented and deployed.

| # | Task | Status | What Was Done |
|---|------|--------|---------------|
| 1.1 | **Add city to H2 subtitle** | DONE | H2 now renders `{specialty} en {city}` via `toTitleCase()` + conditional city |
| 1.2 | **Add intro paragraph in hero** | DONE | Auto-extracts first 2 sentences from `long_bio` (falls back from `short_bio` if set). Uses `extractIntro()` in `HeroSection.tsx` — no separate field needed |
| 1.3 | **Personalize section headings** | DONE | "Servicios de {specialty}", "Condiciones y Procedimientos — {specialty}", "Consultorio en {city}" |
| 1.4 | **Show service descriptions on mobile** | DONE | `line-clamp-2 md:line-clamp-none` replaces `hidden md:block` |
| 1.5 | **Add "Consultorio en {city}" heading** | DONE | `ClinicLocationSection.tsx` heading now includes city |
| ~~1.6~~ | ~~Fix junk H2 tags~~ | REMOVED | Misdiagnosis — they were `<span>` not H2 |
| 1.7 | **Fix ALL CAPS specialty** | DONE | `toTitleCase()` from shared `lib/text.ts`, applied consistently in HeroSection, ServicesSection, ConditionsSection |
| ~~1.8~~ | ~~Fix empty certificate alt tags~~ | REMOVED | Already had auto-fallback in `CredentialsSection.tsx` |
| 1.9 | **Guard H2 against empty specialty** | DONE | `{doctor.primary_specialty && (...)}` conditional added |

### Phase 1B: Dashboard Fixes — PARTIALLY DONE (2026-04-24)

| # | Task | Status | What Was Done |
|---|------|--------|---------------|
| 1B.1 | **Normalize specialty casing** | DONE (render-time) | `toTitleCase()` applied at render time in public page. Raw data preserved in DB. |
| 1B.2 | **Expose subspecialties in dashboard** | DONE | Textarea added to doctor dashboard (`GeneralInfoSection.tsx`), admin edit (Step 1), and admin create (Step 1). Uses one-per-line pattern matching conditions/procedures. |
| 1B.3 | **Auto-generate intro from long_bio** | DONE | Decision: NO separate `short_bio` textarea — doctors shouldn't write 2 bios. Instead, `HeroSection.tsx` auto-extracts first 2 sentences from `long_bio` via `extractIntro()`. If `short_bio` exists in DB, it takes priority. `short_bio` field preserved as pass-through in form data (not wiped on save). |
| ~~1B.4~~ | ~~Auto-generate certificate alt text~~ | REMOVED | Already handled |
| 1B.5 | **Auto-generate location_summary** | PENDING | |
| 1B.6 | **Auto-generate carousel alt text** | PENDING | |

### Phase 2: Technical SEO Fixes (MEDIUM PRIORITY — 1-2 days)

| # | Task | What to Change | Impact |
|---|------|----------------|--------|
| 2.1 | **Fix blog images** | `ArticleCard.tsx`: Replace `<img>` with Next.js `<Image>` | MEDIUM — Better CWV scores |
| 2.2 | **Add favicon + web manifest** | `public/`, `app/layout.tsx` | LOW — Brand presence |
| 2.3 | **Fix `lastModified` in sitemap** | `app/sitemap.ts`: Already includes `lastModified` but most entries use `new Date()` (current timestamp) instead of real last-modified dates from the database. Replace with actual `updatedAt` from API data | LOW — Current timestamps are technically a lie to Google |
| 2.4 | **Validate structured data** | Run all 3 profiles through Google Rich Results Test, fix any warnings | MEDIUM — Ensure rich snippets eligibility |

### Phase 3: Content Strategy for Rankings (HIGH PRIORITY — Ongoing)

Each doctor's blog posts are the primary weapon for ranking. Blog posts targeting long-tail keywords link back to the profile, building topical authority.

| # | Task | Details | Impact |
|---|------|---------|--------|
| 3.1 | **Blog keyword strategy per doctor** | For each doctor, identify 10-20 long-tail keywords related to their specialty+city. Example for ophthalmologist in GDL: "cirugia de cataratas en guadalajara", "tratamiento de glaucoma guadalajara", "mejor oftalmologo guadalajara", "precio cirugia lasik guadalajara" | HIGH — Each blog post is a new entry point in Google |
| 3.2 | **Internal linking: blog -> profile sections** | Each blog post should link to specific profile sections with anchor links. "Si necesitas cirugia de cataratas, [consulta nuestros servicios](/doctores/dr-jose-toro#servicios)" | HIGH — Passes authority from blog to profile |
| 3.3 | **Internal linking: profile -> blog** | Add a "Blog" or "Articulos" section on the profile page showing the doctor's latest 3 articles | MEDIUM — Keeps users on site, signals content depth |
| 3.4 | **FAQ content expansion** | Each doctor should have 8-10 FAQs targeting common search queries. Example: "Cuanto cuesta la cirugia de cataratas en Guadalajara?" — this directly matches search queries and enables FAQ rich snippets | HIGH — FAQ rich snippets can dominate SERP real estate |
| 3.5 | **Review volume** | Encourage patients to leave reviews. More reviews = better rich snippets with stars in Google results | HIGH — Star ratings in search results dramatically increase CTR |

### Phase 4: Monitoring & Iteration (Ongoing)

| # | Task | How | Impact |
|---|------|-----|--------|
| 4.1 | **Google Search Console setup** | Verify domain, submit sitemap, monitor indexation | Required — Can't improve what you can't measure |
| 4.2 | **Validate structured data** | Use Rich Results Test for each profile URL | Required — Ensures rich snippets show up |
| 4.3 | **Track keyword rankings** | Monitor "oftalmologo guadalajara", "dermatologo [city]", etc. weekly | Required — Measures ROI |
| 4.4 | **Core Web Vitals** | Monitor LCP, CLS, INP in Search Console and PageSpeed Insights | MEDIUM — Ranking factor since 2021 |
| 4.5 | **CTR optimization** | Review Search Console data, A/B test meta descriptions for low-CTR queries | MEDIUM — More clicks from same ranking position |

---

## Priority Summary

**Phase 1 is the highest ROI and should be done first.** The profile pages have strong technical SEO (structured data, sitemap, SSR) but weak on-page keyword signals. Google's title tag says "Oftalmologo | Guadalajara" but the actual page content (H1, H2, body text) doesn't reinforce that. Fixing this alignment is the single biggest lever.

**Phase 3 (content) is the long-term growth engine.** Each blog post is a new page that can rank for a long-tail query and funnel users to the profile. With 3 doctors, you need 10-20 articles per doctor targeting their specialty+city variations.

**Phase 2 (technical fixes) is important but not urgent.** These are incremental improvements.

**Directory/catalog pages (originally Phase 2) are deferred.** With only 3 doctors, creating specialty+city landing pages (e.g., `/cardiologo-en-guadalajara`) listing 1 doctor would be thin content. This strategy becomes viable at 10+ doctors per specialty/city combination. For now, each profile must rank independently.

---

## Quick Reference: What Google Sees vs. What It Should See

### Current State (Example: Dr. Jose Toro, Ophthalmologist, Guadalajara)

```
<title>Dr. Jose Toro | Oftalmologo | Guadalajara</title>        -- GOOD
<meta description="Dr. Jose Toro, Oftalmologo en Guadalajara..." -- GOOD
<h1>Dr. Jose Toro</h1>                                           -- MISSING specialty+city
<h2>Oftalmologo</h2>                                             -- MISSING city
[no intro paragraph]                                              -- MISSING keyword prose
<h2>Servicios</h2>                                                -- GENERIC
<h2>Condiciones y Procedimientos</h2>                             -- GENERIC
[service descriptions hidden on mobile]                           -- BAD for mobile-first index
```

### After Phase 1 (IMPLEMENTED 2026-04-24)

```
<title>Dr. Jose Toro | Oftalmologo | Guadalajara</title>                -- GOOD (unchanged)
<meta description="Dr. Jose Toro, Oftalmologo en Guadalajara..."        -- GOOD (unchanged)
<h1>Dr. Jose Toro</h1>                                                  -- OK (name stays clean)
<h2>Oftalmologia en Guadalajara</h2>                                     -- DONE: toTitleCase + city
<p>[first 2 sentences of long_bio auto-extracted]</p>                    -- DONE: extractIntro()
<h2>Servicios de Oftalmologia</h2>                                       -- DONE: toTitleCase(specialty)
  [descriptions visible on mobile via line-clamp-2]                      -- DONE
<h2>Condiciones y Procedimientos — Oftalmologia</h2>                     -- DONE: toTitleCase(specialty)
<h2>Consultorio en Guadalajara</h2>                                      -- DONE: city in heading
```

This alignment between meta tags and on-page content is what makes Google confident the page is truly about "oftalmologo en guadalajara".
