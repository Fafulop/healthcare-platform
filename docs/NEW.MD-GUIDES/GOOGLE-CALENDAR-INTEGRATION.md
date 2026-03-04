# Google Calendar Integration Guide

**Implemented:** 2026-03-03
**Bug fixes:** 2026-03-04 (webhook timezone, date display, booking cancellation sync, shared date utility)
**Enhancements:** 2026-03-04 (COMPLETED/NO_SHOW states, description enrichment, conflict detection, webhook resilience, resync endpoint, error logging)
**Scope:** Doctor app + API app
**Type:** OAuth per doctor, bidirectional sync, dedicated "tusalud.pro" calendar

---

## Overview

Each doctor can connect their own Google account. When connected, a dedicated calendar called **"tusalud.pro"** is created inside their Google Calendar account. All appointment slots, confirmed/pending bookings, and tasks (pendientes) sync automatically in both directions.

```
tusalud.pro DB ──────────────────────────── Google Calendar ("tusalud.pro")

  Slot created         ──── push ────►  Event created (Disponible / Bloqueado)
  Booking PENDING      ──── push ────►  Event updated ("Cita: ⏳ Nombre")
  Booking CONFIRMED    ──── push ────►  Event updated ("Cita: Nombre") + ⚠️ if conflict
  Booking CANCELLED    ──── push ────►  Event updated (reverts to "Disponible")
  Booking COMPLETED    ──── push ────►  Event updated ("✓ Cita: Nombre", basil green)
  Booking NO_SHOW      ──── push ────►  Event updated ("✗ Cita: Nombre", graphite)
  Booking deleted      ──── push ────►  Event deleted
  Task created/updated ──── push ────►  Event created/updated (🔴/🟡/🟢 + ⚠️ if conflict)
  Task completed       ──── push ────►  Event deleted
  Task deleted         ──── push ────►  Event deleted

  Event moved in GCal  ── webhook ──►  Slot/Task date+time updated in DB
  Event deleted in GCal ─ webhook ──►  Slot closed / Task cancelled in DB

  POST /resync         ──── push ────►  Orphan GCal events deleted; all active DB records upserted
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
| `apps/api/src/app/api/doctors/[slug]/google-calendar/status/route.ts` | Returns connection status (including channelExpiry) |
| `apps/api/src/app/api/doctors/[slug]/google-calendar/connect/route.ts` | Creates calendar + runs initial sync |
| `apps/api/src/app/api/doctors/[slug]/google-calendar/disconnect/route.ts` | Removes integration, clears tokens |
| `apps/api/src/app/api/doctors/[slug]/google-calendar/resync/route.ts` | Full bidirectional resync — deletes orphan GCal events, upserts all active slots+tasks |
| `apps/api/src/app/api/calendar/webhook/route.ts` | Receives Google push notifications + opportunistic channel auto-renewal |
| `apps/doctor/src/lib/google-calendar-sync.ts` | Lightweight sync helper using raw fetch (no googleapis) |
| `apps/doctor/src/lib/dates.ts` | Shared date utility — UTC-safe helpers used across entire doctor app |
| `apps/doctor/src/components/GoogleCalendarBanner.tsx` | Amber top-bar warning when Google tokens are missing or expired |

### Modified files

| File | Change |
|---|---|
| `packages/auth/src/nextauth-config.ts` | Added Calendar OAuth scope + token capture in jwt callback |
| `packages/database/prisma/schema.prisma` | Added 7 new fields across User, Doctor, AppointmentSlot, Task |
| `apps/api/src/app/api/appointments/slots/[id]/route.ts` | Sync hooks on PUT, PATCH, DELETE |
| `apps/api/src/app/api/appointments/bookings/[id]/route.ts` | Sync hooks for all status changes (CONFIRMED, CANCELLED, COMPLETED, NO_SHOW, DELETE) with enriched descriptions + conflict detection |
| `apps/api/src/app/api/appointments/bookings/route.ts` | PENDING booking now syncs patientPhone, patientEmail, patientNotes to slot event description |
| `apps/api/src/app/api/appointments/bookings/instant/route.ts` | Instant booking sync now includes bookingStatus, patientPhone, patientNotes |
| `apps/doctor/src/app/api/medical-records/tasks/route.ts` | Sync hook on POST (create) with conflict detection and enriched description |
| `apps/doctor/src/app/api/medical-records/tasks/[id]/route.ts` | Sync hooks on PUT (update) with conflict detection, DELETE |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Added "Integraciones" tab; updated with channelExpiry display, resync button |
| `apps/doctor/src/app/dashboard/layout.tsx` | Added `<GoogleCalendarBanner />` to dashboard shell |
| `apps/api/src/app/api/calendar/webhook/route.ts` | **Bug fix**: UTC timezone; **Enhancement**: opportunistic channel auto-renewal when within 48h of expiry |
| `apps/doctor/src/app/dashboard/pendientes/[id]/page.tsx` | **Bug fix**: date display uses `parseLocalDate()` instead of `new Date()` |
| `apps/doctor/src/app/appointments/CreateSlotsModal.tsx` | **Bug fix**: conflict alert date display; removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/hooks/useDayDetails.ts` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/components/day-details/DayDetailsModal.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/components/day-details/MiniCalendar.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/components/day-details/DayDetailsSection.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/app/dashboard/pendientes/page.tsx` | Removed inline helpers → import from `dates.ts` |
| `apps/doctor/src/app/dashboard/pendientes/new/page.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/app/appointments/page.tsx` | Removed inline helpers → import from `dates.ts` |
| `apps/doctor/src/app/appointments/BookPatientModal.tsx` | Removed inline helpers → import from `dates.ts` |
| `apps/doctor/src/components/RecentActivityTable.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/components/medical-records/MediaUploader.tsx` | Removed inline `formatDateString` → import from `dates.ts` |
| `apps/doctor/src/components/medical-records/EncounterForm.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/encounters/new/page.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/prescriptions/new/page.tsx` | Removed inline helpers → import from `dates.ts` |
| `apps/doctor/src/app/dashboard/practice/flujo-de-dinero/page.tsx` | Removed inline `getLocalDateString` → import from `dates.ts` |

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
| `createSlotEvent(accessToken, refreshToken, calendarId, data)` | Creates a Google Calendar event for an appointment slot. Returns `googleEventId`. |
| `updateSlotEvent(accessToken, refreshToken, calendarId, eventId, data)` | Updates slot event — title, color, description, times. |
| `createTaskEvent(accessToken, refreshToken, calendarId, data)` | Creates an event for a task/pendiente. Returns `googleEventId`. |
| `updateTaskEvent(accessToken, refreshToken, calendarId, eventId, data)` | Updates a task event. |
| `deleteEvent(accessToken, refreshToken, calendarId, eventId)` | Deletes any event by ID. |
| `resolveTokens(user)` | Gets a valid access token, refreshing if expired. Returns `updatedToken` if refreshed. |
| `refreshAccessToken(refreshToken)` | Calls Google token endpoint to get a new access token. |
| `watchCalendar(...)` | Sets up Google push notifications for bidirectional sync. |
| `stopCalendarWatch(...)` | Stops a push notification channel. |

### SlotEventData interface

```typescript
interface SlotEventData {
  id: string;
  date: string;           // "YYYY-MM-DD"
  startTime: string;      // "HH:MM"
  endTime: string;        // "HH:MM"
  isOpen: boolean;
  patientName?: string;
  bookingStatus?: "PENDING" | "CONFIRMED" | "COMPLETED" | "NO_SHOW";
  patientPhone?: string;
  patientEmail?: string;
  patientNotes?: string;
  conflictNote?: string;  // ⚠️ conflict description if task overlaps this slot
  finalPrice?: number;
}
```

### TaskEventData interface

```typescript
interface TaskEventData {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;        // "YYYY-MM-DD"
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  priority: string;       // ALTA / MEDIA / BAJA
  category?: string | null;
  conflictNote?: string;  // ⚠️ conflict description if slot overlaps this task
}
```

### Event color coding

**Slots:**
- `colorId: "7"` (Teal/Peacock) — Available slot (`isOpen: true`, no booking)
- `colorId: "2"` (Green/Sage) — Booked slot (PENDING or CONFIRMED)
- `colorId: "8"` (Grey/Graphite) — Blocked/closed slot **or** NO_SHOW booking
- `colorId: "10"` (Green/Basil) — COMPLETED booking (appointment was attended)

**Tasks:**
- `colorId: "11"` (Red/Tomato) — ALTA priority
- `colorId: "5"` (Yellow/Banana) — MEDIA priority
- `colorId: "10"` (Green/Basil) — BAJA priority

### Event title format

**Slots:**

| Booking state | Calendar event title | Color |
|---|---|---|
| No booking (open) | `Disponible` | Teal |
| No booking (closed) | `Bloqueado` | Graphite |
| PENDING | `Cita: ⏳ {patientName}` | Green |
| CONFIRMED | `Cita: {patientName}` | Green |
| CONFIRMED + conflict | `⚠️ Cita: {patientName}` | Green |
| CANCELLED | `Disponible` | Teal |
| COMPLETED | `✓ Cita: {patientName}` | Basil |
| NO_SHOW | `✗ Cita: {patientName}` | Graphite |

**Tasks:**

| State | Calendar event title |
|---|---|
| Active (no conflict) | `🔴 {title}` / `🟡 {title}` / `🟢 {title}` |
| Active + conflict | `⚠️ 🔴 {title}` / `⚠️ 🟡 {title}` / `⚠️ 🟢 {title}` |

### Event description format

**Slots:**
```
$150 MXN

