# Google Analytics 4 + Google Ads — Implementation Guide

## Overview

This document describes the GA4 and Google Ads tracking implementation added to the **public app** (`apps/public`). The setup uses **gtag.js directly** (no GTM) to track pageviews, custom events, and Google Ads conversions across the entire public-facing site.

All tracking is controlled by two environment variables. When they are empty, **zero tracking scripts are loaded** — no performance impact in development.

---

## Environment Variables

Add these to `apps/public/.env`:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX    # GA4 Measurement ID
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXXX       # Google Ads Account ID
```

Both are optional. GA4 works without Google Ads, and if neither is set, no tracking code runs.

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/public/src/lib/analytics.ts` | Centralized analytics utility module with typed event helpers |
| `apps/public/src/components/GoogleAnalytics.tsx` | Client component that tracks route changes (SPA navigation) |
| `apps/public/src/components/blog/BlogViewTracker.tsx` | Client component that fires `blog_view` event on article pages |

## Files Modified

| File | Changes |
|------|---------|
| `apps/public/src/app/layout.tsx` | Added gtag.js scripts (GA4 + Ads), preconnect, and `<GoogleAnalytics />` component |
| `apps/public/src/components/doctor/DoctorProfileClient.tsx` | Added `profile_view` event on mount; passes `doctorSlug` to child components |
| `apps/public/src/components/doctor/HeroButtons.tsx` | Added `contact_click` (WhatsApp) and `appointment_click` tracking |
| `apps/public/src/components/doctor/SidebarCTA.tsx` | Added `doctorSlug` prop, `contact_click` and `appointment_click` tracking |
| `apps/public/src/components/doctor/StickyMobileCTA.tsx` | Added `doctorSlug` prop, `contact_click` and `appointment_click` tracking |
| `apps/public/src/components/doctor/SidebarContactInfo.tsx` | Added `doctorSlug` prop, `map_click` tracking; converted to client component |
| `apps/public/src/components/doctor/ClinicLocationSection.tsx` | Added `doctorSlug` prop, `map_click` tracking; converted to client component |
| `apps/public/src/components/doctor/BookingWidget.tsx` | Added `slot_selected` and `booking_complete` tracking |
| `apps/public/src/components/blog/BlogLayoutClient.tsx` | Passes `doctorSlug` to SidebarCTA and SidebarContactInfo |
| `apps/public/src/app/doctores/[slug]/blog/[articleSlug]/page.tsx` | Added `<BlogViewTracker />` component |

---

## Architecture

### How gtag.js loads

```
layout.tsx
├── <Script src="gtag/js?id=G-XXX" strategy="afterInteractive" />
├── <Script id="ga4-init" strategy="afterInteractive">
│     window.dataLayer = window.dataLayer || [];
│     function gtag(){dataLayer.push(arguments);}
│     gtag('js', new Date());
│     gtag('config', 'G-XXXXXXXXXX');       ← GA4
│     gtag('config', 'AW-XXXXXXXXXX');      ← Google Ads (if set)
│   </Script>
├── <GoogleAnalytics />                      ← tracks SPA route changes
└── {children}
```

**Key decisions:**
- `afterInteractive` strategy — scripts load after hydration, so they don't block LCP/FCP
- Preconnect to `googletagmanager.com` is added conditionally (only when GA_MEASUREMENT_ID is set)
- `<GoogleAnalytics />` is wrapped in `<Suspense>` because it uses `useSearchParams()`

### Analytics utility module (`lib/analytics.ts`)

All event tracking goes through typed helper functions. No component calls `window.gtag()` directly.

```typescript
// Safe wrapper — does nothing if gtag isn't loaded
function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}
```

