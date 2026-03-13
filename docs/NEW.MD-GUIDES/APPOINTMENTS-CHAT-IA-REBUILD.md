# Appointments Chat IA — Rebuild Guide

> Last updated: 2026-03-12
> Status: Phase 1 complete — paused here, phases 2–5 pending

---

## Why a rebuild

The original implementation tried to do everything at once: understand data, resolve natural language to IDs, generate multi-step action batches, handle dependency ordering, and execute mutations — all in a single prompt. This produced unreliable behavior:

- AI confused "no slots on a date" with "no availability" → refused to create slots
- AI confused CONFIRMED (scheduled) with COMPLETED (attended) → wrong action
- AI generated `create_slots` with wrong `mode` field → API rejected it
- AI only created one of two requested slots → context misinterpretation

Root cause: an overloaded prompt doing too many things. A model that can't reliably answer "who has an appointment today?" cannot be trusted to cancel bookings.

**The fix: build from the foundation up.** First prove the AI correctly understands the data. Then add actions one at a time, only after each layer is solid.

---

## Data model

### AppointmentSlot
```
id, date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM), duration (30|60)
isOpen (bool), currentBookings, maxBookings
```

**Computed slot state (derived, not stored):**
- `isOpen = false` → **CERRADO**
- `isOpen = true, currentBookings >= maxBookings` → **LLENO**
- `isOpen = true, currentBookings < maxBookings` → **DISPONIBLE**

### Booking
```
id, slotId
patientName, patientEmail, patientPhone, patientWhatsapp
status: PENDING | CONFIRMED | COMPLETED | NO_SHOW | CANCELLED
serviceName, serviceId, isFirstTime, appointmentMode
notes, confirmationCode
```

**Status machine:**
```
PENDING  →  CONFIRMED  →  COMPLETED
                       →  NO_SHOW
         →  CANCELLED
CONFIRMED → CANCELLED
```

**Status labels sent to AI (Spanish):**
| DB value | AI label |
|----------|----------|
| PENDING | PENDIENTE |
| CONFIRMED | AGENDADA |
| COMPLETED | COMPLETADA |
| NO_SHOW | NO_ASISTIÓ |
| CANCELLED | CANCELADA |

### VENCIDA — computed flag

A booking is **VENCIDA** when:
- Its status is PENDING or CONFIRMED (was never resolved)
- The slot's **end time** has already passed (in America/Mexico_City timezone)

This means the appointment window closed without the doctor marking it as COMPLETED, NO_SHOW, or CANCELLED. These are orphaned bookings that need attention.

- Not stored in DB — computed at read time in the route
- Threshold is **end time** (not start time) — appointment may be in progress during the slot
- Timezone comparison uses `sv-SE` locale string trick to avoid UTC offset errors
- Displayed in UI with a distinct red style — wired in `page.tsx` (both mobile and desktop booking badges)

---

## AI context structure

The route sends a clean, Spanish-language JSON context to the AI. Sensitive fields (email, phone, prices, tokens) are stripped. All statuses are pre-translated.

```json
{
  "id": "clx...",
  "fecha": "2026-03-14",
  "inicio": "10:00",
  "fin": "11:00",
  "duracion": 60,
  "estado": "LLENO",
  "lugaresOcupados": 1,
  "lugaresTotal": 1,
  "citas": [
    {
      "id": "clx...",
      "paciente": "Juan García",
      "estado": "AGENDADA",
      "vencida": false,
      "servicio": "Consulta general",
      "primeraVez": true,
      "modalidad": "PRESENCIAL"
    }
  ]
}
```

**Context window:** today−7 days to today+60 days. All booking statuses included (not filtered) so the AI can answer historical questions ("who cancelled last week", "how many completed this month").

---

## Phase plan

### Phase 1 — Query only ✅ (complete)

**Goal:** Prove the AI correctly reads and interprets the data before it can touch anything.

- Prompt: 8 rules, no action rules, no examples
- Hook: actions returned by AI are ignored (`_actions` discarded)
- Action infrastructure preserved in code — just dormant

