# Citas (Appointments) Section - UI Actions Mapping

**Purpose:** This document maps all possible user interactions in the Citas/Appointments section to determine which actions should be logged in the "Actividad Reciente" (Recent Activity) table on the main dashboard.

**Date Created:** February 3, 2026
**Section Analyzed:** `/appointments` and all subpages
**Related:** `ACTIVIDAD-RECIENTE-ARCHITECTURE.md`, `PENDIENTES-UI-ACTIONS-MAP.md`

---

## Table of Contents

1. [Section Overview](#1-section-overview)
2. [Slot Creation Actions](#2-slot-creation-actions)
3. [Calendar View Actions](#3-calendar-view-actions)
4. [List View Actions](#4-list-view-actions)
5. [Slot Management Actions (Single)](#5-slot-management-actions-single)
6. [Slot Management Actions (Bulk)](#6-slot-management-actions-bulk)
7. [Bookings Management Actions](#7-bookings-management-actions)
8. [Voice Assistant Actions](#8-voice-assistant-actions)
9. [Recommended Actions for Activity Log](#9-recommended-actions-for-activity-log)
10. [Proposed Action Types & Display Config](#10-proposed-action-types--display-config)
11. [API Endpoints Requiring Logging](#11-api-endpoints-requiring-logging)
12. [Important Architecture Note](#12-important-architecture-note)
13. [Next Steps](#13-next-steps)

---

## 1. Section Overview

The Appointments section (`/appointments`) has two main entities:

- **AppointmentSlot** — Time blocks a doctor creates to define their availability. Managed by the doctor.
- **Booking** — A patient reservation against a slot. Created by patients, status managed by the doctor.

**Page file:** `apps/doctor/src/app/appointments/page.tsx`
**Modal:** `apps/doctor/src/app/appointments/CreateSlotsModal.tsx`

**API endpoints (all in `apps/api/src/app/api/appointments/`):**

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/slots` | GET, POST | List/create appointment slots |
| `/slots/[id]` | PUT, DELETE, PATCH | Update/delete/toggle single slot |
| `/slots/bulk` | POST | Bulk open/close/delete slots |
| `/bookings` | GET, POST | List/create bookings |
| `/bookings/[id]` | GET, PATCH | Get/update booking status |

---

## 2. Slot Creation Actions

**Trigger:** Click "Crear Horarios" button → `CreateSlotsModal` opens

### Modal Form Inputs (Not Logged)
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Select Mode | Toggle "Dia Unico" / "Recurrente" | None | :x: Low | Form input |
| Select Date (Single) | Date picker | None | :x: Low | Form input |
| Select Start/End Date (Recurring) | Date pickers | None | :x: Low | Form input |
| Toggle Day of Week | Click day buttons (Lun-Dom) | None | :x: Low | Form input |
| Select Start/End Time | Dropdown selects | None | :x: Low | Form input |
| Select Duration | Toggle 30min/60min | None | :x: Low | Form input |
| Toggle Break | Checkbox + time selects | None | :x: Low | Form input |
| Enter Base Price | Number input | None | :x: Low | Form input |
| Toggle Discount | Checkbox + type/amount | None | :x: Low | Form input |
| Cancel Modal | Click "Cancelar" | None | :x: Low | UI action |

### Slot Submission Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Create Slots (Single Day)** | Click "Crear X Horarios" | POST `/api/appointments/slots` (mode: single) | :white_check_mark: **HIGH** | **SHOULD LOG:** "Creados {count} horarios para {date}" |
| **Create Slots (Recurring)** | Click "Crear X Horarios" | POST `/api/appointments/slots` (mode: recurring) | :white_check_mark: **HIGH** | **SHOULD LOG:** "Creados {count} horarios ({startDate} - {endDate})" |
| View Conflict Dialog | Automatic on 409 response | None | :x: Low | Error feedback |

---

## 3. Calendar View Actions

**Trigger:** viewMode === "calendar" (default)

### Navigation & View Controls
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Switch to Calendar View | Click "Calendario" button | None | :x: Low | UI preference |
| Switch to List View | Click "Lista" button | None | :x: Low | UI preference |
| Previous Month | Click "Ant." button | GET `/api/appointments/slots?...` | :x: Low | Navigation |
| Go to Today | Click "Hoy" button | GET `/api/appointments/slots?...` | :x: Low | Navigation |
| Next Month | Click "Sig." button | GET `/api/appointments/slots?...` | :x: Low | Navigation |
| Select Date | Click day in calendar grid | None | :x: Low | Navigation - shows right panel |

### Selected Date Panel Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| View Slot Details | Read slot card info | None | :x: Low | View only |
| **Toggle Slot Open/Closed** | Click Lock/Unlock button on slot card | PATCH `/api/appointments/slots/{id}` | :white_check_mark: **HIGH** | **SHOULD LOG:** "Horario {time} {date}: {opened/closed}" |
| **Delete Slot** | Click Trash button on slot card → Confirm | DELETE `/api/appointments/slots/{id}` | :white_check_mark: **HIGH** | **SHOULD LOG:** "Horario eliminado: {time} {date}" |

---

## 4. List View Actions

**Trigger:** viewMode === "list"

### Selection Actions
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Select Individual Slot | Click checkbox on row | None | :x: Low | Preparation for bulk action |
| Select All Slots | Click header checkbox / "Seleccionar todo" | None | :x: Low | Preparation for bulk action |
| Deselect All | Click "Limpiar" button | None | :x: Low | Cancel selection |

### Individual Slot Actions (in table/card)
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Toggle Slot Open/Closed** | Click Lock/Unlock button | PATCH `/api/appointments/slots/{id}` | :white_check_mark: **HIGH** | **SHOULD LOG** |
| **Delete Slot** | Click Trash button → Confirm | DELETE `/api/appointments/slots/{id}` | :white_check_mark: **HIGH** | **SHOULD LOG** |

### Empty State
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Click "Crea tus primeros horarios" | Opens CreateSlotsModal | None | :x: Low | Navigation |

---

## 5. Slot Management Actions (Single)

These occur from both calendar and list views.

### Toggle Open/Closed

**API:** PATCH `/api/appointments/slots/{id}`
**Request:** `{ isOpen: boolean }`

| Scenario | Behavior | Log Message |
|----------|----------|-------------|
| Open slot (isOpen: false → true) | Sets `isOpen = true` | "Horario abierto: {startTime}-{endTime}, {date}" |
| Close slot (isOpen: true → false) | Sets `isOpen = false` | "Horario cerrado: {startTime}-{endTime}, {date}" |
| Close slot with bookings | **Blocked** — alert shown | No log (action prevented) |

### Delete Slot

**API:** DELETE `/api/appointments/slots/{id}`

| Scenario | Behavior | Log Message |
|----------|----------|-------------|
| Delete slot (no bookings) | Confirm → Delete | "Horario eliminado: {startTime}-{endTime}, {date}" |
| Delete slot (has bookings) | Confirm → Cancel bookings → Delete | "Horario eliminado: {startTime}-{endTime}, {date} ({count} citas canceladas)" |
| Delete slot (API returns has bookings) | **Blocked** by API validation | No log (action prevented) |

**Note on delete with bookings:** The frontend (`page.tsx:240-293`) cancels bookings via PATCH before deleting. The API DELETE endpoint blocks deletion if bookings exist. Each booking cancellation during this flow should also be logged.

---

## 6. Slot Management Actions (Bulk)

**API:** POST `/api/appointments/slots/bulk`
**Request:** `{ action: "delete" | "close" | "open", slotIds: string[] }`

### Bulk Actions Bar (visible when slots selected)
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Bulk Close Slots** | Click "Cerrar" in bulk bar → Confirm | POST `/api/appointments/slots/bulk` (action: close) | :white_check_mark: **HIGH** | **SHOULD LOG:** "Cerrados {count} horarios" |
| **Bulk Open Slots** | Click "Abrir" in bulk bar → Confirm | POST `/api/appointments/slots/bulk` (action: open) | :white_check_mark: **HIGH** | **SHOULD LOG:** "Abiertos {count} horarios" |
| **Bulk Delete Slots** | Click "Eliminar" in bulk bar → Confirm | POST `/api/appointments/slots/bulk` (action: delete) | :white_check_mark: **HIGH** | **SHOULD LOG:** "Eliminados {count} horarios" |
| Bulk close with bookings | **Blocked** — alert shown | No log | API returns 400 |
| Bulk delete with bookings | **Blocked** — alert shown | No log | API returns 400 |

---

## 7. Bookings Management Actions

**Section:** "Citas Reservadas" table at top of appointments page

### View Actions (Not Logged)
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| View Bookings Table | Auto-loaded on page mount | GET `/api/appointments/bookings?doctorId={id}` | :x: Low | Auto-fetch |
| View Patient Info | Read name, email, phone | None | :x: Low | View only |
| View Status Badge | Read color-coded status | None | :x: Low | View only |
| View Confirmation Code | Read alphanumeric code | None | :x: Low | View only |
| View Price | Read finalPrice | None | :x: Low | View only |

### Booking Status Transitions

**API:** PATCH `/api/appointments/bookings/{id}`
**Request:** `{ status: string }`

**State Machine:**
```
PENDING ──→ CONFIRMED ──→ COMPLETED
  │              │
  │              ├──→ NO_SHOW
  │              │
  └──→ CANCELLED ←──┘
```

| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **Confirm Booking** | Click "Confirmar" (green button) | PATCH with status: CONFIRMED | :white_check_mark: **HIGH** | **SHOULD LOG:** "Cita confirmada: {patientName} - {date} {time}" |
| **Cancel Booking** | Click "Cancelar" (red button) → Confirm dialog | PATCH with status: CANCELLED | :white_check_mark: **HIGH** | **SHOULD LOG:** "Cita cancelada: {patientName} - {date} {time}" |
| **Complete Booking** | Click "Completada" (blue button) | PATCH with status: COMPLETED | :white_check_mark: **HIGH** | **SHOULD LOG:** "Cita completada: {patientName} - {date} {time}" |
| **Mark No-Show** | Click "No asistio" (gray button) | PATCH with status: NO_SHOW | :white_check_mark: **HIGH** | **SHOULD LOG:** "Paciente no asistio: {patientName} - {date} {time}" |

**Side effects on status change:**
- Terminal statuses (CANCELLED, COMPLETED, NO_SHOW): Slot `currentBookings` decremented via DB transaction
- CONFIRMED: SMS sent to patient (async, non-blocking)
- CONFIRMED: `confirmedAt` timestamp set
- CANCELLED: `cancelledAt` timestamp set

### Booking Creation (Patient-Initiated, Not on Doctor Page)

| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| **New Booking Created** | Patient submits booking form (external) | POST `/api/appointments/bookings` | :yellow_circle: **MEDIUM** | Could log: "Nueva reserva: {patientName} - {date} {time}" — This is patient-initiated, not a doctor action, but useful for doctor awareness |

---

## 8. Voice Assistant Actions

### Voice Recording Flow
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Open Voice Modal | Click "Asistente de Voz" button | None | :x: Low | UI action |
| Record Voice | Speak into microphone | Voice processing API | :x: Low | Input method |
| Edit in Sidebar | Multi-turn conversation | Voice assistant API | :x: Low | Input method |
| Confirm Voice Data | Click confirm in sidebar | None | :x: Low | Populates CreateSlotsModal |
| **Create Slots via Voice** | Submit pre-filled form | POST `/api/appointments/slots` | :white_check_mark: **HIGH** | Same as regular creation — the API call is identical. Optionally distinguish via metadata: `viaVoiceAssistant: true` |

### Voice Hub Widget Flow (from dashboard)
| Action | User Interaction | API Call | Log Priority | Notes |
|--------|------------------|----------|--------------|-------|
| Navigate from Hub | Hub routes to `/appointments?voice=true` | None | :x: Low | Navigation |
| Load Voice Data | sessionStorage data loaded into form | None | :x: Low | Data transfer |
| **Create Slots** | Submit pre-filled form | POST `/api/appointments/slots` | :white_check_mark: **HIGH** | Same as regular creation |

---

## 9. Recommended Actions for Activity Log

### Priority: HIGH (Critical Business Actions)

| # | Action | actionType | entityType | Display Message | Icon | Color |
|---|--------|-----------|------------|----------------|------|-------|
| 1 | **Create Slots** | `SLOTS_CREATED` | `APPOINTMENT` | "Creados {count} horarios para {date/range}" | `CalendarPlus` | `purple` |
| 2 | **Delete Slot** | `SLOT_DELETED` | `APPOINTMENT` | "Horario eliminado: {time}, {date}" | `Trash2` | `red` |
| 3 | **Bulk Delete Slots** | `SLOTS_BULK_DELETED` | `APPOINTMENT` | "Eliminados {count} horarios" | `Trash2` | `red` |
| 4 | **Open Slot** | `SLOT_OPENED` | `APPOINTMENT` | "Horario abierto: {time}, {date}" | `Unlock` | `green` |
| 5 | **Close Slot** | `SLOT_CLOSED` | `APPOINTMENT` | "Horario cerrado: {time}, {date}" | `Lock` | `gray` |
| 6 | **Bulk Open Slots** | `SLOTS_BULK_OPENED` | `APPOINTMENT` | "Abiertos {count} horarios" | `Unlock` | `green` |
| 7 | **Bulk Close Slots** | `SLOTS_BULK_CLOSED` | `APPOINTMENT` | "Cerrados {count} horarios" | `Lock` | `gray` |
| 8 | **Confirm Booking** | `BOOKING_CONFIRMED` | `BOOKING` | "Cita confirmada: {patientName} - {date} {time}" | `CheckCircle2` | `green` |
| 9 | **Cancel Booking** | `BOOKING_CANCELLED` | `BOOKING` | "Cita cancelada: {patientName} - {date} {time}" | `XCircle` | `red` |
| 10 | **Complete Booking** | `BOOKING_COMPLETED` | `BOOKING` | "Cita completada: {patientName} - {date} {time}" | `CheckCircle2` | `blue` |
| 11 | **Mark No-Show** | `BOOKING_NO_SHOW` | `BOOKING` | "Paciente no asistio: {patientName} - {date} {time}" | `AlertCircle` | `yellow` |

### Priority: MEDIUM (Optional/Enhanced Tracking)

| # | Action | actionType | entityType | Display Message | Icon | Color |
|---|--------|-----------|------------|----------------|------|-------|
| 12 | **New Booking (patient-initiated)** | `BOOKING_CREATED` | `BOOKING` | "Nueva reserva: {patientName} - {date} {time}" | `CalendarPlus` | `purple` |
| 13 | **Voice Assistant Usage** | (Same as #1 with metadata flag) | `APPOINTMENT` | "Creados {count} horarios con asistente de voz" | `Mic` | `purple` |

### Priority: LOW (Not Recommended for Activity Log)

All navigation, view toggling, calendar browsing, date selection, form input, slot selection (checkboxes), and read-only data viewing should NOT be logged.

---

## 10. Proposed Action Types & Display Config

### New Types to Add to `activity-logger.ts`

```typescript
// Add to ActivityActionType union:
| "SLOTS_CREATED"
| "SLOT_DELETED"
| "SLOTS_BULK_DELETED"
| "SLOT_OPENED"
| "SLOT_CLOSED"
| "SLOTS_BULK_OPENED"
| "SLOTS_BULK_CLOSED"
| "BOOKING_CONFIRMED"
| "BOOKING_CANCELLED"
| "BOOKING_COMPLETED"
| "BOOKING_NO_SHOW"
| "BOOKING_CREATED"
```

### New Icons Needed in `RecentActivityTable.tsx`

```typescript
import {
  // Existing:
  CheckSquare, Edit, CheckCircle2, Trash2, ArrowRightLeft, Heart,
  // New for appointments:
  CalendarPlus,  // Slot creation
  Lock,          // Slot closed
  Unlock,        // Slot opened
  XCircle,       // Booking cancelled
  AlertCircle,   // No-show
  Mic,           // Voice assistant (optional)
} from "lucide-react";
```

### Metadata Structure for Appointment Activities

```typescript
// For slot actions:
{
  slotsCount: number;
  date?: string;           // Single date or range start
  dateEnd?: string;        // Range end (recurring)
  timeRange?: string;      // "09:00-17:00"
  duration?: number;       // 30 or 60
  basePrice?: number;
  mode?: "single" | "recurring";
  viaVoiceAssistant?: boolean;
}

// For booking actions:
{
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  appointmentDate: string;  // ISO date
  appointmentTime: string;  // "09:00-10:00"
  confirmationCode?: string;
  previousStatus?: string;
  newStatus: string;
  finalPrice?: number;
}
```

---

## 11. API Endpoints Requiring Logging

### Endpoints in `apps/api/` (API app — separate from doctor app)

**Important:** The appointments API lives in `apps/api/`, NOT `apps/doctor/`. This means the activity logger (which uses `@healthcare/database` Prisma client) must be importable from the API app, or the logging calls must be added in a way accessible to the API app.

| File | Method | Action to Log | Logger Function |
|------|--------|---------------|-----------------|
| `apps/api/.../slots/route.ts` | POST | Slot creation (single/recurring) | `logSlotsCreated()` |
| `apps/api/.../slots/[id]/route.ts` | PATCH | Slot open/close toggle | `logSlotOpened()` / `logSlotClosed()` |
| `apps/api/.../slots/[id]/route.ts` | DELETE | Slot deletion | `logSlotDeleted()` |
| `apps/api/.../slots/bulk/route.ts` | POST (delete) | Bulk slot deletion | `logSlotsBulkDeleted()` |
| `apps/api/.../slots/bulk/route.ts` | POST (open) | Bulk slot open | `logSlotsBulkOpened()` |
| `apps/api/.../slots/bulk/route.ts` | POST (close) | Bulk slot close | `logSlotsBulkClosed()` |
| `apps/api/.../bookings/[id]/route.ts` | PATCH | Booking status change | `logBookingConfirmed()` / `logBookingCancelled()` / `logBookingCompleted()` / `logBookingNoShow()` |
| `apps/api/.../bookings/route.ts` | POST | New booking created | `logBookingCreated()` (optional) |

---

## 12. Important Architecture Note

### Two-App Split

The current task logging works because **both the task API and the logger live in `apps/doctor/`**. The appointment APIs live in **`apps/api/`** — a separate Next.js app.

To add logging to appointment endpoints, there are two approaches:

**Option A: Move/copy `activity-logger.ts` to a shared package**
- Create `packages/activity-logger/` or add to `packages/database/`
- Both `apps/doctor` and `apps/api` can import it
- Cleanest separation of concerns

**Option B: Add logging directly in `apps/api/`**
- Copy the logger utility into `apps/api/src/lib/activity-logger.ts`
- Both apps use the same Prisma client (`@healthcare/database`) so DB access works
- Simpler but duplicates code

**Option C: Log from the frontend (doctor app) after API response**
- After a successful API call, make a separate call to log the activity
- Unreliable — user could close browser, network issues, etc.
- Not recommended for audit-critical logging

**Recommendation:** Option A (shared package) is best long-term, but Option B is acceptable for now since the logger is small and self-contained.

---

## 13. Next Steps

1. **Decide on architecture approach** (Option A vs B from section 12)
2. **Add action types** to `ActivityActionType` union in `activity-logger.ts`
3. **Create specialized logger functions** for each appointment action
4. **Wire logging into API endpoints** following the same pattern as tasks
5. **Add new icons** to `RecentActivityTable.tsx` icon map (`CalendarPlus`, `Lock`, `Unlock`, `XCircle`, `AlertCircle`)
6. **No DB migration needed** — the `activity_logs` table schema is already generic

### Estimated Changes

| File | Change |
|------|--------|
| `activity-logger.ts` (new or updated) | Add ~8 new logger functions |
| `apps/api/.../slots/route.ts` | Add `logSlotsCreated()` call after POST success |
| `apps/api/.../slots/[id]/route.ts` | Add logging to PATCH and DELETE handlers |
| `apps/api/.../slots/bulk/route.ts` | Add logging to each bulk action branch |
| `apps/api/.../bookings/[id]/route.ts` | Add logging to PATCH handler (per status) |
| `apps/api/.../bookings/route.ts` | Add `logBookingCreated()` call after POST (optional) |
| `RecentActivityTable.tsx` | Import and add 4-5 new icons to `iconMap` |

---

## Document Metadata

- **Author:** AI Assistant
- **Created:** February 3, 2026
- **Section:** Citas/Appointments (`/appointments`)
- **Status:** Complete
- **Next Section to Analyze:** Medical Records (`/dashboard/medical-records`) or Patients
