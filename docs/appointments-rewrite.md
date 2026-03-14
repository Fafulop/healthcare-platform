# Appointments System — Full Context & Rewrite Plan

**Last updated:** 2026-03-14 (reviewed and corrected 2026-03-14)
**Status:** Steps 1–3 done. Step 4 next.
**Author context:** Full codebase audit completed before writing this document. Additional review session found gaps — see section 13.

---

## 1. What this document is

This is the single source of truth for the appointments system rewrite. It documents:
- Every file in the current system (doctor app, API app, public app)
- Every bug and architectural issue found
- The agreed plan with step-by-step implementation order
- Key decisions made and why

Read this before touching any appointments code.

---

## 2. Current system — file map

### Doctor app (`apps/doctor/src/`)

| File | Lines | What it does |
|---|---|---|
| `app/appointments/page.tsx` | 833 | Main appointments page. Header (3 buttons), Bookings table (top, always visible), Calendar view (grid + day slot panel), List view (slots table + bulk actions) |
| `app/appointments/useAppointmentsPage.ts` | 547 | Monolithic hook. Fetches slots + bookings, all CRUD handlers, all derived/display state, voice handlers |
| `app/appointments/CreateSlotsModal.tsx` | 649 | Modal to create availability blocks. Single or recurring mode, break time, preview count. Well-designed, keep mostly as-is |
| `app/appointments/BookPatientModal.tsx` | 820 | Modal to book a patient. 3 steps: slot picker (with "Horarios disponibles" / "Nuevo horario" tabs) → patient form → success screen |
| `app/appointments/AppointmentChatPanel.tsx` | 390 | Floating AI chat panel (indigo). Draggable on mobile. Suggestion chips, voice input, pending action confirmation UI |
| `app/appointments/layout.tsx` | 65 | Layout wrapper. Includes floating widgets: VoiceAssistantHubWidget, DayDetailsWidget (general calendar), ChatWidget (LLM assistant). These are SEPARATE from the appointments page logic |
| `app/api/appointments-chat/route.ts` | 306 | AI chat endpoint (doctor app internal). Uses GPT-4o. Fetches slot context from Prisma (today-7 to today+60), builds system prompt, returns { reply, actions[] }. No mutations — all writes done client-side |
| `hooks/useAppointmentsChat.ts` | 657 | Hook for AppointmentChatPanel. Manages conversation, validates action batches client-side before showing confirmation, dispatches confirmed actions sequentially to the API |
| `hooks/useDashboardCalendar.ts` | 162 | For the floating DayDetailsWidget sidebar only. Fetches from `/api/medical-records/tasks/calendar`. NOT related to the appointments page |
| `hooks/useDayDetails.ts` | 91 | Also for DayDetailsWidget. Same endpoint. NOT related to the appointments page |
| `lib/conflict-checker.ts` | 104 | Checks appointment+task conflicts for the tasks module. BROKEN: checks `slot.status === 'AVAILABLE'` but slots no longer have a `status` field — they have `isOpen: boolean`. Conflict detection silently always returns 0 appointment conflicts |
| `lib/google-calendar-sync.ts` | ~340 | Google Calendar sync utilities used by the doctor app |

### API app (`apps/api/src/app/api/appointments/`)

| File | Lines | Methods | Notes |
|---|---|---|---|
| `slots/route.ts` | 658 | GET, POST | GET: fetches slots with live booking count (correct). POST: creates single or recurring slots, conflict detection (returns 409), task overlap info (informational). Handles both modes |
| `slots/[id]/route.ts` | 290 | PUT, PATCH, DELETE | PUT: edit time/price (blocked if active bookings). PATCH: toggle isOpen. DELETE: blocked if active bookings |
| `slots/bulk/route.ts` | 236 | POST | Bulk delete/close/open by slotIds array. **NO AUTH CHECK — security hole.** GCal sync included |
| `bookings/route.ts` | 433 | GET, POST | POST: create booking into existing slot. Auto-confirms if caller is DOCTOR/ADMIN. GET: scoped to doctor, supports date filter with OR clause for freeform bookings |
| `bookings/[id]/route.ts` | 461 | GET, PATCH, DELETE | State machine transitions. GCal sync. SMS on CONFIRMED. Handles both slot-based and freeform booking date resolution |
| `bookings/instant/route.ts` | 227 | POST | Creates a freeform booking (slotId=null) with date/time stored directly on the Booking. Also closes any overlapping open slots as a side effect. THIS IS THE ROOT OF THE DUAL DATA MODEL PROBLEM |
| `doctors/[slug]/availability/route.ts` | 154 | GET | Public endpoint for BookingWidget. Uses stale `currentBookings` DB field (not live count). Has 6 debug console.log statements left in production |

### Public app (`apps/public/src/`)

| File | Lines | What it does |
|---|---|---|
| `components/doctor/BookingWidget.tsx` | 653 | Patient-facing booking flow. Calendar → slot selection → patient form → success. Hits `/api/doctors/[slug]/availability` then `POST /api/appointments/bookings`. Has 2 `alert()` calls on error that should be replaced with error state |
| `components/doctor/BookingModal.tsx` | 107 | Modal wrapper for BookingWidget |
| `components/doctor/AppointmentCalendar.tsx` | 84 | Mini calendar used in BookingWidget |
| `app/doctores/[slug]/page.tsx` | 36 | Doctor profile page, embeds BookingWidget |
| `app/cancel-booking/page.tsx` | 252 | Patient self-cancellation page |
| `app/review/[token]/page.tsx` | 309 | Post-appointment review page |

### Admin app

| File | Lines | Notes |
|---|---|---|
| `apps/admin/src/app/appointments/page.tsx` | 462 | Admin appointment overview. Out of scope for this rewrite |

---

## 3. Database schema

### AppointmentSlot (`public.appointment_slots`)

```prisma
model AppointmentSlot {
  id              String    @id @default(cuid())
  doctorId        String    @map("doctor_id")
  date            DateTime               // normalized to midnight UTC
  startTime       String    @map("start_time")   // "09:00"
  endTime         String    @map("end_time")     // "10:00"
  duration        Int                    // 30 or 60 minutes only
  basePrice       Decimal   @map("base_price")   @db.Decimal(10,2)
  discount        Decimal?                        @db.Decimal(10,2)
  discountType    String?   @map("discount_type") // "PERCENTAGE" | "FIXED"
  finalPrice      Decimal   @map("final_price")  @db.Decimal(10,2)
  isOpen          Boolean   @default(true) @map("is_open")
  maxBookings     Int       @default(1) @map("max_bookings")
  currentBookings Int       @default(0) @map("current_bookings")  // STALE DENORMALIZED COUNTER
  isInstant       Boolean   @default(false) @map("is_instant")    // UNUSED FIELD
  googleEventId   String?   @map("google_event_id")

  @@unique([doctorId, date, startTime])   // prevents duplicate slots at same time
  @@index([doctorId, date, isOpen])
  @@schema("public")
}
```

