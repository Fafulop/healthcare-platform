# Performance Optimization Plan — tusalud.pro Doctor Profiles

**Date:** 2026-04-21
**Scope:** Mobile + Desktop PageSpeed optimization for doctor profile pages
**Method:** Lighthouse analysis + codebase deep dive + React/Next.js rendering architecture review

---

## 1. Current State

### PageSpeed Scores (Mobile — Moto G Power, slow 4G)

| Doctor | Performance | FCP | LCP | TBT | CLS |
|--------|-------------|-----|-----|-----|-----|
| dra-patricia-roldan-mora | 66-69 | 3.6s | 5.9-6.1s | 120-170ms | 0 |
| dra-adriana-michelle | 43-51 | 2.9s | 5.5-6.3s | 890-2610ms | 0.004 |

### PageSpeed Scores (Desktop)

| Doctor | Performance | FCP | LCP | TBT | CLS |
|--------|-------------|-----|-----|-----|-----|
| dra-patricia-roldan-mora | 88-97 | 0.8s | 0.8-0.9s | 40-80ms | 0.083 |

### Target Metrics (Google Core Web Vitals)

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| LCP | < 2.5s | 2.5-4.0s | > 4.0s |
| INP/TBT | < 200ms | 200-500ms | > 500ms |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |

### Key Observations

- **Scores vary between doctors** — dra-adriana is consistently worse than dra-patricia. This is **content-dependent**, not a code bug
- **Scores vary between runs** — Lighthouse on simulated slow 4G fluctuates 10-20 points per run
- **Desktop is excellent** (88-97), mobile is the bottleneck
- **SEO is 100** on all tests — structured data, metadata, and content are fully optimized
- **CLS is near-perfect** — no layout shift issues

---

## 2. Why Scores Differ Between Doctors

The same code runs for every doctor, but **data volume** determines performance:

| Factor | dra-patricia | dra-adriana (heavier) |
|--------|-------------|----------------------|
| Unused JS | 90KB | 143KB |
| Long tasks | 4 | 17 |
| Uncached assets | 23KB | 198KB |
| Reviews | ~1 | Many more |
| Carousel items | Fewer | More videos/images |
| Certificates | Fewer | More |
| Services | Fewer | More |
| Booking slots | Fewer | More availability |

More content = more DOM elements = more hydration work = higher TBT on mobile.

---

## 3. Root Cause Analysis — What's Slow

### 3.1 BookingWidget (Heaviest Component — 757 lines)

**File:** `apps/public/src/components/doctor/BookingWidget.tsx`

- 22 React hooks (useState, useEffect chains)
- **4 API calls triggered on mount:** `fetchAvailability()`, `booking-field-settings`, `services`, `appointments/bookings`
- 42+ DOM elements for calendar grid (6 weeks × 7 days)
- 12 Lucide icon imports
- Already `ssr: false` (dynamic import), but API calls still block the main thread on mount

**Impact:** Each API call creates a long task. Doctors with more availability = more data to process = more long tasks.

### 3.2 QuickNav Scroll Spy (Layout Thrashing)

**File:** `apps/public/src/components/doctor/QuickNav.tsx`

- Uses `scroll` event listener + `requestAnimationFrame`
- On every scroll: runs `document.getElementById()` × 10 sections
- Each call triggers `getBoundingClientRect()` → forces browser layout recalculation
- **~600+ layout recalculations per second** on mobile scrolling

### 3.3 All Sections in One Bundle (Static Imports)

**File:** `apps/public/src/components/doctor/DoctorProfileClient.tsx`

- 10 section components statically imported → all JavaScript in initial bundle
- Mobile over slow 4G must download, parse, and hydrate everything upfront
- Below-fold sections (Education, Credentials, FAQ) don't need to be interactive immediately

### 3.4 Content-Heavy Sections Render Everything

- **ServicesSection** — renders ALL service cards immediately (no pagination)
- **CredentialsSection** — renders ALL certificate thumbnails (lazy-loads images after 4th, but DOM nodes exist for all)
- **ReviewsSection** — already paginated (shows 3 initially, "load more" button) ✓

