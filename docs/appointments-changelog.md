# Appointments System Rewrite — Changelog

**Project:** tusalud.pro
**Started:** 2026-03-14
**Reference plan:** `docs/appointments-rewrite.md`

---

## Overview

Full rewrite of the appointments system. Six steps total.

| Step | Description | Status |
|---|---|---|
| 1 | API quick fixes (auth, stale data, shared utils) | DONE |
| 2 | DB migrations (is_public, clinic_locations) | DONE |
| 3 | Multi-clinic profile UI (ClinicSection, doctors API) | DONE |
| 4 | Rewrite bookings/instant + fix availability | DONE |
| 5 | Build new doctor UI at /appointments-v2 | DONE |
| 6 | Swap + cleanup | DONE |

---

## Step 1 — API quick fixes

**Date:** 2026-03-14
**Status:** DONE

### New file

**`apps/api/src/lib/appointments-utils.ts`** (created)
Shared utility functions extracted from booking routes to eliminate duplication:
- `getCalendarTokens(doctorId)` — was duplicated in 4 files
- `generateConfirmationCode()` — was duplicated in 2 files
- `generateReviewToken()` — was duplicated in 2 files
- `calcEndTime(startTime, duration)` — was duplicated in 2 files

### Changed files

**`apps/api/src/app/api/appointments/slots/bulk/route.ts`**
- FIXED: No authentication check — anyone on the internet could delete/close/open any doctor's slots
- Added `validateAuthToken` — unauthenticated requests return 401
- Added role check — only DOCTOR and ADMIN roles allowed
- Added ownership scoping — doctors can only act on their own slots (`doctorId` added to every Prisma query)
- Admins retain ability to act on any doctor's slots
- Removed local `getCalendarTokens` — now imported from `appointments-utils`
- Removed unused `resolveTokens` import from `google-calendar`

**`apps/api/src/app/api/doctors/[slug]/availability/route.ts`**
- FIXED: Used stale `currentBookings` DB counter to check slot availability — patients could see slots shown as available that were actually full
- Replaced with live count via Prisma `_count.bookings` (counts only non-cancelled/completed/no-show bookings)
- Response still includes `currentBookings` field (set to live count) for backward compatibility with `BookingWidget`
- Removed 6 debug `console.log` statements that were leaking internal data in production
- Removed 2 extra `prisma.appointmentSlot.count()` calls that existed only to feed the debug logs

**`apps/api/src/app/api/appointments/bookings/route.ts`**
- Removed local `getCalendarTokens`, `generateConfirmationCode`, `generateReviewToken`
- Removed `import crypto from 'crypto'` (no longer needed)
- Removed `resolveTokens` from google-calendar import
- Added `import { getCalendarTokens, generateConfirmationCode, generateReviewToken } from '@/lib/appointments-utils'`
- No behavioral changes

**`apps/api/src/app/api/appointments/bookings/instant/route.ts`**
- Removed local `getCalendarTokens`, `generateConfirmationCode`, `generateReviewToken`, `calcEndTime`
- Removed `import crypto from 'crypto'`
- Removed `resolveTokens` from google-calendar import
- Added `import { getCalendarTokens, generateConfirmationCode, generateReviewToken, calcEndTime } from '@/lib/appointments-utils'`
- No behavioral changes

**`apps/api/src/app/api/appointments/bookings/[id]/route.ts`**
- Removed local `getCalendarTokens`
- Removed `resolveTokens` from google-calendar import
- Added `import { getCalendarTokens } from '@/lib/appointments-utils'`
- No behavioral changes

---

## Step 2 — DB migrations

**Date:** 2026-03-14
**Status:** DONE

### Files to create

- `packages/database/prisma/migrations/add-slot-is-public.sql`
- `packages/database/prisma/migrations/add-clinic-locations.sql`

### Schema changes

- `AppointmentSlot`: add `isPublic Boolean @default(true)` and `locationId String?`
- New model: `ClinicLocation` (table `public.clinic_locations`)
- `Doctor`: add `clinicLocations ClinicLocation[]` relation

### Run order

1. Run `add-slot-is-public.sql` on local DB
2. Run `add-clinic-locations.sql` on local DB
3. Test locally
4. Run both on Railway before pushing code
5. `pnpm db:generate`
6. Push code

---

## Step 3 — Multi-clinic profile UI

**Date:** 2026-03-14
**Status:** DONE

### Changed files

**`apps/api/src/app/api/doctors/[slug]/route.ts`**
- GET: added `clinicLocations: { orderBy: { displayOrder: 'asc' } }` to include
- PUT: added `clinic_locations[]` upsert logic inside transaction (upsert by id, delete removed, enforce max 2); falls back to `clinic_info` shape for backward compat (admin app); backward-compat old `clinicAddress`/`clinicPhone`/etc. columns written from default location via nullish coalescing

**`apps/api/src/app/api/doctors/route.ts`**
- POST: added nested `clinicLocations.create` — creates one default `ClinicLocation` row from `clinic_info` on every new doctor

