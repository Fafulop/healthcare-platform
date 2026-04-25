# Organic Ranking Plan — Doctor Profiles

**Date:** 2026-04-24
**Goal:** Guarantee each doctor profile ranks on page 1 for "specialty + city" queries in Google organic search
**Context:** 3 doctors live on tusalud.pro. YMYL content (health). Mexico market, Spanish language.
**Timeline:** Expect first measurable results in 30-60 days (GBP/reviews), organic ranking improvements in 90-120 days, competitive keyword ranking in 4-8 months.

---

## What's Already Done (Code/Technical)

All code-level SEO is complete (Phases 1, 1B, 2 from SEO-ANALYSIS-AND-PLAN.md):

- H2 with specialty + city ("Oftalmologia en Guadalajara")
- Personalized section headings with specialty/city keywords
- Service descriptions visible on mobile (mobile-first indexing)
- toTitleCase normalization for ALL CAPS specialties
- 8 JSON-LD structured data schemas (Physician, MedicalBusiness, FAQPage, etc.)
- Sitemap with real updatedAt timestamps
- Favicon + web manifest
- Blog images optimized with Next.js Image
- SSR + ISR rendering (crawlable, fast)
- Meta tags with name + specialty + city
- Robots.txt properly configured

**What remains is NOT code — it's operations, content, and external signals.**

---

## Why Doctor Profiles Don't Rank Yet

Google evaluates medical content (YMYL — "Your Money or Your Life") with higher standards than regular content. For a doctor profile to rank for "oftalmologo en guadalajara", Google needs to be confident that:

1. **This page is about an ophthalmologist in Guadalajara** — DONE (on-page signals)
2. **This doctor is a real, verified professional** — PARTIALLY (credentials on page, but no Google Business Profile)
3. **Other trusted sources confirm this** — NOT DONE (no citations, no backlinks, no GBP)
4. **Patients trust this doctor** — PARTIALLY (reviews on site, but not on Google)
5. **The content is helpful and comprehensive** — PARTIALLY (profile is good, but thin blog content)

The gap is items 2-5: **off-page signals and content depth.**

---

## The Plan — 5 Pillars

### Pillar 1: Google Business Profile (CRITICAL — Do First)

Google Business Profile (GBP) is the #1 ranking factor for local "specialty + city" queries. Without it, the doctor profiles are invisible in Google Maps and the local 3-pack (the map results that appear above organic results).

**For EACH doctor:**

