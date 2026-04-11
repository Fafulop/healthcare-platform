# Formularios ↔ Appointments ↔ Expediente Integration

**Date:** 2026-04-11
**Scope:** `apps/doctor`, `apps/api`, `apps/public`, `packages/database`
**Status:** IN PROGRESS — schema migration pending execution

---

## Table of Contents

1. [What This Feature Does](#1-what-this-feature-does)
2. [Completed Work](#2-completed-work)
3. [In Progress — Schema Change](#3-in-progress--schema-change)
4. [What Still Needs To Be Done](#4-what-still-needs-to-be-done)
5. [Data Model](#5-data-model)
6. [Workflow Rules](#6-workflow-rules)
7. [Button States (Appointments Table)](#7-button-states-appointments-table)
8. [File Reference](#8-file-reference)

---

## 1. What This Feature Does

Connects three previously disconnected systems:

- **Appointments** (`public.bookings`) — where doctors manage their schedule
- **Formularios** (`public.appointment_form_links`) — pre-appointment forms sent to patients
- **Expediente médico** (`medical_records.patients`) — the patient's clinical record

**Key design decisions:**
- Formularios are **their own asset** on the patient expediente — NOT encounters/consultas
- A formulario survives even if the booking is deleted or detached — it stays linked to the patient directly
- Deleting a formulario FROM the appointments table just **detaches** it (clears `bookingId`), keeping it in the patient's expediente
- Deleting FROM the patient expediente is a full DELETE
- No auto-creation of `pre-cita` encounters — the formulario IS the record

---

## 2. Completed Work

### Already committed and pushed

#### Booking ↔ Patient link (commit: `6ca2a236` range)
- `Booking.patientId` → nullable FK to `medical_records.patients`
- SQL migration: `packages/database/prisma/migrations/add-booking-patient-link.sql`
- `PATCH /api/appointments/bookings/[id]` — accepts `patientId` to link/unlink
- `GET /api/appointments/form-links` — returns `linkedPatient` from `booking.patient`
- `GET /api/appointments/form-links/[id]` — returns `bookingId`, `linkedPatient` from `booking.patient`
- `ExpedienteCell` in `BookingsSection.tsx` — EXPEDIENTE column with 4 states + unlink X button
- `InlinePatientSearch.tsx` — debounced search dropdown for linking existing patient
- `CreatePatientFromBookingModal.tsx` — create new patient pre-filled from booking
- `PreAppointmentFormModal` — patient pre-link when tipo = Recurrente

#### Formularios integration (commits: `757529c3`, `c575ed9b`)
- `GET /api/medical-records/patients/[id]/bookings` — includes `formLinkId` (only SUBMITTED)
- `GET /api/medical-records/patients/[id]/formularios` — new endpoint, returns SUBMITTED formLinks for patient
- Timeline API — adds `formulario` type items (from `appointment_form_links` where `booking.patientId = patient.id`)
- `TimelineView.tsx` — new violet `formulario` item type, links to `/formularios/[id]`
- Patient main page — new "Formularios Pre-Cita" card + "Formulario" badge on Citas card rows
- Timeline stats — 5th column for Formularios (responsive grid)
- Formularios detail page — attach simplified to just PATCH `booking.patientId` (no encounter creation)
- Formularios list page — EXPEDIENTE column shows linked patient

---

## 3. In Progress — Schema Change

### Problem
Currently the formulario's patient connection is **indirect**:
```
AppointmentFormLink → Booking → Patient (via booking.patientId)
```

If a formLink is "deleted from appointments", the record is gone from everywhere — can't persist in patient expediente.

### Solution
Add **direct `patientId` FK** on `AppointmentFormLink` and make `bookingId` nullable:

```
AppointmentFormLink.bookingId  → Booking  (nullable, detachable)
AppointmentFormLink.patientId  → Patient  (direct, independent)
```

### Schema changes (`packages/database/prisma/schema.prisma`)

**AppointmentFormLink model — ALREADY EDITED:**
```prisma
model AppointmentFormLink {
  bookingId  String?  @unique @map("booking_id")   // was non-null, now nullable
  patientId  String?  @map("patient_id")            // NEW direct FK

  booking    Booking?  @relation("BookingFormLink", fields: [bookingId], references: [id], onDelete: SetNull)
  patient    Patient?  @relation(fields: [patientId], references: [id], onDelete: SetNull)

  @@index([patientId])  // NEW
}
```

**Patient model — ALREADY EDITED:**
```prisma
model Patient {
  formLinks  AppointmentFormLink[]  // NEW inverse relation
}
```

**Booking model — ALREADY EDITED:**
```prisma
formLink  AppointmentFormLink?  @relation("BookingFormLink")  // named relation added
```

### SQL migration — ALREADY CREATED
File: `packages/database/prisma/migrations/add-form-link-patient-id.sql`

```sql
ALTER TABLE public.appointment_form_links
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE public.appointment_form_links
  ADD COLUMN IF NOT EXISTS patient_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_form_links_patient_id_fkey') THEN
    ALTER TABLE public.appointment_form_links
      ADD CONSTRAINT appointment_form_links_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES medical_records.patients(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS appointment_form_links_patient_id_idx
  ON public.appointment_form_links(patient_id);
```

### ⚠️ PENDING: Run migration + backfill + regenerate client

```powershell
# Local
cd packages/database
npx prisma db execute --file prisma/migrations/add-form-link-patient-id.sql --schema prisma/schema.prisma
# Backfill existing SUBMITTED formLinks that were linked via booking.patientId
npx prisma db execute --file prisma/migrations/backfill-form-link-patient-id.sql --schema prisma/schema.prisma

# Railway (run BEFORE deploying)
npx prisma db execute --file packages/database/prisma/migrations/add-form-link-patient-id.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
npx prisma db execute --file packages/database/prisma/migrations/backfill-form-link-patient-id.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"

# Regenerate client
cd .. && pnpm db:generate
```

---

## 4. What Still Needs To Be Done

After migration is run and client is regenerated:

### A. Populate `formLink.patientId` in 3 places

**1. `POST /api/appointment-form` (apps/api — public form submission)**
When patient submits the form:
```typescript
// After setting status SUBMITTED, check booking.patientId
if (formLink.booking?.patientId) {
  await prisma.appointmentFormLink.update({
    where: { id: formLink.id },
    data: { patientId: formLink.booking.patientId },
  });
}
```

**2. `PATCH /api/appointments/bookings/[id]` (apps/api)**
When doctor sets `patientId` on a booking, also propagate to its formLink:
```typescript
// After updating booking.patientId, update formLink if exists
await prisma.appointmentFormLink.updateMany({
  where: { bookingId: id },
  data: { patientId: patientId ?? null },
});
```

**3. `POST /api/appointments/bookings/[id]/form-link` (apps/api)**
When creating a new formLink, if booking already has `patientId`, set it:
```typescript
data: {
  ...existingFields,
  patientId: booking.patientId ?? null,
}
```

### B. Update queries to use direct `patientId` filter

Replace `booking: { patientId }` with `patientId` in:

| File | Current | Should be |
|---|---|---|
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/route.ts` | `where: { booking: { patientId } }` | `where: { patientId }` |
| `apps/doctor/src/app/api/medical-records/patients/[id]/timeline/route.ts` | `where: { booking: { patientId } }` | `where: { patientId }` |
| `apps/api/src/app/api/appointments/form-links/route.ts` | `linkedPatient` from `fl.booking.patient` | `linkedPatient` from `fl.patient` directly |
| `apps/api/src/app/api/appointments/form-links/[id]/route.ts` | `linkedPatient` from `booking.patient` | `linkedPatient` from `formLink.patient` directly |

### C. New DELETE endpoints

**1. Detach from appointments: `DELETE /api/appointments/bookings/[id]/form-link` (apps/api)**
- If formLink status is `PENDING` → hard delete (no patient data lost)
- If formLink status is `SUBMITTED` → set `bookingId = null` (detach only, keep in patient expediente)
- Auth: doctor must own the booking
- Response: `{ success: true }`

**2. Full delete from patient expediente: `DELETE /api/medical-records/patients/[id]/formularios/[formLinkId]` (apps/doctor)**
- Hard DELETE of the `AppointmentFormLink` record
- Auth: doctor must own the patient and the formLink
- Response: `{ success: true }`

### D. Button states in BookingsSection (`FormularioStatusButton`)

Replace the static "Formulario" button in `BookingsSection.tsx` with a smart component:

```
No expediente linked     → [Formulario] disabled, tooltip "Vincular expediente primero"
Has expediente, no form  → [Crear formulario]  (purple)
PENDING, not expired     → [Esperando respuesta]  + Reenviar option + Cancelar
PENDING, expired         → [Enlace expirado]  + Reenviar option
SUBMITTED                → [Formulario recibido ✓]  (green) + link to /formularios/[id]
```

Expiry logic: appointment date < today → expired (for slot bookings).
For freeform/COMPLETED bookings without a future date: use 7-day window from `formLink.createdAt`.

The `useBookings` hook needs to expose `formLink` data on each booking:
```typescript
formLink?: {
  id: string;
  status: 'PENDING' | 'SUBMITTED';
  createdAt: string;
} | null;
```

And the bookings GET API needs to include `formLink` in its select.

### E. Unlink guard in ExpedienteCell

The unlink X button currently allows removing a patient from any booking.
Add check: if `booking.formLink?.status === 'SUBMITTED'`, block the unlink and show a message:
"Desvincular el formulario recibido primero."

---

## 5. Data Model

```
Doctor (1)
  └── (many) Booking
        ├── (optional) patientId → Patient
        └── (optional, 1:1) AppointmentFormLink
              ├── bookingId → Booking  (nullable — can be detached)
              ├── patientId → Patient  (direct, independent of booking)
              ├── status: PENDING | SUBMITTED
              └── submissionData (JSON — patient's answers)

Patient (1)
  ├── (many) Booking (via booking.patientId)
  └── (many) AppointmentFormLink (via formLink.patientId)
```

---

## 6. Workflow Rules

| Rule | Implementation |
|---|---|
| Formulario can only be created if booking has `patientId` | API: block `POST form-link` if `booking.patientId` is null (return 422) |
| Expediente can't be unlinked from booking if SUBMITTED formLink exists | UI: disable X in ExpedienteCell + tooltip |
| Deleting formLink from appointments (PENDING) | Hard DELETE — `bookingId` was unique, now free to create another |
| Deleting formLink from appointments (SUBMITTED) | Set `bookingId = null` — keeps in patient expediente via `patientId` |
| Deleting formLink from patient expediente | Hard DELETE of formLink record |
| Patient submits form + booking has patientId | Auto-populate `formLink.patientId` at submission time |
| Doctor links patient to booking | Also propagate to existing `formLink.patientId` if formLink exists |

---

## 7. Button States (Appointments Table)

The "Formulario" button in `BookingsSection.tsx` (currently static) becomes `FormularioStatusButton`:

```tsx
// Booking data needed on each row:
booking.patientId          // is expediente linked?
booking.formLink?.id       // does a formLink exist?
booking.formLink?.status   // PENDING or SUBMITTED
booking.formLink?.createdAt // for expiry calculation (freeform bookings)
booking.slot?.date         // appointment date (for expiry on slot bookings)
```

States:
1. **No `patientId`** → gray disabled button "Formulario", tooltip "Vincular expediente primero"
2. **Has `patientId`, no `formLink`** → purple "Crear formulario" button → opens `PreAppointmentFormModal`
3. **`formLink.status === PENDING`, not expired** → "Esperando respuesta" + dropdown: Reenviar | Cancelar
4. **`formLink.status === PENDING`, expired** → "Enlace expirado" + dropdown: Reenviar | Cancelar
5. **`formLink.status === SUBMITTED`** → green "Formulario recibido" → links to `/formularios/[id]`

---

## 8. File Reference

### New files (all already created/committed)
| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/add-form-link-patient-id.sql` | Make `booking_id` nullable, add `patient_id` FK |
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/route.ts` | GET formularios for patient |

### Files to create (pending)
| File | Purpose |
|---|---|
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/[formLinkId]/route.ts` | DELETE formulario from patient expediente |
| `apps/doctor/src/app/appointments/_components/FormularioStatusButton.tsx` | Smart button with 5 states |

### Files to modify (pending)
| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | ✅ Already done — bookingId nullable, patientId added |
| `apps/api/src/app/api/appointment-form/route.ts` | Set `formLink.patientId` on submission |
| `apps/api/src/app/api/appointments/bookings/[id]/route.ts` | Propagate patientId to formLink on PATCH |
| `apps/api/src/app/api/appointments/bookings/[id]/form-link/route.ts` | Set patientId from booking on create; add DELETE handler |
| `apps/api/src/app/api/appointments/form-links/route.ts` | Use `patientId` filter directly |
| `apps/api/src/app/api/appointments/form-links/[id]/route.ts` | Use `formLink.patient` directly |
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/route.ts` | Use `patientId` filter directly |
| `apps/doctor/src/app/api/medical-records/patients/[id]/timeline/route.ts` | Use `patientId` filter directly |
| `apps/doctor/src/app/appointments/_hooks/useBookings.ts` | Add `formLink` to Booking type |
| `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` | Replace button with `FormularioStatusButton`; add unlink guard |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Include `formLink` in GET select |
