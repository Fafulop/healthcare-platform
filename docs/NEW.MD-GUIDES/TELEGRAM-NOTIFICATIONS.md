# Telegram Notifications Guide

**Implemented:** 2026-03-20
**Last Updated:** 2026-04-09
**Scope:** API app (notification dispatch + bot webhook) + Doctor app (Integraciones UI)
**Type:** Outbound only — app sends messages to doctor via Telegram Bot API

## Production Configuration (already set up)

| What | Value |
|---|---|
| Bot token env var | `TELEGRAM_BOT_TOKEN` set on Railway `api` service |
| Bot username | `@Tusalud_citas_bot` |
| API domain | `healthcareapi-production-fb70.up.railway.app` |
| Webhook URL (registered) | `https://healthcareapi-production-fb70.up.railway.app/api/telegram/webhook` |
| Doctor app URL | `doctor.tusalud.pro` |

The webhook is already registered. No setup steps remain for the developer — only doctors need to link their Chat ID.

---

## Overview

Six types of Telegram notifications are sent to the doctor, each with a distinctive emoji so the doctor instantly recognizes the type at a glance:

| Emoji | Type | Trigger |
|---|---|---|
| 🆕 | New pending booking | Patient books from public portal (status `PENDING`) |
| 📝 | Form submitted | Patient submits pre-consultation form |
| 📌 | Task reminder | Scheduled cron — N minutes before task start time |
| ✅ | Appointment reminder (confirmed) | Scheduled cron — N minutes before appointment |
| ⏳ | Appointment reminder (pending) | Scheduled cron — N minutes before appointment |
| 📅 | Daily agenda summary | Scheduled cron — once per day at doctor's configured hour |

Notifications are **per-doctor** — each doctor links their own Telegram account via a Chat ID stored on their profile. Each notification type can be individually toggled on/off.

---

## Architecture

### Instant notifications (fire-and-forget)

New booking and form-submitted notifications fire immediately when the event occurs, using `.then().catch()` so they never block the HTTP response:

```
Patient books appointment (public portal)
         │
         ▼
POST /api/appointments/bookings  (status = PENDING)
         │
         └── 🆕 Telegram to doctor (fire-and-forget)

Patient submits pre-consultation form
         │
         ▼
POST /api/appointment-form
         │
         └── 📝 Telegram to doctor (fire-and-forget)
```

### Scheduled notifications (Railway cron)

Reminders and the daily summary are sent by the Railway cron service (runs every 15 min), which calls protected API endpoints. See [RAILWAY-CRON.md](RAILWAY-CRON.md) for cron architecture.

```
Railway Cron (every 15 min)
         │
         ├── POST /api/cron/telegram-reminders       ← 📌 Task reminders + ✅/⏳ Appointment reminders
         ├── POST /api/cron/telegram-task-reminders   ← 📌 Task reminders
         └── POST /api/cron/telegram-daily-summary    ← 📅 Daily summary
```

### No polling, no webhooks for notifications

The notification flow is **purely outbound** — the API calls Telegram's REST API directly. No background jobs, no queues.

The **bot webhook** (`/api/telegram/webhook`) only exists so the bot can reply to a doctor who messages it with their Chat ID. It has zero involvement in the notification dispatch flow.

---

## Database

### Doctor model fields (`public.doctors`)

```prisma
model Doctor {
  // Connection
  telegramChatId                    String?   @map("telegram_chat_id")

  // Instant notifications
  telegramNotifyBooking             Boolean   @default(true)  @map("telegram_notify_booking")
  telegramNotifyForm                Boolean   @default(true)  @map("telegram_notify_form")

  // Appointment reminders
  telegramNotifyReminderConfirmed   Boolean   @default(true)  @map("telegram_notify_reminder_confirmed")
  telegramNotifyReminderPending     Boolean   @default(true)  @map("telegram_notify_reminder_pending")
  telegramReminderOffsetMinutes     Int       @default(60)    @map("telegram_reminder_offset_minutes")

  // Task reminders
  telegramNotifyTaskReminder        Boolean   @default(true)  @map("telegram_notify_task_reminder")
  telegramTaskReminderOffsetMinutes Int       @default(60)    @map("telegram_task_reminder_offset_minutes")

  // Daily summary
  telegramDailySummaryEnabled       Boolean   @default(false) @map("telegram_daily_summary_enabled")
  telegramDailySummaryTime          String    @default("08:00") @map("telegram_daily_summary_time") @db.VarChar(5)
  telegramDailySummarySentAt        DateTime? @map("telegram_daily_summary_sent_at")
}
```

