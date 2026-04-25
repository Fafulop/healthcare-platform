



# Plan: Bulk Range Delete & Block Time for Appointments v2

## Status: PLANNED — Not yet implemented

---

## 1. Context

Doctors using the v2 range-based scheduling can only delete ranges one at a time from the timeline. They need:
1. **Bulk delete** — remove ranges across a day or date range
2. **Block time** — close a time window within existing ranges (e.g., block 11:00-13:00 inside a 09:00-14:00 range)

Both operations must **never touch existing bookings** (PENDING/CONFIRMED). Ranges with active bookings in the affected window are skipped/protected.

---

## 2. Approach: Split Ranges (no schema change)

**Blocking = splitting ranges.** If range is 09:00-14:00 and doctor blocks 11:00-13:00, we delete the original and create two: 09:00-11:00 + 13:00-14:00. The availability calculator already handles multiple ranges per day, so this works with zero algorithm changes.

**No new DB model or migration needed.** Everything uses existing `AvailabilityRange` CRUD.

### Design Decisions

| Decision | Value |
|---|---|
| Schema changes | None — uses existing AvailabilityRange model |
| Blocking mechanism | Split ranges into sub-ranges |
| Booking protection | Always — protected ranges are never touched |
| Dry run | Mandatory before execution (preview-then-confirm) |
| Transactional | Yes — block/split uses prisma.$transaction |
| Sub-range minimum | Must be >= intervalMinutes (otherwise discarded) |

---

## 3. New Files

### 3.1 `apps/api/src/app/api/appointments/ranges/bulk/route.ts` — Bulk Delete API

**DELETE** with JSON body:
```typescript
{
  doctorId: string;
  startDate: string;      // "YYYY-MM-DD"
  endDate: string;        // "YYYY-MM-DD"
  startTime?: string;     // optional: only delete ranges starting at or after this time
  endTime?: string;       // optional: only delete ranges ending at or before this time
  dryRun: boolean;        // true = preview only, false = execute
}
```

**Algorithm:**
1. Authenticate and authorize (doctor can only operate on own ranges, admin on any)
2. Query `AvailabilityRange` records matching doctorId, date in [startDate, endDate], optional time filters
3. For each matched range: check active bookings (PENDING/CONFIRMED) overlapping the range's time window
   - Reuse overlap detection pattern from `ranges/[id]/route.ts:109-132`
4. Separate into `deletable` (no active bookings) and `protected` (has active bookings)
5. If `dryRun`: return preview only
6. If not `dryRun`: delete all deletable ranges, log activity, return results

**Response:**
```typescript
{
  success: true;
  deleted: number;
  protected: number;
  protectedRanges: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    activeBookings: Array<{ id: string; patientName: string; startTime: string; endTime: string }>;
  }>;
}
```

### 3.2 `apps/api/src/app/api/appointments/ranges/block/route.ts` — Block Time API

**POST** with JSON body:
```typescript
{
  doctorId: string;
  startDate: string;       // "YYYY-MM-DD"
  endDate: string;         // "YYYY-MM-DD" (same as startDate for single day)
  blockStartTime: string;  // "HH:MM" - start of blocked window
  blockEndTime: string;    // "HH:MM" - end of blocked window
  dryRun: boolean;
}
```

**Algorithm (per date in the range):**
1. Authenticate and authorize
2. Validate times are on 15-minute boundaries
3. For each date in [startDate, endDate]:
   a. Find all `AvailabilityRange` records for doctorId on that date
   b. For each range that overlaps [blockStartTime, blockEndTime]:
      - Check active bookings in the overlap zone → skip if any exist (mark as protected)
      - Split the range:
        - **Block covers entire range** → delete the range
        - **Block cuts the start** → update range's startTime to blockEndTime
        - **Block cuts the end** → update range's endTime to blockStartTime
        - **Block is in the middle** → delete original, create two sub-ranges:
          - [range.startTime, blockStartTime] with same interval/location
          - [blockEndTime, range.endTime] with same interval/location
      - Skip creating sub-ranges shorter than `intervalMinutes` (would produce zero bookable slots)
4. All mutations wrapped in `prisma.$transaction` for atomicity

**Response:**
```typescript
{
  success: true;
  datesProcessed: number;
  rangesModified: number;
  rangesCreated: number;
  rangesDeleted: number;
  protected: number;
  protectedRanges: Array<{
    date: string;
    startTime: string;
    endTime: string;
    activeBookings: Array<{ patientName: string; startTime: string; endTime: string }>;
  }>;
}
```

