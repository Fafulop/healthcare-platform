# Next LLM Session Handoff - Frontend Simplification Tasks

**Date:** January 31, 2026
**Status:** 3 of 5 tasks completed
**Remaining:** Tasks #9 and #10

---

## 🎯 Mission Summary

Simplifying the appointments-tasks conflict system based on the principle:

> **Appointment slots are potential availability (until booked), while tasks are actual commitments. These should NOT conflict with each other!**

**New Conflict Rules:**
- ✅ Tasks CAN overlap with appointment slots (empty or booked)
- ✅ Booked appointments show as INFO warning when task created (not blocking)
- ❌ Tasks CANNOT overlap with other tasks (blocking)
- ❌ Slots CANNOT overlap with other slots (blocking)

---

## ✅ Completed Tasks (3/5)

### Task #6: CreateSlotsModal ✅
**File:** `apps/doctor/src/app/appointments/CreateSlotsModal.tsx`

**What was done:**
- Removed 80+ lines of client-side conflict checking
- Simplified to direct submission with server-side conflict detection
- Server returns 409 for slot-slot conflicts → Shows inline dialog with "Reemplazar y Crear"
- Server returns 200 with `tasksInfo` for task overlaps → Shows blue info banner
- Removed complex `ConflictDialog` component usage
- Added atomic `replaceConflicts` parameter

**Key pattern:** Direct submit → Handle 409 (conflicts) or 200 (success + optional warnings)

---

### Task #7: Appointments Page Slot Management UI ✅
**File:** `apps/doctor/src/app/appointments/page.tsx`

**What was done:**
- Changed `AppointmentSlot` interface: `status: enum` → `isOpen: boolean`
- Created `getSlotStatus()` helper that computes display from `isOpen + currentBookings`:
  - **Cerrado** (gray): `isOpen = false`
  - **Lleno** (blue): `isOpen = true` AND `currentBookings >= maxBookings`
  - **Disponible** (green): `isOpen = true` AND `currentBookings < maxBookings`
- Renamed function: `toggleBlockSlot()` → `toggleOpenSlot()`
- Updated bulk actions: "Bloquear/Desbloquear" → "Cerrar/Abrir"
- Updated PATCH API call: `{ status: string }` → `{ isOpen: boolean }`
- Updated all UI status badges in calendar view, list view mobile, list view desktop

**Key pattern:** Boolean toggle for `isOpen`, computed status display

---

### Task #8: NewTaskPage Simplified Conflict Flow ✅
**File:** `apps/doctor/src/app/dashboard/pendientes/new/page.tsx`

**What was done:**
- Removed entire live conflict checking useEffect (~40 lines)
- Removed `ConflictDialog` component import and usage
- Simplified conflict state:
  - Old: Complex `ConflictData` with appointmentConflicts, taskConflicts, hasBookedAppointments
  - New: `TaskConflictData` (task-task only) + `BookedAppointmentWarning` (informational)
- Removed complex `handleOverride()` function (~40 lines)
- Updated `submitTask()` to handle:
  - 409 response → Task-task conflicts (blocking) → Show inline dialog
  - 200 with warning → Booked appointments (informational) → Show blue banner
- Simplified batch creation (no pre-checking)
- Code reduction: ~180 lines (-21%)

**Key pattern:** Submit → 409 blocks with dialog, 200 succeeds with optional warning banner

---

## 🔄 Remaining Tasks (2/5)

### ⏳ Task #9: Update Calendar View Overlap Indicators

**Current status:** Marked as `in_progress` but NOT started yet

**File to update:** `apps/doctor/src/app/dashboard/pendientes/page.tsx`

**Steps to complete:**

1. **Read the file first:**
   ```
   Read: apps/doctor/src/app/dashboard/pendientes/page.tsx
   ```

2. **Search for overlap/conflict logic:**
   ```
   Grep pattern: "conflict|overlap" in apps/doctor/src/app/dashboard/pendientes/page.tsx
   ```

3. **Understand current implementation:**
   - Look for calendar rendering (likely grid or timeline view)
   - Find where overlaps are visually indicated (colors, borders, badges)
   - Check if it currently calls `/api/medical-records/tasks/conflicts`

4. **Update overlap indicators based on new rules:**

   | Scenario | Old Behavior | New Behavior |
   |----------|-------------|--------------|
   | Task + Empty Slot | ⚠️ Yellow/Red warning | ✅ No indicator (allowed) |
   | Task + Booked Appointment | ⚠️ Red error | 🔵 Blue info badge (allowed, informational) |
   | Task + Task | ❌ Red error | ❌ Red error (still blocked) |
   | Slot + Task | ⚠️ Yellow/Red warning | ✅ No indicator (allowed) |
   | Slot + Slot | ❌ Red error | ❌ Red error (still blocked) |

