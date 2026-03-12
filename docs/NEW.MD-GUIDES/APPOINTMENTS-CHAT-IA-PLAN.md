# Appointments Chat IA — Implementation Plan

> Status: DESIGN COMPLETE — ready for implementation
> Scope: `apps/doctor` (chat route + hook + panel) + minor edits to existing appointments page
> External API calls: `apps/api` appointments endpoints (slots, bookings, bulk)

---

## 1. Architecture Overview

### Two-app constraint

```
apps/doctor (port 3001)          apps/api (port 3003)
─────────────────────            ─────────────────────
UI + medical records             Appointments domain
Chat IA route (AI only)          Slots CRUD + GCal sync
                                 Bookings CRUD + SMS
                                 Bulk operations
```

The chat route lives in `apps/doctor` but **never calls apps/api directly** (server-to-server). All write mutations go through the **hook (client-side)** using `authFetch`, exactly as `useAppointmentsPage` already does. This preserves:
- GCal sync (fire-and-forget inside apps/api endpoints)
- SMS notifications (triggered inside bookings endpoints)
- Activity logging

### Request lifecycle

```
User message
    │
    ▼
useAppointmentsChat (client hook)
    │  1. POST /api/appointments-chat  { message, conversationHistory }
    │     ↓ chat route fetches context from Prisma (doctorId, today−7 → today+60)
    │     ↓ gpt-4o reasons; returns { reply, actions[] }
    │  2. Hook receives actions[]
    │  3. Hook checks confirmation rules (hardcoded, not AI-decided)
    │  4. If confirm needed → show dialog → await user
    │  5. Execute actions sequentially via authFetch → apps/api
    │  6. After all actions → single fetchSlots() + fetchBookings() refresh
    ▼
UI updates
```

---

## 2. Auth Chain

### Chat route (server-side, in apps/doctor)

```ts
// apps/doctor/src/app/api/appointments-chat/route.ts
import { requireDoctorAuth } from '@/lib/medical-auth';
// uses auth() from @healthcare/auth — reads session cookie
// returns { userId, email, role, doctorId }
```

No JWT forwarding needed. The route only reads from Prisma for context injection and calls the OpenAI API. It never calls apps/api.

### Hook mutations (client-side)

```ts
// uses authFetch from @/lib/auth-fetch
// authFetch → GET /api/auth/get-token → HS256 JWT signed with AUTH_SECRET
// JWT sent as Bearer token → apps/api validateAuthToken → Prisma user lookup
```

Same chain used by all other mutations in `useAppointmentsPage`. No changes needed to auth infrastructure.

---

## 3. TypeScript Action Definitions

```ts
// apps/doctor/src/hooks/useAppointmentsChat.ts

export type AppointmentChatAction =
  | CreateSlotsAction
  | BookPatientAction
  | CloseSlotAction
  | OpenSlotAction
  | DeleteSlotAction
  | CancelBookingAction
  | RescheduleBookingAction
  | BulkCloseAction
  | BulkOpenAction
  | BulkDeleteAction;

// ── Single slot creation (single OR recurring) ──────────────────────────────
export interface CreateSlotsAction {
  type: 'create_slots';
  summary: string;           // human-readable description for confirmation
  date?: string;             // 'YYYY-MM-DD' (single mode)
  startTime: string;         // 'HH:MM' 24h
  endTime: string;           // 'HH:MM' 24h
  duration: 30 | 60;
  breakStart?: string;       // 'HH:MM' — optional break within the block
  breakEnd?: string;         // 'HH:MM'
  // recurring fields (omit for single):
  recurring?: boolean;
  startDate?: string;        // 'YYYY-MM-DD'
  endDate?: string;          // 'YYYY-MM-DD'
  daysOfWeek?: number[];     // Monday=0, Tuesday=1, ..., Sunday=6
  maxBookings?: number;      // default 1
  // NOTE: basePrice is NEVER in action params — route always injects 0
}

// ── Instant booking (slot + booking in one call, always CONFIRMED) ───────────
// Always uses /bookings/instant — never /bookings (which creates PENDING status).
// PENDING is only for patient-initiated bookings from the public app.
// Instant booking reuses an existing open slot if one exists at that time,
// or creates a new slot on the fly if none exists.
export interface BookPatientAction {
  type: 'book_patient';
  summary: string;
  date: string;              // 'YYYY-MM-DD'
  startTime: string;         // 'HH:MM' 24h
  duration: 30 | 60;         // hook computes endTime = startTime + duration
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  notes?: string;
  serviceId?: string;        // optional service selection
}

// ── Close / Open single slot ─────────────────────────────────────────────────
export interface CloseSlotAction {
  type: 'close_slot';
  summary: string;
  slotId: string;
}

export interface OpenSlotAction {
  type: 'open_slot';
  summary: string;
  slotId: string;
}

// ── Delete single slot ───────────────────────────────────────────────────────
export interface DeleteSlotAction {
  type: 'delete_slot';
  summary: string;
  slotId: string;
}

// ── Cancel booking ───────────────────────────────────────────────────────────
export interface CancelBookingAction {
  type: 'cancel_booking';
  summary: string;
  bookingId: string;
}

// ── Reschedule = cancel + rebook (compound, two sequential calls) ────────────
// AI copies patient info from the booking already in context — no extra fetch.
export interface RescheduleBookingAction {
  type: 'reschedule_booking';
  summary: string;
  bookingId: string;         // booking to cancel
  newDate: string;           // 'YYYY-MM-DD'
  newStartTime: string;      // 'HH:MM'
  newDuration: 30 | 60;      // hook computes newEndTime = newStartTime + newDuration
  // patient info copied from context (AI includes these so hook needs no extra fetch):
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  serviceId?: string;    // copied from original booking context if present
}

// ── Bulk operations ──────────────────────────────────────────────────────────
export interface BulkCloseAction {
  type: 'bulk_close';
  summary: string;
  slotIds: string[];
}

export interface BulkOpenAction {
  type: 'bulk_open';
  summary: string;
  slotIds: string[];
}

export interface BulkDeleteAction {
  type: 'bulk_delete';
  summary: string;
  slotIds: string[];
}
```

