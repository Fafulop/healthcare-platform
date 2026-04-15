# Doctor Profile Edit — Admin vs Doctor App Payload Mismatch

**Date:** 2026-04-14
**Status:** Investigation in progress. Several bugs fixed. Full payload comparison pending.

---

## The Problem

Two apps can edit the same doctor profile via the same API endpoint:

```
PUT /api/doctors/[slug]   (apps/api/src/app/api/doctors/[slug]/route.ts)
```

- **Admin app** — `apps/admin/src/app/doctors/[slug]/edit/page.tsx` (`handleSubmit`)
- **Admin app quick-edits** — `apps/admin/src/app/doctors/page.tsx` (`handleUpdatePalette`, `handleUpdateAdsId`)
- **Doctor app** — `apps/doctor/src/components/profile/` (ClinicSection, profile save)

If either app sends a PUT payload that is missing a field, or serializes a field differently, the API will silently overwrite good data with bad data. Neither the doctor nor the admin sees an error — the save succeeds, but data is lost or corrupted.

This is the root cause of every clinic-location and profile bug found in the 2026-04-13/14 investigation sessions.

---

## API Contract (what PUT /api/doctors/[slug] expects)

The route accepts these top-level fields in the request body:

| Field | Type | Notes |
|---|---|---|
| `doctor_full_name` | string | |
| `last_name` | string | |
| `slug` | string | SEO-protected — changes rejected |
| `primary_specialty` | string | |
| `subspecialties` | string[] | |
| `cedula_profesional` | string | |
| `hero_image` | string | |
| `location_summary` | string | |
| `city` | string | |
| `short_bio` | string | |
| `long_bio` | string | |
| `years_experience` | number | |
| `conditions` | string[] | |
| `procedures` | string[] | |
| `services_list` | array | see below |
| `education_items` | array | |
| `certificate_images` | array | |
| `clinic_locations` | array | preferred format — includes `id` |
| `clinic_info` | object | legacy fallback — no `id`, single clinic only |
| `faqs` | array | |
| `carousel_items` | array | |
| `appointment_modes` | string[] | |
| `next_available_date` | string (ISO date) | |
| `social_links` | object | see below |
| `color_palette` | string | |
| `google_ads_id` | string \| null | |

### services_list item shape
```typescript
{
  service_name: string
  short_description: string
  duration_minutes: number
  price: number
  is_booking_active: boolean   // ← critical: defaults to true if missing
}
```

### clinic_locations item shape (preferred)
```typescript
{
  id?: string          // existing record ID — MUST be included for updates
  name: string
  address: string
  phone: string
  whatsapp: string
  hours: Record<string, string>   // empty object {} = no hours set
  geoLat: number
  geoLng: number
  isDefault: boolean
}
```

### social_links shape
```typescript
{
  linkedin?: string
  twitter?: string
  instagram?: string
  facebook?: string
  tiktok?: string
}
```

---

## Bugs Found and Fixed (2026-04-13 and 2026-04-14)

### Bug 1 — Clinic silent deletion (commit `a9c5f54a`, 2026-04-13)
**Root cause:** PUT endpoint hard-deleted any clinic not present in the incoming payload.
**Symptom:** A doctor with 2 clinics loses one silently when the admin saves from a form that only loaded 1.
**Fix:** API pre-check guard before transaction — blocks deletion if slots are assigned to the clinic being removed. `window.confirm` added in both admin wizard and doctor app before removing a clinic.

### Bug 2 — Admin wizard hours pre-fill (commit `99f78c81`, 2026-04-14)
**Root cause:** Admin wizard initialized clinic hours with `"9:00 AM - 6:00 PM"` defaults when `loc.hours` was falsy.
**Symptom:** Admin saves profile → closed days get overwritten with fake open hours.
**Affected paths:**
- `fetchDoctorData` when loading existing `clinicLocations` → fixed to `loc.hours || {}`
- `fetchDoctorData` when falling back to legacy `clinicHours` column → fixed to `doctor.clinicHours || {}`
- `addSecondLocation` in admin wizard → fixed to `hours: {}`

