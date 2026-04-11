# Extended Post-Appointment Block

**Date:** 2026-04-10
**Scope:** `apps/doctor`, `apps/api`, `apps/public`, `packages/database`
**Related:** `APPOINTMENTS-FULL-UI-MAP.md`, `database-architecture.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [How It Works — User Flow](#2-how-it-works--user-flow)
3. [Data Model](#3-data-model)
4. [Database Migration](#4-database-migration)
5. [API Changes](#5-api-changes)
6. [Doctor App UI](#6-doctor-app-ui)
7. [Blocking Logic — Deep Dive](#7-blocking-logic--deep-dive)
8. [Affected Surfaces](#8-affected-surfaces)
9. [Edge Cases & Design Decisions](#9-edge-cases--design-decisions)
10. [Extended Block Over an Existing Appointment](#10-extended-block-over-an-existing-appointment)
11. [Nuevo Horario (Instant Bookings) & Extended Block](#11-nuevo-horario-instant-bookings--extended-block)
12. [Confirming a Blocked Pending Appointment](#12-confirming-a-blocked-pending-appointment)
13. [File Reference](#13-file-reference)

---

## 1. Problem Statement

Before this feature, the booking system only blocked the exact slot a patient reserved. If a doctor had 30-minute or 60-minute slots and a patient booked the 10:00 slot for a procedure that actually takes 3 hours, the 10:30, 11:00, 11:30, 12:00, and 12:30 slots remained open on the public portal — other patients could book into a time when the doctor would still be busy.

**Example of the problem:**

```
Slots: 10:00 · 10:30 · 11:00 · 11:30 · 12:00 · 12:30 · 13:00
Patient books 10:00 (30 min slot)
System blocks: [10:00] ← only this one
Still open:          10:30 · 11:00 · 11:30 · 12:00 · 12:30 · 13:00 ← wrong!
```

**After this feature:**

```
Doctor sets extendedBlockMinutes = 180 (3 hours from 10:00)
System blocks: [10:00] [10:30] [11:00] [11:30] [12:00] [12:30]
Still open:                                                    13:00 ✓
```

---

## 2. How It Works — User Flow

### Setting a block

1. Doctor opens the **Appointments** page (`/appointments`)
2. In the **Todas las Citas** section, finds a booking in **Agendada (CONFIRMED)** status
3. Under the action buttons for that booking, a new **Bloqueo** control appears:
   ```
   ⏰ Bloqueo: 10:00–10:30  [Editar]
   ```
   - The range shown is `startTime → blockEndTime`
   - Default (no custom block set): `blockEndTime = startTime + slot duration`
4. Doctor clicks **Editar** → an inline time input appears
5. Doctor sets the desired end time (e.g., `13:00`) and clicks **OK**
6. The `extendedBlockMinutes` value is saved: `(13:00 - 10:00) = 180 minutes`
7. The control updates immediately to show `10:00–13:00` in indigo (indicating a custom block)

### What the block does

Once saved, ALL slots whose `startTime` falls within `[appointmentStart, blockEndTime)` are hidden from:
- The **public booking portal** (portal de pacientes)
- The doctor's own **Horarios disponibles** tab inside **Agendar Cita**

### Removing a custom block

Set the block end time back to the natural slot end time (e.g., `10:30` for a 30-min slot). This clears the custom override and returns to default behavior.

---

## 3. Data Model

### Field added to `Booking`

```prisma
model Booking {
  // ... existing fields ...

  // Extended block: how many minutes AFTER the appointment starts to block subsequent slots.
  // null = default (block only the slot's own duration). Set by doctor on CONFIRMED bookings.
  extendedBlockMinutes Int? @map("extended_block_minutes")
}
```

| Value | Meaning |
|---|---|
| `null` | Default — block window = slot duration (e.g., 30 or 60 min) |
| `180` | Block all slots starting within 180 minutes of appointment start |
| `60` on a 60-min slot | Same as default, no extra blocking |

The field lives on `Booking`, not on `AppointmentSlot`, because the extension is per-appointment, not per-slot. A slot could theoretically be reused across days; the block is tied to the specific patient visit.

---

## 4. Database Migration

**File:** `packages/database/prisma/migrations/add-extended-block-minutes.sql`

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extended_block_minutes INTEGER;
```

