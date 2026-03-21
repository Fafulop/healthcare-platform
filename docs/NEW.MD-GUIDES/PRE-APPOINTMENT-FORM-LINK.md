# Pre-Appointment Form Link — Implementation Guide

**Created:** 2026-03-21
**Status:** Ready to implement
**Scope:** `apps/api`, `apps/doctor`, `apps/public`, `packages/database`

---

## Overview

Allow doctors to send patients a custom form link before a confirmed appointment. The patient fills it out from any device. The doctor receives the submission in the medical records module and attaches it to the patient's expediente as a clinical encounter.

This feature mirrors the existing "Enlace Reseña" pattern but operates **per booking row** (not globally) and stores richer structured data tied to the medical records system.

---

## User Flow

```
1. Doctor confirms a booking (status = CONFIRMED / "Agendada")
2. Doctor clicks "Formulario Pre-Cita" in the ACCIONES column of that booking row
3. Modal opens → doctor selects an isPreAppointment template → clicks "Generar enlace"
4. System creates AppointmentFormLink record, returns URL
5. Doctor copies URL or shares via WhatsApp
6. Patient opens URL → fills fields → submits
7. Appointment row shows green "Enviado" badge
8. Doctor goes to Dashboard → Expedientes Médicos → "Formularios" tab
9. Doctor opens the submission → sees filled form + appointment context
10. Doctor matches to existing patient (or creates new expediente)
11. System creates ClinicalEncounter (type "pre-cita") with submitted data attached
```

---

## Codebase to Read Before Starting

### Database / Schema
- `packages/database/prisma/schema.prisma`
  - `EncounterTemplate` model (lines ~1619–1659) — where `isPreAppointment` gets added
  - `Booking` model (lines ~359–417) — source of `patientName`, `patientEmail`, `isFirstTime`
  - `ClinicalEncounter` model (lines ~1311–1374) — target for attaching submitted forms
  - `ReviewLink` model (lines ~457–470) — structural reference for `AppointmentFormLink`
- `packages/database/prisma/migrations/` — all existing SQL migration files as style reference

### Review Link (mirror pattern)
- `apps/api/src/app/api/reviews/generate-link/route.ts` — token generation pattern
- `apps/api/src/app/api/reviews/route.ts` — GET (token validate) + POST (submit) pattern
- `apps/doctor/src/app/appointments/_components/GenerateReviewLinkModal.tsx` — modal UX pattern
- `apps/public/src/app/review/[token]/page.tsx` — public token page pattern

### Appointments (where the button lives)
- `apps/doctor/src/app/appointments/page.tsx` — main page, how modals are mounted
- `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` — table + `StatusActions` component
- `apps/doctor/src/app/appointments/_hooks/useBookings.ts` — `Booking` type, fetch, state

### Medical Records (where submissions land)
- `apps/doctor/src/app/dashboard/medical-records/page.tsx` — patient list page, header pattern for adding "Formularios" button
- `apps/doctor/src/app/dashboard/medical-records/patients/[id]/page.tsx` — patient profile structure
- `apps/doctor/src/app/dashboard/medical-records/custom-templates/page.tsx` — template list reference

### Custom Templates (label as isPreAppointment)
- `apps/doctor/src/app/dashboard/medical-records/custom-templates/new/page.tsx`
- `apps/doctor/src/app/dashboard/medical-records/custom-templates/[id]/edit/page.tsx`
- `apps/doctor/src/types/custom-encounter.ts` — `FieldDefinition` and `CustomEncounterTemplate` types (critical for public form renderer)

### Auth / Fetch Helpers
- `apps/doctor/src/lib/auth-fetch.ts` — `authFetch` used for all doctor-side API calls
- `apps/api/src/lib/auth.ts` — `requireDoctorAuth`, `getAuthenticatedDoctor` (use in all new API routes)

---

## Database Changes

### 1. Add `isPreAppointment` to `EncounterTemplate`

**schema.prisma** — inside `EncounterTemplate` model, after `isCustom`:
```prisma
isPreAppointment  Boolean  @default(false) @map("is_pre_appointment")
```

**SQL migration** (`packages/database/prisma/migrations/add-pre-appointment-form-links.sql`):
```sql
-- Part 1: Add isPreAppointment to encounter_templates
ALTER TABLE medical_records.encounter_templates
  ADD COLUMN IF NOT EXISTS is_pre_appointment BOOLEAN NOT NULL DEFAULT FALSE;
```

### 2. New `AppointmentFormLink` model

Add to `schema.prisma` (in `public` schema, near `ReviewLink`):