### Booking model (`public.bookings`)

```prisma
telegramReminderSentAt  DateTime?  @map("telegram_reminder_sent_at")
```

Stamped after sending the appointment reminder. Prevents duplicate sends if the cron fires again in the same window.

### Task model (`medical_records.tasks`)

```prisma
telegramReminderSentAt  DateTime?  @map("telegram_reminder_sent_at")
```

Same deduplication stamp for task reminders.

### Migrations

All migrations are idempotent (`IF NOT EXISTS`):

```sql
-- packages/database/prisma/migrations/add_telegram_chat_id.sql  (2026-03-20)
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- packages/database/prisma/migrations/add-telegram-notify-toggles.sql  (2026-04-09)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_notify_booking BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_notify_form    BOOLEAN NOT NULL DEFAULT true;

-- packages/database/prisma/migrations/add-telegram-reminders.sql  (2026-04-09)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_notify_reminder_confirmed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_notify_reminder_pending   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_reminder_offset_minutes   INTEGER NOT NULL DEFAULT 60;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS telegram_reminder_sent_at TIMESTAMP(3);

-- packages/database/prisma/migrations/add-telegram-task-reminders.sql  (2026-04-09)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_notify_task_reminder         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_task_reminder_offset_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE medical_records.tasks
  ADD COLUMN IF NOT EXISTS telegram_reminder_sent_at TIMESTAMP(3);

-- packages/database/prisma/migrations/add-telegram-daily-summary.sql  (2026-04-09)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS telegram_daily_summary_enabled  BOOLEAN    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_daily_summary_time     VARCHAR(5) NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS telegram_daily_summary_sent_at  TIMESTAMP(3);
```

---

## Files

### New files

| File | Purpose |
|---|---|
| `apps/api/src/lib/telegram.ts` | Notification library — all send functions and interfaces |
| `apps/api/src/app/api/telegram/webhook/route.ts` | Bot webhook — echoes Chat ID back to doctor |
| `apps/api/src/app/api/doctors/[slug]/telegram/route.ts` | GET / PUT / DELETE — manage all Telegram settings |
| `apps/api/src/app/api/cron/telegram-reminders/route.ts` | Cron endpoint — appointment reminders |
| `apps/api/src/app/api/cron/telegram-task-reminders/route.ts` | Cron endpoint — task reminders |
| `apps/api/src/app/api/cron/telegram-daily-summary/route.ts` | Cron endpoint — daily agenda summary |
| `packages/database/prisma/migrations/add_telegram_chat_id.sql` | Migration |
| `packages/database/prisma/migrations/add-telegram-notify-toggles.sql` | Migration |
| `packages/database/prisma/migrations/add-telegram-reminders.sql` | Migration |
| `packages/database/prisma/migrations/add-telegram-task-reminders.sql` | Migration |
| `packages/database/prisma/migrations/add-telegram-daily-summary.sql` | Migration |

### Modified files

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Added 11 Telegram fields to Doctor, 1 to Booking, 1 to Task |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Added 🆕 Telegram dispatch after PENDING booking |
| `apps/api/src/app/api/appointment-form/route.ts` | Added 📝 Telegram dispatch after form submission |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Added full Telegram settings UI to Integraciones tab |

---

## API Reference

### `GET /api/doctors/[slug]/telegram`

Returns the doctor's current Telegram settings.

**Auth:** Doctor JWT required

**Response:**
```json
{
  "chatId": "123456789",
  "notifyBooking": true,
  "notifyForm": true,
  "notifyReminderConfirmed": true,
  "notifyReminderPending": true,
  "reminderOffsetMinutes": 60,
  "notifyTaskReminder": true,
  "taskReminderOffsetMinutes": 60,
  "dailySummaryEnabled": false,
  "dailySummaryTime": "08:00"
}
```

`chatId` is `null` if not set. `telegramDailySummarySentAt` is server-only and never returned.

---

### `PUT /api/doctors/[slug]/telegram`

Updates the doctor's Telegram settings. All fields are optional — send only what you want to change.

**Auth:** Doctor JWT required