**Important notes:**
- `currentBookings` is a stale denormalized counter. `slots/route.ts` GET correctly computes it live from bookings. But `availability/route.ts` reads it directly from DB — this is a bug.
- `isInstant` exists in schema but is **never used** by any code. The "Nuevo horario" path creates freeform bookings instead of using this flag.
- `@@unique([doctorId, date, startTime])` — unique constraint exists. A doctor cannot have two slots at the same start time on the same day.
- `onDelete: Cascade` is NOT on slots — slots are not cascaded from doctor deletion directly (doctor has Cascade, slots have Cascade from doctor).
- **New fields (this rewrite):** `isPublic Boolean @default(true)` and `locationId String?` (FK to `ClinicLocation`).

Also add to Doctor model: `clinicLocations ClinicLocation[]` relation.

### Booking (`public.bookings`)

```prisma
model Booking {
  id              String         @id @default(cuid())
  slotId          String?        @map("slot_id")     // NULL = freeform booking
  doctorId        String         @map("doctor_id")

  // Freeform-only fields (set when slotId is null, null otherwise)
  date            DateTime?
  startTime       String?        @map("start_time")
  endTime         String?        @map("end_time")
  duration        Int?

  patientName     String         @map("patient_name")
  patientEmail    String         @map("patient_email")
  patientPhone    String         @map("patient_phone")
  patientWhatsapp String?        @map("patient_whatsapp")
  serviceId       String?        @map("service_id")
  serviceName     String?        @map("service_name")
  isFirstTime     Boolean?       @map("is_first_time")
  appointmentMode String?        @map("appointment_mode")  // "PRESENCIAL" | "TELEMEDICINA"
  status          BookingStatus  @default(PENDING)
  finalPrice      Decimal        @map("final_price")  @db.Decimal(10,2)
  notes           String?        @db.Text
  confirmationCode String?       @unique @map("confirmation_code")
  confirmedAt     DateTime?      @map("confirmed_at")
  cancelledAt     DateTime?      @map("cancelled_at")
  reviewToken     String?        @unique @map("review_token")
  reviewTokenUsed Boolean        @default(false) @map("review_token_used")
  googleEventId   String?        @map("google_event_id")  // freeform only; slot-based use slot.googleEventId

  slot            AppointmentSlot? @relation(..., onDelete: Cascade)  // CASCADE — deleting slot deletes all its bookings
  @@schema("public")
}

enum BookingStatus { PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW }
```

**State machine:**
```
PENDING → CONFIRMED → COMPLETED
       ↘             → NO_SHOW
        → CANCELLED   → CANCELLED
```
CANCELLED, COMPLETED, NO_SHOW are terminal states.

---

## 4. The core architectural problem

### Dual booking modes

The system has two completely different shapes for the same concept (a confirmed appointment):

**Mode A — Slot-based booking** (public portal or existing slot):
- `AppointmentSlot` record exists with `isOpen: true`
- `Booking` record has `slotId` set, `date/startTime/endTime/duration` are null
- Date/time resolved via `booking.slot.date`, `booking.slot.startTime`, etc.
- GCal event ID stored on `slot.googleEventId`

**Mode B — Freeform booking** ("Nuevo horario"):
- No `AppointmentSlot` created
- `Booking` record has `slotId: null`, `date/startTime/endTime/duration` set directly
- GCal event ID stored on `booking.googleEventId`
- Side effect: `bookings/instant/route.ts` closes any open slots at that time via `appointmentSlot.updateMany`

This means **every single piece of code** that touches bookings has to handle both:
```typescript
booking.slot?.date ?? booking.date
booking.slot?.startTime ?? booking.startTime
booking.slot?.endTime ?? booking.endTime
```

### History of "Nuevo horario"
- **Original approach:** Created a slot + booking (slot-based). Had bugs.
- **Changed to:** Creates freeform booking (slotId=null) via `/instant` endpoint. This solved the immediate bugs but introduced the dual-mode complexity.
- **New approach (this rewrite):** Creates a private slot (`isPublic: false`) + confirmed booking. One data shape everywhere.

### Freeform bookings in production
Confirmed: **zero or close to zero** freeform bookings (`slotId=null`) in Railway. Migration is trivial.

---

## 5. Full bug list

| # | Bug | Location | Severity |
|---|---|---|---|
| 1 | No auth check on bulk operations | `slots/bulk/route.ts` | **Critical** — anyone can delete/close/open any slots |
| 2 | Stale `currentBookings` used for availability | `availability/route.ts` line 98 | **High** — patients may see available slots that are actually full |
| 3 | Dual data model (freeform bookings) | `bookings/instant/route.ts` + schema | **High** — root cause of most complexity and bugs |
| 4 | `conflict-checker.ts` is broken | `lib/conflict-checker.ts` lines 43-44 | **High** — checks `slot.status === 'AVAILABLE'` but field doesn't exist; task-appointment conflicts never detected |
| 5 | AI chat context uses stale `currentBookings` | `appointments-chat/route.ts` line 115 | **Medium** — AI's view of slot availability can be wrong |
| 6 | AI chat context excludes freeform bookings | `appointments-chat/route.ts` `fetchContext()` | **Medium** — freeform bookings invisible to AI assistant |
| 7 | `reschedule_booking` in AI chat is non-atomic | `useAppointmentsChat.ts` lines 390-418 | **Medium** — cancels original booking then creates new one; if step 2 fails, patient's appointment is cancelled with no recovery |
| 8 | `availability/route.ts` has 6 debug console.logs | `availability/route.ts` lines 23,24,101,102,104-117 | **Low** — leaks internal data in production |
| 9 | `isInstant` field exists but unused | `schema.prisma` | **Low** — dead field |
| 10 | `BookingWidget` uses `alert()` on error | `BookingWidget.tsx` lines 175, 179 | **Low** — bad UX, blocks the browser |
| 11 | `getCalendarTokens()` duplicated 3x | `bookings/route.ts`, `bookings/[id]/route.ts`, `slots/bulk/route.ts` | **Low** — maintenance burden |
| 12 | `generateConfirmationCode()` duplicated 2x | `bookings/route.ts`, `bookings/instant/route.ts` | **Low** |
| 13 | `fetchBookings` fetches ALL bookings — intentional | `useAppointmentsPage.ts` line 206 | **Not a bug** — comment explains: "Scoping to calendar month caused April bookings to be invisible when viewing March." Accepted UX tradeoff. Keep in new architecture. |
| 14 | `PATCH /bookings/[id]` had no authentication | `bookings/[id]/route.ts` | **Critical** — any unauthenticated caller could cancel/confirm/complete any booking by ID. **FIXED** in review session. |
| 15 | `instant/route.ts` sent no SMS on booking creation | `bookings/instant/route.ts` | **Medium** — doctor books patient but patient gets no confirmation. **FIXED** in review session. |
| 16 | `conflict-checker.ts` checked `slot.status` which doesn't exist | `lib/conflict-checker.ts` line 43 | **High** — `slot.status === 'AVAILABLE'` always false; appointment conflicts silently never detected. **FIXED** in review session — now checks `slot.isOpen === true \|\| currentBookings > 0`. |