```prisma
enum AppointmentFormStatus {
  PENDING
  SUBMITTED

  @@schema("public")
}

model AppointmentFormLink {
  id             String                @id @default(cuid())
  token          String                @unique
  doctorId       String                @map("doctor_id")
  bookingId      String                @unique @map("booking_id")
  templateId     String                @map("template_id")  // plain String — cross-schema ref
  status         AppointmentFormStatus @default(PENDING)
  submissionData Json?                 @map("submission_data")
  submittedAt    DateTime?             @map("submitted_at")
  patientName    String                @map("patient_name")
  patientEmail   String                @map("patient_email")

  doctor         Doctor               @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  booking        Booking              @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  createdAt      DateTime             @default(now()) @map("created_at")
  updatedAt      DateTime             @updatedAt @map("updated_at")

  @@index([doctorId])
  @@index([doctorId, status])
  @@map("appointment_form_links")
  @@schema("public")
}
```

Also add the back-relation on `Booking`:
```prisma
formLink  AppointmentFormLink?
```

And on `Doctor`:
```prisma
appointmentFormLinks  AppointmentFormLink[]
```

**SQL migration** (continuation of the same file):
```sql
-- Part 2: Create AppointmentFormStatus enum
DO $$ BEGIN
  CREATE TYPE public."AppointmentFormStatus" AS ENUM ('PENDING', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Part 3: Create appointment_form_links table
CREATE TABLE IF NOT EXISTS public.appointment_form_links (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    doctor_id TEXT NOT NULL,
    booking_id TEXT NOT NULL UNIQUE,
    template_id TEXT NOT NULL,
    status public."AppointmentFormStatus" NOT NULL DEFAULT 'PENDING',
    submission_data JSONB,
    submitted_at TIMESTAMP(3),
    patient_name TEXT NOT NULL,
    patient_email TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,

    CONSTRAINT appointment_form_links_doctor_id_fkey
        FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT appointment_form_links_booking_id_fkey
        FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS appointment_form_links_doctor_id_idx
    ON public.appointment_form_links(doctor_id);
CREATE INDEX IF NOT EXISTS appointment_form_links_doctor_id_status_idx
    ON public.appointment_form_links(doctor_id, status);
```

> **CRITICAL**: Run Railway migration BEFORE git push. See `database-architecture.md`.

---

## API Changes (apps/api)

### 1. `POST /api/appointments/bookings/[id]/form-link`

**File:** `apps/api/src/app/api/appointments/bookings/[id]/form-link/route.ts`

**Auth:** Doctor only (`requireDoctorAuth`)
**Purpose:** Create or update a form link for a confirmed booking.

Request body:
```json
{ "templateId": "cuid..." }
```

Logic:
1. Validate doctor owns the booking
2. Verify booking status is `CONFIRMED`
3. Verify `templateId` exists and belongs to the doctor with `isPreAppointment=true`
4. If `AppointmentFormLink` already exists for this booking:
   - If `status=SUBMITTED` → return 409 "El paciente ya envió este formulario"
   - If `status=PENDING` → update `templateId`, regenerate token, return new URL
5. If none exists → create new record with `randomBytes(20).toString('hex')` token
6. Return `{ success: true, data: { token, url } }`

URL format: `${process.env.NEXT_PUBLIC_BASE_URL}/formulario-cita/${token}`

### 2. `GET /api/appointment-form?token=xxx` (public, no auth)

**File:** `apps/api/src/app/api/appointment-form/route.ts`

**Purpose:** Validate token and return data needed to render the public form.

Logic:
1. Look up `AppointmentFormLink` by token, include `booking` (with slot) and `doctor`
2. If not found → 404 "Enlace no válido"
3. If `status=SUBMITTED` → 410 "Este formulario ya fue enviado"
4. Compute expiry: if appointment date < today AND status=PENDING → 410 "Este enlace ha expirado"
5. Fetch `EncounterTemplate` by `templateId` (cross-schema lookup via Prisma)
6. Return:
```json
{
  "doctorName": "...",
  "doctorSpecialty": "...",
  "appointmentDate": "YYYY-MM-DD",
  "appointmentTime": "HH:MM",
  "patientName": "...",
  "template": {
    "name": "...",
    "description": "...",
    "customFields": [ FieldDefinition[] ]  // exclude type="file" fields
  }
}
```

### 3. `POST /api/appointment-form` (public, no auth)

**File:** same `apps/api/src/app/api/appointment-form/route.ts`

**Purpose:** Submit the filled form.

Request body:
```json
{ "token": "...", "data": { "fieldName": "value", ... } }
```