**Body (all optional, at least one required):**
```json
{
  "chatId": "123456789",
  "notifyBooking": true,
  "notifyForm": false,
  "notifyReminderConfirmed": true,
  "notifyReminderPending": false,
  "reminderOffsetMinutes": 30,
  "notifyTaskReminder": true,
  "taskReminderOffsetMinutes": 60,
  "dailySummaryEnabled": true,
  "dailySummaryTime": "07:00"
}
```

**Validations:**
- `reminderOffsetMinutes` and `taskReminderOffsetMinutes`: must be one of `[15, 30, 60, 120, 240, 1440]`
- `dailySummaryTime`: must match `/^\d{2}:00$/` (whole hours only, e.g. `"07:00"`)

**Response:** same shape as GET

---

### `DELETE /api/doctors/[slug]/telegram`

Removes the doctor's Telegram Chat ID (disables all notifications). Toggle preferences are retained in the DB.

**Auth:** Doctor JWT required

**Response:** same shape as GET with `chatId: null`

---

### `POST /api/telegram/webhook`

Receives Telegram updates (messages sent to the bot). Replies to the sender with their Chat ID.

**Auth:** None — public endpoint (called by Telegram servers)

**Always returns 200** — Telegram retries on non-200 responses, so all code paths return `{ ok: true }`.

---

### `POST /api/cron/telegram-reminders`

Sends appointment reminder notifications. Called every 15 min by the Railway cron service.

**Auth:** `Authorization: Bearer <CRON_SECRET>`

**Logic:**
- Fetches CONFIRMED and PENDING bookings for today and tomorrow with no `telegramReminderSentAt`
- Per-doctor: computes `appointmentTime − offset` using "fake UTC" arithmetic (MX local times treated as UTC-0)
- Fires if the trigger time falls in the current 15-min window
- Stamps `telegramReminderSentAt` after send to prevent duplicates

**Response:** `{ success, sent, skipped, errors? }`

---

### `POST /api/cron/telegram-task-reminders`

Sends task reminder notifications. Called every 15 min by the Railway cron service.

**Auth:** `Authorization: Bearer <CRON_SECRET>`

**Logic:**
- Fetches PENDIENTE and EN_PROGRESO tasks for today and tomorrow with no `telegramReminderSentAt`
- Tasks without a `startTime` use `07:00` MX as their effective reference time
- Same fake UTC offset arithmetic as appointment reminders
- Stamps `telegramReminderSentAt` after send

**Response:** `{ success, sent, skipped, errors? }`

---

### `POST /api/cron/telegram-daily-summary`

Sends the daily agenda summary. Called every 15 min by the Railway cron service; fires at most once per doctor per calendar day.

**Auth:** `Authorization: Bearer <CRON_SECRET>`

**Logic:**
- "Today" is always the Mexico City calendar date at cron fire time
- Per-doctor: checks if already sent today (compares `telegramDailySummarySentAt` as MX local date)
- Checks if now falls in the doctor's configured 15-min send window (whole-hour comparison)
- Fetches all CONFIRMED + PENDING appointments for the full day (00:00–23:59 MX)
- Fetches all tasks regardless of status for the full day
- Appointments sorted in application code to handle mixed slot/freeform bookings
- Tasks without `startTime` sorted to bottom
- Stamps `telegramDailySummarySentAt` on Doctor after send

**Response:** `{ success, sent, skipped, errors? }`

---

## Notification Library (`apps/api/src/lib/telegram.ts`)

### `isTelegramConfigured(): boolean`
Returns `true` if `TELEGRAM_BOT_TOKEN` env var is set. Used as a guard before any Telegram call.

### `sendTelegramMessage(chatId, text): Promise<boolean>`
Low-level function. Sends an HTML-formatted message (`parse_mode: HTML`). Returns `true` on success, `false` on failure — never throws.

### `sendNewBookingTelegram(chatId, details): Promise<boolean>`
```
🆕 Nueva cita pendiente

Paciente: {patientName}
Tel: {patientPhone}
Servicio: {serviceName}       ← omitted if no service
Fecha: {weekday, day month year}
Hora: {startTime} - {endTime}
Código: {confirmationCode}
```

### `sendFormSubmittedTelegram(chatId, details): Promise<boolean>`
```
📝 Formulario recibido

Paciente: {patientName}
Fecha: {weekday, day month year}   ← omitted if date is null
Hora: {startTime}                  ← omitted if startTime is null

El paciente llenó su formulario pre-consulta.
```