---

## 4. API Route: `/api/appointments-chat`

**File:** `apps/doctor/src/app/api/appointments-chat/route.ts`

### Responsibilities
- Auth: `requireDoctorAuth(req)` → `doctorId`
- Context: fetch slots + bookings from Prisma (window: today−7 to today+60)
- Serialize context into system prompt
- Call gpt-4o with jsonMode: true
- Parse + return `{ reply: string, actions: AppointmentChatAction[] }`
- **Never** calls apps/api — no mutations here

### Context fetch (Prisma, server-side)

```ts
const windowStart = new Date();
windowStart.setDate(windowStart.getDate() - 7);
const windowEnd = new Date();
windowEnd.setDate(windowEnd.getDate() + 60);

const slots = await prisma.appointmentSlot.findMany({
  where: {
    doctorId,
    date: { gte: windowStart, lte: windowEnd },
  },
  include: {
    bookings: {
      where: { status: { notIn: ['CANCELLED'] } },
      select: {
        id: true,
        patientName: true,
        patientEmail: true,
        patientPhone: true,
        status: true,
        serviceName: true,
        serviceId: true,   // needed to preserve service on reschedule
      },
    },
  },
  orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
});
```

Serialized as compact JSON injected into the system prompt. No client payload needed for context — always fresh on every turn.

### System prompt structure

```
You are the appointments AI assistant for a medical practice.
Today is {TODAY} (America/Mexico_City).

## Slot IDs available in this window (today−7 to today+60)
{JSON: slots with id, date, startTime, endTime, isOpen, bookings[]}

## Booking IDs
{JSON: all bookings with id, slotId, patientName, patientEmail, status}

## Rules
1. Return ONLY valid JSON: { "reply": string, "actions": ActionType[] }
2. reply is the conversational response shown to the user (Spanish).
3. actions[] is empty for read-only / informational queries.
4. NEVER invent slot IDs or booking IDs — use only IDs from the context above.
5. For create_slots: omit the date field if using recurring (use startDate/endDate/daysOfWeek).
6. daysOfWeek encoding: Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6.
7. duration must be 30 or 60 (minutes). Do not set basePrice — it is always 0.
8. For reschedule_booking: provide bookingId + new date/time. The system cancels + rebooks automatically.
9. If the doctor asks something ambiguous, ask ONE clarifying question in reply and return actions: [].
10. For bulk operations (bulk_close, bulk_open, bulk_delete): collect all matching slot IDs from context.
11. maxBookings defaults to 1 if not specified.

## Dependency rules — ordering is enforced by the system; violations will be rejected
12. BEFORE close_slot or delete_slot on a slot that has active bookings in context:
    include a cancel_booking for each active booking on that slot, placed BEFORE the close/delete action.
13. BEFORE bulk_close or bulk_delete: inspect every slot in slotIds.
    For any slot with active bookings, add individual cancel_booking actions before the bulk action.
14. If you are cancelling a booking AND rebooking a patient into the same slot in the same batch:
    the cancel_booking MUST appear before the book_patient.
15. When creating slots AND immediately booking a patient into one of the new slots:
    use instant booking (omit slotId). Never reference a slot ID that does not yet exist in context.
16. Before proposing a reschedule to a specific time, check that time in context.
    If a slot exists there and is already full, say so in reply and ask the doctor to choose another time. Return actions: [].
17. For create_slots that would conflict with existing slots in context:
    only set replaceConflicts: true if the doctor explicitly asked to replace existing slots.
    Otherwise, report the conflict in reply and return actions: [].

## Examples
[few-shot examples — see §5 below]
```

