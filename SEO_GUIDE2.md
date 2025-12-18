
# SEO Systems Guide: The Google Crawl-Index-Rank Pipeline

**Purpose:** Deep, systematic explanation of how Google actually interacts with modern web applications. This complements SEO_GUIDE.md by focusing on the foundational infrastructure (stages 1-6) rather than content optimization (stages 7-9).

**Mental Model:** Think of Google as a pipeline. If you fail early stages, later stages don't matter.

```
ACCESS → DISCOVER → RENDER → UNDERSTAND → INDEX → RANK
```

---

## Stage 1: CRAWLABILITY
**Question Google asks:** "Am I allowed to access this page?"

This is the absolute gatekeeper. If the answer is no, Google stops forever.

### 1.1 robots.txt
This file is the **first thing** Google reads.

**Location:** `https://yourdomain.com/robots.txt`

#### ❌ BLOCKS ALL CRAWLING:
```
User-agent: *
Disallow: /
```

**Extremely common in:**
- New projects
- Staging environments
- Railway / Vercel / Netlify apps (accidental)

#### ✅ ALLOWS CRAWLING:
```
User-agent: *
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml
```

**⚠️ Critical Rule:** robots.txt overrides everything else. Even if the page is perfect, blocked robots = invisible site.

### 1.2 HTTP Status Codes
When Google requests `/doctors/dr-jose`, it expects `200 OK`.

#### Common Silent Killers:
- `302` - Temporary redirect (tells Google "don't index this")
- `401 / 403` - Auth middleware blocking public pages
- `404` on hard refresh - SPA routing bug (works via navigation, fails on direct access)

**Test:** Direct URL access must return 200, not just client-side navigation.

---

## Stage 2: DISCOVERABILITY
**Question Google asks:** "How do I even find this page?"

**Critical truth:** Google does NOT know your URLs exist unless you tell it.

### How Google Discovers URLs (ONLY 3 Ways)

#### 1️⃣ Internal Links (Primary)
Google follows HTML `<a>` tags:

**✅ Crawlable:**
```html
<a href="/doctors/dr-jose">Dr. José Cruz</a>
```

**❌ NOT Crawlable:**
```jsx
<button onClick={() => router.push('/doctors/dr-jose')}>
  Dr. José Cruz
</button>
```

Google does NOT "click" buttons like humans. It only reads `href` attributes.

#### 2️⃣ XML Sitemap
A sitemap is a direct declaration: "These URLs exist and are important."

**Location:** `/sitemap.xml`

**Example entry:**
```xml
<url>
  <loc>https://domain.com/doctors/dr-jose</loc>
  <lastmod>2024-12-17</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
```

**⚠️ Important:** This does NOT guarantee ranking, but without it, discovery can take months.

#### 3️⃣ External Links
- Backlinks from other sites
- Social media mentions
- Directory listings

**Reality:** Early projects usually have none, so you must rely on:
1. Internal links
2. Sitemap

---

## Stage 3: RENDERABILITY
**Question Google asks:** "Can I actually see the content?"

**Critical for:** React / SPA / Next.js apps

### What Google Does
Google has **two passes:**
1. **HTML fetch** (fast) - Downloads initial HTML
2. **JS rendering** (slow, deferred) - Executes JavaScript

If content is missing in step 1, Google may:
- Delay indexing
- Misinterpret content
- Drop the page temporarily

### ✅ Good Renderability (Server-Side Rendered)
Server sends complete HTML:
```html
<h1>Dr. José Cruz Ruiz</h1>
<h2>Cirujano Oftalmólogo</h2>
<p>Especialista en cirugía refractiva...</p>
```

Google understands immediately.

### ❌ Bad Renderability (Client-Only)
Server sends empty shell:
```html
<div id="root"></div>
```

Content appears only after JS runs.

**🚨 Risks for new sites:**
- Google queues JS rendering for later
- Pages look "empty" initially
- Indexing gets deprioritized

**⚠️ This does NOT mean SPA is bad** — it means SSR or pre-rendering is critical for initial exposure.

---

## Stage 4: SEMANTIC UNDERSTANDING
**Question Google asks:** "What is this page about?"

Once Google sees content, it builds a **topic model**.

**Important shift:** Google is NOT keyword-based anymore — it's **entity-based**.

### What Google Looks For Structurally

#### Clear Primary Entity
"This page is about ONE doctor."

**Signals:**
- One main name (H1)
- One specialty (H2)
- One location