**Tested queries (all passing):**
- "¿Qué citas tengo hoy?"
- "¿Hay citas vencidas?"
- "¿Quién tiene cita esta semana?"
- "¿Tengo horarios disponibles el viernes?"
- "¿Hay citas pendientes de confirmar?"
- "Dame un resumen de mi agenda"
- "¿La cita de [nombre] ya está confirmada?"

**Post-Phase-1 improvements (still query-only):**
- Rule 8 added: AI always includes paciente, fecha/hora, estado, servicio, primera vez, modalidad when mentioning any cita
- `page.tsx`: booking status badges now show Spanish labels (PENDIENTE, AGENDADA, COMPLETADA, NO_ASISTIÓ, CANCELADA)
- `page.tsx`: VENCIDA badge label + red styling wired for overdue PENDING/CONFIRMED bookings
- `useAppointmentsPage.ts`: "Todas las Citas" table defaults to today's date filter on load

---

### Phase 2 — Simple booking status changes

**Actions to add:** `confirm_booking`, `complete_booking`, `no_show_booking`

These are the simplest mutations: one PATCH call, no side effects, only valid from specific current states.

- Add rule + example to prompt for each
- Re-enable `setPendingActions` in hook
- Test each one before adding the next

---

### Phase 3 — Cancellation and booking

**Actions to add:** `cancel_booking`, `book_patient`

- `cancel_booking`: PATCH to CANCELLED, frees slot
- `book_patient`: instant booking via POST /bookings/instant

---

### Phase 4 — Slot management

**Actions to add:** `close_slot`, `open_slot`, `delete_slot`, `create_slots` (single date only)

- Add conflict detection rules back to prompt (only for create_slots)
- Add dependency rules for close/delete (must cancel active bookings first)

---

### Phase 5 — Complex operations

**Actions to add:** `reschedule_booking`, `create_slots` (recurring), bulk operations

- Reschedule = cancel + instant book (two-step compound)
- Recurring slots require date range + daysOfWeek
- Bulk: bulk_close, bulk_open, bulk_delete

---

## Key files

| File | Purpose |
|------|---------|
| `apps/doctor/src/app/api/appointments-chat/route.ts` | Chat route — auth, context fetch, prompt, gpt-4o call |
| `apps/doctor/src/hooks/useAppointmentsChat.ts` | Hook — state, sendMessage, dispatchAction, executeActions |
| `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx` | UI panel component |
| `apps/doctor/src/app/appointments/useAppointmentsPage.ts` | Page hook — chatPanelOpen, onRefresh, getStatusColor (VENCIDA) |

---

## Architecture decisions

### Why the hook executes mutations, not the route
The route only calls OpenAI — no mutations. All writes happen client-side via `authFetch` in the hook. This preserves GCal sync, SMS notifications, and activity logging that live inside `apps/api` endpoints. No server-to-server JWT complexity needed.

### Why `confirm_booking` ≠ `complete_booking`
- `confirm_booking`: PENDIENTE → AGENDADA (patient confirmed they'll attend — future)
- `complete_booking`: AGENDADA → COMPLETADA (appointment happened — past)

These were originally confused because the AI context sent `status: "CONFIRMED"` (English) and the model conflated "confirmed" with "completed". Fixed by translating all statuses to Spanish.

### Why VENCIDA uses end time (not start time) as threshold
Using start time would flag an appointment as overdue while the patient is still in the chair. End time means the full appointment window has closed.

### Why all booking statuses are included in context
Removing CANCELLED/COMPLETED/NO_SHOW from the Prisma query prevented the AI from answering historical questions. A doctor asking "who cancelled last week?" needs that data. Including all statuses also lets the AI surface VENCIDA bookings correctly.

### Why `sv-SE` locale for timezone comparisons
`new Date("YYYY-MM-DDThh:mm:00")` without a timezone suffix is parsed as server local time (UTC on Railway), not Mexico City time — 5-6 hours off. `toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })` produces a `"YYYY-MM-DD HH:MM:SS"` string in local time that sorts correctly without any timezone library.

### Why Phase 1 before anything else
A model that misreads the data will generate wrong actions. Locking to read-only first lets us validate and fix the context structure and prompt without any risk of corrupting appointment data.