### 3.5 Third-Party Scripts

- Google Analytics 4 (loads `afterInteractive` — not blocking)
- Per-doctor Google Ads tracking (`gtag('config', doctorAdsId)` on mount)
- 30+ Lucide icons across all components (~15KB of SVG JS)

---

## 4. What We Tried and What Happened

### 4.1 Dynamic Imports for Below-Fold Sections (REVERTED)

**What we did:** Converted 7 sections from static imports to `dynamic()` imports:
```tsx
const ServicesSection = dynamic(() => import("./ServicesSection"));
const ConditionsSection = dynamic(() => import("./ConditionsSection"));
// ... 5 more
```

**Desktop result:** 88 → **97** (great improvement — chunks download in parallel)

**Mobile result:** 66 → **43** (terrible regression — chunk waterfall over slow 4G)

**Why it failed on mobile:** On slow 4G, 7+ separate JS chunks create a sequential download waterfall. Each chunk must download, parse, and hydrate individually. The overhead of multiple round trips on slow 4G far exceeds the benefit of smaller individual chunks.

**Lesson:** Code splitting is a desktop optimization. On slow mobile networks, fewer larger files outperform many smaller files.

**Status:** Reverted to static imports. The revert is in `DoctorProfileClient.tsx` but not yet committed.

### 4.2 Preconnect Cleanup (KEPT)

**What we did:** Removed 2 preconnects from `layout.tsx`:
- `healthcareapi-production-fb70.up.railway.app` — server-side only, browser never calls it
- `www.googletagmanager.com` — GA loads with `afterInteractive`, preconnect not needed

**Result:** Down from 5 preconnects to 3. Google's ">4 preconnects" warning eliminated.

**Status:** Committed and deployed.

### 4.3 Dead Code Removal (KEPT)

Removed unused `DynamicAppointmentCalendar` export from `DynamicSections.tsx`.

**Status:** Committed and deployed.

---

## 5. Why Lazy-Render-on-Scroll is NOT Safe

We investigated wrapping below-fold sections in a component that delays rendering until the user scrolls near them:

```tsx
function LazySection({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{isVisible ? children : <Placeholder />}</div>;
}
```

### Why this breaks

1. **SEO destroyed:** On the server, `isVisible = false` → renders placeholder. Google sees placeholder, not content.

2. **Hydration mismatch:** Server renders placeholder HTML. Client expects to hydrate placeholder. But if we try to render content on server and placeholder on client → React throws a hydration mismatch error.

3. **Googlebot doesn't scroll:** It does a single page crawl, doesn't trigger IntersectionObserver.

### Conclusion: Lazy-render is incompatible with SSR + SEO. Use CSS `content-visibility` instead.

---

## 6. Recommended Fixes (Safe, No SEO Risk)

### Fix 1: CSS `content-visibility: auto` on Below-Fold Sections

**What it does:** Browser-native feature that skips **painting** off-screen content. Content stays in the DOM (SEO safe), but the browser doesn't waste time rendering it until the user scrolls near it.

```css
.section-below-fold {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;
}
```

**Applied to sections:** Education, Credentials, FAQ, Biography, ClinicLocation (anything below the fold)

**Why it's safe:**
- Content is in the DOM → Google sees it
- No JavaScript → no hydration mismatch
- No bundle increase
- Chrome, Edge, and Googlebot fully support it (Chromium-based)
- Firefox has partial support (degrades gracefully — just renders normally)

**Expected impact:** 5-8ms TBT reduction per page. Browser skips painting 5+ sections on initial load.

### Fix 2: Defer BookingWidget API Calls Until Visible

**What it does:** BookingWidget already has `ssr: false` (no server rendering). Currently, it fires 4 API calls immediately on mount. Instead, defer API calls until the widget scrolls into view.

```tsx
// Inside BookingWidget.tsx
const [isVisible, setIsVisible] = useState(false);
const containerRef = useRef(null);

useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) setIsVisible(true);
  });
  if (containerRef.current) observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);

useEffect(() => {
  if (!isVisible) return;
  fetchAvailability(); // Only call when visible
}, [isVisible]);
```

