# Slot Location NULL — Investigation, Root Cause & Fix

**Date:** 2026-04-14
**Status:** Partially fixed. SQL backfill applied for both affected doctors. Underlying admin app bug still open.
**Affected doctors:** Dra. Adriana Michelle (`dra-adriana-michelle`), Dr. José Cruz Ruiz (`dr-jose`)

---

## The Symptom

Patients booking appointments on the public app (`tusalud.pro`) could not see the clinic name or address on any time slot. The `📍` location line was completely absent from the slot picker, the pre-form summary, and the confirmation screen — even though both doctors had clinic location records in the database.

Test/fake doctors created later (e.g. `dr-prueba`, `dr-quebradita`, `gerardo`) showed clinic info correctly.

---

## How Clinic Info Gets to the Booking Widget

The public booking flow does **not** have a standalone clinic selector. Clinic info is embedded in each `AppointmentSlot` record via a `locationId` foreign key:

```
AppointmentSlot.locationId → ClinicLocation.id → { name, address }
```

The availability API (`GET /api/doctors/[slug]/availability`) joins `location: { name, address }` on every slot and returns `location: null` if `locationId` is NULL.

`BookingWidget.tsx` only renders the `📍` line when `slot.location` is truthy:

```tsx
{selectedSlot.location && (
  <p>📍 {selectedSlot.location.name} — {selectedSlot.location.address}</p>
)}
```

So a slot with `location_id = NULL` in the DB → `location: null` from the API → no clinic shown to the patient. This is by design, but it means every slot must have a valid `locationId` for the feature to work.

---

## Investigation: What We Found in Railway

Querying the live Railway database revealed:

| Doctor | Total Slots | With Location | Missing |
|---|---|---|---|
| Dra. Adriana Michelle | 613 | 0 | **613** |
| Dr. José Cruz Ruiz | 487 | 0 | **487** |
| dr-prueba (test) | 179 | 179 | 0 |
| dr-quebradita (test) | 167 | 167 | 0 |
| gerardo (test) | 100 | 100 | 0 |

All slots for the two real doctors had `location_id = NULL`. All test doctors had 100% coverage.

### Clinic locations existed in the DB

Both doctors had valid `clinic_locations` records:

- **Dra. Adriana**: 2 clinics — Hospital Ángeles Valle Oriente + CHRISTUS MUGUERZA Hospital Cumbres
- **Dr. José**: 1 clinic — Consultorio Principal (Av. Lopez Mateos Norte 769)

The IDs, `doctor_id` references, and `is_default`/`display_order` fields were all correct. The API fallback query (`clinicLocation.findFirst`) was confirmed to return the correct clinic ID when tested in isolation.

### The API has a fallback — but it wasn't helping

The slot creation endpoint (`POST /api/appointments/slots`, added `2026-03-14` in commit `e8bdee4a`) includes a fallback:

```typescript
let resolvedLocationId: string | null = locationId || null;
if (!resolvedLocationId) {
  const defaultLoc = await prisma.clinicLocation.findFirst({
    where: { doctorId },
    orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }],
    select: { id: true },
  });
  resolvedLocationId = defaultLoc?.id ?? null;
}
```

This should auto-assign a location even if the frontend sends none. But it only works if the `clinic_locations` record **exists at the time the slot is created**.

---

## Root Cause: A Timing Chain of Events

### Step 1 — The silent clinic deletion bug

`PUT /api/doctors/[slug]` handles full doctor profile saves including clinic locations. Its upsert logic compares existing clinic IDs in the DB against the incoming payload. Any clinic ID **not present in the payload is hard-deleted**:

```typescript
const toDelete = [...existingIdSet].filter(id => !incomingIdSet.has(id));
if (toDelete.length > 0) {
  await tx.clinicLocation.deleteMany({ where: { id: { in: toDelete } } });
}
```

This can be triggered silently by:
- Doctor saves profile from a page that only loaded 1 clinic
- Admin saves without the second clinic in the payload
- Frontend bug strips the `id` field from an existing clinic record
- A clinic is added without an `id` while an existing one still has one (old one gets deleted, new one created with new ID)

