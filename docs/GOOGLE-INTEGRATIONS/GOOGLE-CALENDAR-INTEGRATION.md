# Google Calendar Integration — Complete Technical Reference

> Last updated: 2026-05-18

## Overview

One-way sync (TuSalud app -> Google Calendar) for each doctor. A dedicated calendar called **"tusalud.pro"** is created in the doctor's Google account. Bookings (slot-based and range-based) and tasks sync automatically. Changes made directly in Google Calendar are NOT written back to the database.

---

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Database Schema](#2-database-schema)
3. [OAuth Flow & Token Management](#3-oauth-flow--token-management)
4. [Core Library — google-calendar.ts](#4-core-library)
5. [Token Helper — getCalendarTokens()](#5-token-helper)
6. [API Endpoints](#6-api-endpoints)
7. [Sync Hooks — Bookings](#7-sync-hooks--bookings)
8. [Sync Hooks — Slots](#8-sync-hooks--slots)
9. [Sync Hooks — Tasks (Doctor App)](#9-sync-hooks--tasks)
10. [Event Formatting & Colors](#10-event-formatting--colors)
11. [Conflict Detection](#11-conflict-detection)
12. [Webhook & Channel Management](#12-webhook--channel-management)
13. [Frontend Components](#13-frontend-components)
14. [Common Flows](#14-common-flows)
15. [Error Handling Patterns](#15-error-handling-patterns)
16. [Edge Cases & Known Behaviors](#16-edge-cases--known-behaviors)

---

## 1. Environment Variables

| Variable | Used In | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | API (`google-calendar.ts:32`), Doctor app (`google-calendar-sync.ts:74`), Auth (`nextauth-config.ts:23`) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | API (`google-calendar.ts:33`), Doctor app (`google-calendar-sync.ts:75`), Auth (`nextauth-config.ts:24`) | Google OAuth client secret |
| `GOOGLE_CALENDAR_WEBHOOK_SECRET` | `webhook/route.ts:12`, `renew-channels/route.ts:31` | Shared token for webhook validation |
| `CRON_SECRET` | `renew-channels/route.ts:21` | Bearer token for daily channel renewal cron |
| `NEXT_PUBLIC_API_URL` | `renew-channels/route.ts:27-28` | Public API URL (webhook target) |

**Important:** These must be set in the Railway API service. The `.env.example` does NOT list them — verify they exist in production.

---

## 2. Database Schema

### User Model

```prisma
googleAccessToken  String?   @map("google_access_token")
googleRefreshToken String?   @map("google_refresh_token")
googleTokenExpiry  DateTime? @map("google_token_expiry")
```

Tokens live on User (not Doctor) because they belong to the Google account. The `signIn` callback in NextAuth stores them on every login.

### Doctor Model

```prisma
googleCalendarId          String?   @map("google_calendar_id")
googleCalendarEnabled     Boolean   @default(false) @map("google_calendar_enabled")
googleChannelId           String?   @map("google_channel_id")
googleChannelResourceId   String?   @map("google_channel_resource_id")
googleChannelExpiry       DateTime? @map("google_channel_expiry")
```

- `googleCalendarId` — ID of the dedicated "tusalud.pro" calendar
- `googleCalendarEnabled` — Master gate for all GCal operations
- Channel fields — Push notification channel (expires ~24h, renewed by cron)

### AppointmentSlot Model

```prisma
googleEventId String? @map("google_event_id")
```

Slot-based bookings store the GCal event ID here.

### Booking Model

```prisma
googleEventId String? @map("google_event_id")
meetLink      String? @map("meet_link")
```

- Freeform/range-based bookings (`slotId: null`) store GCal event ID here
- `meetLink` — Google Meet URL for telemedicine appointments

### Task Model

```prisma
googleEventId String? @map("google_event_id")
```

### googleEventId Ownership Summary

| Entity | Where `googleEventId` lives | When set |
|---|---|---|
| Slot-based booking | `AppointmentSlot.googleEventId` | Booking created/confirmed |
| Range-based booking | `Booking.googleEventId` | Booking created |
| Task | `Task.googleEventId` | Task created with dueDate |

When looking up the event ID for a booking, the pattern is:

```typescript
const gcalEventId = booking.slot?.googleEventId ?? booking.googleEventId;
```

---

## 3. OAuth Flow & Token Management

### Scopes

```
openid email profile
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/gmail.send
```

### How Tokens Are Captured

**File:** `packages/auth/src/nextauth-config.ts`

NextAuth v5 handles Google OAuth. Key config flags:

- `access_type: "offline"` — ensures Google returns a refresh token
- `prompt: "consent"` — forces consent screen so refresh token is always granted
- `response_type: "code"` — authorization code flow

The `signIn` callback fires on every login and stores tokens:

```typescript
await prisma.user.update({
  where: { email: user.email },
  data: {
    googleAccessToken: account.access_token ?? null,
    googleRefreshToken: account.refresh_token ?? null,
    googleTokenExpiry: account.expires_at
      ? new Date(account.expires_at * 1000)
      : null,
  },
});
```

**Important:** Tokens are NOT exposed in the session. They're read server-side only.

### Token Refresh

**Function:** `resolveTokens(user)` in `apps/api/src/lib/google-calendar.ts` (lines 308-338)

```typescript
export async function resolveTokens(user: {
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiry: Date | null;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  updatedToken?: { accessToken: string; expiresAt: Date };
}>
```

Logic:
1. Throws `"No Google tokens found"` if both access and refresh tokens are missing
2. Checks if expired: `!googleAccessToken || (tokenExpiry && tokenExpiry <= new Date())`
3. If expired and refresh token exists → calls `refreshAccessToken()` → returns `updatedToken`
4. **Caller is responsible for persisting `updatedToken` to DB**
5. If not expired → returns current access token as-is

**Function:** `refreshAccessToken(refreshToken)` (lines 7-26)
- Calls Google OAuth token endpoint via `googleapis` library
- Returns `{ accessToken, expiresAt }`
- Throws `"Failed to refresh Google access token"` if no token returned

---

## 4. Core Library

**File:** `apps/api/src/lib/google-calendar.ts`

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
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  priority: string;     // ALTA, MEDIA, BAJA
  category?: string | null;
  conflictNote?: string;
}
```

### Functions

| Function | Returns | Purpose |
|---|---|---|
| `resolveTokens(user)` | `{ accessToken, refreshToken, updatedToken? }` | Get valid access token, auto-refreshing if expired |
| `refreshAccessToken(refreshToken)` | `{ accessToken, expiresAt }` | Call Google OAuth token endpoint |
| `createDedicatedCalendar(accessToken, refreshToken)` | `calendarId: string` | Create "tusalud.pro" calendar |
| `deleteDedicatedCalendar(accessToken, refreshToken, calendarId)` | `void` | Delete calendar on disconnect |
| `createSlotEvent(accessToken, refreshToken, calendarId, slot)` | `googleEventId: string` | Create GCal event for a booking |
| `updateSlotEvent(accessToken, refreshToken, calendarId, googleEventId, slot)` | `void` | Update booking event |
| `createTaskEvent(accessToken, refreshToken, calendarId, task)` | `googleEventId: string` | Create GCal event for a task |
| `updateTaskEvent(accessToken, refreshToken, calendarId, googleEventId, task)` | `void` | Update task event |
| `deleteEvent(accessToken, refreshToken, calendarId, googleEventId)` | `void` | Delete any event by ID |
| `watchCalendar(accessToken, refreshToken, calendarId, webhookUrl, channelId, channelToken)` | `{ resourceId, expiration }` | Setup push notification channel |
| `stopCalendarWatch(accessToken, refreshToken, channelId, resourceId)` | `void` | Stop a push channel |
| `ensureMeetLink(accessToken, refreshToken, calendarId, googleEventId, bookingId, fallback)` | `{ meetUrl, newEventId? } \| null` | Create/fetch Google Meet link |

### Extended Properties

Every event includes ownership metadata:

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

- Slot-based and freeform booking events use `slotId` (stores `slot.id` or `booking.id`)
- Task events use `taskId` instead of `slotId`
- Telemedicine events also include `bookingId`

### Timezone

All events use `America/Mexico_City`:

```json
{
  "start": { "dateTime": "2026-05-18T10:00:00", "timeZone": "America/Mexico_City" },
  "end": { "dateTime": "2026-05-18T11:00:00", "timeZone": "America/Mexico_City" }
}
```

All-day tasks (no startTime/endTime) use `date` instead of `dateTime`:

```json
{ "start": { "date": "2026-05-18" }, "end": { "date": "2026-05-18" } }
```

---

## 5. Token Helper

**File:** `apps/api/src/lib/appointments-utils.ts`

```typescript
export async function getCalendarTokens(doctorId: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  calendarId: string;
} | null>
```

**Logic:**
1. Load doctor with `googleCalendarId`, `googleCalendarEnabled`, and user tokens
2. Return `null` if calendar not enabled, no calendarId, or no user
3. Call `resolveTokens(doctor.user)` → persist refreshed token if needed
4. Return `{ accessToken, refreshToken, calendarId }`

**Error handling:** Catches all errors, logs them with `console.error('[GCal] getCalendarTokens failed...')`, returns `null`.

**Used by:** All fire-and-forget sync hooks in booking/slot/task routes.

---

## 6. API Endpoints

### `GET /api/doctors/[slug]/google-calendar/status`

**Auth:** Doctor or Admin

**Response:**
```json
{
  "connected": true,
  "hasTokens": true,
  "hasRefreshToken": true,
  "calendarId": "abc123@group.calendar.google.com",
  "enabled": true,
  "tokenExpiry": "2026-05-18T10:00:00.000Z",
  "channelExpiry": "2026-05-22T06:00:00.000Z"
}
```

`connected` = `googleCalendarId && hasRefreshToken && googleCalendarEnabled`

---

### `POST /api/doctors/[slug]/google-calendar/connect`

**Auth:** Doctor or Admin

Creates the "tusalud.pro" calendar and runs initial sync:

1. Resolve/refresh tokens
2. Create calendar (or reuse existing `calendarId`)
3. Set `googleCalendarEnabled: true`
4. Sync upcoming slots (next 60 days) that have active bookings (PENDING/CONFIRMED) and no `googleEventId`
5. Sync freeform bookings (`slotId: null`, PENDING/CONFIRMED, next 60 days, no `googleEventId`)
6. Sync pending tasks with `dueDate` and no `googleEventId`

**Response:**
```json
{
  "success": true,
  "calendarId": "abc123@group.calendar.google.com",
  "syncedSlots": 12,
  "syncedFreeform": 5,
  "syncedTasks": 3
}
```

**Note:** Webhook channels are NOT set up during connect.

---

### `POST /api/doctors/[slug]/google-calendar/resync`

**Auth:** Doctor or Admin

Full resync triggered by "Sincronizar ahora" button:

1. Load active slots (60 days) + freeform bookings + active tasks
2. List all GCal events with `source=tusalud.pro` (90-day window, paginated)
3. Delete orphan events (GCal events whose slotId/bookingId/taskId no longer exists in DB)
4. Upsert slot events — create new or update existing (re-creates if update fails with 404)
5. Upsert task events — same logic; deletes COMPLETADA/CANCELADA tasks from GCal
6. Upsert freeform booking events — same upsert logic

**Response:**
```json
{
  "success": true,
  "deletedOrphans": 3,
  "createdSlots": 2,
  "updatedSlots": 10,
  "createdFreeform": 4,
  "updatedFreeform": 1,
  "createdTasks": 1,
  "updatedTasks": 4
}
```

---

### `DELETE /api/doctors/[slug]/google-calendar/disconnect`

**Auth:** Doctor or Admin

1. Delete calendar from Google (best-effort — doesn't block if fails)
2. Transaction:
   - Clear `googleEventId` from all doctor's AppointmentSlots
   - Clear `googleEventId` from all doctor's Bookings
   - Clear `googleEventId` from all doctor's Tasks
   - Set `googleCalendarEnabled: false`, clear `googleCalendarId`
   - Clear OAuth tokens from User record

---

### `POST /api/calendar/webhook`

**Auth:** Validates `x-goog-channel-token` header against `GOOGLE_CALENDAR_WEBHOOK_SECRET`

Receives Google Calendar push notifications. **Intentionally one-way** — always responds HTTP 200, performs no DB writes.

---

### `POST /api/calendar/renew-channels`

**Auth:** `Authorization: Bearer {CRON_SECRET}`

Called daily by Railway cron (`0 6 * * *` — 6am UTC / midnight Mexico City).

1. Find doctors with channels expiring within 24 hours
2. Stop old channel, create new one
3. Channel ID format: `doctor_{doctorId}_{randomHex}`

**Response:**
```json
{
  "total": 5,
  "renewed": 4,
  "failed": 0,
  "skipped": 1,
  "details": [{ "doctorId": "abc", "status": "renewed" }]
}
```

---

## 7. Sync Hooks — Bookings

All booking sync operations are **fire-and-forget** — they never block the API response.

### Pattern

```typescript
getCalendarTokens(doctorId).then(async tokens => {
  if (!tokens) return;
  // ... GCal operation
}).catch(err => console.error('[GCal sync] ...:', err));
```

### Range-Based Booking Created

**Files:** `range-bookings/route.ts`, `range-bookings/instant/route.ts`

- Calls `createSlotEvent()` with booking data
- Stores `googleEventId` on the `Booking` record (not slot)
- Pending bookings from range-bookings get `patientName` prefixed with "⏳"
- Instant bookings are always CONFIRMED (no prefix)

### Booking Status Changed (PATCH bookings/[id])

| Status Transition | GCal Operation | Details |
|---|---|---|
| → CONFIRMED | `createSlotEvent()` or `updateSlotEvent()` | Creates if no event exists; updates with patient name (removes "⏳" prefix) |
| → CANCELLED | `deleteEvent()` | Event deleted; `slot.googleEventId` cleared for public slots |
| → COMPLETED | `updateSlotEvent()` | Title: `"✓ Cita: {name}"`, color: dark green |
| → NO_SHOW | `updateSlotEvent()` | Title: `"✗ Cita: {name}"`, color: graphite |

### Extended Block Changed

When `extendedBlockMinutes` is updated on a CONFIRMED booking:
- Recalculates `endTime = startTime + extendedBlockMinutes`
- Calls `updateSlotEvent()` with the new end time

### Booking Deleted (DELETE bookings/[id])

- Calls `deleteEvent()` for the booking's `googleEventId`
- Clears `googleEventId` from slot/booking records

---

## 8. Sync Hooks — Slots

Slots without bookings do NOT create GCal events. Only booked slots sync.

| Slot Operation | GCal Sync? | Notes |
|---|---|---|
| Create slot (POST) | NO | Slots are templates; only bookings sync |
| Toggle isOpen (PATCH) | NO | Blocking/unblocking doesn't affect events |
| Delete slot (DELETE) | NO | Orphan cleanup handled by resync |
| Bulk close/open/delete | NO | Same — resync handles cleanup |

---

## 9. Sync Hooks — Tasks (Doctor App)

**File:** `apps/doctor/src/lib/google-calendar-sync.ts`

The doctor app doesn't have `googleapis` installed — uses raw `fetch` calls to the Google Calendar REST API.

### Functions

```typescript
export async function syncTaskCreated(doctorId: string, task: TaskForSync): Promise<void>
export async function syncTaskUpdated(doctorId: string, task: TaskForSync): Promise<void>
export async function syncTaskDeleted(doctorId: string, googleEventId: string): Promise<void>
```

All fire-and-forget — errors logged but never thrown.

### Behaviors

- `syncTaskCreated`: Creates event, stores `googleEventId`, checks for slot conflicts (timed tasks only)
- `syncTaskUpdated`: Updates if active; **deletes** event if COMPLETADA/CANCELADA; checks conflicts
- `syncTaskDeleted`: Deletes event from Google Calendar
- `findSlotConflict`: Checks if a timed task overlaps any booked appointment → adds warning to event

---

## 10. Event Formatting & Colors

### Slot/Booking Events — `slotToEvent()`

| State | Title | Color ID | Color |
|---|---|---|---|
| Open slot, no booking | `Disponible` | `7` | Peacock (teal) |
| Blocked (isOpen=false) | `Bloqueado` | `8` | Graphite |
| PENDING booking | `Cita: {patient}` (or `⏳ Cita: ...`) | `2` | Sage (green) |
| CONFIRMED booking | `Cita: {patient}` | `2` | Sage (green) |
| COMPLETED booking | `✓ Cita: {patient}` | `10` | Basil (dark green) |
| NO_SHOW booking | `✗ Cita: {patient}` | `8` | Graphite |
| With conflict | `⚠️ Cita: {patient}` | (same) | (same) |

**Description lines** (multi-line, `\n`-joined):
1. `$150 MXN`
2. `Tel: +52 55 1234 5678`
3. `Email: paciente@email.com`
4. `Notas: Patient notes`
5. Conflict warning (if applicable)

### Task Events — `taskToEvent()`

| Priority | Emoji | Color ID | Color |
|---|---|---|---|
| ALTA | 🔴 | `11` | Tomato (red) |
| MEDIA | 🟡 | `5` | Banana (yellow) |
| BAJA | 🟢 | `10` | Basil (green) |

**Title:** `{conflictPrefix}{emoji} {task.title}`

**Description lines:**
1. `Categoria: Seguimiento | Prioridad: Alta`
2. *(blank line)*
3. Task description
4. *(blank line)*
5. Conflict warning (if applicable)

**Category labels:** SEGUIMIENTO, ADMINISTRATIVO, LABORATORIO, RECETA, REFERENCIA, PERSONAL, OTRO

---

## 11. Conflict Detection

### Booking → Task Conflicts

When a booking is CONFIRMED, check for overlapping tasks:

```typescript
const dayTasks = await prisma.task.findMany({
  where: { doctorId, dueDate: slot.date, status: { in: ['PENDIENTE', 'EN_PROGRESO'] } },
});
const hit = dayTasks.find(t =>
  t.startTime && t.endTime &&
  t.startTime < slot.endTime &&
  t.endTime > slot.startTime
);
```

### Task → Booking Conflicts

When a timed task is created/updated (in `google-calendar-sync.ts`), check for overlapping PENDING/CONFIRMED bookings. Same overlap logic.

### Important

- Only **timed** items (with explicit startTime and endTime) are checked
- Conflicts are **informational only** — they never block operations
- Warnings appear in both event title (⚠️ prefix) and description

---

## 12. Webhook & Channel Management

### Lifecycle

1. **Created** during first channel renewal cron run (NOT during connect)
2. **Expires** after ~24 hours (Google constraint)
3. **Renewed daily** via cron job at `0 6 * * *` UTC

### Channel Structure

- **ID:** `doctor_{doctorId}_{randomHex}` — unique per doctor per renewal
- **Token:** `GOOGLE_CALENDAR_WEBHOOK_SECRET` — validated on every incoming ping
- **Expiry:** Stored in `doctor.googleChannelExpiry`
- **Resource ID:** Stored in `doctor.googleChannelResourceId`

### Cron Setup (Railway)

```
Schedule: 0 6 * * * (daily at 6am UTC / midnight Mexico City)
Command:  curl -X POST $API_URL/api/calendar/renew-channels -H "Authorization: Bearer $CRON_SECRET"
```

### Webhook Behavior

The webhook endpoint (`POST /api/calendar/webhook`) is intentionally a **no-op** — it acknowledges Google's ping with HTTP 200 but never writes to the DB. The sync is one-way (app → GCal only).

---

## 13. Frontend Components

### GoogleCalendarBanner

**File:** `apps/doctor/src/components/GoogleCalendarBanner.tsx`

Amber banner at the top of the dashboard when:
- Doctor previously had the integration connected
- But the refresh token is now missing (needs re-auth)

Shows "Re-autenticar con Google" button. Dismissible per session via `sessionStorage`.

**Logic:**
- Never shows if never connected (`!connected && !enabled`)
- Shows if `!hasRefreshToken`

### Integraciones Tab (Mi Perfil)

**File:** `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`

Located in the doctor profile page. Four possible states:

1. **Loading** — "Verificando estado..."
2. **No tokens** — Doctor signed in before Calendar scope was added; shows re-auth prompt
3. **Connected** — Shows calendar ID, webhook expiry (with amber warning if < 3 days), "Sincronizar ahora" + "Desconectar" buttons
4. **Not connected** — Has tokens but calendar not created; shows "Conectar Google Calendar" button

**Resync success message** shows counts:
- `{createdSlots} citas creadas`
- `{updatedSlots} citas actualizadas`
- `{createdFreeform} citas de agenda creadas`
- `{updatedFreeform} citas de agenda actualizadas`
- `{createdTasks} pendientes creados`
- `{updatedTasks} pendientes actualizados`
- `{deletedOrphans} eventos huerfanos eliminados`

---

## 14. Common Flows

### First-Time Setup

1. Doctor signs in with Google (NextAuth captures tokens including Calendar scope)
2. Doctor navigates to Mi Perfil > Integraciones
3. Clicks "Conectar Google Calendar"
4. API creates dedicated "tusalud.pro" calendar
5. API syncs existing active bookings (60 days), freeform bookings, and pending tasks
6. Integration is live — ongoing sync is automatic

### Ongoing Sync (Automatic)

- **Bookings:** Synced on every create, status change, extended block edit, or delete
- **Tasks:** Synced from doctor app on every create, update, or delete
- **Manual resync:** Doctor clicks "Sincronizar ahora" for full reconciliation

### Disconnecting

1. Doctor clicks "Desconectar"
2. API deletes the "tusalud.pro" calendar from Google (best-effort)
3. All `googleEventId` cleared from slots, bookings, and tasks
4. OAuth tokens cleared from User record
5. Integration disabled on Doctor record

### Re-authentication

If the refresh token is lost (Google revoked access, or app OAuth consent changed):
1. `GoogleCalendarBanner` appears with amber warning
2. Doctor clicks "Re-autenticar con Google"
3. New consent flow grants fresh tokens
4. Integration resumes working

---

## 15. Error Handling Patterns

### Fire-and-Forget Pattern

Every GCal sync in booking/slot routes:

```typescript
getCalendarTokens(doctorId)
  .then(async tokens => {
    if (!tokens) return;
    // ... perform GCal operation
  })
  .catch(err => console.error('[GCal sync] operation:', err));
```

**Guarantees:**
- HTTP response is never delayed by GCal operations
- Token refresh failures don't break booking workflows
- Individual sync failures are logged but don't cascade

### Error Logging Tags

| Tag | Source |
|---|---|
| `[GCal]` | `getCalendarTokens` failures |
| `[GCal sync]` | Fire-and-forget sync operations |
| `[Resync]` | Per-item failures during resync |
| `[Google Calendar]` | Connect endpoint sync failures |
| `[Google Calendar connect]` | Connect endpoint top-level errors |
| `[Google Calendar disconnect]` | Disconnect failures |
| `[Calendar Resync]` | Resync endpoint top-level errors |

### Best-Effort Operations

Calendar deletion on disconnect, stale event cleanup during resync — failures are logged but never fail the request.

---

## 16. Edge Cases & Known Behaviors

| Scenario | Behavior |
|---|---|
| **Expired access token** | Automatically refreshed by `resolveTokens()` before any API call |
| **Missing refresh token** | Cannot auto-refresh; banner shown until doctor re-authenticates |
| **Manually deleted GCal event** | Resync detects via failed update → re-creates the event |
| **Orphaned GCal events** | Resync deletes events whose slotId/taskId no longer exists in DB |
| **Stale slot.googleEventId** | On public slot booking cancellation, `googleEventId` is cleared so next booking creates a fresh event |
| **All-day tasks** | Created when task has no startTime/endTime; uses `start.date` instead of `dateTime` |
| **Pending booking title** | Range-based pending bookings prefixed with "⏳" (removed on CONFIRMED) |
| **Extended block** | Adjusts GCal event `endTime` = `startTime + extendedBlockMinutes` |
| **Conflict warnings** | Informational only — shown on active bookings (PENDING/CONFIRMED), suppressed on COMPLETED/NO_SHOW |
| **Multiple calendars risk** | If `createDedicatedCalendar` is called twice (e.g., retry), two calendars are created. The DB stores the first. |
| **Webhook channel expiry** | ~24h from Google. Cron renews daily at 6am UTC. If cron fails, channel stops receiving pings (no impact since webhook is a no-op). |
| **Token persistence race** | If DB update fails after token refresh, the fresh token is used once but lost. Next call refreshes again. |
| **Disconnect then reconnect** | Old calendar deleted, new one created. All existing googleEventIds cleared. Resync creates fresh events for all active bookings/tasks. |