| Step | Action | Details |
|------|--------|---------|
| 1.1 | **Create Google Business Profile** | Go to [business.google.com](https://business.google.com). One profile per doctor (not per clinic). Use the doctor's real name with title: "Dr. Jose Cruz Ruiz" |
| 1.2 | **Choose correct category** | Primary: "Medico oftalmologo" (or equivalent specialty). Add secondary categories for subspecialties |
| 1.3 | **Verify the profile** | Google offers verification by postcard, phone, email, or video. In Mexico, video verification may be required for doctors. Film a short video showing the clinic signage, the doctor, and the consultation room |
| 1.4 | **Complete ALL fields** | Address (exact match to website), phone, hours, website URL (`https://tusalud.pro/doctores/{slug}`), appointment link, services list, insurance accepted |
| 1.5 | **Add photos** | Real clinic photos (not stock): exterior, reception, consultation room, doctor portrait. Upload 5-10 photos minimum. Add new photos weekly |
| 1.6 | **Add services** | List every service with description. Match the services on the tusalud.pro profile exactly |
| 1.7 | **Link website** | Set the website URL to the doctor's tusalud.pro profile page |
| 1.8 | **Enable appointments** | Add the booking link from tusalud.pro |

**NAP Consistency (Name, Address, Phone):**
The doctor's name, clinic address, and phone number must be IDENTICAL everywhere:
- Google Business Profile
- tusalud.pro profile page
- Social media profiles
- Medical directories
- Any other website

Even small differences ("Av." vs "Avenida", missing suite number) hurt rankings.

**Ongoing GBP maintenance:**
- Post weekly updates (Google Posts): health tips, clinic news, seasonal advice
- Answer questions in the Q&A section
- Update hours for holidays
- Upload new photos monthly

---

### Pillar 2: Reviews (CRITICAL — Start Immediately)

Google weights reviews heavily for local medical queries. Review signals include: total count, average rating, recency, and response rate.

| Step | Action | Details |
|------|--------|---------|
| 2.1 | **Get Google Reviews** | Reviews on tusalud.pro help the site, but Google Reviews on the GBP are what drive rankings. Each doctor needs Google reviews |
| 2.2 | **Create a review link** | From GBP dashboard, get the short review link. Print it as a QR code for the clinic |
| 2.3 | **Ask after positive visits** | Train reception staff: after a good consultation, hand the patient a card with the QR code. "Si le gusto su consulta, nos ayudaria mucho con una resena en Google" |
| 2.4 | **Respond to every review** | Within 24 hours. Thank positive reviewers by name. For negative reviews: acknowledge, apologize, offer to resolve privately. NEVER argue |
| 2.5 | **Target: 5+ reviews/month** | Review velocity (new reviews per month) matters more than total count. Consistent recent reviews signal an active practice |
| 2.6 | **Never buy or fake reviews** | Google detects and penalizes fake reviews. Healthcare profiles get extra scrutiny |

**Review milestones:**
- 0-10 reviews: Profile may not show star ratings in search
- 10-25 reviews: Stars appear, basic trust established
- 25-50 reviews: Competitive for local queries
- 50+ reviews: Strong authority signal

---

### Pillar 3: Content & Blog Strategy (HIGH — Ongoing)

Each blog post is a new page that can rank for a long-tail keyword and funnel patients to the doctor's profile. For YMYL content, Google requires demonstrated expertise.

#### 3A. Blog Content Strategy Per Doctor

**For each doctor, write 2-4 blog posts per month targeting these patterns:**

| Pattern | Example Keywords | Article Type |
|---------|-----------------|--------------|
| "que es {condition}" | "que es el glaucoma", "que es la cirugia bariatrica" | Educational explainer (500-1000 words) |
| "{procedure} en {city}" | "cirugia de cataratas en guadalajara", "manga gastrica en guadalajara" | Service + location page (includes pricing, process, recovery) |
| "{specialty} {city} precio" | "oftalmologo guadalajara precio", "cirugia bariatrica monterrey costo" | Cost/insurance guide |
| "mejor {specialty} en {city}" | "mejor oftalmologo en guadalajara" | Why-choose-us (credentials, experience, reviews) |
| "sintomas de {condition}" | "sintomas de cataratas", "sintomas de reflujo gastrico" | Symptom checker (links to booking) |
| "{procedure} antes y despues" | "manga gastrica antes y despues" | Before/after + patient stories |

**Content rules for YMYL (medical content):**
- Author byline: ALWAYS attribute to the doctor by name with credentials
- First-hand experience: Write from the doctor's perspective ("En mi consulta veo pacientes con...")
- Cite sources: Reference medical guidelines, studies, or official health organizations
- Be accurate: No exaggerated claims. No "guaranteed results"
- Include disclaimers: "Esta informacion es educativa y no sustituye una consulta medica"
- Answer the question immediately: Put the answer in the first paragraph, then expand

#### 3B. Internal Linking Strategy

Every blog post must link back to the doctor's profile:

```
At the end of each article:
"Si necesitas [service], agenda tu cita con [doctor name] en [city]."
→ Link to: /doctores/{slug}#servicios

Within the article body:
"Ofrecemos [procedure] en nuestro consultorio en [city]."
→ Link to: /doctores/{slug}#ubicacion
```

The profile page should also link to blog posts. Consider adding a "Blog del Doctor" section on the profile showing the latest 3 articles.

#### 3C. FAQ Expansion

Each doctor should have 8-15 FAQs on their profile. FAQs are eligible for rich snippets (extra SERP real estate). Target real search queries:

| Doctor | Example FAQs to Add |
|--------|-------------------|
| Dr. Jose (Oftalmologo, GDL) | "Cuanto cuesta la cirugia de cataratas en Guadalajara?", "A que edad se operan las cataratas?", "El glaucoma tiene cura?", "Cada cuanto debo ir al oftalmologo?", "Que incluye un examen de la vista completo?" |
| Dra. Patricia (Bariatrica, GDL) | "Cuanto cuesta la manga gastrica en Guadalajara?", "Cual es el peso minimo para cirugia bariatrica?", "Cuanto dura la recuperacion de la manga gastrica?", "Que tipos de cirugia bariatrica existen?", "La cirugia bariatrica la cubre el seguro?" |
| Dra. Adriana (Cirugia General, MTY) | "Cuanto cuesta una cirugia laparoscopica en Monterrey?", "Que es la cirugia laparoscopica?", "Cuanto dura la recuperacion de una cirugia de vesicula?", "Cuando se necesita operar la hernia?", "Es peligrosa la cirugia de vesicula?" |

These FAQs generate FAQPage structured data automatically (already implemented in code).

---

### Pillar 4: Citations & Backlinks (MEDIUM — Month 2+)

Citations are mentions of the doctor's NAP (Name, Address, Phone) on other websites. Backlinks are links pointing to the doctor's profile. Both build authority.

#### 4A. Medical Directory Listings (Priority)

Register each doctor on these platforms with IDENTICAL NAP data:

| Directory | URL | Priority |
|-----------|-----|----------|
| **Doctoralia Mexico** | doctoralia.com.mx | HIGH — Top medical directory in Mexico |
| **TopDoctors Mexico** | topdoctors.com.mx | HIGH — Established medical directory |
| **Citas Medicas** | citasmedicas.com.mx | MEDIUM |
| **Salud y Medicinas** | saludymedicinas.com.mx | MEDIUM |
| **LinkedIn** | linkedin.com | MEDIUM — Professional authority signal |
| **Facebook Business Page** | facebook.com | MEDIUM — Local trust signal |
| **Instagram Professional** | instagram.com | MEDIUM — Patient engagement |

**For each listing:**
- Use exact same name, address, phone as GBP and tusalud.pro
- Link back to the tusalud.pro profile page
- Add the doctor's photo, specialty, and bio
- Keep information updated

#### 4B. Authority Backlinks (High Value, Hard to Get)

| Source | How to Get It |
|--------|--------------|
| **Hospital affiliation pages** | If the doctor operates at a hospital, get listed on their website with a link |
| **Medical association memberships** | Join specialty associations (Sociedad Mexicana de Oftalmologia, etc.). Many list members with links |
| **Local press/media** | Offer expert quotes for health articles in local news. "Dr. Jose Cruz explica como prevenir el glaucoma" |
| **University alumni pages** | If the doctor's medical school lists alumni, get included |
| **Guest articles** | Write health articles for local news sites or health blogs, with author bio linking to tusalud.pro |

**Never do:**
- Buy links
- Use link farms or PBNs (Private Blog Networks)
- Submit to low-quality directories just for link count
- Exchange links with unrelated websites

---

### Pillar 5: Google Search Console & Monitoring (REQUIRED — Do Now)

Without Search Console, you're flying blind. This is the dashboard that tells you if Google is even seeing your pages.

| Step | Action | How |
|------|--------|-----|
| 5.1 | **Verify tusalud.pro in Search Console** | Go to [search.google.com/search-console](https://search.google.com/search-console). Add property `https://tusalud.pro`. Verify via DNS TXT record (ask your domain provider) or HTML file upload to `apps/public/public/` |
| 5.2 | **Submit sitemap** | In Search Console > Sitemaps, submit `https://tusalud.pro/sitemap.xml` |
| 5.3 | **Check indexation** | Pages > Indexing: Verify all 3 doctor profiles are indexed. If not, use URL Inspection to request indexing |
| 5.4 | **Validate structured data** | Run each profile URL through [Rich Results Test](https://search.google.com/test/rich-results). Fix any errors/warnings |
| 5.5 | **Monitor weekly** | Check these reports every week: Performance (clicks, impressions, CTR, position), Coverage (errors), Rich Results (structured data status) |
| 5.6 | **Connect to Google Analytics** | Link Search Console to GA4 for combined search + behavior data |
| 5.7 | **Run Core Web Vitals test** | Use [PageSpeed Insights](https://pagespeed.web.dev/) on each profile URL. Fix any red flags (LCP, CLS, INP) |

**Key metrics to track weekly:**

| Metric | What It Tells You | Target |
|--------|-------------------|--------|
| Impressions | How often your pages appear in search results | Growing month-over-month |
| Clicks | How many people click through to your site | Growing |
| Average Position | Where you rank for queries | < 10 (page 1) for target keywords |
| CTR | % of impressions that get clicked | > 5% for brand queries, > 2% for generic |
| Indexed Pages | How many pages Google has in its index | All profile + blog pages |
| Rich Results | Whether star ratings, FAQs appear in search | All profiles eligible |

---

## Execution Timeline

### Week 1-2: Foundation

- [ ] Set up Google Search Console for tusalud.pro
- [ ] Submit sitemap
- [ ] Verify all 3 profiles are indexed
- [ ] Run Rich Results Test on all 3 profiles
- [ ] Run PageSpeed Insights on all 3 profiles
- [ ] Create Google Business Profile for each doctor
- [ ] Start GBP verification process

### Week 3-4: Reviews & Citations

- [ ] Complete GBP verification for all doctors
- [ ] Fill out ALL GBP fields (services, hours, photos, appointment link)
- [ ] Create review QR codes for each clinic
- [ ] Train reception staff on review requests
- [ ] Register on Doctoralia Mexico (all 3 doctors)
- [ ] Register on TopDoctors Mexico (all 3 doctors)
- [ ] Create/update LinkedIn profiles for each doctor

### Month 2: Content

- [ ] Write 2-3 blog posts per doctor (target long-tail keywords)
- [ ] Expand FAQs to 8-10 per doctor
- [ ] Add internal links from blog posts to profile sections
- [ ] Start weekly Google Posts on each GBP
- [ ] Register on 3-5 additional medical directories
- [ ] Aim for 5+ Google reviews per doctor

### Month 3: Scale & Monitor

- [ ] Write 3-4 more blog posts per doctor
- [ ] Monitor Search Console: which queries are showing impressions?
- [ ] Optimize meta descriptions for low-CTR queries
- [ ] Continue review generation (target 15+ reviews per doctor)
- [ ] Seek 1-2 authority backlinks per doctor (hospital, association)
- [ ] Upload fresh GBP photos monthly

### Month 4-6: Compete

- [ ] 20+ blog posts per doctor covering all major keywords
- [ ] 25+ Google reviews per doctor
- [ ] Monitor position for "specialty + city" target keywords
- [ ] A/B test meta descriptions for highest-impression queries
- [ ] Consider Google Ads for competitive keywords while organic builds

---

## Priority Matrix

| Action | Impact | Effort | Do When |
|--------|--------|--------|---------|
| Google Search Console setup | HIGH | LOW | Day 1 |
| Google Business Profile (all 3) | CRITICAL | MEDIUM | Week 1 |
| GBP photos + services | HIGH | LOW | Week 2 |
| Review generation system | CRITICAL | LOW | Week 2 |
| Doctoralia / TopDoctors listings | HIGH | LOW | Week 3 |
| FAQ expansion (8-10 per doctor) | HIGH | MEDIUM | Month 1 |
| Blog posts (2-4/month/doctor) | HIGH | HIGH | Month 2+ |
| Medical directory citations | MEDIUM | LOW | Month 2 |
| Authority backlinks | HIGH | HIGH | Month 3+ |
| Google Ads (supplement) | MEDIUM | MEDIUM | When budget allows |

---

## What NOT To Do

Based on Google's official guidelines and YMYL standards:

1. **Don't stuff keywords** — "oftalmologo guadalajara oftalmologo en guadalajara mejor oftalmologo" is spam
2. **Don't create fake service area pages** — Healthcare SEO penalties are hard to reverse
3. **Don't buy reviews** — Google detects patterns and can suspend GBP
4. **Don't buy links** — One bad link penalty can tank the entire domain
5. **Don't use AI-generated content without doctor review** — YMYL content must be expert-verified
6. **Don't hide text from users** — Invisible text, tiny font, white-on-white is a spam violation
7. **Don't change publication dates to appear fresh** — Google explicitly flags this as deceptive
8. **Don't create multiple GBP profiles per doctor** — One profile per practitioner per location
9. **Don't neglect existing reviews** — Unanswered reviews signal an inactive practice
10. **Don't expect overnight results** — Organic SEO for medical queries takes 3-6 months minimum

---

## SEO Toolbox — What to Use and When

### Google Official Tools — Search & Indexing

| Tool | URL | What It Does | When to Use |
|------|-----|-------------|-------------|
| **Google Search Console** | [search.google.com/search-console](https://search.google.com/search-console) | Your #1 dashboard. Shows which queries bring traffic, indexing status, errors, rich results, Core Web Vitals, backlinks, manual actions, security issues | **Weekly** |
| **Search Console Insights** | [search.google.com/search-console/insights](https://search.google.com/search-console/insights) | Simplified view of your best-performing content — combines Search Console + Analytics data in one easy dashboard | **Weekly** — quick performance snapshot |
| **URL Inspection Tool** | Inside Search Console | Shows exactly how Googlebot renders your page: screenshot, HTML, JS errors, indexing status. Click "View Tested Page" to see what Google actually sees. Can also request indexing of new/updated pages | **When debugging** — why isn't this page indexed? |
| **Coverage/Indexing Report** | Inside Search Console | Shows all pages Google has indexed or tried to index, with errors and warnings. Tells you if pages are being excluded and why | **Weekly** — catch indexing problems early |
| **Links Report** | Inside Search Console | Shows all external sites linking to you (backlinks), top linked pages, and anchor text used. Free backlink monitoring | **Monthly** — track link growth |
| **Sitemaps Report** | Inside Search Console | Submit and monitor your sitemap. Shows parsing errors, last read date, number of URLs discovered | **After sitemap changes** |
| **Manual Actions Report** | Inside Search Console | Shows if Google has penalized your site for spam, unnatural links, or other violations | **Monthly** — should always be clean |
| **Security Issues Report** | Inside Search Console | Alerts if Google detects hacking, malware, or phishing on your site | **Monthly** — should always be clean |
| **Crawl Stats Report** | Inside Search Console > Settings | Shows how often Google crawls your site, response times, and crawl errors | **Monthly** — spot server issues |
| **Robots.txt Tester** | Inside Search Console | Check if your robots.txt is blocking pages you want indexed | **After robots.txt changes** |
| **URL Removals Tool** | Inside Search Console | Urgently remove pages from Google search results (temporary, 6 months) | **Only when needed** — emergency use |
| **`site:tusalud.pro`** | Type in Google search bar | Instantly shows all pages Google has indexed for your domain. Quick visual check | **Weekly** — takes 5 seconds |

### Google Official Tools — Performance & Testing

| Tool | URL | What It Does | When to Use |
|------|-----|-------------|-------------|
| **PageSpeed Insights** | [pagespeed.web.dev](https://pagespeed.web.dev) | Tests page speed and Core Web Vitals (LCP, CLS, INP) on mobile + desktop. Uses real Chrome user data + Lighthouse. Gives specific fix suggestions | **Monthly** or after code changes |
| **Lighthouse** | Built into Chrome (F12 > Lighthouse tab) | Full local audit: Performance, Accessibility, SEO score, Best Practices. More detailed than PageSpeed Insights. Also available as CLI and Node module | **Monthly** or after major changes |
| **Core Web Vitals Report** | Inside Search Console | Real-world performance data from actual Chrome users visiting your site. Shows which pages pass/fail LCP, CLS, INP thresholds | **Monthly** — the data Google actually uses for ranking |
| **Chrome Web Vitals Extension** | [Chrome Web Store](https://chrome.google.com/webstore) (search "Web Vitals") | Real-time Core Web Vitals overlay while browsing your own site. See LCP, CLS, INP live | **During development** — instant feedback |
| **Chrome DevTools** | Built into Chrome (F12) | Network tab (see what loads), Performance tab (trace rendering), Elements tab (inspect DOM). The most powerful debugging tool | **When debugging** any performance or rendering issue |

### Google Official Tools — Structured Data & Rich Results

| Tool | URL | What It Does | When to Use |
|------|-----|-------------|-------------|
| **Rich Results Test** | [search.google.com/test/rich-results](https://search.google.com/test/rich-results) | Tests a live URL or pasted code. Shows which rich results are eligible (star ratings, FAQs, breadcrumbs). Shows errors and warnings per schema type | **After any structured data change** |
| **Rich Results Status Report** | Inside Search Console | Site-wide view of all structured data Google found across your entire site. Shows which types are valid, have warnings, or have errors | **Monthly** — ensure all profiles stay eligible |
| **Structured Data Markup Helper** | [google.com/webmasters/markup-helper](https://www.google.com/webmasters/markup-helper/) | Visual tool — point-and-click to tag elements on your page, then it generates the JSON-LD code for you | **When creating new schema types** |

### Google Official Tools — Business, Keywords & Content

| Tool | URL | What It Does | When to Use |
|------|-----|-------------|-------------|
| **Google Business Profile** | [business.google.com](https://business.google.com) | Manage your listing on Google Search and Maps. GBP Insights shows: profile views, calls, direction requests, website clicks, photo views | **Weekly** — track local visibility |
| **Google Analytics (GA4)** | [analytics.google.com](https://analytics.google.com) | Tracks user behavior after arrival: traffic sources, pages visited, bounce rate, time on page, conversions. Cross-device tracking and predictive insights | **Weekly** — understand what visitors do |
| **Google Tag Manager** | [tagmanager.google.com](https://tagmanager.google.com) | Manage tracking scripts (GA4, Ads, pixels) without editing code. Add/remove tags from a web dashboard | **During setup** — one-time, then occasional |
| **Google Trends** | [trends.google.com](https://trends.google.com) | Shows search interest over time and by region. Compare keywords: "oftalmologo guadalajara" vs "oculista guadalajara". Find seasonal patterns | **Before writing content** — pick the right keywords |
| **Google Ads Keyword Planner** | [ads.google.com](https://ads.google.com) (Tools > Keyword Planner) | Exact monthly search volume for any keyword. Requires Google Ads account (free to create, no spend needed) | **Before content planning** — validate keyword demand |
| **Google Alerts** | [google.com/alerts](https://www.google.com/alerts) | Email notifications when your brand, doctor names, or competitors are mentioned online. Set alerts for "tusalud.pro", each doctor's name, and competitor names | **Set up once** — runs automatically |
| **Google Safe Browsing Check** | [transparencyreport.google.com/safe-browsing/search](https://transparencyreport.google.com/safe-browsing/search) | Check if Google considers your site safe. If flagged, it shows a warning to users in Chrome and search results | **Monthly** — should always be clean |
| **Looker Studio** (formerly Data Studio) | [lookerstudio.google.com](https://lookerstudio.google.com) | Create custom dashboards combining Search Console + Analytics + GBP data in one visual report. Free | **Optional** — nice for monthly reporting |

### Free Tools (Third-Party)

| Tool | URL | What It Does | When to Use |
|------|-----|-------------|-------------|
| **Schema Markup Validator** | [validator.schema.org](https://validator.schema.org) | Validates JSON-LD against full schema.org specs (more thorough than Google's Rich Results Test, checks non-Google schemas too) | **After structured data changes** |
| **Ahrefs Webmaster Tools** | [ahrefs.com/webmaster-tools](https://ahrefs.com/webmaster-tools) | Free backlink monitoring (up to 100 keywords), site audit, broken links, referring domains | **Monthly** — see who links to you |
| **Ubersuggest** (free tier) | [neilpatel.com/ubersuggest](https://neilpatel.com/ubersuggest) | Keyword research, competitor analysis, content ideas. 3 free searches/day | **Before writing blog posts** |
| **AnswerThePublic** | [answerthepublic.com](https://answerthepublic.com) | Shows what questions people ask about a topic. Great for FAQ ideas | **When expanding FAQs** |
| **OpenLinkProfiler** | [openlinkprofiler.org](https://www.openlinkprofiler.org) | Free backlink analysis — see all links pointing to your domain | **Monthly** — monitor link growth |
| **BrightLocal** (free trial) | [brightlocal.com](https://www.brightlocal.com) | Local citation audit, review monitoring, local rank tracking by geographic area | **Monthly** — check citation consistency |

### Paid Tools (Worth It If Budget Allows)

| Tool | Cost | Best For |
|------|------|----------|
| **SE Ranking** | ~$40/month | Daily keyword rank tracking, competitor monitoring, site audit |
| **Semrush** | ~$120/month | Full SEO suite: keywords, backlinks, competitors, content gaps |
| **BrightLocal** | ~$30/month | Local SEO: citation management, review monitoring, local rank grids |
| **Wincher** | ~$10/month | Simple daily keyword rank tracking (100 keywords) |

---

## Weekly SEO Routine (30 min/week)

A simple routine to keep track of progress. Do this every Monday:

### 5 min — Google Search Console

1. Open Performance report (last 7 days vs previous 7 days)
2. Check: Are **impressions** growing? (= Google is showing your pages more)
3. Check: Are **clicks** growing? (= people are finding you)
4. Look at **top queries** — any new keywords appearing?
5. Check **Coverage/Indexing** — any new errors? All pages indexed?

### 5 min — Google Business Profile

1. Check each doctor's GBP Insights
2. How many **profile views** this week?
3. How many **calls**, **direction requests**, **website clicks**?
4. Any new **reviews**? Respond to all unanswered ones NOW
5. Any new **questions** in Q&A? Answer them

### 5 min — Google Analytics

1. Open Acquisition > Traffic Acquisition
2. Filter by "Organic Search"
3. Is organic traffic growing week-over-week?
4. Which pages get the most organic visits?
5. Check bounce rate on profile pages (high bounce = content not matching search intent)

### 10 min — Content & Reviews

1. Did each doctor get new reviews this week? If not, remind the clinics
2. Is there a new blog post draft to review/publish?
3. Any trending health topic relevant to a doctor's specialty? (potential blog post)
4. Check if any GBP post is due (post weekly)

### 5 min — Monthly Only (first Monday of month)

1. Run PageSpeed Insights on all 3 profile URLs — any regressions?
2. Run Rich Results Test on all 3 profile URLs — still passing?
3. Check Ahrefs Webmaster Tools — any new backlinks? Any lost?
4. Review keyword position trends — moving up, down, or flat?
5. Update the tracking spreadsheet (see below)

---

## Tracking Spreadsheet Template

Create a simple Google Sheet to track progress over time:

| Date | Doctor | Google Reviews (total) | New Reviews (this month) | GBP Views (month) | GBP Clicks (month) | Organic Impressions (GSC) | Organic Clicks (GSC) | Avg Position "specialty+city" | Blog Posts Published (total) | Backlinks (total) |
|------|--------|----------------------|--------------------------|-------------------|--------------------|--------------------------|--------------------|------------------------------|-----------------------------|--------------------|
| 2026-04-28 | Dr. Jose | 0 | 0 | — | — | — | — | — | 0 | — |
| 2026-04-28 | Dra. Patricia | 7 | 0 | — | — | — | — | — | 0 | — |
| 2026-04-28 | Dra. Adriana | 17 | 0 | — | — | — | — | — | 0 | — |

Fill in the "—" fields once Google Search Console and GBP are set up. Update monthly.

**What to look for:**
- Reviews growing by 5+/month per doctor
- Organic impressions trending up month-over-month
- Average position for target keywords dropping below 10 (= page 1)
- GBP views and clicks growing
- Blog post count growing (target: 2-4/month/doctor)

---

## Sources

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Helpful Content Guidelines](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [LocalBusiness Structured Data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Google Search Console Setup](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Google Business Profile Guidelines](https://support.google.com/business/answer/3038177)
- [Google Business Profile for Healthcare](https://support.google.com/business/answer/9798848)
- [Local SEO for Doctors — LocalMighty](https://www.localmighty.com/blog/local-seo-for-doctors/)
