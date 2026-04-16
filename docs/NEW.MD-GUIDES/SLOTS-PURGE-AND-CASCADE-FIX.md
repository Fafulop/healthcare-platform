# Purge Slots Feature & Cascade Deletion Bug Fix

**Date:** 2026-04-16
**Scope:** Appointment slots deletion safety + new bulk purge feature

---

## Context

Doctors reported that some of their appointment slots "disappeared." Investigation against the Railway production database confirmed **no bug** — all deletions were intentional, performed by doctors themselves via the UI. The root cause was a **UX problem**: a doctor accidentally created 56 recurring slots starting at 4:00 AM and had to delete them one by one.

This led to two improvements:
1. A new **Purge Slots** feature so doctors can bulk-delete available slots with filters
2. Discovery and fix of a **pre-existing cascade deletion bug** affecting historical booking records

---

## 1. Purge Slots Feature

### Problem
When a doctor creates slots with wrong parameters (wrong time range, wrong days), the only option was to select and delete them individually or in small batches. For large mistakes (e.g., 56 slots), this is extremely tedious.

### Solution
A new "Limpiar Horarios" (Purge Slots) button in the appointments page that opens a modal with filters and a two-step confirmation flow.

### Backend: `DELETE /api/appointments/slots/purge`

**File:** `apps/api/src/app/api/appointments/slots/purge/route.ts`

**Safety guarantees:**
- Only deletes slots where `isOpen: true` (not blocked), `isPublic: true` (not private/instant), and **zero active bookings** (no PENDING or CONFIRMED)
- Historical bookings (CANCELLED/COMPLETED/NO_SHOW) are detached (`slotId` set to null) before deletion to prevent cascade data loss
- Detach + delete wrapped in a `$transaction` for atomicity
- Auth-checked: doctors can only purge their own slots

**Optional filters (all AND'd together):**
| Filter | Type | Description |
|--------|------|-------------|
| `dateFrom` | `YYYY-MM-DD` | Only slots on or after this date |
| `dateTo` | `YYYY-MM-DD` | Only slots on or before this date |
| `daysOfWeek` | `number[]` | JS `getUTCDay` convention: 0=Sun, 1=Mon, ..., 6=Sat |
| `timeFrom` | `HH:MM` | Only slots starting at or after this time |
| `timeTo` | `HH:MM` | Only slots starting before this time |
| `dryRun` | `boolean` | If `true`, returns count without deleting |

**Example request:**
```json
{
  "doctorId": "abc123",
  "dryRun": false,
  "dateFrom": "2026-04-01",
  "dateTo": "2026-04-30",
  "timeFrom": "04:00",
  "timeTo": "07:00"
}
```

### Frontend: `PurgeSlotsModal`

**File:** `apps/doctor/src/app/appointments/_components/PurgeSlotsModal.tsx`

**Two-step flow:**
1. Doctor sets filters and clicks **"Consultar"** — dry-run returns the count
2. If count > 0, button changes to red **"Eliminar N"** — confirms deletion

**Features:**
- Date range picker
- Day-of-week toggle buttons (Dom, Lun, Mar, ...)
- Time range selectors
- Amber safety notice explaining what will/won't be deleted
- Preview count resets when any filter changes (forces re-query)
- "Limpiar filtros" reset button

### Page integration

**File:** `apps/doctor/src/app/appointments/page.tsx`

- Red "Limpiar Horarios" button added next to "Crear Horarios" in the header
- Modal wired with `onSuccess={slotsHook.fetchSlots}` to refresh after purge

---

## 2. CreateSlotsModal UX Improvements

### Problem
Doctors could create slots at unusual hours (e.g., 4:00 AM) without any warning, leading to large batches of unwanted slots.

### Solution (same session)

**File:** `apps/doctor/src/app/appointments/_components/CreateSlotsModal.tsx`

1. **Unusual hours warning** — Amber alert appears when start time is before 07:00 or end time is after 22:00
2. **Slot time preview** — The preview section now shows each individual time slot as chips (e.g., `09:00–10:00`, `10:00–11:00`) so the doctor sees exactly what will be created before confirming. For recurring mode, also shows "N por día."

Both computed client-side with zero API calls.

---

## 3. Cascade Deletion Bug Fix (Pre-existing)

### Problem
The Prisma schema defines `onDelete: Cascade` on the `Booking → AppointmentSlot` relation:
```prisma
slot AppointmentSlot? @relation(fields: [slotId], references: [id], onDelete: Cascade)
```

This means **deleting a slot cascade-deletes ALL its bookings**, including historical records (CANCELLED, COMPLETED, NO_SHOW).

All existing slot deletion code paths only checked for **active** bookings (PENDING/CONFIRMED) before deleting. If a slot had only terminal bookings, it passed the safety check and was deleted — silently destroying the booking history.

### Production impact
Query against Railway DB found **17 slots** with **18 historical booking records** that would have been cascade-deleted by the new purge feature if not caught. The same risk existed in all pre-existing deletion paths.

### Fix applied
Every slot deletion code path now **detaches historical bookings** (sets `slotId = null`) inside a `$transaction` before deleting the slot. This preserves booking history while still allowing slot cleanup.

**Pattern applied everywhere:**
```typescript
await prisma.$transaction([
  prisma.booking.updateMany({
    where: { slotId: { in: ids }, status: { in: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
    data: { slotId: null },
  }),
  prisma.appointmentSlot.deleteMany({
    where: { id: { in: ids } },
  }),
]);
```

### Files fixed

| File | Code Path |
|------|-----------|
| `apps/api/.../slots/route.ts` | `replaceConflicts` in single mode (line ~441) |
| `apps/api/.../slots/route.ts` | `replaceConflicts` in recurring mode (line ~640) |
| `apps/api/.../slots/[id]/route.ts` | Single slot DELETE (line ~179) |
| `apps/api/.../slots/bulk/route.ts` | Bulk DELETE action (line ~61) |
| `apps/api/.../slots/purge/route.ts` | New purge endpoint (built with fix from the start) |

### Files that were already safe (no changes needed)

| File | Code Path | Why safe |
|------|-----------|----------|
| `bookings/[id]/route.ts` PATCH | Private slot cleanup on terminal status | Already nulls `slotId` before deleting slot |
| `bookings/[id]/route.ts` DELETE | Delete booking + private slot | Deletes booking first (removes FK), then slot |

---

## Investigation Method

The investigation was performed by querying the Railway production database directly:

1. **Activity logs** (`activity_logs` table) — Confirmed all slot deletions were logged with doctor attribution (`SLOT_DELETED`, `SLOTS_BULK_DELETED`, `SLOTS_CREATED`)
2. **Booking orphan check** — Zero orphaned bookings found (no `slot_id` pointing to nonexistent slots)
3. **Migration history** — Last migration was Dec 2025, no recent schema changes
4. **Cascade risk check** — Found 17 slots with 18 historical bookings that would have been lost

All diagnostic queries are saved in `diagnose-slots.sql` at the project root.
