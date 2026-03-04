# Google Calendar Integration Guide

**Implemented:** 2026-03-03
**Scope:** Doctor app + API app
**Type:** OAuth per doctor, bidirectional sync, dedicated "tusalud.pro" calendar

---

## Overview

Each doctor can connect their own Google account. When connected, a dedicated calendar called **"tusalud.pro"** is created inside their Google Calendar account. All appointment slots, confirmed/pending bookings, and tasks (pendientes) sync automatically in both directions.

```
tusalud.pro DB ──────────────────────────── Google Calendar ("tusalud.pro")

  Slot created        ──── push ────►  Event created (Disponible / Bloqueado)
  Booking CONFIRMED   ──── push ────►  Event updated ("Cita: Nombre Paciente")
  Booking CANCELLED   ──── push ────►  Event updated (reverts to "Disponible")
  Booking deleted     ──── push ────►  Event deleted
  Task created        ──── push ────►  Event created (🔴/🟡/🟢 title + priority color)
  Task completed      ──── push ────►  Event deleted
  Task deleted        ──── push ────►  Event deleted

  Event moved in GCal ── webhook ──►  Slot/Task date+time updated in DB
  Event deleted in GCal ─ webhook ──►  Slot closed / Task cancelled in DB
```

---

## Architecture Decision: Option A (OAuth per Doctor)

Three options were considered:

| Option | Description | Decision |
|---|---|---|
| **A — OAuth per doctor** | Each doctor connects their own Google account via OAuth | ✅ Chosen |
| B — Service Account | One Google Workspace account manages all calendars | ❌ Requires paid Google Workspace |
| C — iCal feed | Read-only public `.ics` URL | ❌ One-way only |

**Why Option A:** Events appear in the doctor's own Google Calendar app (phone/desktop). Full bidirectional sync. Standard SaaS pattern. No extra Google services needed.

---

## What Was Already There (Reused)

| Existing asset | How it was reused |
|---|---|
| `googleapis` package in `apps/api` | Same package used for Analytics — also has Calendar API. Zero new installs. |
| NextAuth v5 Google OAuth | Already had `access_type: "offline"` and `prompt: "consent"` — gets refresh tokens by default. Just needed a scope added. |
| `apps/api/src/lib/analytics/google-auth.ts` | Established the pattern for using `googleapis`. `google-calendar.ts` follows the same structure. |
| `getAuthenticatedDoctor()` in `apps/api/src/lib/auth.ts` | Used directly in all new calendar endpoints. |
| `authFetch` in doctor app | All new frontend API calls use the existing helper. |

---

## Database Changes

### Migration file
`packages/database/prisma/migrations/add-google-calendar-fields.sql`

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMP(3);

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS google_calendar_id      TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE medical_records.tasks
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
```

### Schema changes (`packages/database/prisma/schema.prisma`)

**User model** — stores OAuth tokens:
```prisma
googleAccessToken  String?   @map("google_access_token")
googleRefreshToken String?   @map("google_refresh_token")
googleTokenExpiry  DateTime? @map("google_token_expiry")
```

**Doctor model** — stores calendar ID and enabled flag:
```prisma
googleCalendarId      String?  @map("google_calendar_id")
googleCalendarEnabled Boolean  @default(false) @map("google_calendar_enabled")
```

**AppointmentSlot model** — stores Google event ID for sync updates:
```prisma
googleEventId String? @map("google_event_id")
```

**Task model** (medical_records schema) — stores Google event ID:
```prisma
googleEventId String? @map("google_event_id")
```

### Why tokens on User, not Doctor?
Tokens belong to the Google account, which is linked to the `User` row (not `Doctor`). A Doctor profile can exist without a User account, so storing on User is the correct relationship.

### Why `googleEventId` on slots and tasks?
When Google Calendar events are created, Google returns an event ID. We store it so we can call `events.update()` and `events.delete()` by that ID later. Without it, we'd have no way to update a specific event.

---

## Files Created / Modified

### New files

| File | Purpose |
|---|---|
| `packages/database/prisma/migrations/add-google-calendar-fields.sql` | SQL migration — 7 new columns across 4 tables |
| `apps/api/src/lib/google-calendar.ts` | Core Google Calendar service using `googleapis` |
| `apps/api/src/app/api/auth/google-calendar/tokens/route.ts` | Saves OAuth tokens to DB on sign-in |
| `apps/api/src/app/api/doctors/[slug]/google-calendar/status/route.ts` | Returns connection status |
| `apps/api/src/app/api/doctors/[slug]/google-calendar/connect/route.ts` | Creates calendar + runs initial sync |
| `apps/api/src/app/api/doctors/[slug]/google-calendar/disconnect/route.ts` | Removes integration, clears tokens |
| `apps/api/src/app/api/calendar/webhook/route.ts` | Receives Google push notifications (bidirectional) |
| `apps/doctor/src/lib/google-calendar-sync.ts` | Lightweight sync helper using raw fetch (no googleapis) |

### Modified files

| File | Change |
|---|---|
| `packages/auth/src/nextauth-config.ts` | Added Calendar OAuth scope + token capture in jwt callback |
| `packages/database/prisma/schema.prisma` | Added 7 new fields across User, Doctor, AppointmentSlot, Task |
| `apps/api/src/app/api/appointments/slots/[id]/route.ts` | Sync hooks on PUT, PATCH, DELETE |
| `apps/api/src/app/api/appointments/bookings/[id]/route.ts` | Sync hooks on PATCH (status change), DELETE |
| `apps/doctor/src/app/api/medical-records/tasks/route.ts` | Sync hook on POST (create) |
| `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts` | Sync hooks on PUT (update), DELETE |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Added "Integraciones" tab with connect/disconnect UI |

---

## How the OAuth Token Flow Works

```
Doctor signs in with Google (or re-authenticates)
         │
         ▼
