# Google Indexing & Testing Guide — tusalud.pro

**Date:** 2026-04-20
**Purpose:** Step-by-step guide for indexing new doctor profiles and monitoring their SEO performance in Google.

---

## 1. When a New Doctor Profile is Created

Everything is automatic — no manual code or database changes needed. When you create a new doctor profile through the admin:

1. The profile page is live immediately at `tusalud.pro/doctores/{slug}`
2. All SEO metadata (title, description, OpenGraph, Twitter cards) generates from the doctor's data
3. All JSON-LD structured data (Physician, MedicalBusiness, ProfilePage, BreadcrumbList, Reviews, FAQ, Video) generates automatically
4. The sitemap at `tusalud.pro/sitemap.xml` picks up the new profile within **1 hour** (revalidation cycle)
5. Blog articles published by the doctor also appear in the sitemap automatically

**You only need to do the steps below to speed up indexing and monitor performance.**

---

## 2. Request Indexing for a New Profile

Google will eventually find new pages through the sitemap, but this can take days or weeks. To speed it up:

### Step 1: Open Google Search Console
- Go to https://search.google.com/search-console
- Select the `tusalud.pro` property

### Step 2: URL Inspection
- In the top search bar, paste the full doctor profile URL, e.g.:
  `https://tusalud.pro/doctores/dra-adriana-michelle`
- Press Enter
- Wait for Google to check the URL

### Step 3: Request Indexing
- If the page shows "URL is not on Google" or has outdated data, click **"Request Indexing"**
- Google will prioritize crawling this specific page
- You can only request indexing for a limited number of URLs per day (~10-20)
- Indexing typically happens within **1-3 days** after requesting

### Step 4: Repeat for blog articles
- If the doctor has blog posts, also request indexing for:
  `https://tusalud.pro/doctores/{slug}/blog/{article-slug}`

---

## 3. Verify Structured Data with Rich Results Test

This is the most important test — it shows exactly what Google sees on the page.

### How to run it:
1. Go to https://search.google.com/test/rich-results
2. Paste the doctor profile URL
3. Click "Test URL"
4. Wait for results (takes ~30 seconds)

### What to check:
The test should detect these rich result types for a doctor profile:

| Type | What it means | When it appears |
|------|--------------|-----------------|
| **ProfilePage** | Google knows this is a profile page about a person | Always |
| **BreadcrumbList** | Google can show navigation trail in search results | Always |
| **Physician** | Google knows this is a medical professional | Always |
| **MedicalBusiness / LocalBusiness** | Google can show hours, phone, location | Always |
| **AggregateRating** | Star ratings in search results | When doctor has reviews |
| **Review** | Individual patient reviews | When doctor has reviews |
| **FAQPage** | FAQ content recognized | When doctor has FAQs |
| **VideoObject** | Video thumbnails in search | When doctor has videos |

### What "good" looks like:
- All detected types show a green checkmark
- No errors (red) — warnings (yellow) are usually OK
- If you see errors, click on them to see which field is invalid

### Common issues:
- If MedicalBusiness shows an error on `openingHoursSpecification`, check that the doctor's hours in the admin don't have unusual formats
- If Physician shows a warning about `sameAs`, the doctor has no social links — this is fine, it's just a suggestion

---

## 4. Test Page Speed (Core Web Vitals)

Page speed is a Google ranking factor. Test it after each major change.

### How to run it:
1. Go to https://pagespeed.web.dev
2. Paste the doctor profile URL
3. Click "Analyze"

### Key metrics to check:

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5-4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |

### Tips:
- Test both **Mobile** and **Desktop** tabs — Google uses mobile-first indexing
- The "Opportunities" section shows specific things to improve
- Focus on LCP first — it's usually the biggest factor for doctor profiles (hero image loading)

---

## 5. Search for Your Doctors on Google

### Name searches (should rank quickly, within 1-2 weeks):
- `Dra. Patricia Roldan Mora`
- `Dra. Adriana Michelle`
- `Dr. {full name}`

### Specialty + city searches (takes longer, 1-3 months):
- `cirujano bariatra Guadalajara`
- `cirugia general Monterrey`
- `{specialty} {city}`

### Tips:
- Use an **incognito/private window** so results aren't personalized
- Google your doctor names periodically to track progress
- If a profile doesn't appear after 2-3 weeks, re-request indexing in Search Console

---

## 6. Monitor Performance in Search Console

### 6.1 Performance Report
- Search Console → **Performance** (left sidebar)
- Shows: total clicks, impressions, average CTR, average position
- Filter by page to see stats for a specific doctor profile
- Check **Queries** tab to see which search terms are bringing traffic

### 6.2 Enhancements
- Search Console → **Enhancements** (left sidebar)
- Shows which structured data types Google has detected across your site
- Takes 1-2 weeks after indexing to populate
- Look for: Review snippets, FAQ, Breadcrumbs, Profile page

### 6.3 Core Web Vitals
- Search Console → **Core Web Vitals** (left sidebar)
- Shows real-user performance data from Chrome users
- Only shows data after enough traffic — may be empty for new profiles

### 6.4 Sitemaps
- Search Console → **Sitemaps** (left sidebar)
- Verify the sitemap was read successfully
- Check "Discovered pages" count matches your actual number of profiles + articles

---

## 7. Ongoing Routine

### Weekly (5 minutes)
- Google 2-3 doctor names to see if they appear in results
- Check Search Console Performance for clicks/impressions trends

### Monthly (15 minutes)
- Check Search Console Enhancements for any new errors
- Run Rich Results Test on 1-2 doctor profiles (spot check)
- Run PageSpeed Insights on 1-2 profiles if any UI changes were made
- Check if sitemap "Discovered pages" count matches your active doctor count

### When a new doctor is created
- Request indexing via URL Inspection in Search Console
- Run Rich Results Test to verify structured data is correct
- Run PageSpeed Insights to check load time

### When a doctor profile is significantly updated
- Request re-indexing via URL Inspection
- The sitemap auto-updates within 1 hour, but requesting indexing speeds it up

---

## 8. Tools Quick Reference

| Tool | URL | What it does |
|------|-----|-------------|
| Google Search Console | https://search.google.com/search-console | Index pages, monitor performance, check errors |
| Rich Results Test | https://search.google.com/test/rich-results | Verify structured data (JSON-LD) |
| PageSpeed Insights | https://pagespeed.web.dev | Test page speed and Core Web Vitals |
| Schema.org Validator | https://validator.schema.org | Validate JSON-LD syntax (more detailed than Rich Results) |
| Mobile-Friendly Test | https://search.google.com/test/mobile-friendly | Verify mobile rendering |

---

## 9. Troubleshooting

### "URL is not on Google" in URL Inspection
- Normal for new pages. Click "Request Indexing" and wait 1-3 days.

### Rich Results Test shows errors
- Check which field has the error. Most common: invalid time formats in hours, missing required fields.
- Fix in the admin, the page regenerates within 1 hour.

### Doctor profile doesn't appear in Google after 2+ weeks
1. Check URL Inspection — is the page indexed?
2. If "Crawled - currently not indexed": the page was seen but Google chose not to index it. Usually means thin content — add more bio, services, reviews.
3. If "Discovered - currently not indexed": Google knows about it but hasn't crawled it yet. Request indexing again.

### Impressions but zero clicks
- Normal early on — your page appears in search but far down in results.
- Check "Average position" in Performance. Above 10 = page 1. Above 20 = page 2-3.
- More reviews, blog posts, and content improve position over time.

### Structured data shows in Rich Results Test but not in Search Console Enhancements
- Enhancements take 1-2 weeks to populate after Google crawls the page. Be patient.
