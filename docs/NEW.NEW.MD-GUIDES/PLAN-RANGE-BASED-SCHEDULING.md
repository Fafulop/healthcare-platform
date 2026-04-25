# Plan: Range-Based Scheduling Migration

## Status: IMPLEMENTED — Deployed 2026-04-25 (extendedBlockMinutes + bulk delete + reversible blocking via BlockedTime overlay)

---

## 1. Executive Summary

Replace the current **slot-based scheduling** (pre-generated fixed-duration slots) with a **range + service-based scheduling** system where doctors define time windows of availability and bookings are driven by service duration.

### Development Strategy: Build Side-by-Side, Test, Then Swap

The new range-based system is built as a **completely independent parallel system**. Zero modifications to existing slot-based code during development. The current system continues working untouched. Only after the new system is tested and verified correct do we swap it in.

- All new API endpoints live at NEW paths (e.g., `/api/v2/...` or `/api/appointments/ranges/...`)
- All new frontend components are NEW files (not modifications of existing ones)
- A test route or toggle provides access to the new system for verification
- The old system is never broken, never modified, never at risk

### Design Decisions (Confirmed)
| Decision | Value |
|---|---|
| Time increment granularity | 15 minutes |
| Buffer between appointments | 0 min default, configurable per doctor |
| Multiple ranges per day | Yes |
| Overlapping ranges | No |
| Existing appointments | Preserve — do not touch |
| Migration strategy | Recreate ranges for 3 doctors manually |
| Service required for booking | **Always** — at least 1 service must exist per doctor |
| Interval per range | Default from doctor setting, overridable per range (15/30/45/60 min) |
| Buffer applies | **After** appointment only (not before) |
| Patient flow order | **Service → Date → Time** (service-first) |
| Development approach | **Build side-by-side**, test independently, swap when verified |
| Modify existing code during dev | **No** — all new code in new files/endpoints |

---

## 2. Current Architecture (What Exists Today)

### Database Models
```
AppointmentSlot (appointment_slots)
├── id, doctorId, date
├── startTime ("09:00"), endTime ("10:00")
├── duration (30 or 60 — FIXED)
├── basePrice, discount, discountType, finalPrice
├── isOpen, isPublic, isInstant
├── maxBookings (default 1), currentBookings
├── locationId → ClinicLocation
└── googleEventId

Booking (bookings)
├── id, slotId (nullable — null for freeform)
├── doctorId, patientName, patientEmail, etc.
├── serviceId, serviceName
├── date, startTime, endTime, duration (freeform fields)
├── status (PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW)
├── confirmationCode, reviewToken
└── extendedBlockMinutes

Service (services)
├── id, doctorId
├── serviceName, shortDescription
├── durationMinutes ← ALREADY EXISTS (key for new system)
├── price
└── isBookingActive
```

### Current Flow
1. **Doctor** creates slots via `CreateSlotsModal` → `POST /api/appointments/slots`
   - Chooses time range + duration (30 or 60 min)
   - System generates individual `AppointmentSlot` rows (e.g., 10:00-11:00, 11:00-12:00, etc.)
2. **Patient** sees pre-made slots via `GET /api/doctors/[slug]/availability`
   - Picks a slot → selects service → fills form → `POST /api/appointments/bookings`
3. **Doctor** can also do instant bookings → `POST /api/appointments/bookings/instant`
   - Creates a private slot + booking atomically

### Files That Will Change

> **Note**: During Phase 1 (Build), only NEW files are created. No existing files are modified.
> See Sections 10 and 11 for the complete file lists per phase.

---

## 3. New Architecture

### 3.1 New Database Model: `AvailabilityRange`

```prisma
model AvailabilityRange {
  id              String   @id @default(cuid())
  doctorId        String   @map("doctor_id")

  // When
  date            DateTime                     // Normalized to midnight UTC
  startTime       String   @map("start_time")  // "09:00"
  endTime         String   @map("end_time")    // "14:00"

  // Interval: how often start times are shown to patients (15, 30, 45, or 60 min).
  // Defaults to doctor's global setting but can be overridden per range.
  intervalMinutes Int      @map("interval_minutes") // 15 | 30 | 45 | 60

  // Where
  locationId      String?  @map("location_id")

  // Calendar sync
  googleEventId   String?  @map("google_event_id")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  doctor          Doctor          @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  location        ClinicLocation? @relation(fields: [locationId], references: [id])

  @@map("availability_ranges")
  @@index([doctorId, date])
  @@unique([doctorId, date, startTime]) // Prevent duplicate ranges
  @@schema("public")
}
```

### 3.2 Doctor Model Changes