5. **Visual indicator color scheme:**
   - 🔴 **Red/Error** (bg-red-100, border-red-300): Blocking conflicts (task-task, slot-slot)
   - 🔵 **Blue/Info** (bg-blue-100, border-blue-300): Informational (task + booked appointment)
   - ⚪ **No indicator**: Allowed overlaps (task + empty slot, slot + task)

6. **Implementation hints:**
   - May need to fetch slot booking status to distinguish "empty" vs "booked" slots
   - Update overlap detection to check conflict types
   - Update CSS classes for visual indicators
   - Simplify or remove calls to old `/api/medical-records/tasks/conflicts` endpoint

7. **When done:**
   ```
   TaskUpdate: taskId=9, status=completed
   Update FRONTEND-UPDATE-PROGRESS.md with Task #9 details
   ```

---

### ⏳ Task #10: Delete Old Conflict API Routes

**Files to check and delete:**

1. **These routes should be DELETED** (no longer used):
   ```
   apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts
   apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts
   ```

2. **Before deleting, verify no remaining usages:**
   ```bash
   # Search entire doctor app for references
   Grep pattern: "tasks/conflicts" in apps/doctor/src
   Grep pattern: "conflicts/override" in apps/doctor/src
   ```

3. **Component to delete:**
   ```
   apps/doctor/src/components/ConflictDialog.tsx
   ```

   **Before deleting, verify it's not used elsewhere:**
   ```bash
   Grep pattern: "ConflictDialog" in apps/doctor/src
   # Should only find the old imports we removed in Tasks #6 and #8
   ```

4. **Routes to KEEP (already updated):**
   - ✅ `apps/api/src/app/api/appointments/slots/route.ts` - Slot creation with `replaceConflicts`
   - ✅ `apps/api/src/app/api/appointments/slots/[id]/route.ts` - Slot PATCH with `isOpen`
   - ✅ `apps/doctor/src/app/api/medical-records/tasks/route.ts` - Task creation with conflict detection