Run locally:
```powershell
cd packages/database
npx prisma db execute --file prisma/migrations/add-extended-block-minutes.sql --schema prisma/schema.prisma
```

Run on Railway (before deploying):
```powershell
npx prisma db execute --file prisma/migrations/add-extended-block-minutes.sql --url "RAILWAY_URL"
```

Regenerate Prisma client after migration:
```powershell
pnpm db:generate
```

---

## 5. API Changes

### A. `PATCH /api/appointments/bookings/[id]` — set extended block

The existing PATCH endpoint (previously status-only) now also handles `extendedBlockMinutes` updates when `status` is not provided.

**Request body:**
```json
{ "extendedBlockMinutes": 180 }
```

**To clear (reset to default):**
```json
{ "extendedBlockMinutes": null }
```

**Auth rules:**
- Requires DOCTOR or ADMIN token
- DOCTOR can only update their own bookings
- Only works on CONFIRMED or PENDING bookings (not terminal states)

**Validation:**
- `extendedBlockMinutes === 0` → rejected (400)
- Negative values → rejected (400)
- `null` → accepted (clears to default)

**Response:**
```json
{ "success": true, "data": { ...updatedBooking } }
```

---

### B. `GET /api/appointments/slots` — `isBlockedByBooking` field

Used by the doctor's **Horarios disponibles** tab. Now returns an additional field on every slot:

```json
{
  "id": "...",
  "startTime": "11:00",
  "endTime": "11:30",
  "isOpen": true,
  "currentBookings": 0,
  "isBlockedByBooking": true   ← NEW
}
```

**How it's computed:**
1. After fetching slots, the API also fetches all CONFIRMED bookings for the same doctor/date range
2. For each booking, computes a block window: `[startTime, startTime + (extendedBlockMinutes ?? slotDuration))`
3. Any slot whose `startTime` falls within a block window gets `isBlockedByBooking: true`

**Default behavior:** If `extendedBlockMinutes` is null, the block window defaults to the booking's own slot duration (e.g., a 60-min appointment blocks the 60-minute window starting at its start time).

---

### C. `GET /api/doctors/[slug]/availability` — filters blocked slots

Used by the **public portal**. Blocked slots are filtered out entirely and never appear in `slotsByDate` or `availableDates`.

**How it's computed:** Same block window logic as above. Blocked slots are excluded from the response before grouping by date.

**Effect on public portal:**
- `availableDates` will not include dates where ALL slots are blocked
- `slotsByDate[date]` will be missing blocked time slots
- Patients simply never see the blocked time — no error, no indication

---

## 6. Doctor App UI

### ExtendedBlockControl component

Located inside `BookingsSection.tsx` → `StatusActions` → `ExtendedBlockControl`.

Rendered **only for CONFIRMED bookings** that have a valid start time.

**States:**

| State | Appearance |
|---|---|
| Default (no custom block) | `⏰ Bloqueo: 10:00–10:30 [Editar]` in gray |
| Custom block set | `⏰ Bloqueo: 10:00–13:00 [Editar]` in **indigo** |
| Editing | `⏰ Bloquear hasta: [time input] [OK] [✕]` |
| Saving | `OK` button shows `...` |

**Visual distinction:** When `extendedBlockMinutes` differs from the default slot duration, the range text turns indigo to signal a custom block is active.

**Inline time input:** Uses `<input type="time">` pre-populated with the current block end time. Doctor sets the desired end of the block period, not the number of minutes directly.

**Data flow:**
```
ExtendedBlockControl.handleSave()
  → computes extendedBlockMinutes = endTimeMinutes - startTimeMinutes
  → calls onUpdate(bookingId, extendedBlockMinutes)
  → useBookings.updateExtendedBlock()
  → PATCH /api/appointments/bookings/[id]
  → optimistic local state update (no full refetch needed)
```