---

## 5b. Multi-clinic location feature (NEW)

### Overview

Doctors can attend at up to 2 different addresses. Each appointment slot is associated with a specific location. Everywhere a slot is displayed (doctor app, public booking widget, SMS, confirmation screen) shows the correct address for that slot.

### New DB model: `ClinicLocation`

```prisma
model ClinicLocation {
  id           String   @id @default(cuid())
  doctorId     String   @map("doctor_id")
  name         String                        // "Consultorio Principal", "Consultorio 2"
  address      String
  phone        String?
  whatsapp     String?
  hours        Json     @default("{}")       // same shape as current clinicHours
  geoLat       Float?   @map("geo_lat")
  geoLng       Float?   @map("geo_lng")
  isDefault    Boolean  @default(false) @map("is_default")
  displayOrder Int      @default(0) @map("display_order")

  doctor       Doctor           @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  slots        AppointmentSlot[]

  @@index([doctorId])
  @@schema("public")
}
```

### DB changes

**SQL migration file A:** `packages/database/prisma/migrations/add-slot-is-public.sql`
```sql
-- Migration: Add is_public column to appointment_slots
-- Purpose: Distinguish public (patient-bookable) vs private (doctor internal) slots
-- Date: 2026-03-14

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
```

**SQL migration file B:** `packages/database/prisma/migrations/add-clinic-locations.sql`

```sql
-- Migration: Add clinic_locations table and location_id to appointment_slots
-- Purpose: Allow doctors to have up to 2 clinic addresses; slots reference a specific location
-- Date: 2026-03-14

-- Create clinic_locations table
-- NOTE: id has no DEFAULT — Prisma generates cuid() values on insert.
-- The seed INSERT below uses gen_random_uuid()::text to create IDs for migrated rows.
CREATE TABLE IF NOT EXISTS public.clinic_locations (
  id            TEXT NOT NULL,
  doctor_id     TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Consultorio Principal',
  address       TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  whatsapp      TEXT,
  hours         JSONB NOT NULL DEFAULT '{}',
  geo_lat       DOUBLE PRECISION,
  geo_lng       DOUBLE PRECISION,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT clinic_locations_pkey PRIMARY KEY (id)
);

-- Foreign key from clinic_locations to doctors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinic_locations_doctor_id_fkey'
  ) THEN
    ALTER TABLE public.clinic_locations
      ADD CONSTRAINT clinic_locations_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- Index on doctor_id for lookup performance
CREATE INDEX IF NOT EXISTS clinic_locations_doctor_id_idx
  ON public.clinic_locations(doctor_id);

-- Add location_id FK column to appointment_slots
ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS location_id TEXT;

-- Foreign key from appointment_slots.location_id to clinic_locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_slots_location_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_slots
      ADD CONSTRAINT appointment_slots_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.clinic_locations(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Seed: migrate each doctor's existing clinic data → one default ClinicLocation per doctor
-- Uses gen_random_uuid()::text to generate IDs for these migration-created rows
INSERT INTO public.clinic_locations (id, doctor_id, name, address, phone, whatsapp, hours, geo_lat, geo_lng, is_default, display_order)
SELECT
  gen_random_uuid()::text,
  id,
  'Consultorio Principal',
  COALESCE(clinic_address, ''),
  clinic_phone,
  clinic_whatsapp,
  COALESCE(clinic_hours, '{}'),
  clinic_geo_lat,
  clinic_geo_lng,
  TRUE,
  0
FROM public.doctors
WHERE NOT EXISTS (
  SELECT 1 FROM public.clinic_locations cl WHERE cl.doctor_id = doctors.id
);
```

**Run order (per database-architecture.md):**
1. Run File A on **local DB** first: `cd packages/database && pnpm exec prisma db execute --file prisma/migrations/add-slot-is-public.sql --schema prisma/schema.prisma`
2. Run File B on **local DB**: same pattern
3. Test locally
4. Run File A on Railway: `npx prisma db execute --file packages/database/prisma/migrations/add-slot-is-public.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"`
5. Run File B on Railway: same pattern
6. `pnpm db:generate` to regenerate Prisma client
7. Push code

**Important:** Keep old `clinicAddress`, `clinicPhone`, `clinicWhatsapp`, `clinicHours`, `clinicGeoLat`, `clinicGeoLng` columns on Doctor **untouched**. They remain for:
- `apps/public/src/lib/data.ts` line 76 (doctor profile page clinic display)
- `apps/public/src/app/cancel-booking/page.tsx` (type references clinicAddress)
- Admin app and any other consumer reading doctor directly
- SMS templates as fallback

New code uses `slot.location.address ?? doctor.clinicAddress` pattern. Old columns deprecated later.

### Updated schema for AppointmentSlot

```prisma
model AppointmentSlot {
  // ... existing fields ...
  locationId   String?       @map("location_id")   // null = use doctor's default location
  location     ClinicLocation? @relation(fields: [locationId], references: [id])
}
```

### Business rules

- Max 2 locations per doctor (enforced in API: return 400 if trying to create a 3rd)
- Exactly one location must be `isDefault: true` per doctor
- Slot with `locationId: null` → resolved to doctor's default ClinicLocation at display time
- If doctor has 1 location → no picker in CreateSlotsModal (slot implicitly uses that location)
- If doctor has 2 locations → show dropdown "¿En qué consultorio?" in CreateSlotsModal

