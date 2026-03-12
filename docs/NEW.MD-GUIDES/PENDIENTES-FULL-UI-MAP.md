# Pendientes Page — Full UI Interaction Map

**Date:** 2026-03-11
**Scope:** `apps/doctor/src/app/dashboard/pendientes/` — all pages, modals, hooks, API routes
**Related:** `PENDIENTES-UI-ACTIONS-MAP.md` (activity logging focus)

---

## Table of Contents

1. [Entry Points & Auth Guards](#1-entry-points--auth-guards)
2. [Page Header](#2-page-header)
3. [Stats Cards](#3-stats-cards)
4. [List View](#4-list-view)
5. [Calendar View](#5-calendar-view)
6. [Task Detail Modal (inline)](#6-task-detail-modal-inline)
7. [New Task Page](#7-new-task-page)
8. [View Task Page /id](#8-view-task-page-id)
9. [Edit Task Page /id/edit](#9-edit-task-page-idedit)
10. [Conflict Detection Flows](#10-conflict-detection-flows)
11. [Voice & Chat Integration](#11-voice--chat-integration)
12. [Status / Priority / Category Reference](#12-status--priority--category-reference)
13. [Business Rules & Constraints](#13-business-rules--constraints)
14. [All API Endpoints Summary](#14-all-api-endpoints-summary)

---

## 1. Entry Points & Auth Guards

| Condition | Behavior |
|---|---|
| `authStatus === "loading"` | Full-screen spinner |
| Not authenticated | Redirect to `/login` |
| `authStatus === "authenticated"` | `fetchTasks()` fires; `selectedIds` reset to empty Set |

**URL params handled on `/new` page:**
- `?chat=true` → auto-opens `TaskChatPanel`
- `?voice=true` → reads `sessionStorage.voiceTaskData`, calls `handleVoiceConfirm()` immediately

---

## 2. Page Header

Always visible regardless of view mode.

| Element | Action | Effect |
|---|---|---|
| **"Nueva Tarea"** (blue) | Click | Navigate to `/dashboard/pendientes/new` |
| **"Lista"** toggle | Click | `viewMode = "list"` |
| **"Calendario"** toggle | Click | `viewMode = "calendar"` — triggers `fetchCalendarData()` if not already loaded |

Active toggle: blue background + text. Inactive: gray background + border.

---

## 3. Stats Cards

Always visible. Calculated client-side from the `tasks` array (no extra API call).

| Card | Icon | Color | Calculation |
|---|---|---|---|
| **Pendientes** | CheckSquare | Blue | `tasks` where `status === "PENDIENTE" \|\| "EN_PROGRESO"` |
| **Vencidas** | AlertTriangle | Red | `tasks` where incomplete AND `dueDate < today` |
| **Para Hoy** | Clock | Yellow | `tasks` where `dueDate === today` |
| **Completadas (Semana)** | CheckCircle2 | Green | `tasks` where `status === "COMPLETADA"` AND `completedAt` within current Mon–Sun |

**Overdue rule:** status must NOT be `COMPLETADA` or `CANCELADA`; `dueDate` must be strictly before today (midnight local time via `parseLocalDate`).

---

## 4. List View

### 4.1 Filters

| Filter | Input | Options | Behavior |
|---|---|---|---|
| Status | Dropdown | `""` / `PENDIENTE` / `EN_PROGRESO` / `COMPLETADA` / `CANCELADA` | Changes `filterStatus` → `fetchTasks()` + `setSelectedIds(new Set())` |
| Priority | Dropdown | `""` / `ALTA` / `MEDIA` / `BAJA` | Same |
| Category | Dropdown | `""` / `SEGUIMIENTO` / `ADMINISTRATIVO` / `LABORATORIO` / `RECETA` / `REFERENCIA` / `PERSONAL` / `OTRO` | Same |

Filtering is server-side — each change triggers a new API call.

### 4.2 Bulk Action Bar

Appears when `selectedIds.size > 0`. Blue background.

| Element | Condition | Action |
|---|---|---|
| Count label | Always | "{N} tarea(s) seleccionada(s)" |
| **"Cancelar"** | Always | `setSelectedIds(new Set())` — clears selection |
| **"Eliminar"** (red, Trash2) | Disabled when `bulkDeleting` | See Bulk Delete flow §4.6 |

### 4.3 Day Navigator

| Element | Condition | Action |
|---|---|---|
| Date input | Always | Updates `listDate` (YYYY-MM-DD) |
| **← / →** arrows | Always | `listDate ±1 day`, clears selection |
| **"Hoy"** button | `listDate !== today` | Resets `listDate` to today |
| **"Ver todos"** | `!showAllTasks` | `showAllTasks = true`, clears selection |
| **"Por día"** | `showAllTasks` | `showAllTasks = false`, clears selection |
| Task count badge | Always | `visibleTasks.length` |

### 4.4 Task Rows — Mobile Cards (hidden on sm+)

Each card is a full-width row in a divided list.

| Element | Action |
|---|---|
| Card click | Opens task detail modal (`setViewingTask(task)`) |
| Checkbox (stops click propagation) | `toggleSelection(id)` |
| Edit icon (blue) | Navigate to `/dashboard/pendientes/{id}/edit` |
| Trash icon (red) | `handleDelete(id, title)` — see §4.5 |

**Card content:**
- Title (strikethrough if `COMPLETADA`)
- Priority badge + Category badge
- Due date (only if `showAllTasks === true`) — red bold if overdue
- Time range (only if `startTime && endTime`)
- Patient name (only if assigned)

### 4.5 Task Rows — Desktop Table (hidden on mobile)

Columns: [Checkbox] | Título | Fecha* | Hora Inicio | Hora Fin | Prioridad | Categoría | Estado | Paciente | Acciones

*Fecha column only shown when `showAllTasks === true`; overdue dates in red bold.

**Checkbox column header:** calls `toggleSelectAll()` — selects all `visibleTasks` if not all selected, deselects all otherwise.

**Selected rows:** light blue background.

**Estado column — inline status editor:**

| State | Behavior |
|---|---|
| Normal | Colored badge; click sets `editingStatusId = task.id` |
| Editing (`editingStatusId === task.id`) | Shows `<select>` dropdown with all 4 statuses |
| On `change` or `blur` | Calls `handleStatusChange(taskId, newStatus)` → `PUT /tasks/{id} { status }` → `fetchTasks()` on success |
| Error | `toast.error("Error al actualizar el estado")` |

**Acciones column:**
- Edit icon (blue): navigate to edit page
- Trash icon (red): `handleDelete(id, title)`

### 4.6 Single Delete Flow

```
handleDelete(id, title)
├─ practiceConfirm('¿Eliminar "{title}"?')
├─ User cancels → abort
└─ User confirms
    ├─ DELETE /api/medical-records/tasks/{id}
    ├─ Success → setTasks(prev => prev.filter(t => t.id !== id))
    │            + remove from selectedIds
    └─ Error → toast.error(result.error || "Error al eliminar")
```

### 4.7 Bulk Delete Flow

```
handleBulkDelete()
├─ Guard: selectedIds.size === 0 → return
├─ practiceConfirm('¿Eliminar {N} tarea(s) seleccionada(s)?')
├─ User cancels → abort
└─ User confirms → setBulkDeleting(true)
    ├─ DELETE /api/medical-records/tasks/bulk { taskIds: [...] }
    ├─ Success (res.ok)
    │   ├─ setTasks(prev => filter out selectedIds)
    │   └─ setSelectedIds(new Set())
    ├─ Error (API) → toast.error(result.error || "Error al eliminar las tareas")
    └─ Network error → toast.error("Error al eliminar las tareas")
    └─ finally → setBulkDeleting(false)
```

### 4.8 Empty States

| Condition | Message | Extra |
|---|---|---|
| `visibleTasks.length === 0 && showAllTasks` | "No hay pendientes" + "Crea tu primera tarea para empezar" | "Nueva Tarea" button |
| `visibleTasks.length === 0 && !showAllTasks` | "No hay tareas para este día" + "Navega a otro día o crea una nueva tarea" | "Nueva Tarea" button |

---

## 5. Calendar View

### 5.1 Month Navigation

| Element | Action |
|---|---|
| **"Ant."** button | Previous month; `setCurrentMonth(prev month)` → `fetchCalendarData()` |
| **"Hoy"** button | Current month |
| **"Sig."** button | Next month |

### 5.2 Calendar Grid

7-column grid (D L M M J V S). Day cells:

| Day State | Styling | Action |
|---|---|---|
| Selected | Yellow-600 bg, white text, bold | — |
| Today | Yellow-100 bg, yellow-700 text, semibold | Click → `setSelectedDate(date)` |
| Has tasks/slots | Yellow-200 bg, hover:yellow-300 | Click → `setSelectedDate(date)` |
| Empty future | Gray text, hover:gray-100 | Click → `setSelectedDate(date)` |
| Null (padding) | Empty cell | — |

Small dot indicator appears under day number when the day has content and is not selected.

### 5.3 Day Details Panel

Shown when `selectedDate !== null`. Loading state shows spinner + "Cargando calendario..."

**Empty state** (no tasks or slots): "Sin pendientes ni citas programadas"

**No date selected:** Calendar icon + "Selecciona un día para ver los detalles"

**Timeline — Timed items** (grouped by start time, sorted ascending):

Each time group shows: `startTime – endTime` with Clock icon. Items within the group:

| Item type | Border/bg | Content |
|---|---|---|
| **Task — no conflict** | Gray border | Status badge (purple "Pendiente") + Priority badge + Title (clickable → `/pendientes/{id}`) + Patient name if assigned |
| **Task — task conflict** | Red border, red bg | Same + ⚠️ "Conflicto con otro pendiente" |
| **Task — appointment overlap** | Blue border, blue bg | Same + ℹ️ "Cita reservada a esta hora" |
| **Appointment slot — normal** | Green badge "Cita" | Slot status badge + "{current}/{max} reservado(s)" + for each active booking: patientName, email, phone |
| **Appointment slot — overlaps task** | Blue border | Same + ℹ️ warning |

**Timeline — Untimed items** ("Sin hora específica" section, gray border):
- Tasks without `startTime`/`endTime` shown at bottom
- Same content as timed tasks minus time display

### 5.4 Conflict Detection Logic (calendar display only)

**Task-Task conflict** (visual only, data already saved):
- Two tasks on the same day with overlapping time ranges where both are `PENDIENTE` or `EN_PROGRESO`
- Both get red border + red bg + warning text

**Appointment-Task overlap** (informational):
- Task time overlaps with an appointment slot that has at least one active booking (not CANCELLED/COMPLETED/NO_SHOW)
- Task gets blue border + blue bg + info text

---

## 6. Task Detail Modal (inline)

Opened by clicking a task card in mobile list view (`setViewingTask(task)`).

**Overlay:** fixed, dark background, `z-50`.

### Content

| Section | Shown when | Content |
|---|---|---|
| Header | Always | Title (strikethrough if COMPLETADA), Priority + Status + Category badges, × close button |
| Description | `task.description` exists | Whitespace-pre-wrap text |
| Fecha | `task.dueDate` exists | Calendar icon + full date (es-MX weekday, day, month, year); "VENCIDA" badge if overdue |
| Horario | `task.startTime && task.endTime` | Clock icon + "HH:MM – HH:MM", or "Sin horario" |
| Paciente | `task.patient` exists | User icon + firstName + lastName |
| Metadata | Always | Creada + Actualizada timestamps |

### Footer Buttons

| Button | Action |
|---|---|
| **"Cerrar"** (gray) | `setViewingTask(null)` |
| **"Editar"** (blue) | Navigate to `/dashboard/pendientes/{id}/edit` |

---

## 7. New Task Page

**Route:** `/dashboard/pendientes/new`

### 7.1 Header

| Element | Action |
|---|---|
| "← Volver a Pendientes" link | Navigate back |
| **"Chat IA"** (indigo, Sparkles) | `setChatPanelOpen(true)` |

### 7.2 Form Fields

| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| Título | Text, maxLength=200 | Yes | `""` | Non-empty |
| Descripción | Textarea 3 rows | No | `""` | — |
| Fecha | `type="date"` | Yes | `""` | Must be provided |
| Hora de inicio | Dropdown (30-min steps) | Paired with endTime | `""` | Must be HH:00 or HH:30 |
| Hora de fin | Dropdown (30-min steps) | Paired with startTime | `""` | Must be HH:00 or HH:30; red asterisk shown when startTime has value |
| Prioridad | Select | No | `"MEDIA"` | ALTA / MEDIA / BAJA |
| Categoría | Select | No | `"OTRO"` | 7 options |
| Paciente | Search + Select | No | `""` | Search by firstName, lastName, or internalId |

**Time pairing behavior:**
- Clearing `startTime` also clears `endTime` (via `handleStartTimeChange`)
- Clearing `endTime` does NOT clear `startTime`
- `endTime` required asterisk appears when `startTime` has a value

### 7.3 Client-side Validation (handleSubmit)

Order of checks:
1. `title.trim()` empty → "El titulo es obligatorio"
2. `dueDate` empty → "La fecha es obligatoria"
3. `startTime && !endTime` → "Si se proporciona hora de inicio, la hora de fin es obligatoria"
4. `endTime && !startTime` → "Si se proporciona hora de fin, la hora de inicio es obligatoria"

### 7.4 Submit Flow

```
POST /api/medical-records/tasks
{
  title, description, dueDate, startTime, endTime,
  priority, category, patientId
}

├─ 409 (task-task conflict)
│   ├─ setTaskConflicts({ taskConflicts, error })
│   └─ setConflictDialogOpen(true)  ← shows conflict dialog
│
├─ 200 with { warning, bookedAppointments }
│   ├─ setSuccessMessage("Tarea creada exitosamente\n\n{warning}")
│   └─ setTimeout(3000) → navigate to /dashboard/pendientes
│
├─ 200 without warning
│   └─ navigate immediately to /dashboard/pendientes
│
└─ Other error
    └─ setError(result.error || "Error al crear la tarea")
```

### 7.5 Conflict Dialog

Shown when `conflictDialogOpen === true`.

| Element | Content |
|---|---|
| Title | "⚠️ Conflicto de Horario" |
| Error message | From `taskConflicts.error` |
| Conflict list | If `taskConflicts.taskConflicts.length > 0`: red bg section listing each task (title + date + time range) |
| Guidance | "Por favor, ajusta el horario de tu tarea o cancela el pendiente existente." |
| **"Cerrar"** button | `setConflictDialogOpen(false)` — form stays open, user can change times |

### 7.6 Batch Creation (Voice/Chat)

`executeBatchCreation(entries)` loops through `VoiceTaskData[]`:
- POSTs each task individually
- Tracks `successCount` and `failed[]`
- **Partial failure:** stays on page, shows error listing which tasks failed and why
- **Full success:** navigates to `/dashboard/pendientes`

### 7.7 Footer Buttons

| Button | Disabled when | Action |
|---|---|---|
| **"Cancelar"** (gray border) | Never | Navigate to list |
| **"Guardar Tarea"** (blue) | `saving === true` (shows spinner) | `handleSubmit()` |

---

## 8. View Task Page `/[id]`

**Route:** `/dashboard/pendientes/{id}`

### 8.1 Loading & Error States

| State | UI |
|---|---|
| Loading | Full-screen blue spinner |
| `res.ok === false` | Red error card + "Volver a Pendientes" link |
| `!task` after load | "Tarea no encontrada" |

### 8.2 Action Buttons (header)

| Button | Shown when | Disabled when | Action |
|---|---|---|---|
| **"Completar"** (green, CheckCircle2) | `status !== "COMPLETADA"` | `completing` | `handleMarkComplete()` → PUT `{ status: "COMPLETADA" }` → navigate to list |
| **"Editar"** (blue, Edit) | Always | Never | Link to `/dashboard/pendientes/{id}/edit` |
| **"Eliminar"** (red, Trash2) | Always | `deleting` | `handleDelete()` → confirm → DELETE → navigate to list |

**Delete confirm:** "¿Estás seguro de que quieres eliminar esta tarea?"

### 8.3 Detail Card Content

| Section | Shown when | Content |
|---|---|---|
| Descripción | `task.description` | `whitespace-pre-wrap` |
| Fecha | `task.dueDate` | Full date (weekday, day, month, year, es-MX) |
| Horario | `task.startTime && task.endTime` | "HH:MM - HH:MM" |
| Paciente | `task.patient` | "{firstName} {lastName}" |
| Completada | `status === "COMPLETADA" && task.completedAt` | Timestamp with hour+minute |
| Creada / Actualizada | Always | Locale timestamps (short date + hour:minute) |

---

## 9. Edit Task Page `/[id]/edit`

**Route:** `/dashboard/pendientes/{id}/edit`

### 9.1 Loading & Fetch

On mount (`authStatus === "authenticated"`): fetches task via `GET /api/medical-records/tasks/{id}` AND patient list via `GET /api/medical-records/patients?status=active` in parallel.

### 9.2 Fields

| Field | Editable | Notes |
|---|---|---|
| Título | Yes | Required, maxLength=200 |
| Descripción | Yes | Textarea, optional |
| Fecha | **No** | Disabled, gray bg; "La fecha no se puede modificar" |
| Hora de inicio | **No** | Disabled, gray bg |
| Hora de fin | **No** | Disabled, gray bg; "El horario no se puede modificar" |
| Prioridad | Yes | Select: ALTA / MEDIA / BAJA |
| Categoría | Yes | Select: 7 options |
| Estado | Yes | Select: PENDIENTE / EN_PROGRESO / COMPLETADA / CANCELADA |
| Paciente | Yes | Search + select, same as new task form |

**PUT payload sent:** `{ title, description, priority, category, status, patientId }` — dueDate, startTime, endTime are intentionally omitted.

### 9.3 Action Buttons

| Button | Condition / Disabled | Action |
|---|---|---|
| **"Marcar como Completada"** (green, header) | Only if `form.status !== "COMPLETADA"`; disabled when `saving` | PUT `{ status: "COMPLETADA" }` → navigate to list |
| **"Cancelar"** (gray border, footer) | Never | Link to `/dashboard/pendientes` |
| **"Guardar Cambios"** (blue, footer) | Disabled when `saving` (spinner) | `handleSubmit()` → PUT → navigate to list on success |

### 9.4 Submit Flow

```
PUT /api/medical-records/tasks/{id}
{ title, description, priority, category, status, patientId }

├─ 200 → navigate to /dashboard/pendientes
└─ Error → setError(result.error || "Error al actualizar la tarea")
```

Note: since dueDate/startTime/endTime are not sent, the conflict check on the backend uses `existing` values. If the task already has a time set, the PUT checks if the existing time conflicts with other tasks (excluding itself). This cannot be triggered from the edit UI since times are read-only.

---

## 10. Conflict Detection Flows

### 10.1 On Task Creation (POST)

```
if (dueDate && startTime && endTime && !skipConflictCheck)
│
├─ Task-Task check (BLOCKING → 409)
│   WHERE: same doctor, same dueDate, status IN [PENDIENTE, EN_PROGRESO],
│          has startTime+endTime, overlaps with new task
│   → Returns: { error, taskConflicts[] }
│   → Frontend: shows Conflict Dialog, form stays open
│
└─ Appointment overlap check (WARNING → 200)
    WHERE: fetches slots for same date from appointments API
           filters: currentBookings > 0 AND has PENDING/CONFIRMED bookings
           AND time overlaps with new task
    → Returns: { data, warning, bookedAppointments[] }
    → Frontend: shows success message WITH warning, then redirects after 3s
```

### 10.2 On Task Update (PUT)

Same logic as creation, but **excludes the current task from task-task check** (`id: { not: currentId }`). If conflict found → 409 (edit page currently does not show conflict dialog, shows generic error instead).

### 10.3 Calendar Visual Conflicts

Computed client-side from `calendarTasks` + `appointmentSlots`:

| Conflict type | Detection | Visual |
|---|---|---|
| Task vs Task | Two tasks same date, overlapping times, both PENDIENTE/EN_PROGRESO | Red border + red bg + "⚠️ Conflicto con otro pendiente" |
| Task vs Appointment | Task time overlaps slot with active booking | Blue border + blue bg + "ℹ️ Cita reservada a esta hora" |

---

## 11. Voice & Chat Integration

### 11.1 Voice Recording Flow

| Step | Trigger | Effect |
|---|---|---|
| 1. Open modal | Mic button (if doctorId exists) | `setModalOpen(true)` → `VoiceRecordingModal` opens |
| 2. Record | Speak | Audio transcribed, structured `VoiceTaskData` extracted |
| 3. Complete | Recording ends | `handleModalComplete()` → closes modal, opens `VoiceChatSidebar` with transcript + extracted data |
| 4. Refine | Sidebar conversation | Multi-turn LLM chat to correct/complete fields |
| 5. Confirm | "Confirmar" in sidebar | `handleVoiceConfirm(data)` |

### 11.2 handleVoiceConfirm branches

```
handleVoiceConfirm(data)
├─ If data.isBatch && data.entries.length > 0
│   └─ executeBatchCreation(data.entries)  ← immediate batch create, close sidebar
└─ Else (single task)
    ├─ accumulatedTasks.push(voiceData)
    └─ Close sidebar  ← user accumulates more tasks or opens Chat Panel
```

### 11.3 TaskChatPanel

Opened by "Chat IA" button or `?chat=true` URL param.

| Action | Effect |
|---|---|
| View accumulated tasks | Lists tasks from `accumulatedTasks` |
| Edit individual task in panel | `handleChatTaskUpdates(tasks)` → `setAccumulatedTasks(tasks)` |
| "Crear {N} Tareas" (batch submit) | `handleChatBatchCreate()` → `executeBatchCreation(accumulatedTasks)` → closes panel |

### 11.4 Cross-page Voice (from Dashboard Hub)

1. Dashboard stores voice data in `sessionStorage.voiceTaskData`
2. Navigates to `/dashboard/pendientes/new?voice=true`
3. Page reads sessionStorage on mount → removes key → calls `handleVoiceConfirm(data)`

---

## 12. Status / Priority / Category Reference

### Task Status

| Value | Label | Badge color | Notes |
|---|---|---|---|
| `PENDIENTE` | Pendiente | Yellow | Default; counts in "Para Hoy" and "Vencidas" |
| `EN_PROGRESO` | En Progreso | Blue | Counts in totalPending; blocks task-task conflicts |
| `COMPLETADA` | Completada | Green | Sets `completedAt`; strikethrough in lists; exempt from overdue |
| `CANCELADA` | Cancelada | Gray | Exempt from overdue; excluded from conflict checks |

### Priority

| Value | Badge color |
|---|---|
| `ALTA` | Red |
| `MEDIA` | Yellow (default) |
| `BAJA` | Green |

### Category

| Value | Label | Badge color |
|---|---|---|
| `SEGUIMIENTO` | Seguimiento | Blue |
| `ADMINISTRATIVO` | Administrativo | Purple |
| `LABORATORIO` | Laboratorio | Cyan |
| `RECETA` | Receta | Pink |
| `REFERENCIA` | Referencia | Indigo |
| `PERSONAL` | Personal | Orange |
| `OTRO` | Otro | Gray (default) |

---

## 13. Business Rules & Constraints

### Time Rules
- Times must be 30-minute increments (`HH:00` or `HH:30`) — validated on POST; PUT inherits existing times when not sent
- `startTime` and `endTime` must be provided together or both absent
- Clearing `startTime` in the new task form also clears `endTime`

### Editability Rules
- After creation: **date, startTime, endTime cannot be edited** (disabled in edit page UI; not sent in PUT payload)
- Editable: title, description, priority, category, status, patientId

### Completion Logic
- Status → `COMPLETADA`: server sets `completedAt = NOW`
- Status away from `COMPLETADA`: server sets `completedAt = null`
- `completedThisWeek` stat counts tasks completed within Mon–Sun of current week

### Conflict Rules

| Type | Scope | Result |
|---|---|---|
| Task-Task | Same doctor, same date, overlapping times, active status | **BLOCKING** — 409, creation/edit rejected |
| Task-Appointment | Task overlaps slot with PENDING/CONFIRMED booking | **WARNING** — task still created/updated, warning shown |
| CANCELADA/COMPLETADA tasks | Excluded from conflict detection | Never block new tasks |

### Bulk Delete
- Atomic: all IDs must belong to the doctor or entire request fails (403)
- Google Calendar events are synced (fire-and-forget) before `deleteMany`
- Logged as single bulk event in activity log

---

## 14. All API Endpoints Summary

| Method | Endpoint | Triggered By | Key Params |
|---|---|---|---|
| GET | `/api/medical-records/tasks` | Page load, filter change | `status`, `priority`, `category`, `startDate`, `endDate`, `patientId` |
| POST | `/api/medical-records/tasks` | New task form submit, batch voice | body: `{ title, dueDate, startTime, endTime, priority, category, patientId, skipConflictCheck? }` |
| GET | `/api/medical-records/tasks/{id}` | View page, Edit page load | — |
| PUT | `/api/medical-records/tasks/{id}` | Edit page submit, status dropdown change, "Completar" button | body: any subset of task fields |
| DELETE | `/api/medical-records/tasks/{id}` | Trash icon (single), "Completar"-then-delete, View page delete | — |
| DELETE | `/api/medical-records/tasks/bulk` | Bulk delete button | body: `{ taskIds: string[] }` |
| GET | `/api/medical-records/tasks/calendar` | Calendar view, month navigation | `startDate`, `endDate` |
| GET | `/api/medical-records/patients?status=active` | New task page, Edit page | — |

### Response Shapes

| Endpoint | Success | Notable Errors |
|---|---|---|
| GET /tasks | `{ data: Task[] }` | 500 |
| POST /tasks | `{ data: Task, warning?, bookedAppointments? }` | 400 (validation), 409 (conflict) |
| GET /tasks/{id} | `{ data: Task }` | 404 |
| PUT /tasks/{id} | `{ data: Task, warning?, bookedAppointments? }` | 404, 409 (conflict) |
| DELETE /tasks/{id} | `{ success: true }` | 404 |
| DELETE /tasks/bulk | `{ success: true, deletedCount: N }` | 400 (bad input), 403 (ownership) |
| GET /tasks/calendar | `{ data: { tasks: Task[], appointmentSlots: Slot[] } }` | 400 (missing dates) |

### Side Effects per Endpoint

| Endpoint | Activity Log | Google Calendar |
|---|---|---|
| POST /tasks | `logTaskCreated()` | `syncTaskCreated()` (fire-and-forget) |
| PUT /tasks/{id} — status → COMPLETADA | `logTaskCompleted()` | `syncTaskUpdated()` (fire-and-forget) |
| PUT /tasks/{id} — other status change | `logTaskStatusChanged()` | `syncTaskUpdated()` (fire-and-forget) |
| PUT /tasks/{id} — field update | `logTaskUpdated()` | `syncTaskUpdated()` (fire-and-forget) |
| DELETE /tasks/{id} | `logTaskDeleted()` | `syncTaskDeleted()` (fire-and-forget) |
| DELETE /tasks/bulk | `logTaskBulkDeleted()` | `syncTaskDeleted()` per task (fire-and-forget) |

---

## Document Metadata

- **Author:** AI Assistant (Claude)
- **Created:** 2026-03-11
- **Files analyzed:** `page.tsx`, `usePendientesPage.ts`, `new/page.tsx`, `new/useNewTask.ts`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `tasks/route.ts`, `tasks/[id]/route.ts`, `tasks/bulk/route.ts`, `tasks/calendar/route.ts`
- **Bug fixes reflected:** stale closure in handleDelete, bulk delete now uses bulk endpoint (atomic), bulk endpoint now syncs Google Calendar events