When a `ClinicLocation` is deleted, its `AppointmentSlot` records respond according to the FK `onDelete` behavior. Based on observed behavior, deleting a clinic set `location_id = NULL` on all its slots (or deleted them — the exact behavior was confirmed by the fact that slots still existed but had NULL location).

### Step 2 — Slots recreated without clinic records existing

After the clinic locations were deleted, the doctors went into the doctor app and recreated their appointment slots. At that moment:

- `GET /api/doctors/${slug}/locations` returned an empty array (no clinic records in DB)
- The frontend `CreateSlotsModal` had `clinicLocations = []`, so `locationId` state stayed `""`
- The API received no `locationId` in the POST body
- The fallback `clinicLocation.findFirst` also returned `null` (no records to find)
- Slots were created with `location_id = NULL`

### Step 3 — Clinic locations recreated with new IDs — but slots already existed

The clinic locations were recreated on **2026-04-10** (confirmed via `created_at` in Railway):

| Clinic | Created At |
|---|---|
| Hospital Ángeles Valle Oriente | 2026-04-10T00:37:14Z |
| CHRISTUS MUGUERZA Hospital Cumbres | 2026-04-14T15:30:41Z |
| Dr. José — Consultorio Principal | 2026-04-10T00:41:09Z |

But Adriana's slots were all created on **2026-03-22** and José's newest slots on **2026-04-07** — both before the clinic records existed. The new clinic records got new IDs and had no connection to the existing slots.

### Why test doctors worked

Test doctors (`dr-prueba`, `dr-quebradita`, `gerardo`) had their slots created **after** their clinic locations existed in the DB. Their `CreateSlotsModal` loaded `clinicLocations` correctly, `locationId` was set, and the API saved it.

---

## The Fixes Applied

### Fix 1 — SQL backfill for Dr. José (2026-04-14)

Dr. José has exactly one clinic, so all his slots were assigned to it unconditionally:

```sql
UPDATE public.appointment_slots
SET location_id = 'cmns6k1bc000ylk0lzhr9xbbs'
WHERE doctor_id = 'cmjad41j600blmg0m1ziudezw'
  AND location_id IS NULL;
-- 487 rows updated
```

### Fix 2 — SQL backfill for Dra. Adriana (2026-04-14)

Adriana has 2 clinics with non-overlapping schedules on most days. Slots were assigned based on day-of-week and time-of-day:

| Day | Time | Clinic |
|---|---|---|
| Monday | any | CHRISTUS MUGUERZA Cumbres |
| Tuesday | any | Hospital Ángeles Valle Oriente |
| Wednesday | before 15:00 | CHRISTUS MUGUERZA Cumbres |
| Wednesday | 15:00+ | Hospital Ángeles Valle Oriente |
| Thursday | any | Hospital Ángeles Valle Oriente |
| Friday | before 15:00 | CHRISTUS MUGUERZA Cumbres |
| Friday | 15:00+ | Hospital Ángeles Valle Oriente |
| Saturday | any | Hospital Ángeles Valle Oriente |

```sql
UPDATE public.appointment_slots
SET location_id = CASE
  WHEN EXTRACT(DOW FROM "date") = 1 THEN 'cmnys3e13001vs30lsl3hdkdg'
  WHEN EXTRACT(DOW FROM "date") = 2 THEN 'cmns6f00a0001lk0luk5unzq1'
  WHEN EXTRACT(DOW FROM "date") = 3 AND start_time < '15:00' THEN 'cmnys3e13001vs30lsl3hdkdg'
  WHEN EXTRACT(DOW FROM "date") = 3 AND start_time >= '15:00' THEN 'cmns6f00a0001lk0luk5unzq1'
  WHEN EXTRACT(DOW FROM "date") = 4 THEN 'cmns6f00a0001lk0luk5unzq1'
  WHEN EXTRACT(DOW FROM "date") = 5 AND start_time < '15:00' THEN 'cmnys3e13001vs30lsl3hdkdg'
  WHEN EXTRACT(DOW FROM "date") = 5 AND start_time >= '15:00' THEN 'cmns6f00a0001lk0luk5unzq1'
  WHEN EXTRACT(DOW FROM "date") = 6 THEN 'cmns6f00a0001lk0luk5unzq1'
  ELSE 'cmns6f00a0001lk0luk5unzq1'
END
WHERE doctor_id = 'cmmpgk283000ft50lz8id2vtz'
  AND location_id IS NULL;
-- 613 rows updated
```