Logic:
1. Look up `AppointmentFormLink` by token
2. Same expiry/already-submitted checks as GET
3. Update record: `status=SUBMITTED`, `submissionData=data`, `submittedAt=now()`
4. Return `{ success: true }`

### 4. Modify `GET /api/appointments/bookings` (existing)

**File:** `apps/api/src/app/api/appointments/bookings/route.ts`

Add `include: { formLink: { select: { id, token, status } } }` to the Prisma query so the doctor app can show form link state per row.

### 5. Modify custom-templates routes (existing)

**Files:**
- `apps/api/src/app/api/custom-templates/route.ts` (POST) — accept `isPreAppointment` in body
- `apps/api/src/app/api/custom-templates/[id]/route.ts` (PUT/PATCH) — accept `isPreAppointment` in body
- Add `?isPreAppointment=true` filter support to the GET list endpoint (used by the modal)

---

## Doctor App Changes (apps/doctor)

### 1. Update `Booking` type — `useBookings.ts`

Add to the `Booking` interface:
```typescript
formLink?: {
  id: string;
  token: string;
  status: 'PENDING' | 'SUBMITTED';
} | null;
```

### 2. Update `BookingsSection.tsx`

The `StatusActions` component handles per-row actions. Add two things:

**A) Form link button** (show when `booking.status === 'CONFIRMED'`):
```tsx
<button
  onClick={() => onOpenFormLinkModal(booking)}
  className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
>
  Formulario
</button>
```

**B) Submitted badge** (show when `booking.formLink?.status === 'SUBMITTED'`):
```tsx
<span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
  <CheckCircle className="w-3 h-3" /> Enviado
</span>
```
This badge should also be a link to `/dashboard/medical-records/formularios/[formLink.id]`.

`BookingsSection` props need `onOpenFormLinkModal: (booking: Booking) => void` added.

### 3. New `PreAppointmentFormModal.tsx`

**File:** `apps/doctor/src/app/appointments/_components/PreAppointmentFormModal.tsx`

Props:
```typescript
interface Props {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
}
```

State:
- `templates: CustomEncounterTemplate[]` (fetched on open, filtered `isPreAppointment=true`)
- `selectedTemplateId: string`
- `loading: boolean`
- `generatedUrl: string | null`
- `existingLink: { status, token } | null` (from `booking.formLink`)

Behavior:
1. On open: fetch `/api/custom-templates?isPreAppointment=true` via `authFetch`
2. If `templates.length === 0`: show empty state with link to `/dashboard/medical-records/custom-templates/new`
3. If `booking.formLink?.status === 'SUBMITTED'`: show read-only state "El paciente ya envió este formulario" + link to view it
4. If `booking.formLink?.status === 'PENDING'`: show "Ya existe un enlace activo" + current URL + option to regenerate with different template
5. Template selector: `<select>` populated with `isPreAppointment` templates
6. "Generar enlace" button → `POST /api/appointments/bookings/[booking.id]/form-link`
7. On success: show URL card + copy button + WhatsApp share button (same as `GenerateReviewLinkModal`)

WhatsApp message format:
```
Hola [patientName], te comparto el formulario pre-cita para tu cita del [date]:
[url]
Por favor complétalo antes de tu consulta. ¡Gracias!
```

### 4. Update `appointments/page.tsx`

Add modal state:
```typescript
const [formLinkModalOpen, setFormLinkModalOpen] = useState(false);
const [formLinkBooking, setFormLinkBooking] = useState<Booking | null>(null);
```

Pass to `BookingsSection`:
```tsx
onOpenFormLinkModal={(booking) => {
  setFormLinkBooking(booking);
  setFormLinkModalOpen(true);
}}
```

Mount modal:
```tsx
<PreAppointmentFormModal
  booking={formLinkBooking}
  isOpen={formLinkModalOpen}
  onClose={() => { setFormLinkModalOpen(false); setFormLinkBooking(null); }}
/>
```

### 5. New `formularios/page.tsx`

**File:** `apps/doctor/src/app/dashboard/medical-records/formularios/page.tsx`

Fetches `GET /api/appointments/form-links` (needs a new endpoint: list submitted form links for the doctor).

Displays a table:
| PACIENTE | FECHA CITA | PLANTILLA | RECIBIDO | ACCIÓN |
|---|---|---|---|---|
| name | date + time | template name | submittedAt | "Ver y adjuntar" → |

"Ver y adjuntar" links to `/dashboard/medical-records/formularios/[id]`.

Empty state: "No hay formularios recibidos todavía."