### 3.3 `apps/doctor/src/app/appointments/_components/ManageRangesModal.tsx` — Combined UI

Two-tab modal: **"Eliminar rangos"** / **"Bloquear horario"**

**Delete tab:**
- Date range picker (startDate + endDate)
- Optional time filter (startTime + endTime)
- "Vista previa" button → dry run → shows deletable count + protected list
- "Confirmar" button → execute

**Block tab:**
- Date range picker (startDate + endDate)
- Block time picker (blockStartTime + blockEndTime, 15-min increments)
- "Vista previa" → dry run → shows what splits will happen + protected ranges
- "Confirmar" → execute

Follows `PurgeSlotsModal.tsx` pattern (preview-then-confirm flow).

---

## 4. Modified Files

### 4.1 `apps/doctor/src/app/appointments/_hooks/useRanges.ts`

Add two functions:
- `bulkDeleteRanges(startDate, endDate, startTime?, endTime?, dryRun)` → calls bulk delete API
- `blockTimeInRanges(startDate, endDate, blockStart, blockEnd, dryRun)` → calls block API
- Both call `fetchRanges()` on successful non-dryRun execution

### 4.2 `apps/doctor/src/app/appointments/v2/page.tsx`

- Add state for `showManageRangesModal`
- Add "Gestionar Rangos" button in header (next to "Crear Rango")
- Render `<ManageRangesModal>` with `onSuccess={rangesHook.fetchRanges}`

---

## 5. Safety Mechanisms

| Mechanism | Purpose |
|---|---|
| Booking overlap check | Both APIs check PENDING/CONFIRMED bookings overlapping affected windows. Protected ranges are never touched. |
| Dry run | Frontend enforces preview before confirm. Doctor sees exactly what will happen. |
| Transaction | Block endpoint wraps all split operations in `prisma.$transaction`. |
| Sub-range validation | After split, sub-ranges shorter than `intervalMinutes` are discarded. |
| Activity logging | Both endpoints log operations via `logActivity()`. |
| Unique constraint | `@@unique([doctorId, date, startTime])` prevents duplicate ranges during splits. |

---

## 6. Implementation Order

```
1. Bulk delete API endpoint                         [New file]
2. Block/split API endpoint                         [New file]
3. Update useRanges hook with new functions          [Modify]
4. Create ManageRangesModal component                [New file]
5. Wire into v2 page                                [Modify]
```

---

## 7. Key Reference Files

| File | Why |
|---|---|
| `apps/api/src/app/api/appointments/ranges/[id]/route.ts` | Booking overlap detection pattern (lines 109-132) |
| `apps/api/src/app/api/appointments/ranges/route.ts` | Auth, range creation, overlap detection |
| `apps/doctor/src/app/appointments/_components/PurgeSlotsModal.tsx` | DryRun preview-then-confirm UI pattern |
| `apps/doctor/src/app/appointments/_components/CreateRangeModal.tsx` | Date/time picker UI patterns |

---

## 8. Verification Plan

1. Create ranges for multiple days (e.g., Mon-Fri 09:00-14:00)
2. Book a patient on Wednesday at 10:00
3. **Test bulk delete**: Delete Mon-Fri → Wednesday range should be protected, others deleted
4. **Test block**: Recreate ranges, block 11:00-13:00 across Mon-Fri → Wednesday's range (with 10:00 booking) should be protected, others split into 09:00-11:00 + 13:00-14:00
5. Verify availability calculator still shows correct times after splits
6. Verify old system is unaffected

---

## 9. Edge Cases

| Scenario | Behavior |
|---|---|
| Block covers entire range with no bookings | Range is deleted entirely |
| Block produces sub-range < intervalMinutes | Sub-range is discarded (too short for any slot) |
| Range already split (multiple per day) | Each sub-range is evaluated independently |
| Doctor blocks time with no ranges on that day | No-op, nothing to split |
| Concurrent booking during block operation | Transaction ensures atomicity; booking check is inside the transaction |
| Block window has booking but range extends beyond | Only the overlap zone is protected; safe portions are still split |

---

*Document created 2026-04-25.*
*Strategy: Split ranges, protect bookings, preview before execute.*