### Bug 3 — Doctor app DEFAULT_HOURS (commit `99f78c81`, 2026-04-14)
**Root cause:** `DEFAULT_HOURS` constant in `ClinicSection.tsx` was a full hardcoded schedule used when adding a second location.
**Symptom:** Doctor adds second clinic via doctor app → fake hours pre-filled and possibly saved.
**Fix:** `DEFAULT_HOURS` changed to `{}`.

### Bug 4 — Admin quick-edit sends `clinic_info` instead of `clinic_locations` (commit `1a5031f8`, 2026-04-14)
**Root cause:** `handleUpdatePalette` and `handleUpdateAdsId` in `apps/admin/src/app/doctors/page.tsx` built the PUT payload using the legacy `clinic_info` format (no IDs). The API's empty-ID guard (added in Bug 1 fix) blocked the save with a 400 error.
**Symptom:** Trying to link a Google Ads ID → "No se puede eliminar un consultorio que tiene 613 horarios asignados."
**Fix:** Both functions now send `clinic_locations` array built from `doctor.clinicLocations` with `id` preserved.

### Bug 5 — Admin quick-edit missing `is_booking_active` (commit `1a5031f8`, 2026-04-14)
**Root cause:** Both quick-edit payloads mapped services without `is_booking_active`.
**Symptom:** Any service with booking disabled (`false`) gets silently re-enabled every time palette or Google Ads is saved.
**Fix:** Added `is_booking_active: s.isBookingActive ?? true` to both payloads.

### Bug 6 — Admin quick-edit incomplete social_links (commit `1a5031f8`, 2026-04-14)
**Root cause:** Both quick-edit payloads only included `linkedin` and `twitter` in `social_links`.
**Symptom:** Instagram, Facebook, TikTok links cleared silently on palette or Google Ads save.
**Fix:** All 5 social fields now included in both payloads.

### Bug 7 — Public ClinicLocationSection empty hours renders blank (commit `99f78c81`, 2026-04-14)
**Root cause:** `renderHours` only checked `!hours` — an object with all empty-string values (`{ monday: "" }`) passed the check but rendered an empty div.
**Fix:** Changed to `Object.values(hours).some(v => v && v.trim() !== '')`.

### Bug 8 — Admin wizard `social_links` missing instagram/facebook/tiktok (commit pending, 2026-04-14)
**Root cause:** Admin wizard `fetchDoctorData` only populated `linkedin` and `twitter` in `social_links`. When the admin saved a doctor profile, the three missing fields were sent as `undefined`, causing the API to overwrite existing values with `null`.
**Symptom:** A doctor sets Instagram/Facebook/TikTok links via the doctor app → admin edits any profile field and saves → those 3 links are silently cleared.
**Fix:** Added `instagram: doctor.socialInstagram`, `facebook: doctor.socialFacebook`, `tiktok: doctor.socialTiktok` to the `social_links` block in `fetchDoctorData`.
**Note:** Neither the admin wizard nor the doctor app has UI inputs to *edit* these fields — they are loaded from DB and preserved on save, but only editable via direct DB access or a future UI step.

---

## Full Payload Comparison — Completed 2026-04-14

A full field-by-field audit was run comparing the admin wizard `handleSubmit`, the doctor app profile save (`mi-perfil/page.tsx`), and the API route.

| Field | Admin wizard | Doctor app | Issue |
|---|---|---|---|
| `doctor_full_name` | ✅ | ✅ | — |
| `last_name` | ✅ | ✅ | — |
| `primary_specialty` | ✅ | ✅ | — |
| `subspecialties` | ✅ | ✅ | — |
| `cedula_profesional` | ✅ | ✅ | — |
| `hero_image` | ✅ | ✅ | — |
| `location_summary` | ✅ | ✅ | — |
| `city` | ✅ | ✅ | — |
| `short_bio` | ❌ | ❌ | Field exists in API/DB but never sent — no data loss risk (API doesn't default it), but field is unreachable via UI |
| `long_bio` | ✅ | ✅ | — |
| `years_experience` | ✅ | ✅ | — |
| `conditions` | ✅ | ✅ | — |
| `procedures` | ✅ | ✅ | — |
| `next_available_date` | ✅ | ✅ | — |
| `appointment_modes` | ✅ | ✅ | — |
| `social_links.linkedin` | ✅ | ✅ | — |
| `social_links.twitter` | ✅ | ✅ | — |
| `social_links.instagram` | ✅ fixed | ✅ | Was missing in admin, fixed Bug 8 |
| `social_links.facebook` | ✅ fixed | ✅ | Was missing in admin, fixed Bug 8 |
| `social_links.tiktok` | ✅ fixed | ✅ | Was missing in admin, fixed Bug 8 |
| `color_palette` | ✅ | ✅ | — |
| `google_ads_id` | ❌ | ❌ | Intentional — managed via dedicated quick-edit modal |
| `services_list[].service_name` | ✅ | ✅ | — |
| `services_list[].short_description` | ✅ | ✅ | — |
| `services_list[].duration_minutes` | ✅ | ✅ | — |
| `services_list[].price` | ✅ | ✅ | — |
| `services_list[].is_booking_active` | ✅ | ✅ | — |
| `education_items` | ✅ | ✅ | — |
| `certificate_images` | ✅ | ✅ | — |
| `clinic_locations[].id` | ✅ | ✅ | — |
| `clinic_locations[].name` | ✅ | ✅ | — |
| `clinic_locations[].address` | ✅ | ✅ | — |
| `clinic_locations[].phone` | ✅ | ✅ | — |
| `clinic_locations[].whatsapp` | ✅ | ✅ | — |
| `clinic_locations[].hours` | ✅ | ✅ | — |
| `clinic_locations[].geoLat` | ✅ | ✅ | — |
| `clinic_locations[].geoLng` | ✅ | ✅ | — |
| `clinic_locations[].isDefault` | ✅ | ✅ | — |
| `faqs` | ✅ | ✅ | — |
| `carousel_items[].type` | ✅ | ✅ | — |
| `carousel_items[].src` | ✅ | ✅ | — |
| `carousel_items[].thumbnail` | ❌ | ❌ | API accepts it, never sent — thumbnail always null. Minor. |
| `carousel_items[].alt` | ✅ | ✅ | — |
| `carousel_items[].caption` | ✅ | ✅ | — |
| `carousel_items[].name` | ❌ | ❌ | Video metadata — API accepts, never sent. Minor. |
| `carousel_items[].description` | ❌ | ❌ | Video metadata — API accepts, never sent. Minor. |
| `carousel_items[].uploadDate` | ❌ | ❌ | Video metadata — API accepts, never sent. Minor. |
| `carousel_items[].duration` | ❌ | ❌ | Video metadata — API accepts, never sent. Minor. |

**Conclusion:** All data-loss bugs are fixed. Remaining gaps (`short_bio`, carousel metadata, `thumbnail`) are minor — both apps are equally incomplete so no one app overwrites the other.

---

## Files Involved

| File | Role |
|---|---|
| `apps/api/src/app/api/doctors/[slug]/route.ts` | PUT endpoint — single source of truth for what the API accepts |
| `apps/admin/src/app/doctors/[slug]/edit/page.tsx` | Admin wizard — full profile edit |
| `apps/admin/src/app/doctors/page.tsx` | Admin list — quick-edit modals (palette, Google Ads) |
| `apps/doctor/src/components/profile/ClinicSection.tsx` | Doctor app — clinic locations section |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Doctor app — full profile save |
| `apps/public/src/components/doctor/ClinicLocationSection.tsx` | Public profile — clinic hours display |
