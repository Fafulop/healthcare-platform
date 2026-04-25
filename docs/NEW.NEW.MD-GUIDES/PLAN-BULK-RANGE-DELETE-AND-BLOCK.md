
# Plan: Bulk Range Delete & Reversible Block Time for Appointments v2

## Status: IMPLEMENTED — Deployed 2026-04-25 (redesigned as reversible overlay)

---

## 1. Context

Doctors using the v2 range-based scheduling need two distinct operations:
1. **Bulk delete** — remove ranges across a date range (irreversible)
2. **Block time** — prevent new bookings in a time window without destroying ranges (reversible)

Originally blocking was implemented by splitting ranges (identical to deletion). Redesigned to use a **BlockedTime overlay model** — blocking is now fully reversible by deleting the BlockedTime record.

### Design Decisions

| Decision | Value |
|---|---|
| Blocking mechanism | Overlay model (BlockedTime records), NOT range splitting |
| Reversibility | Blocking is reversible (unblock = delete record). Deletion is irreversible. |
| Booking protection | Active bookings are never affected. Both operations warn but proceed. |
| UI | Two separate buttons: "Eliminar" (red) and "Bloquear" (orange) |
| Time increments | Blocking uses 30-minute increments only |
| Range requirement | Blocking only applies to dates that have at least one range |
| Dry run | Mandatory preview before execution |

---

## 2. Database: BlockedTime Model

### Schema (`packages/database/prisma/schema.prisma`)

```prisma
model BlockedTime {
  id        String   @id @default(cuid())
  doctorId  String   @map("doctor_id")
  date      DateTime
  startTime String   @map("start_time")  // "HH:MM" — 30-min boundary
  endTime   String   @map("end_time")    // "HH:MM" — 30-min boundary
  reason    String?
  createdAt DateTime @default(now()) @map("created_at")

  doctor    Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@map("blocked_times")
  @@index([doctorId, date])
  @@unique([doctorId, date, startTime, endTime])
  @@schema("public")
}
```

Migration: `packages/database/prisma/migrations/add-blocked-times.sql`

---

## 3. API Endpoints

### 3.1 Block Time — `apps/api/src/app/api/appointments/ranges/block/route.ts`

BlockedTime CRUD (GET/POST/DELETE). Does NOT modify ranges.

**GET** — List blocked times by doctorId + date range
**POST** — Create blocked times with:
- 30-min boundary validation
- Skips dates with no ranges (`skippedNoRanges`)
- Skips existing identical blocks (`skippedDuplicates`)
- Warns about booking conflicts but still blocks
- dryRun support

**DELETE** — Unblock by array of IDs with ownership verification

### 3.2 Bulk Delete — `apps/api/src/app/api/appointments/ranges/bulk/route.ts`

- Whole days only (no time filter)
- Warns about active bookings but still deletes
- Cleans up BlockedTime records for dates where ALL ranges were deleted
- dryRun support

### 3.3 Availability Integration

- **`apps/api/src/lib/availability-calculator.ts`** — BlockedTime records added as blocked windows (no buffer, exact blocking)
- **`apps/api/src/app/api/doctors/[slug]/range-availability/route.ts`** — Fetches BlockedTime records alongside ranges/bookings
- **`apps/api/src/app/api/appointments/range-bookings/route.ts`** + **`instant/route.ts`** — Rejects bookings that overlap blocked time windows

---

## 4. Frontend

### New Files
- **`_hooks/useBlockedTimes.ts`** — Fetch, block, unblock operations
- **`_components/DeleteRangesModal.tsx`** — Date range pickers, preview-then-confirm
- **`_components/BlockTimeModal.tsx`** — Date/time pickers (30-min), reason input, preview, existing blocks list with individual + bulk unblock

### Modified Files
- **`v2/page.tsx`** — Two separate buttons (Eliminar/Bloquear), useBlockedTimes hook
- **`DayTimelinePanel.tsx`** — Shows blocked time segments (orange), factors into gap computation
- **`_hooks/useRanges.ts`** — Simplified bulkDeleteRanges (no time filter)

### Deleted Files
- **`ManageRangesModal.tsx`** — Replaced by DeleteRangesModal + BlockTimeModal

---

## 5. Key Behaviors

| Scenario | Behavior |
|---|---|
| Block a date with no ranges | Skipped (nothing to block) |
| Block a date with active booking | Blocked — booking stays, new bookings prevented |
| Delete a range with active booking | Deleted — booking stays as independent record |
| Delete all ranges for a date | BlockedTime records for that date also cleaned up |
| Unblock | Delete the BlockedTime record — availability restored instantly |
| Bulk unblock | "Desbloquear todos" button removes all blocks at once |
| Patient tries to book in blocked window | Rejected with "Este horario se encuentra bloqueado" |

---

*Document created 2026-04-25. Redesigned from split-ranges to overlay model same day.*
