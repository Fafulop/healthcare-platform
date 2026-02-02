# Time-Slot Conflict Blocking & Calendar Sync

## Overview

This feature adds **conflict detection and blocking** between two independent calendar systems in the doctor app:

1. **Pendientes (Tasks)** -- stored locally in PostgreSQL via Prisma (`Task` model)
2. **Appointment Slots** -- stored in the remote API app (`AppointmentSlot` model)

When a doctor creates a new pendiente with a time range, or creates new appointment slots, the system checks both data sources for overlapping items. If overlaps are found, the system **blocks creation** and presents a dialog where the doctor can choose to **override** (cancel/block conflicting items) or abort.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Data Model](#data-model)
3. [Date Normalization Fix](#date-normalization-fix)
4. [Time Input Restriction (30-min Increments)](#time-input-restriction-30-min-increments)
5. [API Endpoints](#api-endpoints)
   - [Task CRUD Validation](#1-task-crud-validation)
   - [Conflict Detection (GET)](#2-conflict-detection-get---single-check)
   - [Conflict Detection (POST)](#3-conflict-detection-post---batch-check)
   - [Conflict Override (POST)](#4-conflict-override-post)
6. [Frontend Components](#frontend-components)
   - [ConflictDialog](#conflictdialog-component)
   - [Pendientes Form](#pendientes-new-task-form)
   - [CreateSlotsModal](#createslotssmodal)
7. [Flow Diagrams](#flow-diagrams)
   - [Single Pendiente Creation](#flow-1-single-pendiente-creation)
   - [Batch Voice Pendiente Creation](#flow-2-batch-voice-pendiente-creation)
   - [Appointment Slot Creation](#flow-3-appointment-slot-creation)
8. [Override Behavior (Cancel vs Block)](#override-behavior)
9. [BOOKED Slot Protection](#booked-slot-protection)
10. [Overlap Formula](#overlap-formula)
11. [Files Changed](#files-changed)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Doctor App (Next.js)                     │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Pendientes   │    │  Conflicts API   │    │  Override API │  │
│  │  Form / Voice │───>│  GET (single)    │    │  POST         │  │
│  │               │    │  POST (batch)    │    │               │  │
│  └──────┬───────┘    └────────┬─────────┘    └───────┬───────┘  │
│         │                     │                       │          │
│  ┌──────┴───────┐    ┌───────┴──────────┐    ┌───────┴───────┐  │
│  │ CreateSlots   │    │                  │    │               │  │
│  │ Modal         │───>│  ConflictDialog  │<───│  Prisma       │  │
│  └──────────────┘    │  (shared UI)     │    │  (local DB)   │  │
│                      └──────────────────┘    └───────────────┘  │
│                                                                 │
│                              │ fetch()                          │
│                              ▼                                  │
│                    ┌──────────────────┐                          │
│                    │  Remote API App  │                          │
│                    │  /api/appointments│                         │
│                    │  /slots          │                          │
│                    └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

The conflict detection queries **both** data sources:
- **Local Prisma DB** for tasks with `status IN ('PENDIENTE', 'EN_PROGRESO')` that have non-null `startTime` and `endTime`
- **Remote API** for appointment slots with `status IN ('AVAILABLE', 'BOOKED')` on the same date

---

## Data Model

### Task (Prisma - local PostgreSQL)

```prisma
model Task {
  id            String    @id @default(cuid())
  doctorId      String    @map("doctor_id")
  title         String    @db.VarChar(200)
  description   String?   @db.Text
  dueDate       DateTime? @map("due_date") @db.Date
  startTime     String?   @map("start_time") @db.VarChar(5)   // "HH:MM" e.g. "09:00"
  endTime       String?   @map("end_time") @db.VarChar(5)     // "HH:MM" e.g. "10:30"
  status        String    // PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA
  priority      String    // ALTA, MEDIA, BAJA
  category      String
  completedAt   DateTime? @map("completed_at")
  // ...
}
```

### AppointmentSlot (Remote API - PostgreSQL)

```prisma
model AppointmentSlot {
  id         String   @id @default(cuid())
  doctorId   String   @map("doctor_id")
  date       DateTime // Normalized to midnight via setHours(0,0,0,0)
  startTime  String   @map("start_time")  // "HH:MM"
  endTime    String   @map("end_time")    // "HH:MM"
  duration   Int      // 30 or 60
  status     String   // AVAILABLE, BOOKED, BLOCKED, CANCELLED
  // ...pricing fields...
}
```

**Key design decisions:**
- Dates are stored as `DateTime` but represent date-only values (time portion is midnight)
- Time-of-day is stored as separate `String` fields ("HH:MM" format)
- This matches how the appointments system was already designed
- Tasks with `startTime: null` and `endTime: null` (date-only tasks) **never participate in conflict detection**

---

## Date Normalization Fix

### The Problem

JavaScript's `new Date("2026-01-30")` parses the string as **UTC midnight**. In timezones west of UTC (e.g., Mexico City at UTC-6), this becomes `2026-01-29T18:00:00` local time -- effectively **one day behind**.

The appointments system already handled this correctly:

```typescript
// Appointments API (correct)
const slotDate = new Date(date);
slotDate.setHours(0, 0, 0, 0);  // Force to local midnight
```

The tasks system did NOT:

```typescript
// Tasks API (broken - before fix)
dueDate: body.dueDate ? new Date(body.dueDate) : null  // UTC midnight = wrong day locally
```

### The Fix

A `normalizeDate()` helper was added to every tasks API route that parses date strings:

```typescript
function normalizeDate(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);  // Force to local midnight, matching appointments
  return d;
}
```

This was applied in **4 files**:

| File | Where Applied |
|------|---------------|
| `tasks/route.ts` | POST `dueDate` creation, GET date range filter (`gte`/`lte`) |
| `tasks/[id]/route.ts` | PUT `dueDate` update |
| `tasks/calendar/route.ts` | GET date range filter, ISO conversion for remote API call |
| `tasks/conflicts/route.ts` | Prisma `dueDate` query in conflict detection |

---

## Time Input Restriction (30-min Increments)

### The Problem

The native `<input type="time">` HTML element allows the user to type or pick **any minute value** (e.g., `08:24`, `13:47`). The `step="1800"` attribute is inconsistently supported across browsers and does not prevent manual typing of arbitrary values.

### The Fix

All time inputs were replaced with `<select>` dropdowns that generate exactly **48 options**: `00:00`, `00:30`, `01:00`, `01:30`, ... `23:00`, `23:30`.

```tsx
<select value={form.startTime} onChange={(e) => handleStartTimeChange(e.target.value)}>
  <option value="">--:--</option>
  {Array.from({ length: 48 }, (_, i) => {
    const h = String(Math.floor(i / 2)).padStart(2, '0');
    const m = i % 2 === 0 ? '00' : '30';
    return <option key={i} value={`${h}:${m}`}>{`${h}:${m}`}</option>;
  })}
</select>
```

This was applied to:

| File | Inputs |
|------|--------|
| `pendientes/new/page.tsx` | Start time, End time (2 selects) |
| `CreateSlotsModal.tsx` | Start time, End time, Break start, Break end (4 selects) |

Additionally, the **Tasks API** (`tasks/route.ts` POST handler) validates server-side:

```typescript
const validTime = (t: string) => {
  const [, m] = t.split(':').map(Number);
  return m === 0 || m === 30;
};
```

Returns `400` with `"La hora de inicio debe ser en punto o a la media hora"` if invalid.

---

## API Endpoints

### 1. Task CRUD Validation

**File:** `apps/doctor/src/app/api/medical-records/tasks/route.ts`

**POST /api/medical-records/tasks** -- Added two validations:

#### a) startTime/endTime pairing

If `startTime` is provided, `endTime` is required (and vice versa). Tasks can have both or neither -- never just one.

```typescript
if (body.startTime && !body.endTime) {
  return 400: "Si se proporciona hora de inicio, la hora de fin es obligatoria"
}
if (body.endTime && !body.startTime) {
  return 400: "Si se proporciona hora de fin, la hora de inicio es obligatoria"
}
```

#### b) 30-minute increment validation

```typescript
if (body.startTime && minutes_not_00_or_30) {
  return 400: "La hora de inicio debe ser en punto o a la media hora"
}
```

---

### 2. Conflict Detection GET - Single Check

**File:** `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts`

**GET /api/medical-records/tasks/conflicts**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `date` | Yes | Date string `"2026-01-30"` |
| `startTime` | Yes | `"09:00"` |
| `endTime` | Yes | `"10:00"` |
| `excludeTaskId` | No | Task ID to exclude (for edit scenarios) |

**What it does:**

1. Fetches appointment slots from the remote API for the given date
2. Filters slots where `status IN ('AVAILABLE', 'BOOKED')` AND overlap exists
3. Queries local Prisma DB for tasks where:
   - Same `doctorId`
   - Same `dueDate` (normalized)
   - `startTime IS NOT NULL` and `endTime IS NOT NULL`
   - `status IN ('PENDIENTE', 'EN_PROGRESO')`
   - Overlap formula matches (see [Overlap Formula](#overlap-formula))
4. Optionally excludes a specific task ID

**Response:**

```json
{
  "data": {
    "appointmentConflicts": [
      { "id": "slot_123", "date": "2026-01-30", "startTime": "09:00", "endTime": "10:00", "status": "AVAILABLE" }
    ],
    "taskConflicts": [
      { "id": "task_456", "title": "Revision lab", "dueDate": "2026-01-30", "startTime": "09:30", "endTime": "10:30", "status": "PENDIENTE", "priority": "ALTA" }
    ],
    "hasBookedAppointments": false
  }
}
```

---

### 3. Conflict Detection POST - Batch Check

**File:** `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts`

**POST /api/medical-records/tasks/conflicts**

Used by the voice batch flow and the CreateSlotsModal to check many time slots at once.

**Request body:**

```json
{
  "entries": [
    { "date": "2026-01-30", "startTime": "09:00", "endTime": "10:00" },
    { "date": "2026-01-30", "startTime": "10:00", "endTime": "11:00" },
    { "date": "2026-01-31", "startTime": "14:00", "endTime": "15:00" }
  ]
}
```

**What it does:**

Runs `checkConflictsForEntry()` for each entry in parallel using `Promise.all`. Each entry goes through the same logic as the GET endpoint.

**Response:**

```json
{
  "data": {
    "results": [
      {
        "index": 0,
        "appointmentConflicts": [...],
        "taskConflicts": [...],
        "hasBookedAppointments": false
      },
      {
        "index": 1,
        "appointmentConflicts": [],
        "taskConflicts": [],
        "hasBookedAppointments": false
      }
    ]
  }
}
```

---

### 4. Conflict Override POST

**File:** `apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts` (NEW)

**POST /api/medical-records/tasks/conflicts/override**

Cancels/blocks conflicting items so the new item can be created. This endpoint only handles the override -- the actual creation is a separate call afterward.

**Request body:**

```json
{
  "taskIdsToCancel": ["task_456", "task_789"],
  "slotIdsToBlock": ["slot_123"]
}
```

**What it does:**

1. **Tasks:** Runs `prisma.task.updateMany()` setting `status: 'CANCELADA'` and `completedAt: now()` for all matching task IDs that belong to the authenticated doctor and have status `IN ('PENDIENTE', 'EN_PROGRESO')`
2. **Slots:** For each slot ID, calls `PATCH /api/appointments/slots/{id}` on the remote API with `{ status: 'BLOCKED' }`. This endpoint already existed in the appointments API.

**Response:**

```json
{
  "success": true,
  "cancelledTasks": 2,
  "blockedSlots": 1
}
```

**Security:**
- `requireDoctorAuth()` ensures only the authenticated doctor can cancel their own tasks
- The `updateMany` WHERE clause includes `doctorId` to prevent cross-doctor cancellation
- Only tasks with active statuses (`PENDIENTE`, `EN_PROGRESO`) can be cancelled

---

## Frontend Components

### ConflictDialog Component

**File:** `apps/doctor/src/components/ConflictDialog.tsx` (NEW)

A reusable modal used by both the pendientes form and the CreateSlotsModal.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls modal visibility |
| `onClose` | `() => void` | Called when user clicks "Cancelar" or X button |
| `appointmentConflicts` | `AppointmentConflict[]` | List of conflicting appointment slots |
| `taskConflicts` | `TaskConflict[]` | List of conflicting tasks |
| `hasBookedAppointments` | `boolean` | Whether any conflict is a BOOKED slot |
| `onOverride` | `() => void` | Called when user clicks "Anular conflictos y crear" |
| `loading` | `boolean` | Shows spinner on override button during processing |

**UI Layout:**

```
┌─────────────────────────────────────────────┐
│ ⚠ Conflictos de horario detectados      [X] │  <- Yellow header
├─────────────────────────────────────────────┤
│                                             │
│ Citas (2)                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ 09:00 - 10:00    2026-01-30  [Disponible]│ │  <- Green badge
│ │ 10:00 - 11:00    2026-01-30  [🔒Reservada]│ │  <- Red badge + lock
│ └─────────────────────────────────────────┘ │
│                                             │
│ Pendientes (1)                              │
│ ┌─────────────────────────────────────────┐ │
│ │ Revision de lab                  [Alta] │ │  <- Priority badge
│ │ 09:30 - 10:30                          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 🔒 Hay citas reservadas que deben           │  <- Only shown if hasBookedAppointments
│    cancelarse manualmente...                │
│                                             │
├─────────────────────────────────────────────┤
│  [ Cancelar ]  [ Anular conflictos y crear ]│  <- Override disabled if BOOKED
└─────────────────────────────────────────────┘
```

---

### Pendientes New Task Form

**File:** `apps/doctor/src/app/dashboard/pendientes/new/page.tsx`

#### State Changes

New state variables added:

| State | Type | Purpose |
|-------|------|---------|
| `conflictDialogOpen` | `boolean` | Controls ConflictDialog visibility |
| `conflictData` | `ConflictData \| null` | Holds current conflict check results |
| `overrideLoading` | `boolean` | Loading state for override API call |
| `pendingSubmit` | `any` | Stores form data when blocked by conflicts |
| `batchConflictData` | `{ results, entries } \| null` | Stores batch conflict data for voice flow |

#### Form Validation

- Clearing `startTime` automatically clears `endTime`
- When `startTime` has a value, `endTime` shows a red `*` required indicator
- Submit validates the pairing before sending to API

#### Live Conflict Preview

A `useEffect` with 300ms debounce fires whenever `dueDate`, `startTime`, or `endTime` change. It calls `GET /api/medical-records/tasks/conflicts` and stores the result in `conflictData`.

If conflicts exist, a **yellow inline warning banner** appears in the form:

> "2 cita(s) y 1 pendiente(s) en conflicto. Al guardar podras anular los conflictos."

#### Submit Flow (Single Task)

```
User clicks "Guardar Tarea"
    │
    ├── Title empty? → Show error
    ├── startTime without endTime? → Show error
    ├── Conflicts exist? → Open ConflictDialog (block submit)
    │       │
    │       ├── User clicks "Cancelar" → Close dialog
    │       └── User clicks "Anular conflictos y crear"
    │               │
    │               ├── POST /conflicts/override (cancel tasks, block slots)
    │               └── POST /tasks (create the new task)
    │                       │
    │                       └── Redirect to /dashboard/pendientes
    │
    └── No conflicts → POST /tasks directly → Redirect
```

#### Voice Batch Flow

When the voice assistant returns batch data (`isBatch: true, entries: [...]`):

1. Filter entries that have `dueDate` + `startTime` + `endTime`
2. Call `POST /api/medical-records/tasks/conflicts` with those entries
3. If conflicts found:
   - Aggregate all `appointmentConflicts` and `taskConflicts` across all entries
   - Deduplicate by ID (same slot/task may conflict with multiple entries)
   - Show ConflictDialog with aggregated data
   - On override: cancel all conflicts, then create all entries
4. If no conflicts: create all entries directly
5. Entries without time ranges: always created without conflict checking

---

### CreateSlotsModal

**File:** `apps/doctor/src/app/appointments/CreateSlotsModal.tsx`

#### `generateSlotEntries()` Function

A new helper function that computes individual time slot entries from the modal's form parameters. This is needed because the modal form defines a **range** (e.g., 09:00-17:00 with 60min duration), but conflict checking needs individual slots.

```typescript
generateSlotEntries(
  mode: "single" | "recurring",  // Single date vs date range
  singleDate,                     // For single mode
  startDate, endDate,             // For recurring mode
  daysOfWeek: number[],           // [0,1,2,3,4] = Mon-Fri
  startTime, endTime,             // Daily time range "09:00"-"17:00"
  duration: 30 | 60,             // Slot duration in minutes
  hasBreak,                       // Break enabled?
  breakStart, breakEnd            // Break time range
): SlotEntry[]
```

**Example output** for single date 2026-01-30, 09:00-12:00, 60min, no break:

```json
[
  { "date": "2026-01-30", "startTime": "09:00", "endTime": "10:00" },
  { "date": "2026-01-30", "startTime": "10:00", "endTime": "11:00" },
  { "date": "2026-01-30", "startTime": "11:00", "endTime": "12:00" }
]
```

For recurring mode, it iterates each day in the range, checks if the day-of-week is selected, and generates slots for each matching day.

Break handling: any slot whose time range overlaps `[breakStart, breakEnd)` is skipped, and generation resumes at `breakEnd`.

#### Submit Flow

```
User clicks "Crear X Horarios"
    │
    ├── Validation (price, dates, days)
    │
    ├── generateSlotEntries() → compute all individual slots
    │
    ├── POST /conflicts (batch) with all entries
    │       │
    │       ├── Conflicts found → Aggregate, deduplicate, show ConflictDialog
    │       │       │
    │       │       ├── "Cancelar" → Close dialog
    │       │       └── "Anular conflictos y crear"
    │       │               ├── POST /conflicts/override
    │       │               └── authFetch POST /api/appointments/slots (remote API)
    │       │
    │       └── No conflicts → authFetch POST directly
    │
    └── Conflict check failed → Proceed with creation anyway (graceful degradation)
```

---

## Flow Diagrams

### Flow 1: Single Pendiente Creation

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐
│  Fill     │────>│  useEffect   │────>│  GET /conflicts│
│  Form     │     │  (debounce   │     │  ?date=...    │
│           │     │   300ms)     │     │  &startTime=  │
└──────────┘     └──────────────┘     └───────┬───────┘
                                              │
                                     ┌────────▼────────┐
                                     │  Conflicts?      │
                                     │  Show yellow     │
                                     │  warning banner  │
                                     └────────┬────────┘
                                              │
┌──────────┐                         ┌────────▼────────┐
│  Click   │────────────────────────>│  Has conflicts?  │
│  Submit  │                         │                  │
└──────────┘                         └───┬──────────┬──┘
                                    No   │          │ Yes
                                         │          │
                                ┌────────▼──┐  ┌────▼──────────┐
                                │  POST     │  │  Open          │
                                │  /tasks   │  │  ConflictDialog│
                                │  (create) │  │                │
                                └───────────┘  └────┬───────┬──┘
                                              Cancel│       │Override
                                                    │  ┌────▼──────────┐
                                              Close │  │POST /override │
                                                    │  │then POST /tasks│
                                                    │  └───────────────┘
                                               ┌────▼──┐
                                               │ Done  │
                                               └───────┘
```

### Flow 2: Batch Voice Pendiente Creation

```
┌──────────────┐     ┌─────────────────┐
│  Voice       │────>│  handleVoice    │
│  Assistant   │     │  Confirm()      │
│  returns     │     │                 │
│  isBatch +   │     │  Filter entries │
│  entries[]   │     │  with times     │
└──────────────┘     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │  POST /conflicts │
                     │  (batch)         │
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │  Any conflicts?  │
                     └───┬──────────┬──┘
                    No   │          │ Yes
                         │          │
                ┌────────▼──┐  ┌────▼──────────────┐
                │  Create   │  │  Aggregate +       │
                │  all      │  │  deduplicate       │
                │  entries  │  │  conflicts         │
                └───────────┘  │                    │
                               │  Show ConflictDialog│
                               └────┬───────┬──────┘
                              Cancel│       │Override
                                    │  ┌────▼──────────┐
                                    │  │POST /override  │
                                    │  │then create ALL │
                                    │  │entries         │
                                    │  └────────────────┘
                               ┌────▼──┐
                               │ Done  │
                               └───────┘
```

### Flow 3: Appointment Slot Creation

```
┌──────────────┐     ┌─────────────────────┐
│  Fill         │────>│  generateSlotEntries│
│  CreateSlots  │     │  ()                 │
│  Modal form   │     │  Compute all        │
│               │     │  individual slots   │
└──────────────┘     └────────┬────────────┘
                              │
                     ┌────────▼────────┐
                     │  POST /conflicts │
                     │  (batch) with    │
                     │  all slot entries│
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │  Any conflicts?  │
                     └───┬──────────┬──┘
                    No   │          │ Yes
                         │          │
                ┌────────▼──────┐  ┌────▼──────────┐
                │  authFetch    │  │  Show          │
                │  POST to      │  │  ConflictDialog│
                │  remote API   │  │                │
                │  /slots       │  └────┬───────┬──┘
                └───────────────┘ Cancel│       │Override
                                       │  ┌────▼────────────┐
                                       │  │POST /override    │
                                       │  │then authFetch    │
                                       │  │POST /slots       │
                                       │  └─────────────────┘
                                  ┌────▼──┐
                                  │ Done  │
                                  └───────┘
```

---

## Override Behavior

Override does NOT delete anything. It changes statuses:

| Item Type | Before Override | After Override | How |
|-----------|----------------|----------------|-----|
| Pendiente (task) | `PENDIENTE` or `EN_PROGRESO` | `CANCELADA` | `prisma.task.updateMany()` -- also sets `completedAt` to current timestamp |
| Appointment Slot | `AVAILABLE` | `BLOCKED` | `PATCH /api/appointments/slots/{id}` with `{ status: 'BLOCKED' }` via remote API |
| Appointment Slot | `BOOKED` | **Cannot be overridden** | Override button is disabled in the dialog |

The override endpoint only modifies items that:
- Belong to the authenticated doctor (`doctorId` check in WHERE clause)
- Have an active status (`PENDIENTE`/`EN_PROGRESO` for tasks)

After override succeeds, the frontend proceeds with the original creation action (POST the new task, or POST the new slots).

---

## BOOKED Slot Protection

Appointment slots with `status: 'BOOKED'` represent slots where a patient has already booked an appointment. These **cannot** be overridden through the conflict system.

When `hasBookedAppointments` is `true`:

1. The ConflictDialog shows a red warning: *"Hay citas reservadas que deben cancelarse manualmente antes de continuar."*
2. The "Anular conflictos y crear" button is **disabled** (`disabled={loading || hasBookedAppointments}`)
3. The doctor must go to the appointments system and manually cancel the booked appointment first
4. BOOKED slots are displayed with a red badge and a lock icon in the conflict list

This is determined by:

```typescript
const hasBookedAppointments = appointmentConflicts.some(
  (slot: any) => slot.status === 'BOOKED'
);
```

And on the override side, only `AVAILABLE` slots are collected for blocking:

```typescript
const slotIdsToBlock = conflictData.appointmentConflicts
  .filter(s => s.status === 'AVAILABLE')
  .map(s => s.id);
```

---

## Overlap Formula

Two time ranges overlap if and only if:

```
existingStart < newEnd  AND  existingEnd > newStart
```

This is applied in two places:

### 1. Appointment Slots (string comparison in JavaScript)

```typescript
appointmentConflicts = slots.filter((slot: any) => {
  const isActive = slot.status === 'AVAILABLE' || slot.status === 'BOOKED';
  const overlaps = slot.startTime < endTime && slot.endTime > startTime;
  return isActive && overlaps;
});
```

String comparison works because times are in `"HH:MM"` format (e.g., `"09:00" < "10:00"` is `true`).

### 2. Tasks (Prisma query)

```typescript
const taskWhere = {
  doctorId,
  dueDate: normalizeDate(date),
  startTime: { not: null },
  endTime: { not: null },
  status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
  AND: [
    { startTime: { lt: endTime } },   // existingStart < newEnd
    { endTime: { gt: startTime } },    // existingEnd > newStart
  ],
};
```

### Edge Cases

| Scenario | Overlap? |
|----------|----------|
| Existing 09:00-10:00, New 10:00-11:00 | **No** (adjacent, not overlapping) |
| Existing 09:00-10:00, New 09:30-10:30 | **Yes** |
| Existing 09:00-11:00, New 09:30-10:30 | **Yes** (contained) |
| Existing 09:00-10:00, New 08:00-11:00 | **Yes** (contains) |
| Existing 09:00-10:00, New 08:00-09:00 | **No** (adjacent) |
| Task with no times, New 09:00-10:00 | **No** (filtered out by `startTime: { not: null }`) |

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/doctor/src/app/api/medical-records/tasks/conflicts/override/route.ts` | POST endpoint to cancel tasks and block slots |
| `apps/doctor/src/components/ConflictDialog.tsx` | Reusable conflict dialog modal component |

### Modified Files

| File | Changes |
|------|---------|
| `apps/doctor/src/app/api/medical-records/tasks/route.ts` | Added `normalizeDate()`, 30-min validation, startTime/endTime pairing validation |
| `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts` | Added `normalizeDate()` for PUT dueDate updates |
| `apps/doctor/src/app/api/medical-records/tasks/calendar/route.ts` | Added `normalizeDate()` for date range filter and ISO conversion |
| `apps/doctor/src/app/api/medical-records/tasks/conflicts/route.ts` | Complete rewrite: added Prisma task conflict query, POST batch handler, `normalizeDate()`, new response shape |
| `apps/doctor/src/app/dashboard/pendientes/new/page.tsx` | Added ConflictDialog integration, blocking submit flow, batch voice conflict checking, time `<select>` dropdowns, startTime/endTime validation |
| `apps/doctor/src/app/appointments/CreateSlotsModal.tsx` | Added `generateSlotEntries()`, conflict check before creation, ConflictDialog integration, override flow, time `<select>` dropdowns |