### Files to add/change for this feature

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add `ClinicLocation` model, add `isPublic`+`locationId` to `AppointmentSlot`, add `clinicLocations` relation to `Doctor` |
| `packages/database/prisma/migrations/add-slot-is-public.sql` | New — adds `is_public` column |
| `packages/database/prisma/migrations/add-clinic-locations.sql` | New — creates table, adds `location_id`, seeds data |
| `apps/api/src/app/api/doctors/[slug]/route.ts` GET | Include `clinicLocations` in response |
| `apps/api/src/app/api/doctors/[slug]/route.ts` PUT | Handle `clinic_locations[]` array: upsert/delete, enforce max 2, keep writing old `clinicAddress` columns for backward compat |
| `apps/api/src/app/api/doctors/route.ts` POST | After creating doctor, also create default `ClinicLocation` row from `clinic_info.address` |
| `apps/api/src/app/api/appointments/slots/route.ts` GET | Include `location { name, address }` in slot response |
| `apps/api/src/app/api/appointments/slots/route.ts` POST | Accept `locationId` when creating slot |
| `apps/api/src/app/api/appointments/slots/[id]/route.ts` PUT | Accept `locationId` when editing slot |
| `apps/api/src/app/api/doctors/[slug]/availability/route.ts` | Include `location { address, name }` in slot data returned to public |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Use `slot.location.address ?? doctor.clinicAddress` for SMS |
| `apps/api/src/app/api/appointments/bookings/[id]/route.ts` | Same — use `slot.location.address ?? doctor.clinicAddress` for SMS |
| `apps/api/src/app/api/appointments/bookings/instant/route.ts` | Accept `locationId` when creating private slot |
| `apps/doctor/src/components/profile/ClinicSection.tsx` | Show up to 2 location cards with add/remove second |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Update `formData` shape: `clinic_locations[]` replaces flat `clinic_info{}` |
| `apps/doctor/src/app/appointments/CreateSlotsModal.tsx` | Add location radio picker (only when doctor has 2+ locations) |
| `apps/doctor/src/app/appointments/BookPatientModal.tsx` | Show location name/address on slot tiles and success screen |
| `apps/public/src/components/doctor/BookingWidget.tsx` | Show `slot.location.address` (fallback: doctor primary address) |

**Files that read `clinicAddress` but are NOT affected (old columns stay):**
- `apps/public/src/lib/data.ts` — doctor profile page address display
- `apps/public/src/app/cancel-booking/page.tsx` — cancellation page type
- `apps/admin/src/app/doctors/[slug]/edit/page.tsx` — admin edit doctor
- `apps/admin/src/app/doctors/page.tsx` — admin doctor list
- `apps/doctor/src/app/api/medical-records/patients/.../pdf/route.tsx` — prescription PDF header

### ClinicSection UI design

**State:** `clinic_locations: Array<{ id?, name, address, phone, whatsapp, hours, geoLat, geoLng, isDefault }>` — replaces the flat `clinic_info` object.

**Layout:**
```
[ Consultorio Principal ]  ← always present, cannot be removed
  Nombre: [input]
  Direccion: [input] *
  Telefono: [input] *
  WhatsApp: [input]
  Horario de atencion: [day inputs]
  Coordenadas: [lat] [lng] [Buscar en Maps]

[ + Agregar segundo consultorio ]  ← button shown only if 1 location exists

[ Consultorio 2 ]  ← shown when added, with same fields
  [ Eliminar segundo consultorio ]  ← red button, not shown for first location
```

**Validation:** `address` is required for each location. `name` defaults to "Consultorio Principal" / "Consultorio 2" if blank.

### CreateSlotsModal location picker

Shown only when `clinicLocations.length >= 2`:

```
¿En qué consultorio?
( ) Consultorio Principal  — Av. Principal 123
( ) Consultorio 2          — Calle Reforma 456
```

Radio buttons. Default: first location (isDefault). Selected `locationId` sent to API in slot creation body.

### Slot display with location

Wherever a slot appears, show the location name as a small badge or sub-label:
- Calendar day panel: `09:00 – 10:00  [Consultorio 2]`
- List view table: new "Consultorio" column
- BookPatientModal slot tile: address shown under time
- BookingWidget (public): slot card shows address
- Success screen / SMS: address of the slot's location

### SMS update

In `bookings/route.ts` and `bookings/[id]/route.ts`, change:
```typescript
// Before
clinicAddress: bookingWithSlot.doctor.clinicAddress

// After — slot always has a location (new bookings after migration)
clinicAddress: bookingWithSlot.slot?.location?.address ?? bookingWithSlot.doctor.clinicAddress
```

---

## 6. The rewrite plan

### Guiding principles
- Public app (`BookingWidget`) must keep working throughout — it depends on the same API endpoints
- Admin app is out of scope
- API is rewritten in-place (same URLs, new handlers) — other apps depend on these
- Doctor UI is built in parallel at `/appointments-v2`, then swapped in when ready
- No behavioral changes to existing working functionality (AI chat, voice, GCal sync, SMS)

---

### Step 1 — API quick fixes (in-place, surgical)

**Files to touch:**
- `apps/api/src/app/api/appointments/slots/bulk/route.ts` — add `validateAuthToken`, check doctor owns the slots
- `apps/api/src/app/api/doctors/[slug]/availability/route.ts` — compute live booking count from active bookings (not stale `currentBookings`), remove 6 console.logs
- Create `apps/api/src/lib/appointments-utils.ts` — extract shared helpers:
  - `getCalendarTokens(doctorId)` — currently duplicated in 3 files
  - `generateConfirmationCode()` — duplicated in 2 files
  - `generateReviewToken()` — duplicated in 2 files
  - `calcEndTime(startTime, duration)` — duplicated in instant route and modal
- Update the 3 route files to import from shared utils

---

### Step 2 — DB migration

Two SQL migration files — full SQL and run order documented in **section 5b**.

**Schema changes (`schema.prisma`):**
```prisma
model AppointmentSlot {
  // ... existing fields ...
  isPublic   Boolean         @default(true) @map("is_public")
  locationId String?         @map("location_id")
  location   ClinicLocation? @relation(fields: [locationId], references: [id])
}

model ClinicLocation {
  id           String   @id @default(cuid())
  doctorId     String   @map("doctor_id")
  name         String
  address      String
  phone        String?
  whatsapp     String?
  hours        Json     @default("{}")
  geoLat       Float?   @map("geo_lat")
  geoLng       Float?   @map("geo_lng")
  isDefault    Boolean  @default(false) @map("is_default")
  displayOrder Int      @default(0) @map("display_order")
  createdAt    DateTime @default(now()) @map("created_at")

  doctor  Doctor            @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  slots   AppointmentSlot[]

  @@map("clinic_locations")
  @@index([doctorId])
  @@schema("public")
}
```