**Why it's safe:**
- BookingWidget is already `ssr: false` → no SEO content to protect
- On desktop: sidebar is visible immediately → API calls fire right away (no change)
- On mobile: booking widget is below the fold → API calls deferred until user scrolls there
- Removes 2-3 blocking long tasks from mobile critical path

**Expected impact:** Significant TBT reduction on mobile. The 4 API calls are the main source of long tasks for heavy profiles.

### Fix 3: Replace QuickNav Scroll Spy with IntersectionObserver

**Current:** Runs `getBoundingClientRect()` × 10 sections on every scroll event → layout thrashing.

**New:** Use IntersectionObserver with `rootMargin` to detect which section is in the viewport center.

```tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    },
    { rootMargin: '-50% 0px -50% 0px' }
  );

  sections.forEach((section) => {
    const el = document.getElementById(section.id);
    if (el) observer.observe(el);
  });

  return () => observer.disconnect();
}, []);
```

**Why it's safe:**
- No DOM queries per scroll event
- Observer fires only on section boundary crossing
- `rootMargin: '-50% 0px -50% 0px'` detects when a section crosses the viewport center
- Falls back gracefully (if element doesn't exist, observer just doesn't observe it)

**Expected impact:** Eliminates ~600+ layout recalculations/sec during scrolling.

---

## 7. Implementation Priority

| Priority | Fix | Impact | Risk | Effort |
|----------|-----|--------|------|--------|
| 1 | CSS `content-visibility: auto` | Medium | None | 10 min |
| 2 | Defer BookingWidget API calls | High | Low | 30 min |
| 3 | QuickNav → IntersectionObserver | Medium | Low | 30 min |

**Expected combined improvement:**
- Mobile TBT: significant reduction (especially for heavy profiles like dra-adriana)
- Mobile score: estimated +10-15 points
- Desktop: no regression (already 97)
- SEO: no impact (100 maintained)

---

## 8. What We're NOT Doing (and Why)

| Approach | Why not |
|----------|---------|
| **Dynamic imports for sections** | Caused 4G chunk waterfall on mobile (66 → 43). Reverted. |
| **Lazy-render-on-scroll** | Breaks SSR + SEO. Google wouldn't see below-fold content. |
| **Replace Lucide with inline SVGs** | ~15KB savings but high effort (30+ icons across 10+ files). Low priority. |
| **Paginate ServicesSection** | Minor impact (3-5ms). Can do later if needed. |
| **Next.js Partial Prerendering (PPR)** | Experimental feature, not configured, requires careful Suspense boundaries. |
| **React Server Components for sections** | Would require major architecture refactor. DoctorProfileClient is a single "use client" boundary. |

---

## 9. Metrics to Watch After Deployment

After implementing fixes 1-3:

1. **Re-test both doctors** on https://pagespeed.web.dev (mobile + desktop)
2. **Run 3 tests per URL** to account for Lighthouse variance
3. **Check Rich Results Test** to confirm SEO is intact
4. **Monitor in Search Console** → Core Web Vitals report (takes 1-2 weeks to populate)

### Target After Fixes

| Metric | Current (dra-patricia) | Current (dra-adriana) | Target |
|--------|----------------------|---------------------|--------|
| Mobile Performance | 66-69 | 43-51 | 60-75 |
| Mobile TBT | 120-170ms | 890-2610ms | < 500ms |
| Desktop Performance | 88-97 | ~88 | 90+ |
| SEO | 100 | 100 | 100 |

**Note:** Mobile LCP (5-6s) is primarily limited by image delivery from utfs.io over slow 4G. This is a CDN/network constraint, not a code issue. Improving LCP further would require moving images to a faster CDN or using smaller image formats.

---

## 10. Google Official References

| Topic | URL |
|-------|-----|
| content-visibility | https://web.dev/articles/content-visibility |
| Core Web Vitals | https://web.dev/articles/vitals |
| Total Blocking Time | https://web.dev/articles/tbt |
| Largest Contentful Paint | https://web.dev/articles/lcp |
| IntersectionObserver | https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API |
| Next.js Dynamic Imports | https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading |
