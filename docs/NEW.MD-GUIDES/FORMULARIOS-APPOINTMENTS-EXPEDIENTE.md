# Formularios ↔ Appointments ↔ Expediente Integration

**Date:** 2026-04-11
**Scope:** `apps/doctor`, `apps/api`, `packages/database`
**Status:** ✅ COMPLETE — all migrations run, all code shipped

---

## Table of Contents

1. [What This Feature Does](#1-what-this-feature-does)
2. [Data Model](#2-data-model)
3. [Workflow Rules](#3-workflow-rules)
4. [Button States (Appointments Table)](#4-button-states-appointments-table)
5. [File Reference](#5-file-reference)
6. [Migrations](#6-migrations)

---

## 1. What This Feature Does

Connects three previously disconnected systems:

- **Appointments** (`public.bookings`) — where doctors manage their schedule
- **Formularios** (`public.appointment_form_links`) — pre-appointment forms sent to patients
- **Expediente médico** (`medical_records.patients`) — the patient's clinical record

**Key design decisions:**
- Formularios are **their own asset** on the patient expediente — NOT encounters/consultas
- A formulario survives even if the booking is deleted or detached — it stays linked to the patient directly via `formLink.patientId`
- Deleting a formulario FROM the appointments table just **detaches** it (clears `bookingId`), keeping it in the patient's expediente
- Deleting FROM the patient expediente is a full hard DELETE
- No auto-creation of `pre-cita` encounters — the formulario IS the record

---

## 2. Data Model

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

**Schema changes (committed):**
```prisma
model AppointmentFormLink {
  bookingId  String?  @unique @map("booking_id")   // was non-null, now nullable
  patientId  String?  @map("patient_id")            // NEW direct FK

  booking    Booking?  @relation("BookingFormLink", fields: [bookingId], references: [id], onDelete: SetNull)
  patient    Patient?  @relation(fields: [patientId], references: [id], onDelete: SetNull)

  @@index([patientId])  // NEW
}

model Patient {
  formLinks  AppointmentFormLink[]  // NEW inverse relation
}

model Booking {
  formLink  AppointmentFormLink?  @relation("BookingFormLink")  // named relation
}
```

---

## 3. Workflow Rules

| Rule | Implementation |
|---|---|
| Formulario can only be created if booking has `patientId` | `FormularioStatusButton` — state 1 shows disabled button |
| Expediente can't be unlinked from booking if SUBMITTED formLink exists | `ExpedienteCell` — X button disabled + tooltip |
| Deleting formLink from appointments (PENDING) | `DELETE /api/appointments/bookings/[id]/form-link` → hard DELETE |
| Deleting formLink from appointments (SUBMITTED) | Same endpoint → `bookingId = null` only, record stays in patient expediente |
| Deleting formLink from patient expediente | `DELETE /api/medical-records/patients/[id]/formularios/[formLinkId]` → hard DELETE |
| Patient submits form + booking has patientId | `POST /api/appointment-form` stamps `formLink.patientId` at submission |
| Doctor links patient to booking | `PATCH /api/appointments/bookings/[id]` propagates to `formLink.patientId` (fire-and-forget) |
| New formLink created | `POST /api/appointments/bookings/[id]/form-link` sets `patientId` from booking |
| FormLink regenerated (resend) | Same endpoint — also refreshes `patientId` from booking |

---

## 4. Button States (Appointments Table)

`FormularioStatusButton` in `BookingsSection.tsx` — shows only for `CONFIRMED` bookings:

```
booking.patientId          // is expediente linked?
booking.formLink?.id       // does a formLink exist?
booking.formLink?.status   // PENDING or SUBMITTED
booking.formLink?.createdAt // for expiry (freeform bookings)
booking.slot?.date         // for expiry (slot bookings)
```

| State | Condition | UI |
|---|---|---|
| 1 | No `patientId` | Gray disabled "Formulario" + tooltip "Vincular expediente primero" |
| 2 | `patientId` set, no `formLink` | Purple "Crear formulario" → opens `PreAppointmentFormModal` |
| 3 | `PENDING`, not expired | Amber "Esperando respuesta" + dropdown: Reenviar \| Cancelar formulario |
| 4 | `PENDING`, expired | Red "Enlace expirado" + dropdown: Reenviar \| Cancelar formulario |
| 5 | `SUBMITTED` | Green "Formulario recibido ✓" → link to `/dashboard/medical-records/formularios/[id]` |

**Expiry logic:**
- Slot bookings: `slot.date < today` (Mexico City tz)
- Freeform bookings: `formLink.createdAt + 7 days < now`

---

## 5. File Reference

### New files
| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/add-form-link-patient-id.sql` | Make `booking_id` nullable, add `patient_id` FK |
| `packages/database/prisma/migrations/backfill-form-link-patient-id.sql` | Backfill `patient_id` for existing SUBMITTED formLinks |
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/route.ts` | GET formularios for patient (by direct `patientId`) |
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/[formLinkId]/route.ts` | DELETE formulario from patient expediente |
| `apps/doctor/src/app/appointments/_components/FormularioStatusButton.tsx` | Smart 5-state button with click-outside dropdown |

### Modified files
| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | `bookingId` nullable, `patientId` FK added, inverse relations |
| `apps/api/src/app/api/appointment-form/route.ts` | Stamps `formLink.patientId` on SUBMIT; null-guards booking |
| `apps/api/src/app/api/appointments/bookings/[id]/route.ts` | Propagates `patientId` to formLink on PATCH |
| `apps/api/src/app/api/appointments/bookings/[id]/form-link/route.ts` | Sets `patientId` on create/regenerate; adds DELETE handler |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Includes `formLink.createdAt` in GET select |
| `apps/api/src/app/api/appointments/form-links/route.ts` | Uses `fl.patient` directly (fallback to `booking.patient`) |
| `apps/api/src/app/api/appointments/form-links/[id]/route.ts` | Uses `formLink.patient` directly; nullable booking handled |
| `apps/doctor/src/app/api/medical-records/patients/[id]/formularios/route.ts` | Filter by direct `patientId`; nullable booking guarded |
| `apps/doctor/src/app/api/medical-records/patients/[id]/timeline/route.ts` | Filter by direct `patientId`; nullable booking guarded |
| `apps/doctor/src/app/appointments/_hooks/useBookings.ts` | `formLink` type includes `createdAt`; new `deleteFormLink` action |
| `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` | `FormularioStatusButton` integrated; unlink guard in `ExpedienteCell`; `onDeleteFormLink` prop |
| `apps/doctor/src/app/appointments/page.tsx` | Passes `onDeleteFormLink={bookingsHook.deleteFormLink}` |

---

## 6. Migrations

All three migrations have been executed on both local and Railway:

```powershell
# From packages/database/
npx prisma db execute --file prisma/migrations/add-form-link-patient-id.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/backfill-form-link-patient-id.sql --schema prisma/schema.prisma

# Railway
npx prisma db execute --file prisma/migrations/add-form-link-patient-id.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
npx prisma db execute --file prisma/migrations/backfill-form-link-patient-id.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"

# Regenerate client
cd ../.. && pnpm db:generate
```

**Status:** ✅ All migrations run. Client regenerated. Code committed and pushed (`6ab536c3`).