**Run order (per database-architecture.md):**
1. Run both SQL files on **local DB** first → test locally
2. Run both SQL files on **Railway** before pushing code
3. `pnpm db:generate`
4. Push code

---

### Step 3 — Rewrite `bookings/instant/route.ts`

**New behavior:** Creates `AppointmentSlot` with `isPublic: false` + confirmed `Booking` in one DB transaction.

```
POST /api/appointments/bookings/instant
Body: { doctorId, date, startTime, duration, locationId?, patientName, patientEmail, patientPhone, ... }

Creates:
  1. AppointmentSlot { doctorId, date, startTime, endTime, duration, isOpen: false, isPublic: false, locationId }
  2. Booking { slotId: <new slot id>, status: CONFIRMED, confirmedAt: now, ... }
```

`locationId` is optional — if omitted, slot gets `locationId: null` which resolves to the doctor's default ClinicLocation at display time.

**Why `isOpen: false`:** Private slots are not shown to public patients. `isPublic: false` also excludes them from `availability/route.ts`.

**Removes:**
- The `appointmentSlot.updateMany` side-effect that closed overlapping open slots (was a hack)
- All freeform fields usage (`slotId: null`, direct date/time on booking)

**Update `availability/route.ts`** to filter `isPublic: true` only (so private slots never appear to patients).

**Update `bookings/route.ts` GET** — remove the `OR` date filter clause for freeform bookings. All bookings now resolve date via `slot.date`.

---

### Step 4 — New doctor UI at `apps/doctor/src/app/appointments-v2/`

#### File structure

```
appointments-v2/
├── page.tsx                           ~100L  thin shell
├── layout.tsx                         copy from appointments/layout.tsx
├── _hooks/
│   ├── useCalendar.ts                 month navigation, calendar grid, dates-with-slots set
│   ├── useSlots.ts                    fetch (month-scoped), create, delete, toggle isOpen, bulk actions
│   └── useBookings.ts                 fetch (with date filter), status changes, delete
├── _components/
│   ├── BookingsSection.tsx            collapsible bookings table (top section), filters, mobile+desktop views
│   ├── AppointmentsCalendar.tsx       calendar grid with slot dot indicators
│   ├── DaySlotPanel.tsx               selected day's slot list with per-slot actions
│   ├── SlotListView.tsx               list view table with checkboxes + bulk action bar
│   ├── BookingStatusBadge.tsx         shared status badge + label helper (replaces inline helpers)
│   ├── CreateSlotsModal.tsx           ported from current (minimal changes needed)
│   ├── BookPatientModal/
│   │   ├── index.tsx                  step orchestration (~80L)
│   │   ├── SlotPickerStep.tsx         calendar + slot tiles OR "nuevo horario" form
│   │   ├── PatientFormStep.tsx        service selector, visit type, patient fields
│   │   └── SuccessStep.tsx            confirmation code screen
│   └── AppointmentChatPanel.tsx       copy from current (unchanged)
```

#### Hook responsibilities

**`useCalendar.ts`**
- State: `selectedDate`, `currentMonth`
- Handlers: `setSelectedDate`, `prevMonth`, `nextMonth`, `goToToday`
- Derived: `calendarDays`, `year`, `month`, `selectedDateStr`
- Does NOT fetch — consumes `datesWithSlots` set passed from parent

**`useSlots.ts`** (receives `doctorId`, `doctorSlug`, `currentMonth`)
- Fetches slots for current month via `GET /api/appointments/slots?doctorId=&startDate=&endDate=` (already month-scoped in current code — keep this)
- Fetches `clinicLocations` via `GET /api/doctors/[slug]/locations` (new lightweight endpoint, called once on mount)
- State: `slots`, `loading`, `selectedSlotIds`, `clinicLocations`
- Handlers: `createSlots`, `deleteSlot`, `toggleOpenSlot`, `bulkAction`, `toggleSlotSelection`, `toggleAllSlots`
- Derived: `slotsForDate(dateStr)`, `datesWithSlots` (Set<string>), `visibleListSlots`, `hasMultipleLocations` (boolean — `clinicLocations.length >= 2`)
- Re-fetches slots on month change; clinicLocations cached after first fetch

**`useBookings.ts`** (receives `doctorId`)
- Fetches ALL bookings with no date restriction via `GET /api/appointments/bookings?doctorId=` — **intentional**: scoping to month caused cross-month bookings to disappear (same decision as current `useAppointmentsPage.ts` line 206)
- State: `bookings`, `loading`, `bookingsCollapsed`, filter state (`bookingFilterDate`, `bookingFilterPatient`, `bookingFilterStatus`)
- Handlers: `updateBookingStatus`, `deleteBooking`, `shiftBookingFilterDate`
- Derived: `filteredBookings`

**New API endpoint needed:** `GET /api/doctors/[slug]/locations`
- Returns `{ success: true, data: ClinicLocation[] }` — just the locations array, no other profile data
- No auth required (public info) — same pattern as availability endpoint

**`page.tsx`**
```tsx
export default function AppointmentsPage() {
  const calendar = useCalendar();
  const slots = useSlots(doctorId, calendar.currentMonth);
  const bookings = useBookings(doctorId);

  return (
    <div>
      <Header /> {/* 3 buttons: Chat IA (indigo), Agendar Cita (green), Crear Horarios (blue) */}
      <BookingsSection bookings={bookings} />
      <ViewToggle />
      {viewMode === 'calendar'
        ? <CalendarView calendar={calendar} slots={slots} />
        : <SlotListView slots={slots} />}
      <Modals />
      <AppointmentChatPanel />
    </div>
  );
}
```

#### BookPatientModal flow

