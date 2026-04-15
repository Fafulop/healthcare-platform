# Clinic Location Loss — Investigation & Fix

**Date:** 2026-04-13
**Status:** Fully implemented. Defence-in-depth across API and both frontends.

---

## The Incident

A doctor with 2 clinic locations (`ClinicLocation` records) reported that one of them
"disappeared" — it stopped appearing in the public profile sidebar and in the appointment
booking modal. The doctor re-added the second clinic manually and it returned to the sidebar,
but the booking modal still didn't show it.

---

## How the Booking Modal Shows Clinics

**Key insight:** the booking widget (`BookingWidget.tsx`) has **no standalone clinic selector**.
Clinics are surfaced exclusively through `AppointmentSlot` records. Each slot has a `locationId`
foreign key. When a patient picks a time slot, the slot's embedded `location: { name, address }`
is shown as a `📍` line in the form step.

```
Sidebar  ← reads clinicLocations[] from doctor profile  (always shows all clinics)
Booking  ← reads slots from /api/doctors/[slug]/availability  (only shows clinics that have slots)
```

This means a clinic can appear in the sidebar but be invisible in the booking flow if none of
its slots exist or have a valid `locationId`.

---

## Why a Clinic Can Appear "Deleted"

### The silent delete in the PUT endpoint

`PUT /api/doctors/[slug]` handles the full doctor profile save including clinic locations.
The upsert logic in `apps/api/src/app/api/doctors/[slug]/route.ts` compares:

- **existing IDs** in the database
- **incoming IDs** from the request payload

Any existing clinic ID that is **not present in the incoming payload** is hard-deleted:

```typescript
const toDelete = [...existingIdSet].filter((id) => !incomingIdSet.has(id));
if (toDelete.length > 0) {
  await tx.clinicLocation.deleteMany({ where: { id: { in: toDelete } } });
}
```

The `ClinicLocation` model uses `onDelete: Cascade` on its `AppointmentSlot` relation, so
**deleting a clinic also hard-deletes every slot assigned to it**.

### Trigger scenarios

Any of the following can cause the second clinic to silently disappear:

| Scenario | Why it happens |
|---|---|
| Doctor saves profile from a page that only loaded 1 clinic | Frontend sends array with 1 entry → second clinic deleted |
| Admin saves doctor profile without the second clinic in the payload | Same mechanism |
| Frontend bug strips the `id` field from an existing clinic | No `id` → not in `incomingIdSet` → treated as deleted |
| New clinic added without `id` while old one still exists | Old one deleted, new one created with new ID |

### The fallback scenario (no slots lost but clinic invisible in booking)

A second scenario — no deletion at all — can make a clinic invisible in booking:

Slots were created before the second clinic existed, or with `locationId = null`.
The availability API returns those slots with `location: null`, so no clinic name is shown.
This is **not** a deletion but gives the same symptom from the patient's perspective.

---

## Evidence: Two Doctors Compared

During investigation two real doctors were examined:

**Doctor A — location shows correctly:**
- Slots in DB have `locationId` pointing to a valid `ClinicLocation`
- Availability API returns `location: { name: "Consultorio Polanco", address: "..." }`
- Patient sees `📍 Consultorio Polanco — Av. Presidente Masaryk 123...` in the form

**Doctor B — location missing:**
- Slots in DB have `locationId = null`
- Availability API returns `location: null`
- Patient sees no location line at all, even though `ClinicLocation` record exists in DB
- Cause: slots were created before the clinic location record existed (or before the API
  defaulting logic was in place)

---

## The Fix (Implemented)

Three layers of protection were added.

### Layer 1 — `window.confirm` in both frontends (early warning)

Added to `removeSecondLocation()` in:
- `apps/doctor/src/components/profile/ClinicSection.tsx`
- `apps/admin/src/app/doctors/[slug]/edit/page.tsx`

```typescript
const removeSecondLocation = () => {
  if (!window.confirm(
    '¿Eliminar el segundo consultorio?\n\nSi tiene horarios asignados en la sección de Citas, el sistema no permitirá guardar. Primero deberás eliminar esos horarios.'
  )) return;
  // ... remove from local state
};
```

Fires before the form is even saved. Zero-cost early exit for accidental clicks.

### Layer 2 — API pre-check returning a clean 400 (hard block)

Added **before** the Prisma transaction in `apps/api/src/app/api/doctors/[slug]/route.ts`:

