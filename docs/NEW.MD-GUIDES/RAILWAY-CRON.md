# Railway Cron Service Guide

**Last Updated:** 2026-04-09
**Scope:** Separate Railway service (`cron`) that calls scheduled API endpoints on a timer

---

## Overview

The cron is a **standalone Bun v1.3 service** on Railway — not part of the Next.js API app. It runs on a fixed schedule (every 15 minutes) and calls protected HTTP endpoints on the API service. Each endpoint does its own work and returns a JSON result that gets logged.

```
Railway Cron Service (Bun, every 15 min)
         │
         ├── POST /api/cron/appointment-reminders      ← email reminders, every run
         ├── POST /api/cron/telegram-reminders         ← appointment Telegram reminders, every run
         ├── POST /api/cron/telegram-task-reminders    ← task Telegram reminders, every run
         ├── POST /api/cron/telegram-daily-summary     ← daily summary, every run (self-gates by hour)
         └── POST /api/calendar/renew-channels         ← once a day at 08:00 UTC
```

The cron service itself has no database access and no business logic — it is purely a scheduler that triggers API endpoints.

---

## Railway Setup

| Property | Value |
|---|---|
| Service name | `cron` (Railway project: `DOCTORES-SEO-PACIENTE-MGMT`) |
| Runtime | Bun v1.3 |
| Schedule | Every 15 minutes (configured in Railway dashboard) |
| File | `index.ts` — edited directly in Railway's service editor (no local file) |

### Environment variables

The cron service has 2 custom variables, both **shared** across services:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the API service (e.g. `https://healthcareapi-production-fb70.up.railway.app`) |
| `CRON_SECRET` | Shared secret sent as `Authorization: Bearer <secret>` on every request |

Railway also injects 7 standard variables automatically.

---

## Authentication

Every cron endpoint on the API side verifies the request with:

```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

`CRON_SECRET` is a shared variable — same value on both the cron service and the API service.

---

## Current Cron Jobs

### 1. Appointment reminder emails — every 15 min

**Endpoint:** `POST /api/cron/appointment-reminders`
**File:** `apps/api/src/app/api/cron/appointment-reminders/route.ts`

Sends reminder emails to patients with `CONFIRMED` appointments starting in approximately 2 hours. Uses a ±15 min window (105–135 min from now) so no appointment is missed between runs.

- Queries bookings for today and tomorrow (rough filter)
- Filters to those whose appointment time falls in the 2-hour window
- Requires doctor to have Google OAuth connected (`reminderEmailEnabled` flag)
- Stamps `reminderEmailSentAt` after sending to prevent duplicates

---

### 2. Telegram appointment reminders — every 15 min

**Endpoint:** `POST /api/cron/telegram-reminders`
**File:** `apps/api/src/app/api/cron/telegram-reminders/route.ts`

Sends ✅/⏳ Telegram reminder messages to doctors before upcoming `CONFIRMED` or `PENDING` appointments. Each doctor sets their own offset and can toggle reminders per status type.

- Queries bookings for today and tomorrow with no `telegramReminderSentAt`
- For each booking, computes `appointmentTime − doctorOffset` using "fake UTC" arithmetic (MX local times treated as UTC-0 for consistent offset subtraction — DST cancels out)
- Fires if the trigger time falls in the current 15-min window
- Requires doctor to have `telegramChatId` set and `TELEGRAM_BOT_TOKEN` configured
- Stamps `telegramReminderSentAt` on the Booking after send

**Doctor preferences** (on `public.doctors`):

| Column | Default | Description |
|---|---|---|
| `telegram_notify_reminder_confirmed` | `true` | Send reminders for CONFIRMED bookings |
| `telegram_notify_reminder_pending` | `true` | Send reminders for PENDING bookings |
| `telegram_reminder_offset_minutes` | `60` | Minutes before appointment to send; valid values: 15, 30, 60, 120, 240, 1440 |

---

### 3. Telegram task reminders — every 15 min

**Endpoint:** `POST /api/cron/telegram-task-reminders`
**File:** `apps/api/src/app/api/cron/telegram-task-reminders/route.ts`

Sends 📌 Telegram reminder messages to doctors before upcoming tasks (PENDIENTE or EN_PROGRESO status).

- Queries tasks for today and tomorrow with no `telegramReminderSentAt`
- Tasks without a `startTime` use `07:00` MX as the effective reference time
- Same fake UTC offset arithmetic as appointment reminders
- Stamps `telegramReminderSentAt` on the Task after send

**Doctor preferences** (on `public.doctors`):

| Column | Default | Description |
|---|---|---|
| `telegram_notify_task_reminder` | `true` | Send task reminders |
| `telegram_task_reminder_offset_minutes` | `60` | Minutes before task to send; valid values: 15, 30, 60, 120, 240, 1440 |

---

### 4. Telegram daily summary — every 15 min (self-gating)

**Endpoint:** `POST /api/cron/telegram-daily-summary`
**File:** `apps/api/src/app/api/cron/telegram-daily-summary/route.ts`

Sends 📅 a daily agenda briefing to doctors at their configured local hour. Fires at most once per doctor per calendar day (MX local date).

- "Today" is always the Mexico City calendar date at cron fire time
- Per-doctor: checks `telegramDailySummarySentAt` — skips if already sent today (MX date)
- Checks if now falls in the doctor's configured 15-min window using fixed-date fake UTC for HH:MM comparison
- Fetches all CONFIRMED + PENDING bookings for the full day (00:00–23:59 MX)
- Fetches all tasks (all statuses) for the full day
- Appointments sorted in application code (not DB `orderBy`) to handle mixed slot/freeform bookings — freeform bookings have no `slot` and would sort incorrectly with a relation `orderBy`
- Tasks without `startTime` sorted to bottom; tasks with `startTime` sorted first by time
- Stamps `telegramDailySummarySentAt` on Doctor after send

**Doctor preferences** (on `public.doctors`):

| Column | Default | Description |
|---|---|---|
| `telegram_daily_summary_enabled` | `false` | Whether to send the daily summary |
| `telegram_daily_summary_time` | `"08:00"` | Hour to send (HH:00, whole hours only, MX local time) |
| `telegram_daily_summary_sent_at` | `null` | Timestamp of last send — used for deduplication |

---

### 5. Google Calendar channel renewal — daily at 08:00 UTC

**Endpoint:** `POST /api/calendar/renew-channels`
**File:** `apps/api/src/app/api/calendar/renew-channels/route.ts`

Renews Google Calendar push notification channels that are about to expire.

- Runs only when `hourUtc === 8` (08:00 UTC = 02:00 Mexico City standard / 03:00 DST)
- Finds all active doctors with Google Calendar enabled
- Stops the expiring channel and creates a fresh one
- Refreshes OAuth tokens if needed

---

## Full `index.ts` (current)

```typescript
// index.ts (Bun v1.3 runtime)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const cronSecret = process.env.CRON_SECRET;

if (!apiUrl || !cronSecret) {
  console.error("[cron] Missing NEXT_PUBLIC_API_URL or CRON_SECRET");
  process.exit(1);
}

// --- Appointment reminder emails (runs every 15 min) ---
const remindersRes = await fetch(`${apiUrl}/api/cron/appointment-reminders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
});
console.log(`[reminders] status=${remindersRes.status}`, JSON.stringify(await remindersRes.json()));

// --- Telegram appointment reminders (runs every 15 min) ---
const telegramRemindersRes = await fetch(`${apiUrl}/api/cron/telegram-reminders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
});
console.log(`[telegram-reminders] status=${telegramRemindersRes.status}`, JSON.stringify(await telegramRemindersRes.json()));

