# Appointments Chat IA — Implementation Progress

> Last updated: 2026-03-12
> Full design spec: `APPOINTMENTS-CHAT-IA-PLAN.md`

---

## Status overview

| Step | File | Status |
|------|------|--------|
| 1 | `apps/doctor/src/app/api/appointments-chat/route.ts` | ✅ Done — commit `ad98af45` |
| 2 | `apps/doctor/src/hooks/useAppointmentsChat.ts` | ✅ Done — uncommitted |
| 3 | `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx` | ⏳ Next |
| 4 | `apps/doctor/src/app/appointments/useAppointmentsPage.ts` | ⏳ Pending |
| 5 | `apps/doctor/src/app/appointments/page.tsx` | ⏳ Pending |

---

## Step 1 — Chat route ✅

**File:** `apps/doctor/src/app/api/appointments-chat/route.ts`

**What it does:**
- `requireDoctorAuth(request)` → `doctorId`
- Validates `{ message, conversationHistory }` request body
- Fetches slots + active bookings from Prisma for window `today−7` to `today+60`
- Builds system prompt (17 rules + 7 few-shot examples) as named constants: `RESPONSE_RULES`, `DEPENDENCY_RULES`, `FEW_SHOT_EXAMPLES`
- Calls `gpt-4o` with `jsonMode: true`
- Returns `{ success: true, data: { reply: string, actions: AppointmentChatAction[] } }`
- Logs token usage (fire-and-forget)

**Key decisions baked in:**
- Booking filter: `notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW']` — only CONFIRMED/PENDING shown to AI as "active"
- `windowStart` normalized to `setUTCHours(0, 0, 0, 0)` to avoid missing midnight-UTC slots
- `now` computed once and passed to `fetchContext` — `today` string derived from same value

---

## Step 2 — Hook ✅

**File:** `apps/doctor/src/hooks/useAppointmentsChat.ts`

**What it does:**
- Manages chat state: `messages`, `loading`, `pendingActions`
- `sendMessage(text)`: POST to `/api/appointments-chat` → receive `{ reply, actions }` → run `validateActionOrder` → set `pendingActions` if valid
- `confirmActions()`: calls `executeActions(pendingActions)`
- `cancelActions()`: clears `pendingActions`, appends cancellation message to chat
- `executeActions(actions)`: sequential dispatch, stops on first failure, calls `onRefresh()` once after
- `dispatchAction(action, doctorId)`: standalone async function (outside hook, independently testable) — maps each action type to its `authFetch` call
- Voice recording: same pattern as `useTaskChat`
- `clearChat()`: resets messages, pendingActions, and conversationRef

**Key decisions baked in:**
- `sendMessage` guards: `if (loading || pendingActions) return` — blocks new messages while confirmation is pending
- `toResult(res, fallback)`: shared helper reduces repetitive authFetch+json+error extraction
- `TERMINAL_STATUSES = ['CANCELLED', 'COMPLETED', 'NO_SHOW']` — matches route's booking filter exactly
- `doctorId` injected by hook from `useSession()` into every instant booking call
- `conversationHistory: conversationRef.current.slice(0, -1)` — excludes the just-pushed user message; route appends it as the final turn

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
  loading,         // boolean — AI request in flight
  pendingActions,  // AppointmentChatAction[] | null — drives confirmation UI
  sendMessage,     // (text: string) => Promise<void>
  confirmActions,  // () => void — doctor confirmed the batch
  cancelActions,   // () => void — doctor rejected the batch
  clearChat,       // () => void
  voice: { isRecording, isProcessing, duration, startRecording, stopRecording, cancelRecording }
}
```

---

## Step 3 — Panel (next) ⏳

**File:** `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx`

**What it needs to do:**
- Accept props: `{ isOpen, onClose, onRefresh }`
- Instantiate `useAppointmentsChat({ slots, bookings, onRefresh })` — needs slots+bookings passed in from page
- Render message bubbles
- Render suggestion chips on empty state
- Render inline confirmation list when `pendingActions !== null` (ordered, with `summary` per action)
- Render text input + voice button + send button
- Use CSS visibility toggle (`hidden`/`flex`) on `isOpen` — never unmount (preserves conversation history)
- Mirror layout of `TaskChatPanel`

**Reference:** `apps/doctor/src/app/appointments/AppointmentChatPanel.tsx` does not exist yet. Closest reference: any existing `*ChatPanel` or task chat panel in the doctor app.

---

## Step 4 — useAppointmentsPage changes ⏳

**File:** `apps/doctor/src/app/appointments/useAppointmentsPage.ts`

**Changes needed (additive only):**
```ts
// Add:
const [chatPanelOpen, setChatPanelOpen] = useState(false);

const onRefresh = useCallback(async () => {
  await fetchSlots();
  await fetchBookings();
}, [fetchSlots, fetchBookings]);

// Add to return:
return { ...existingReturn, chatPanelOpen, setChatPanelOpen, onRefresh };
```

---

## Step 5 — page.tsx changes ⏳

**File:** `apps/doctor/src/app/appointments/page.tsx`

**Changes needed:**
- Import `AppointmentChatPanel`
- Add "Chat IA" button in the header (calls `setChatPanelOpen(true)`)
- Mount `<AppointmentChatPanel isOpen={chatPanelOpen} onClose={() => setChatPanelOpen(false)} onRefresh={onRefresh} />` — always mounted, never conditionally rendered

---

## No changes needed to

- `apps/api` — all endpoints already exist and are correct
- Auth infrastructure — `auth-fetch.ts`, `medical-auth.ts`, `get-token/route.ts` unchanged
- Database schema — no new fields
- GCal sync — preserved automatically through apps/api endpoints
- Railway env vars — reuses `OPENAI_API_KEY` already set