```typescript
// Guard: pre-check clinic location deletion before starting the transaction
// so we can return a clean 400 instead of a cryptic 500.
if (locationsToSave && locationsToSave.length > 0) {
  const existingLocs = await prisma.clinicLocation.findMany({
    where: { doctorId: existingDoctor.id },
    select: { id: true },
  });
  const existingIdSet = new Set(existingLocs.map((l) => l.id));
  const incomingIdSet = new Set(
    locationsToSave.filter((l: any) => l.id).map((l: any) => l.id as string)
  );
  const toDelete = [...existingIdSet].filter((id) => !incomingIdSet.has(id));
  if (toDelete.length > 0) {
    const slotsCount = await prisma.appointmentSlot.count({
      where: { locationId: { in: toDelete } },
    });
    if (slotsCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar un consultorio que tiene ${slotsCount} horario${slotsCount === 1 ? '' : 's'} asignado${slotsCount === 1 ? '' : 's'}. Primero elimina o reasigna los horarios desde la sección de Citas.`,
        },
        { status: 400 }
      );
    }
  }
}
```

Why before the transaction and not inside it: throwing inside the transaction caused the outer
catch to return `error: "Failed to update doctor"` (generic) with the real message buried in
`message`. Both frontends read `result.error` first, so the specific message was never shown.
Moving the check before the transaction allows a proper `400` response with the message
directly in `error`, which both the admin `alert()` and doctor app `setSaveMessage` pick up
correctly.

### Layer 3 — Transaction still proceeds safely

The `clinicLocation.deleteMany` inside the transaction now runs only after the pre-check
has confirmed no slots exist, so it is safe. The comment was updated accordingly.

**What the fix does NOT block:**
- Removing a clinic that has zero slots (correct, intended)
- Editing a clinic's name, address, phone, hours, coordinates
- Direct DB access (see Known Remaining Risk below)

---

## Workaround if Incident Recurs

If a doctor reports their clinic disappeared again:

**1. Check if the ClinicLocation record still exists:**
```sql
SELECT id, name, address, display_order, is_default
FROM public.clinic_locations
WHERE doctor_id = '<doctor_id>'
ORDER BY display_order;
```

**2. Check if slots lost their locationId:**
```sql
SELECT COUNT(*), location_id
FROM public.appointment_slots
WHERE doctor_id = '<doctor_id>'
GROUP BY location_id;
```

**3a. If the ClinicLocation record is gone (hard deleted):**
- The slots for that clinic were cascade-deleted too
- Re-create the `ClinicLocation` record via the profile editor
- Re-create the appointment slots in the doctor appointments page, selecting the new clinic

**3b. If the ClinicLocation record exists but slots have `location_id = null`:**
- No data was lost, slots just aren't linked
- Fix with a targeted SQL update:
```sql
UPDATE public.appointment_slots
SET location_id = '<clinic_location_id>'
WHERE doctor_id = '<doctor_id>'
  AND location_id IS NULL;
```

---

## Edge Case: Slots Created Before Clinic Was Configured

**Scenario:** A new doctor (or admin) creates appointment slots before filling in the clinic
profile. At slot-creation time, no `ClinicLocation` record exists yet for that doctor. The
slots API tries to default to `clinicLocations[0]` but finds nothing, so
`resolvedLocationId = null`. The slots are saved with `location_id = NULL`.

Later the doctor fills in their clinic info. The clinic record is created. But the old slots
still have `location_id = NULL` — they are not retroactively linked. In the booking modal,
those slots show no `📍` clinic name even though a valid `ClinicLocation` now exists.

**This also applies when adding a second clinic to an existing doctor:**
- Existing slots correctly point to clinic A's ID (unchanged, since the upsert preserves IDs)
- Those slots will show clinic A's name in the booking modal ✓
- New slots created after adding clinic B will default to clinic A unless the doctor
  explicitly selects clinic B in the `CreateSlotsModal` picker
- Clinic B will be invisible to patients until the doctor creates slots for it

**Fix for slots with `location_id = NULL`:**
```sql
-- Links all null-location slots to the doctor's first clinic (by display_order)
UPDATE public.appointment_slots
SET location_id = (
  SELECT id FROM public.clinic_locations
  WHERE doctor_id = appointment_slots.doctor_id
  ORDER BY display_order ASC
  LIMIT 1
)
WHERE doctor_id = '<doctor_id>'
  AND location_id IS NULL;
```

**Prevention:** Clinic info should be filled in before creating slots. When onboarding a new
doctor, always complete the profile (including clinic address) before generating their
appointment schedule.

---

## Known Remaining Risk

The guard blocks accidental deletion but **not intentional deletion via direct DB access or
future API endpoints** that bypass this check. If a separate `DELETE /api/doctors/:slug/locations/:id`
endpoint is ever added, it must include the same slot-count guard.

Longer-term options considered but not yet implemented:

- **Soft delete** — add `deleted_at` column to `clinic_locations`, filter in queries. Preserves
  full history and makes recovery trivial.
- **Decouple deletion from profile save** — require an explicit separate DELETE request for
  clinic removal so it can never happen as a side effect of a profile save.
- **Audit log** — a `clinic_location_audit` table recording every create/update/delete with
  timestamp, actor, and a JSON snapshot for forensics.

---

## Relevant Files

| File | Role |
|---|---|
| `apps/api/src/app/api/doctors/[slug]/route.ts` | PUT endpoint — pre-check guard before transaction |
| `apps/doctor/src/components/profile/ClinicSection.tsx` | Doctor app remove button — `window.confirm` added |
| `apps/admin/src/app/doctors/[slug]/edit/page.tsx` | Admin app remove button — `window.confirm` added |
| `apps/public/src/components/doctor/BookingWidget.tsx` | Booking calendar and form — renders `📍` from slot.location |
| `apps/public/src/components/doctor/SidebarContactInfo.tsx` | Sidebar — reads clinicLocations[] directly from profile |
| `apps/api/src/app/api/doctors/[slug]/availability/route.ts` | Returns slots with embedded location; filters isOpen+isPublic |
| `apps/doctor/src/app/appointments/_components/CreateSlotsModal.tsx` | Slot creation UI — defaults to clinicLocations[0] |
| `packages/database/prisma/schema.prisma` | ClinicLocation model — locationId is nullable, onDelete: Cascade |
