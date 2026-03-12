# Appointments Chat IA — Implementation Progress

> Last updated: 2026-03-12
> Full design spec: `APPOINTMENTS-CHAT-IA-PLAN.md`

---

## Status overview

| Step | File | Status |
|------|------|--------|
| 1 | `apps/doctor/src/app/api/appointments-chat/route.ts` | ✅ Done — commit `ad98af45` |
| 2 | `apps/doctor/src/hooks/useAppointmentsChat.ts` | ✅ Done — commit `12813dab` |
| 3 | `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx` | ✅ Done — commit `ac8bf62a` |
| 4 | `apps/doctor/src/app/appointments/useAppointmentsPage.ts` | ✅ Done — commit `7b91fa90` |
| 5 | `apps/doctor/src/app/appointments/page.tsx` | ✅ Done — commit `7b91fa90` |

---

## Step 1 — Chat route ✅

**File:** `apps/doctor/src/app/api/appointments-chat/route.ts`

**What it does:**
- `requireDoctorAuth(request)` → `doctorId`
- Validates `{ message, conversationHistory }` request body
- Fetches slots + active bookings from Prisma for window `today−7` to `today+60`
- Builds system prompt (18 rules + 8 few-shot examples) as named constants: `RESPONSE_RULES`, `DEPENDENCY_RULES`, `FEW_SHOT_EXAMPLES`
- Calls `gpt-4o` with `jsonMode: true`
- Returns `{ success: true, data: { reply: string, actions: AppointmentChatAction[] } }`
- Logs token usage (fire-and-forget)

**Key decisions baked in:**
- Booking filter: `notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW']` — only CONFIRMED/PENDING shown to AI as "active"
- `windowStart` normalized to `setUTCHours(0, 0, 0, 0)` to avoid missing midnight-UTC slots
- `now` computed once and passed to `fetchContext` — `today` string derived from same value
- `today` uses `toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })` — **not** `toISOString()` (UTC) — so AI always sees the correct local date (fix: UTC date was wrong 6h/day)

---

## Step 2 — Hook ✅

**File:** `apps/doctor/src/hooks/useAppointmentsChat.ts`

**What it does:**
- Manages chat state: `messages`, `loading`, `pendingActions`
- `sendMessage(text)`: POST to `/api/appointments-chat` → receive `{ reply, actions }` → run `validateActionOrder` → set `pendingActions` if valid
- `confirmActions()`: calls `executeActions(pendingActions)`
- `cancelActions()`: clears `pendingActions`, appends cancellation message to chat
- `executeActions(actions)`: sets `loading=true`, sequential dispatch, stops on first failure, calls `onRefresh()` once after, then `loading=false` + `setPendingActions(null)`
- `dispatchAction(action, doctorId)`: standalone async function (outside hook, independently testable) — maps each action type to its `authFetch` call
- Voice recording: same pattern as `useTaskChat`
- `clearChat()`: resets messages, pendingActions, and conversationRef

**Key decisions baked in:**
- `sendMessage` guards: `if (loading || pendingActions) return` — blocks new messages while AI call or execution is in flight
- `executeActions` sets `loading=true` during dispatch — prevents double-execution if doctor taps Confirmar twice
- `toResult(res, fallback)`: shared helper reduces repetitive authFetch+json+error extraction
- `TERMINAL_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW']` — matches route's booking filter exactly
- `doctorId` injected by hook from `useSession()` into every instant booking call
- `conversationHistory: conversationRef.current.slice(0, -1)` — excludes the just-pushed user message; route appends it as the final turn
- `appendAssistantMessage(reply)` used consistently in `sendMessage` — original had 3 inline lines duplicating the helper (cleaned up)

**Hook options (props):**
```ts
interface UseAppointmentsChatOptions {
  slots: AppointmentSlot[];   // from useAppointmentsPage
  bookings: Booking[];        // from useAppointmentsPage
  onRefresh: () => Promise<void>;
}
```

**Hook return:**
```ts
{
  messages,        // ChatMessage[] — for rendering bubbles
  loading,         // boolean — AI call or action execution in flight
  pendingActions,  // AppointmentChatAction[] | null — drives confirmation UI
  sendMessage,     // (text: string) => Promise<void>
  confirmActions,  // () => void — doctor confirmed the batch
  cancelActions,   // () => void — doctor rejected the batch
  clearChat,       // () => void
  voice: { isRecording, isProcessing, duration, startRecording, stopRecording, cancelRecording }
}
```