### Response shape (jsonMode: true)

```json
{
  "reply": "Listo, creé 5 horarios de lunes a viernes de 10:00 a 11:00.",
  "actions": [
    {
      "type": "create_slots",
      "summary": "Crear horarios recurrentes Lu–Vi 10:00–11:00",
      "recurring": true,
      "startDate": "2026-03-16",
      "endDate": "2026-03-27",
      "daysOfWeek": [0, 1, 2, 3, 4],
      "startTime": "10:00",
      "endTime": "11:00",
      "duration": 60
    }
  ]
}
```

### Token logging

Use existing `logTokenUsage` pattern from task-chat route.

---

## 5. Few-Shot Examples (for system prompt)

### Create single slot
```
Doctor: "Abre un horario el 20 de marzo de 9 a 10"
→ { reply: "Creé un horario el 20 de marzo de 09:00 a 10:00.", actions: [{ type: "create_slots", summary: "Crear horario 20 Mar 09:00–10:00", date: "2026-03-20", startTime: "09:00", endTime: "10:00", duration: 60 }] }
```

### Create recurring slots
```
Doctor: "Crea horarios de lunes a viernes de 8 a 9 la próxima semana"
→ { reply: "Crearé 5 horarios de 08:00 a 09:00 de lunes a viernes.", actions: [{ type: "create_slots", summary: "Lu–Vi 08:00–09:00 semana del 16 Mar", recurring: true, startDate: "2026-03-16", endDate: "2026-03-20", daysOfWeek: [0,1,2,3,4], startTime: "08:00", endTime: "09:00", duration: 60 }] }
```

### Informational query (no actions)
```
Doctor: "¿Hay horarios disponibles el 25 de marzo?"
→ { reply: "El 25 de marzo tienes 3 horarios abiertos: 09:00–10:00, 10:00–11:00 y 15:00–16:00. Los tres están sin reservas.", actions: [] }
```

### Cancel booking
```
Doctor: "Cancela la cita de María García"
→ { reply: "Cancelé la cita de María García (10:00 del 18 de marzo).", actions: [{ type: "cancel_booking", summary: "Cancelar cita de María García", bookingId: "clx..." }] }
```

### Bulk close
```
Doctor: "Cierra todos los horarios de la semana del 23 al 27 de marzo"
→ { reply: "Cerraré 10 horarios de esa semana.", actions: [{ type: "bulk_close", summary: "Cerrar horarios 23–27 Mar", slotIds: ["clx1","clx2",...] }] }
```

---

## 6. Hook: `useAppointmentsChat`

**File:** `apps/doctor/src/hooks/useAppointmentsChat.ts`

### State

```ts
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [pendingActions, setPendingActions] = useState<AppointmentChatAction[] | null>(null);
// pendingActions drives the inline confirmation list in AppointmentChatPanel (see §7)
// no confirmText string — the panel renders action.summary for each item in pendingActions
const conversationRef = useRef<{ role: string; content: string }[]>([]);
```

### `sendMessage(text: string)`

1. Append user message to `conversationRef.current`
2. Set loading; append user bubble to `messages`
3. `POST /api/appointments-chat` with `{ message: text, conversationHistory: conversationRef.current }`
4. Receive `{ reply, actions }`
5. Append assistant message to conversationRef + messages
6. If `actions.length === 0` → show reply, done (retrieval/info query)
7. Run `validateActionOrder(actions, currentSlots, currentBookings)` (see §6a below)
   - If invalid → append error message into chat, do NOT show confirmation, done
