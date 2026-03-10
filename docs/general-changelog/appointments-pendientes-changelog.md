# Appointments & Pendientes — Changelog

## What is the Appointments section?

The **Appointments** (Citas) module lives at `apps/doctor/src/app/appointments/` (outside the dashboard layout). It is the doctor's scheduling and booking management workspace:

- **Calendar view** — month calendar with color-coded days; click any day to see its slots in the sidebar. Supports month navigation and a "Today" shortcut.
- **List view** — day-by-day or "all slots" table with bulk selection (open / close / delete multiple slots at once).
- **Slot management** — doctors create recurring or one-off appointment slots via `CreateSlotsModal`. Supports break times, discounts, and voice assistant pre-fill.
- **Booking management** — all patient bookings shown in a filterable table (by date, patient name/email, status). Status transitions: PENDING → CONFIRMED → COMPLETED / NO_SHOW / CANCELLED.
- **Agendar Cita** — doctor can manually book a patient via `BookPatientModal` (select existing slot or create a new one on the fly). Booking is auto-confirmed when scheduled by the doctor.
- **Voice / Chat IA** — `VoiceRecordingModal` + `VoiceChatSidebar` can pre-fill slot creation fields.

The section uses `useAppointmentsPage` hook (all state, logic, derived values) and renders two modal components. All API calls go to `apps/api` via `authFetch`.

---

## What is the Pendientes section?

The **Pendientes** (Tasks) module lives at `apps/doctor/src/app/dashboard/pendientes/`. It is the doctor's task management workspace:

- **Task list** (`/pendientes`) — filterable, searchable list of all tasks with status, priority, category badges. Supports bulk status updates.
- **New task** (`/pendientes/new`) — form to create a task with title, description, due date/time, priority, category, patient link, and conflict detection.
- **Task detail / edit** (`/pendientes/[id]`) — view and edit a task; conflict warnings shown for overlapping appointments or tasks.

Tasks use the `medical_records` DB schema. Priorities: ALTA / MEDIA / BAJA. Statuses: PENDIENTE / EN_PROGRESO / COMPLETADA / CANCELADA. Categories: SEGUIMIENTO / ADMINISTRATIVO / LABORATORIO / RECETA / REFERENCIA / PERSONAL / OTRO.

Conflict detection: task-task conflicts are BLOCKING (409); task-appointment conflicts are WARNING only.

Both sections have been previously refactored (hooks extracted, `alert()`/`confirm()` replaced with `toast`/`practiceConfirm`).

---

## Relationship — Similarities & Differences

### Similarities
| Aspect | Appointments | Pendientes |
|--------|-------------|------------|
| Calendar view | Month grid, day selection | Month grid, day selection |
| Shared data | Owns appointment slots | Fetches appointment slots for display |
| Conflict awareness | N/A | Warns when a task overlaps an appointment |
| Hook pattern | `useAppointmentsPage` | `usePendientesPage` |
| Bulk actions | Open / close / delete slots | Delete tasks |
| Date navigation | Day picker + prev/next | Day picker + prev/next |

### Key differences
| Aspect | Appointments | Pendientes |
|--------|-------------|------------|
| **Location** | `app/appointments/` (outside dashboard) | `app/dashboard/pendientes/` |
| **DB schema** | `public` (AppointmentSlot, Booking) | `medical_records` (Task) |
| **API target** | `apps/api` via `authFetch` | `apps/doctor` internal routes via `fetch` |
| **Primary entity** | Slots + Bookings (two-layer model) | Tasks (single entity) |
| **Patient relation** | Booking belongs to a patient | Task optionally linked to a patient |
| **Voice integration** | Pre-fills slot creation form | Pre-fills task creation form |
| **Conflict detection** | None | Blocking (task-task 409) + Warning (task-appointment) |

### Shared data flow
`fetchCalendarData` in `usePendientesPage` calls `/api/medical-records/tasks/calendar`, which returns **both** tasks and appointment slots for the selected month. The pendientes calendar renders them together on the same grid. This is the only place where the two sections share live data.

### Known type duplication (unfixed)
`usePendientesPage.ts` defines its own `AppointmentSlot` and `Booking` interfaces (lines 25–42) with shapes identical to the ones exported from `useAppointmentsPage.ts`. Same duplication problem fixed in `BookPatientModal.tsx` during the appointments audit. Should be fixed by importing from `useAppointmentsPage.ts`.

---

## Bug Audit & Fixes — Appointments — Date: 2026-03-10

### Bug 1 — Dead `bookingDate` state
**File:** `useAppointmentsPage.ts`

`const [bookingDate, setBookingDate]` was declared and included in the hook's return object but never destructured or used in `page.tsx`. Wasted state allocation on every render.

- **Fix:** Removed state declaration and its entry from the return object.

---

### Bug 2 — Silent failures in `fetchSlots` and `fetchBookings`
**File:** `useAppointmentsPage.ts`

Both functions caught fetch errors with `console.error` only. If either failed, the user saw an empty calendar or empty bookings list with no feedback — impossible to distinguish from "no data yet".

- **Fix:** Added `toast.error("Error al cargar los horarios")` and `toast.error("Error al cargar las citas")` to the respective catch blocks.

---