NextAuth jwt() callback fires — account.access_token is available HERE ONLY
         │
         ├─► Saves userId, role, doctorId to JWT (existing behavior)
         │
         └─► POST /api/auth/google-calendar/tokens
                  │
                  └─► prisma.user.update({
                        googleAccessToken,
                        googleRefreshToken,   ← only updated if new one issued
                        googleTokenExpiry
                      })
```

**Critical detail:** `account.access_token` is only available in the `jwt` callback on the very first call after OAuth login. On subsequent calls (token refresh, session access), `account` is undefined. This is why we persist tokens to the DB immediately.

### Google OAuth scope added
```typescript
scope: "openid email profile https://www.googleapis.com/auth/calendar"
```

This scope is set in `packages/auth/src/nextauth-config.ts`. Doctors who signed in before this change will need to re-authenticate once to grant Calendar access. The UI handles this case (see Integraciones tab section).

---

## google-calendar.ts — Core Service

**Location:** `apps/api/src/lib/google-calendar.ts`

### Key functions

| Function | Purpose |
|---|---|
| `createDedicatedCalendar(accessToken, refreshToken)` | Creates "tusalud.pro" calendar in doctor's Google account. Returns `calendarId`. |
| `deleteDedicatedCalendar(...)` | Deletes the calendar on disconnect. |
| `createSlotEvent(...)` | Creates a Google Calendar event for an appointment slot. |
| `updateSlotEvent(...)` | Updates a slot event (title, time, color). |
| `createTaskEvent(...)` | Creates an event for a task/pendiente. |
| `updateTaskEvent(...)` | Updates a task event. |
| `deleteEvent(...)` | Deletes any event by ID. |
| `resolveTokens(user)` | Gets a valid access token, refreshing if expired. Returns `updatedToken` if refreshed. |
| `refreshAccessToken(refreshToken)` | Calls Google token endpoint to get a new access token. |
| `watchCalendar(...)` | Sets up Google push notifications for bidirectional sync. |
| `stopCalendarWatch(...)` | Stops a push notification channel. |

### Event color coding

**Slots:**
- `colorId: "7"` (Teal/Peacock) — Available slot
- `colorId: "2"` (Green/Sage) — Booked slot with patient
- `colorId: "8"` (Grey/Graphite) — Blocked/closed slot

**Tasks:**
- `colorId: "11"` (Red/Tomato) — ALTA priority
- `colorId: "5"` (Yellow/Banana) — MEDIA priority
- `colorId: "10"` (Green/Basil) — BAJA priority

### Event title format

- Available slot: `"Disponible"`
- Booked slot: `"Cita: {patientName}"`
- Blocked slot: `"Bloqueado"`
- Task: `"🔴 {title}"` / `"🟡 {title}"` / `"🟢 {title}"`

### Extended properties (how we track ownership)

Every event created by tusalud.pro includes:
```json
{
  "extendedProperties": {
    "private": {
      "source": "tusalud.pro",
      "slotId": "cuid..."      // OR
      "taskId": "cuid..."
    }
  }
}
```
This is how the webhook identifies which DB record to update when an event changes.

### Token refresh pattern
```typescript
const { accessToken, refreshToken, updatedToken } = await resolveTokens(user);

