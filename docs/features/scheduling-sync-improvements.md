# Scheduling Sync Improvements — Appointments & Pendientes

## Overview

The appointments page (`/appointments`) and pendientes page (`/dashboard/pendientes`) share a scheduling conflict detection system. When creating either appointment slots or pendientes with time ranges, the system checks both data sources for overlapping time slots. This document describes the improvements made to reliability, data consistency, and user experience of this system.

---

## Improvements

### 1. Silent Failure on API Downtime (Critical Fix)

**Problem:** When the appointments API was unreachable, the conflict check silently continued with an empty result. Users could unknowingly create overlapping entries without any warning.

**Solution:**
- The conflict check API (`/api/medical-records/tasks/conflicts`) now returns `appointmentCheckFailed` and `taskCheckFailed` boolean flags when either data source is unreachable.
- **Pendientes page:** Shows a red warning banner explaining which service is unavailable and that duplicates may occur.
- **Appointments page:** Shows a red warning banner with the submit button disabled. The user must acknowledge with "Entiendo, crear de todas formas" before proceeding.
- Full fetch failures (network errors) are also caught and surfaced to the user.

**Files changed:**
- `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts`
- `apps/doctor/src/app/dashboard/pendientes/new/page.tsx`
- `apps/doctor/src/app/appointments/CreateSlotsModal.tsx`

---

### 2. Atomic Override Operations (Critical Fix)

**Problem:** The override endpoint cancelled tasks first, then blocked appointment slots. If slot blocking failed mid-way, tasks were already cancelled with no rollback — leaving the system in an inconsistent state.

**Solution:**
- Reversed the operation order: **block slots first**, cancel tasks second.
- If any slot block fails, all already-blocked slots are rolled back to `AVAILABLE` (best-effort).
- Returns a `502` error with a descriptive message; **no tasks are cancelled**.
- Frontend override handlers now display the server's specific error message instead of a generic one.

**Files changed:**
- `apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts`
- `apps/doctor/src/app/dashboard/pendientes/new/page.tsx`
- `apps/doctor/src/app/appointments/CreateSlotsModal.tsx`

---

### 3. Race Condition Prevention

**Problem:** Two concurrent requests (e.g., two browser tabs) could both pass the client-side conflict check and create overlapping entries, since there was no server-side validation at creation time.

**Solution:**
- The task creation endpoint (`POST /api/medical-records/tasks`) now performs a **server-side conflict recheck** right before inserting the record.
- If conflicts are detected, it returns `409 Conflict` with the conflict details.
- After an override (where conflicts were already resolved), the client passes `skipConflictCheck: true` to bypass the redundant check.
- Extracted the conflict detection logic into a shared module (`lib/conflict-checker.ts`) used by both the conflict check route and the task creation route.

**Files changed:**
- `apps/doctor/src/lib/conflict-checker.ts` (new shared module)
- `apps/doctor/src/app/api/medical-records/tasks/route.ts`
- `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts` (refactored to use shared module)
- `apps/doctor/src/app/dashboard/pendientes/new/page.tsx`

---

### 4. Timezone Safety (Bug Fix)

**Problem:** Creating a pendiente on day 30 would display as day 29 in the calendar. The root cause: `new Date("2026-01-30")` is parsed as UTC midnight. In timezones behind UTC (e.g., Mexico CST = UTC-6), this becomes January 29 at 18:00 local time. Then `setHours(0,0,0,0)` normalizes to January 29 00:00 — shifting the date back by one day.

**Solution:**
- Replaced all `normalizeDate` functions with a single shared implementation that parses `"YYYY-MM-DD"` strings by splitting into components and using `new Date(year, month - 1, day)`, which constructs the date in **local time** without UTC interpretation.
- Removed duplicate `normalizeDate` definitions from 4 route files; all now import from `lib/conflict-checker.ts`.
- Frontend `pendientes/page.tsx`: Added `toLocalDate()` helper that extracts the `YYYY-MM-DD` portion from ISO strings before creating Date objects, fixing `isOverdue`, `isToday`, and date display rendering.

**Files changed:**
- `apps/doctor/src/lib/conflict-checker.ts`
- `apps/doctor/src/app/api/medical-records/tasks/route.ts`
- `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts`
- `apps/doctor/src/app/api/medical-records/tasks/calendar/route.ts`
- `apps/doctor/src/app/dashboard/pendientes/page.tsx`

---

### 5. Batch Creation Error Reporting

**Problem:** Voice assistant batch creation ran tasks sequentially without reporting which specific entries failed or why. The error message only showed counts (e.g., "3 created, 2 failed").

**Solution:**
- `executeBatchCreation` now tracks each failed entry with its title and specific error reason (including server messages like conflict detection errors or connection failures).
- Error message lists each failed task by name with its reason.
- Added `whitespace-pre-line` to the error display so the list renders with proper line breaks.

**Example error message:**
```
Se crearon 3 de 5 pendientes.

Fallaron:
• "Revisión paciente": Se detectaron conflictos de horario. Verifica e intenta de nuevo.
• "Llamada laboratorio": Error de conexión
```

**Files changed:**
- `apps/doctor/src/app/dashboard/pendientes/new/page.tsx`

---

### 6. Calendar Visual Overlap Indicators

**Problem:** The calendar view showed blue dots (tasks) and green/orange dots (appointments) independently, with no visual indication when they overlapped in time.

**Solution:**

**Calendar grid (month view):**
- Detects time overlaps between tasks and appointment slots on each day, and between tasks themselves.
- Shows a red dot with "Conflicto" label on days that have overlapping time ranges.
- Appears above the existing blue/green/orange indicators.

**Day details panel (click a day):**
- Tasks with overlaps: red border, red background, time range in red with "Conflicto de horario" label.
- Appointment slots with overlaps: red border, red background, time in red with "Conflicto con pendiente" label.
- Non-conflicting items render normally.

**Files changed:**
- `apps/doctor/src/app/dashboard/pendientes/page.tsx`

---

## Architecture

### Shared Conflict Checker (`lib/conflict-checker.ts`)

A new shared module that centralizes conflict detection logic:

```typescript
export function normalizeDate(dateStr: string): Date
export function checkConflictsForEntry(doctorId, entry, excludeTaskId?): Promise<ConflictResult>
```

Used by:
- `GET/POST /api/medical-records/tasks/conflicts` — client-facing conflict check
- `POST /api/medical-records/tasks` — server-side recheck at creation time

### Conflict Detection Flow

```
User action (create task/slot)
  → Client-side conflict check (debounced preview + on submit)
    → Shows ConflictDialog if conflicts found
      → Override: block slots first → cancel tasks → skipConflictCheck=true
  → Server-side recheck at creation (prevents race conditions)
    → 409 if conflicts found
    → 201 if clean
```

### Override Flow (Atomic)

```
1. Block all conflicting appointment slots (parallel)
2. If ANY slot block fails:
   a. Rollback already-blocked slots → AVAILABLE
   b. Return 502 error
   c. Do NOT cancel tasks
3. If ALL slots blocked successfully:
   a. Cancel conflicting tasks (single DB query)
   b. Return success
```
