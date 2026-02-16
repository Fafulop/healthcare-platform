# Google Analytics 4 vs Google Search Console — Complete Guide

## Table of Contents

1. [What Is Google Analytics 4 (GA4)?](#1-what-is-google-analytics-4-ga4)
2. [What Is Google Search Console (GSC)?](#2-what-is-google-search-console-gsc)
3. [Key Differences](#3-key-differences)
4. [Key Similarities](#4-key-similarities)
5. [How They Work Together](#5-how-they-work-together)
6. [GA4 Deep Dive](#6-ga4-deep-dive)
7. [Search Console Deep Dive](#7-search-console-deep-dive)
8. [Setup Guide — GA4](#8-setup-guide--ga4)
9. [Setup Guide — Search Console](#9-setup-guide--search-console)
10. [Linking GA4 and Search Console](#10-linking-ga4-and-search-console)
11. [How This Applies to tusalud.pro](#11-how-this-applies-to-tusaludpro)
12. [Common Questions](#12-common-questions)

---

## 1. What Is Google Analytics 4 (GA4)?

Google Analytics 4 is a **user behavior tracking tool**. It tells you what happens **after** someone arrives at your website.

Think of it as a security camera inside your store — it watches what people do once they walk in.

### What GA4 answers:

- **How many people** visited your site today/this week/this month?
- **Where did they come from?** (Google search, social media, direct link, ads)
- **Which pages** did they visit?
- **How long** did they stay?
- **What did they do?** (clicked a button, filled a form, booked an appointment)
- **What device/browser** are they using?
- **Where are they located?** (country, city)
- **Did they convert?** (complete a goal you defined, like booking an appointment)

### What GA4 does NOT tell you:

- What Google search queries led people to your site (Search Console does this)
- How your pages rank in Google search results
- Whether Google can properly crawl and index your pages
- Technical SEO problems on your site

### Core concepts in GA4:

| Concept | What it means |
|---------|---------------|
| **Property** | A container for all analytics data for one website/app. You have one property for tusalud.pro |
| **Data Stream** | The connection between your website and the GA4 property. Web stream = your website |
| **Measurement ID** | The unique identifier (G-XXXXXXXXXX) that connects your site's gtag.js to your GA4 property |
| **Event** | Any user interaction. GA4 is 100% event-based. A pageview is an event. A button click is an event. Everything is an event |
| **Parameter** | Extra data attached to an event. e.g., `profile_view` event has parameters: `doctor_slug`, `doctor_name`, `specialty` |
| **Conversion** | An event you mark as important. e.g., `booking_complete` is a conversion |
| **User** | A unique visitor. GA4 tracks users across sessions using cookies |
| **Session** | A single visit. Starts when user arrives, ends after 30 minutes of inactivity |
| **Dimension** | A descriptive attribute. e.g., "City", "Device category", "Page path" |
| **Metric** | A quantitative measurement. e.g., "Users", "Sessions", "Event count" |

---

## 2. What Is Google Search Console (GSC)?

Google Search Console is a **search performance and technical SEO tool**. It tells you what happens **before** someone arrives at your website — specifically, how your site appears and performs in Google Search.

Think of it as your relationship manager with Google's search engine — it tells you how Google sees your site, what queries trigger your pages, and whether there are any problems.

### What Search Console answers:

- **What search queries** cause your site to appear in Google results?
- **How many times** did your site appear in search results (impressions)?
- **How many times** did people click through to your site from search results?
- **What is your average position** in search results for each query?
- **What is your click-through rate (CTR)** for each query?
- **Can Google crawl** all your pages properly?
- **Are there any errors** preventing your pages from being indexed?
- **Is your site mobile-friendly?**
- **Are there any security issues** on your site?
- **Which other sites link to you** (backlinks)?

### What Search Console does NOT tell you:

- What users do after they land on your site (GA4 does this)
- How long users stay on your pages
- Whether users convert (book appointments, click buttons)
- Traffic from non-Google sources (social media, direct, ads)

### Core concepts in Search Console:

| Concept | What it means |
|---------|---------------|
| **Property** | Your website. Can be a domain property (all subdomains) or URL-prefix property (specific URL pattern) |
| **Impression** | Your page appeared in someone's Google search results (they may or may not have clicked) |
| **Click** | Someone clicked your link in Google search results and landed on your site |
| **CTR (Click-Through Rate)** | Clicks ÷ Impressions × 100. Higher is better. Tells you how compelling your search result listing is |
| **Average Position** | Where your page ranks in search results for a given query. Position 1 = top of page 1. Position 11 = top of page 2 |
| **Query** | The actual words someone typed into Google that triggered your page to appear |
| **Indexed Page** | A page that Google has crawled, processed, and added to its search index |
| **Crawl** | When Google's bot visits your page to read its content |
| **Sitemap** | An XML file listing all the pages on your site, helping Google discover them |
| **Coverage / Indexing** | A report showing which pages are indexed, which have errors, and which are excluded |
| **Core Web Vitals** | Performance metrics (loading speed, interactivity, visual stability) that affect rankings |

---

## 3. Key Differences

| Aspect | Google Analytics 4 | Google Search Console |
|--------|-------------------|----------------------|
| **Primary purpose** | Track user behavior ON your site | Track search performance and technical SEO |
| **Data source** | JavaScript tracking code (gtag.js) on your pages | Google's own search index and crawl data |
| **When it starts** | After the user lands on your site | Before the user lands on your site (in search results) |
| **Traffic sources** | ALL sources (search, social, ads, direct, referral) | ONLY Google Search |
| **Requires code on site?** | Yes — gtag.js must be installed | No — Google collects data from its own search engine |
| **Real-time data?** | Yes — real-time reports available | No — data is delayed 2-3 days |
| **User identity** | Tracks individual user journeys (anonymous) | No user tracking — only aggregate query data |
| **Historical data** | Keeps data for 14 months (default) or 50 months | Keeps data for 16 months |
| **Technical health** | No — doesn't monitor site health | Yes — crawl errors, indexing issues, mobile usability |
| **Conversion tracking** | Yes — define and track goals/conversions | No — only knows about clicks from search results |
| **Cost** | Free | Free |
| **Who uses it** | Marketing teams, product teams, business owners | SEO specialists, developers, webmasters |

---

## 4. Key Similarities

Despite their differences, GA4 and Search Console share important common ground:

1. **Both are free** — No paid tier needed for either tool
2. **Both are from Google** — Same Google account can manage both
3. **Both track tusalud.pro** — Both are configured per-website
4. **Both help measure growth** — GA4 measures engagement growth, GSC measures search visibility growth
5. **Both have reporting interfaces** — Web dashboards with charts, tables, filters
6. **Both have APIs** — GA4 Data API and Search Console API for building custom dashboards
7. **Both can be linked** — When linked, GSC search query data appears inside GA4 reports
8. **Both require a Google account** — Managed under the same platform account
9. **Both are property-based** — You create a "property" for your website in each tool
10. **Both are essential** — You need BOTH to have complete visibility into your site's performance

---

## 5. How They Work Together

Here's the complete user journey and which tool covers which part:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THE USER JOURNEY                                 │
│                                                                         │
│  ┌──────────────────────────────────────────────┐                       │
│  │         GOOGLE SEARCH CONSOLE                 │                       │
│  │         covers this part                      │                       │
│  │                                               │                       │
│  │  User types "dermatologo en monterrey"        │                       │
│  │           ↓                                   │                       │
│  │  Google shows search results                  │                       │
│  │  Your page appears at position 3              │  ← IMPRESSION         │
│  │           ↓                                   │                       │
│  │  User clicks your result                      │  ← CLICK              │
│  │           ↓                                   │                       │
│  └───────────┬──────────────────────────────────┘                       │
│              │                                                           │
│              │  User lands on tusalud.pro/doctores/dra-maria-garcia     │
│              │                                                           │
│  ┌───────────▼──────────────────────────────────┐                       │
│  │         GOOGLE ANALYTICS 4                    │                       │
│  │         covers this part                      │                       │
│  │                                               │                       │
│  │  Page loads → profile_view event              │  ← PAGEVIEW           │
│  │           ↓                                   │                       │
│  │  User reads the profile                       │  ← ENGAGEMENT         │
│  │           ↓                                   │                       │
│  │  User clicks "Enviar Mensaje"                 │  ← contact_click      │
│  │           ↓                                   │                       │
│  │  User clicks "Agendar Cita"                   │  ← appointment_click  │
│  │           ↓                                   │                       │
│  │  User completes booking                       │  ← booking_complete   │
│  │                                               │  ← CONVERSION         │
│  └──────────────────────────────────────────────┘                       │
│                                                                         │
│  ┌──────────────────────────────────────────────┐                       │
│  │         LINKED TOGETHER                       │                       │
│  │                                               │                       │
│  │  You can see:                                 │                       │
│  │  "dermatologo en monterrey" → 50 impressions  │                       │
│  │  → 15 clicks → 3 appointment bookings         │                       │
│  │                                               │                       │
│  │  FULL FUNNEL: Query → Click → Visit → Convert │                       │
│  └──────────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### When linked, you get the complete picture:

| Metric | Source | Example |
|--------|--------|---------|
| Search query | GSC | "dermatologo en monterrey" |
| Impressions | GSC | 500 times shown in search |
| Clicks | GSC | 50 people clicked through |
| Average position | GSC | Position 4.2 |
| CTR | GSC | 10% |
| Sessions on page | GA4 | 50 sessions |
| Avg. engagement time | GA4 | 2 min 30 sec |
| Contact clicks | GA4 | 15 WhatsApp clicks |
| Bookings | GA4 | 3 completed bookings |

Without linking, you'd have two separate dashboards with no way to connect "which search queries lead to actual bookings."

---

## 6. GA4 Deep Dive

### Event-Based Model

GA4 is fundamentally different from older analytics tools. Everything is an **event**. There are three categories:

#### Automatically Collected Events (no code needed)
These fire automatically when gtag.js is installed:

| Event | What it tracks |
|-------|----------------|
| `page_view` | Every page load and SPA navigation |
| `first_visit` | First time a user visits the site |
| `session_start` | Beginning of a new session |
| `user_engagement` | User is actively engaged on the page |
| `scroll` | User scrolls to 90% of the page |
| `click` | Outbound link clicks (links leaving your site) |
| `file_download` | File download clicks |
| `view_search_results` | Site search usage |

#### Enhanced Measurement Events (toggle in GA4 settings)
Enabled in GA4 Admin → Data Streams → your stream → Enhanced measurement:

| Event | What it tracks |
|-------|----------------|
| `scroll` | Scroll depth (90%) |
| `outbound_click` | Clicks to external sites |
| `site_search` | Internal search usage |
| `video_start` | Embedded video play start |
| `video_progress` | Video watched 10%, 25%, 50%, 75% |
| `video_complete` | Video watched to end |
| `form_start` | User starts filling a form |
| `form_submit` | User submits a form |

#### Custom Events (your code)
These are the events we implemented for tusalud.pro:

| Event | When | Key parameters |
|-------|------|----------------|
| `profile_view` | Doctor profile loads | `doctor_slug`, `doctor_name`, `specialty` |
| `contact_click` | WhatsApp button clicked | `doctor_slug`, `contact_method`, `click_location` |
| `appointment_click` | "Agendar Cita" clicked | `doctor_slug`, `click_location` |
| `slot_selected` | Time slot picked | `doctor_slug`, `slot_date`, `slot_time`, `price` |
| `booking_complete` | Booking confirmed | `doctor_slug`, `slot_date`, `value`, `currency` |
| `blog_view` | Blog article loads | `doctor_slug`, `article_slug`, `article_title` |
| `map_click` | Google Maps link clicked | `doctor_slug`, `click_location` |
| `doctor_card_click` | Doctor card on listing clicked | `doctor_slug`, `doctor_name`, `list_position` |

### Key Reports in GA4

| Report | What it shows | Where to find it |
|--------|--------------|------------------|
| **Realtime** | Live users on your site right now | Reports → Realtime |
| **Acquisition** | How users found your site (search, social, direct, ads) | Reports → Acquisition |
| **Engagement** | Pages viewed, events triggered, time spent | Reports → Engagement |
| **Retention** | How many users come back | Reports → Retention |
| **Demographics** | User age, gender, location, language | Reports → Demographics |
| **Tech** | Browsers, devices, screen sizes | Reports → Tech |
| **Conversions** | Goal completions (bookings, contacts) | Reports → Engagement → Conversions |
| **Explorations** | Custom reports you build with drag-and-drop | Explore tab |

### GA4 Data Retention

- **Default:** 2 months (change this!)
- **Maximum:** 14 months
- **How to change:** Admin → Data Settings → Data Retention → set to 14 months
- **Note:** Aggregated reports are not affected. Only user-level exploration data is deleted after the retention period.

---

## 7. Search Console Deep Dive

### Key Reports in Search Console

#### Performance Report
The most important report. Shows:

- **Queries:** What people searched to find your site
- **Pages:** Which of your pages appeared in search results
- **Countries:** Where searchers are located
- **Devices:** Desktop, mobile, tablet
- **Search appearance:** How your result looked (rich result, FAQ, etc.)

Each can be filtered and combined. For example: "Show me all queries that led to clicks on `/doctores/dra-maria-garcia` from mobile users in Mexico."

Metrics available:
| Metric | Meaning | Good values |
|--------|---------|-------------|
| **Impressions** | Times your page appeared in search results | Higher = more visibility |
| **Clicks** | Times someone clicked your result | Higher = more traffic |
| **CTR** | Clicks ÷ Impressions | 3-5% average, 10%+ is great |
| **Position** | Average ranking position | 1-3 is top of page 1, 4-10 is rest of page 1 |

#### Indexing Report (Coverage)
Shows the status of every URL Google knows about:

| Status | Meaning | Action |
|--------|---------|--------|
| **Valid** | Page is indexed and can appear in search | None needed |
| **Valid with warnings** | Indexed but has minor issues | Review warnings |
| **Excluded** | Not indexed (intentionally or by error) | Check why — might be noindex, duplicate, or crawl issue |
| **Error** | Google tried to index but failed | Fix immediately — these pages won't appear in search |

#### Sitemaps Report
Shows submitted sitemaps and their status:

| Status | Meaning |
|--------|---------|
| **Success** | Sitemap was read and processed |
| **Has errors** | Sitemap has format issues |
| **Couldn't fetch** | Google couldn't reach the sitemap URL |

#### Core Web Vitals
Performance metrics that affect search rankings:

| Metric | What it measures | Good threshold |
|--------|-----------------|----------------|
| **LCP (Largest Contentful Paint)** | How fast the main content loads | < 2.5 seconds |
| **INP (Interaction to Next Paint)** | How fast the page responds to clicks | < 200 milliseconds |
| **CLS (Cumulative Layout Shift)** | How much the layout jumps around | < 0.1 |

#### Links Report
Shows:
- **External links:** Other websites linking to your pages (backlinks)
- **Internal links:** How your own pages link to each other
- **Top linking sites:** Which domains link to you most

### Search Console Data Characteristics

- **Data delay:** 2-3 days. Today's data won't appear until day after tomorrow.
- **Data retention:** 16 months of search performance data
- **Sampling:** Data may be sampled for very high-traffic sites (unlikely for most sites)
- **Google only:** Only tracks Google Search. Bing, Yahoo, DuckDuckGo traffic is not included.
- **Position accuracy:** Average position can be misleading — it averages across all impressions, including low-ranking ones.

---

## 8. Setup Guide — GA4

### Step 1: Create GA4 Property

1. Go to [analytics.google.com](https://analytics.google.com)
2. Sign in with your platform Google account
3. Click **Admin** (gear icon, bottom-left)
4. Click **Create** → **Property**
5. Property name: `tusalud.pro`
6. Reporting time zone: `Mexico` (or your timezone)
7. Currency: `Mexican Peso (MXN)`
8. Click **Next**
9. Business details: choose any industry/size (doesn't affect data)
10. Business objectives: select what applies
11. Click **Create**

### Step 2: Create Web Data Stream

1. After creating the property, choose platform: **Web**
2. Website URL: `tusalud.pro`
3. Stream name: `tusalud.pro`
4. Click **Create stream**
5. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

### Step 3: Install on Website

The Measurement ID goes into your environment variable:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-PM03GGVRZS"
```

The gtag.js code is already installed in `apps/public/src/app/layout.tsx`. It loads:
- The gtag.js script from Google
- Initializes with your Measurement ID
- Tracks pageviews automatically
- Tracks custom events via `lib/analytics.ts`

### Step 4: Configure GA4 Settings

After installation, go to GA4 Admin and configure:

1. **Data Retention:** Admin → Data Settings → Data Retention → set to **14 months**
2. **Enhanced Measurement:** Admin → Data Streams → click your stream → toggle on all enhanced measurement options
3. **Conversions:** Admin → Conversions → Mark `booking_complete` and `contact_click` as conversions (these events will appear after the first time they fire)
4. **Custom Dimensions:** Admin → Custom Definitions → Create custom dimensions for:
   - `doctor_slug` (event-scoped)
   - `doctor_name` (event-scoped)
   - `specialty` (event-scoped)
   - `contact_method` (event-scoped)
   - `click_location` (event-scoped)
   - `article_slug` (event-scoped)

### Step 5: Verify It Works

1. Deploy the site with the Measurement ID set
2. Open your site in a browser
3. Go to GA4 → **Realtime** report
4. You should see yourself as an active user
5. Navigate to a doctor profile — you should see the `profile_view` event
6. Click a WhatsApp button — you should see the `contact_click` event

---

## 9. Setup Guide — Search Console

### Step 1: Add Property

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Click **Add Property**
3. Choose **URL prefix**
4. Enter: `https://tusalud.pro`
5. Click **Continue**

### Step 2: Verify Ownership

Search Console needs to verify you own the site. Methods available:

| Method | How it works | Best for |
|--------|-------------|----------|
| **HTML tag** | Add a `<meta>` tag to your homepage `<head>` | Developers (recommended) |
| **HTML file** | Upload a verification file to your site root | Static hosting |
| **Google Analytics** | Auto-verifies if GA4 is already installed | Easiest if GA4 is set up first |
| **Google Tag Manager** | Auto-verifies if GTM is installed | GTM users |
| **DNS record** | Add a TXT record to your domain's DNS | Domain-level verification |

If GA4 is already installed on your site (which it is for tusalud.pro), verification may happen automatically.

### Step 3: Submit Sitemap

1. In Search Console, click **Sitemaps** in the left sidebar
2. In the "Add a new sitemap" field, enter: `sitemap.xml`
3. Click **Submit**
4. Status will show "Pending" then change to "Success"

Your sitemap is auto-generated by Next.js at `https://tusalud.pro/sitemap.xml` and includes:
- Homepage
- Doctors listing page
- All individual doctor profiles
- All blog listing pages
- All individual blog articles

### Step 4: Wait for Data

- **Indexing:** Google will start crawling your pages within hours to days
- **Search data:** Performance data takes 2-3 days to appear
- **Full data:** Expect meaningful data after 1-2 weeks of the site being live

### Step 5: Monitor Regularly

Check these weekly:
- **Performance → Search results:** See which queries drive traffic
- **Indexing → Pages:** Make sure all important pages are indexed
- **Experience → Core Web Vitals:** Monitor page speed
- **Sitemaps:** Make sure sitemap status is "Success"

---

## 10. Linking GA4 and Search Console

### Why Link Them?

Without linking:
- GA4 shows: "50 people visited this page"
- GSC shows: "This page got 50 clicks from search query X"
- But you can't see them together

With linking:
- GA4 shows: "50 people visited this page, 30 came from Google Search, the top queries were X, Y, Z, and 5 of them booked appointments"
- Full funnel visibility in one place

### How to Link

1. Go to [analytics.google.com](https://analytics.google.com)
2. Click **Admin** (gear icon)
3. Under your property column, find **Product links**
4. Click **Search Console links**
5. Click **Link**
6. Click **Choose accounts** → select your `https://tusalud.pro/` Search Console property
7. Click **Confirm**
8. Click **Next**
9. Select your web data stream (`tusalud.pro`)
10. Click **Next** → **Submit**

### What You Get After Linking

A new section appears in GA4 under Reports → **Search Console**:

| Report | What it shows |
|--------|---------------|
| **Queries** | Google search queries with impressions, clicks, CTR, position — linked to GA4 engagement data |
| **Google organic search traffic** | Landing pages from Google search with both GSC metrics (clicks, impressions) and GA4 metrics (engagement, conversions) |

### Important Notes

- Linking is **one-to-one**: one GA4 property links to one GSC property
- Data appears in GA4 with a **2-3 day delay** (GSC data delay)
- Only **Google organic search** data is shared — not Google Ads or other search engines
- The link can be removed at any time without affecting either tool's data

---

## 11. How This Applies to tusalud.pro

### Current Setup (Completed)

| Tool | Status | ID |
|------|--------|-----|
| GA4 | Installed and tracking | `G-PM03GGVRZS` |
| Search Console | Property created and verified | `https://tusalud.pro/` |
| GA4 ↔ GSC Link | Connected | URL-prefix property |
| Sitemap | Submitted | `https://tusalud.pro/sitemap.xml` |

### Per-Doctor Analytics Model

Because tusalud.pro is a multi-tenant platform (many doctors, one domain), we use `doctor_slug` as the key parameter on every event:

```
GA4 Event: profile_view
├── doctor_slug: "dra-maria-garcia"
├── doctor_name: "Dra. María García"
└── specialty: "Dermatología"

GA4 Event: contact_click
├── doctor_slug: "dra-maria-garcia"
├── contact_method: "whatsapp"
└── click_location: "hero"

GA4 Event: booking_complete
├── doctor_slug: "dra-maria-garcia"
├── slot_date: "2026-02-20"
├── value: 800
└── currency: "MXN"
```

This means:
- **Admin dashboard** can query GA4 Data API filtered by any `doctor_slug` to show analytics for a specific doctor, or unfiltered to show platform-wide stats
- **Doctor dashboard** queries only their own `doctor_slug` — they never see another doctor's data
- **Search Console** data is per-page, so `/doctores/dra-maria-garcia` queries are naturally per-doctor

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     DATA COLLECTION                               │
│                                                                   │
│  User visits tusalud.pro/doctores/dra-maria-garcia               │
│       │                                                           │
│       ├──→ gtag.js fires page_view + profile_view                │
│       │         │                                                 │
│       │         └──→ Sent to GA4 (G-PM03GGVRZS)                 │
│       │                                                           │
│       ├──→ User clicks WhatsApp → contact_click event            │
│       │         │                                                 │
│       │         └──→ Sent to GA4 + Google Ads conversion         │
│       │                                                           │
│       └──→ User books appointment → booking_complete event       │
│                 │                                                 │
│                 └──→ Sent to GA4 + Google Ads conversion         │
│                                                                   │
│  Meanwhile, Google's crawler indexes the page                    │
│       │                                                           │
│       └──→ Search Console tracks impressions, clicks, position   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     DATA CONSUMPTION                              │
│                                                                   │
│  Admin App (apps/admin)                                          │
│  ├── GA4 Data API → all doctors' events, conversions, traffic    │
│  ├── Search Console API → all pages' search performance          │
│  └── Google Ads API → all campaigns' spend and conversions       │
│                                                                   │
│  Doctor App (apps/doctor)                                        │
│  ├── GA4 Data API → filtered by doctor_slug                     │
│  ├── Search Console API → filtered by page URL                  │
│  └── Google Ads API → filtered by doctor's ad account            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### What to Configure Next in GA4

After events start flowing (once the site is deployed with the Measurement ID):

1. **Mark conversions:** GA4 → Admin → Conversions → mark `booking_complete` and `contact_click`
2. **Create custom dimensions:** GA4 → Admin → Custom Definitions → add `doctor_slug`, `contact_method`, etc.
3. **Set data retention:** GA4 → Admin → Data Settings → Data Retention → 14 months
4. **Enable enhanced measurement:** GA4 → Admin → Data Streams → toggle all options on

---

## 12. Common Questions

### "Do I need both GA4 and Search Console?"

**Yes.** They measure completely different things. GA4 tells you what happens on your site. Search Console tells you how Google sees your site and what search queries drive traffic. Together, they give you the complete picture from search query to conversion.

### "Is data retroactive?"

**No.** Neither tool backfills data. GA4 starts collecting data from the moment gtag.js is installed. Search Console starts showing data from when the property is verified. This is why installing them early is critical — you can't get yesterday's data tomorrow.

### "Does GA4 slow down my site?"

**Minimal impact.** The gtag.js script loads with `afterInteractive` strategy, meaning it loads after the page is interactive. It doesn't block the initial page render. Typical impact is < 50ms on page load. The preconnect hint to `googletagmanager.com` in the layout further reduces this.

### "Can doctors see each other's data?"

**No.** When we build the doctor dashboard, the backend will filter GA4 Data API queries by the logged-in doctor's slug. The API key never reaches the client. A doctor's dashboard request will only return events where `doctor_slug` matches their own slug.

### "What about GDPR/privacy?"

For Mexico (tusalud.pro's primary market), LFPDPPP (Mexico's data protection law) applies rather than GDPR. However, best practices:
- GA4 anonymizes IP addresses by default (unlike older Universal Analytics)
- No personally identifiable information (PII) is sent to GA4 — only slugs, event types, and aggregate data
- Consider adding a cookie consent banner if you expand to EU markets

### "When will I see data?"

| Tool | First data appears |
|------|-------------------|
| GA4 Realtime | Immediately (within seconds of first visit) |
| GA4 Reports | Within 24-48 hours |
| GA4 Custom Events | After the first time each event fires |
| Search Console | 2-3 days after verification |
| Search Console (meaningful data) | 1-2 weeks |
| Linked GSC data in GA4 | 2-3 days after linking |

### "How do I debug if events aren't firing?"

1. Open Chrome DevTools → **Network** tab → filter by "google" or "analytics"
2. Navigate your site and look for requests to `google-analytics.com`
3. Open Chrome DevTools → **Console** → type `dataLayer` → inspect the array
4. Use [Google Tag Assistant](https://tagassistant.google.com/) for detailed debugging
5. In GA4 → **Realtime** → check if events appear within seconds
6. Install the [GA4 Debugger Chrome extension](https://chrome.google.com/webstore/detail/google-analytics-debugger) for verbose console logging