### 6. New `formularios/[id]/page.tsx`

**File:** `apps/doctor/src/app/dashboard/medical-records/formularios/[id]/page.tsx`

Fetches the `AppointmentFormLink` by id (needs endpoint: `GET /api/appointments/form-links/[id]`), including:
- `booking` (with slot date/time, `isFirstTime`, `patientName`, `patientEmail`, `patientPhone`)
- `template` (with `customFields` for rendering)
- `submissionData`

**Layout (two-column on desktop):**

Left: Filled form view
- Template name + description as header
- Each `FieldDefinition` rendered read-only with the submitted value alongside
- Skip `file` type fields (or show "Campo de archivo — no disponible en formulario digital")

Right: Patient matching panel
- Shows appointment context: date, time, `isFirstTime` label ("Primera visita" / "Paciente recurrente")
- **If `isFirstTime = true` or null:**
  - "Crear nuevo expediente" button
  - On click → creates Patient from booking data + ClinicalEncounter → redirects to new patient profile
- **If `isFirstTime = false`:**
  - Search input for existing patients (calls `/api/medical-records/patients?search=xxx`)
  - Results list with select button
  - On select → "Adjuntar al expediente de [name]" confirm button → creates ClinicalEncounter

**ClinicalEncounter created on attachment:**
```json
{
  "patientId": "...",
  "doctorId": "...",
  "encounterDate": "<appointment date>",
  "encounterType": "pre-cita",
  "chiefComplaint": "Formulario pre-cita completado por el paciente",
  "templateId": "<templateId>",
  "customData": { ...submissionData },
  "status": "completed",
  "location": null,
  "clinicalNotes": null
}
```

Use existing `POST /api/medical-records/patients/[id]/encounters` endpoint.

### 7. Update `medical-records/page.tsx`

Add "Formularios" button to the header, between "Plantillas" and "Nuevo Paciente":
```tsx
<Link
  href="/dashboard/medical-records/formularios"
  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
>
  <ClipboardList className="w-4 h-4" />
  <span className="hidden sm:inline">Formularios</span>
</Link>
```

### 8. Update `custom-encounter.ts` types

Add `isPreAppointment` to `CustomEncounterTemplate`:
```typescript
isPreAppointment: boolean;
```

Add to `UpdateCustomTemplateInput`:
```typescript
isPreAppointment?: boolean;
```

### 9. Update custom-templates UI

In `custom-templates/new/page.tsx` and `[id]/edit/page.tsx`, the `FormBuilder` component's `onSave` callback should pass `isPreAppointment`. The `FormBuilder` itself (at `apps/doctor/src/components/form-builder/FormBuilder.tsx`) may need a toggle added for this flag.

Add a toggle/checkbox in `FormBuilder`:
- Label: "Usar como formulario pre-cita"
- Help text: "Permite enviar este formulario a pacientes antes de su cita"

---

## Public App Changes (apps/public)

### New `/formulario-cita/[token]/page.tsx`

**File:** `apps/public/src/app/formulario-cita/[token]/page.tsx`

Follow the exact same structure as `/review/[token]/page.tsx`.

**States:**
1. **Loading** — spinner
2. **Invalid** — "Este enlace no es válido"
3. **Already submitted** — "Ya enviaste este formulario. ¡Gracias!"
4. **Expired** — "Este enlace ha expirado. La cita ya pasó."
5. **Form** — active form ready to fill
6. **Success** — "¡Formulario enviado! Tu médico lo revisará antes de tu cita."

**Form rendering logic** (from `customFields: FieldDefinition[]`):

```
text       → <input type="text">
textarea   → <textarea>
number     → <input type="number"> (with min/max/step)
date       → <input type="date">
time       → <input type="time">
dropdown   → <select> with options
radio      → radio button group
checkbox   → <input type="checkbox">
file       → skip (show nothing or a note)
```

Each field renders: `label` as label, `helpText` below if present, `required` indicator, validation on submit.

**Context card at top** (before form fields):
```
Dr. [doctorName] — [specialty]
Cita: [date formatted in Spanish] a las [time]
Paciente: [patientName]
```

**API calls** (use `NEXT_PUBLIC_API_URL` env var — same pattern as review page):
- `GET ${NEXT_PUBLIC_API_URL}/api/appointment-form?token=${token}`
- `POST ${NEXT_PUBLIC_API_URL}/api/appointment-form`

---

## Also Needed: Two More API Endpoints

### `GET /api/appointments/form-links`