#### Hierarchy
Google reads structure like an outline:
```
Dr. María López (H1)
 ├─ Dermatología (H2)
 ├─ Servicios (H2)
 │   ├─ Consulta general (H3)
 │   └─ Botox facial (H3)
 ├─ Condiciones tratadas (H2)
 ├─ Educación (H2)
 └─ Ubicación (H2)
```

If everything is flat or hidden behind tabs/accordions: semantic clarity is reduced.

### What Weakens Semantic Clarity
- Content loaded only after clicks
- Same headings reused across all doctors
- Generic text blocks with no differentiation

**Rule:** Structure matters more than word choice at this stage.

---

## Stage 5: INDEXING
**Question Google asks:** "Is this worth storing in our index?"

Even if Google:
- ✅ Can crawl
- ✅ Can render
- ✅ Understands the page

It may still say: **"Not yet."**

### Why Google Delays Indexing New Pages
**This is normal, not a failure.**

**Reasons:**
- New domain
- No backlinks
- Low crawl budget
- No traffic signals
- No internal authority flow

**Google prioritizes trusted sites first.** This is why early SEO feels "ignored."

### Important Mindset Shift
- ❌ "Google is not indexing me"
- ✅ "Google hasn't assigned priority yet"

**Once basics are correct, indexing follows naturally.**

---

## Stage 6: INTERNAL AUTHORITY FLOW
**Question Google asks:** "How important is this page inside your site?"

Google evaluates:
- How many internal links point to it
- From where (homepage > category > deep page)
- Anchor text used

### Example: High Internal Authority
A doctor page linked from:
- Homepage (featured doctors)
- `/doctors` listing
- Services pages
- Specialties pages

= High internal importance

### Example: Low Internal Authority
An orphan page with:
- No incoming links
- Only accessible via direct URL
- Not in sitemap

= Low priority, even if content is perfect

---

## Stage 7: EXPOSURE vs OPTIMIZATION
**This is the key distinction.**

### Exposure Phase (What New Sites Should Focus On)
**Focus on stages 1-6:**
- ✅ Crawlability (robots.txt, status codes)
- ✅ Discoverability (sitemap, internal links)
- ✅ Renderability (SSR/SSG)
- ✅ Indexing signals (structure, authority flow)

**Ignore for now:**
- Image alt text optimization
- URL prettiness
- Micro keywords
- Meta description perfection

### Optimization Phase (Later)
**Only AFTER:**
- Pages are indexed
- Structure is stable
- Google recognizes entities

**Then optimize:**
- URLs
- Titles
- Copy quality
- Media performance
- Conversion elements

**⚠️ Critical mistake:** Doing optimization before exposure = wasted effort.

---

## The 9-Stage Mental Model

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: CRAWLABILITY                                      │
│  ├─ robots.txt allows access                                │
│  └─ URLs return 200 OK                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  STAGE 2: DISCOVERABILITY                                   │
│  ├─ Internal links exist                                    │
│  ├─ Sitemap declares URLs                                   │
│  └─ External links (if any)                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  STAGE 3: RENDERABILITY                                     │
│  ├─ HTML contains content (not just <div id="root">)        │
│  └─ SSR or SSG for critical pages                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  STAGE 4: SEMANTIC UNDERSTANDING                            │
│  ├─ Clear entity (one doctor, one page)                     │
│  ├─ Proper heading hierarchy                                │
│  └─ Structured content (not hidden/generic)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  STAGE 5: INDEXING                                          │
│  ├─ Google assigns crawl budget                             │
│  ├─ Page stored in index                                    │
│  └─ (May take time for new domains)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  STAGE 6: INTERNAL AUTHORITY FLOW                           │
│  ├─ Links from homepage/important pages                     │
│  ├─ Descriptive anchor text                                 │
│  └─ Not an orphan page                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  STAGE 7-9: OPTIMIZATION & RANKING                          │
│  ├─ Keyword optimization                                    │
│  ├─ Performance tuning                                      │
│  ├─ User experience                                         │
│  └─ Conversion optimization                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Principles

### 1. Pipeline Thinking
If one stage fails, all later stages are irrelevant.

**Example:**
- Perfect content + blocked robots.txt = **zero traffic**
- Perfect content + no sitemap + new domain = **months to index**
- Perfect content + client-only rendering = **delayed indexing**

### 2. Most Projects Fail Because They:
- ❌ Optimize too early
- ❌ Ignore crawl mechanics
- ❌ Rely on JS-only navigation
- ❌ Assume Google "figures it out"