**`apps/api/src/app/api/doctors/[slug]/locations/route.ts`** (new)
- Lightweight public GET — returns `ClinicLocation[]` for a doctor by slug, ordered by `displayOrder`

**`apps/doctor/src/components/profile/ClinicSection.tsx`**
- Full rewrite: reads `formData.clinic_locations[]` instead of `formData.clinic_info`
- Shows up to 2 `LocationCard` components; each has name, address, phone, WhatsApp, 7-day hours, geo coords, Maps button
- "+ Agregar segundo consultorio" button shown when only 1 location exists
- "Eliminar segundo consultorio" button on second card only

**`apps/doctor/src/app/dashboard/mi-perfil/page.tsx`**
- `DEFAULT_FORM_DATA`: replaced flat `clinic_info` with `clinic_locations: []`
- `fetchProfile`: maps `d.clinicLocations` → array; fallback to old `clinicAddress` columns if empty

---

## Review session — Bugs and plan gaps found between Steps 3 and 4

**Date:** 2026-03-14
**Status:** DONE

Second-pass code review before proceeding to Step 4. Three bugs missed by the original audit were found and fixed. Plan gaps identified and assigned to steps.

### Bugs fixed

**`apps/api/src/app/api/appointments/bookings/[id]/route.ts` — PATCH had no auth**
- Added auth: authenticated callers (doctor/admin) can perform any valid transition with ownership check; unauthenticated callers can only set `CANCELLED` when `confirmationCode` matches the booking
- Added doctor ownership check: `currentBooking.doctorId !== callerDoctorId` → 403

**`apps/public/src/app/cancel-booking/page.tsx`**
- Updated to include `confirmationCode: code.trim()` in PATCH body (required by auth fix above)

**`apps/api/src/app/api/appointments/bookings/instant/route.ts` — no SMS**
- Added `sendPatientSMS(smsDetails, 'CONFIRMED')` + `sendDoctorSMS(smsDetails)` after booking creation
- Fetches doctor info for SMS details; uses `doctor.clinicAddress` as placeholder (Step 4 will update to `slot.location?.address ?? doctor.clinicAddress`)

**`apps/doctor/src/lib/conflict-checker.ts` — checked `slot.status` which doesn't exist**
- `slot.status === 'AVAILABLE' || slot.status === 'BOOKED'` always evaluated to `false`
- Fixed to: `slot.isOpen === true || (slot.currentBookings ?? 0) > 0`
- `hasBookedAppointments` fixed similarly: `(slot.currentBookings ?? 0) > 0`

### Plan gaps assigned to steps

- Slots API location support (`slots/route.ts` GET/POST, `slots/[id]/route.ts` PUT) → Step 4
- SMS location fallback in booking routes → Step 4
- Gap A (private slot cleanup on cancel/delete) → Step 4

---

## Step 4 — Rewrite bookings/instant + fix availability

**Date:** 2026-03-14
**Status:** DONE

### Changed files

**`apps/api/src/app/api/appointments/bookings/instant/route.ts`** (full rewrite — 4a + 4j)
- Now creates `AppointmentSlot { isPublic: false, isOpen: false, locationId? }` + `Booking { slotId }` in one `$transaction`
- No more freeform bookings (`slotId: null`) — dual data model eliminated
- Accepts `locationId` in request body
- P2002 → 409 with message "Ya existe un horario en este tiempo"
- GCal event ID stored on the slot (not the booking)
- SMS uses `slot.location?.address ?? doctor.clinicAddress` (replaces placeholder)

**`apps/api/src/app/api/doctors/[slug]/availability/route.ts`** (4b)
- Added `isPublic: true` to WHERE filter — private slots never appear on public booking page
- Added `location: { select: { name, address } }` to slot select
- Location included in each slot in the response

**`apps/api/src/app/api/appointments/bookings/[id]/route.ts`** (4c + 4i)
- Gap A (all terminal PATCH states): if booking's slot is private (`isPublic: false`), atomically null out `slotId` and delete the slot — covers CANCELLED, COMPLETED, and NO_SHOW; booking record preserved for history
- Gap A (DELETE): if booking's slot is private, delete booking then slot in one transaction
- SMS (4i): `slot: { include: { location } }` added to updatedBooking fetch; `clinicAddress` now uses `slot.location?.address ?? doctor.clinicAddress`

**`apps/api/src/app/api/appointments/bookings/route.ts`** (4h)
- `bookingWithSlot` fetch: `slot: true` → `slot: { include: { location: { select: { address } } } }`
- SMS `clinicAddress` now uses `slot?.location?.address ?? doctor.clinicAddress`
- NOTE: 4d (remove OR freeform date filter) skipped pending Railway verification of zero freeform bookings

**`apps/api/src/app/api/appointments/slots/route.ts`** (4e + 4f)
- GET: added `location: { select: { name, address } }` to include; included in response per slot
- POST: accepts `locationId` from body; passed to `slotsToCreate` in both single and recurring modes