8. If valid → show confirmation dialog with full ordered action list (see §7)
9. On user confirm → `executeActions(actions)`

### §6a `validateActionOrder(actions, slots, bookings)` — pre-execution guard

Runs against the **current local context** (same data the AI saw). Returns `{ valid: boolean, error?: string }`.

Checks (in order):
1. **close_slot / delete_slot**: for each, find that slot in context. If it has active bookings (status not in CANCELLED/COMPLETED/NO_SHOW), verify a `cancel_booking` for each of those bookings appears at an earlier index in `actions[]`. If not → invalid.
2. **bulk_close / bulk_delete**: for every slotId in the array, apply same check as above.
3. **book_patient**: find any existing slot in context matching `date + startTime`. If one exists and `currentBookings >= maxBookings`, verify a `cancel_booking` for one of that slot's bookings appears at an earlier index. If not → invalid.
4. **reschedule_booking**: find any existing slot in context matching `newDate + newStartTime`. If one exists and `currentBookings >= maxBookings`, and there is no `cancel_booking` for one of that slot's bookings at an earlier index → invalid. Error message should tell the doctor the target time is already full and ask them to choose another.

On invalid: append an assistant message explaining which action failed the check and why, e.g.:
> "No se puede cerrar el horario de las 10:00 del 18 Mar porque la cita de María García sigue activa. Por favor indícame si también quieres cancelarla."

The AI then gets another turn to produce a corrected batch.

### `executeActions(actions: AppointmentChatAction[])`

```ts
async function executeActions(actions: AppointmentChatAction[]) {
  let anySuccess = false;
  for (const action of actions) {
    const result = await dispatchAction(action);
    if (!result.ok) {
      // stop at first failure; report partial results
      appendAssistantMessage(`Error al ejecutar "${action.summary}": ${result.error}`);
      break;
    }
    anySuccess = true;
  }
  if (anySuccess) {
    await onRefresh(); // single fetchSlots() + fetchBookings() after all actions
  }
}
```

### `dispatchAction(action)` — maps action.type to authFetch call

| action.type | HTTP call |
|---|---|
| `create_slots` | `POST ${API_URL}/api/appointments/slots` (hook injects `basePrice: 0`, forwards `maxBookings` if present — default 1) |
| `book_patient` | `POST ${API_URL}/api/appointments/bookings/instant` `{ doctorId, date, startTime, endTime, duration, patientName, patientEmail, patientPhone, notes?, serviceId? }` — hook computes `endTime` from `startTime + duration`; always CONFIRMED |
| `close_slot` | `PATCH ${API_URL}/api/appointments/slots/${slotId}` `{ isOpen: false }` |
| `open_slot` | `PATCH ${API_URL}/api/appointments/slots/${slotId}` `{ isOpen: true }` |
| `delete_slot` | `DELETE ${API_URL}/api/appointments/slots/${slotId}` |
| `cancel_booking` | `PATCH ${API_URL}/api/appointments/bookings/${bookingId}` `{ status: "CANCELLED" }` |
| `reschedule_booking` | sequential: PATCH cancel → POST `/bookings/instant` with patient info from action params (hook computes newEndTime from newStartTime + newDuration) |
| `bulk_close` | `POST ${API_URL}/api/appointments/slots/bulk` `{ action: "close", slotIds }` |
| `bulk_open` | `POST ${API_URL}/api/appointments/slots/bulk` `{ action: "open", slotIds }` |
| `bulk_delete` | `POST ${API_URL}/api/appointments/slots/bulk` `{ action: "delete", slotIds }` |

### `reschedule_booking` — compound execution

```ts
// Helper: compute endTime string from startTime + duration minutes
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Step 1: cancel existing booking
const cancelRes = await authFetch(
  `${API_URL}/api/appointments/bookings/${action.bookingId}`,
  { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) }
);
if (!cancelRes.ok) return { ok: false, error: 'No se pudo cancelar la cita original' };

// Patient info comes directly from action params (AI copied from context — no extra fetch needed)
const newEndTime = addMinutes(action.newStartTime, action.newDuration);

// Step 2: create new instant booking
// doctorId is required by the instant booking endpoint — hook injects it from session
const bookRes = await authFetch(
  `${API_URL}/api/appointments/bookings/instant`,
  {
    method: 'POST',
    body: JSON.stringify({
      doctorId,                     // injected by hook from session
      date: action.newDate,
      startTime: action.newStartTime,
      duration: action.newDuration,
      patientName: action.patientName,
      patientEmail: action.patientEmail,
      patientPhone: action.patientPhone,
      serviceId: action.serviceId ?? undefined,
    })
  }
);
if (!bookRes.ok) {
  // Booking cancelled but new one failed — report clearly, do NOT try to undo cancel
  return { ok: false, error: 'Cita cancelada pero no se pudo agendar en el nuevo horario. Reagenda manualmente.' };
}
return { ok: true };
```