### `sendAppointmentReminderTelegram(chatId, details): Promise<boolean>`

Header emoji is dynamic based on status:
```
✅ Recordatorio de cita · Agendada    ← status CONFIRMED
⏳ Recordatorio de cita · Pendiente   ← status PENDING

Paciente: {patientName}
Tel: {patientPhone}
Servicio: {serviceName}              ← omitted if no service
Fecha: {weekday, day month year}
Hora: {startTime} - {endTime}
Código: {confirmationCode}
```

### `sendTaskReminderTelegram(chatId, details): Promise<boolean>`
```
📌 Recordatorio de tarea

{title}
{description}                        ← omitted if null

Fecha: {weekday, day month year}
Hora: {startTime} - {endTime}        ← omitted if no startTime
Paciente: {patientName}              ← omitted if null
Prioridad: 🔴 Alta | 🟡 Media | 🟢 Baja
Categoría: {category}
```

### `sendDailySummaryTelegram(chatId, date, appointments, tasks): Promise<boolean>`
```
📅 Agenda del día
{weekday, day month year}

🗓 CITAS (N)
• 09:00 - 10:00 | Juan García | Consulta general | Agendada
• 11:00 - 12:00 | María López | Agendada

📋 TAREAS (N)
• 08:00 | Revisar resultados | Juan García 🔴
• Sin hora | Llamar al laboratorio 🟡
```

---

## Booking Route Integration

Location: `apps/api/src/app/api/appointments/bookings/route.ts`

Fire-and-forget dispatch for new PENDING bookings:

```typescript
if (bookingStatus === 'PENDING' && doctor.telegramNotifyBooking && isTelegramConfigured()) {
  prisma.doctor.findUnique({
    where: { id: slot.doctorId },
    select: { telegramChatId: true },
  }).then((doc) => {
    if (!doc?.telegramChatId) return;
    return sendNewBookingTelegram(doc.telegramChatId, { ... });
  }).catch((err) => console.error('Telegram notification failed:', err));
}
```

- `isTelegramConfigured()` checked first to skip the DB query if no token is set
- Uses `slot` from transaction result — not `bookingWithSlot` — to avoid null-safety issues

---

## Appointment Form Route Integration

Location: `apps/api/src/app/api/appointment-form/route.ts`

```typescript
if (isTelegramConfigured() && formLink.doctor?.telegramChatId && formLink.doctor?.telegramNotifyForm) {
  sendFormSubmittedTelegram(formLink.doctor.telegramChatId, {
    patientName: formLink.patientName,
    date: appointmentDate,
    startTime: resolveAppointmentTime(formLink.booking.slot, formLink.booking.startTime),
  }).catch((err) => console.error('Telegram form-submitted notification failed:', err));
}
```

`date` and `startTime` are nullable for freeform bookings — handled gracefully.

---

## Doctor UI (Integraciones Tab)

Location: `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`

The Telegram card is in the **Integraciones** tab. It is divided into sections that appear once a Chat ID is linked:

### State variables

| Variable | Default | Purpose |
|---|---|---|
| `telegramChatId` | `null` | Saved Chat ID from DB |
| `telegramInput` | `""` | Controlled input |
| `telegramLoading` | `false` | Disables buttons while saving |
| `telegramMessage` | `""` | Success/error feedback |
| `telegramLoaded` | `false` | Prevents re-fetch on tab revisits |
| `telegramNotifyBooking` | `true` | Toggle for booking notifications |
| `telegramNotifyForm` | `true` | Toggle for form notifications |
| `telegramNotifyReminderConfirmed` | `true` | Toggle for confirmed reminders |
| `telegramNotifyReminderPending` | `true` | Toggle for pending reminders |
| `telegramReminderOffset` | `60` | Appointment reminder offset (minutes) |
| `telegramNotifyTaskReminder` | `true` | Toggle for task reminders |
| `telegramTaskReminderOffset` | `60` | Task reminder offset (minutes) |
| `telegramDailySummaryEnabled` | `false` | Toggle for daily summary |
| `telegramDailySummaryTime` | `"08:00"` | Hour to send daily summary |

### UI sections (visible only when Chat ID is set)