📞 +52 55 1234 5678
✉️ paciente@email.com
📝 Notas: Paciente con alergia a penicilina

⚠️ Conflicto: pendiente "Firma de recetas" a las 10:00    ← only when conflict exists
```

**Tasks:**
```
Categoría: Seguimiento | Prioridad: Alta

Descripción de la tarea aquí...

⚠️ Conflicto: cita con paciente a las 10:00–11:00          ← only when conflict exists
```

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
- `syncTaskCreated(doctorId, task)` — Creates Google event, saves `googleEventId` to DB. Checks for slot conflicts if task has start/end times.
- `syncTaskUpdated(doctorId, task)` — Updates event; if status is COMPLETADA/CANCELADA, deletes the event. Re-checks conflicts on update.
- `syncTaskDeleted(doctorId, googleEventId)` — Deletes event
- `findSlotConflict(doctorId, dueDate, startTime, endTime)` — Queries PENDING/CONFIRMED bookings that overlap the task's time window. Returns a `⚠️ Conflicto: ...` string if overlap found, `undefined` otherwise.

All functions are **fire-and-forget** — they are called with `.catch(err => console.error(...))` so they never block the API response or cause failures.

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
       Returns: { connected, hasTokens, calendarId, enabled, tokenExpiry, channelExpiry }
       channelExpiry: ISO datetime when the webhook push channel expires (null if not set up)

POST   /api/doctors/[slug]/google-calendar/connect
       Creates "tusalud.pro" calendar, runs initial sync (slots 60 days out + pending tasks)
       Returns: { success, calendarId, syncedSlots, syncedTasks }

DELETE /api/doctors/[slug]/google-calendar/disconnect
       Deletes calendar from Google, clears all tokens and event IDs from DB
       Returns: { success }

POST   /api/doctors/[slug]/google-calendar/resync
       Full bidirectional resync — 3 phases:
         1. List GCal events with source=tusalud.pro (next 90 days)
         2. Delete orphan GCal events (slotId/taskId no longer active in DB)
         3. Upsert all active slots (next 60 days) and active tasks
       Returns: { success, deletedOrphans, createdSlots, updatedSlots, createdTasks, updatedTasks }
```