### `onRefresh` prop

Hook receives `onRefresh: () => Promise<void>` (calls `fetchSlots()` + `fetchBookings()` from `useAppointmentsPage`). Called **once** after all actions complete (not per-action).

### Voice input

Use existing `useVoiceRecording` hook (same as useTaskChat). Transcript fed directly into `sendMessage`.

---

## 7. Confirmation Rules

**All non-empty `actions[]` batches require confirmation — no exceptions.**

The hook never auto-executes mutations. Every batch goes through the confirmation dialog before anything runs. This:
- Matches the existing pattern in the rest of the doctor app
- Gives the doctor a chance to review the full ordered action list before it fires
- Makes behavior predictable regardless of action type

### Confirmation UI

Shows the ordered action list using each action's `summary` field:

```
El asistente propone:

  1. Cancelar cita de María García (10:00 del 18 Mar)
  2. Cerrar horario 18 Mar 10:00–11:00
  3. Crear horarios Lu–Vi 09:00–10:00 semana del 23 Mar

[Confirmar]   [Cancelar]
```

`practiceConfirm` is NOT used — the appointments chat needs a list UI, not a simple yes/no modal. The `AppointmentChatPanel` renders an inline confirmation section so the doctor can see the full action list while still seeing the chat history above it.

**Note on dependency annotations**: the `← requerido por #N` labels shown in earlier drafts were removed. To render them, `validateActionOrder` would need to return a full dependency graph instead of `{ valid, error }`. The ordered list alone is sufficient — the doctor sees the sequence and can cancel if something looks wrong. Annotations can be added later as a UI enhancement if needed.

---

## 8. UI Component: `AppointmentChatPanel`

**File:** `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx`

### Layout (mirrors TaskChatPanel)

```
┌─────────────────────────────────────────────────┐
│  Chat IA — Citas              [collapse button]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  [message bubbles]                               │
│                                                  │
│  [suggestion chips — shown only on empty state]  │
│                                                  │
├─────────────────────────────────────────────────┤
│  [text input]         [voice 🎙] [send →]        │
└─────────────────────────────────────────────────┘
```

### Suggestion chips (empty state)

- "¿Qué horarios tengo disponibles hoy?"
- "Crea horarios de lunes a viernes de 9 a 10 esta semana"
- "Muéstrame las citas confirmadas de los próximos 7 días"
- "Cierra todos los horarios de la semana que viene"

### Confirmation UI

Rendered inline inside the panel (not a blocking modal) — see §7 for full spec. The panel shows the ordered action list with `summary` fields before anything executes.

### Props

```ts
interface AppointmentChatPanelProps {
  isOpen: boolean;          // controls visibility — component stays mounted to preserve history
  onClose: () => void;
  onRefresh: () => Promise<void>;
}
```

Panel uses `isOpen` to toggle CSS visibility (`hidden` / `flex`), never unmounts.

### Panel placement

- Desktop: fixed right panel (same width as TaskChatPanel), collapsible
- Mobile: bottom sheet or hidden behind toggle button

---

## 9. Integration Points in Existing Files

### `useAppointmentsPage.ts` — changes needed

```ts
// Add state:
const [chatPanelOpen, setChatPanelOpen] = useState(false);

// Expose onRefresh for hook:
const onRefresh = useCallback(async () => {
  await fetchSlots();
  await fetchBookings();
}, [fetchSlots, fetchBookings]);

// Add to return:
return {
  ...existingReturn,
  chatPanelOpen,
  setChatPanelOpen,
  onRefresh,
};
```

### `page.tsx` (appointments) — changes needed

```tsx
// Add "Chat IA" button in the header actions area
<button onClick={() => setChatPanelOpen(true)}>
  Chat IA
</button>

// Mount panel always — use isOpen prop to show/hide (preserves conversation history across toggle):
<AppointmentChatPanel
  isOpen={chatPanelOpen}
  onClose={() => setChatPanelOpen(false)}
  onRefresh={onRefresh}
/>
```

---

## 10. New Files Summary