if (updatedToken) {
  // Persist refreshed token back to DB
  await prisma.user.update({
    where: { id: user.id },
    data: { googleAccessToken: updatedToken.accessToken, googleTokenExpiry: updatedToken.expiresAt },
  });
}
```
This pattern is used in every route that calls Google Calendar.

---

## google-calendar-sync.ts — Doctor App Helper

**Location:** `apps/doctor/src/lib/google-calendar-sync.ts`

Tasks live in `apps/doctor` (not `apps/api`), which doesn't have `googleapis` installed. Rather than installing a new package, this helper uses the raw **Google Calendar REST API via `fetch`** — functionally identical but zero dependencies.

### Functions
- `syncTaskCreated(doctorId, task)` — Creates Google event, saves `googleEventId` to DB
- `syncTaskUpdated(doctorId, task)` — Updates event; if status is COMPLETADA/CANCELADA, deletes the event
- `syncTaskDeleted(doctorId, googleEventId)` — Deletes event

All functions are **fire-and-forget** — they are called with `.catch(() => {})` so they never block the API response or cause failures.

---

## API Endpoints

### Token storage
```
POST /api/auth/google-calendar/tokens
Body: { email, accessToken, refreshToken, expiresAt }
Called by: NextAuth jwt callback on every Google sign-in
Auth: None (internal call from NextAuth server-side)
```

### Calendar management (all require doctor auth)
```
GET    /api/doctors/[slug]/google-calendar/status
       Returns: { connected, hasTokens, calendarId, enabled, tokenExpiry }

POST   /api/doctors/[slug]/google-calendar/connect
       Creates "tusalud.pro" calendar, runs initial sync (slots 60 days out + pending tasks)
       Returns: { success, calendarId, syncedSlots, syncedTasks }

DELETE /api/doctors/[slug]/google-calendar/disconnect
       Deletes calendar from Google, clears all tokens and event IDs from DB
       Returns: { success }
```

### Webhook
```
POST /api/calendar/webhook
Headers: X-Goog-Channel-Token (validated against GOOGLE_CALENDAR_WEBHOOK_SECRET)
         X-Goog-Resource-State (sync | exists | not_exists)
         X-Goog-Channel-Id (format: "doctor_{doctorId}")
Processes: moved events → update slot/task date+time in DB
           deleted events → close slot / cancel task in DB
```

---

## Sync Hooks in Existing Routes

All hooks are **fire-and-forget** — they never block the HTTP response. Pattern:

```typescript
// After successful DB write:
syncSomeEvent(data).catch(() => {});
// OR for routes in apps/api:
getCalendarTokens(doctorId).then(tokens => {
  if (!tokens) return;
  updateSlotEvent(tokens.accessToken, ...).catch(() => {});
}).catch(() => {});
```

### Routes modified

| Route | Trigger | Calendar action |
|---|---|---|
| `POST /api/appointments/slots` | Slot created | `createSlotEvent` per new slot |
| `PUT /api/appointments/slots/[id]` | Slot updated | `updateSlotEvent` |
| `PATCH /api/appointments/slots/[id]` | isOpen toggled | `updateSlotEvent` (color changes) |
| `DELETE /api/appointments/slots/[id]` | Slot deleted | `deleteEvent` |
| `PATCH /api/appointments/bookings/[id]` | Booking confirmed/cancelled | `updateSlotEvent` (title shows patient name on CONFIRMED) |
| `DELETE /api/appointments/bookings/[id]` | Booking+slot deleted | `deleteEvent` |
| `POST /api/medical-records/tasks` | Task created | `syncTaskCreated` |
| `PUT /api/medical-records/tasks/[id]` | Task updated | `syncTaskUpdated` (deletes event if COMPLETADA/CANCELADA) |
| `DELETE /api/medical-records/tasks/[id]` | Task deleted | `syncTaskDeleted` |

---

## Frontend — "Integraciones" Tab

**Location:** `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`

Added as the 8th tab in `/dashboard/mi-perfil`. The global "Guardar Cambios" save bar is hidden when this tab is active (it has its own actions).

### UI States

**1. Loading** — fetching status on tab open
```
[ spinner ] Verificando estado...
```

**2. No tokens** — doctor signed in before Calendar scope was added
```
⚠️ Para conectar Google Calendar necesitas volver a iniciar sesión con Google.
[ G  Re-autenticar con Google ]  → triggers signIn("google", { callbackUrl: "/dashboard/mi-perfil" })
```

**3. Has tokens, not connected**
```
[ Calendar icon ] Google Calendar    [ Desconectado ]
[ Conectar Google Calendar ]  → POST /connect
```

**4. Connected**
```
[ Calendar icon ] Google Calendar    [ ✓ Conectado ]
Calendario: tusalud.pro
Token válido hasta: 01/04/2026
[ ↺ Sincronizar ahora ]  [ ✕ Desconectar ]
```

**5. Action feedback** — inline message after connect/disconnect/sync:
```
✓ Conectado. 12 citas y 5 pendientes sincronizados.
✗ Error al conectar: No Google tokens found...
```

### Re-authentication flow
Doctors who signed in before the Calendar scope was added won't have tokens in the DB. The UI detects `hasTokens: false` and shows a re-auth button. Clicking it calls `signIn("google")` which triggers the full Google consent screen again (since we always set `prompt: "consent"`), granting Calendar access and storing the new tokens automatically.

---

## Webhook Setup (Production)

The webhook only works in production (needs a public URL). Setup steps:

### 1. Set the env vars ✅ Done
In Railway `api` service — all set:
```
GOOGLE_CALENDAR_WEBHOOK_SECRET=<32+ char secret>
CRON_SECRET=<32+ char secret>
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

