# Appointments Page — Full UI Interaction Map

**Date:** 2026-03-11
**Scope:** `apps/doctor/src/app/appointments/` — all pages, modals, hooks
**Related:** `CITAS-UI-ACTIONS-MAP.md` (activity logging focus)

---

## Table of Contents

1. [Entry Points & Auth Guards](#1-entry-points--auth-guards)
2. [Page Header](#2-page-header)
3. [Todas las Citas Section](#3-todas-las-citas-section)
4. [Calendar View](#4-calendar-view)
5. [List View](#5-list-view)
6. [Slot Deletion Flow](#6-slot-deletion-flow)
7. [CreateSlotsModal](#7-createslotsmodal)
8. [BookPatientModal](#8-bookpatientmodal)
9. [Booking Status State Machine](#9-booking-status-state-machine)
10. [Voice Assistant Integration](#10-voice-assistant-integration)
11. [All API Endpoints Summary](#11-all-api-endpoints-summary)

---

## 1. Entry Points & Auth Guards

| Condition | Behavior |
|---|---|
| `authStatus === "loading"` | Full-screen spinner |
| Not authenticated | Redirect to `/login` |
| No `doctorId` in session | Error: "No hay perfil de médico vinculado a tu cuenta." No actions possible. |
| Valid session | Full page renders; `fetchSlots()` + `fetchBookings()` fire immediately |

**Data scope:** Both slots and bookings are fetched scoped to the current calendar month (`selectedDate`). Month navigation re-fetches both.

---

## 2. Page Header

Always visible regardless of view mode.

| Element | Action | Effect |
|---|---|---|
| **"Agendar Cita"** (green, CalendarPlus icon) | Click | Opens `BookPatientModal` with no pre-selected slot → starts at Step 1 |
| **"Crear Horarios"** (blue, Plus icon) | Click | Opens `CreateSlotsModal` with empty form |
| **"Calendario"** toggle | Click | `viewMode = "calendar"` |
| **"Lista"** toggle | Click | `viewMode = "list"` |

Active view toggle: blue background + text. Inactive: white background + gray border.

---

## 3. Todas las Citas Section

Always rendered below the header, regardless of view mode.

### 3.1 Collapse Toggle

ChevronDown icon in section header collapses/expands the entire bookings panel. Icon rotates 180° when collapsed.

### 3.2 Filters (when expanded)

| Filter | Input Type | Behavior | Edge Cases |
|---|---|---|---|
| **Date** | `type="date"` + ← → arrows | ← → shift date ±1 day via `shiftBookingFilterDate()`; "Todas" button clears filter | "Todas" button only shown when a date is selected |
| **Patient search** | Text input | Substring match on `patientName` OR `patientEmail`, case-insensitive | Empty string = no filter |
| **Status** | Dropdown | Options: `""` / `PENDING` / `CONFIRMED` / `CANCELLED` / `COMPLETED` / `NO_SHOW` | `""` = all statuses |
| **Clear all** | Button | Resets all three filters to defaults | Only shown when at least one filter is active |

Filtering is client-side only — no API call on filter change.

### 3.3 Booking Row Actions

Shown in both mobile (card layout) and desktop (table layout).

| Booking Status | Available Actions |
|---|---|
| `PENDING` | **Confirmar** → `CONFIRMED` · **Cancelar** → `CANCELLED` (confirm dialog) · 🗑 Delete |
| `CONFIRMED` | **Completada** → `COMPLETED` · **No asistió** → `NO_SHOW` · **Cancelar** → `CANCELLED` (confirm dialog) · 🗑 Delete |
| `CANCELLED` | 🗑 Delete only |
| `COMPLETED` | 🗑 Delete only |
| `NO_SHOW` | 🗑 Delete only |

**Cancel confirm dialog:** "¿Estás seguro de que quieres cancelar esta cita?"

**Delete booking confirm:** "¿Eliminar la cita de {name}? También se eliminará el horario asociado. Esta acción no se puede deshacer."
→ `DELETE /api/appointments/bookings/{id}` — deletes booking AND its associated slot atomically.

### 3.4 Booking Status Colors

| Status | Color |
|---|---|
| `CONFIRMED` | Blue (`bg-blue-100 text-blue-700`) |
| `PENDING` | Yellow (`bg-yellow-100 text-yellow-700`) |
| `CANCELLED` | Red (`bg-red-100 text-red-700`) |
| `COMPLETED` | Green (`bg-green-100 text-green-700`) |
| `NO_SHOW` | Orange (`bg-orange-100 text-orange-700`) |

### 3.5 Booking Row Info Fields

| Field | Shown | Notes |
|---|---|---|
| Patient name | Always | Bold in header |
| Date + time | Always | Slot date + startTime–endTime |
| Service name | If `serviceName` exists | Blue text |
| "1ra vez" badge | If `isFirstTime === true` | — |
| "Recurrente" badge | If `isFirstTime === false` | — |
| "Presencial" badge | If `appointmentMode === "PRESENCIAL"` | — |
| "Telemedicina" badge | If `appointmentMode === "TELEMEDICINA"` | — |
| Phone | Always | — |
| Price | Always | `finalPrice` |
| Confirmation code | Always | Monospace font |

### 3.6 Empty States

| Condition | Message |
|---|---|
| `bookings.length === 0` (no bookings at all) | "No hay citas reservadas" |
| `filteredBookings.length === 0` (filters applied) | "Sin resultados para los filtros aplicados" |

---

## 4. Calendar View (`viewMode === "calendar"`)

Two-column layout on `lg+` (calendar left, slot detail right); stacked on smaller screens.

### 4.1 Left — Month Calendar

| Element | Behavior | Edge Cases |
|---|---|---|
| **← Anterior** | Navigate to previous month | Updates `selectedDate`, triggers data re-fetch |
| **Hoy** | Jump to current month | — |
| **Siguiente →** | Navigate to next month | — |
| **Day cell — has slots** | Click → `selectedDate` = clicked date | Blue tint + blue dot indicator below number |
| **Day cell — today (no slots)** | Light blue tint, not clickable | — |
| **Day cell — past date** | Grayed out, not clickable | — |
| **Day cell — no slots, future** | Gray text, no click action | — |
| **Day cell — selected** | Blue background, white text, bold | Blue dot hidden when selected |

Day header labels: "D", "L", "M", "M", "J", "V", "S" (short on mobile; full names on desktop).

### 4.2 Right — Slots for Selected Date

Shows `slotsForSelectedDate` (slots filtered to the selected date string).

**Empty state:** Clock icon + "Sin horarios para esta fecha"

**Slot card fields:**
- Time range: `startTime – endTime` (bold)
- Status badge: Disponible (green) / Lleno (blue) / Cerrado (gray)
- Price: `finalPrice` with icon; shows discount info if `discount` exists

**Slot card actions:**

| Button | Condition | API Call | Behavior |
|---|---|---|---|
| **Agendar** (green) | `isOpen && currentBookings < maxBookings` | — | Opens `BookPatientModal` with this slot pre-selected → skips to Step 2 |
| **Lock icon** | `isOpen === true` | `PATCH /slots/{id}` `{ isOpen: false }` | Blocked with error toast if `currentBookings > 0` |
| **Unlock icon** | `isOpen === false` | `PATCH /slots/{id}` `{ isOpen: true }` | No guard required |
| **Trash icon** | Always | See §6 Deletion Flow | May cancel active bookings first |

### 4.3 Slot Status Logic

```
isOpen === false                    → "Cerrado" (gray)
isOpen === true && currentBookings >= maxBookings  → "Lleno" (blue)
isOpen === true && currentBookings < maxBookings   → "Disponible" (green)
```

---

## 5. List View (`viewMode === "list"`)

### 5.1 Sub-Navigation Bar

| Element | Condition | Action |
|---|---|---|
| ← → date arrows | `!showAllSlots` | Shift `listDate` ±1 day, clears `selectedSlots` |
| Date input | `!showAllSlots` | Jump to specific date |
| **"Hoy"** button | `!showAllSlots && listDate !== today` | Reset `listDate` to today |
| **"Ver todos"** button | `!showAllSlots` | `showAllSlots = true` — shows entire month |
| **"Por día"** button | `showAllSlots` | `showAllSlots = false` — shows single date |
| Slot count badge | Always | Shows `visibleListSlots.length` |

### 5.2 Slot Selection & Bulk Actions

| Element | Condition | Action |
|---|---|---|
| Row checkbox | Per row | Adds/removes from `selectedSlots` Set |
| Header "select all" checkbox | Desktop table | Selects all visible slots; clicking again deselects all |
| "Seleccionar todo" / "Deseleccionar todo" | Mobile toggle button | Same as header checkbox |
| **Bulk action bar** | Appears when `selectedSlots.size > 0` | — |
| — **"Cerrar"** (Lock) | Guard: aborts if any selected slot has `currentBookings > 0` | `POST /slots/bulk` `{ action: "close" }` + confirm |
| — **"Abrir"** (Unlock) | No guard | `POST /slots/bulk` `{ action: "open" }` + confirm |
| — **"Eliminar"** (Trash) | Confirm dialog | `POST /slots/bulk` `{ action: "delete" }` |
| — **"Limpiar"** (×) | Always | Clears `selectedSlots` |

**Bulk confirm text:** "¿Estás seguro de que quieres {eliminar/cerrar/abrir} X horario(s)?"

**Bulk close guard message:** "No se pueden cerrar X horario(s) porque tienen reservas activas. Por favor cancela las reservas primero o deselecciona esos horarios."

### 5.3 Per-Row Actions

Same as calendar view: **Agendar**, **Lock/Unlock**, **Trash**.

"Fecha" column only shown in "Ver todos" mode (`showAllSlots === true`).

### 5.4 Empty States

| Condition | Message | Extra |
|---|---|---|
| `showAllSlots && slots.length === 0` | "No hay horarios creados" | "Crear horarios" button → opens `CreateSlotsModal` |
| `!showAllSlots && slotsForListDate.length === 0` | "No hay horarios para este día" | — |

---

## 6. Slot Deletion Flow

```
deleteSlot(slotId)
│
├─ activeBookings = bookings where:
│   slotId matches AND status ∉ [CANCELLED, COMPLETED, NO_SHOW]
│
├─ IF activeBookings.length > 0
│   ├─ Confirm: "Este horario tiene X cita(s) activa(s). ¿Cancelar las citas y eliminar el horario?"
│   ├─ User cancels → ABORT (nothing happens)
│   └─ User confirms → loop each active booking:
│       ├─ PATCH /bookings/{id} { status: "CANCELLED" }
│       ├─ Any failure → toast error, ABORT (slot NOT deleted)
│       └─ All cancelled OK → DELETE /slots/{id}
│
└─ IF activeBookings.length === 0
    │   (slot may still have COMPLETED or NO_SHOW bookings — these don't block)
    ├─ Confirm: "¿Estás seguro de que quieres eliminar este horario?"
    └─ User confirms → DELETE /slots/{id}  ← succeeds (COMPLETED/NO_SHOW excluded from block)

Success: toast "Horario eliminado exitosamente" + fetchSlots() + fetchBookings()
Failure: toast with API error message
```

**Key distinction:** The API's DELETE guard only blocks on `PENDING` and `CONFIRMED` bookings. `COMPLETED` and `NO_SHOW` are terminal — the time already passed — and do not prevent deletion.

---

## 7. CreateSlotsModal

### 7.1 Mode Toggle

| Button | Effect |
|---|---|
| **"Día Único"** | `mode = "single"` — shows single date picker |
| **"Recurrente"** | `mode = "recurring"` — shows date range + day-of-week picker |

Voice assistant data always forces `mode = "recurring"`.

### 7.2 Form Inputs by Mode

**Single mode:**
- Date picker (min = today)

**Recurring mode:**
- Start date (min = today)
- End date (min = startDate or today)
- Day-of-week multi-select: **Lun · Mar · Mié · Jue · Vie · Sáb · Dom** (at least 1 required)

**Shared (both modes):**

| Field | Input Type | Options / Constraints |
|---|---|---|
| Start time | Dropdown | 00:00 – 23:30 in 30-min steps |
| End time | Dropdown | Same options |
| Duration | Toggle button | 30 min / 60 min |
| Break time | Checkbox | If checked: shows break start + break end dropdowns |

### 7.3 Live Preview Banner

"Esto creará **X** horarios" — recalculated on every input change:
1. Parse start/end times to total minutes
2. Subtract break duration (if enabled)
3. Divide by duration → slots per day
4. Multiply by matching days in date range

**Submit disabled** if `previewSlots === 0` or `isSubmitting`.

### 7.4 Info Banners

| Banner | Content | Dismissible |
|---|---|---|
| Price info | "El precio de la cita lo determina el servicio seleccionado por el paciente al reservar." | No |
| Task conflict | Lists overlapping tasks (up to 3 shown + "y N más") — informational only, does not block | Yes — "Entendido" button |
| Error | Validation or API error details | Auto-clears on next submit |

### 7.5 Conflict Handling (409)

When the API returns 409:
- Shows list of conflicting slots (up to 5): date, time, booking count
- No "replace conflicts" option — doctor must choose different dates or resolve manually
- Form stays open; error displayed in red banner

### 7.6 Submit Flow

```
POST /api/appointments/slots
{
  doctorId, mode,
  startTime, endTime, duration,
  basePrice: 0,
  replaceConflicts: false,
  breakStart?, breakEnd?,           // if hasBreak
  date?,                            // if single
  startDate?, endDate?, daysOfWeek? // if recurring
}

├─ 409 Conflict → show conflict list in error banner, stay open
├─ 200 success
│   ├─ Toast: "Se crearon X horarios" (+ "Y reemplazados" if applicable)
│   ├─ If data.tasksInfo → show task conflict info banner
│   └─ onSuccess() → fetchSlots() + fetchBookings() → modal closes + form resets
└─ Network error → toast "Error al crear horarios. Por favor intenta de nuevo."
```

### 7.7 Footer Buttons

| Button | Disabled when | Action |
|---|---|---|
| **Cancelar** | `isSubmitting` | Calls `onClose()`, resets form |
| **Crear X Horario(s)** | `isSubmitting` OR `previewSlots === 0` | Submits form |

During submit: spinner + "Creando..." text.

---

## 8. BookPatientModal

### 8.1 Entry Conditions

| Entry Point | `preSelectedSlot` | Initial Step |
|---|---|---|
| "Agendar Cita" header button | `null` | Step 1 — slot selection |
| "Agendar" on slot card / row | Slot object | Step 2 — patient form (slot pre-filled) |

On open: fetches available slots (0–90 days) + doctor's services simultaneously.

### 8.2 Step 1 — Slot Selection

Two tabs:

#### Tab A: "Horarios disponibles"

Available slots: `isOpen === true && currentBookings < maxBookings && date >= today`, sorted by date then time.

**Empty state:** Clock icon + "Sin horarios disponibles" + suggestion to use "Nuevo horario" tab.

**Calendar interaction:**

| Element | Behavior |
|---|---|
| ← → month navigation | Changes `currentMonth`, clears `calendarDate` |
| Day cell — has available slots | Blue tint + blue dot; click sets `calendarDate` (click again to deselect) |
| Day cell — past / today / no slots | Gray / not clickable |

**Slot grid (shown when date selected):**

2-column grid of slot buttons. Each shows: time range (bold) + duration. Click → `selectedSlot` set, advances to Step 2.

**Guidance text** ("Selecciona una fecha resaltada para ver los horarios") shown when no date is selected yet.

#### Tab B: "Nuevo horario" (instant creation)

| Field | Input | Constraint |
|---|---|---|
| Fecha | `type="date"` | min = today |
| Hora de inicio | `type="time"` | — |
| Duración | Dropdown: 30 / 60 min | — |
| Hora de fin | Calculated display only | `startTime + duration` |

Info banner: "El precio lo determina el servicio que selecciones a continuación."

**"Continuar →"** button: validates date + startTime not empty → advances to Step 2. Shows inline error if invalid.

### 8.3 Step 2 — Patient Form

**Slot summary** shown at top: formatted date + time range.

"← Cambiar horario" link: only visible if `preSelectedSlot` is null — goes back to Step 1.

#### Service Selection (only if doctor has services)

Grid of buttons, one per service. Shows: service name, duration (if set), price (if set).

**Required**: if services exist and none selected, submit button is disabled.

Active state: blue border + ring. Inactive: gray border.

#### Visit Context Toggles

| Group | Options | Behavior |
|---|---|---|
| Tipo de visita | "Primera vez" / "Recurrente" | Toggle; clicking active option deselects (sets to `null`) |
| Modalidad | "Presencial" / "Telemedicina" | Toggle; same deselect behavior |

Both groups are optional — no validation required.

#### Patient Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Nombre completo | text | Yes | autoFocus |
| Email | email | Yes | — |
| Teléfono | tel | Yes | — |
| WhatsApp | tel | No | — |
| Notas | textarea (3 rows) | No | — |

#### Submit Button

| State | Condition |
|---|---|
| **Disabled** | `isSubmitting` OR `(services.length > 0 && !selectedServiceId)` |
| **Normal** | All required fields filled + service selected (if services exist) |
| **Loading** | Shows spinner + "Agendando..." |

### 8.4 Step 2 — Submit Flows

**Existing slot path:**
```
POST /api/appointments/bookings
{ slotId, patientName, patientEmail, patientPhone, patientWhatsapp?,
  notes?, serviceId?, isFirstTime, appointmentMode? }
→ success: bookingId + confirmationCode
→ PATCH /api/appointments/bookings/{bookingId} { status: "CONFIRMED" }
  (auto-confirm: doctor scheduling = already confirmed)
→ success: advance to Step 3
→ any failure: show error banner in Step 2, stay on form
```

**New instant slot path:**
```
POST /api/appointments/bookings/instant
{ doctorId, date, startTime, duration, basePrice: 0,
  patientName, patientEmail, patientPhone, patientWhatsapp?,
  notes?, serviceId?, isFirstTime, appointmentMode? }
  (creates slot + booking + confirms atomically in one call)
→ success: advance to Step 3
→ failure: show error banner in Step 2
```

### 8.5 Step 3 — Success Screen

| Element | Content |
|---|---|
| Icon | Green checkmark in circle |
| Title | "Cita Confirmada" |
| Patient | `patientName` |
| Date | Weekday + day + month (localized, capitalized) |
| Time | `startTime – endTime` |
| Service | `selectedService.serviceName` (if service selected) |
| Price | `selectedService.price` (if service has price) |
| Código | `confirmationCode` (monospace, bold, white bg) |
| Button | "Cerrar" → `handleClose()` → full state reset + `onClose()` |

---

## 9. Booking Status State Machine

```
               ┌─────────────┐
               │   PENDING   │
               └──────┬──────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ┌─────────────┐         ┌────────────┐
   │  CONFIRMED  │         │ CANCELLED  │ ← terminal
   └──────┬──────┘         └────────────┘
          │
     ┌────┴──────────┐
     ▼               ▼
┌─────────┐    ┌──────────┐
│COMPLETED│    │ NO_SHOW  │   ← both terminal
└─────────┘    └──────────┘
```

**Terminal states** (CANCELLED, COMPLETED, NO_SHOW): no further status transitions allowed.

**`currentBookings` decrement:** Only on `CANCELLED`. `COMPLETED` and `NO_SHOW` keep `currentBookings` at its current value — the time block was used/reserved.

**Side effects on status change:**

| Transition | Side Effects |
|---|---|
| → CONFIRMED | SMS sent to patient (async, non-blocking); `confirmedAt` timestamp set; Google Calendar event updated |
| → CANCELLED | `currentBookings` decremented; `cancelledAt` timestamp set; Google Calendar event reverted |
| → COMPLETED | No slot change |
| → NO_SHOW | No slot change |

---

## 10. Voice Assistant Integration

| Step | Trigger | Result |
|---|---|---|
| 1. Open recording | Mic button in layout | `VoiceRecordingModal` opens |
| 2. Record | Speak into mic | Audio processed, transcript + structured data extracted |
| 3. Refine | Recording completes | `VoiceChatSidebar` opens with transcript + extracted fields for multi-turn refinement |
| 4. Confirm | "Confirmar" in sidebar | `voiceFormData` populated, `CreateSlotsModal` opens pre-filled in recurring mode |
| 5. Submit | Doctor adjusts + submits | Same `POST /api/appointments/slots` as manual flow |

**Cross-page navigation:** Voice assistant on dashboard stores data in `sessionStorage`. On landing at `/appointments?voice=true`, the page reads sessionStorage, maps the data, and opens `CreateSlotsModal` automatically.

---

## 11. All API Endpoints Summary

| Method | Endpoint | Triggered By | Success Response |
|---|---|---|---|
| GET | `/api/appointments/slots?doctorId&startDate&endDate` | Page load, month change, post-mutation | `{ success, data: AppointmentSlot[] }` |
| GET | `/api/appointments/bookings?doctorId&startDate&endDate` | Page load, month change, post-mutation | `{ success, data: Booking[] }` |
| POST | `/api/appointments/slots` | CreateSlotsModal submit | `{ success, count, replacedCount?, tasksInfo? }` |
| PATCH | `/api/appointments/slots/{id}` | Lock/unlock toggle | `{ success, message }` |
| DELETE | `/api/appointments/slots/{id}` | Trash icon on slot | `{ success }` |
| POST | `/api/appointments/slots/bulk` | Bulk action bar | `{ success, count }` |
| GET | `/api/doctor/services` | BookPatientModal open | `{ success, data: DoctorService[] }` |
| POST | `/api/appointments/bookings` | BookPatientModal (existing slot) | `{ success, data: { id, confirmationCode } }` |
| POST | `/api/appointments/bookings/instant` | BookPatientModal (new slot tab) | `{ success, data: { confirmationCode } }` |
| PATCH | `/api/appointments/bookings/{id}` | Status buttons + auto-confirm after booking | `{ success, data, message }` |
| DELETE | `/api/appointments/bookings/{id}` | Trash icon on booking row | `{ success }` — also deletes the associated slot |

### Error Handling Pattern

All mutations follow the same pattern:
1. API returns `{ success: false, error: string }` → `toast.error(data.error || fallback)`
2. Network/fetch failure → `toast.error(hardcoded fallback message)`
3. Confirm dialogs use `practiceConfirm()` (headless UI modal, not `window.confirm`)
4. Toast notifications use `toast.success/error()` from `@/lib/practice-toast`

---

## Document Metadata

- **Author:** AI Assistant (Claude)
- **Created:** 2026-03-11
- **Files analyzed:** `page.tsx`, `useAppointmentsPage.ts`, `CreateSlotsModal.tsx`, `BookPatientModal.tsx`, `layout.tsx`
- **Bug fixes reflected:** COMPLETED/NO_SHOW slot deletion fix, `activeBookings` filter fix, `NO_SHOW` status color, `fetchBookings` date range scope
