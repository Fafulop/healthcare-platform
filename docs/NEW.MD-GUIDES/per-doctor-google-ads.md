# Per-Doctor Google Ads Tracking

**Last Updated:** 2026-02-16

---

## Overview

Each doctor can have their own Google Ads account ID stored in the database. When a patient visits a doctor's profile page, the system dynamically loads that doctor's Ads ID and fires conversion events (contact clicks, booking completions) to **their** specific Ads account. This allows each doctor to run independent Google Ads campaigns with their own budgets, keywords, and conversion tracking — no redeploy needed when onboarding a new doctor.

---

## How It Works

### Data Flow

```
Database (doctors.google_ads_id)
    │
    ▼
API Response (GET /api/doctors/:slug)
    │  returns googleAdsId field
    ▼
Public App (transformDoctorToProfile)
    │  maps to doctor.google_ads_id
    ▼
DoctorProfileClient (on mount)
    │  calls gtag('config', doctor.google_ads_id)
    │  passes googleAdsId prop to child components
    ▼
Conversion Events
    │  trackContactClick() → gtag('event', 'conversion', { send_to: 'AW-XXX/contact_click' })
    │  trackBookingComplete() → gtag('event', 'conversion', { send_to: 'AW-XXX/booking_complete' })
    ▼
Google Ads receives conversion data for that doctor's account
```

### Fallback Behavior

| Doctor has `google_ads_id`? | Global `NEXT_PUBLIC_GOOGLE_ADS_ID` set? | Result |
|---|---|---|
| Yes | Yes | Uses doctor's ID (per-doctor takes priority) |
| Yes | No | Uses doctor's ID |
| No | Yes | Uses global ID |
| No | No | No Ads conversion tracking |

GA4 analytics events (`profile_view`, `contact_click`, `booking_complete`, etc.) always fire regardless — they are not affected by Ads configuration.

---

## Database

### Schema

The `google_ads_id` column lives on the `doctors` table in the `public` schema:

```prisma
// packages/database/prisma/schema.prisma
model Doctor {
  // ... other fields
  googleAdsId  String?  @map("google_ads_id")
}
```

### Migration

The SQL migration file is at:

```
packages/database/prisma/migrations/add-google-ads-id.sql
```

```sql
ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS google_ads_id TEXT;
```

This migration has already been executed against both the local database and the Railway production database.

---

## Files Changed

### Database & Types

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Added `googleAdsId String? @map("google_ads_id")` to Doctor model |
| `packages/database/prisma/migrations/add-google-ads-id.sql` | SQL migration file |
| `packages/types/src/doctor.ts` | Added `google_ads_id?: string` to DoctorProfile interface |
| `apps/public/src/types/doctor.ts` | Same (local copy of the type) |

### Data Layer

| File | Change |
|---|---|
| `apps/public/src/lib/data.ts` | Maps `doctor.googleAdsId` → `google_ads_id` in `transformDoctorToProfile()` |
| `apps/public/src/lib/analytics.ts` | `trackContactClick()` and `trackBookingComplete()` accept optional `googleAdsId` parameter, fall back to global env var |

### Components

| File | Change |
|---|---|
| `apps/public/src/components/doctor/DoctorProfileClient.tsx` | On mount: calls `gtag('config', adsId)`. Passes `googleAdsId` prop to all child components |
| `apps/public/src/components/doctor/HeroSection.tsx` | Passes `googleAdsId` through to HeroButtons |
| `apps/public/src/components/doctor/HeroButtons.tsx` | Passes `googleAdsId` to `trackContactClick()` |
| `apps/public/src/components/doctor/SidebarCTA.tsx` | Passes `googleAdsId` to `trackContactClick()` |
| `apps/public/src/components/doctor/StickyMobileCTA.tsx` | Passes `googleAdsId` to `trackContactClick()` |
| `apps/public/src/components/doctor/BookingModal.tsx` | Passes `googleAdsId` through to BookingWidget |
| `apps/public/src/components/doctor/BookingWidget.tsx` | Passes `googleAdsId` to `trackBookingComplete()` |

### API Routes

| File | Change |
|---|---|
| `apps/api/src/app/api/doctors/route.ts` | POST (create) includes `googleAdsId` |
| `apps/api/src/app/api/doctors/[slug]/route.ts` | PUT (update) includes `googleAdsId` |

---

## How to Use

### Setting a Doctor's Google Ads ID

**Option 1 — Via API:**

```bash
curl -X PUT https://your-api-url/api/doctors/dr-lopez \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "google_ads_id": "AW-1234567890" }'
```

**Option 2 — Direct database update:**

```sql
UPDATE public.doctors
SET google_ads_id = 'AW-1234567890'
WHERE slug = 'dr-lopez';
```

### Removing a Doctor's Google Ads ID

```sql
UPDATE public.doctors
SET google_ads_id = NULL
WHERE slug = 'dr-lopez';
```

Or via API with `{ "google_ads_id": null }`.

### Finding a Doctor's Google Ads ID

The Ads ID comes from the doctor's Google Ads account. It looks like `AW-XXXXXXXXXX` (e.g., `AW-1234567890`). You can find it in:

- Google Ads dashboard → Settings → Account settings → Customer ID
- Or from the Google Ads conversion tracking setup page

---

## Conversion Events

Two types of conversions are tracked per-doctor:

### 1. Contact Click (`contact_click`)

Fires when a patient clicks WhatsApp or phone buttons. Tracked from:
- Hero section buttons
- Desktop sidebar CTA
- Mobile sticky CTA

```javascript
gtag('event', 'conversion', {
  send_to: 'AW-XXXXXXXXXX/contact_click',
  doctor_slug: 'dr-lopez',
  contact_method: 'whatsapp',
});
```

### 2. Booking Complete (`booking_complete`)

Fires when a patient successfully books an appointment. Tracked from:
- Booking widget (both sidebar and modal)

```javascript
gtag('event', 'conversion', {
  send_to: 'AW-XXXXXXXXXX/booking_complete',
  doctor_slug: 'dr-lopez',
  value: 800,
  currency: 'MXN',
});
```

---

## Verification

### Check if a doctor's Ads config loads

1. Open Chrome DevTools → Network tab
2. Visit a doctor's profile who has `google_ads_id` set
3. Look for a request to `google-analytics.com` or `googletagmanager.com` containing the doctor's `AW-` ID
4. Click a WhatsApp button → check for a `conversion` event with the doctor's Ads ID

### Check fallback behavior

1. Visit a doctor profile WITHOUT `google_ads_id` set
2. If `NEXT_PUBLIC_GOOGLE_ADS_ID` is set on the public Railway service, conversions fire to the global ID
3. If neither is set, no Ads conversion events fire (GA4 events still work)

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Railway public service (optional) | Global fallback Ads ID for doctors without their own |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Railway public service | GA4 measurement ID (unchanged, always active) |

The per-doctor Ads ID is **not** an environment variable — it comes from the database.