### Webhook
```
POST /api/calendar/webhook
Headers: X-Goog-Channel-Token (validated against GOOGLE_CALENDAR_WEBHOOK_SECRET)
         X-Goog-Resource-State (sync | exists | not_exists)
         X-Goog-Channel-Id (format: "doctor_{doctorId}_{randomHex}")
Processes: moved events → update slot/task date+time in DB
           deleted events → close slot / cancel task in DB
           channel < 48h to expiry → fire-and-forget auto-renewal (defensive fallback)
```

---

## Date Handling — UTC Safety

### The problem

The DB stores dates as UTC midnight — e.g., `2026-03-04T00:00:00.000Z`. In a browser running at UTC−6 (Mexico City), calling `new Date(isoStr).toLocaleDateString()` first converts to local time: midnight UTC becomes 6 PM on March 3rd, so the displayed date is one day behind.

The same applies server-side on Railway (UTC server): calling `new Date(googleDateTimeStr).toTimeString()` returns UTC time, not the Mexico City time that Google sent.

### The fix — shared utility

**`apps/doctor/src/lib/dates.ts`** — single source of truth for all date operations in the doctor app:

```typescript
// Parse a YYYY-MM-DD (or ISO) string as local midnight — no UTC shift
export function parseLocalDate(isoStr: string): Date {
  const [y, m, d] = isoStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Format YYYY-MM-DD (or ISO) string for display — safe, no UTC shift
export function formatLocalDate(
  isoStr: string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'es-MX'
): string {
  return parseLocalDate(isoStr).toLocaleDateString(locale, options);
}

// Get a YYYY-MM-DD string from an existing Date object (e.g., new Date())
export function getLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

### Rule

**Never use `new Date(dbDateStr)` directly for display.** Always use `parseLocalDate()` or `formatLocalDate()` from `@/lib/dates`.

### Webhook time extraction

Google returns `dateTime` in the calendar's configured timezone (America/Mexico_City), e.g. `"2026-03-04T10:00:00-06:00"`. On a UTC Railway server, `new Date(str).toTimeString()` would give `"16:00"` (UTC) instead of `"10:00"` (local). Fix: extract directly from the string:

```typescript
// Correct — slice directly from ISO string, no Date object involved
const newDate      = event.start.dateTime.slice(0, 10);   // "2026-03-04"
const newStartTime = event.start.dateTime.slice(11, 16);  // "10:00"
const newEndTime   = event.end.dateTime.slice(11, 16);    // "11:00"
```

---

## Sync Hooks in Existing Routes

All hooks are **fire-and-forget** — they never block the HTTP response. Pattern:

```typescript
// After successful DB write:
syncSomeEvent(data).catch(err => console.error('[GCal sync] syncSomeEvent:', err));
// OR for routes in apps/api:
getCalendarTokens(doctorId).then(async tokens => {
  if (!tokens) return;
  updateSlotEvent(tokens.accessToken, ...).catch(err => console.error('[GCal sync] updateSlotEvent:', err));
}).catch(err => console.error('[GCal sync] getCalendarTokens:', err));
```

All sync errors are logged with `console.error('[GCal sync] ...', err)` — never silently swallowed. This makes Railway logs actionable when sync fails.

### Routes modified

| Route | Trigger | Calendar action |
|---|---|---|
| `POST /api/appointments/slots` | Slot created (single or recurring) | `createSlotEvent` per slot; saves `googleEventId` back to DB |
| `PUT /api/appointments/slots/[id]` | Slot updated | `updateSlotEvent` |
| `PATCH /api/appointments/slots/[id]` | isOpen toggled | `updateSlotEvent` (color changes) |
| `DELETE /api/appointments/slots/[id]` | Slot deleted | `deleteEvent` |
| `POST /api/appointments/bookings` | New booking (PENDING) | `updateSlotEvent` — title: `"Cita: ⏳ Patient"`, description: phone + email + notes |
| `PATCH /api/appointments/bookings/[id]` | Booking → CONFIRMED | `updateSlotEvent` — enriched description, conflict check; `⚠️` prefix if task overlaps |
| `PATCH /api/appointments/bookings/[id]` | Booking → CANCELLED | `updateSlotEvent` — reverts to `"Disponible"` (teal) |
| `PATCH /api/appointments/bookings/[id]` | Booking → COMPLETED | `updateSlotEvent` — `"✓ Cita: Patient"` (basil green) |
| `PATCH /api/appointments/bookings/[id]` | Booking → NO_SHOW | `updateSlotEvent` — `"✗ Cita: Patient"` (graphite) |
| `DELETE /api/appointments/bookings/[id]` | Booking+slot deleted | `deleteEvent` |
| `POST /api/appointments/bookings/instant` | Instant confirmed booking | `createSlotEvent` with bookingStatus=CONFIRMED, phone, notes |
| `POST /api/medical-records/tasks` | Task created | `syncTaskCreated` — enriched description, conflict check vs active slots |
| `PUT /api/medical-records/tasks/[id]` | Task updated | `syncTaskUpdated` — re-checks conflicts; deletes event if COMPLETADA/CANCELADA |
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
Webhook válido hasta: 11/03/2026                        ← amber + ⚠️ if < 3 days away
[ ↺ Sincronizar ahora ]  [ ✕ Desconectar ]
```

