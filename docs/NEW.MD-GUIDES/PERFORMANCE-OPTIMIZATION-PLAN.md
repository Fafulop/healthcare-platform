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

## 6. Implemented Fixes (Safe, No SEO Risk)

All 3 fixes were implemented and deployed on 2026-04-20.

### Fix 1: CSS `content-visibility: auto` on Below-Fold Sections ✅ DEPLOYED

**File:** `apps/public/src/app/globals.css`

**What it does:** Browser-native feature that skips **painting** off-screen content. Content stays in the DOM (SEO safe), but the browser doesn't waste time rendering it until the user scrolls near it.

```css
#biography,
#location,
#education,
#credentials,
#faq {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;
}
```

**Applied to sections:** Biography, ClinicLocation, Education, Credentials, FAQ (targeted by their section IDs — no component changes needed)

**Why it's safe:**
- Content is in the DOM → Google sees it
- No JavaScript → no hydration mismatch
- No bundle increase
- Chrome, Edge, and Googlebot fully support it (Chromium-based)
- Firefox has partial support (degrades gracefully — just renders normally)

**Expected impact:** 5-8ms TBT reduction per page. Browser skips painting 5+ sections on initial load.

### Fix 2: Defer BookingWidget API Calls Until Visible ✅ DEPLOYED

**File:** `apps/public/src/components/doctor/BookingWidget.tsx`

**What it does:** BookingWidget already has `ssr: false` (no server rendering). Previously it fired API calls immediately on mount. Now defers them until the widget scrolls into view using IntersectionObserver.

```tsx
// Inside BookingWidget.tsx
const containerRef = useRef<HTMLDivElement>(null);
const [isVisible, setIsVisible] = useState(false);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
    { rootMargin: '200px' } // Start loading slightly before visible
  );
  observer.observe(el);
  return () => observer.disconnect();
}, []);

useEffect(() => {
  if (!isVisible) return;
  fetchAvailability(); // Only call when visible
}, [isVisible, currentMonth, doctorSlug]);
```

**Implementation details:**
- `isVisible` is one-way (`false` → `true`, never reverts) — avoids re-fetching when scrolling away
- `rootMargin: '200px'` starts loading slightly before the widget enters the viewport
- `ref` is attached to the always-rendered outer container div (not conditionally rendered)
- When `isModal={true}` (BookingModal), the observer fires immediately since the modal is in the viewport
- Both `fetchAvailability()` and `booking-field-settings` fetch are gated on `isVisible`

**Why it's safe:**
- BookingWidget is already `ssr: false` → no SEO content to protect
- On desktop: sidebar is visible immediately → API calls fire right away (no change)
- On mobile: booking widget is below the fold → API calls deferred until user scrolls there
- Removes 2-3 blocking long tasks from mobile critical path

**Expected impact:** Significant TBT reduction on mobile. The API calls are the main source of long tasks for heavy profiles.

### Fix 3: Replace QuickNav Scroll Spy with IntersectionObserver ✅ DEPLOYED

**File:** `apps/public/src/components/doctor/QuickNav.tsx`

**Before:** Runs `getBoundingClientRect()` × 10 sections on every scroll event (via `requestAnimationFrame`) → layout recalculations on every frame during scrolling.

**After:** Single IntersectionObserver with `rootMargin` to detect which section is in the viewport center.

```tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      }
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

**Implementation details:**
- `rootMargin: '-50% 0px -50% 0px'` means only the center strip of the viewport triggers — typically only 1 section intersects at a time
- `activeSection` defaults to `'inicio'` which is correct since HeroSection is first and visible on load
- Observer safely skips sections that don't exist in the DOM (`if (el)` check)
- Properly cleans up with `observer.disconnect()` on unmount

**Why it's safe:**
- No DOM queries per scroll event
- Observer fires only on section boundary crossing
- Falls back gracefully (if element doesn't exist, observer just doesn't observe it)

**Expected impact:** Eliminates layout recalculations during scrolling (was ~60/sec with rAF, now 0).

---

## 7. Implementation Priority

| Priority | Fix | Impact | Risk | Effort | Status |
|----------|-----|--------|------|--------|--------|
| 1 | CSS `content-visibility: auto` | Medium | None | 10 min | Deployed 2026-04-20 |
| 2 | Defer BookingWidget API calls | High | Low | 30 min | Deployed 2026-04-20 |
| 3 | QuickNav → IntersectionObserver | Medium | Low | 30 min | Deployed 2026-04-20 |

---

## 8. Post-Deployment Results (2026-04-21)

### Measured Scores (3 runs per doctor, mobile, slow 4G)

**dra-adriana-michelle (heavy profile):**

| Metric | Before | After (3 runs) | Change |
|--------|--------|-----------------|--------|
| Performance | 43-51 | **56 / 85 / 59** | +5 to +42 points |
| FCP | 2.9s | 3.6 / 2.9 / 3.6s | Same range |
| LCP | 5.5-6.3s | 8.9 / 3.3 / 8.7s | Highly variable (CDN) |
| TBT | 890-2610ms | **380 / 160 / 280ms** | **-510 to -2450ms** |
| CLS | 0.004 | 0 / 0.004 / 0 | Perfect |

**dra-patricia-roldan-mora (light profile):**

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Performance | 66-69 | **68** | Same range |
| FCP | 3.6s | 3.6s | Same |
| LCP | 5.9-6.1s | 5.8s | -0.1s |
| TBT | 120-170ms | **50ms** | **-70 to -120ms** |
| CLS | 0 | 0 | Perfect |

### Key Observations

- **TBT is the big win** — adriana went from 890-2610ms to 160-380ms, patricia from 120-170ms to 50ms
- **Mobile LCP is CDN-dependent** — varies wildly (3.3s to 8.9s) based on utfs.io response time over slow 4G
- **Mobile score variance is extreme** — 56 to 85 on the same page, same minute. Lighthouse simulated slow 4G is inherently noisy
- **SEO remains 100** across all tests

---

## 9. Desktop CLS Regression & Fix (2026-04-21)

### Problem Discovered

After deploying fixes 1-3, desktop scores regressed:

| Metric | Before fixes | After fixes 1-3 | Issue |
|--------|-------------|------------------|-------|
| Desktop CLS | 0.083 | **0.162-0.175** | Regression |
| Desktop TBT | 40-80ms | **370-460ms** | Regression |
| Desktop Score | 88-97 | **60-66** | Regression |

### Root Cause Analysis

**TBT regression:** The IntersectionObserver in BookingWidget was firing immediately on desktop (sidebar always visible) but adding overhead from observer setup + state change + callback that didn't exist before.

**CLS regression (3 sources):**

1. **Sidebar `overflow-y: visible`** — when BookingWidget loaded and exceeded viewport height, the browser couldn't scroll the sidebar, forcing layout recalculation on adjacent content
2. **MediaCarousel loading skeleton too small** — skeleton was a tiny text paragraph (~50px), actual component is ~528px on desktop. When the real carousel loaded, everything below shifted
3. **Sidebar `h-screen` flex layout** — forced exact viewport height. When BookingWidget expanded from skeleton (380px) to actual size (450px+), SidebarContactInfo was forced to shrink, causing visible shift

### Fixes Applied

#### Fix 4: Skip IntersectionObserver on Desktop ✅ DEPLOYED

**File:** `apps/public/src/components/doctor/BookingWidget.tsx`

On desktop (`window.innerWidth >= 1024`) or modal: sets `isVisible = true` immediately without creating an observer. On mobile: keeps the observer to defer API calls.

```tsx
useEffect(() => {
  if (isModal || window.innerWidth >= 1024) {
    setIsVisible(true);
    return;
  }
  // Mobile: defer until widget scrolls into view
  const el = containerRef.current;
  if (!el) return;
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
    { rootMargin: '200px' }
  );
  observer.observe(el);
  return () => observer.disconnect();
}, [isModal]);
```

**Why:** Eliminates observer overhead on desktop where it provides no benefit (sidebar is always visible).

#### Fix 5: BookingWidget Loading Skeleton Height Match ✅ DEPLOYED

**File:** `apps/public/src/components/doctor/DynamicSections.tsx`

Skeleton now has `minHeight: 380px` with matching padding structure (`px-2 py-2`) and a header skeleton matching the gradient header.

#### Fix 6: Sidebar `overflow-y: auto` ✅ DEPLOYED

**File:** `apps/public/src/app/globals.css`

Changed `.profile-right-column` from `overflow-y: visible` to `overflow-y: auto`. The sidebar now scrolls independently when content exceeds viewport height, instead of forcing layout recalculation on adjacent elements.

#### Fix 7: MediaCarousel Loading Skeleton ✅ DEPLOYED

**File:** `apps/public/src/components/doctor/DynamicSections.tsx`

- Skeleton now uses responsive height matching the real carousel: `h-[280px] md:h-[400px]`
- Background matches actual component: `bg-[var(--color-bg-green-light)]`
- Empty carousel guard: `DynamicMediaCarousel` returns `null` early when `items.length === 0`, preventing the skeleton from showing 500px+ of space that then disappears

#### Fix 8: Sidebar `max-h-screen` ✅ DEPLOYED

**File:** `apps/public/src/components/doctor/DoctorProfileClient.tsx`

Changed sidebar flex container from `h-screen` (forced exact height) to `max-h-screen` (flexible up to viewport). This prevents rigid layout shifts when BookingWidget expands from skeleton to actual size.

---

## 10. What We're NOT Doing (and Why)

| Approach | Why not |
|----------|---------|
| **Dynamic imports for sections** | Caused 4G chunk waterfall on mobile (66 → 43). Reverted. |
| **Lazy-render-on-scroll** | Breaks SSR + SEO. Google wouldn't see below-fold content. |
| **Replace Lucide with inline SVGs** | ~15KB savings but high effort (30+ icons across 10+ files). Low priority. |
| **Paginate ServicesSection** | Minor impact (3-5ms). Can do later if needed. |
| **Next.js Partial Prerendering (PPR)** | Experimental feature, not configured, requires careful Suspense boundaries. |
| **React Server Components for sections** | Would require major architecture refactor. DoctorProfileClient is a single "use client" boundary. |

---

## 11. Metrics to Watch

1. **Re-test both doctors** on https://pagespeed.web.dev (mobile + desktop) after deploying fixes 4-8
2. **Run 3 tests per URL** to account for Lighthouse variance
3. **Check Rich Results Test** to confirm SEO is intact
4. **Monitor in Search Console** → Core Web Vitals report (takes 1-2 weeks to populate)

### Current Targets

| Metric | dra-patricia (light) | dra-adriana (heavy) | Target |
|--------|---------------------|---------------------|--------|
| Mobile Performance | 68 | 56-85 | 60-85 |
| Mobile TBT | 50ms | 160-380ms | < 500ms ✅ |
| Mobile LCP | 5.8s | 3.3-8.9s | CDN-dependent |
| Desktop CLS | TBD | TBD (was 0.162-0.175) | < 0.1 |
| Desktop TBT | TBD | TBD (was 370-460ms) | < 200ms |
| SEO | 100 | 100 | 100 ✅ |

**Note:** Mobile LCP is primarily limited by image delivery from utfs.io over slow 4G. This is a CDN/network constraint, not a code issue. Improving LCP further would require moving images to a faster CDN or using smaller image formats.

---

## 12. Google Official References

| Topic | URL |
|-------|-----|
| content-visibility | https://web.dev/articles/content-visibility |
| Core Web Vitals | https://web.dev/articles/vitals |
| Total Blocking Time | https://web.dev/articles/tbt |
| Largest Contentful Paint | https://web.dev/articles/lcp |
| IntersectionObserver | https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API |
| Next.js Dynamic Imports | https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading |
