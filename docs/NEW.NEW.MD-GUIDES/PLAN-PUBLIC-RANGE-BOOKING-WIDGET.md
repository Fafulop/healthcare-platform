# Plan: Wire RangeBookingWidget into Public App

## Status: IMPLEMENTED — 2026-04-25

---

## 1. Context

The RangeBookingWidget (`apps/public/src/components/doctor/RangeBookingWidget.tsx`) was built in Phase 1 but never wired into the public doctor profile pages. Currently the public app hardcodes `BookingWidget` (slot-based) everywhere. Doctors using range-based scheduling have no public booking flow.

### Goal

Patients visiting a doctor's public profile should see the correct booking widget based on the doctor's scheduling system:
- **Ranges exist** → RangeBookingWidget (calendar-first flow)
- **No ranges** → BookingWidget (legacy slot-based flow)

---

## 2. Detection Strategy: Count-Based (No DB Migration)

Instead of adding a `schedulingMode` flag to the Doctor model (which requires a migration), detect dynamically by checking if the doctor has any `AvailabilityRange` records.

```
if (doctor has AvailabilityRange records) → RangeBookingWidget
else → BookingWidget (legacy)
```

This means:
- Doctors with ranges automatically get the new flow
- All other doctors stay on slots with zero risk
- No migration, no manual flag-setting
- When a doctor creates their first range, they automatically switch to the new flow

---

## 3. Key Differences Between Widgets

| Aspect | BookingWidget (slots) | RangeBookingWidget (ranges) |
|--------|----------------------|----------------------------|
| Flow order | Date → Time → Service → Form | **Date → Service → Time → Form** (calendar-first) |
| Availability API | `GET /api/doctors/[slug]/availability?month=` | `GET /api/doctors/[slug]/range-availability?month=` (dates-only) then `?serviceId=&startDate=&endDate=` (time slots) |
| Booking API | `POST /api/appointments/bookings` (requires `slotId`) | `POST /api/appointments/range-bookings` (requires `doctorId`, `date`, `startTime`) |
| Service selection | Optional, after time | **Required, step 2** (duration needed for time slot calculation) |
| Calendar | Visible after implicit load | **Always visible immediately** |

---

## 4. Calendar-First Flow (Public App)

The public-facing widget uses a **calendar-first** flow, different from the doctor dashboard's service-first flow:

1. **Calendar** — Always visible on load. Fetches available dates (dates with any range) without needing a service selection. Uses `range-availability` API without `serviceId` (dates-only mode).
2. **Service** — Appears after patient picks a date. Shows active services with duration and price.
3. **Time** — Appears after both date AND service are selected. Fetches time slots for that specific date+service combo (needs duration for gap calculation).
4. **Form** — Patient info, visit type, modality, privacy consent, submit.

### API: Dual-Mode `range-availability`

The `GET /api/doctors/[slug]/range-availability` endpoint supports two modes:

- **Without `serviceId`**: Returns only `availableDates` (dates that have ranges). No time slot computation. Used for initial calendar display.
- **With `serviceId`**: Returns `availableDates` + `timeSlots` with full gap calculation. Used after service selection.

---

## 5. Files Modified

| File | Action |
|------|--------|
| `apps/api/src/app/api/doctors/[slug]/route.ts` | Added `hasRanges` (count-based) to response |
| `apps/api/src/app/api/doctors/[slug]/range-availability/route.ts` | Made `serviceId` optional — dates-only mode |
| `packages/types/src/doctor.ts` | Added `hasRanges?: boolean` to shared DoctorProfile |
| `apps/public/src/types/doctor.ts` | Added `hasRanges?: boolean` to local DoctorProfile |
| `apps/public/src/lib/data.ts` | Added `hasRanges` to `transformDoctorToProfile` |
| `apps/public/src/components/doctor/DynamicSections.tsx` | Added `DynamicRangeBookingWidget` dynamic export |
| `apps/public/src/components/doctor/DoctorProfileClient.tsx` | Conditional widget rendering (sidebar) + `hasRanges` prop to BookingModal |
| `apps/public/src/components/doctor/BookingModal.tsx` | `hasRanges` prop, conditional widget rendering (modal) |
| `apps/public/src/components/doctor/RangeBookingWidget.tsx` | Reordered flow: calendar-first instead of service-first |

---

## 6. Verification

1. Visit a doctor profile that HAS ranges → should see calendar-first booking flow
2. Visit a doctor profile that has NO ranges → should see classic slot-based flow
3. Calendar shows available dates immediately (no service selection needed)
4. After picking date → service selector appears
5. After picking service → time slots load
6. Book through RangeBookingWidget → booking appears in doctor dashboard
7. Mobile modal also uses the correct widget
8. No regressions on slot-based doctors

---

## 7. Test Doctors with Ranges (created 2026-04-25)

| Doctor | Slug | Schedule | Location(s) |
|--------|------|----------|-------------|
| Dr. Jose | `dr-jose` | Apr 6-30, afternoon slots (30min) | Consultorio Principal |
| Dra. Adriana | `dra-adriana-michelle` | Apr 1 - Jun 29, weekly pattern (60min) | Hospital Angeles Valle Oriente + CHRISTUS MUGUERZA Cumbres |
| Dra. Patricia | `dra-patricia-roldan-mora` | Apr 10 - Jun 30, irregular per-date (30min) | Consultorio Principal |

---

*Document created 2026-04-25. Updated with calendar-first flow redesign.*