**5. Action feedback** — inline message after connect/disconnect/sync:
```
✓ Conectado. 12 citas y 5 pendientes sincronizados.
✓ Sincronizado: 3 citas actualizadas, 2 eventos obsoletos eliminados.
✓ Todo sincronizado, sin cambios.
✗ Error al conectar: No Google tokens found...
```

### Token Expiry Banner

`apps/doctor/src/components/GoogleCalendarBanner.tsx` is rendered in `apps/doctor/src/app/dashboard/layout.tsx`. It:

1. On mount, reads a `sessionStorage` key `gcal_token_banner_dismissed` — if set, renders nothing
2. Calls `GET /api/doctors/[slug]/google-calendar/status`
3. If `hasTokens: false` or `tokenExpiry` is in the past → shows an amber top bar:
   ```
   ⚠️ Tu conexión con Google Calendar ha expirado.  [ Re-autenticarse ]
   ```
4. "Re-autenticarse" calls `signIn("google", { callbackUrl: "/dashboard/mi-perfil" })` — the full Google consent screen re-grants Calendar scope
5. A dismiss button stores `gcal_token_banner_dismissed = "1"` in `sessionStorage` (clears on tab close)

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
- [x] Bug fixes merged: webhook timezone, booking cancellation sync, date display off-by-one, shared date utility
- [x] Enhancements merged: COMPLETED/NO_SHOW states, description enrichment, conflict detection, webhook auto-renewal, resync endpoint, GoogleCalendarBanner, error logging
- [ ] Deploy code to Railway (git push to main)
- [ ] Each doctor re-signs in with Google (to grant Calendar scope)
- [ ] Test: go to `/dashboard/mi-perfil` → Integraciones tab → Conectar Google Calendar
- [ ] Run full test checklist below