### 3. Correct Sequence
```
1. Ensure crawlability (robots.txt, status codes)
2. Ensure discoverability (sitemap, links)
3. Ensure renderability (SSR/SSG)
4. Build semantic structure (headings, entities)
5. Wait for indexing (normal for new sites)
6. Build internal authority (link architecture)
7. THEN optimize content/media/performance
```

---

## Next Steps for Implementation

### For New Projects (Exposure Phase)
**Priority order:**

1. **Crawlability audit**
   - Check robots.txt
   - Test direct URL access (200 OK)
   - Verify no auth blocking public pages

2. **Discoverability setup**
   - Generate XML sitemap
   - Submit to Google Search Console
   - Build internal link architecture

3. **Renderability verification**
   - View page source (not DevTools)
   - Confirm content in initial HTML
   - Use Next.js SSR/SSG for doctor pages

4. **Structure implementation**
   - Follow SEO_GUIDE.md hierarchy rules
   - One H1 per page
   - Clear entity definition

5. **Authority flow design**
   - Homepage → Doctors listing → Individual doctors
   - Service pages → Related doctors
   - Specialty pages → Doctors in that specialty

### For Established Projects (Optimization Phase)
**Only after stages 1-6 are complete:**

1. Content quality improvements
2. Media optimization
3. URL refinement
4. Conversion optimization
5. Performance tuning

---

## Relationship to SEO_GUIDE.md

**SEO_GUIDE.md** (content-focused) covers:
- Page structure (Stage 4: Semantic Understanding)
- Schema.org markup (Stage 4-7: Understanding + Optimization)
- Content quality (Stage 7-9: Optimization)
- Performance guidelines (Stage 7-9: Optimization)

**SEO_GUIDE2.md** (infrastructure-focused) covers:
- Crawl accessibility (Stage 1: Crawlability)
- URL discovery (Stage 2: Discoverability)
- Server rendering (Stage 3: Renderability)
- Indexing mechanics (Stage 5: Indexing)
- Link architecture (Stage 6: Internal Authority)

**Both are required.** Infrastructure without good content = indexed but low-ranking. Good content without infrastructure = invisible.

---

## Testing Your Implementation

### Stage 1: Crawlability
```bash
# Check robots.txt
curl https://yourdomain.com/robots.txt

# Expected:
User-agent: *
Allow: /

# Check status code
curl -I https://yourdomain.com/doctors/dr-jose

# Expected:
HTTP/1.1 200 OK
```

### Stage 2: Discoverability
```bash
# Check sitemap exists
curl https://yourdomain.com/sitemap.xml

# Verify internal links
curl https://yourdomain.com/ | grep -o 'href="/doctors/[^"]*"'
```

### Stage 3: Renderability
```bash
# View source (not DevTools)
curl https://yourdomain.com/doctors/dr-jose | grep "<h1>"

# Should see actual content, not just <div id="root">
```

### Stage 4: Semantic Understanding
- View source manually
- Confirm heading hierarchy (one H1, proper H2/H3 structure)
- Check schema.org JSON-LD present

### Stage 5-6: Indexing & Authority
- Google Search Console (wait 2-4 weeks for new domains)
- Check internal link graph
- Verify anchor text diversity

---

## Common Mistakes to Avoid

### 1. Fixing Stage 7 Problems at Stage 3
**Wrong approach:** "My images need better alt text"
**Right approach:** "Are my pages even being crawled?"

### 2. Assuming JS Navigation = SEO Links
**Wrong:**
```jsx
<div onClick={() => router.push('/doctors/123')}>Dr. Smith</div>
```

**Right:**
```jsx
<Link href="/doctors/123">Dr. Smith</Link>
```

### 3. Optimizing Before Indexing
**Wrong sequence:**
1. Write perfect meta descriptions
2. Optimize images
3. Wait... why am I not ranking?

**Right sequence:**
1. Ensure crawlability
2. Build discoverability
3. Confirm renderability
4. Wait for indexing
5. THEN optimize

### 4. Client-Only Rendering for New Sites
**Risk:** Google may delay indexing for weeks/months.
**Solution:** Use SSR or SSG for critical pages (doctor profiles, services).

---

## Conclusion

**SEO is not magic — it's a pipeline.**

If you want:
- Fast indexing → Optimize stages 1-3 first
- Good rankings → Stages 1-6 must work, then optimize 7-9
- Long-term success → Maintain all stages continuously

**Remember:** You can't rank for content Google hasn't indexed. You can't index pages Google can't find. You can't find pages Google can't crawl.

**Start at Stage 1. Work sequentially. Don't skip stages.**
