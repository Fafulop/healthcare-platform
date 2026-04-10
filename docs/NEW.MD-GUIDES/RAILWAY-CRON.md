# Railway Cron Service Guide

**Last Updated:** 2026-04-09
**Scope:** Separate Railway service (`cron`) that calls scheduled API endpoints on a timer

---

## Overview

The cron is a **standalone Bun v1.3 service** on Railway — not part of the Next.js API app. It runs on a fixed schedule (every 15 minutes) and calls protected HTTP endpoints on the API service. Each endpoint does its own work and returns a result that gets logged.

```
Railway Cron Service (Bun, every 15 min)
         │
         ├── POST /api/cron/appointment-reminders   ← every run
         ├── POST /api/cron/telegram-reminders       ← every run
         └── POST /api/calendar/renew-channels       ← once a day at 08:00 UTC
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

Sends Telegram reminder messages to doctors before upcoming `CONFIRMED` or `PENDING` appointments. Each doctor sets their own offset (15 min, 30 min, 1h, 2h, 4h, or 1 day before) and can toggle reminders per status type.

- Queries bookings for today and tomorrow with no `telegramReminderSentAt`
- For each booking, computes `appointmentTime - doctorOffset` using "fake UTC" arithmetic (MX local times treated as UTC-0 for consistent offset subtraction)
- Fires if the trigger time falls in the current 15-min window
- Requires doctor to have `telegramChatId` set and `TELEGRAM_BOT_TOKEN` configured
- Stamps `telegramReminderSentAt` after sending to prevent duplicates
- Silently skipped if Telegram is not configured

**Doctor preferences** (stored on `doctors` table):

| Column | Default | Description |
|---|---|---|
| `telegram_notify_reminder_confirmed` | `true` | Send reminders for CONFIRMED bookings |
| `telegram_notify_reminder_pending` | `true` | Send reminders for PENDING bookings |
| `telegram_reminder_offset_minutes` | `60` | How many minutes before the appointment |

---

### 3. Google Calendar channel renewal — daily at 08:00 UTC

**Endpoint:** `POST /api/calendar/renew-channels`
**File:** `apps/api/src/app/api/calendar/renew-channels/route.ts`

Renews Google Calendar push notification channels that are about to expire. Google Calendar webhooks have a maximum lifetime and must be periodically renewed.

- Runs only when `hourUtc === 8` (08:00 UTC = 02:00 Mexico City standard / 03:00 DST)
- Finds all active doctors with Google Calendar enabled
- Stops the expiring channel and creates a fresh one with a new ID
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

// --- Appointment reminders (runs every 15 min) ---
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
  return NextResponse.json({ success: true, processed: 0 });
}
```

### 2. Add DB columns if needed

- Add fields to `schema.prisma`
- Create a SQL migration in `packages/database/prisma/migrations/`
- Run locally: `npx prisma db execute --file ... --schema prisma/schema.prisma`
- Regenerate client: `pnpm db:generate`
- Run on Railway before deploying: `npx prisma db execute --file ... --url "RAILWAY_PUBLIC_URL"`

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

For jobs that should only run at specific times (not every 15 min):

```typescript
const hourUtc = new Date().getUTCHours();
if (hourUtc === 10) { // 10:00 UTC = 04:00 Mexico City standard
  // fetch call here
}
```

### 4. Deploy

Push the code. Railway redeploys the API automatically. The cron service picks up `index.ts` changes immediately on its next run.

---

## Timezone Reference

All cron windows use **Mexico City time** (`America/Mexico_City`). The `sv-SE` locale trick is used throughout to get a reliable `YYYY-MM-DD HH:MM:SS` string in any timezone:

```typescript
const nowMxStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
// → "2026-04-09 09:30:00"
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

**Job fires but does nothing**
- Check the `sent` / `skipped` / `errors` fields in the logged JSON
- Check API service logs for the specific error
