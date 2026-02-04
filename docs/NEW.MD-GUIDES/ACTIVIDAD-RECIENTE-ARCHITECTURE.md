# Actividad Reciente - Full Architecture Reference

**Purpose:** Complete technical reference for the "Actividad Reciente" (Recent Activity) system that tracks and displays user actions on the main dashboard. Use this document as the single source of truth when extending activity logging to new sections of the app.

**Date Created:** February 3, 2026
**Current Scope:** Tasks (Pendientes) only
**Planned Expansion:** Appointments, Bookings, Prescriptions, Patients, Billing

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Layer](#2-database-layer)
3. [Activity Logger Service](#3-activity-logger-service)
4. [API Endpoints](#4-api-endpoints)
5. [Frontend Components](#5-frontend-components)
6. [Integration Pattern (How Logging is Wired Into APIs)](#6-integration-pattern)
7. [Data Flow Diagram](#7-data-flow-diagram)
8. [Current Action Types & Display Config](#8-current-action-types--display-config)
9. [How to Extend to a New Section](#9-how-to-extend-to-a-new-section)
10. [File Location Index](#10-file-location-index)

---

## 1. Architecture Overview

The system has four layers:

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND                                                    │
│  RecentActivityTable component on /dashboard                 │
│  Fetches GET /api/activity-logs → renders table              │
├──────────────────────────────────────────────────────────────┤
│  FETCH API                                                   │
│  GET /api/activity-logs                                      │
│  Reads from activity_logs table, scoped by doctorId          │
├──────────────────────────────────────────────────────────────┤
│  LOGGER SERVICE                                              │
│  apps/doctor/src/lib/activity-logger.ts                      │
│  Called from API endpoints AFTER a business action succeeds  │
│  Non-blocking: errors are caught and logged, never thrown    │
├──────────────────────────────────────────────────────────────┤
│  DATABASE                                                    │
│  activity_logs table (Prisma model: ActivityLog)             │
│  Indexed by (doctor_id, timestamp), action_type, entity_type │
└──────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Non-blocking logging:** All `logActivity()` calls are wrapped in try/catch. If logging fails, the main API operation still succeeds. This means activity logging never breaks business functionality.
- **Doctor-scoped:** Every log entry belongs to a doctor via `doctorId`. The GET endpoint filters by the authenticated doctor, so each doctor only sees their own activity.
- **Flexible metadata:** A `Json` field stores context-specific data (task title, priority, patient name, changed fields, etc.) without requiring schema changes per entity type.
- **Pre-formatted display messages:** The `displayMessage` field stores the final Spanish-language text shown in the UI. The frontend does not build messages — it renders them as-is.
- **Icon/color as strings:** The logger stores Lucide icon names (`"CheckSquare"`, `"Trash2"`) and Tailwind color keys (`"blue"`, `"red"`) as strings. The frontend maps these to actual components and CSS classes.

---

## 2. Database Layer

### Prisma Model

**File:** `packages/database/prisma/schema.prisma` (lines 359-396)

```prisma
model ActivityLog {
  id              String   @id @default(cuid())
  doctorId        String   @map("doctor_id")

  // Action metadata
  actionType      String   @map("action_type") @db.VarChar(50)
  entityType      String   @map("entity_type") @db.VarChar(50)
  entityId        String?  @map("entity_id")

  // Display information
  displayMessage  String   @map("display_message") @db.VarChar(500)
  icon            String?  @db.VarChar(50)
  color           String?  @db.VarChar(20)

  // Context data (JSON)
  metadata        Json?

  // User who performed the action
  userId          String?  @map("user_id")

  // Timestamp
  timestamp       DateTime @default(now())

  // Relations
  doctor          Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@index([doctorId, timestamp])
  @@index([actionType])
  @@index([entityType])
  @@map("activity_logs")
  @@schema("public")
}
```

### Column Reference

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | String (cuid) | Yes | Primary key |
| `doctorId` | String | Yes | FK to `doctors.id`, cascading delete |
| `actionType` | VarChar(50) | Yes | e.g. `TASK_CREATED`, `APPOINTMENT_BOOKED` |
| `entityType` | VarChar(50) | Yes | e.g. `TASK`, `APPOINTMENT`, `PATIENT` |
| `entityId` | String | No | ID of the affected entity (null for bulk ops) |
| `displayMessage` | VarChar(500) | Yes | Pre-formatted Spanish message for the UI |
| `icon` | VarChar(50) | No | Lucide icon name string |
| `color` | VarChar(20) | No | Tailwind color key (`blue`, `green`, `red`, etc.) |
| `metadata` | Json | No | Arbitrary context data |
| `userId` | String | No | User who performed the action |
| `timestamp` | DateTime | Yes | Auto-set to `now()` |

### Indexes

- `(doctorId, timestamp)` — primary retrieval query (latest activity per doctor)
- `(actionType)` — filtering by action type
- `(entityType)` — filtering by entity type

### Migration

**File:** `packages/database/prisma/migrations/add-activity-log-table.sql`

---

## 3. Activity Logger Service

**File:** `apps/doctor/src/lib/activity-logger.ts`

### Types

```typescript
export type ActivityActionType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_COMPLETED"
  | "TASK_DELETED"
  | "TASK_BULK_DELETED"
  | "TASK_STATUS_CHANGED"
  | "TASK_CANCELLED";

export type ActivityEntityType =
  | "TASK"
  | "APPOINTMENT"
  | "BOOKING"
  | "PRESCRIPTION"
  | "PATIENT";
```

> **To extend:** Add new values to both unions (e.g. `"APPOINTMENT_CREATED"` to `ActivityActionType`, entity type is already there).

### Core Function: `logActivity()`

```typescript
interface LogActivityParams {
  doctorId: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId?: string;
  displayMessage: string;
  icon?: string;
  color?: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await prisma.activityLog.create({ data: { ...params } });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw - logging should not break the main operation
  }
}
```

### Specialized Task Logger Functions

Each function builds a `displayMessage` and calls `logActivity()`:

| Function | actionType | Icon | Color | Message Format |
|----------|-----------|------|-------|----------------|
| `logTaskCreated()` | `TASK_CREATED` | `CheckSquare` | `blue` | `"Nueva tarea: {title} (Paciente: {name})"` |
| `logTaskUpdated()` | `TASK_UPDATED` | `Edit` | `blue` | `"Tarea actualizada: {title} (field1, field2)"` |
| `logTaskCompleted()` | `TASK_COMPLETED` | `CheckCircle2` | `green` | `"Tarea completada: {title} (Paciente: {name})"` |
| `logTaskDeleted()` | `TASK_DELETED` | `Trash2` | `red` | `"Tarea eliminada: {title}"` |
| `logTaskBulkDeleted()` | `TASK_BULK_DELETED` | `Trash2` | `red` | `"Eliminadas {count} tarea(s) en lote"` |
| `logTaskStatusChanged()` | `TASK_STATUS_CHANGED` | `ArrowRightLeft` | `blue`/`green` | `"Tarea \"{title}\": {old} → {new}"` |

### Helper Functions

- **`getCategoryDisplayName(code)`** — Maps `SEGUIMIENTO` → `"Seguimiento"`, `ADMINISTRATIVO` → `"Administrativo"`, etc.
- **`getStatusDisplayName(code)`** — Maps `PENDIENTE` → `"Pendiente"`, `EN_PROGRESO` → `"En Progreso"`, etc.

### Metadata Structure (for tasks)

```typescript
{
  taskTitle: string;
  priority?: "ALTA" | "MEDIA" | "BAJA";
  priorityText?: "Alta" | "Media" | "Baja";
  category?: string;
  categoryText?: string;
  patientName?: string;
  dueDate?: string;           // ISO format
  changedFields?: string[];   // For updates
  oldStatus?: string;         // For status changes
  newStatus?: string;
  count?: number;             // For bulk operations
}
```

---

## 4. API Endpoints

### GET /api/activity-logs

**File:** `apps/doctor/src/app/api/activity-logs/route.ts`

**Auth:** `requireDoctorAuth(request)` — extracts `doctorId` from session.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `20` | Number of records to return |
| `offset` | `0` | Pagination offset |
| `actionType` | — | Filter by action type (e.g. `TASK_CREATED`) |
| `entityType` | — | Filter by entity type (e.g. `TASK`) |

**Response:**

```json
{
  "data": [
    {
      "id": "clxyz...",
      "actionType": "TASK_CREATED",
      "entityType": "TASK",
      "entityId": "clxyz...",
      "displayMessage": "Nueva tarea: Revisión de resultados",
      "icon": "CheckSquare",
      "color": "blue",
      "metadata": { "taskTitle": "...", "priority": "ALTA" },
      "timestamp": "2026-02-03T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Implementation:**

```typescript
const [activities, total] = await Promise.all([
  prisma.activityLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  }),
  prisma.activityLog.count({ where }),
]);
```

---

## 5. Frontend Components

### Dashboard Page

**File:** `apps/doctor/src/app/dashboard/page.tsx` (lines 151-159)

```tsx
{/* Actividad Reciente */}
<div className="bg-white rounded-lg shadow">
  <div className="p-4 sm:p-6 border-b border-gray-200">
    <h2 className="text-lg font-semibold text-gray-900">Actividad Reciente</h2>
  </div>
  <div className="p-4 sm:p-6">
    <RecentActivityTable limit={10} />
  </div>
</div>
```

### RecentActivityTable Component

**File:** `apps/doctor/src/components/RecentActivityTable.tsx`

**Props:** `{ limit?: number }` (default: 10)

**Behavior:**
- Client component (`"use client"`)
- Fetches `GET /api/activity-logs?limit={limit}` on mount via `useEffect`
- Three states: loading (spinner), error (red message), empty (heart icon + "No hay actividad reciente")

**Icon Mapping (string → Lucide component):**

```typescript
const iconMap: Record<string, React.ElementType> = {
  CheckSquare,   // Task created
  Edit,          // Task updated
  CheckCircle2,  // Task completed
  Trash2,        // Task deleted
  ArrowRightLeft,// Status changed
  Heart,         // Fallback
};
```

> **To extend:** Import new Lucide icons and add entries here when adding new entity types.

**Color Mapping (string → Tailwind classes):**

```typescript
const colorMap: Record<string, string> = {
  blue:   "text-blue-600 bg-blue-100",
  green:  "text-green-600 bg-green-100",
  red:    "text-red-600 bg-red-100",
  yellow: "text-yellow-600 bg-yellow-100",
  purple: "text-purple-600 bg-purple-100",
  gray:   "text-gray-600 bg-gray-100",
};
```

**Table Columns:**

| Column | Visibility | Content |
|--------|-----------|---------|
| Accion | Always | Icon + `displayMessage` |
| Tipo | Hidden on mobile (`hidden sm:table-cell`) | `entityType` badge |
| Fecha | Always | Relative time via `formatDistanceToNow(timestamp, { locale: es })` |

**Date formatting:** Uses `date-fns` with Spanish locale. Output: "hace 2 horas", "hace 1 dia", etc.

---

## 6. Integration Pattern

This is the pattern used to wire activity logging into any API endpoint. The task endpoints serve as the reference implementation.

### Pattern: Log After Successful Mutation

```
1. Authenticate request → get doctorId
2. Validate input
3. (For updates/deletes) Fetch existing record BEFORE mutation (needed for logging old values)
4. Perform the database mutation (create/update/delete)
5. Call the appropriate log function AFTER the mutation succeeds
6. Return the API response
```

### Example: Task Creation

**File:** `apps/doctor/src/app/api/medical-records/tasks/route.ts` (lines 207-216)

```typescript
// Step 4: Create the task
const task = await prisma.task.create({ data: { ... }, include: { patient: true } });

// Step 5: Log the activity (after success)
await logTaskCreated({
  doctorId,
  taskId: task.id,
  taskTitle: task.title,
  priority: task.priority,
  category: task.category,
  dueDate: task.dueDate || undefined,
  patientName: task.patient ? `${task.patient.firstName} ${task.patient.lastName}` : undefined,
});
```

### Example: Task Update (Smart Branching)

**File:** `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts` (lines 187-219)

The update endpoint uses branching logic to log the most specific action:

```typescript
const changedFields = Object.keys(updateData).filter(key => key !== 'completedAt');

if (body.status === 'COMPLETADA' && existing.status !== 'COMPLETADA') {
  // Priority 1: Completion is a distinct action
  await logTaskCompleted({ ... });
}
else if (body.status !== undefined && existing.status !== body.status) {
  // Priority 2: Status change (non-completion)
  await logTaskStatusChanged({ ..., oldStatus: existing.status, newStatus: body.status });
}
else if (changedFields.length > 0) {
  // Priority 3: General field update
  await logTaskUpdated({ ..., changedFields });
}
```

**Key insight:** The branching ensures only ONE log entry per API call, choosing the most meaningful action. A status change to "COMPLETADA" logs as a completion, not as a generic update.

### Example: Task Deletion (Fetch Before Delete)

**File:** `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts` (lines 243-262)

```typescript
// Step 3: Fetch BEFORE deleting (need title, priority, etc. for the log message)
const existing = await prisma.task.findFirst({ where: { id, doctorId } });

// Step 4: Delete
await prisma.task.delete({ where: { id } });

// Step 5: Log with the data we fetched before deletion
await logTaskDeleted({
  doctorId,
  taskId: id,
  taskTitle: existing.title,
  priority: existing.priority,
  category: existing.category,
  dueDate: existing.dueDate || undefined,
});
```

### Example: Bulk Delete

**File:** `apps/doctor/src/app/api/medical-records/tasks/bulk/route.ts` (lines 44-48)

```typescript
await prisma.task.deleteMany({ where: { id: { in: body.taskIds }, doctorId } });

await logTaskBulkDeleted({
  doctorId,
  count: body.taskIds.length,
});
```

---

## 7. Data Flow Diagram

```
USER ACTION (e.g. clicks "Guardar Tarea")
         │
         ▼
┌─────────────────────────────────┐
│  Frontend Form / Button Click   │
│  POST/PUT/DELETE fetch()        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Next.js API Route Handler      │
│  e.g. POST /api/.../tasks       │
│                                 │
│  1. requireDoctorAuth()         │
│  2. Validate body               │
│  3. prisma.task.create(...)     │──────► tasks table (main data)
│  4. logTaskCreated(...)         │──────► activity_logs table (audit)
│  5. return NextResponse.json()  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Frontend receives response     │
│  Shows success toast / redirect │
└─────────────────────────────────┘

            ... later ...

┌─────────────────────────────────┐
│  Dashboard page loads           │
│  <RecentActivityTable />        │
│  GET /api/activity-logs?limit=10│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  activity_logs table            │
│  WHERE doctorId = ?             │
│  ORDER BY timestamp DESC        │
│  LIMIT 10                       │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  RecentActivityTable renders    │
│  Icon + displayMessage + time   │
└─────────────────────────────────┘
```

---

## 8. Current Action Types & Display Config

| actionType | entityType | Icon | Color | Display Message Format |
|---|---|---|---|---|
| `TASK_CREATED` | `TASK` | `CheckSquare` | `blue` | `Nueva tarea: {title} (Paciente: {name})` |
| `TASK_UPDATED` | `TASK` | `Edit` | `blue` | `Tarea actualizada: {title} ({fields})` |
| `TASK_COMPLETED` | `TASK` | `CheckCircle2` | `green` | `Tarea completada: {title} (Paciente: {name})` |
| `TASK_DELETED` | `TASK` | `Trash2` | `red` | `Tarea eliminada: {title}` |
| `TASK_BULK_DELETED` | `TASK` | `Trash2` | `red` | `Eliminadas {count} tarea(s) en lote` |
| `TASK_STATUS_CHANGED` | `TASK` | `ArrowRightLeft` | `blue`/`green` | `Tarea "{title}": {old} → {new}` |
| `TASK_CANCELLED` | `TASK` | — | — | *(Defined in types but not yet implemented)* |

---

## 9. How to Extend to a New Section

Follow these steps to add activity logging for a new section (e.g. Appointments):

### Step 1: Update Types in `activity-logger.ts`

Add new action types to `ActivityActionType`:

```typescript
export type ActivityActionType =
  | "TASK_CREATED" | "TASK_UPDATED" | ...
  // Add new ones:
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_UPDATED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_COMPLETED";
```

The `ActivityEntityType` union already includes `"APPOINTMENT"`, `"BOOKING"`, `"PRESCRIPTION"`, `"PATIENT"`. Add new values if needed.

### Step 2: Create Specialized Logger Functions

Follow the existing pattern — one function per action:

```typescript
export async function logAppointmentCreated(params: {
  doctorId: string;
  appointmentId: string;
  patientName: string;
  date: Date;
  // ... relevant fields
}) {
  await logActivity({
    doctorId: params.doctorId,
    actionType: "APPOINTMENT_CREATED",
    entityType: "APPOINTMENT",
    entityId: params.appointmentId,
    displayMessage: `Nueva cita: ${params.patientName} - ${formatDate(params.date)}`,
    icon: "Calendar",       // Lucide icon name
    color: "purple",        // Tailwind color key
    metadata: { ... },
  });
}
```

### Step 3: Wire Into API Endpoints

In the relevant API route handler, import and call the logger after the mutation:

```typescript
import { logAppointmentCreated } from '@/lib/activity-logger';

// After prisma.appointment.create():
await logAppointmentCreated({
  doctorId,
  appointmentId: appointment.id,
  patientName: `${patient.firstName} ${patient.lastName}`,
  date: appointment.date,
});
```

### Step 4: Update Frontend Icon Map

In `RecentActivityTable.tsx`, import any new Lucide icons and add to the map:

```typescript
import { Calendar, ... } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  ...existing,
  Calendar,        // For appointments
  FileText,        // For prescriptions
  UserPlus,        // For patients
};
```

### Step 5: No Database Changes Needed

The `activity_logs` table schema is generic. The `actionType` and `entityType` are plain strings, and `metadata` is a JSON field. No migration is needed to add new entity types.

---

## 10. File Location Index

| Component | File Path |
|-----------|-----------|
| **Prisma Model** | `packages/database/prisma/schema.prisma` (lines 359-396) |
| **DB Migration** | `packages/database/prisma/migrations/add-activity-log-table.sql` |
| **Logger Service** | `apps/doctor/src/lib/activity-logger.ts` |
| **Fetch API (GET)** | `apps/doctor/src/app/api/activity-logs/route.ts` |
| **Task Create API** | `apps/doctor/src/app/api/medical-records/tasks/route.ts` |
| **Task Update/Delete API** | `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts` |
| **Task Bulk Delete API** | `apps/doctor/src/app/api/medical-records/tasks/bulk/route.ts` |
| **Dashboard Page** | `apps/doctor/src/app/dashboard/page.tsx` |
| **Table Component** | `apps/doctor/src/components/RecentActivityTable.tsx` |
| **Pendientes Action Map** | `docs/NEW.MD-GUIDES/PENDIENTES-UI-ACTIONS-MAP.md` |

---

## Document Metadata

- **Author:** AI Assistant
- **Created:** February 3, 2026
- **Status:** Complete
- **Related:** `PENDIENTES-UI-ACTIONS-MAP.md` (action-level detail for the Pendientes section)
