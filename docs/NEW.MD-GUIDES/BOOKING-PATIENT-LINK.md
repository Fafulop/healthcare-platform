# Booking ↔ Patient Link

**Date:** 2026-04-11
**Scope:** `apps/doctor`, `apps/api`, `packages/database`
**Related:** `APPOINTMENTS-FULL-UI-MAP.md`, `database-architecture.md`, `EXTENDED-BLOCK-APPOINTMENTS.md`
**Status:** Planned — not yet implemented

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current State of Both Systems](#2-current-state-of-both-systems)
3. [Design Decisions](#3-design-decisions)
4. [Part 1 — Database: patientId on Booking](#4-part-1--database-patientid-on-booking)
5. [Part 2 — Todas las Citas: EXPEDIENTE column](#5-part-2--todas-las-citas-expediente-column)
6. [Part 3 — Agendar Cita modal: patient pre-link](#6-part-3--agendar-cita-modal-patient-pre-link)
7. [Part 4 — Patient expediente: Citas card](#7-part-4--patient-expediente-citas-card)
8. [API Changes Summary](#8-api-changes-summary)
9. [Migration & Deployment](#9-migration--deployment)
10. [Edge Cases](#10-edge-cases)
11. [File Reference](#11-file-reference)

---

## 1. Problem Statement

The appointment system (`public.bookings`) and the medical records system (`medical_records.patients`) are completely decoupled. Bookings store patient identity as freeform text fields (`patientName`, `patientEmail`, `patientPhone`). There is no programmatic link between a booking and a patient record (expediente).

This means:
- When a doctor sees a CONFIRMED booking, they cannot navigate directly to that patient's clinical history
- When viewing a patient's expediente, there is no way to see their appointment history
- When a patient books from the public portal, they may type their name differently each time — the system cannot help identify that it is the same person

The goal of this feature is to allow doctors to **explicitly link** any booking to a Patient record, and to expose that link in both directions: from appointments → patient, and from patient → appointments.

---

## 2. Current State of Both Systems

### Booking model (`public.bookings`)

Patient identity stored as plain strings — no FK to Patient:

```prisma
model Booking {
  patientName      String
  patientEmail     String
  patientPhone     String
  patientWhatsapp  String?
  isFirstTime      Boolean?   // true = Primera vez, false = Recurrente
  // NO patientId field exists yet
}
```

### Patient model (`medical_records.patients`)

Full medical record entity. Key fields relevant to this feature:

```prisma
model Patient {
  id          String   @id @default(cuid())
  doctorId    String
  firstName   String   @db.VarChar(100)
  lastName    String   @db.VarChar(100)
  dateOfBirth DateTime @db.Date        // required
  sex         String   @db.VarChar(20) // required: "male" | "female" | "other"
  email       String?  @db.VarChar(255)
  phone       String?  @db.VarChar(50)
  status      String   @default("active") // "active" | "inactive" | "archived"
  // NO bookings relation exists yet
}
```

### Existing patient search API

`GET /api/medical-records/patients?search=&status=active`

- `search` does case-insensitive `ILIKE %term%` across `firstName`, `lastName`, `internalId`
- Returns: `id`, `firstName`, `lastName`, `phone`, `email`, `photoUrl`, `status`, `tags`, `lastVisitDate`
- Ordered by `lastVisitDate DESC`

This endpoint is reused for all patient search/suggestions in this feature — no new search API needed.

---

## 3. Design Decisions

### No automatic linking
The system never auto-links a booking to a patient silently. The doctor always makes the explicit decision. This prevents wrong matches (especially given name typos from the public portal) and preserves medical record integrity.

### Name splitting heuristic
Bookings store `patientName` as a single string (e.g. `"Juan García López"`). The Patient model has `firstName` and `lastName` separately. When pre-filling a new patient form from a booking, split on the first space: `"Juan"` / `"García López"`. The doctor must always review before saving — this is a convenience pre-fill only.

### Fuzzy name tolerance
When searching for an existing patient to link to a Recurrente booking, the doctor types any name fragment. The existing `search` endpoint handles `ILIKE %term%` which covers most typos and partial matches. The doctor sees a list and picks the right one — no automatic matching.

### Cross-schema FK
`Booking` is in the `public` schema. `Patient` is in `medical_records`. PostgreSQL supports cross-schema foreign keys natively. Prisma's `multiSchema` preview feature (already enabled in this project) supports cross-schema relations. `onDelete: SetNull` is used so deleting a patient does not cascade-delete their bookings — it simply unlinks them.

### patientId is always optional
`patientId` is nullable on Booking. Existing bookings work unchanged. Future bookings that are never linked also work unchanged. Linking is a separate optional action, not a required step in any flow.

---

## 4. Part 1 — Database: patientId on Booking

### Schema change (`packages/database/prisma/schema.prisma`)

Add to the `Booking` model:

```prisma
model Booking {
  // ... existing fields ...

  // Optional link to a Patient record in medical_records.
  // Set by the doctor after confirming a booking. Null = not yet linked.
  patientId  String?  @map("patient_id")
  patient    Patient? @relation(fields: [patientId], references: [id], onDelete: SetNull)
}
```

Add the inverse relation to the `Patient` model:

```prisma
model Patient {
  // ... existing fields ...
  bookings  Booking[]
}
```

### SQL migration (`packages/database/prisma/migrations/add-booking-patient-link.sql`)

```sql
-- Migration: Link bookings to patients via optional patient_id FK
-- Purpose: Allow doctors to associate appointment bookings with patient records
-- Date: 2026-04-11

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS patient_id TEXT;

-- Cross-schema FK: public.bookings → medical_records.patients
-- Wrapped in DO block so it is safe to re-run (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_patient_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_patient_id_fkey
      FOREIGN KEY (patient_id)
      REFERENCES medical_records.patients(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS bookings_patient_id_idx
  ON public.bookings(patient_id);
```

### Run locally then on Railway (before deploying)

```powershell
# Local (run from packages/database)
cd packages/database
npx prisma db execute --file prisma/migrations/add-booking-patient-link.sql --schema prisma/schema.prisma

# Railway (run from repo root or packages/database — use public URL)
npx prisma db execute --file packages/database/prisma/migrations/add-booking-patient-link.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"

# Regenerate client (run from repo root)
pnpm db:generate
```

---

## 5. Part 2 — Todas las Citas: EXPEDIENTE column

### Location

`apps/doctor/src/app/appointments/_components/BookingsSection.tsx`

### New column header

Add `EXPEDIENTE` column between `SERVICIO` and `CONTACTO` in the desktop table header.

### Cell logic (per booking row)

```
booking.patientId is set
  → Show: [patient name] as link → /dashboard/medical-records/patients/[patientId]

booking.patientId is null AND isFirstTime === true
  → Show: [Crear expediente] button → opens CreatePatientFromBookingModal

booking.patientId is null AND isFirstTime === false
  → Show: inline search input → patient search dropdown → on select, PATCH booking.patientId

booking.patientId is null AND isFirstTime === null
  → Show: — (dash, no action)
```

### Mobile cards

The same logic applies to the mobile card layout — show it as a small row below the service name.

### "Crear expediente" modal (`CreatePatientFromBookingModal`)

A new component that:
1. Opens with booking data pre-filled
2. Splits `booking.patientName` → `firstName` / `lastName` (first space as separator)
3. Pre-fills `email` from `booking.patientEmail`, `phone` from `booking.patientPhone`
4. Shows a form for the required fields that bookings don't have: `dateOfBirth`, `sex`
5. Optional fields visible but not required
6. On submit:
   - `POST /api/medical-records/patients` → creates patient
   - `PATCH /api/appointments/bookings/[id]` → sets `patientId` on booking
7. On success: cell updates to linked state (patient name link), modal closes

### Patient search inline (Recurrente)

An `InlinePatientSearch` component embedded in the cell:
1. Text input with placeholder "Buscar paciente..."
2. Debounced (300ms) calls to `GET /api/medical-records/patients?search=` in the doctor app
3. Dropdown shows up to 5 results: avatar/initials, full name, phone
4. "Crear nuevo" option at bottom of dropdown as escape hatch
5. On patient select: `PATCH /api/appointments/bookings/[id]` → `{ patientId: selected.id }`
6. Cell transitions to linked state

### PATCH endpoint extension

`PATCH /api/appointments/bookings/[id]` (in `apps/api`) already handles `extendedBlockMinutes`. Extend it to also handle `patientId`:

```typescript
// Accept patientId update (set or clear)
if (patientId !== undefined && newStatus === undefined && extendedBlockMinutes === undefined) {
  // validate: patientId must belong to the booking's doctor
  // update: booking.patientId = patientId (or null to unlink)
}
```

**Ownership validation:** Before saving, verify `Patient.doctorId === booking.doctorId`. A doctor cannot link a booking to another doctor's patient.

---

## 6. Part 3 — Agendar Cita modal: patient pre-link

### Location

`apps/doctor/src/app/appointments/_components/BookPatientModal/PatientFormStep.tsx`

### What changes

When `isFirstTime === false` (Recurrente), a new section appears below the visit type buttons:

```
── Vincular expediente ──────────────────────
[ 🔍 Buscar paciente por nombre... ]
  ↓ dropdown results:
  • Juan García · 555-1234
  • Juana García López · 555-5678
  [ + Continuar sin vincular ]
```

The field is **optional** — the doctor can always skip it and link later from "Todas las Citas".

### State additions in `BookPatientModal/index.tsx`

```typescript
const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
const [selectedPatientName, setSelectedPatientName] = useState<string>("");
```

### Submit changes

Both `POST /api/appointments/bookings` and `POST /api/appointments/bookings/instant` receive the optional `patientId`:

```typescript
body: JSON.stringify({
  // ... existing fields ...
  patientId: selectedPatientId || undefined,
})
```

### API changes

Both booking creation endpoints (`bookings/route.ts` and `bookings/instant/route.ts`) accept an optional `patientId`:
- Validate it belongs to the booking's doctor
- Persist it on the created booking
- No other behavior changes

---

## 7. Part 4 — Patient expediente: Citas card

### Location

`apps/doctor/src/app/dashboard/medical-records/patients/[id]/page.tsx`

### New "Citas" section

A card added to the patient detail page, below the Encounters section. Shows all bookings where `Booking.patientId = patient.id`, ordered by appointment date descending.

Each row:
```
📅 10 Abr 2026 · 10:00–11:00  Consulta general   [Agendada]
📅 15 Mar 2026 · 09:00–09:30  Seguimiento         [Completada]
📅 02 Feb 2026 · 11:00–12:00  —                   [No asistió]
```

Fields shown per row: date, startTime–endTime, serviceName (or dash), status badge.

Empty state: "No hay citas vinculadas a este paciente."

### New API endpoint

`GET /api/medical-records/patients/[id]/bookings`

Location: `apps/doctor/src/app/api/medical-records/patients/[id]/bookings/route.ts`

```typescript
// Auth: requireDoctorAuth
// Scope: only bookings where booking.doctorId === authenticated doctorId AND booking.patientId === params.id
// Returns: id, date/startTime/endTime from slot or booking directly, serviceName, status, appointmentMode
// Order: appointment date DESC
// No pagination needed initially (patient won't have hundreds of bookings)
```

Response shape:
```json
{
  "success": true,
  "data": [
    {
      "id": "booking_id",
      "date": "2026-04-10",
      "startTime": "10:00",
      "endTime": "11:00",
      "serviceName": "Consulta general",
      "status": "CONFIRMED",
      "appointmentMode": "PRESENCIAL"
    }
  ]
}
```

---

## 8. API Changes Summary

| Endpoint | Change |
|---|---|
| `PATCH /api/appointments/bookings/[id]` | Accept `patientId` (string or null) to link/unlink |
| `POST /api/appointments/bookings` | Accept optional `patientId` on booking creation |
| `POST /api/appointments/bookings/instant` | Accept optional `patientId` on instant booking creation |
| `GET /api/medical-records/patients/[id]/bookings` | **NEW** — list bookings linked to a patient |

No changes needed to the patient search endpoint — it already supports the `search` query param with fuzzy `ILIKE` matching.

---

## 9. Migration & Deployment

### Order (CRITICAL — follow database-architecture.md rules)

```
1. Add fields to schema.prisma
2. Create SQL migration file
3. Run migration locally (verify it works)
4. Run migration against Railway BEFORE deploying code  ← do this first
5. pnpm db:generate
6. Deploy code
```

### Safe re-runs

The SQL migration uses `ADD COLUMN IF NOT EXISTS` and a `DO $$` idempotency block for the FK constraint. It is safe to run multiple times — running it again on an already-migrated database is a no-op.

### Column is nullable — zero downtime

Because `patient_id` is nullable with no `NOT NULL` constraint, the migration is fully backward-compatible. Existing rows remain untouched. No data backfill needed.

---

## 10. Edge Cases

### Patient deleted after linking
`ON DELETE SET NULL` on the FK means deleting a patient sets `booking.patientId = null`. The booking row returns to the "unlinked" state. No data loss on the booking side.

### Doctor tries to link booking to another doctor's patient
Prevented by ownership validation in the PATCH endpoint: `Patient.doctorId` must equal `booking.doctorId`. Return 403 if they don't match.

### Booking with `isFirstTime = null`
Neither the create-patient button nor the search dropdown is shown. The cell shows a dash. The doctor would need to set `isFirstTime` first (currently only settable at booking creation time — could be a future enhancement).

### Name splitting edge cases
- Single word name (e.g. `"Madonna"`) → `firstName = "Madonna"`, `lastName = ""` — the form shows empty lastName, doctor must fill
- Name with many parts (e.g. `"María de la Cruz Rodríguez"`) → `firstName = "María"`, `lastName = "de la Cruz Rodríguez"` — reasonable split

### Patient already linked, doctor wants to change
The linked patient name in the cell would need an "Editar" / unlink button to clear `patientId` (PATCH with `{ patientId: null }`) and then re-link. Keep this action non-destructive (just sets patientId to null, no patient data is deleted).

### Freeform bookings (Nuevo horario) with `slotId = null`
When a Nuevo horario booking is cancelled, the slot is deleted and `slotId` is set to null. The `patientId` survives this — it lives on the booking record itself, not on the slot. So the Citas card on the patient page will still show the cancelled booking correctly.

### Public portal bookings (PENDING, no doctor account)
The public portal never sets `patientId` — it doesn't have access to the doctor's medical records. Linking always happens from the doctor app after the booking arrives.

---

## 11. File Reference

### New files

| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/add-booking-patient-link.sql` | Cross-schema FK migration |
| `apps/doctor/src/app/appointments/_components/CreatePatientFromBookingModal.tsx` | Modal: create new patient pre-filled from booking data |
| `apps/doctor/src/app/appointments/_components/InlinePatientSearch.tsx` | Inline search + dropdown for linking existing patient |
| `apps/doctor/src/app/api/medical-records/patients/[id]/bookings/route.ts` | GET bookings linked to a patient |

### Modified files

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Add `patientId`/`patient` relation to Booking; add `bookings` inverse on Patient |
| `apps/api/src/app/api/appointments/bookings/[id]/route.ts` | PATCH: accept `patientId` to link/unlink |
| `apps/api/src/app/api/appointments/bookings/route.ts` | POST: accept optional `patientId` |
| `apps/api/src/app/api/appointments/bookings/instant/route.ts` | POST: accept optional `patientId` |
| `apps/doctor/src/app/appointments/_hooks/useBookings.ts` | Add `patientId`, `patient` (name + id) to Booking type |
| `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` | Add EXPEDIENTE column with conditional cell logic |
| `apps/doctor/src/app/appointments/_components/BookPatientModal/PatientFormStep.tsx` | Add patient search field when `isFirstTime === false` |
| `apps/doctor/src/app/appointments/_components/BookPatientModal/index.tsx` | Add `selectedPatientId` state, pass to submit |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/page.tsx` | Add Citas card section |
