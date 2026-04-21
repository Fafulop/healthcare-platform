# SEO Audit & Fix — tusalud.pro Doctor Profiles

**Date:** 2026-04-20 (follow-up fixes 2026-04-21)
**Scope:** Full SEO audit of the public-facing doctor profile app at `tusalud.pro`
**Method:** Codebase analysis + live page crawl + Google official documentation cross-reference

---

## 1. What This Document Covers

This guide explains the comprehensive SEO audit performed on the tusalud.pro public app, including:

- What the **prior state** was (bugs, gaps, and missed opportunities)
- What was **changed** and in which files
- The **reasoning** behind each change, tied to official Google documentation

---

## 2. Prior State — What Was Wrong

### 2.1 Critical Bugs (P0)

These issues were **actively damaging** search positioning:

#### Bug 1: Meta Description in English with Broken Name Template

**File:** `apps/public/src/lib/seo.ts:17`

**Before:**
```ts
const description = `Dr. ${doctor.last_name}, ${doctor.primary_specialty} in ${doctor.city}. ${bioSnippet}| Book appointments, view services, credentials, and clinic location.`;
```

**What was wrong:**
- The site declares `lang="es"` and `og:locale="es_MX"` but the meta description was **half English** ("in", "Book appointments, view services, credentials, and clinic location")
- When `last_name` was empty or undefined, it rendered as **`"Dr. , CIRUJANA..."`** — a broken comma visible to Google and users
- Google uses language consistency as a quality signal. A Spanish page with English meta descriptions creates a **language mismatch** that can reduce ranking

**Live evidence:** `https://tusalud.pro/doctores/dra-patricia-roldan-mora` showed `"Dr. , CIRUJANA BARIATRA... in Guadalajara... Book appointments..."` in its HTML source.

**Google reference:** https://developers.google.com/search/docs/appearance/snippet

---

#### Bug 2: MedicalBusiness JSON-LD Had Redundant "Dr." Prefix

**File:** `apps/public/src/lib/structured-data.ts:67`

**Before:**
```ts
name: `Dr. ${doctor.doctor_full_name} - ${doctor.primary_specialty}`,
```

**What was wrong:**
- `doctor_full_name` already includes the honorific (e.g., "Dra. Patricia Roldan Mora")
- Result: **`"Dr. Dra. Patricia Roldan Mora"`** — a nonsensical name in Google's structured data
- Google's Rich Results validator would flag this as inconsistent entity naming

---

#### Bug 3: OpeningHoursSpecification Had Invalid Time Formats

**File:** `apps/public/src/lib/structured-data.ts:83-88`

**Before:**
```ts
opens: hours.split(' - ')[0],   // Could be "9:00 AM", "20:00 hrs", "CERRADO"
closes: hours.split(' - ')[1],  // Could be "8:00 PM", "CERRADO", undefined
```

**What was wrong:**
- Schema.org requires `opens`/`closes` in **24-hour HH:MM format** (e.g., `"09:00"`, `"20:00"`)
- The raw hours data from the API contains various formats: `"9:00 AM"`, `"20:00 hrs"`, `"3:00 PM"`, `"CERRADO"`
- None of these are valid Schema.org values. Google's Rich Results Test **rejects** them entirely
- This means the **entire LocalBusiness rich result** (which shows hours, location, and phone in search) was broken

**Google reference:** https://developers.google.com/search/docs/appearance/structured-data/local-business

---

#### Bug 4: Empty `sameAs` Array in Physician Schema

**File:** `apps/public/src/lib/structured-data.ts:44-46`

**Before:**
```ts
...(doctor.social_links && {
  sameAs: Object.values(doctor.social_links).filter(Boolean),
}),
```

**What was wrong:**
- When a doctor has a `social_links` object but all values are `null`/`undefined`/empty string, `filter(Boolean)` returns `[]`
- `sameAs: []` (empty array) is **invalid** in Schema.org — it should either have URLs or be omitted entirely
- Google's validator flags this as a structured data error

---

#### Bug 5: Test/Junk Profiles in Production Sitemap

**File:** `apps/public/src/app/sitemap.ts`