### Horarios disponibles filtering

In `BookPatientModal`, the slot list used for the **Horarios disponibles** tab filters out:
```typescript
slots.filter(s =>
  s.isOpen &&
  s.currentBookings < s.maxBookings &&
  !s.isBlockedByBooking &&   // ← NEW
  s.date.split("T")[0] >= today
)
```

Blocked slots simply don't appear in the calendar or slot list. The doctor sees only genuinely available windows.

---

## 7. Blocking Logic — Deep Dive

### Block window definition

For a CONFIRMED booking:
```
blockStart = booking's startTime (e.g., "10:00")
blockEnd   = startTime + (extendedBlockMinutes ?? slotDuration)

A slot is blocked if:
  slot.date === booking.date  AND
  slot.startTime >= blockStart  AND
  slot.startTime < blockEnd      ← exclusive upper bound
```

### Interval examples

| Appointment | Duration | extendedBlockMinutes | Blocked slots (30-min grid) |
|---|---|---|---|
| 10:00 | 30 min | null (default) | 10:00 only |
| 10:00 | 60 min | null (default) | 10:00 only |
| 10:00 | 30 min | 120 | 10:00, 10:30, 11:00, 11:30 |
| 10:00 | 30 min | 180 | 10:00, 10:30, 11:00, 11:30, 12:00, 12:30 |
| 09:00 | 60 min | 60 | 09:00 only (same as default) |

**Note:** The slot the booking is ON (e.g., 10:00) is already excluded from availability because `currentBookings >= maxBookings`. The `isBlockedByBooking` flag on that slot is redundant but harmless.

### Off-by-one boundary (verified)

```
Appointment at 10:00, extendedBlockMinutes = 60
  blockStart = 600 min (10:00)
  blockEnd   = 660 min (11:00)

Slot at 10:30: 570 >= 600? NO → wait, 10:30 = 630 min → 630 >= 600 AND 630 < 660 → BLOCKED ✓
Slot at 11:00: 660 >= 600 AND 660 < 660 → FALSE → NOT BLOCKED ✓
```

The 11:00 slot is correctly available — the block is [10:00, 11:00), exclusive at the top.

### Cross-midnight safety

Block windows are scoped by `dateKey` (YYYY-MM-DD string). A booking at 23:00 with a 120-minute block cannot bleed into the next day's slots — the next day has a different `dateKey` and will never match.

### Which bookings trigger blocks

Only **CONFIRMED** bookings create block windows. PENDING, CANCELLED, COMPLETED, and NO_SHOW bookings do not block subsequent slots.

---

## 8. Affected Surfaces

| Surface | Effect |
|---|---|
| **Public portal** (`/[slug]`) | Blocked slots removed from available dates and slot lists |
| **Doctor "Horarios disponibles"** | Blocked slots hidden from the booking calendar |
| **Doctor "Nuevo horario"** | Not affected — doctor can always create a freeform booking at any time |
| **Doctor slot calendar view** | Not affected — `isBlockedByBooking` is not used for display in the calendar, only for filtering in "Horarios disponibles" |
| **Admin view** | Not affected — admin sees all bookings and slots regardless |

---

## 9. Edge Cases & Design Decisions

### Why store on `Booking`, not `AppointmentSlot`?

The extension is a property of the *visit* (how long this specific procedure takes), not of the slot template. The same slot (e.g., every Monday 10:00) might have a short visit one week and a long procedure the next.

### What about `maxBookings > 1`?

Slots with `maxBookings > 1` allow multiple simultaneous patients. The extended block still applies — if any CONFIRMED booking on a slot has `extendedBlockMinutes` set, subsequent slots are blocked. The intent is "the doctor is busy for X hours", regardless of the slot's capacity setting.

### Freeform bookings (Nuevo horario)

Freeform bookings (`slotId = null`) also participate in the block window computation. Their `date` and `startTime` are read directly from the booking record. `extendedBlockMinutes` works identically.

### Resetting to default