---

## End-to-End Test Checklist

Use this after connecting Google Calendar to verify all sync directions work correctly.

### Setup
- [ ] Doctor connected Google Calendar (`/dashboard/mi-perfil` → Integraciones → Conectar)
- [ ] "tusalud.pro" calendar visible in Google Calendar app

### Slots (App → GCal)

| Action in app | Expected in Google Calendar |
|---|---|
| Create a single slot | New event: `"Disponible"` (teal) at correct date/time |
| Create recurring slots (e.g. every Monday) | One teal event per slot, each at the right date/time |
| Toggle slot closed (`isOpen = false`) | Event turns graphite, title becomes `"Bloqueado"` |
| Toggle slot open again | Event returns to teal `"Disponible"` |
| Edit slot time | Event start/end time updates |
| Delete a slot | Event disappears from GCal |

### Bookings (App → GCal)

| Action in app | Expected in Google Calendar |
|---|---|
| Patient creates booking (PENDING) | Slot event title → `"Cita: ⏳ Nombre"` (green); description shows phone, email, notes |
| Doctor confirms booking | Title → `"Cita: Nombre"`; description includes phone + notes |
| Confirm booking that overlaps an active task | Title → `"⚠️ Cita: Nombre"`; description includes conflict note |
| Cancel booking | Event reverts to `"Disponible"` (teal); description cleared |
| Mark booking as Completed | Title → `"✓ Cita: Nombre"` (basil green); event stays in calendar as history |
| Mark booking as No-Show | Title → `"✗ Cita: Nombre"` (graphite); event stays in calendar as history |
| Delete booking+slot | Event disappears from GCal |