### 2. Activate push notifications on connect ✅ Done
The `connect` route already calls `watchCalendar()` after creating the calendar. It stores `googleChannelId`, `googleChannelResourceId`, and `googleChannelExpiry` on the Doctor model. A unique channel ID is generated per doctor using `doctor_{doctorId}_{randomHex}`.

### 3. Channel expiry — renewal cron ✅ Done
Google push notification channels expire after ~7 days. A `POST /api/calendar/renew-channels` endpoint (protected by `CRON_SECRET`) handles renewal.

**Railway Function (cron service) setup:**
- Service type: Railway Function (Bun runtime)
- Schedule: `0 6 * * *` (daily at 6am)
- Variables: `NEXT_PUBLIC_API_URL` and `CRON_SECRET` (same values as API service)
- Code:
```typescript
// index.tsx (Bun v1.3 runtime)
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const CRON_SECRET = process.env.CRON_SECRET;

const res = await fetch(`${API_URL}/api/calendar/renew-channels`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${CRON_SECRET}` },
});

const data = await res.json();
console.log("[Calendar Renewal]", JSON.stringify(data));
```

### Webhook validation
```
POST /api/calendar/webhook
X-Goog-Channel-Token: must match GOOGLE_CALENDAR_WEBHOOK_SECRET
X-Goog-Resource-State: "sync" (ping) | "exists" (events changed)
X-Goog-Channel-Id: "doctor_{doctorId}_{randomHex}"
```
The webhook always returns HTTP 200 to Google — a non-2xx response would stop the channel.

---

## Deployment Checklist

- [x] Google Calendar API enabled in Google Cloud Console
- [x] `https://www.googleapis.com/auth/calendar` scope added to OAuth consent screen (Data access)
- [x] DB migration run on Railway: `add-google-calendar-fields.sql`
- [x] `GOOGLE_CALENDAR_WEBHOOK_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_API_URL` set in Railway `api` service
- [x] Railway Function cron service created (daily at 6am, calls renew-channels)
- [ ] Deploy code to Railway (git push to main)
- [ ] Each doctor re-signs in with Google (to grant Calendar scope)
- [ ] Test: go to `/dashboard/mi-perfil` → Integraciones tab → Conectar Google Calendar

---

## Known Limitations / Future Work

### Status Summary

| Status | Limitation | Notes |
|---|---|---|
| ✅ Fixed | Slot POST sync (bulk creation) | `slots/route.ts` now creates Google events after `createMany` |
| ✅ Fixed | Instant booking sync | `bookings/instant/route.ts` now creates Google event on confirmation |
| ✅ Fixed | Webhook channel renewal | `renew-channels` endpoint + `connect` now calls `watchCalendar()` |
| ✅ Not an issue | Task "bulk" creation sync | `bulk/route.ts` is DELETE-only; frontend loops through individual POST (which has sync hooks) |
| ✅ Fixed | New booking PENDING state | `bookings/route.ts` POST now shows "Cita: ⏳ Patient Name" on PENDING |
| 🟢 Low | Local webhook testing | Dev inconvenience only, works fine in production |

---

### 1. Webhook Channel Renewal (7-day expiry) ✅ Fixed

**What it is:**
Google push notification channels are not permanent. When you call `watchCalendar()`, Google returns an expiration timestamp — always around 7 days from creation. After that timestamp, Google stops sending webhook notifications **silently**. No error is thrown anywhere. The sync just stops working from the Google → DB direction with no warning.