Add to the `Doctor` model:
```prisma
// Buffer time AFTER appointments (minutes). Default 0.
// Applied after every booking: next available time = booking.endTime + buffer
appointmentBufferMinutes Int @default(0) @map("appointment_buffer_minutes")

// Default interval for new ranges (15, 30, 45, or 60 min). Doctor's global default.
// Each range can override this value.
defaultIntervalMinutes   Int @default(30) @map("default_interval_minutes")

// Relations
availabilityRanges AvailabilityRange[]
```

### 3.3 Booking Model Changes

The `Booking` model already supports what we need:
- `slotId` is **nullable** (freeform bookings already exist)
- `date`, `startTime`, `endTime`, `duration` fields exist for freeform bookings
- `serviceId` and `serviceName` already exist

**New behavior**: Range-based bookings will use the freeform fields (`date`, `startTime`, `endTime`, `duration`) with `slotId = null`. No slot is created — the booking itself IS the scheduled time block.

> **This is critical**: We don't create an `AppointmentSlot` for each booking. Instead, the booking's own `date/startTime/endTime/duration` fields record when it happens, and the `AvailabilityRange` records when the doctor is available.

### 3.4 AppointmentSlot — Keep for Backward Compatibility

The `AppointmentSlot` model is **NOT deleted**. Existing slots with active bookings remain functional. The system will support both:
- **Legacy slot-based bookings** (`slotId` is set) — old bookings continue to work
- **New range-based bookings** (`slotId` is null, `date/startTime/endTime/duration` are set) — new bookings

Over time, as old bookings complete/cancel, the `AppointmentSlot` table becomes empty for each doctor.

### 3.5 Service Model — No Schema Change