### Tasks / Pendientes (App → GCal)

| Action in app | Expected in Google Calendar |
|---|---|
| Create task with due date (no time) | All-day event: `"🔴/🟡/🟢 Título"`; description: `Categoría \| Prioridad` |
| Create timed task (with start+end time) | Timed event at correct hours |
| Create timed task overlapping a confirmed booking | Title → `"⚠️ 🔴 Título"`; description includes conflict note |
| Edit task title / date / priority | GCal event updates accordingly |
| Mark task as Completada | Event disappears from GCal |
| Mark task as Cancelada | Event disappears from GCal |
| Delete task | Event disappears from GCal |

### Google Calendar → App (Webhook / bidirectional)

| Action in Google Calendar | Expected in app DB |
|---|---|
| Drag a slot event to a new time (same day) | Slot `startTime` + `endTime` update |
| Drag a slot event to a different day | Slot `date` updates |
| Drag a timed task event to a new time | Task `startTime` + `endTime` update |
| Drag a task event to a different day | Task `dueDate` updates |
| Delete a slot event in GCal | Slot `isOpen` → `false` in DB |
| Delete a task event in GCal | Task `status` → `CANCELADA` in DB |

> **Note:** Webhook actions require a production deployment (public URL). Test these on Railway, not localhost.

### Conflict Detection

| Scenario | Expected |
|---|---|
| Confirm booking at 10:00–11:00 when a task exists at 10:30 | GCal slot event gets `⚠️` prefix + conflict note in description |
| Create task at 10:00–11:00 when a CONFIRMED booking exists at 10:30 | GCal task event gets `⚠️` prefix + conflict note |
| Cancel the conflicting task/booking | Re-save the other item; `⚠️` should no longer appear (or run resync) |

### Resync ("Sincronizar ahora")

| Scenario | Expected |
|---|---|
| Manually delete a GCal slot event, then resync | Event re-created in GCal; `googleEventId` restored in DB |
| Delete a slot from the app without GCal sync (edge case) | Resync detects orphan GCal event and deletes it |
| Connect calendar after creating several slots/tasks | Resync button pushes all existing records to GCal |
| Result message after resync with changes | `"Sincronizado: N citas actualizadas, N eventos obsoletos eliminados."` |
| Result message after resync with no changes | `"Todo sincronizado, sin cambios."` |

### Token / Channel Health

| Check | Expected |
|---|---|
| Integraciones tab → "Token válido hasta" | Shows a future date |
| Integraciones tab → "Webhook válido hasta" | Shows a future date (amber + ⚠️ if < 3 days away) |
| Let token expire, open dashboard | Amber banner appears: "Tu conexión con Google Calendar ha expirado" |
| Click "Re-autenticarse" in banner | Google consent screen; after sign-in, tokens renewed |

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
| ✅ Fixed | Booking cancellation sync | `bookings/[id]/route.ts` CANCELLED now calls `updateSlotEvent` → reverts to "Disponible" |
| ✅ Fixed | Webhook UTC timezone bug | Webhook extracted times via `toTimeString()` (Railway = UTC server), returning wrong time. Now uses `.slice()` on ISO string directly |
| ✅ Fixed | Date display off-by-one | All date display in doctor app now uses `parseLocalDate()` from `@/lib/dates.ts` — eliminates UTC midnight → previous day shift |
| ✅ Fixed | COMPLETED/NO_SHOW not reflected | Booking terminal states now sync — `✓ Cita:` (basil) for COMPLETED, `✗ Cita:` (graphite) for NO_SHOW |
| ✅ Fixed | Silent GCal sync failures | All `.catch(() => {})` replaced with `console.error('[GCal sync]', err)` — failures now logged in Railway |
| ✅ Fixed | Event descriptions empty | Slot events now include price, phone, email, notes; task events include category + priority |
| ✅ Fixed | No conflict visibility in calendar | Confirmed bookings and timed tasks show `⚠️` prefix when an overlapping task/slot is found |
| ✅ Fixed | Webhook channel expiry silent | `/status` now returns `channelExpiry`; UI shows expiry date (amber if < 3 days); webhook auto-renews when within 48h |
| ✅ Fixed | No way to recover stale GCal state | New `POST /resync` endpoint does full orphan cleanup + upsert of all active records |
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
| No booking (open) | Disponible | Teal |
| No booking (closed) | Bloqueado | Graphite |
| PENDING | Cita: ⏳ Patient Name | Green |
| CONFIRMED | Cita: Patient Name | Green |
| CONFIRMED + conflict | ⚠️ Cita: Patient Name | Green |
| CANCELLED | Disponible | Teal |
| COMPLETED | ✓ Cita: Patient Name | Basil (dark green) |
| NO_SHOW | ✗ Cita: Patient Name | Graphite |

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