### Bug 3 — Native `fetch()` instead of `authFetch()` for booking creation
**File:** `BookPatientModal.tsx`

In the existing-slot booking flow, step 1 (create booking) used native `fetch()` with a manual `Content-Type` header and no auth token, while step 2 (confirm booking) immediately after used `authFetch()`. The comment said "public endpoint" but the doctor-initiated flow should be authenticated consistently with the rest of the file.

- **Fix:** Replaced `fetch()` with `authFetch()` and removed the redundant manual `Content-Type` header (`authFetch` handles it).

---

### Bug 4 — CONFIRMED and COMPLETED rendered with identical badge colors
**File:** `useAppointmentsPage.ts` — `getStatusColor()`

Both `"CONFIRMED"` and `"COMPLETED"` returned `bg-blue-100 text-blue-700 border-blue-200`. In the bookings table it was impossible to visually distinguish a completed appointment from a confirmed one.

- **Fix:** `COMPLETED` changed to `bg-green-100 text-green-700 border-green-200`.

---

### Bug 5 — Slot deleted even if booking cancellations failed
**File:** `useAppointmentsPage.ts` — `deleteSlot()`

When deleting a slot that had active bookings, the function looped over bookings and issued PATCH requests to cancel each one. Errors were swallowed (`console.error` only) and execution continued — the slot was deleted regardless of whether the cancellations succeeded, leaving orphaned active bookings on a non-existent slot.

- **Fix:** Each cancellation PATCH now checks `data.success`. On API failure or network error, a `toast.error` is shown and the function returns early — the slot is only deleted after all bookings are successfully cancelled.

---

### Inconsistency 6 — Duplicate `AppointmentSlot` interface
**File:** `BookPatientModal.tsx`

`AppointmentSlot` was defined locally in `BookPatientModal.tsx` with the exact same shape as the one already exported from `useAppointmentsPage.ts`. Any future shape change would require updating two places.

- **Fix:** Removed the local interface definition; `BookPatientModal.tsx` now imports `AppointmentSlot` from `./useAppointmentsPage`.

---

---

## Bug Audit & Fixes — Pendientes — Date: 2026-03-10

### Bug 1 — 3 debug `console.log` statements left in production
**File:** `usePendientesPage.ts` — `fetchCalendarData()`

Three `console.log` calls with emoji prefixes were left in the calendar data fetch function: one before the request, one logging the raw API response, and one logging the final parsed counts and slot objects. These were development debug logs that leaked internal data structures to the browser console in production.

- **Fix:** Removed all three `console.log` calls; the function now only retains the `console.error` in the catch block for actual errors.

---

### Bug 2 — `handleToggleComplete`: complete silence on failure
**File:** `usePendientesPage.ts`

The toggle-complete handler had `// silent fail` in its catch block, and no `else` branch for non-ok API responses. A network error or a 4xx/5xx response both produced zero user feedback — the task checkbox appeared to do nothing.

- **Fix:** Added `toast.error("Error al actualizar la tarea")` in both the catch block and a new `else` branch for non-ok responses.

---

### Bug 3 — `handleStatusChange`: complete silence on failure
**File:** `usePendientesPage.ts`

Identical pattern to Bug 2 — `// silent fail` in catch, no else branch. Changing a task's status dropdown would silently do nothing if the request failed.

- **Fix:** Added `toast.error("Error al actualizar el estado")` in both the catch block and a new `else` branch.

---

### Bug 4 — `handleDelete`: API-level errors silently ignored
**File:** `usePendientesPage.ts`

The delete handler correctly showed `toast.error("Error al eliminar")` for network errors (catch block), but had no `else` branch for non-ok API responses. A 4xx/5xx from the server left the task in the list with no feedback to the user.

- **Fix:** Added an `else` branch that reads `result.error` from the API response and shows it via `toast.error`.

---

### Bug 5 — `handleBulkDelete`: all-failure case produced no feedback
**File:** `usePendientesPage.ts`

When bulk deleting, individual failures were silently skipped (`// Continue with next`). If every delete failed, `deleted` stayed at 0, the UI didn't update, and no error was shown — the user had no way to know anything went wrong. Partial failures were also invisible.

- **Fix:** Added `toast.error("Error al eliminar las tareas")` when `deleted === 0`; added a separate `toast.error` when `deleted < idsToDelete.length` to surface partial failures.

---

### Bug 6 — `handleMarkComplete` in edit page: API error silently ignored
**File:** `[id]/edit/page.tsx`

When the "Marcar como Completada" button was pressed and the PUT request returned a non-ok response, no error was shown — the page just stayed put as if nothing happened. Only network-level throws reached the catch block (which did call `setError`).

- **Fix:** Added an `else` branch that reads `result.error` from the API response body and passes it to `setError`.

---

### Dead code 7 — `handleToggleComplete` and `tasks` returned from hook but never used
**File:** `usePendientesPage.ts`

`handleToggleComplete` and the raw `tasks` array were both included in the hook's return object but were never destructured in `page.tsx`. The page uses `visibleTasks` (a derived slice) and `stats` (derived counts) — both computed inside the hook — so the raw `tasks` export is redundant. `handleToggleComplete` had no call site in the page at all.

- **Fix:** Removed both from the return object.

---

## No remaining known issues ✓
