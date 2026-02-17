# GA4 Console Configuration — What Was Done and Why

**Date:** 2026-02-17

---

## Context

The codebase already had a full GA4 + Google Ads tracking implementation in the public app (`apps/public`). The gtag.js scripts were loading, custom events were firing from components, and per-doctor Google Ads IDs were stored in the database. However, the **GA4 web console** had not been configured to actually use the data being collected. Without this configuration, GA4 was receiving events and parameters but couldn't surface them in reports, mark important actions as business goals, or retain data long enough to be useful.

This document covers the three configuration changes made directly in the Google Analytics 4 web console at [analytics.google.com](https://analytics.google.com) — not in the codebase. These are one-time, property-wide settings that apply to all doctors and all data streams automatically.

---

## What Was Already in Place (Before This Configuration)

| Component | Status | Location |
|---|---|---|
| GA4 Measurement ID | Active (`G-PM03GGVRZS`) | `apps/public/.env` |
| gtag.js script loading | Done | `apps/public/src/app/layout.tsx` |
| SPA route tracking | Done | `apps/public/src/components/GoogleAnalytics.tsx` |
| Analytics utility with typed helpers | Done | `apps/public/src/lib/analytics.ts` |
| 8 custom events firing from components | Done | Various components in `apps/public/src/components/` |
| Per-doctor Google Ads ID in database | Done | `doctors.google_ads_id` column |
| Per-doctor Ads ID management in admin | Done | `apps/admin/src/app/doctors/page.tsx` |
| Google Search Console | Verified via DNS (domain name provider method) | External — no code needed |
| Sitemap | Done | `apps/public/src/app/sitemap.ts` |
| robots.txt | Done | `apps/public/src/app/robots.ts` |

### Custom Events Already Being Sent by the Code

| Event | Component(s) | When It Fires | Parameters Sent |
|---|---|---|---|
| `profile_view` | `DoctorProfileClient` | Doctor profile page loads | `doctor_slug`, `doctor_name`, `specialty` |
| `contact_click` | `HeroButtons`, `SidebarCTA`, `StickyMobileCTA` | WhatsApp/phone button clicked | `doctor_slug`, `contact_method`, `click_location` |
| `appointment_click` | `HeroButtons`, `SidebarCTA`, `StickyMobileCTA` | "Agendar Cita" button clicked | `doctor_slug`, `click_location` |
| `slot_selected` | `BookingWidget` | Time slot chosen in calendar | `doctor_slug`, `slot_date`, `slot_time`, `price` |
| `booking_complete` | `BookingWidget` | Booking form submitted successfully | `doctor_slug`, `slot_date`, `value`, `currency` |
| `blog_view` | `BlogViewTracker` | Blog article page loads | `doctor_slug`, `article_slug`, `article_title` |
| `map_click` | `SidebarContactInfo`, `ClinicLocationSection` | "Ver en Google Maps" clicked | `doctor_slug`, `click_location` |
| `doctor_card_click` | `DoctorCardTracked` | Doctor card clicked on listing page | `doctor_slug`, `doctor_name`, `list_position` |

**The problem:** All of this data was being sent to GA4, but GA4 wasn't configured to do anything meaningful with it. The events existed but weren't marked as business goals, the parameters were collected but invisible in reports, and data would be deleted after only 2 months.

---

## Change 1: Data Retention — Extended to 14 Months

### Where

GA4 Console → Admin → Data collection and modification → **Data Retention**

### What Was Changed

| Setting | Before | After |
|---|---|---|
| Event data retention | 2 months (GA4 default) | **14 months** |

### Why This Matters

GA4 defaults to keeping detailed event-level data for only 2 months. After that period, you can still see aggregated reports (total pageviews, total events) but you lose the ability to:

- Build custom explorations with historical data
- Filter historical data by custom dimensions (like `doctor_slug`)
- Compare performance across longer time periods at a granular level
- Analyze seasonal trends (e.g., comparing January to July)

14 months is the maximum GA4 allows. This gives you over a full year of detailed, filterable data — enough to compare year-over-year and analyze long-term trends per doctor.

### Important Notes

- This is a **one-time, property-wide setting**. It applies to all events, all doctors, all data streams.
- It is **not retroactive** — data that was already deleted before this change cannot be recovered.
- Aggregated standard reports are not affected by this setting — they retain data indefinitely regardless.
- Only user-level and event-level exploration data is governed by this retention period.

---

## Change 2: Key Events (Formerly "Conversions")

### Where

GA4 Console → Admin → Data display → **Events** → Create event → "Create with code"

### What Was Changed

Two events were created and marked as **key events** (Google renamed "conversions" to "key events" in 2024):

#### booking_complete

| Setting | Value | Reason |
|---|---|---|
| Event name | `booking_complete` | Matches exactly what the code sends via `gtag()` |
| Mark as key event | Yes | This is the most important business action — a patient confirmed an appointment |
| Default key event value | Don't set a default | The code already sends `value` (appointment price) and `currency: "MXN"` with each event, so GA4 uses the real price |
| Counting method | Once per event | A patient could book multiple appointments in one session, and each booking should count as a separate conversion |
| Creation method | Create with code | The event is already being fired from `BookingWidget.tsx` — we're just telling GA4 to recognize it |

#### contact_click

| Setting | Value | Reason |
|---|---|---|
| Event name | `contact_click` | Matches exactly what the code sends via `gtag()` |
| Mark as key event | Yes | This is a high-value lead action — a patient reached out via WhatsApp or phone |
| Default key event value | Don't set a default | Contact clicks don't have a monetary value |
| Counting method | Once per event | Every click is counted, giving granular data on how many times WhatsApp/phone buttons are used per doctor |
| Creation method | Create with code | The event is already being fired from `HeroButtons.tsx`, `SidebarCTA.tsx`, and `StickyMobileCTA.tsx` |

### Why Key Events Matter

Marking events as key events does several things:

1. **Dedicated reporting** — Key events get their own report section in GA4, separate from regular events
2. **Attribution modeling** — GA4 attributes key events to traffic sources (which Google search query, which ad campaign, which referral led to the booking)
3. **Google Ads integration** — When GA4 is linked to Google Ads, key events can be imported as conversion goals for campaign optimization. Google Ads can then automatically optimize bidding to maximize these specific actions.
4. **Funnel analysis** — You can build funnels like: `profile_view` → `contact_click` → `booking_complete` and see where patients drop off
5. **Value tracking** — For `booking_complete`, GA4 tracks the monetary value of each conversion, allowing you to see revenue per doctor, per traffic source, per campaign

### Why "Create with Code" Was Chosen

The alternative ("Create without code") derives new events from existing ones using server-side rules (e.g., "when `page_view` fires and URL contains X, create a new event"). This is not what we need — our events are already being fired directly from React components with rich parameters. "Create with code" simply tells GA4: "I will send events with this name from my website, recognize them."

### Important Notes

- These are **property-wide settings** — they apply to all data streams, all doctors.
- Events will show "No stream data detected" until the first time they fire on the live site.
- Once real traffic triggers these events, data will appear in GA4 reports within 24-48 hours (Realtime reports show data immediately).
- The key event status propagates to all data streams automatically.

---

## Change 3: Custom Dimensions

### Where

GA4 Console → Admin → Data display → **Custom definitions** → Create custom dimension

### What Was Changed

Six custom dimensions were created, all with **Event** scope:

| Dimension Name | Event Parameter | Purpose |
|---|---|---|
| Doctor Slug | `doctor_slug` | The unique identifier for each doctor. This is the primary dimension for per-doctor analytics — filtering any report by this dimension shows data for a single doctor. |
| Doctor Name | `doctor_name` | The human-readable doctor name (e.g., "Dra. Maria Garcia"). Useful for reports where slugs are not user-friendly. |
| Specialty | `specialty` | The doctor's primary specialty (e.g., "Dermatologia"). Enables filtering and grouping reports by medical specialty. |
| Contact Method | `contact_method` | How the patient contacted the doctor: "whatsapp", "phone", or "email". Shows which contact channel is most popular per doctor. |
| Click Location | `click_location` | Where on the page the button was clicked: "hero", "sidebar", "mobile_cta", "blog_sidebar", "clinic_section". Shows which UI placement drives the most engagement. |
| Article Slug | `article_slug` | The unique identifier for a blog article. Enables per-article analytics for the doctor's blog. |

### Why Custom Dimensions Are Necessary

When the code fires an event like:

```javascript
gtag('event', 'contact_click', {
  doctor_slug: 'dra-maria-garcia',
  contact_method: 'whatsapp',
  click_location: 'hero'
});
```

GA4 receives all three parameters. However, **without registering them as custom dimensions, they are invisible in reports**. GA4 collects the raw data but won't let you:

- Filter reports by `doctor_slug` to see one doctor's performance
- Create a breakdown showing WhatsApp vs phone vs email contact methods
- Compare conversion rates between hero buttons and sidebar buttons
- See which specialty gets the most profile views

After registering these as custom dimensions, all of this becomes possible in standard reports and custom explorations.

### How Parameters Map to Dimensions

```
Code sends:                          GA4 stores as:
─────────────────────────────────    ──────────────────────────
doctor_slug: "dra-maria-garcia"  →   Custom dimension "Doctor Slug"
contact_method: "whatsapp"       →   Custom dimension "Contact Method"
click_location: "hero"           →   Custom dimension "Click Location"
```

The "Event parameter" field in GA4 must match **exactly** what the code sends (lowercase, with underscores). The "Dimension name" is just a friendly label for the GA4 UI.

### Why Event Scope (Not User Scope)

GA4 dimensions can be either:

- **User scope** — The value persists across all events for a user (e.g., "subscription plan")
- **Event scope** — The value is specific to each individual event

All our dimensions are **event-scoped** because:

- A single user might visit multiple doctors — `doctor_slug` changes per event
- A single user might use WhatsApp on one visit and phone on another — `contact_method` changes per event
- A single user might click the hero button once and the sidebar another time — `click_location` changes per event

### Important Notes

- This is a **one-time, property-wide configuration**. It does not need to be repeated per doctor.
- Custom dimensions are **not retroactive** — they only apply to events received after creation. Events that fired before these dimensions were created will not have dimension data in reports.
- GA4 allows up to 50 event-scoped custom dimensions per property (free tier). We are using 6.
- The "Event parameter" values were typed manually because GA4's dropdown only shows parameters it has already received. Since no events had fired yet, the dropdown was empty.

---

## What Was NOT Changed (And Why)

### Search Console Verification Meta Tag — Not Needed

The original plan included adding a `<meta name="google-site-verification">` tag to `layout.tsx`. This turned out to be unnecessary because Search Console was already verified using the **DNS domain name provider method**. DNS verification is actually the preferred approach because:

- It covers all subdomains automatically
- It doesn't require any code changes
- It persists even if the site is rebuilt or redeployed
- It's the most reliable verification method

### Global Google Ads ID Environment Variable — Left Commented Out

`NEXT_PUBLIC_GOOGLE_ADS_ID` remains commented out in `apps/public/.env`. The business model is to assign each doctor their own `AW-XXXXXXXXXX` ID via the admin portal. A global fallback is unnecessary — if a doctor doesn't have an Ads ID, it means they're not running ads, which is the correct behavior.

### No Code Changes Were Made

All three changes (data retention, key events, custom dimensions) were made entirely in the GA4 web console. The codebase was not modified because the tracking implementation was already complete — the code was already sending the right events with the right parameters. The GA4 console just needed to be told how to interpret and display that data.

---

## Verification

### How to Confirm Everything Is Working

1. **Data Retention:** Admin → Data collection and modification → Data Retention → should show "14 months"

2. **Key Events:** Admin → Data display → Events → should show:
   - `booking_complete` — marked as key event, "Create with code", counting: once per event
   - `contact_click` — marked as key event, "Create with code", counting: once per event
   - Both will show "No stream data detected" until events fire on the live site

3. **Custom Dimensions:** Admin → Data display → Custom definitions → should show 6 dimensions:
   - Doctor Slug (`doctor_slug`)
   - Doctor Name (`doctor_name`)
   - Specialty (`specialty`)
   - Contact Method (`contact_method`)
   - Click Location (`click_location`)
   - Article Slug (`article_slug`)

4. **Live Test:** Visit a doctor profile on the deployed site → GA4 Realtime report should show the visit within seconds, including custom dimension values

### What "No Stream Data Detected" Means

This message appears next to events that have been created but haven't fired yet. It is **normal and expected** for a newly configured property. Once the live site receives real traffic and users trigger these events, the message will disappear and be replaced with event counts.

---

## Summary

| Configuration | What | Why | Scope |
|---|---|---|---|
| Data Retention | Changed from 2 months to 14 months | Preserve detailed, filterable event data for over a year | One-time, property-wide |
| Key Event: `booking_complete` | Created and marked as key event | Track confirmed appointments as primary business goal with monetary value | One-time, property-wide |
| Key Event: `contact_click` | Created and marked as key event | Track patient outreach (WhatsApp/phone) as lead generation goal | One-time, property-wide |
| Custom Dimension: `doctor_slug` | Registered event parameter | Enable per-doctor filtering in all GA4 reports | One-time, property-wide |
| Custom Dimension: `doctor_name` | Registered event parameter | Human-readable doctor name in reports | One-time, property-wide |
| Custom Dimension: `specialty` | Registered event parameter | Group and filter reports by medical specialty | One-time, property-wide |
| Custom Dimension: `contact_method` | Registered event parameter | See which contact channel (WhatsApp/phone/email) is most used | One-time, property-wide |
| Custom Dimension: `click_location` | Registered event parameter | See which UI placement (hero/sidebar/mobile) drives the most clicks | One-time, property-wide |
| Custom Dimension: `article_slug` | Registered event parameter | Per-article blog analytics | One-time, property-wide |

All configurations are **one-time and property-wide**. They do not need to be repeated for each doctor. The per-doctor data separation is handled by the `doctor_slug` parameter that the code already sends with every event.