5. **Bulk endpoint to check:**
   ```
   apps/api/src/app/api/appointments/slots/bulk/route.ts
   ```

   **Action needed:**
   - Read the file to see if it still uses "block"/"unblock" actions
   - Update to use "close"/"open" actions if needed (matching Task #7 changes)
   - Or verify it already handles the new bulk actions correctly

6. **When done:**
   ```
   TaskUpdate: taskId=10, status=completed
   Update FRONTEND-UPDATE-PROGRESS.md with Task #10 details
   ```

---

## 📁 Important Files Reference

### Documentation (READ THESE FIRST)
- `IMPLEMENTATION-SUMMARY.md` - Backend changes summary (all 5 backend tasks completed)
- `FRONTEND-UPDATE-PROGRESS.md` - Frontend changes details (Tasks #6, #7, #8 documented)
- `migrate-to-isopen.md` - Database migration guide
- `docs/features/time-slot-conflict-blocking.md` - Original feature doc (may be outdated)

### Backend API Files (Already Updated - Reference Only)
- `packages/database/prisma/schema.prisma` - AppointmentSlot uses `isOpen` boolean
- `apps/api/src/app/api/appointments/slots/route.ts` - Slot creation with same-type conflicts
- `apps/api/src/app/api/appointments/slots/[id]/route.ts` - PATCH uses `{ isOpen: boolean }`
- `apps/api/src/app/api/appointments/bookings/[id]/route.ts` - Booking state machine
- `apps/doctor/src/app/api/medical-records/tasks/route.ts` - Task creation with task-task conflicts

### Frontend Files (Updated)
- ✅ `apps/doctor/src/app/appointments/CreateSlotsModal.tsx` - Task #6
- ✅ `apps/doctor/src/app/appointments/page.tsx` - Task #7
- ✅ `apps/doctor/src/app/dashboard/pendientes/new/page.tsx` - Task #8

### Frontend Files (To Update)
- ⏳ `apps/doctor/src/app/dashboard/pendientes/page.tsx` - Task #9 (calendar view)

### Files to Delete
- ❌ `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts` - Task #10
- ❌ `apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts` - Task #10
- ❌ `apps/doctor/src/components/ConflictDialog.tsx` - Task #10 (verify first)

---

## 🔑 Key Patterns & Principles

### 1. Server-Authoritative Conflict Detection
**Frontend submits, server decides:**
```typescript
// ❌ OLD: Client checks conflicts before submit
const conflicts = await checkConflicts();
if (conflicts) showDialog();
else submit();

// ✅ NEW: Submit directly, handle server response
const response = await submit();
if (response.status === 409) showConflictDialog();
```

### 2. Conflict Response Patterns

**Slot creation (POST /api/appointments/slots):**
```typescript
// 409 Conflict - Slot-slot conflicts
{
  error: "Conflictos detectados",
  conflicts: [{ id, date, startTime, endTime, currentBookings }],
  message: "Ya existen X horarios en este rango"
}

// 200 Success with task info
{
  success: true,
  count: 10,
  tasksInfo: {  // Informational, not blocking
    count: 2,
    message: "Tienes 2 pendiente(s) a estas horas",
    tasks: [{ id, title, startTime, endTime }]
  }
}
```

**Task creation (POST /api/medical-records/tasks):**
```typescript
// 409 Conflict - Task-task conflicts
{
  error: "Ya tienes un pendiente a esta hora",
  taskConflicts: [{ id, title, dueDate, startTime, endTime }]
}

// 200 Success with booked appointment warning
{
  data: { /* created task */ },
  warning: "Tienes 1 cita(s) con pacientes a esta hora",  // Informational
  bookedAppointments: [{ startTime, endTime, bookings: [...] }]
}
```

### 3. UI Color Scheme

```typescript
// Status badges
"Cerrado" → bg-gray-200 text-gray-700     // Slot closed by doctor
"Lleno" → bg-blue-100 text-blue-700       // Slot full (booked)
"Disponible" → bg-green-100 text-green-700 // Slot open and available

// Conflict indicators
Red (bg-red-100 border-red-300) → BLOCKING conflicts (must resolve)
Blue (bg-blue-100 border-blue-200) → INFORMATIONAL warnings (allowed)
No indicator → Allowed overlaps
```

### 4. No Override Functionality

**OLD approach (removed):**
```typescript
// Two-step: Override conflicts, then create
await overrideConflicts({ slotIdsToBlock, taskIdsToCancel });
await createTask(data, skipConflictCheck=true);
```

**NEW approach:**
```typescript
// Single step: Replace conflicting slots atomically
await createSlots({ ...data, replaceConflicts: true });

// For tasks: No override - must resolve manually
// Show conflict dialog → User adjusts time or cancels existing task
```

---

## 🚀 Quick Start Commands

```bash
# 1. Read calendar view file (Task #9)
Read: apps/doctor/src/app/dashboard/pendientes/page.tsx

# 2. Search for conflict/overlap logic
Grep: "conflict|overlap" in apps/doctor/src/app/dashboard/pendientes/page.tsx

# 3. After Task #9 complete, verify old routes aren't used
Grep: "tasks/conflicts" in apps/doctor/src
Grep: "ConflictDialog" in apps/doctor/src

# 4. Delete old files (Task #10)
# - apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts
# - apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts
# - apps/doctor/src/components/ConflictDialog.tsx (if unused)

# 5. Update progress docs
Edit: FRONTEND-UPDATE-PROGRESS.md (add Task #9 and #10 details)
```

---

## 📊 Progress Tracker

- ✅ **Task #6:** CreateSlotsModal Updated
- ✅ **Task #7:** Appointments Page Slot Management UI Updated
- ✅ **Task #8:** NewTaskPage Simplified Conflict Flow
- ⏳ **Task #9:** Update Calendar View Overlap Indicators (IN PROGRESS - NOT STARTED)
- ⏳ **Task #10:** Delete Old Conflict API Routes (PENDING)

---

## 🎯 Success Criteria

**Task #9 Complete When:**
- [ ] Calendar view shows NO indicators for task+empty-slot overlaps
- [ ] Calendar view shows BLUE indicators for task+booked-appointment overlaps
- [ ] Calendar view shows RED indicators for task-task overlaps
- [ ] Calendar view shows RED indicators for slot-slot overlaps
- [ ] No client-side calls to old `/api/medical-records/tasks/conflicts` endpoint
- [ ] Updated in `FRONTEND-UPDATE-PROGRESS.md`
- [ ] TaskUpdate: taskId=9, status=completed

**Task #10 Complete When:**
- [ ] Deleted: `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts`
- [ ] Deleted: `apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts`
- [ ] Deleted: `apps/doctor/src/components/ConflictDialog.tsx` (if verified unused)
- [ ] Verified: No remaining references to deleted files in codebase
- [ ] Checked: Bulk endpoint uses correct "open"/"close" actions
- [ ] Updated in `FRONTEND-UPDATE-PROGRESS.md`
- [ ] TaskUpdate: taskId=10, status=completed

---

## 💡 Tips for Next LLM

1. **Read documentation first:** Check `IMPLEMENTATION-SUMMARY.md` and `FRONTEND-UPDATE-PROGRESS.md` to understand context
2. **Use TaskList:** Check task status before starting
3. **Use TaskUpdate:** Mark tasks as in_progress when starting, completed when done
4. **Follow the pattern:** Look at Tasks #6, #7, #8 implementations for consistency
5. **Test the logic:** Mentally walk through user scenarios with new conflict rules
6. **Update docs:** Add detailed Task #9 and #10 sections to `FRONTEND-UPDATE-PROGRESS.md`

---

**Good luck! You're almost done - just 2 tasks remaining!** 🚀