// --- Telegram task reminders (runs every 15 min) ---
const telegramTaskRemindersRes = await fetch(`${apiUrl}/api/cron/telegram-task-reminders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
});
console.log(`[telegram-task-reminders] status=${telegramTaskRemindersRes.status}`, JSON.stringify(await telegramTaskRemindersRes.json()));

// --- Telegram daily summary (runs every 15 min, self-gates by doctor's configured hour) ---
const telegramDailySummaryRes = await fetch(`${apiUrl}/api/cron/telegram-daily-summary`, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
});
console.log(`[telegram-daily-summary] status=${telegramDailySummaryRes.status}`, JSON.stringify(await telegramDailySummaryRes.json()));

// --- Google Calendar channel renewal (runs daily — skip if not the right hour) ---
const hourUtc = new Date().getUTCHours();
if (hourUtc === 8) { // runs once a day at 08:00 UTC
  const calRes = await fetch(`${apiUrl}/api/calendar/renew-channels`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
  });
  console.log(`[calendar-renew] status=${calRes.status}`, JSON.stringify(await calRes.json()));
}
```

---

## Adding a New Cron Job

### 1. Create the API endpoint

Add a new route under `apps/api/src/app/api/cron/your-job/route.ts`. Follow the existing pattern:

```typescript
// POST /api/cron/your-job
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. Auth check — always first
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Your logic here

  // 3. Return consistent shape
  return NextResponse.json({ success: true, sent: 0, skipped: 0 });
}
```

### 2. Add DB columns if needed

- Add fields to `schema.prisma`
- Create a SQL migration in `packages/database/prisma/migrations/`
- Run locally: `npx prisma db execute --file packages/database/prisma/migrations/your-migration.sql --schema packages/database/prisma/schema.prisma`
- Regenerate client: `pnpm db:generate`
- Run on Railway before deploying: `npx prisma db execute --file ... --url "<RAILWAY_DATABASE_URL>"`

### 3. Add to Railway cron `index.ts`

Open the Railway cron service editor and add a fetch block:

```typescript
// --- Your job description ---
const yourJobRes = await fetch(`${apiUrl}/api/cron/your-job`, {
  method: "POST",
  headers: { Authorization: `Bearer ${cronSecret}`, "Content-Type": "application/json" },
});
console.log(`[your-job] status=${yourJobRes.status}`, JSON.stringify(await yourJobRes.json()));
```

For jobs that should only run at a specific hour (not every 15 min):

```typescript
const hourUtc = new Date().getUTCHours();
if (hourUtc === 10) { // 10:00 UTC = 04:00 Mexico City standard
  // fetch call here
}
```

For jobs that should run every 15 min but self-gate internally (like `telegram-daily-summary`), implement the time-window check inside the endpoint rather than in `index.ts`.

### 4. Deploy

Push the code. Railway redeploys the API automatically. The cron service picks up `index.ts` changes immediately on its next run.

---

## Timezone Reference

All cron windows use **Mexico City time** (`America/Mexico_City`). The `sv-SE` locale trick is used throughout to get a reliable `YYYY-MM-DD HH:MM:SS` string in any environment:

```typescript
const nowMxStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
// → "2026-04-09 09:30:00"
const todayMx   = nowMxStr.slice(0, 10);   // "2026-04-09"
const nowMxHHMM = nowMxStr.slice(11, 16);  // "09:30"
```

| UTC offset | Period |
|---|---|
| UTC−6 | Standard time (Nov–Mar approx) |
| UTC−5 | Daylight saving time (Mar–Oct approx) |

---

## Troubleshooting

**Cron job not firing**
- Check Railway cron service logs for errors
- Verify `NEXT_PUBLIC_API_URL` and `CRON_SECRET` are set on the cron service
- Confirm the API endpoint returns 200 (check API service deploy logs)

**`status=401` in cron logs**
- `CRON_SECRET` mismatch between cron service and API service
- Both must use the same shared variable value

**Job fires but `sent=0`**
- Check `skipped` and `errors` in the logged JSON
- The relevant DB columns may not exist yet — run the migration
- Check that doctors have `telegramChatId` set and the relevant toggle enabled

**`SyntaxError: Failed to parse JSON` in cron logs**
- The API endpoint returned HTML (error page) instead of JSON
- Most common cause: missing DB columns (migration not yet run on Railway)
- Check API service logs for the actual error