`durationMinutes` already exists and is already editable. The only change is that this field **becomes mandatory** for the new booking flow (it's already populated for all existing services).

---

## 4. Availability Calculation Algorithm

This is the core of the new system. The patient has already selected a service, so we know the duration.

```
INPUT:
  - ranges: AvailabilityRange[] for that date (each with its own intervalMinutes)
  - bookings: Booking[] for that date (PENDING or CONFIRMED, not cancelled/completed)
  - serviceDuration: number (from selected service, in minutes)
  - bufferMinutes: number (from doctor settings — applied AFTER each booking only)

ALGORITHM:
  1. For each range, create a timeline: [range.startTime → range.endTime]
  2. For each booking on that date, compute its blocked window:
     blocked = [booking.startTime → booking.endTime + bufferMinutes]
     - Buffer is AFTER only (not before the appointment)
     - Also include legacy slot-based bookings: [slot.startTime → slot.endTime + bufferMinutes]
  3. Subtract all blocked windows from each range → remaining = "free windows"
  4. For each free window within a range:
     - Generate start times at that RANGE's intervalMinutes (not a global fixed value)
     - A start time T is valid only if: T + serviceDuration <= window.endTime
     - Also: T + serviceDuration + buffer must not overlap next booking (already handled by step 3)
  5. Return the list of available start times

EXAMPLE 1 — Buffer = 0:
  Range: 10:00–14:00, interval: 15min
  Existing bookings: 10:00–10:45 (Consulta), 11:30–12:00 (Limpieza)
  Buffer: 0 min
  Service requested: 45min

  Blocked windows: [10:00–10:45], [11:30–12:00]
  Free windows: [10:45–11:30], [12:00–14:00]

  Window [10:45–11:30] = 45 min, interval 15min:
    - 10:45 (ends 11:30) ✓ (exactly fits)

  Window [12:00–14:00] = 120 min, interval 15min:
    - 12:00, 12:15, 12:30, 12:45, 13:00, 13:15 ✓ (all fit)

  Available: [10:45, 12:00, 12:15, 12:30, 12:45, 13:00, 13:15]

EXAMPLE 2 — Buffer = 15min:
  Range: 09:00–14:00, interval: 30min
  Existing booking: 10:00–10:45 (Consulta)
  Buffer: 15 min (after only)
  Service requested: 30min

  Blocked window: [10:00 → 10:45 + 15min buffer = 11:00]
  Free windows: [09:00–10:00], [11:00–14:00]

  Window [09:00–10:00] = 60 min, interval 30min:
    - 09:00 (ends 09:30) ✓
    - 09:30 (ends 10:00) ✓

  Window [11:00–14:00] = 180 min, interval 30min:
    - 11:00, 11:30, 12:00, 12:30, 13:00, 13:30 ✓ (all fit)

  Available: [09:00, 09:30, 11:00, 11:30, 12:00, 12:30, 13:00, 13:30]
  Note: 10:00 and 10:30 are NOT shown (inside blocked window)

EXAMPLE 3 — Two ranges with different intervals:
  Range A: 09:00–13:00, interval: 15min
  Range B: 16:00–20:00, interval: 60min
  No existing bookings, buffer: 0
  Service requested: 60min

  Range A (15min interval):
    - 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30, 11:45, 12:00
    (last valid: 12:00, ends 13:00 = range end)

  Range B (60min interval):
    - 16:00, 17:00, 18:00, 19:00
    (last valid: 19:00, ends 20:00 = range end)
```

### 4.1 Legacy Slot Compatibility

The availability calculation must also account for existing `AppointmentSlot`-based bookings. When computing blocked time for a date:

```
blocked_times =
  UNION(
    -- New range-based bookings (slotId = null)
    SELECT date, startTime, endTime FROM bookings
      WHERE doctorId = X AND date = Y AND slotId IS NULL
      AND status IN ('PENDING', 'CONFIRMED'),

    -- Legacy slot-based bookings
    SELECT s.date, s.startTime, s.endTime FROM bookings b
      JOIN appointment_slots s ON b.slot_id = s.id
      WHERE b.doctorId = X AND s.date = Y
      AND b.status IN ('PENDING', 'CONFIRMED')
  )
```

### 4.2 Cutoff Rule (1 hour)

Same as current: slots/times within 1 hour of current time (Mexico City TZ) are hidden from public availability.

---

## 5. API Changes

### 5.1 NEW: `POST /api/appointments/ranges` — Create Availability Range

```typescript
// Request body
{
  doctorId: string,
  mode: "single" | "recurring",
  // Single mode
  date?: string,            // "2026-05-01"
  // Recurring mode
  startDate?: string,
  endDate?: string,
  daysOfWeek?: number[],    // [0,1,2,3,4] (Mon-Fri)
  // Time
  startTime: string,        // "09:00"
  endTime: string,          // "14:00"
  // Interval (optional — defaults to doctor's defaultIntervalMinutes)
  intervalMinutes?: number,  // 15 | 30 | 45 | 60
  // Optional
  locationId?: string,
}

// Response
{
  success: true,
  count: 5,
  message: "Created 5 availability ranges"
}
```

**Validation**:
- `startTime` and `endTime` must be on 15-min boundaries (`:00`, `:15`, `:30`, `:45`)
- No overlap with existing ranges for the same doctor+date
- `endTime > startTime`
- `intervalMinutes` must be 15, 30, 45, or 60 (if provided)

### 5.2 NEW: `GET /api/appointments/ranges` — Get Ranges for Doctor

```typescript
// Query params: doctorId, startDate, endDate
// Response
{
  success: true,
  data: [
    { id: "...", date: "2026-05-01", startTime: "09:00", endTime: "14:00",
      intervalMinutes: 15, location: {...} },
    { id: "...", date: "2026-05-01", startTime: "16:00", endTime: "19:00",
      intervalMinutes: 30, location: {...} },
  ]
}
```

### 5.3 NEW: `DELETE /api/appointments/ranges/[id]` — Delete a Range

- Cannot delete if there are active bookings within the range's time window
- (Or warn and require confirmation)

### 5.4 NEW: `GET /api/doctors/[slug]/range-availability`

**Completely new endpoint** — does NOT modify the existing `/availability` endpoint.

```typescript
// Query params:
//   serviceId (REQUIRED) — determines duration for gap calculation
//   month (YYYY-MM) OR startDate/endDate

// Response
{
  success: true,
  doctor: { id, name },
  service: { id, name, durationMinutes, price },
  bufferMinutes: 15,  // doctor's buffer setting (for display purposes)
  availableDates: ["2026-05-01", "2026-05-02", ...],
  timeSlots: {
    "2026-05-01": [
      { startTime: "09:00", endTime: "09:45", locationName: "Consultorio Principal" },
      { startTime: "09:15", endTime: "10:00", locationName: "Consultorio Principal" },
      { startTime: "12:00", endTime: "12:45", locationName: "Consultorio Principal" },
      ...
    ],
    "2026-05-02": [ ... ]
  }
}
```

**Algorithm inside this endpoint**:
1. Fetch all `AvailabilityRange` records for doctor + date range
2. Fetch all active bookings (PENDING/CONFIRMED) for same dates
3. For each date, run the availability calculator (Section 4):
   - Uses each range's `intervalMinutes` for start time generation
   - Uses doctor's `appointmentBufferMinutes` (after bookings only)
   - Uses the selected service's `durationMinutes` to validate each time fits
4. Apply 1-hour cutoff for today (Mexico City TZ)
5. Return only dates that have at least 1 available time

**Flow for public app**:
1. Patient selects service → widget calls `range-availability?serviceId=X&month=YYYY-MM`
2. Calendar highlights `availableDates`
3. Patient picks date → shows `timeSlots[date]`
4. Patient picks time → fills form → books

### 5.5 NEW: `POST /api/appointments/range-bookings`

**Completely new endpoint** — does NOT modify the existing `/bookings` POST.

```typescript
// New range-based booking
{
  doctorId: string,       // NEW — required for range booking
  date: string,           // "2026-05-01"
  startTime: string,      // "10:00"
  serviceId: string,      // REQUIRED — drives duration
  patientName: string,
  patientEmail: string,
  patientPhone: string,
  patientWhatsapp?: string,
  notes?: string,
  isFirstTime?: boolean,
  appointmentMode?: string,
}
```

**Validation in transaction**:
1. Verify `date + startTime` falls within an `AvailabilityRange` for this doctor
2. Compute `endTime = startTime + service.durationMinutes`
3. Verify no overlap with existing bookings (same date, time overlap)
4. Create booking with `slotId = null`, populate freeform fields

### 5.6 NEW: `POST /api/appointments/range-bookings/instant`

**Completely new endpoint** — does NOT modify the existing `/bookings/instant` POST.

- Doctor picks date + startTime + service (which gives duration)
- Overlap check against ranges and existing bookings
- Creates booking with `slotId = null`
- No range required (doctor can book outside their public ranges)

### 5.7 KEEP: ALL existing endpoints untouched

- `PATCH /api/appointments/bookings/[id]` — No changes. Status machine works for both old and new bookings.
- `GET /api/appointments/slots` — Untouched, still works for old system.
- `POST /api/appointments/slots` — Untouched, still works for old system.
- `GET /api/doctors/[slug]/availability` — Untouched, still works for old system.
- `POST /api/appointments/bookings` — Untouched, still works for old system.
- `POST /api/appointments/bookings/instant` — Untouched, still works for old system.

The `extendedBlockMinutes` feature continues to work — when computing availability, we use `booking.endTime + max(extendedBlockMinutes, 0)` as the block end.

---

## 6. Frontend Changes

### 6.1 Doctor App — Create Ranges (NEW component, does not replace CreateSlotsModal)

**New `CreateRangeModal.tsx`** (lives alongside `CreateSlotsModal.tsx`):
- Mode: Single Day / Recurring
- Date(s) selection (same pattern as current)
- Start Time / End Time (15-min increment dropdowns)
- **Interval selector**: 15 / 30 / 45 / 60 min (defaults to doctor's global `defaultIntervalMinutes`)
- NO duration selector (removed — services drive duration)
- NO break time (doctor creates two separate ranges instead: 09:00-13:00, 14:00-18:00)
- Location selector (same pattern as current)
- Preview: "Lunes 09:00 – 14:00 (5 horas) • Intervalo: cada 15 min"

### 6.2 Doctor App — Day View (NEW component, does not replace DaySlotPanel)

**New `DayTimelinePanel.tsx`** (lives alongside `DaySlotPanel.tsx`):
```
| 09:00 ═══════ Rango 1 ═══════ 13:00 |   | 15:00 ══ Rango 2 ══ 18:00 |
| 09:00-09:45 Consulta (Juan)         |   | 15:00-15:30 Limpieza (Ana) |
| 10:00-10:45 Consulta (María)        |   | [   libre   ]               |
| [    libre    ]                      |
| 11:30-12:00 Limpieza (Pedro)        |
| [    libre    ]                      |
```

Shows:
- Ranges as blue bars
- Booked appointments within ranges as colored blocks
- Free gaps clearly visible
- Click on free gap → opens BookPatientModal with pre-filled time

### 6.3 Doctor App — Book Patient (NEW step component)

**New `RangeTimePickerStep.tsx`** (lives alongside `SlotPickerStep.tsx`):
- Doctor selects service (dropdown) → gets duration
- Doctor selects date
- Shows available start times (15-min increments) based on ranges and existing bookings
- OR: doctor types a specific time (freeform input)

### 6.4 Public App — BookingWidget (NEW component)

**New `RangeBookingWidget.tsx`** (lives alongside existing `BookingWidget.tsx`):

**Service-first flow** — service is selected BEFORE date/time because available times depend on
the service's duration. This prevents dead-end UX where a patient picks a time but no service fits.

```
Step 1: Select Service (REQUIRED — always at least 1 active service)
  ┌─────────────────────────────────────────────┐
  │ Consulta General      45 min    $800        │  ← only services with
  │ Limpieza Dental       30 min    $500        │     isBookingActive = true
  │ Procedimiento Láser   90 min    $2,500      │
  └─────────────────────────────────────────────┘
  Patient picks "Consulta General" (45 min)

Step 2: Select Date (calendar highlights dates with availability FOR that service)
  ┌─ Mayo 2026 ─────────────────┐
  │ L  M  M  J  V  S  D        │
  │          1  2  3  4         │  ← highlighted = has at least 1
  │ 5  6  7  8  9 10 11        │     45min gap (service duration)
  └─────────────────────────────┘
  API call: GET /api/doctors/{slug}/range-availability?serviceId=X&month=2026-05

Step 3: Select Time (uses range's intervalMinutes, only shows times where 45min fits)
  ┌─ Horarios disponibles ──────┐
  │ 09:00  09:15  09:30  09:45  │  ← interval from range (e.g., 15min)
  │ 10:45                       │  ← gap between bookings
  │ 12:00  12:15  12:30  12:45  │
  │ 13:00  13:15                │  ← last valid (13:15 + 45 = 14:00 = range end)
  └─────────────────────────────┘
  Each time guarantees: startTime + 45min + buffer fits without overlap

Step 4: Patient Form (same as current — name, email, phone, privacy consent, etc.)

Step 5: Confirmation (same as current — confirmation code, details)
```

**Why service-first works better**:
- Every time shown to the patient is guaranteed bookable — no "sorry, that doesn't fit"
- The API only needs to compute availability for ONE service duration, not all
- Calendar dates are only highlighted if the chosen service actually fits somewhere that day
- The `isBookingActive` toggle already controls which services are shown — no changes needed

### 6.5 Admin App — No Changes During Side-by-Side Phase

Admin app continues using existing slot-based views. Admin changes only happen during the final swap phase.

---

## 7. Migration Strategy: Build → Test → Swap

### Phase 1: Build the New System (side-by-side, zero risk to existing)

**Step 1 — Database**
1. Add `AvailabilityRange` model to Prisma schema
2. Add `appointmentBufferMinutes` to Doctor model
3. Run migration — only ADDS new table + column, changes nothing existing

**Step 2 — Core Algorithm**
1. Create `apps/api/src/lib/availability-calculator.ts`
2. Pure function: takes ranges, bookings, service duration, buffer → returns available times
3. Can be unit tested in isolation

**Step 3 — New API Endpoints (all NEW paths, no modifications)**
1. `POST/GET /api/appointments/ranges` — Range CRUD
2. `GET/DELETE /api/appointments/ranges/[id]` — Individual range ops
3. `GET /api/doctors/[slug]/range-availability` — Compute available times
4. `POST /api/appointments/range-bookings` — Create range-based booking
5. `POST /api/appointments/range-bookings/instant` — Doctor instant booking

**Step 4 — New Doctor App Components (all NEW files)**
1. `CreateRangeModal.tsx` — Doctor creates availability ranges
2. `DayTimelinePanel.tsx` — Timeline view of ranges + bookings
3. `RangeTimePickerStep.tsx` — Time picker for doctor booking
4. `useRanges.ts` — Hook for range data

**Step 5 — New Public App Component (NEW file)**
1. `RangeBookingWidget.tsx` — Service-first booking flow

### Phase 2: Test the New System

1. Create test route(s) to access new components (e.g., `/appointments/v2` in doctor app)
2. Create test data: ranges for test doctor
3. Test full flow:
   - Doctor creates ranges → verifies in timeline view
   - Doctor books patient via new instant flow
   - Patient books via new public widget
   - Verify: overlap detection, gap calculation, concurrent bookings
   - Verify: notifications (SMS, email, Telegram, GCal) work with freeform bookings
4. Verify existing slot-based system is completely unaffected

### Phase 3: Swap (only after Phase 2 passes)

1. Wire new components into existing pages (replace old component references)
2. Create `AvailabilityRange` records for the 3 doctors
3. Optionally: purge old empty slots (no bookings) for migrated doctors
4. Update admin app to handle both booking types in display
5. Update AI chat panel prompts
6. Old slot endpoints remain available (backward compat) but UI no longer uses them

---

## 8. Existing Appointments — Safety Guarantees

| Scenario | What happens |
|---|---|
| Patient has a PENDING booking on an old slot | Works exactly as before. Doctor confirms/cancels via same UI. Slot stays. |
| Patient has a CONFIRMED booking on an old slot | Works exactly as before. Reminders, GCal sync, everything works. |
| Doctor views old slot-based bookings | `DaySlotPanel` shows both legacy slots AND range-based bookings in the timeline |
| Old slot gets cancelled | Slot returns to pool (if public) or gets cleaned up (if private). Same as today. |
| Availability endpoint | Returns UNION of: old available slots + new range-computed times |

**The rule**: We NEVER delete an `AppointmentSlot` that has an active booking (PENDING or CONFIRMED). This is already enforced in the codebase and we will not change it.

---

## 9. Edge Cases

### 9.1 Doctor has both old slots AND new ranges on the same day
- Availability computation considers BOTH
- Old slots are blocked time (even empty ones — they represent committed availability)
- New ranges provide additional or replacement availability
- **Recommendation**: When migrating, purge empty (no-booking) old slots for the doctor and create ranges instead

### 9.2 Service duration doesn't fit in any gap
- Patient sees "No hay horarios disponibles" for that date
- They can try another date or a shorter service

### 9.3 Two patients try to book the same time simultaneously
- Same as today: atomic transaction with overlap check
- Second request fails with "Este horario ya no está disponible"

### 9.4 Doctor changes service duration after bookings exist
- Existing bookings are unaffected (they have their own `duration` stored)
- Future bookings use the new duration

### 9.5 Doctor deletes a range that has bookings in it
- **Allowed with warning**: Bookings are independent records (own date/startTime/endTime). Deleting a range only removes future availability — existing bookings are unaffected.
- Bulk delete shows a preview warning listing active bookings but proceeds with deletion.

### 9.6 Range time boundary bookings
- A booking at 13:30 with 45min duration ends at 14:15
- If range is 10:00–14:00, this booking is REJECTED (endTime exceeds range)
- The last valid start time for a 45min service in a 10:00-14:00 range is 13:15 (ends 14:00)

---

## 10. Files to Create (New) — Phase 1 (Build)

All new files. Nothing existing is modified during this phase.

| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/YYYYMMDD_add_availability_ranges/migration.sql` | DB migration (adds table + column, changes nothing) |
| `apps/api/src/lib/availability-calculator.ts` | Core algorithm for computing available times |
| `apps/api/src/app/api/appointments/ranges/route.ts` | POST/GET for range CRUD |
| `apps/api/src/app/api/appointments/ranges/[id]/route.ts` | GET/DELETE individual range |
| `apps/api/src/app/api/doctors/[slug]/range-availability/route.ts` | Public availability (new system) |
| `apps/api/src/app/api/appointments/range-bookings/route.ts` | Create range-based booking |
| `apps/api/src/app/api/appointments/range-bookings/instant/route.ts` | Doctor instant booking (new system) |
| `apps/doctor/src/app/appointments/_components/CreateRangeModal.tsx` | Doctor creates ranges |
| `apps/doctor/src/app/appointments/_components/DayTimelinePanel.tsx` | Timeline day view |
| `apps/doctor/src/app/appointments/_components/RangeTimePickerStep.tsx` | Time picker for doctor booking |
| `apps/doctor/src/app/appointments/_hooks/useRanges.ts` | Range data management |
| `apps/public/src/components/doctor/RangeBookingWidget.tsx` | Service-first public booking |

---

## 11. Files to Modify — Phase 1 (Build)

Only ONE existing file is modified during Phase 1, and it's purely additive:

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | ADD AvailabilityRange model, ADD Doctor.appointmentBufferMinutes field. No existing model changes. |

---

## 11b. Files to Modify — Phase 3 (Swap, after testing)

These modifications happen ONLY after the new system is tested and verified:

| File | Change |
|---|---|
| `apps/doctor/.../appointments/page.tsx` | Wire new components (CreateRangeModal, DayTimelinePanel) |
| `apps/doctor/.../BookPatientModal/index.tsx` | Use RangeTimePickerStep instead of SlotPickerStep |
| `apps/public/.../DoctorProfileClient.tsx` | Use RangeBookingWidget instead of BookingWidget |
| `apps/public/.../DynamicSections.tsx` | Lazy-load RangeBookingWidget |
| `apps/admin/.../appointments/page.tsx` | Handle freeform booking display (date/time from booking fields) |
| `apps/doctor/.../AppointmentChatPanel.tsx` | Update AI actions for range commands |

---

## 12. What Does NOT Change

- **Booking status machine** (PENDING → CONFIRMED → COMPLETED/CANCELLED/NO_SHOW)
- **Notification system** (SMS, email, Telegram) — works with date/time from booking
- **Google Calendar sync** — adapt event creation, but sync logic stays
- **Confirmation codes and review tokens**
- **Pre-appointment forms** (AppointmentFormLink)
- **Patient cancellation flow** (cancel-booking page)
- **Reminder cron job** — works with booking date/time
- **Doctor profile / services UI** — ServicesSection is already correct
- **Per-flow field requirements** (bookingPublicEmailRequired, etc.)
- **Activity logging**
- **Privacy consent**

---

## 13. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Breaking existing active bookings | HIGH | Never delete slots with active bookings. Dual-mode availability. |
| Public booking widget regression | HIGH | Thorough testing of service-first flow. Feature flag option. |
| Concurrent booking race conditions | MEDIUM | Atomic transactions with overlap checks (same pattern as today). |
| Google Calendar sync desync | LOW | Freeform bookings already have GCal support (booking.googleEventId). |
| AI chat panel breaks | LOW | Update prompts last; not critical path. |
| Admin report discrepancies | LOW | Both booking types have same fields for stats. |

---

## 14. Implementation Order

### Phase 1: Build (all new code, zero modifications to existing)
```
 1. ✅ Schema + Migration                       [DB — adds table + column] (2026-04-21)
 2. ✅ availability-calculator.ts                  [Core algorithm, unit testable] (2026-04-21)
 3. ✅ Range CRUD API                              [/api/appointments/ranges] (2026-04-21)
 4. ✅ Range Availability API                      [/api/doctors/[slug]/range-availability] (2026-04-22)
 5. ✅ Range Booking API                           [/api/appointments/range-bookings] (2026-04-22)
 6. ✅ Range Instant Booking API                   [/api/appointments/range-bookings/instant] (2026-04-22)
 7. ✅ Doctor App: CreateRangeModal                [New component] (2026-04-22)
 8. ✅ Doctor App: DayTimelinePanel                [New component] (2026-04-22)
 9. ✅ Doctor App: RangeTimePickerStep + useRanges [New component + hook] (2026-04-22)
10. ✅ Public App: RangeBookingWidget              [New component] (2026-04-22)
```

### Phase 2: Test
```
11. ✅ Create test route/page to access new components  (2026-04-22)
12. ✅ Create test ranges for a doctor                   (2026-04-22)
      — Created 3 recurring ranges (Apr 22-24, 09:00-14:00, 30min interval) via /appointments/v2
      — Verified: API returns ranges correctly, DayTimelinePanel renders them
13. 🔄 Test full flow: create range → book patient → verify notifications
      — Doctor app: BookPatientModal wired with rangeMode (service→date→time flow) ✅
      — Doctor app: Range-based instant booking via /api/appointments/range-bookings/instant ✅
      — Public app: RangeBookingWidget created but NOT wired into public pages yet ⏳
14. Test edge cases: overlaps, concurrent bookings, gap calculation
15. ✅ Verify old system still works perfectly             (2026-04-22)
      — Classic /appointments page unaffected, slots + bookings work as before
```

### Phase 3: Swap (only after Phase 2 passes)
```
16. Wire new components into existing pages
17. Create AvailabilityRange records for 3 doctors
18. Admin app display fixes
19. AI chat panel updates
20. Purge old empty slots (optional)
```

---

## 15. Resolved Questions

1. **Service required?** → **YES, always.** At least 1 service must exist per doctor. `serviceId` is mandatory in the new booking endpoint.

2. **Service display in public app?** → Patient picks ONE service first (service-first flow), then sees available dates and times for that service's duration. The existing `isBookingActive` toggle controls which services appear. No changes needed to service management.

3. **Feature flag / gradual rollout?** → **Build side-by-side.** New system is developed as completely independent code (new endpoints, new components). Old system stays untouched. Swap happens only after thorough testing.

4. **Buffer time UX?** → Deferred to Phase 3 (swap). Will be decided during doctor app integration. For now, default is 0 and the field exists in DB.

5. **Patient flow order?** → **Service → Date → Time** (service-first). This guarantees every time shown to the patient is bookable for their chosen service. Eliminates the dead-end UX problem where a patient picks a time but no service fits.

6. **Interval per range?** → **YES.** Doctor has a global `defaultIntervalMinutes` setting (15/30/45/60). Each range inherits this default but can override it. Different ranges can have different intervals (e.g., morning range every 15min, afternoon range every 30min).

7. **Buffer direction?** → **After only.** Buffer is applied after the appointment ends. `nextAvailableTime = booking.endTime + bufferMinutes`. No buffer before the appointment.

---

*Document created 2026-04-21. Updated 2026-04-25 with blocking redesign + bulk operations.*
*Strategy: Build side-by-side → Test independently → Swap when verified.*

---

## Changelog

| Date | Step | What was done |
|---|---|---|
| 2026-04-21 | Step 1 | Schema + Migration: Added `AvailabilityRange` model, `appointmentBufferMinutes` + `defaultIntervalMinutes` to Doctor, relations on Doctor and ClinicLocation. Migration SQL created. Prisma validate + generate passed. Code review: 0 issues. |
| 2026-04-21 | Step 2 | Availability Calculator: Pure function in `apps/api/src/lib/availability-calculator.ts`. Handles multiple ranges with per-range intervals, blocked windows from bookings + buffer (after only), interval-grid alignment, and 1-hour Mexico City cutoff. Verified against all 3 plan examples. |
| 2026-04-21 | Step 3 | Range CRUD API: POST/GET at `/api/appointments/ranges` (single + recurring creation, overlap detection, 15-min boundary validation, default location + interval resolution). GET/DELETE at `/api/appointments/ranges/[id]` (ownership check, blocks deletion if active bookings overlap). Full project type-check passed. Review fix: added auth scoping to GET (doctors see only own), added `RANGES_CREATED`/`RANGE_DELETED` action types to activity-logger. |
| 2026-04-22 | Step 4 | Range Availability API: `GET /api/doctors/[slug]/range-availability`. Public endpoint, requires `serviceId`. Fetches ranges + active bookings (both freeform and slot-based), groups by date, calls `calculateAvailability()` per date, applies 1-hour Mexico City cutoff via `applyCutoff()`. Returns `availableDates`, `timeSlots`, `service`, `bufferMinutes`. Type-check passed. Code review: all sections passed (0 issues). |
| 2026-04-22 | Step 5 | Range Booking API: `POST /api/appointments/range-bookings`. Public (PENDING) or doctor/admin (auto-CONFIRMED). Transaction verifies range exists, enforces 1-hour cutoff for public, checks overlap against both freeform and slot-based bookings, creates booking with `slotId=null` and freeform fields. Full side effects: GCal sync (event ID on `booking.googleEventId`), confirmation email (chained after GCal for telemedicine), SMS (patient+doctor), Telegram (PENDING only), activity logging. Type-check passed. |
| 2026-04-22 | Step 6 | Range Instant Booking API: `POST /api/appointments/range-bookings/instant`. Auth required (doctor/admin only), always CONFIRMED. No range required (doctor can book outside public ranges). Uses instant field settings. Overlap check against freeform + slot-based bookings. GCal sync (event ID on booking), confirmation email always sent, SMS, activity logging. Type-check passed. |
| 2026-04-22 | Steps 7-10 | Frontend components: `CreateRangeModal` (single/recurring range creation, 15-min time increments, interval selector 15/30/45/60, location picker, preview), `DayTimelinePanel` (range bars with bookings inside, free gaps clickable for booking, status colors, bookings outside ranges shown separately), `RangeTimePickerStep` (service→date→time picker for doctor booking modal, uses range-availability API), `useRanges` hook (fetch/delete ranges, date grouping), `RangeBookingWidget` (public service-first flow: service→date→time→form→success, deferred loading, field settings, privacy consent, analytics). All type-checks passed (doctor + public apps). |
| 2026-04-22 | Step 11 | Test route: `apps/doctor/src/app/appointments/v2/page.tsx`. Wires `useRanges` + `useCalendar` + `useBookings` hooks. Renders `CreateRangeModal`, `AppointmentsCalendar` (with range dates highlighted), `DayTimelinePanel` (selected date), `BookPatientModal`, and `BookingsSection`. Fetches clinic locations independently (no useSlots dependency). Link back to classic view. Type-check passed. |
| 2026-04-22 | Step 12 | DB migration executed on Railway. Created 3 test ranges (Apr 22-24, 09:00-14:00, 30min interval). API verified returning ranges correctly (count: 3, 200 OK). DayTimelinePanel renders range bars with "Sin citas — todo libre" for empty ranges. |
| 2026-04-22 | Steps 12-13 fixes | **BookPatientModal**: Added `rangeMode` + `doctorSlug` props. When `rangeMode=true`, renders `RangeTimePickerStep` (service→date→time) instead of `SlotPickerStep`, submits to `/api/appointments/range-bookings/instant`. **Code review fixes**: Added auth + ownership check to GET `/api/appointments/ranges/[id]`, added `userId` to all `logActivity()` calls in ranges CRUD, fixed `RangeTimePickerStep` service fetch URL (was using `${API_URL}` prefix for doctor-internal route `/api/doctor/services`, changed to relative URL). |
| 2026-04-22 | Step 15 | Verified old system unaffected: classic `/appointments` page loads normally, slots and bookings work as before. |
| 2026-04-25 | Blocking redesign | Replaced range-splitting block with reversible `BlockedTime` overlay model. New DB table `blocked_times`, block API rewritten as CRUD (GET/POST/DELETE), availability calculator integrates blocked times, booking creation rejects blocked windows. Separate UI: "Eliminar" (red) and "Bloquear" (orange) buttons. Bulk unblock support. See `PLAN-BULK-RANGE-DELETE-AND-BLOCK.md` for details. |
| 2026-04-25 | Behavior fix | Both blocking and deletion now warn about active bookings but proceed — bookings are independent records. Blocking skips dates with no ranges. |