1. **Notificaciones instantáneas** — toggles for new booking and form submission
2. **Recordatorios de tareas** — task reminder toggle + offset dropdown (15m, 30m, 1h, 2h, 4h, 1 día)
3. **Recordatorios de cita** — confirmed and pending toggles + shared offset dropdown
4. **Resumen diario** — enable toggle + hour dropdown (00:00–23:00); hour picker only shown when enabled

Each toggle saves immediately (optimistic update, reverts on error). Offset dropdowns save immediately on change.

**Remove:** Clears Chat ID in DB, resets all 9 state vars to defaults. Does not reset DB toggle values.

**Active badge:** Green "Activo" badge in card header when Chat ID is set.

---

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `apps/api` (Railway) | Bot token from @BotFather. Format: `123456:ABC-DEFxxx` |

If `TELEGRAM_BOT_TOKEN` is not set, all Telegram calls are silently skipped (no errors, no crashes).

---

## Setup Instructions (one-time, already done)

### 1. Create the bot via @BotFather

- Open Telegram → search `@BotFather` → send `/newbot`
- Pick a name and username (`@Tusalud_citas_bot`)
- Copy the token

### 2. Add token to Railway

Railway dashboard → `api` service → Variables → add `TELEGRAM_BOT_TOKEN=<token>` → redeploy.

### 3. Register the webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-api-domain>/api/telegram/webhook"
```

Verify: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`

---

## Doctor Setup Instructions (per doctor, done once)

1. Open Telegram → search `@Tusalud_citas_bot` → press **Start**
2. Bot replies: *"Tu Chat ID es: `123456789`"*
3. Dashboard → **Mi Perfil** → **Integraciones** → Telegram section
4. Paste the number → **Guardar**
5. Green "Activo" badge appears — configure notification preferences below

To stop notifications: click the red ✕ button.

---

## Fake UTC Arithmetic (timezone note)

Reminder windows use MX local time but avoid DST complications via "fake UTC":

```typescript
// MX local time as a string, e.g. "2026-04-09 10:30:00"
const nowMxStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
const nowMxHHMM = nowMxStr.slice(11, 16); // "10:30"

// Treat HH:MM as if it were UTC — DST cancels out since both sides use the same convention
const nowFakeMs = Date.parse(`2026-01-01T${nowMxHHMM}:00Z`);
const apptFakeMs = Date.parse(`2026-01-01T${apptHHMM}:00Z`);
const triggerFakeMs = apptFakeMs - offsetMinutes * 60 * 1000;
// Fire if triggerFakeMs falls in [nowFakeMs, nowFakeMs + 15min)
```

---

## Telegram Bot API Reference

```
POST https://api.telegram.org/bot<TOKEN>/sendMessage
```

Parameters: `chat_id`, `text`, `parse_mode: "HTML"` (supports `<b>`, `<code>` tags).

Chat IDs are 64-bit integers, stored as `TEXT` in PostgreSQL to avoid overflow issues.

---

## Troubleshooting

### Doctor not receiving instant notifications (booking / form)
1. Check `TELEGRAM_BOT_TOKEN` is set on the `api` Railway service
2. Confirm doctor has Chat ID saved (green "Activo" badge in Integraciones)
3. Check the relevant toggle is on (Notificaciones instantáneas section)
4. Check Railway API logs for `Telegram notification failed:` errors

### Doctor not receiving scheduled reminders
1. Check Railway cron logs — `sent=0` means no eligible records found
2. Confirm doctor has `telegramChatId` set and the relevant toggle is on
3. Confirm the offset is reasonable (e.g. 1-day-before only fires if the reminder hasn't already been sent)
4. Check `telegramReminderSentAt` on the booking/task — if already stamped, it won't fire again

### Bot doesn't reply when doctor messages it
1. Verify webhook: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Check `url` field matches `https://<API_DOMAIN>/api/telegram/webhook`
3. Check API service logs for errors on `POST /api/telegram/webhook`

### Daily summary not arriving
1. Check Railway cron logs for `[telegram-daily-summary]` lines
2. Confirm `telegramDailySummaryEnabled = true` and correct `telegramDailySummaryTime` in DB
3. Check `telegramDailySummarySentAt` — if stamped today (MX date), it won't resend until tomorrow

### `invalid date` in notification
Date is parsed as `date.substring(0, 10) + 'T12:00:00Z'`. Check that the `date` field is a valid `DateTime` in the source table.

### Webhook registration fails
Telegram requires the webhook URL to be HTTPS and internet-reachable. `localhost` URLs will not work.