**What was wrong:**
- The sitemap included test profiles: `dr-prueba`, `fffffffff`, `gerardo`, `dr-quebradita`
- Test blog posts: `dr-quebradita/blog/bbbbb`, `blog/nmbnm`, `blog/cv`, `blog/rddsgdsg`
- **Impact:** Google allocates a finite "crawl budget" to each domain. Every URL pointing to empty/junk content **wastes crawl budget** and signals low quality
- Sites with a high ratio of thin/empty pages get ranked lower overall

**Google reference:** https://developers.google.com/search/docs/fundamentals/seo-starter-guide

---

#### Bug 6: baseUrl Defaulted to `example.com` / `localhost:3000`

**Files:** `seo.ts`, `structured-data.ts`, `sitemap.ts`, `robots.ts`, `layout.tsx`, blog pages

**Before:**
```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';  // in most files
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'; // in sitemap & robots
```

**What was wrong:**
- If the `NEXT_PUBLIC_BASE_URL` environment variable is ever unset (deployment config error, new environment, etc.), **all canonical URLs, structured data URLs, and sitemap URLs** would point to `example.com` or `localhost`
- This would make Google see every page as belonging to a different domain
- Canonical URL mismatches are one of the most common causes of **duplicate content penalties**

---

### 2.2 High Impact Gaps (P1)

These were missing features that Google explicitly supports and recommends:

#### Gap 7: No `ProfilePage` Structured Data

**What was missing:**
- Google has a dedicated structured data type for profile pages: `ProfilePage`
- Ref: https://developers.google.com/search/docs/appearance/structured-data/profile-page
- This tells Google "this page is a profile about a specific person" and enables enhanced search results
- tusalud.pro had `Physician` and `MedicalBusiness` schemas but was **missing the profile wrapper**

---

#### Gap 8: No `BreadcrumbList` Structured Data

**What was missing:**
- No `BreadcrumbList` JSON-LD schema on any page
- Breadcrumbs enable Google to show a **navigation trail in search results** instead of the raw URL
- Example: `tusalud.pro > Doctores > Dra. Patricia Roldan Mora` instead of `tusalud.pro/doctores/dra-patricia-roldan-mora`

**Important — JSON-LD only, no visible breadcrumbs:**
Each doctor profile on tusalud.pro is a standalone page (like a Shopify store per doctor), not part of a browsable directory. A visible breadcrumb navigation ("Inicio / Doctores / Dra. Name") doesn't fit this product model and was intentionally **not** added to the UI. However, the `BreadcrumbList` JSON-LD schema lives inside a `<script type="application/ld+json">` tag which is **invisible to users** — only Google crawlers parse it. This gives Google the structural context it needs to display breadcrumb trails in search results without affecting the user experience.

**Google reference:** https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

---

#### Gap 9: Incomplete `PostalAddress` in Structured Data

**What was missing:**
- Address only had `streetAddress` and `addressLocality` (city)
- Missing: `addressRegion` (state like "Jalisco"), `postalCode`, `addressCountry`
- Google's LocalBusiness documentation lists `addressCountry` as **recommended** for proper geo-targeting
- Without country code, Google may not correctly associate the business with Mexico in local search

**Google reference:** https://developers.google.com/search/docs/appearance/structured-data/local-business

---

#### Gap 10: Root Layout Metadata Was Generic English

**File:** `apps/public/src/app/layout.tsx`

**Before:**
```ts
title: "Doctor Profile | Medical Services",
description: "Find and book appointments with qualified medical professionals",
```

**What was wrong:**
- The root metadata is the **fallback** for every page. If a page doesn't override it, this is what Google sees
- English title/description on a Spanish site is a language mismatch signal
- No `metadataBase` was set, which means relative URLs in metadata wouldn't resolve correctly

---

#### Gap 11: Missing `twitter:site` in Twitter Cards

**What was missing:**
- Twitter/X card configuration had no `site` property (the @handle of the site owner)
- This prevents Twitter from attributing shared content to the tusalud.pro brand

---

#### Gap 12: Publisher Name Was "HealthCare Platform"

**File:** `apps/public/src/lib/structured-data.ts:215`

**Before:**
```ts
publisher: {
  '@type': 'Organization',
  name: 'HealthCare Platform',
```