---

### 7. COMPLETED / NO_SHOW Booking States in Calendar ✅ Fixed

**What it is:**
After a booking is marked COMPLETED or NO_SHOW, the Google Calendar event previously showed no change — the slot just stayed as "Cita: Patient Name". This made it impossible to distinguish attended, no-showed, and available slots in the calendar.

**Current state:**
✅ **Implemented.** When a booking transitions to either terminal state, a fire-and-forget `updateSlotEvent` call is made:

| State | Title | Color |
|---|---|---|
| COMPLETED | `✓ Cita: {patientName}` | Basil (dark green) — appointment was attended |
| NO_SHOW | `✗ Cita: {patientName}` | Graphite — patient did not appear |

Events are **updated, not deleted** — this preserves appointment history in the doctor's Google Calendar. The ✓/✗ prefixes make it easy to scan the calendar for missed appointments.

**Implementation:** `apps/api/src/app/api/appointments/bookings/[id]/route.ts` — block after the CANCELLED sync block.

---

### 8. Event Description Enrichment ✅ Fixed

**What it is:**
Google Calendar events previously only had a title. Doctors opening an event had to go back to the app to see patient contact info or task details.

**Current state:**
✅ **Implemented.**

**Slot events now include:**
```
$150 MXN

📞 +52 55 1234 5678
✉️ paciente@email.com
📝 Notas: Paciente con alergia a penicilina
```

**Task events now include:**
```
Categoría: Seguimiento | Prioridad: Alta

Descripción de la tarea aquí...
```

Fields are only added when non-null. Extended properties (`slotId`/`taskId`/`source`) are unchanged — they remain in the `private` extendedProperties block and are not visible to the doctor.

**Implementation:** `SlotEventData` and `TaskEventData` interfaces in `apps/api/src/lib/google-calendar.ts` — new optional fields; `slotToEvent()` and `taskToEvent()` builders updated. `apps/doctor/src/lib/google-calendar-sync.ts` — `buildTaskEvent()` updated with `PRIORITY_LABELS`/`CATEGORY_LABELS` maps.

---

### 9. Conflict Detection Surfaced in Calendar ✅ Fixed

**What it is:**
A doctor could schedule a task (pendiente) at the same time as an existing appointment slot, or confirm a booking that overlaps an active task — with no visual warning in Google Calendar.

**Current state:**
✅ **Implemented.** Conflicts are detected and surfaced as `⚠️` prefixes in both the event title and description.

**How it works:**

*Booking → task conflict (on CONFIRMED):*
```typescript
// apps/api/src/app/api/appointments/bookings/[id]/route.ts
const dayTasks = await prisma.task.findMany({
  where: { doctorId, dueDate: slot.date, status: { in: ['PENDIENTE', 'EN_PROGRESO'] } },
  select: { title, startTime, endTime },
});
const hit = dayTasks.find(t =>
  t.startTime && t.endTime &&
  t.startTime < slot.endTime &&        // string HH:MM comparison works correctly
  t.endTime > slot.startTime
);
if (hit) conflictNote = `⚠️ Conflicto: pendiente "${hit.title}" a las ${hit.startTime}`;
```