Setting `extendedBlockMinutes = null` (or not setting it at all) causes the block window to default to the slot's own `duration` field. This means a 30-min slot blocks a 30-min window, a 60-min slot blocks a 60-min window — matching the natural appointment duration.

### Timezone safety

- Slot and booking dates are stored as UTC midnight, matching the intended local Mexico City calendar date
- `startTime` values ("09:00", "10:30") are plain strings stored in local Mexico City time
- Block window comparison is pure string-to-minutes arithmetic with no timezone conversion
- `dateKey` comparison uses `toISOString().split('T')[0]` on both sides — consistent UTC-based approach

### The `ExtendedBlockControl` is hidden for freeform bookings with no startTime

Freeform bookings created without an explicit `startTime` (edge case) do not show the control, to avoid displaying a misleading "Bloqueo: 00:00–..." label.

---

---

## 10. Extended Block Over an Existing Appointment

**Scenario:** Doctor has a CONFIRMED booking at 10:00 AM with `extendedBlockMinutes = 300` (blocks until 3:00 PM). There is already another booking at 1:00 PM in any status (CONFIRMED, PENDING, etc.).

### What the code does

The block system operates entirely at the **slot availability** level for new bookings. Existing bookings are never touched, cancelled, or modified by a block window.

### Case 1: `maxBookings = 1` (standard, most common)

The 1:00 PM slot already has an active booking (PENDING and CONFIRMED both count — the availability filter excludes only `CANCELLED/COMPLETED/NO_SHOW`). So `_count.bookings >= maxBookings` removes the slot from availability **before** the extended block logic even runs. The block window hitting an already-eliminated slot is redundant but harmless.

**Result: no issue.**

### Case 2: `maxBookings > 1` (multi-patient slots)

The 1:00 PM slot has 1 booking but remaining capacity. The extended block window covers it (`slotMin >= startMin && slotMin < endMin`) and prevents additional patients from booking.

This is the correct behavior — the doctor is occupied until 3:00 PM and cannot take extra patients at 1:00 PM regardless of slot capacity.

**Result: intentional. The block takes precedence over remaining slot capacity.**

### Confirming or changing the status of the 1:00 PM booking

Not affected at all. The PATCH endpoint (`/api/appointments/bookings/[id]`) uses only the state machine (`PENDING → CONFIRMED → COMPLETED` etc.) and never consults block windows. A booking whose slot falls inside another booking's extended block can be freely confirmed, completed, or cancelled.

### Only CONFIRMED bookings generate block windows

The block window query filters `status: 'CONFIRMED'`. A PENDING booking at 10:00 AM will never generate a block window — only confirmed procedures trigger extended blocks.

---

## 11. Nuevo Horario (Instant Bookings) & Extended Block

"Nuevo horario" uses `POST /api/appointments/bookings/instant`, which is fundamentally different from the public slot booking flow.

### What it creates

Two records are created atomically:
1. An `AppointmentSlot` with `isPublic: false`, `isOpen: false` — private, never visible to patients
2. A `Booking` with `status: 'CONFIRMED'` immediately — no PENDING phase

### ExtendedBlockControl already works for these bookings

`ExtendedBlockControl` renders for any `booking.status === "CONFIRMED"` with a valid `startTime` — instant bookings always satisfy both conditions. No code change is needed.

### Block window computation already covers instant bookings

Both APIs fetch CONFIRMED bookings via:
```javascript
{ status: 'CONFIRMED', OR: [{ slot: { date: dateFilter } }, ...] }
```
Instant bookings have a real `slotId`, so they match via `slot.date`, and `slot.startTime`/`slot.duration` are included in the select. The `extendedBlockMinutes` logic is identical to public slot bookings.

### Default block behavior is different in practice

For public slot bookings, the default block (`extendedBlockMinutes = null` → slot duration) matters because adjacent slots could be booked by patients. For instant bookings, the default block is **redundant** — the private slot is already `isOpen: false` and `isPublic: false`, so no slot around it is affected. A custom `extendedBlockMinutes` only becomes meaningful when the doctor sets a value that extends **beyond** the slot's own duration to cover adjacent public slots.