---

## Step 3 — Panel ✅

**File:** `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx`

**What it does:**
- Props: `{ isOpen, onClose, onRefresh, slots, bookings }`
- Instantiates `useAppointmentsChat({ slots, bookings, onRefresh })`
- CSS visibility toggle on `isOpen` (`hidden`/`flex`) — never unmounts, preserves conversation history
- Collapsible header with message count badge (same pattern as TaskChatPanel)
- Draggable height on mobile
- Empty state with 4 suggestion chips
- Message bubbles with markdown-like renderer (`**bold**`, `-` lists, numbered lists)
- Thinking/transcribing indicator while `isBusy`
- **Inline confirmation section** (amber card) when `pendingActions !== null`:
  - Numbered list of `action.summary` items
  - Confirmar button: shows spinner + "Ejecutando..." and is disabled while `loading=true`
  - Cancelar button: disabled while `loading=true`
- Text input + VoiceRecordButton + send button
- Input disabled with contextual placeholder when `pendingActions !== null` or `isBusy`

**Key decisions baked in:**
- `slots` and `bookings` passed as props (not in original plan spec, but required by hook)
- Confirmar/Cancelar disabled during execution (`loading=true`) — prevents double-dispatch
- `isBusy = loading || voice.isRecording || voice.isProcessing`

---

## Step 4 — useAppointmentsPage changes ✅

**File:** `apps/doctor/src/app/appointments/useAppointmentsPage.ts`

**What was added (additive only):**
- `chatPanelOpen` / `setChatPanelOpen` state — grouped with other modal/panel states near `voiceModalOpen`
- `onRefresh` callback — placed immediately after `fetchBookings`, deps are `[doctorId, selectedDate]` (not unstable function refs)
- Both exported in the return object under `// Chat IA panel`

**Key decisions baked in:**
- `onRefresh` deps use `doctorId` + `selectedDate` directly — avoids recreating on every render (using `fetchSlots`/`fetchBookings` as deps would be broken since they're plain functions, not `useCallback`)

---

## Step 5 — page.tsx changes ✅

**File:** `apps/doctor/src/app/appointments/page.tsx`

**What was added:**
- Import `AppointmentChatPanel` from `./AppointmentChatPanel`
- Destructure `chatPanelOpen`, `setChatPanelOpen`, `onRefresh` from `useAppointmentsPage()`
- Indigo "Chat IA Citas" button in header → `setChatPanelOpen(true)` (distinct from existing purple voice "Chat IA" button)
- `<AppointmentChatPanel>` always mounted at bottom of JSX (outside `{doctorId && ...}` guard — hook has its own `useSession`)

**Key decisions baked in:**
- Panel is unconditional (no `doctorId` guard) — `useAppointmentsChat` gets `doctorId` from its own `useSession()` call
- `slots` and `bookings` passed as live state — auto-update after `onRefresh` runs
- Button labeled "Chat IA Citas" to distinguish from the existing voice assistant button

---

---

## Post-implementation fixes

### `confirm_booking` action type — 2026-03-12

**Bug:** AI correctly returned `{ type: 'confirm_booking', bookingId }` but the hook's `dispatchAction` switch had no case for it → hit `default` → "Acción desconocida: confirm_booking".

**Fix applied to `useAppointmentsChat.ts`:**
- Added `ConfirmBookingAction` interface (`type`, `summary`, `bookingId`)
- Added to `AppointmentChatAction` union type
- Added `case 'confirm_booking'`: PATCH `/api/appointments/bookings/${bookingId}` with `{ status: 'CONFIRMED' }`

**Fix applied to `route.ts`:**
- Added rule 9: "Para confirm_booking: proporciona bookingId. Cambia el estado de PENDING a CONFIRMED."
- Renumbered subsequent rules (RESPONSE_RULES 1–12, DEPENDENCY_RULES 13–18, continuous)
- Added few-shot example for confirming a pending booking

---

## No changes needed to

- `apps/api` — all endpoints already exist and are correct (PATCH bookings/{id} with status=CONFIRMED was already implemented)
- Auth infrastructure — `auth-fetch.ts`, `medical-auth.ts`, `get-token/route.ts` unchanged
- Database schema — no new fields
- GCal sync — preserved automatically through apps/api endpoints
- Railway env vars — reuses `OPENAI_API_KEY` already set