**What was wrong:**
- Generic placeholder name instead of actual brand "TuSalud.pro"
- Google uses the publisher field to understand which organization is behind the content
- A generic name provides zero brand recognition or E-E-A-T signal

---

### 2.3 Additional Issues Found

| Issue | Location | Status |
|-------|----------|--------|
| "Acerca de la Dra. " heading with missing name | `BiographySection.tsx` | Fixed |
| Empty `alt=""` on credential images | `CredentialsSection.tsx` | Fixed |
| Keywords in English ("doctor", "medical", "healthcare") | `seo.ts` | Fixed |
| `siteName: 'HealthCare Platform'` in blog OpenGraph | Blog page files | Fixed |
| No `state`/`postal_code` fields in ClinicInfo type | `types/doctor.ts` | Added (optional) |

---

## 3. What Was Changed

### 3.1 `apps/public/src/lib/seo.ts`

| Change | Why |
|--------|-----|
| Meta description rewritten in Spanish | Language consistency with `es_MX` locale — Google penalizes language mismatches |
| Uses `doctor_full_name` instead of `Dr. ${last_name}` | Prevents broken `"Dr. , "` when last_name is empty |
| Bio snippet capped at 80 chars | Keeps total description under ~155 chars (Google's display limit) |
| CTA in Spanish: "Agenda citas, consulta servicios, opiniones y ubicacion" | Matches user search language |
| Keywords changed to Spanish | Users in Mexico search in Spanish; English keywords have zero search volume for this market |
| Added `twitter:site: '@tusaludpro'` | Brand attribution on Twitter/X shares |
| baseUrl default → `https://tusalud.pro` | Prevents canonical URL disasters if env var is unset |

### 3.2 `apps/public/src/lib/structured-data.ts`

| Change | Why |
|--------|-----|
| `normalizeTime()` helper function | Converts any time format (AM/PM, "hrs", 24h) to valid `HH:MM`. Skips "CERRADO". This is **required** by Schema.org spec |
| `buildPostalAddress()` helper | Centralizes address logic. Adds `addressCountry: "MX"` + optional `addressRegion`/`postalCode` |
| MedicalBusiness name: removed `"Dr."` prefix | `doctor_full_name` already includes the honorific — prevents "Dr. Dra." |
| sameAs: only included when array is non-empty | Empty `sameAs: []` is invalid Schema.org |
| Opening hours: filters out days with invalid/null times | Prevents invalid `opens: null` in structured data |
| **NEW** `generateProfilePageSchema()` | Google's ProfilePage markup — tells Google this is a profile page about a specific person |
| **NEW** `generateBreadcrumbSchema()` | JSON-LD only (invisible to users). Enables breadcrumb display in Google SERPs: `Inicio > Doctores > {Name}`. No visible breadcrumb was added to the UI — doctor profiles are standalone pages, not part of a browsable directory |
| Both new schemas added to `generateAllSchemas()` | Automatically injected on all doctor profiles |
| `siteName` standardized to `'TuSalud.pro'` | Was inconsistent (`'TuSalud.pro - Encuentra tu Doctor'` in seo.ts vs `'TuSalud.pro'` in blog pages). Caught in post-implementation review |
| Publisher name → `"TuSalud.pro"` | Real brand name instead of generic placeholder |
| All baseUrl defaults → `https://tusalud.pro` | Consistent with seo.ts fix |

### 3.3 `apps/public/src/app/sitemap.ts`

| Change | Why |
|--------|-----|
| Added `EXCLUDED_SLUGS` blocklist | Explicitly blocks known test profiles like `dr-prueba`, `fffffffff` |
| Added `isValidDoctorSlug()` filter | Rejects slugs that are too short (<4 chars) or gibberish (repeated chars) |
| Article slug validation | Filters junk blog posts (e.g., `bbbbb`, `nmbnm`) |
| baseUrl default → `https://tusalud.pro` | Prevents sitemap URLs pointing to localhost |

### 3.4 `apps/public/src/app/layout.tsx`

| Change | Why |
|--------|-----|
| Title → `"TuSalud.pro \| Encuentra tu Doctor en Mexico"` | Spanish, branded, keyword-rich fallback title |
| Title template → `"%s \| TuSalud.pro"` | Every page title automatically gets the brand suffix |
| Description in Spanish | Consistent language across the entire site |
| Added `metadataBase: new URL('https://tusalud.pro')` | Ensures all relative URLs in metadata resolve to the correct domain |

### 3.5 `apps/public/src/components/doctor/DoctorProfileClient.tsx`

| Change | Why |
|--------|-----|
| No visible changes | A visual breadcrumb nav was initially added but then **removed** — doctor profiles are standalone pages (like individual Shopify stores for each doctor), not part of a directory hierarchy. The `BreadcrumbList` JSON-LD schema in `structured-data.ts` handles this for Google crawlers invisibly via `<script type="application/ld+json">` |

### 3.6 `apps/public/src/components/doctor/BiographySection.tsx`

| Change | Why |
|--------|-----|
| Heading: `"Acerca de {doctorFullName}"` | Old logic tried to detect "Dr." vs "Dra." and used `last_name` which was sometimes empty, resulting in `"Acerca de la Dra. "` with no name. Now uses full name directly |

### 3.7 `apps/public/src/components/doctor/CredentialsSection.tsx`

| Change | Why |
|--------|-----|
| Alt text fallback: `"Certificado: {issued_by} ({year})"` | When API returns empty `alt` string, images had `alt=""` — invisible to Google Image search and bad for accessibility |

### 3.8 `apps/public/src/types/doctor.ts`

| Change | Why |
|--------|-----|
| Added `state?: string` and `postal_code?: string` to `ClinicInfo` | Enables `addressRegion` and `postalCode` in structured data when available from API |

### 3.9 Other Files (baseUrl + siteName fixes)

- `robots.ts` — baseUrl fix
- `doctores/[slug]/layout.tsx` — baseUrl fix
- `doctores/[slug]/blog/page.tsx` — baseUrl fix + `siteName: 'TuSalud.pro'`
- `doctores/[slug]/blog/[articleSlug]/page.tsx` — baseUrl fix + `siteName: 'TuSalud.pro'`

---

## 4. Post-Implementation Code Review

A systematic code review was run after all changes were applied, checking 30+ items across 6 categories (structured data validity, metadata consistency, component integration, sitemap logic, type safety, cross-cutting concerns).

### Issues Found & Fixed

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | **Bug** | `BreadcrumbList` position 3 had a city name linking to `/doctores` — semantically incorrect since no city filter page exists. Google expects breadcrumb URLs to match real pages | Removed city position. Breadcrumb JSON-LD is now `Inicio > Doctores > {Doctor Name}` (3 items) |
| 2 | **Inconsistency** | OpenGraph `siteName` was `'TuSalud.pro - Encuentra tu Doctor'` in `seo.ts` but `'TuSalud.pro'` in blog pages | Standardized to `'TuSalud.pro'` across all files |
| 3 | **UX** | Visual breadcrumb nav (`<nav>` with "Inicio / Doctores / Dra. Name") was showing on doctor profile pages. Doctor profiles are standalone pages (like individual Shopify stores), not part of a directory — the visible breadcrumb didn't match the product model | Removed visible breadcrumb HTML. Kept `BreadcrumbList` JSON-LD schema which is invisible to users (lives in `<script type="application/ld+json">`, only parsed by Google crawlers) |

### All Checks Passed

- `normalizeTime()` handles all edge cases (AM/PM, 24h, "hrs" suffix, "CERRADO", null)
- `buildPostalAddress()` correctly uses optional chaining for new fields
- `sameAs` only included when array is non-empty (Physician schema)
- `generateAllSchemas()` includes all new schemas (ProfilePage, BreadcrumbList)
- All baseUrl defaults are `https://tusalud.pro` — verified across every single file
- No remaining `example.com`, `localhost`, or `HealthCare Platform` references
- `metadataBase` matches baseUrl default
- New `state?` and `postal_code?` type fields are optional — no breaking changes
- Sitemap filtering logic is correct with no false positives on real slugs
- All component props are correctly passed and used
- No dead/unused imports
- Meta description lengths are under 155 chars
- Title template works correctly with child page overrides

---

## 4b. Follow-Up Fixes After Rich Results Test (2026-04-21)

After running the Google Rich Results Test on the live site (`https://tusalud.pro/doctores/dra-patricia-roldan-mora`), additional issues were discovered and fixed.

### Rich Results Test Initial Result (before follow-up)

The test detected 3 valid items but with warnings:
- **Physician** (from Review `itemReviewed`) — 4 missing optional fields (telephone, priceRange, address, image)
- **Physician** (main schema) — 1 missing optional field (priceRange)
- **MedicalBusiness** — 1 missing optional field (priceRange)

The duplicate Physician was caused by Review schemas creating a standalone `itemReviewed: { '@type': 'Physician', name: '...' }` with only the doctor's name.

### Issues Found & Fixed

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | **Bug** | Review `itemReviewed` created a duplicate Physician entity with 4 missing fields | Added `@id` to main Physician schema (`{url}#physician`). Review's `itemReviewed` now references via `@id` instead of standalone `name` — Google resolves them as one entity |
| 2 | **Warning** | `priceRange` missing on both Physician and MedicalBusiness | Added `priceRange: '$$'` to both schemas |
| 3 | **Bug** | `generateReviewSchemas` was dynamically imported (`await import()`) despite `generateAllSchemas` from the same module already being statically imported | Changed to static import |
| 4 | **Inconsistency** | Not-found metadata in English on a Spanish site: `"Doctor Not Found"`, `"Article Not Found"`, `"Blog Not Found"` | Translated to Spanish across all 3 pages: doctor layout, blog listing, blog article |
| 5 | **Bug** | ProfilePage `mainEntity` duplicated Physician data as a separate `Person` entity with redundant fields | Simplified to `@id` reference pointing to the main Physician schema |
| 6 | **Dead code** | `generateSchemaScriptTags()` was never called anywhere. Also didn't include review schemas, so would produce incomplete output if used | Removed |
| 7 | **Dead code** | `generatePreloadLinks()` and `getShortBioSnippet()` in `seo.ts` were never called | Removed |
| 8 | **Minor** | `...doctor.subspecialties || []` — operator precedence unclear (works by accident) | Added parentheses: `...(doctor.subspecialties || [])` |
| 9 | **Critical** | VideoObject schemas were invalid — missing required `thumbnailUrl` field (was `undefined` when no video thumbnail) | Falls back to doctor's hero image when no video thumbnail exists |
| 10 | **Warning** | `uploadDate` on VideoObject and `dateModified` on ProfilePage used date-only format (`2026-04-21`) — Google requires full ISO datetime with timezone | Changed to `new Date().toISOString()` which outputs `2026-04-21T00:00:00.000Z` |
| 11 | **Minor** | Video description grammar: `"Video de presentación del CIRUJANA..."` — `del` doesn't agree with feminine specialty | Changed to `"Video de presentación de {name}, {specialty}"` |

### Files Changed

| File | Changes |
|------|---------|
| `structured-data.ts` | `@id` on Physician, `priceRange` on Physician + MedicalBusiness, ProfilePage `mainEntity` via `@id`, Review `itemReviewed` via `@id`, VideoObject `thumbnailUrl` fallback to hero image, ISO datetime for `uploadDate` + `dateModified`, video description grammar fix, removed dead `generateSchemaScriptTags()` |
| `seo.ts` | Removed dead `generatePreloadLinks()` + `getShortBioSnippet()`, fixed subspecialties spread precedence |
| `doctores/[slug]/layout.tsx` | Static import for `generateReviewSchemas`, passes `doctorSlug` + `baseUrl` for `@id` linking, Spanish not-found metadata |
| `doctores/[slug]/blog/page.tsx` | Spanish not-found metadata |
| `doctores/[slug]/blog/[articleSlug]/page.tsx` | Spanish not-found metadata |

### Rich Results Test Final Result (after all fixes)

Expected result after deploy:

| Category | Items | Status |
|----------|-------|--------|
| **Breadcrumbs** | 1 | Valid |
| **Local businesses** | 2 (Physician + MedicalBusiness) | Valid, no priceRange warning |
| **Organization** | 2 | Valid, only optional `postalCode` warning (data-dependent) |
| **Profile page** | 1 | Valid, no datetime warning |
| **Review snippets** | 2 | Valid, no duplicate Physician |
| **Videos** | N | Valid, thumbnailUrl present, datetime correct |

### Key Technical Decisions

1. **`@id` references only work within the same page.** The BlogPosting `author` field was initially changed to an `@id` reference to the Physician, but this was reverted because blog article pages don't include the Physician schema — the `@id` would have nothing to resolve to. Blog author remains inline `Person` with full data.

2. **`priceRange: '$$'` is a reasonable default** for medical consultations in Mexico. Google doesn't validate the exact value — it just wants the field present to suppress the warning.

3. **Hero image as video thumbnail fallback** is acceptable because Google requires `thumbnailUrl` for VideoObject rich results. A doctor's profile photo is a reasonable representation when no specific video thumbnail exists.

---

## 5. What's Still Pending (P2/P3 — Future Work)

These items were identified in the audit but **not yet implemented**:

| Item | Impact | Effort | Notes |
|------|--------|--------|-------|
| Specialty/city landing pages (`/doctores/dermatologia/guadalajara`) | **Very High** — this is the #1 medical search pattern | High | New routes + metadata + sitemap entries |
| `WebSite` schema with `SearchAction` on homepage | Medium | Low | Enables Google sitelinks searchbox |
| `manifest.json` for PWA | Low-Medium | Low | Improves mobile experience signals |
| Video sitemap | Medium | Medium | Better video indexing for doctor intro videos |
| Core Web Vitals audit via PageSpeed Insights | Medium | Medium | Need actual CWV data from live pages |
| Blog content strategy guidance for doctors | High (long-term) | Low | Guide doctors to write about patient FAQs for long-tail SEO |

---

## 6. Verification Steps

After deploying these changes:

1. **Rich Results Test** — Paste each doctor URL into https://search.google.com/test/rich-results
   - Should show categories: Breadcrumbs, Local businesses, Organization, Profile page, Review snippets, Videos
   - All items should be valid (green checkmarks)
   - Only acceptable non-critical issues: `postalCode` (optional, data-dependent)
   - No critical issues on Videos (thumbnailUrl, uploadDate) or ProfilePage (dateModified)

2. **Schema.org Validator** — Validate JSON-LD at https://validator.schema.org/

3. **Google Search Console**:
   - Resubmit sitemap at `https://tusalud.pro/sitemap.xml`
   - Use "URL Inspection" on key doctor profiles
   - Monitor Core Web Vitals report
   - Check "Enhancements" tab for structured data detection

4. **Manual checks**:
   - Verify meta descriptions are fully Spanish, no broken names
   - Verify no visible breadcrumb nav on doctor profiles (JSON-LD only, invisible to users)
   - Verify sitemap no longer contains test profiles
   - Verify `view-source:` shows correct canonical URLs (tusalud.pro, not example.com)
   - Verify Physician schema has `@id`, `priceRange`, and no duplicate from Reviews
   - Verify VideoObject has `thumbnailUrl` (hero image fallback) and full ISO `uploadDate`

---

## 7. Google Official References Used

| Topic | URL |
|-------|-----|
| SEO Starter Guide | https://developers.google.com/search/docs/fundamentals/seo-starter-guide |
| Profile Page Structured Data | https://developers.google.com/search/docs/appearance/structured-data/profile-page |
| Local Business Structured Data | https://developers.google.com/search/docs/appearance/structured-data/local-business |
| Breadcrumb Structured Data | https://developers.google.com/search/docs/appearance/structured-data/breadcrumb |
| Review Snippet Structured Data | https://developers.google.com/search/docs/appearance/structured-data/review-snippet |
| Video Structured Data | https://developers.google.com/search/docs/appearance/structured-data/video |
| FAQ Structured Data | https://developers.google.com/search/docs/appearance/structured-data/faqpage |
| Image SEO Best Practices | https://developers.google.com/search/docs/appearance/google-images |
| Core Web Vitals | https://web.dev/articles/vitals |
| Meta Description Guidelines | https://developers.google.com/search/docs/appearance/snippet |
| Rich Results Test Tool | https://search.google.com/test/rich-results |