**"Horarios disponibles" tab (existing slot):**
1. Fetch open, non-full slots for next 90 days (each slot includes `location { name, address }`)
2. Show calendar with available dates highlighted
3. Select date → show slot tiles for that date (each tile shows location name if doctor has 2 locations)
4. Select slot → go to PatientFormStep (shows selected slot's address)
5. Submit → `POST /api/appointments/bookings` with `{ slotId, patientData... }`

**"Nuevo horario" tab (private slot):**
1. Show date + start time + duration fields
2. If doctor has 2 locations → show location radio picker
3. Continue → go to PatientFormStep (shows chosen location's address)
4. Submit → `POST /api/appointments/bookings/instant` with `{ doctorId, date, startTime, duration, locationId?, patientData... }`
5. Backend creates private slot (with locationId) + confirmed booking atomically

**Success screen** (step 3): Shows `clinicAddress` from the slot's resolved location.

---

### Step 5 — Swap + cleanup

1. Rename `apps/doctor/src/app/appointments` → `appointments-old`
2. Rename `apps/doctor/src/app/appointments-v2` → `appointments`
3. Fix `apps/doctor/src/lib/conflict-checker.ts`:
   - Change `slot.status === 'AVAILABLE' || slot.status === 'BOOKED'` → `slot.isOpen === true`
4. Update `appointments-chat/route.ts`:
   - Change `slotEstado()` to use live booking count from included bookings, not stale `slot.currentBookings`
5. Delete `appointments-old`
6. Fix `BookingWidget.tsx` `alert()` calls → error state

---

## 7. Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Freeform bookings | Eliminate going forward | Root cause of dual code path. Zero in production so migration is trivial |
| "Nuevo horario" implementation | Private slot (isPublic: false) + confirmed booking | Single data shape everywhere. isInstant field already exists but unused — repurpose via isPublic flag instead |
| API rewrite style | In-place (same URLs) | Public app and admin app depend on same endpoints. Cannot change URLs |
| Doctor UI rewrite style | Parallel at /appointments-v2 | Zero risk to live system during development |
| `slots/bulk` route | Keep at same URL, add auth | Still needed for bulk open/close/delete from list view and AI chat |
| Admin app | Out of scope | Separate concern, lower priority |
| AI chat | Wire to new hooks after swap, minimal changes | The chat panel itself (UI + hook) works well. Only fix: use live booking count in context fetch |
| `isInstant` field | Leave in schema, ignore | Non-breaking, cleanup later |
| `currentBookings` field | Leave in schema | Used nowhere correctly, but removing it requires a migration and it's low risk |

---

## 8. Connections between components

```
Doctor App                        API App                          Public App
──────────────────────────────    ──────────────────────────────    ──────────────────
appointments/page.tsx
  └─ useSlots ─────────────────→  GET  /api/appointments/slots
  └─ useBookings ───────────────→  GET  /api/appointments/bookings
  └─ CreateSlotsModal ──────────→  POST /api/appointments/slots
  └─ BookPatientModal
      ├─ existing slot ─────────→  POST /api/appointments/bookings
      └─ nuevo horario ─────────→  POST /api/appointments/bookings/instant
  └─ slot actions ──────────────→  PATCH/DELETE /api/appointments/slots/[id]
  └─ booking actions ───────────→  PATCH/DELETE /api/appointments/bookings/[id]
  └─ bulk actions ──────────────→  POST /api/appointments/slots/bulk
  └─ AppointmentChatPanel
      └─ useAppointmentsChat ───→  POST /api/appointments-chat (internal, doctor app)
          └─ dispatchAction ────→  (same API endpoints as above)

appointments-chat/route.ts ──────→  Prisma direct (slots + bookings, today-7 to today+60)

                                                                   BookingWidget.tsx
                                  GET  /api/doctors/[slug]/availability  ←──────────
                                  POST /api/appointments/bookings         ←──────────
```

---

## 9. Files NOT to touch during rewrite

These are working and unrelated to appointments:

- `apps/doctor/src/hooks/useDashboardCalendar.ts` — for floating DayDetailsWidget, different endpoint
- `apps/doctor/src/hooks/useDayDetails.ts` — same
- `apps/doctor/src/app/appointments/layout.tsx` — copy as-is to appointments-v2
- `apps/public/src/app/cancel-booking/page.tsx` — ~~patient self-cancel, works fine~~ **MODIFIED**: passes `confirmationCode` in PATCH body for auth (see Bug 14 fix, section 13)
- `apps/public/src/app/review/[token]/page.tsx` — review flow, works fine
- `apps/api/src/lib/google-calendar.ts` — GCal integration, reuse unchanged
- `apps/api/src/lib/sms.ts` — SMS, reuse unchanged
- `apps/api/src/lib/activity-logger.ts` — logging, reuse unchanged

---

## 10. Migration checklist

Before pushing any code that touches the DB schema:

- [ ] `packages/database/prisma/migrations/add-slot-is-public.sql` created
- [ ] `packages/database/prisma/migrations/add-clinic-locations.sql` created
- [ ] File A (`add-slot-is-public.sql`) run against Railway
- [ ] File B (`add-clinic-locations.sql`) run against Railway (creates table + migrates existing clinic data)
- [ ] Verify: each doctor now has 1 row in `clinic_locations` with their existing address
- [ ] `pnpm db:generate` run locally
- [ ] Code pushed after DB migrations (never before)
- [ ] Verify: `clinicAddress` columns still exist on `doctors` table (kept for backward compat)

---

## 11. Implementation order (ready to start)

```
Step 1  API quick fixes (bulk auth, stale availability, extract utils)   ← START HERE
Step 2  DB migration
          2a. add-slot-is-public.sql → Railway
          2b. add-clinic-locations.sql → Railway (creates table + migrates existing data)
          2c. pnpm db:generate
Step 3  Multi-clinic locations — profile side
          3a. API: doctors/[slug] GET includes clinicLocations[]
          3b. API: doctors/[slug] PUT handles clinic_locations[] (upsert, enforce max 2)
          3c. UI: ClinicSection.tsx updated for 2-location support
Step 4  Rewrite bookings/instant + availability + slot location support
          4a. bookings/instant → creates private slot with locationId (rewrite)
          4b. availability/route.ts → filter isPublic:true, include location in response
          4c. bookings/[id]/route.ts → Gap A: delete private slot on booking CANCEL or DELETE
          4d. bookings GET → remove OR freeform hack (verify zero freeform bookings in Railway first)
          4e. slots/route.ts GET → include location { name, address } in slot response
          4f. slots/route.ts POST → accept locationId in body
          4g. slots/[id]/route.ts PUT → accept locationId in body
          4h. bookings/route.ts SMS → use slot.location?.address ?? doctor.clinicAddress
          4i. bookings/[id]/route.ts SMS → same location fallback pattern
          4j. instant/route.ts SMS → update to use slot.location?.address (replaces placeholder fix)
Step 5  Build appointments-v2 UI
          5a. _hooks/ (useCalendar, useSlots with clinicLocations, useBookings)
          5b. _components/ (BookingsSection, Calendar, DaySlotPanel, SlotListView)
          5c. CreateSlotsModal with location picker
          5d. BookPatientModal/ (4 files, location-aware)
          5e. page.tsx
Step 6  Swap + cleanup
          6a. Rename routes (appointments-old / appointments)
          6b. Fix conflict-checker.ts
          6c. Update AI chat context (live booking count, include location)
          6d. Fix BookingWidget.tsx alert() calls
          6e. Update SMS to use slot.location.address
          6f. Delete old files
```

Steps 1 and 3 are fully independent of the UI work. Step 2 must run on Railway before Steps 3/4/5 are deployed.
The public app is unaffected at every step.

---

## 12. Resolved design gaps — implementation notes

These are concrete decisions resolved by reading the actual code. Each maps to a specific file/line.

### Gap A — Private slot lifecycle: cancel or delete booking → delete the slot

When a booking on an `isPublic: false` slot is cancelled (PATCH `/bookings/[id]`) or deleted (DELETE `/bookings/[id]`), the orphaned private slot must be deleted too.

**In `bookings/[id]/route.ts` PATCH** — after setting status to CANCELLED (terminal path):
```typescript
// After updating booking status to CANCELLED
if (currentBooking.slotId) {
  const slot = currentBooking.slot;
  if (slot && slot.isPublic === false) {
    await prisma.appointmentSlot.delete({ where: { id: currentBooking.slotId } });
    // GCal event was already queued for deletion above — no extra work needed
  }
}
```

**In `bookings/[id]/route.ts` DELETE** — after deleting the booking:
```typescript
if (booking.slotId && booking.slot?.isPublic === false) {
  await prisma.appointmentSlot.delete({ where: { id: booking.slotId } });
}
```

**Why this is correct:** `useAppointmentsPage.ts` line 267 already anticipates this pattern — the comment reads: "404 = slot was already deleted (e.g. instant slot removed when its booking was cancelled above)". The UI already handles the 404 case gracefully.

**Note:** `onDelete: Cascade` on Booking → Slot FK means deleting the slot would also delete the booking. So the order matters: delete booking first (or let cascade handle it), then (if we're deleting the slot separately) just delete the slot and the booking is already gone.

Actually: `onDelete: Cascade` is on **Booking** referencing **Slot** — meaning if slot is deleted, all its bookings cascade-delete. So: deleting the private slot is sufficient; the booking will cascade-delete automatically. But in the PATCH cancel case we've already updated the booking to CANCELLED, so we should delete the slot explicitly after the status update (not rely on cascade, since we've already written the booking).

**Safest order for PATCH cancel:**
1. Update booking status → CANCELLED
2. If `slot.isPublic === false`: delete the slot (booking already CANCELLED, cascade won't cause issues)

**Safest order for DELETE:**
1. Delete the booking record
2. If `slot.isPublic === false`: delete the slot (booking already gone)

---

### Gap B — GCal event ID for private slots

Private slots are created like any other slot — they use `slot.googleEventId`, NOT `booking.googleEventId`. The `booking.googleEventId` field exists only for legacy freeform bookings (which we are eliminating).

**In new `bookings/instant/route.ts`:**
- Create GCal event → store result in `prisma.appointmentSlot.update({ data: { googleEventId: eventId } })`
- Same pattern as `bookings/[id]/route.ts` line 365 (regular slot confirmation)
- Do NOT store on `booking.googleEventId`

**In existing `bookings/[id]/route.ts`** — the cancel/delete/complete GCal logic already reads:
```typescript
const gcalEventId = currentBooking.slot?.googleEventId ?? currentBooking.googleEventId;
```
This fallback chain already handles both old freeform bookings (uses `booking.googleEventId`) and new private slots (uses `slot.googleEventId`). No change needed here.

---

### Gap C — SMS for instant/private slot bookings

**Current `bookings/instant/route.ts` sends NO SMS.** This is a gap — doctor books a confirmed appointment but patient gets no notification.

**New `bookings/instant/route.ts` must send:**
1. `sendPatientSMS(smsDetails, 'CONFIRMED')` — patient confirmation SMS
2. `sendDoctorSMS(smsDetails)` — doctor notification SMS

The `smsDetails` shape is the same as in `bookings/route.ts` lines 252-266:
```typescript
const smsDetails = {
  patientName,
  patientPhone,
  doctorName: doctor.doctorFullName,
  doctorPhone: doctor.clinicPhone || undefined,
  date: slot.date.toISOString(),
  startTime: slot.startTime,
  endTime: slot.endTime,
  duration: slot.duration,
  finalPrice,
  confirmationCode,
  clinicAddress: slot.location?.address ?? doctor.clinicAddress || undefined,
  specialty: doctor.primarySpecialty || undefined,
  reviewToken,
};
```

Fetch the doctor record for SMS details right after the transaction — same pattern as `bookings/route.ts` lines 207-221 (`prisma.booking.findUnique` with `include: { slot, doctor }` — but here we can include the slot via `include: { doctor, location }` since we just created the slot).

---

### Gap D — Unique constraint collision in new instant route

The new `bookings/instant/route.ts` creates a real `AppointmentSlot`, which has:
```
@@unique([doctorId, date, startTime])
```

If the doctor already has a slot at that date+startTime (e.g. they created a public slot earlier), Prisma throws a P2002 unique constraint violation.

**Handle in new route:**
```typescript
} catch (err: any) {
  if (err?.code === 'P2002') {
    return NextResponse.json(
      { success: false, error: 'Ya tienes un horario creado a esa hora. Selecciona un horario diferente o usa "Horarios disponibles" para agendar en el horario existente.' },
      { status: 409 }
    );
  }
  throw err;
}
```

---

### Gap E — BookPatientModal "Horarios disponibles" uses doctor endpoint

Confirmed from reading `BookPatientModal.tsx`: the slot list in "Horarios disponibles" calls:
```
GET /api/appointments/slots?doctorId=...
```
This is the **authenticated doctor endpoint** (same one used by `useSlots.ts`), NOT the public `/api/doctors/[slug]/availability` endpoint. This is correct — doctors see their full slot list, not the filtered public view.

The modal fetches from this endpoint directly using `authFetch` (not `fetch`). It filters client-side:
```typescript
slot.isOpen && slot.currentBookings < slot.maxBookings && slot.date >= today
```

**After rewrite:** change `slot.currentBookings < slot.maxBookings` to use the live count included in the Prisma query (`slot._count?.bookings` or computed field). The `GET /api/appointments/slots` already returns correct live booking count — no change needed on the API side.

---

### Gap F — CreateSlotsModal needs `clinicLocations` prop

`CreateSlotsModal.tsx` currently receives: `{ isOpen, onClose, doctorId, onSuccess, initialData? }`

**Add:** `clinicLocations: ClinicLocation[]` prop. When `clinicLocations.length >= 2`, show the location radio picker section (documented in section 5b). The selected `locationId` is added to the POST body.

**`page.tsx`** passes `slots.clinicLocations` (from `useSlots.ts`) to both `CreateSlotsModal` and `BookPatientModal`.

---

### Gap G — Voice handler stays in `page.tsx`

The voice data flow confirmed from `useAppointmentsPage.ts`:
```
voice mic → onVoiceTranscript → handleVoiceConfirm(voiceFormData) → opens CreateSlotsModal with initialData
```

`handleVoiceConfirm` is a handler in the page-level hook that sets `voiceFormData` state and opens the modal. This stays in `page.tsx` (or the new equivalent page-level component). It does NOT move into `useSlots.ts` or `useCalendar.ts`.

In the new `page.tsx`, the voice open state and handler live alongside the modal open states:
```typescript
const [createSlotsOpen, setCreateSlotsOpen] = useState(false);
const [voiceFormData, setVoiceFormData] = useState<VoiceFormData | null>(null);

function handleVoiceConfirm(data: VoiceFormData) {
  setVoiceFormData(data);
  setCreateSlotsOpen(true);
}
```

---

### Gap H — AI chat `slotEstado()` fix (Step 6c detail)

In `apps/doctor/src/app/api/appointments-chat/route.ts` line 115:

```typescript
// CURRENT (wrong — reads stale DB counter)
function slotEstado(slot: any): string {
  if (!slot.isOpen) return 'cerrado';
  if (slot.currentBookings >= slot.maxBookings) return 'lleno';
  return 'disponible';
}

// FIX — use live count from included bookings relation
function slotEstado(slot: any): string {
  if (!slot.isOpen) return 'cerrado';
  const activeBookings = slot.bookings?.length ?? 0;  // bookings already included in Prisma query
  if (activeBookings >= slot.maxBookings) return 'lleno';
  return 'disponible';
}
```

The Prisma query in `fetchContext()` already includes `bookings: { where: { status: { notIn: ['CANCELLED'] } } }` — so `slot.bookings.length` gives the correct live count. No query change needed.

**Also in Step 6c:** Add `isPublic: true` filter to the AI chat's `fetchContext` query so private slots don't confuse the AI. Or keep private slots — the doctor wants to see their own schedule including private appointments. **Decision: keep all slots (no isPublic filter) in AI context** — doctor is asking about their own day, private appointments are relevant.

---

### Gap I — `doctors/route.ts` POST: create default ClinicLocation

When a new doctor is created via `POST /api/doctors`, the handler must also create the default `ClinicLocation`. Use nested Prisma create:

```typescript
await prisma.doctor.create({
  data: {
    // ... existing fields ...
    clinicLocations: {
      create: [{
        id: createId(),  // or let Prisma generate via @default(cuid())
        name: 'Consultorio Principal',
        address: body.clinic_info?.address ?? '',
        phone: body.clinic_info?.phone ?? null,
        whatsapp: body.clinic_info?.whatsapp ?? null,
        hours: body.clinic_info?.hours ?? {},
        geoLat: body.clinic_info?.geo_lat ?? null,
        geoLng: body.clinic_info?.geo_lng ?? null,
        isDefault: true,
        displayOrder: 0,
      }],
    },
  },
});
```

---

### Gap J — `DoctorProfileContext` cannot provide `clinicLocations`

`DoctorProfileContext.tsx` has `DoctorProfile` interface: `{ id, slug, doctorFullName, primarySpecialty, city, heroImage, shortBio, yearsExperience, clinicPhone, clinicWhatsapp }` — no location data. It fetches from the unauthenticated doctor list endpoint and filters by doctorId.

**Do NOT extend DoctorProfileContext** for clinic locations. Instead, `useSlots.ts` fetches from the new lightweight endpoint on mount:

```typescript
// In useSlots.ts, called once on component mount
const res = await authFetch(`/api/doctors/${doctorSlug}/locations`);
const { data } = await res.json();
setClinicLocations(data);
```

The new `GET /api/doctors/[slug]/locations` endpoint returns the doctor's `ClinicLocation[]` array. No auth needed (public info). Implementation: `prisma.clinicLocation.findMany({ where: { doctorId: ... }, orderBy: { displayOrder: 'asc' } })`.

---

## 13. Review session findings (2026-03-14)

Second pass through the codebase after Steps 1–3 were implemented. Three bugs found that were missed in the original audit. All fixed before proceeding to Step 4.

### Bugs missed in original audit

**Bug 14 — `PATCH /bookings/[id]` had no auth (FIXED)**
Any unauthenticated caller who knew a booking ID could change its status. Fix: try `validateAuthToken`; if authenticated (doctor/admin), allow all valid transitions with ownership check; if unauthenticated, only allow `CANCELLED` when request body includes correct `confirmationCode`. `apps/public/src/app/cancel-booking/page.tsx` updated to pass `confirmationCode` in the PATCH body.

**Bug 15 — `instant/route.ts` sent no SMS (FIXED)**
Doctor-initiated bookings sent no confirmation to the patient or doctor. Fixed by adding `sendPatientSMS` + `sendDoctorSMS` calls using the same `smsDetails` shape as `bookings/route.ts`. Note: this is a placeholder fix — Step 4 will replace it with slot-based location resolution (`slot.location?.address ?? doctor.clinicAddress`).

**Bug 16 — `conflict-checker.ts` checked `slot.status` which doesn't exist (FIXED)**
`slot.status === 'AVAILABLE'` always evaluated to `false` (slots have no `status` field). Appointment conflicts were silently never detected. Fix: `slot.isOpen === true || (slot.currentBookings ?? 0) > 0`. Fixed immediately rather than waiting for Step 6.

### Plan gaps found

**Gap K — Three slot API files had no step assignment**
`slots/route.ts` GET/POST and `slots/[id]/route.ts` PUT need location support (`locationId` input, `location { name, address }` output) but were not assigned to any step. Assigned to Step 4 (items 4e–4g).

**Gap L — SMS location update in bookings routes had no step assignment**
`bookings/route.ts` and `bookings/[id]/route.ts` SMS must use `slot.location?.address ?? doctor.clinicAddress` but were not assigned to any step. Assigned to Step 4 (items 4h–4j).

**Gap M — Gap A (private slot cleanup) had no step assignment**
Documented in section 12 but missing from section 11. Assigned to Step 4 (item 4c).

### Step 6 items moved up

- `conflict-checker.ts` fix → done now (not Step 6)
- `cancel-booking/page.tsx` → modified for auth (plan said "do not touch" — outdated, required by Bug 14 fix)