For the `formularios/page.tsx` list. Returns all `AppointmentFormLink` records for the authenticated doctor with `status=SUBMITTED`, ordered by `submittedAt` desc. Include booking slot date/time and template name (fetched separately since templateId is a plain string).

### `GET /api/appointments/form-links/[id]`

For the `formularios/[id]/page.tsx` detail view. Returns a single `AppointmentFormLink` with booking (including slot) and fetches the template separately.

---

## Complete File Change Summary

### New files (9)
| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/add-pre-appointment-form-links.sql` | DB migration |
| `apps/api/src/app/api/appointments/bookings/[id]/form-link/route.ts` | Generate / update link |
| `apps/api/src/app/api/appointment-form/route.ts` | Public validate + submit |
| `apps/api/src/app/api/appointments/form-links/route.ts` | List submitted forms (doctor) |
| `apps/api/src/app/api/appointments/form-links/[id]/route.ts` | Single form detail (doctor) |
| `apps/doctor/src/app/appointments/_components/PreAppointmentFormModal.tsx` | Modal to generate link |
| `apps/doctor/src/app/dashboard/medical-records/formularios/page.tsx` | Submitted forms list |
| `apps/doctor/src/app/dashboard/medical-records/formularios/[id]/page.tsx` | Form detail + attach |
| `apps/public/src/app/formulario-cita/[token]/page.tsx` | Patient-facing form |

### Modified files (8)
| File | What changes |
|---|---|
| `packages/database/prisma/schema.prisma` | +`isPreAppointment` on EncounterTemplate, +`AppointmentFormLink` model + enum |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Include `formLink` in GET response |
| `apps/api/src/app/api/custom-templates/route.ts` | Accept `isPreAppointment` in POST |
| `apps/api/src/app/api/custom-templates/[id]/route.ts` | Accept `isPreAppointment` in PUT, add GET filter |
| `apps/doctor/src/app/appointments/_hooks/useBookings.ts` | Add `formLink` to `Booking` type |
| `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` | Add form button + submitted badge + prop |
| `apps/doctor/src/app/appointments/page.tsx` | Mount `PreAppointmentFormModal` |
| `apps/doctor/src/app/dashboard/medical-records/page.tsx` | Add "Formularios" header button |
| `apps/doctor/src/types/custom-encounter.ts` | Add `isPreAppointment` to types |
| `apps/doctor/src/components/form-builder/FormBuilder.tsx` | Add isPreAppointment toggle |

---

## Implementation Order (recommended)

1. **DB first** — SQL migration + schema.prisma + `pnpm db:generate`
2. **API: form-link generation** — `POST /api/appointments/bookings/[id]/form-link`
3. **API: custom-templates** — add `isPreAppointment` filter/field support
4. **API: public endpoints** — `GET/POST /api/appointment-form`
5. **API: list + detail endpoints** — `GET /api/appointments/form-links` + `[id]`
6. **API: modify bookings GET** — include `formLink` in response
7. **Public app: patient form page** — `/formulario-cita/[token]`
8. **Doctor app: modal + booking row** — `PreAppointmentFormModal`, `BookingsSection`, `appointments/page.tsx`
9. **Doctor app: formularios section** — list page + detail/attach page
10. **Doctor app: custom templates toggle** — `FormBuilder` + types
11. **Railway migration** — run SQL against Railway BEFORE deploying

---

## Known Limitations

- **File upload fields** (`type="file"` in `FieldDefinition`) are not rendered on the patient-facing public form. The public form skips them. Doctors should avoid adding file fields to `isPreAppointment` templates.
- **One link per booking** — if the doctor wants to change the template after generating, regeneration resets status to PENDING and replaces the token. If the patient already has the old URL, it will be invalid.
- **No real-time notification** — the appointment row updates after a page refresh or the next time bookings are fetched. No WebSocket/push notification.
- **No email/SMS sending** — the system generates the link but does not send it automatically. The doctor copies it and sends it manually via WhatsApp or any channel.

---

## Key Decisions Made

| Decision | Rationale |
|---|---|
| `templateId` stored as plain String (no FK relation) | Avoids cross-schema Prisma FK complexity; template is looked up at query time |
| `@unique` on `bookingId` | One link per booking keeps data clean; regeneration updates the existing record |
| Expiry computed, not stored | Appointment date is already on the Booking; no extra column needed |
| `encounterType = "pre-cita"` | Plain string field (not enum) — no ALTER TYPE migration needed |
| `AppointmentFormLink` in `public` schema | Booking lives in `public`; keeps the primary relation in the same schema |
| Submitted forms accessible from medical-records header | Follows existing "Plantillas" button pattern; no sidebar restructure needed |