**`apps/api/src/app/api/appointments/slots/[id]/route.ts`** (4g)
- PUT: accepts `locationId` from body; `locationId !== undefined && { locationId: locationId ?? null }` added to update data

---

## Review session — Bugs found after Step 4

**Date:** 2026-03-14
**Status:** DONE

Second-pass review of all Step 4 changes. Three bugs found and fixed.

### Bugs fixed

**`apps/api/src/app/api/appointments/slots/[id]/route.ts` — PUT/DELETE/PATCH had no auth**
- `validateAuthToken` was added to `slots/bulk/route.ts` in Step 1 but this file was missed
- Added `validateAuthToken` + ownership check to all 3 handlers (PUT, DELETE, PATCH)
- Doctors can only act on their own slots; admins can act on any

**`apps/api/src/app/api/appointments/bookings/route.ts` POST — `isPublic` not validated**
- Transaction checked `isOpen` but not `isPublic` — a private slot with `isOpen: true` could be publicly booked
- Added `if (!freshSlot.isPublic)` check inside the transaction (before the `isOpen` check)
- Defense in depth: private slots are `isOpen: false` so they were already blocked, but the intent is now explicit

**`apps/api/src/app/api/appointments/bookings/[id]/route.ts` PATCH — Gap A incomplete**
- Gap A originally only ran on `CANCELLED`; COMPLETED and NO_SHOW bookings on private slots left orphaned slots in DB
- Extended to all terminal states: `if (isPrivateSlot)` (not `if (newStatus === 'CANCELLED' && isPrivateSlot)`)
- Booking record is preserved in all cases; only the private slot is deleted

### Known gaps deferred to Step 6

- `freeformConflict` check in `bookings/route.ts` POST (`slotId: null` query) is now dead code for new data — safe to leave as legacy safety net, remove in Step 6
- `instant/route.ts` behavior change: attempting to create an instant booking when a public slot already exists at the same time now returns 409 (was: silently close the public slot). Old appointments UI doesn't handle 409 gracefully — Step 5 new UI must handle it explicitly

---

## Step 5 — Build new doctor UI at /appointments-v2

**Date:** 2026-03-14
**Status:** DONE

### Files created

All 16 files written at `apps/doctor/src/app/appointments-v2/` (now renamed to `appointments/` in Step 6):

- `page.tsx` — thin shell composing 3 hooks + all components
- `layout.tsx` — copied from old layout
- `_hooks/useCalendar.ts` — month nav, calendar grid, view mode, list date
- `_hooks/useSlots.ts` — fetch/create/delete/toggle, clinicLocations, bulk actions
- `_hooks/useBookings.ts` — fetch all bookings, status changes, delete, filters
- `_components/BookingsSection.tsx` — collapsible bookings table with filters
- `_components/AppointmentsCalendar.tsx` — calendar grid with slot dot indicators
- `_components/DaySlotPanel.tsx` — selected day's slot list with per-slot actions
- `_components/SlotListView.tsx` — list view table with checkboxes + bulk action bar
- `_components/BookingStatusBadge.tsx` — shared status badge + label
- `_components/CreateSlotsModal.tsx` — ported from old + location picker for 2-location doctors
- `_components/BookPatientModal/index.tsx` — step orchestration
- `_components/BookPatientModal/SlotPickerStep.tsx` — slot picker + location display + 409 conflict error
- `_components/BookPatientModal/PatientFormStep.tsx` — patient form
- `_components/BookPatientModal/SuccessStep.tsx` — confirmation screen
- `_components/AppointmentChatPanel.tsx` — AI chat panel (copied from old)

### Bug fixed during Step 5
- `BookPatientModal/index.tsx` line 230: unescaped `"` inside string literal — replaced outer quotes with single quotes

---

## Step 6 — Swap + cleanup

**Date:** 2026-03-14
**Status:** DONE

### Actions completed

**`apps/doctor/src/app/api/appointments-chat/route.ts`**
- `slotEstado()`: replaced `slot.currentBookings` (stale DB counter) with `slot.bookings.length` (live count from included relation)
- `lugaresOcupados` field in context: same fix

**`apps/public/src/components/doctor/BookingWidget.tsx`**
- Added `bookingError` state
- Replaced 2x `alert()` with `setBookingError(...)`
- Error message rendered inline above submit button; cleared on next submit attempt

**`apps/api/src/app/api/appointments/bookings/route.ts`**
- Removed `freeformConflict` check (dead code — no more `slotId: null` bookings created since Step 4)
- Removed `FREEFORM_CONFLICT` branch from error handler

**Directory rename**
- `appointments/` → `appointments-old/`
- `appointments-v2/` → `appointments/`
- `appointments-old/` deleted

**Import path fixes (caused by rename)**
- `_components/AppointmentChatPanel.tsx`: updated `AppointmentSlot` + `Booking` type imports → `_hooks/useSlots` + `_hooks/useBookings`
- `hooks/useAppointmentsChat.ts`: same import fix

### Deferred (not done)
- `bookings/route.ts` GET — remove `slotId: null` OR date filter (4d): verify zero freeform bookings in Railway first, then remove
