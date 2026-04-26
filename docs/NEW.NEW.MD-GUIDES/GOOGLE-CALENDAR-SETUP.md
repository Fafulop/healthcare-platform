# Google Calendar Integration — Complete Technical Guide

> Last updated: 2026-04-26

## Overview

The Google Calendar integration provides **one-way sync** (app -> Google Calendar) for each doctor. When connected, a dedicated calendar called **"tusalud.pro"** is created in the doctor's Google account. Confirmed/pending bookings and tasks sync automatically. Changes made directly in Google Calendar are **not** written back to the database.

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [OAuth Flow & Token Management](#2-oauth-flow--token-management)
3. [Database Schema](#3-database-schema)
4. [Core Library (`google-calendar.ts`)](#4-core-library)
5. [API Endpoints](#5-api-endpoints)
6. [Sync Strategy & Hooks](#6-sync-strategy--hooks)
7. [Event Formatting & Colors](#7-event-formatting--colors)
8. [Conflict Detection](#8-conflict-detection)
9. [Webhook Channel Management](#9-webhook-channel-management)
10. [Frontend Components](#10-frontend-components)
11. [Doctor App Sync Helper](#11-doctor-app-sync-helper)
12. [Common Flows](#12-common-flows)
13. [Error Handling Patterns](#13-error-handling-patterns)
14. [Testing Notes](#14-testing-notes)

---

## 1. Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | API + Doctor app | Google OAuth client ID (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | API + Doctor app | Google OAuth client secret |
| `GOOGLE_CALENDAR_WEBHOOK_SECRET` | API | 32+ char secret for validating webhook push notifications |
| `CRON_SECRET` | API | 32+ char secret for authenticating the daily channel renewal cron |
| `NEXT_PUBLIC_API_URL` | API | Public API URL (used as webhook target) |

---

## 2. OAuth Flow & Token Management

### Scopes

```
openid
email
profile
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/gmail.send
```

### How Tokens Are Captured

NextAuth v5 handles Google OAuth. The `signIn` callback in `packages/auth/src/nextauth-config.ts` fires on login and stores tokens:

- `account.access_token` -> `User.googleAccessToken`
- `account.refresh_token` -> `User.googleRefreshToken`
- `account.expires_at` (epoch seconds) -> `User.googleTokenExpiry` (converted to `DateTime`)

Key config flags:
- `access_type: "offline"` — ensures Google returns a refresh token
- `prompt: "consent"` — forces consent screen so refresh token is always granted

### Token Refresh

The `resolveTokens(user)` function in `apps/api/src/lib/google-calendar.ts` handles auto-refresh:

1. Checks if `googleTokenExpiry` is in the past (or within 5 minutes of expiring)
2. If expired, calls `refreshAccessToken(refreshToken)` which hits Google's token endpoint
3. Returns `{ accessToken, refreshToken, updatedToken? }` — caller persists `updatedToken` to DB if present

The helper `getCalendarTokens(doctorId)` in `apps/api/src/lib/appointments-utils.ts` wraps this:
- Loads doctor + user from DB
- Checks `googleCalendarEnabled` and `googleCalendarId`
- Calls `resolveTokens`, persists refreshed token to DB
- Returns `{ accessToken, refreshToken, calendarId }` or `null`

### Important

- Tokens live on the **User** model (not Doctor), because they belong to the Google account
- Doctors who signed in before the Calendar scope was added must re-authenticate to grant it
- If `googleRefreshToken` is missing, the integration cannot auto-refresh — the doctor sees a banner prompting re-auth

---

## 3. Database Schema

### User Model

```prisma
googleAccessToken  String?   @map("google_access_token")
googleRefreshToken String?   @map("google_refresh_token")
googleTokenExpiry  DateTime? @map("google_token_expiry")
```

### Doctor Model

```prisma
// Calendar integration
googleCalendarId          String?   @map("google_calendar_id")
googleCalendarEnabled     Boolean   @default(false) @map("google_calendar_enabled")

// Push notification channel
googleChannelId           String?   @map("google_channel_id")
googleChannelResourceId   String?   @map("google_channel_resource_id")
googleChannelExpiry       DateTime? @map("google_channel_expiry")
```

### AppointmentSlot Model

```prisma
googleEventId String? @map("google_event_id")
```

### Booking Model

```prisma
googleEventId String? @map("google_event_id")   // for freeform (slotId=null) bookings
meetLink      String? @map("meet_link")          // Google Meet URL (telemedicine)
```

### Task Model

```prisma
googleEventId String? @map("google_event_id")
```

---

## 4. Core Library

**File**: `apps/api/src/lib/google-calendar.ts`

Uses the `googleapis` npm package. All functions take raw `accessToken` / `refreshToken` strings (not the full user object).

### Interfaces

```typescript
export interface SlotEventData {
  id: string;           // slot or booking ID (stored as extendedProperties.private.slotId)
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
  isOpen: boolean;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientNotes?: string;
  bookingStatus?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW';
  finalPrice?: number;
  conflictNote?: string;
}

export interface TaskEventData {
  id: string;           // task ID (stored as extendedProperties.private.taskId)
  title: string;
  description?: string | null;
  dueDate: string;      // YYYY-MM-DD
  startTime?: string | null;  // HH:MM or null for all-day
  endTime?: string | null;
  status: string;
  priority: string;     // ALTA, MEDIA, BAJA
  category?: string | null;
  conflictNote?: string;
}
```

### Functions

| Function | Purpose | Returns |
|---|---|---|
| `resolveTokens(user)` | Get valid access token, auto-refreshing if expired | `{ accessToken, refreshToken, updatedToken? }` |
| `refreshAccessToken(refreshToken)` | Call Google OAuth token endpoint | `{ accessToken, expiresAt }` |
| `createDedicatedCalendar(accessToken, refreshToken)` | Create "tusalud.pro" calendar | `calendarId` |
| `deleteDedicatedCalendar(accessToken, refreshToken, calendarId)` | Delete calendar on disconnect | `void` |
| `createSlotEvent(accessToken, refreshToken, calendarId, slot)` | Create GCal event for a booking | `googleEventId` |
| `updateSlotEvent(accessToken, refreshToken, calendarId, googleEventId, slot)` | Update booking event | `void` |
| `createTaskEvent(accessToken, refreshToken, calendarId, task)` | Create GCal event for a task | `googleEventId` |
| `updateTaskEvent(accessToken, refreshToken, calendarId, googleEventId, task)` | Update task event | `void` |
| `deleteEvent(accessToken, refreshToken, calendarId, googleEventId)` | Delete any event by ID | `void` |
| `watchCalendar(accessToken, refreshToken, calendarId, webhookUrl, channelId, channelToken)` | Setup push notification channel | `{ resourceId, expiration }` |
| `stopCalendarWatch(accessToken, refreshToken, channelId, resourceId)` | Stop a push channel | `void` |
| `ensureMeetLink(accessToken, refreshToken, calendarId, googleEventId, bookingId, fallback)` | Create/fetch Google Meet link | `{ meetUrl, newEventId? }` |

### Extended Properties

Every event created by the integration includes ownership metadata:

```json
{
  "extendedProperties": {
    "private": {
      "source": "tusalud.pro",
      "slotId": "cuid..."
    }
  }
}
```

Task events use `taskId` instead of `slotId`. Telemedicine events also include `bookingId`.

---

## 5. API Endpoints

### `GET /api/doctors/[slug]/google-calendar/status`

**Auth**: Doctor or Admin

**Response**:
```json
{
  "connected": true,
  "hasTokens": true,
  "hasRefreshToken": true,
  "calendarId": "abc123@group.calendar.google.com",
  "enabled": true,
  "tokenExpiry": "2026-04-27T10:00:00.000Z",
  "channelExpiry": "2026-05-01T06:00:00.000Z"
}
```

`connected` is true when the doctor has a `calendarId`, a `refreshToken`, and `googleCalendarEnabled` is true.

---

### `POST /api/doctors/[slug]/google-calendar/connect`

**Auth**: Doctor or Admin

Creates the "tusalud.pro" calendar and runs an initial sync:
- Upcoming slots (next 60 days) that have active bookings (PENDING/CONFIRMED)
- Pending/in-progress tasks with a `dueDate`

**Response**:
```json
{
  "success": true,
  "calendarId": "abc123@group.calendar.google.com",
  "syncedSlots": 12,
  "syncedTasks": 5
}
```

**Errors**: 400 (no tokens), 403 (wrong doctor), 404 (doctor not found)

---

### `DELETE /api/doctors/[slug]/google-calendar/disconnect`

**Auth**: Doctor or Admin

Actions (in a transaction):
1. Delete calendar from Google (best-effort — doesn't block if fails)
2. Clear `googleEventId` from all of the doctor's AppointmentSlots
3. Clear `googleEventId` from all of the doctor's Tasks
4. Set `googleCalendarEnabled = false`, clear `googleCalendarId` and channel fields
5. Clear OAuth tokens from the User record

---

### `POST /api/doctors/[slug]/google-calendar/resync`

**Auth**: Doctor or Admin

Full resync triggered by "Sincronizar ahora" button:

1. Load active slots (60 days) + active tasks from DB
2. List all GCal events with `source=tusalud.pro` (90-day window)
3. Delete orphan events (GCal events whose slotId/taskId no longer exists in DB)
4. Upsert slot events — create new or update existing (re-creates if update fails with 404)
5. Upsert task events — same logic; deletes COMPLETADA/CANCELADA tasks from GCal

**Response**:
```json
{
  "success": true,
  "deletedOrphans": 3,
  "createdSlots": 2,
  "updatedSlots": 10,
  "createdTasks": 1,
  "updatedTasks": 4
}
```

---

### `POST /api/calendar/webhook`

**Auth**: Validates `x-goog-channel-token` header against `GOOGLE_CALENDAR_WEBHOOK_SECRET`

Receives Google Calendar push notifications. **Intentionally one-way** — always responds with HTTP 200 to keep the channel alive, but performs no DB writes. The calendar is a read-only mirror of the app.

---

### `POST /api/calendar/renew-channels`

**Auth**: `Authorization: Bearer {CRON_SECRET}`

Called daily by Railway cron (`0 6 * * *` — 6am UTC). Finds doctors with channels expiring within 24 hours, stops the old channel, creates a new one.

Channel IDs follow the format: `doctor_{doctorId}_{randomHex}`

**Response**:
```json
{
  "total": 5,
  "renewed": 4,
  "failed": 0,
  "skipped": 1,
  "details": [
    { "doctorId": "abc", "status": "renewed" },
    { "doctorId": "def", "status": "skipped", "error": "no tokens" }
  ]
}
```

---

## 6. Sync Strategy & Hooks

### Direction

**App -> Google Calendar only.** The webhook acknowledges pings but never writes to the DB.

### When Sync Happens

All sync operations are **fire-and-forget** — they never block the API response. Pattern:

```typescript
getCalendarTokens(doctorId).then(tokens => {
  if (!tokens) return;
  updateSlotEvent(tokens.accessToken, ..., eventData)
    .catch(err => console.error('[GCal sync] ...:', err));
}).catch(err => console.error('[GCal sync] ...:', err));
```

### Sync Hooks by Route

| Route | Action | GCal Operation |
|---|---|---|
| `POST /api/appointments/bookings` | New booking (PENDING or auto-CONFIRMED) | Create or update slot event |
| `PATCH /api/appointments/bookings/[id]` — CONFIRMED | Confirm booking | Create/update event + conflict check |
| `PATCH /api/appointments/bookings/[id]` — CANCELLED | Cancel booking | Delete event + clear slot.googleEventId |
| `PATCH /api/appointments/bookings/[id]` — COMPLETED | Complete booking | Update event (dark green, checkmark) |
| `PATCH /api/appointments/bookings/[id]` — NO_SHOW | Mark no-show | Update event (grey, X prefix) |
| `PATCH /api/appointments/bookings/[id]` — extendedBlock | Change block duration | Update event end time |
| `DELETE /api/appointments/bookings/[id]` | Delete booking | Delete event + clear slot.googleEventId |
| `POST /api/appointments/bookings/instant` | Instant booking (slot + confirmed) | Create event |
| `POST /api/appointments/range-bookings` | Range-based booking | Create event (on booking record) |
| `POST /api/appointments/range-bookings/instant` | Range instant booking | Create event (on booking record) |
| `POST /api/appointments/slots` | Create slot(s) | Create event(s) |
| `PUT /api/appointments/slots/[id]` | Update slot | Update event |
| `PATCH /api/appointments/slots/[id]` | Toggle isOpen | Update event title/color |
| `DELETE /api/appointments/slots/[id]` | Delete slot | Delete event |
| `POST /api/appointments/slots/bulk` | Bulk close/open/delete | Update/delete events |
| Task CRUD (doctor app) | Create/update/delete tasks | Create/update/delete task events |

### googleEventId Ownership

- **Slot-based bookings**: `googleEventId` lives on the `AppointmentSlot` record
- **Freeform bookings** (range-based, slotId=null): `googleEventId` lives on the `Booking` record
- **Tasks**: `googleEventId` lives on the `Task` record

When looking up the event ID, the pattern is:

```typescript
const gcalEventId = booking.slot?.googleEventId ?? booking.googleEventId;
```

### Stale googleEventId Cleanup

When a booking is CANCELLED or deleted on a **public slot**, the GCal event is deleted but the slot stays available for new patients. The `slot.googleEventId` is cleared so the next booking creates a fresh event instead of trying to update a deleted one.

---

## 7. Event Formatting & Colors

### Slot Events (Appointments)

| State | Title | Color ID | Color Name |
|---|---|---|---|
| Open, no booking | `Disponible` | `7` | Peacock (teal) |
| Blocked (isOpen=false) | `Bloqueado` | `8` | Graphite |
| PENDING booking | `Cita: [patient]` | `2` | Sage (green) |
| CONFIRMED booking | `Cita: [patient]` | `2` | Sage (green) |
| COMPLETED booking | `Cita: [patient]` | `10` | Basil (dark green) |
| NO_SHOW booking | `Cita: [patient]` | `8` | Graphite |
| With conflict | `Cita: [patient]` | (same) | (same, with prefix) |

Title prefixes:
- PENDING: `Cita: ...` (hourglass shown via emoji in some paths)
- CONFIRMED: `Cita: [name]`
- COMPLETED: `Cita: [name]`
- NO_SHOW: `Cita: [name]`
- Conflict: `Cita: [name]`

### Task Events

| Priority | Emoji | Color ID | Color Name |
|---|---|---|---|
| ALTA | (red circle) | `11` | Tomato (red) |
| MEDIA | (yellow circle) | `5` | Banana (yellow) |
| BAJA | (green circle) | `10` | Basil (green) |

Title format: `[emoji] [title]`, with `[warning] ` prefix if conflict exists.

### Event Descriptions

**Slot events**:
```
$150 MXN
Tel: +52 55 1234 5678
Email: paciente@email.com
Notas: Patient notes here
[conflict warning if applicable]
```

**Task events**:
```
Categoria: Seguimiento | Prioridad: Alta

Task description here...

[conflict warning if applicable]
```

### Timezone

All event times use `America/Mexico_City`:

```json
{
  "start": { "dateTime": "2026-04-26T10:00:00", "timeZone": "America/Mexico_City" },
  "end": { "dateTime": "2026-04-26T11:00:00", "timeZone": "America/Mexico_City" }
}
```

All-day tasks (no startTime/endTime) use `date` instead of `dateTime`.

---

## 8. Conflict Detection

### Booking -> Task Conflicts

When a booking is CONFIRMED, the system checks for overlapping tasks:

```typescript
const dayTasks = await prisma.task.findMany({
  where: {
    doctorId,
    dueDate: slot.date,
    status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
  },
});
const hit = dayTasks.find(t =>
  t.startTime && t.endTime &&
  t.startTime < slot.endTime &&
  t.endTime > slot.startTime
);
```

If found, the booking event gets a conflict warning prefix and description note.

### Task -> Booking Conflicts

When a timed task is created/updated (in `google-calendar-sync.ts`), the system checks for overlapping PENDING/CONFIRMED bookings. Same overlap logic, warning added to the task event.

### Important

- Only timed items (with explicit startTime and endTime) are checked
- Conflicts are **informational only** — they never block operations
- Warnings appear in both the event title (prefix) and description

---

## 9. Webhook Channel Management

### Lifecycle

1. **Created** when doctor connects calendar (via `/connect` endpoint) — *Note: current code may not set up the channel during connect; it's set up during first resync or cron.*
2. **Expires** after ~7 days (Google constraint)
3. **Renewed daily** via cron job (`POST /api/calendar/renew-channels` at `0 6 * * *` UTC)

### Channel Structure

- **ID**: `doctor_{doctorId}_{randomHex}` — unique per doctor per renewal
- **Token**: `GOOGLE_CALENDAR_WEBHOOK_SECRET` — validated on every incoming ping
- **Expiry**: Stored in `doctor.googleChannelExpiry`
- **Resource ID**: Stored in `doctor.googleChannelResourceId` (needed to stop the channel)

### Cron Setup (Railway)

```
Schedule: 0 6 * * * (daily at 6am UTC / midnight Mexico City)
Command:  curl -X POST $API_URL/api/calendar/renew-channels -H "Authorization: Bearer $CRON_SECRET"
```

---

## 10. Frontend Components

### GoogleCalendarBanner

**File**: `apps/doctor/src/components/GoogleCalendarBanner.tsx`

Amber top-bar that appears when:
- Doctor previously had the integration connected
- But the refresh token is now missing (needs re-auth)

Shows a "Re-autenticarse" button that triggers the Google consent screen. Dismissible per session via `sessionStorage`.

### Integraciones Tab (Mi Perfil)

**File**: `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`

Located in the 8th tab of the doctor profile page. Four possible states:

1. **Loading** — fetching status
2. **No tokens** — doctor signed in before Calendar scope was added; shows re-auth prompt
3. **Connected** — shows calendar ID, webhook expiry (with amber warning if < 3 days), sync and disconnect buttons
4. **Not connected** — has tokens but calendar not created yet; shows connect button

---

## 11. Doctor App Sync Helper

**File**: `apps/doctor/src/lib/google-calendar-sync.ts`

Since the doctor app doesn't have `googleapis` installed, this module uses raw `fetch` calls to the Google Calendar REST API.

### Exported Functions

```typescript
export async function syncTaskCreated(doctorId: string, task: TaskForSync): Promise<void>
export async function syncTaskUpdated(doctorId: string, task: TaskForSync): Promise<void>
export async function syncTaskDeleted(doctorId: string, googleEventId: string, calendarIdHint?: string): Promise<void>
```

All are fire-and-forget — errors are logged but never thrown to the caller.

### Key Behaviors

- `syncTaskCreated`: Creates event, stores `googleEventId` on the task, checks for slot conflicts
- `syncTaskUpdated`: Updates event if task is active; deletes event if COMPLETADA/CANCELADA
- `syncTaskDeleted`: Deletes event from Google Calendar
- `findSlotConflict`: Checks if a timed task overlaps any booked appointment

---

## 12. Common Flows

### First-Time Setup

1. Doctor signs in with Google (NextAuth captures tokens including Calendar scope)
2. Doctor navigates to Mi Perfil > Integraciones
3. Clicks "Conectar Google Calendar"
4. API creates dedicated "tusalud.pro" calendar in doctor's Google account
5. API syncs existing active bookings (60 days) and pending tasks
6. Integration is live — ongoing sync is automatic

### Ongoing Sync (Automatic)

- **Bookings**: Synced on every create, status change, extended block edit, or delete
- **Tasks**: Synced from doctor app on every create, update, or delete
- **Manual resync**: Doctor clicks "Sincronizar ahora" for a full reconciliation

### Disconnecting

1. Doctor clicks "Desconectar" in Integraciones tab
2. API deletes the "tusalud.pro" calendar from Google (best-effort)
3. All `googleEventId` references cleared from slots, bookings, and tasks
4. OAuth tokens cleared from User record
5. Integration disabled on Doctor record

### Re-authentication

If the refresh token is lost (e.g., Google revoked access):
1. `GoogleCalendarBanner` appears with amber warning
2. Doctor clicks "Re-autenticar con Google"
3. New consent flow grants fresh tokens
4. Integration resumes working

---

## 13. Error Handling Patterns

### API Routes

- **Auth errors** (401/403): Return error response, no sync attempted
- **No tokens** (400): "No Google tokens found" — doctor needs to re-authenticate
- **Google API errors**: Logged to console, fire-and-forget operations don't block the response
- **Best-effort operations**: Calendar deletion on disconnect, stale event cleanup — failures logged but don't fail the request

### Fire-and-Forget Pattern

Every GCal sync in the booking/slot routes follows this structure:

```typescript
getCalendarTokens(doctorId)
  .then(tokens => {
    if (!tokens) return;
    // ... perform GCal operation
  })
  .catch(err => console.error('[GCal sync] operation name:', err));
```

This ensures:
- The HTTP response is never delayed by GCal operations
- Token refresh failures don't break booking workflows
- Individual sync failures are logged but don't cascade

### Client-Side (Doctor App)

All `syncTask*` functions catch errors internally. The pattern:

```typescript
export async function syncTaskCreated(doctorId, task) {
  // ... sync logic
  // errors caught, logged, never thrown
}

// Called as:
syncTaskCreated(doctorId, task).catch(err => console.error('[GCal]', err));
```

---

## 14. Testing Notes

### Can Be Tested Locally

- OAuth flow and token storage
- Creating/updating/deleting calendar events (app -> Google direction)
- Conflict detection logic
- Resync orphan cleanup
- Token refresh flow

### Cannot Be Tested Locally

- Webhook push notifications (requires public HTTPS URL)
- Channel renewal cron

### Workarounds for Webhook Testing

1. **ngrok**: Tunnel localhost to a public URL, set `NEXT_PUBLIC_API_URL` to the ngrok URL
2. **Railway deploy**: Use the deployed public URL
3. **Manual POST**: Send fake webhook payloads to `/api/calendar/webhook` for logic testing (include valid `x-goog-channel-token` header)

### Key Test Scenarios

1. Connect -> verify "tusalud.pro" calendar appears in doctor's Google account
2. Create booking -> verify GCal event appears with correct title, time, color
3. Confirm booking -> verify event updates with patient details
4. Cancel booking on public slot -> verify event deleted AND `slot.googleEventId` cleared
5. Edit extended block -> verify GCal event end time changes
6. Complete booking -> verify event shows checkmark prefix and dark green color
7. No-show -> verify event shows X prefix and grey color
8. Disconnect -> verify calendar deleted from Google, all event IDs cleared
9. Resync -> verify orphan cleanup and upsert counts