### Cancellation auto-lifts the block

When a Nuevo horario booking is cancelled (or COMPLETED/NO_SHOW), the PATCH handler detects `isPublic === false` and runs:
```javascript
await prisma.$transaction([
  prisma.booking.update({ data: { status: 'CANCELLED', slotId: null } }),
  prisma.appointmentSlot.delete({ where: { id: slot.id } }),
]);
```

The private slot is **deleted** and `slotId` is nulled. The extended block is automatically lifted because:
1. The booking status becomes `CANCELLED` → excluded from block window computation (only `CONFIRMED` bookings are fetched)
2. Even without that filter: `b.slot = null` and `b.date = null` (instant bookings store date only on the slot, not directly on the booking) → the `if (!rawDate || !rawStart || !rawDur) continue` guard skips it

**Cancelling a Nuevo horario appointment always cleans up its block. No manual action required.**

### Comparison table

| Aspect | Public slot booking | Nuevo horario booking |
|---|---|---|
| `ExtendedBlockControl` shown | Yes (CONFIRMED) | Yes (CONFIRMED) — already works |
| Block computation covers it | Yes | Yes — already works |
| Default block effect | Blocks its own slot + adjacent | Redundant (slot already private/closed) |
| Extended block effect | Blocks adjacent public slots | Same — blocks adjacent public slots |
| On cancellation | Slot stays open for new patients | Slot deleted, block auto-lifted |
| `extendedBlockMinutes` after cancel | Orphaned on booking record (harmless) | Same — booking is CANCELLED, never queried |

---

## 12. Confirming a Blocked Pending Appointment

**Question:** If a PENDING appointment at 1:00 PM has its slot blocked by a CONFIRMED appointment at 10:00 AM (with `extendedBlockMinutes` covering 1:00 PM), can the 1:00 PM booking still be confirmed?

**Yes, without restriction.**

The PATCH endpoint for status changes (`PENDING → CONFIRMED`) does a direct `prisma.booking.update` after validating only the state machine transition. Block windows are never consulted during status changes. The system prevents new bookings from being created in blocked slots — it does not prevent existing bookings from moving through their lifecycle.

```
PENDING booking at 1:00 PM (slot blocked by 10:00 AM extended block)
  ↓
Doctor clicks "Confirmar"
  ↓
PATCH /api/appointments/bookings/[id]  { status: "CONFIRMED" }
  ↓
State machine: PENDING → CONFIRMED ✓
  ↓
booking.update({ status: "CONFIRMED", confirmedAt: now })
SMS sent · GCal synced · confirmation email sent
```

No block window is consulted at any point. This is intentional — the doctor is actively deciding to confirm that patient, so the system allows it.

---

## 13. File Reference

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Added `extendedBlockMinutes Int?` to `Booking` model |
| `packages/database/prisma/migrations/add-extended-block-minutes.sql` | SQL migration: `ADD COLUMN extended_block_minutes INTEGER` |
| `apps/api/.../bookings/[id]/route.ts` | PATCH now handles `extendedBlockMinutes` update (no status required) |
| `apps/api/.../slots/route.ts` | GET computes and returns `isBlockedByBooking` per slot |
| `apps/api/.../doctors/[slug]/availability/route.ts` | Filters out slots within extended block windows before returning |
| `apps/doctor/.../_hooks/useBookings.ts` | Added `extendedBlockMinutes` to `Booking` type + `updateExtendedBlock()` fn |
| `apps/doctor/.../_hooks/useSlots.ts` | Added `isBlockedByBooking?: boolean` to `AppointmentSlot` type |
| `apps/doctor/.../_components/BookingsSection.tsx` | Added `ExtendedBlockControl` component + prop threading through `StatusActions` |
| `apps/doctor/.../appointments/page.tsx` | Passes `onUpdateExtendedBlock={bookingsHook.updateExtendedBlock}` to `BookingsSection` |
| `apps/doctor/.../_components/BookPatientModal/index.tsx` | Filters `!s.isBlockedByBooking` from available slot list |