**Current state:**
✅ **Implemented.** The `connect` endpoint calls `watchCalendar()` and stores `googleChannelId`, `googleChannelResourceId`, and `googleChannelExpiry` on the Doctor model. A `POST /api/calendar/renew-channels` endpoint (protected by `CRON_SECRET`) finds channels expiring within 24 hours, stops the old channel, and creates a new one. Set up a daily cron job on Railway to call this endpoint.

**Note:**
The app → Google direction (slots, bookings, tasks pushing to Calendar) still works fine — those are direct API calls on every write. Only the Google → app direction (doctor drags an event in Google Calendar to reschedule) would stop working if channels aren't renewed.

**Implementation:** `POST /api/calendar/renew-channels` — see `apps/api/src/app/api/calendar/renew-channels/route.ts`.

---

### 2. Slot POST Sync (Bulk Creation) ✅ Fixed

**What it is:**
When a doctor creates slots via `POST /api/appointments/slots`, the request can create many slots at once — for example "every Monday and Wednesday for the next 3 months" generates 24+ slots in a single request. Each slot needs its own Google Calendar event.

**Current state:**
✅ **Implemented.** After `prisma.appointmentSlot.createMany()`, the route fetches the newly created slots (querying by `googleEventId: null` on the relevant dates) and loops through each one calling `createSlotEvent()` in a fire-and-forget async block. Both single-date and recurring (multi-date) creation paths are covered.

---

### 3. New Booking PENDING State ✅ Fixed

**What it is:**
When a patient books an appointment (`POST /api/appointments/bookings`), the booking status starts as `PENDING`.

**Current state:**
✅ **Implemented.** The `POST /api/appointments/bookings` route now updates the slot's Google Calendar event to `"Cita: ⏳ {patientName}"` when a PENDING booking is created (fire-and-forget). The full state progression in Google Calendar:

| Booking state | Calendar event title | Color |
|---|---|---|
| No booking | Disponible | Teal |
| PENDING | Cita: ⏳ Patient Name | Green |
| CONFIRMED | Cita: Patient Name | Green |
| CANCELLED | Disponible | Teal |

---

### 4. Instant Booking Sync ✅ Fixed

**What it is:**
`POST /api/appointments/bookings/instant` is a special endpoint that creates a slot and a confirmed booking in a single call — used when the doctor books a patient directly without a pre-existing slot.

**Current state:**
✅ **Implemented.** After the slot and booking are created, the route fires a `createSlotEvent()` call with the patient name (showing as a confirmed booking event), then saves the `googleEventId` back to the slot.

---

### 5. Webhook Doesn't Work in Local Development

**What it is:**
Google's push notification system requires a **publicly reachable HTTPS URL**. When running locally (`localhost:3003`), Google cannot reach the webhook endpoint.

**Current state:**
`POST /api/calendar/webhook` is fully implemented and correct — it just never receives requests locally because Google can't reach it.

**Impact:**
You cannot test the bidirectional sync (Google → DB) locally. Only the app → Google direction (creating, updating, deleting events) can be verified locally.

**Workarounds:**

1. **ngrok** — Tunnels a public HTTPS URL to localhost:
```bash
ngrok http 3003
# Copy the generated URL, e.g. https://abc123.ngrok.io
# Set it as NEXT_PUBLIC_API_URL temporarily in apps/api/.env.local
# Then reconnect Google Calendar so watchCalendar() registers the new URL
```

2. **Deploy to Railway and test there** — The Railway URL is already public HTTPS. The webhook works automatically once `GOOGLE_CALENDAR_WEBHOOK_SECRET` is set and a doctor connects.

3. **Simulate webhook locally** — Send a fake POST to test the handler logic without Google triggering it:
```bash
curl -X POST http://localhost:3003/api/calendar/webhook \
  -H "x-goog-channel-token: your-secret" \
  -H "x-goog-resource-state: exists" \
  -H "x-goog-channel-id: doctor_clxxx123"
```

---

### 6. Task "Bulk" Creation Sync ✅ Not an issue

**What it is:**
The initial concern was that AI-generated tasks (from the task-chat or voice panel) might bypass the single-task sync hook via a bulk creation endpoint.

**Current state:**
✅ **No fix needed.** Investigation confirmed that `tasks/bulk/route.ts` only handles `DELETE` — there is no bulk `POST` for tasks. When the AI chat panel or voice assistant creates multiple tasks, the frontend (`pendientes/new/page.tsx`) loops through each task and calls `POST /api/medical-records/tasks` individually. That single-create route already has a `syncTaskCreated` hook. Each task is synced automatically.