| File | Purpose |
|---|---|
| `apps/doctor/src/app/api/appointments-chat/route.ts` | Chat route — auth, context fetch, gpt-4o call |
| `apps/doctor/src/hooks/useAppointmentsChat.ts` | Hook — state, sendMessage, dispatchAction, executeActions |
| `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx` | UI panel component |

## 11. Modified Files Summary

| File | Change |
|---|---|
| `apps/doctor/src/app/appointments/useAppointmentsPage.ts` | Add `chatPanelOpen`, `setChatPanelOpen`, `onRefresh` |
| `apps/doctor/src/app/appointments/page.tsx` | Add Chat IA button + mount `<AppointmentChatPanel>` |

**No changes needed to:**
- `apps/api` (all endpoints exist and are correct)
- Auth infrastructure (`auth-fetch.ts`, `medical-auth.ts`, `get-token/route.ts`)
- Database schema (no new fields required)
- GCal sync (preserved automatically through apps/api endpoints)

---

## 12. Error Handling

### API-level errors (from apps/api)

- 409 Conflict on slot creation → AI told about conflict in next turn; no retry
- 400 "active bookings" on delete/close → surface error to user in chat bubble
- 400 "slotId required" → AI re-prompted to provide slotId

### Partial batch failure

Stop at first failure. Report: "Completé N de M acciones. Falló en: [action.summary]. Los cambios anteriores ya se aplicaron."

### Network / OpenAI failure

Show generic error bubble. Do not retry automatically.

### reschedule second-step failure

Report clearly: "La cita fue cancelada pero no se pudo agendar en el nuevo horario. Por favor reagenda manualmente."

---

## 13. Implementation Order

1. Create `apps/doctor/src/app/api/appointments-chat/route.ts`
2. Create `apps/doctor/src/hooks/useAppointmentsChat.ts`
3. Create `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx`
4. Modify `apps/doctor/src/app/appointments/useAppointmentsPage.ts`
5. Modify `apps/doctor/src/app/appointments/page.tsx`

No DB migrations. No Railway changes. No env vars (reuses `OPENAI_API_KEY` already in env).

---

## 14. Design Decisions Log

| Decision | Rationale |
|---|---|
| Hook executes mutations, not chat route | Preserves GCal sync/SMS/activity logging through apps/api; avoids server-to-server JWT complexity; consistent with all other pages |
| Context fetched server-side per turn | Always fresh after mutations; no client payload bloat (150+ items avoided) |
| gpt-4o (not gpt-4o-mini) | Requires slot ID resolution from natural language, multi-step chaining, ambiguity handling |
| Confirmation hardcoded in hook | UX policy should not be delegated to AI; consistent, predictable behavior |
| Single post-batch refresh | Avoids race conditions; reduces API calls; simpler than per-action refresh |
| basePrice always 0 in route | AI should never set pricing; matches existing instant booking behavior |
| reschedule = cancel + instant booking | Atomic-enough: cancel first so slot freed immediately; if rebook fails, report clearly |
| daysOfWeek Monday=0 | Matches `adjustedDay` logic in existing slots POST handler |
| Window today−7 to today+60 | Past week for rescheduling context; 2 months ahead for planning; bounded to prevent prompt overflow |
| bulk_open included | Symmetry with bulk_close/bulk_delete; maps to existing `POST /slots/bulk { action: "open" }` |
| Panel stays mounted (isOpen prop) | Closing and reopening with conditional render (`&&`) destroys hook state and loses conversation history; CSS visibility toggle preserves it |
| serviceId in Prisma select + reschedule action | Original booking's service must be preserved on reschedule; AI copies serviceId from context into RescheduleBookingAction params |
| All mutations require confirmation (no auto-execute) | Matches existing app pattern; doctor reviews full ordered list before anything fires; predictable regardless of action type |
| Dependency validation in hook before confirmation | AI may return actions in wrong order despite system prompt rules; hook validates against live context and rejects invalid batches with a clear error message before the confirm dialog appears |
| Inline confirmation panel (not practiceConfirm modal) | Multi-action batches need a list UI with dependency annotations; a simple yes/no modal is insufficient |
| Always instant booking, never slotId booking | Two booking flows exist: patient-initiated (public app → PENDING, doctor reviews) and doctor-initiated (doctor portal → CONFIRMED, auto-approved). Chat AI is always doctor-initiated so always uses /bookings/instant (CONFIRMED). slotId path removed from BookPatientAction entirely. |
