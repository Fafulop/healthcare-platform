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

// ── Instant booking (slot + booking in one call) ─────────────────────────────
export interface BookPatientAction {
  type: 'book_patient';
  summary: string;
  slotId?: string;           // if booking into an existing open slot
  // if slotId absent → instant booking (creates slot on-the-fly):
  date?: string;             // 'YYYY-MM-DD'
  startTime?: string;        // 'HH:MM' 24h
  duration?: 30 | 60;        // hook computes endTime = startTime + duration
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
const [confirmText, setConfirmText] = useState('');
const conversationRef = useRef<{ role: string; content: string }[]>([]);
```

### `sendMessage(text: string)`

1. Append user message to `conversationRef.current`
2. Set loading; append user bubble to `messages`
3. `POST /api/appointments-chat` with `{ message: text, conversationHistory: conversationRef.current }`
4. Receive `{ reply, actions }`
5. Append assistant message to conversationRef + messages
6. If `actions.length === 0` → done
7. Check confirmation rules (see §7)
8. If confirmation needed → `setPendingActions(actions); setConfirmText(summary)`
9. Else → `executeActions(actions)`

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
| `book_patient` (slotId present) | `POST ${API_URL}/api/appointments/bookings` `{ slotId, patientName, patientEmail, patientPhone, notes?, serviceId? }` |
| `book_patient` (no slotId) | `POST ${API_URL}/api/appointments/bookings/instant` (hook computes `endTime` from `startTime + duration`) |
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
const bookRes = await authFetch(
  `${API_URL}/api/appointments/bookings/instant`,
  {
    method: 'POST',
    body: JSON.stringify({
      date: action.newDate,
      startTime: action.newStartTime,
      endTime: newEndTime,
      patientName: action.patientName,
      patientEmail: action.patientEmail,
      patientPhone: action.patientPhone,
      basePrice: 0,
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

**Hardcoded in hook — AI does not control this.**

| action.type | Requires confirmation? |
|---|---|
| `create_slots` | No (easily undoable) |
| `book_patient` | No |
| `close_slot` | No |
| `open_slot` | No |
| `delete_slot` | **Yes** — "¿Eliminar este horario?" |
| `cancel_booking` | **Yes** — "¿Cancelar la cita de {patientName}?" |
| `reschedule_booking` | **Yes** — "¿Reagendar cita de {patientName} al {newDate} {newStartTime}?" |
| `bulk_close` | No |
| `bulk_open` | No |
| `bulk_delete` | **Yes** — "¿Eliminar {n} horarios?" |

When multiple actions arrive and any requires confirmation, ALL actions in that batch wait for one combined confirmation dialog showing the full list.

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

### Confirmation dialog

Reuse `practiceConfirm` from `@/lib/practice-confirm` — same modal already used across doctor app.

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