*Task → booking conflict (on create/update):*
```typescript
// apps/doctor/src/lib/google-calendar-sync.ts
async function findSlotConflict(doctorId, dueDate, startTime, endTime) {
  const slots = await prisma.appointmentSlot.findMany({
    where: { doctorId, date: new Date(dueDate), isOpen: true },
    include: { bookings: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } } },
  });
  const hit = slots.find(s =>
    s.bookings.length > 0 &&
    s.startTime < endTime &&
    s.endTime > startTime
  );
  return hit ? `⚠️ Conflicto: cita con paciente a las ${hit.startTime}–${hit.endTime}` : undefined;
}
```

**Scope:**
- Only timed tasks (with `startTime` AND `endTime` set) are checked for conflicts
- Only PENDING/CONFIRMED bookings count as conflicts
- The conflict note is fire-and-forget alongside the normal sync — it does NOT block the operation

---

### 10. Webhook Channel Expiry Visibility + Auto-Renewal ✅ Fixed

**What it is:**
The webhook push channel expires silently after ~7 days. While the daily cron handles renewal, there was no visibility into the channel's health in the UI, and if the cron job failed for a couple of days the channel could expire unnoticed.

**Current state:**
✅ **Implemented.** Three layers of defense:

**Layer 1 — Status endpoint exposes channelExpiry:**
`GET /api/doctors/[slug]/google-calendar/status` now returns `channelExpiry` (ISO datetime or null). The Integraciones tab displays it, turning amber + ⚠️ when within 3 days.

**Layer 2 — Dashboard banner for token expiry:**
`GoogleCalendarBanner` component renders in the dashboard layout. It checks token validity on mount and shows a dismissible amber bar if tokens are expired or missing.

**Layer 3 — Webhook handler auto-renews opportunistically:**
```typescript
// apps/api/src/app/api/calendar/webhook/route.ts
const hoursUntilExpiry = (doctor.googleChannelExpiry.getTime() - Date.now()) / (1000 * 60 * 60);
if (hoursUntilExpiry < 48) {
  // Fire-and-forget: stop old channel, create new one, update DB
  (async () => {
    await stopCalendarWatch(accessToken, refreshToken, oldChannelId, oldResourceId);
    const newChannelId = `doctor_${doctor.id}_${crypto.randomBytes(4).toString("hex")}`;
    const { resourceId, expiration } = await watchCalendar(...);
    await prisma.doctor.update({ data: { googleChannelId, googleChannelResourceId, googleChannelExpiry } });
  })();
}
```

This means even if the Railway cron job fails for up to 48 hours, the next incoming Google push notification will trigger self-healing renewal. The 200 response to Google is never delayed.

---

### 11. Full Resync Endpoint ✅ Fixed

**What it is:**
Prior to this feature, there was no way to recover from a state mismatch (e.g., a doctor manually deleting Google Calendar events, or DB records created while Google Calendar was disconnected). The "Sincronizar ahora" button only re-created the initial sync.

**Current state:**
✅ **Implemented.** `POST /api/doctors/[slug]/google-calendar/resync` performs a true bidirectional resync in 3 phases:

**Phase 1 — List our GCal events:**
```typescript
calendarApi.events.list({
  privateExtendedProperty: ["source=tusalud.pro"],  // only events we created
  timeMin: today, timeMax: in90Days,
  singleEvents: true, maxResults: 250,
})
// Paginated with nextPageToken
```

**Phase 2 — Delete orphans:**
For each GCal event, if its `slotId` or `taskId` is not in the current active DB sets → delete from GCal, clear `googleEventId` from DB.

**Phase 3 — Upsert all active records:**
- For each slot (next 60 days): if `googleEventId` exists → `updateSlotEvent`; else → `createSlotEvent`. On update-404 (manually deleted in GCal) → fallback to `createSlotEvent`.
- Same pattern for all active (PENDIENTE/EN_PROGRESO) tasks.

**Returns:**
```json
{
  "success": true,
  "deletedOrphans": 3,
  "createdSlots": 5,
  "updatedSlots": 18,
  "createdTasks": 2,
  "updatedTasks": 4
}
```

The "Sincronizar ahora" button in the Integraciones tab calls this endpoint and shows a human-readable summary: `"Sincronizado: 5 citas actualizadas, 3 eventos obsoletos eliminados."` or `"Todo sincronizado, sin cambios."` if all counts are 0.