This means:
- Server-side rendering: no errors (checks `typeof window`)
- Missing env vars: no errors (gtag won't exist on window, calls are silently ignored)
- Works in development: just won't send data to Google

---

## Custom Events Reference

### profile_view
**Fired when:** A doctor profile page loads
**Component:** `DoctorProfileClient` (useEffect on mount)
**Parameters:**
```
doctor_slug: string    (e.g., "dra-maria-garcia")
doctor_name: string    (e.g., "Dra. María García")
specialty: string      (e.g., "Dermatología")
```

### contact_click
**Fired when:** User clicks WhatsApp "Enviar Mensaje" button
**Components:** `HeroButtons`, `SidebarCTA`, `StickyMobileCTA`
**Parameters:**
```
doctor_slug: string
contact_method: "whatsapp" | "phone" | "email"
click_location: "hero" | "sidebar" | "mobile_cta" | "blog_sidebar"
```
**Also fires:** Google Ads conversion (`send_to: AW-XXX/contact_click`)

### appointment_click
**Fired when:** User clicks "Agendar Cita" button
**Components:** `HeroButtons`, `SidebarCTA`, `StickyMobileCTA`
**Parameters:**
```
doctor_slug: string
click_location: "hero" | "sidebar" | "mobile_cta" | "blog_sidebar"
```

### slot_selected
**Fired when:** User selects a specific time slot in the booking calendar
**Component:** `BookingWidget`
**Parameters:**
```
doctor_slug: string
slot_date: string      (e.g., "2026-02-20")
slot_time: string      (e.g., "10:00")
price: number          (e.g., 800)
```

### booking_complete
**Fired when:** Booking form is submitted successfully
**Component:** `BookingWidget`
**Parameters:**
```
doctor_slug: string
slot_date: string
value: number          (price in MXN)
currency: "MXN"
```
**Also fires:** Google Ads conversion (`send_to: AW-XXX/booking_complete`)

### blog_view
**Fired when:** A blog article page loads
**Component:** `BlogViewTracker`
**Parameters:**
```
doctor_slug: string
article_slug: string
article_title: string
```

### map_click
**Fired when:** User clicks "Ver en Google Maps" link
**Components:** `SidebarContactInfo`, `ClinicLocationSection`
**Parameters:**
```
doctor_slug: string
click_location: "sidebar" | "clinic_section"
```

### doctor_card_click
**Fired when:** User clicks a doctor card on the listing page
**Component:** Not yet wired (available in `lib/analytics.ts` for future use)
**Parameters:**
```
doctor_slug: string
doctor_name: string
list_position: number
```

---

## Google Ads Conversion Events

Two events are configured as Google Ads conversions (they fire both GA4 events AND Ads conversion events):

| Event | Conversion Label | Why |
|-------|-----------------|-----|
| `contact_click` | `AW-XXX/contact_click` | Doctor gets a lead via WhatsApp |
| `booking_complete` | `AW-XXX/booking_complete` | Doctor gets a confirmed appointment |

**Important:** After setting up Google Ads, you need to create matching conversion actions in the Google Ads console with these exact labels. The `send_to` values in the code use placeholder labels — update them in `lib/analytics.ts` once you have the actual conversion IDs from Google Ads (format: `AW-XXXXXXXXXX/CONVERSION_LABEL`).

---

## Per-Doctor Analytics Breakdown

Every custom event includes `doctor_slug` as a parameter. This is the key that enables per-doctor analytics:

- **In GA4:** Create custom dimensions for `doctor_slug`, then filter any report by this dimension
- **In GA4 Data API:** Query events filtered by `doctor_slug` to build per-doctor dashboards
- **In Google Ads:** Each doctor's campaigns point to their profile URL, so conversions are attributed per-doctor automatically

---

## What's NOT Implemented Yet (Future Work)

1. **GA4 Data API dashboards** — Server-side queries for admin and doctor apps (requires GCP service account)
2. **Google Ads API integration** — Campaign performance data in dashboards
3. **GA4 caching layer** — Store analytics snapshots in PostgreSQL to avoid API rate limits
4. **Doctor listing page tracking** — `trackDoctorCardClick()` is exported but not wired to the doctors listing page
5. **Search Console** — Meta tag verification needs to be added to `layout.tsx` once you have the verification code
6. **Google Ads conversion labels** — The `send_to` values need actual conversion IDs from Google Ads console

---

## How to Verify It Works

1. Set the env variables and start the dev server
2. Open Chrome DevTools → Network tab
3. Navigate to a doctor profile — you should see requests to `google-analytics.com`
4. Open Chrome DevTools → Console, type `dataLayer` — you should see event objects
5. In GA4 console → Realtime → you should see live pageviews and events
6. Use [Google Tag Assistant](https://tagassistant.google.com/) for detailed debugging