**Result after backfill:**
- Hospital Ángeles Valle Oriente: 402 slots
- CHRISTUS MUGUERZA Hospital Cumbres: 211 slots

Both fixes are **live immediately** — no code change, no deploy required.

### Fix 3 — Guard against slot-less clinic deletion (commit `a9c5f54a`, 2026-04-13)

A pre-check was added to `PUT /api/doctors/[slug]` that counts slots assigned to any clinic being removed and returns a `400` before the transaction starts:

```typescript
const slotsCount = await prisma.appointmentSlot.count({
  where: { locationId: { in: toDelete } },
});
if (slotsCount > 0) {
  return NextResponse.json({ success: false, error: `No se puede eliminar...` }, { status: 400 });
}
```

`window.confirm` dialogs were also added in both the admin app and doctor app before removing a second clinic from local state.

---

## Known Remaining Risks

### Risk 1 — Guard only works when slots have `location_id` set

The guard introduced in Fix 3 checks `locationId: { in: toDelete }`. If slots have `location_id = NULL` (as they did before the backfill), the count returns 0 and the guard doesn't fire. The clinic can still be silently deleted. **Now that we've backfilled all slots, the guard is effective for the affected doctors.**

However, any new slots created with `location_id = NULL` in the future would make those clinics deletable again.

### Risk 2 — Admin app hours initialization bug

During investigation, the admin app profile edit form (Step 7 — Información de Clínica) was found to display different data than what's in the DB:

| Field | DB value | Admin app shows |
|---|---|---|
| Hospital Ángeles — Monday | `""` (closed) | `"9:00 AM - 6:00 PM"` ❌ |
| CHRISTUS Cumbres — Tuesday | `""` (closed) | `"9:00 AM - 6:00 PM"` ❌ |

The admin form appears to pre-fill empty hour slots with a default value instead of leaving them blank. If anyone saves the profile from the admin app without manually clearing those fields, the wrong hours get written to the DB and display incorrectly on the public profile.

**Status: NOT fixed.** Needs investigation in `apps/admin/src/app/doctors/[slug]/edit/page.tsx`.

### Risk 3 — Admin app and doctor app profile edit mismatches

Both apps can edit the same doctor profile via `PUT /api/doctors/[slug]`. If they serialize the `clinic_locations` payload differently (different fields, different handling of missing IDs, different initialization), one app could silently undo data saved by the other. The hours discrepancy found in Risk 2 strongly suggests the two apps handle clinic data differently.

**Status: NOT investigated.**

---

## If This Happens Again

If a doctor reports that clinic address is missing from booking slots:

1. **Query Railway** to check `location_id` on their slots:
   ```sql
   SELECT COUNT(*)::int as total, COUNT(location_id)::int as with_location
   FROM public.appointment_slots s
   JOIN public.doctors d ON d.id = s.doctor_id
   WHERE d.slug = 'doctor-slug-here';
   ```

2. **Check clinic_locations** exist and have the right `doctor_id`:
   ```sql
   SELECT id, name, is_default, display_order, created_at
   FROM public.clinic_locations
   WHERE doctor_id = (SELECT id FROM public.doctors WHERE slug = 'doctor-slug-here');
   ```

3. **Backfill** if `with_location = 0` and clinics exist:
   - Single clinic → simple `UPDATE ... SET location_id = '<id>' WHERE location_id IS NULL`
   - Multiple clinics → split by day/time based on their schedule

4. **No deploy needed** — DB change is live immediately.

---

## Clinic IDs for Reference

| Doctor | Clinic | `location_id` |
|---|---|---|
| Dra. Adriana Michelle | Hospital Ángeles Valle Oriente | `cmns6f00a0001lk0luk5unzq1` |
| Dra. Adriana Michelle | CHRISTUS MUGUERZA Hospital Cumbres | `cmnys3e13001vs30lsl3hdkdg` |
| Dr. José Cruz Ruiz | Consultorio Principal | `cmns6k1bc000ylk0lzhr9xbbs` |
