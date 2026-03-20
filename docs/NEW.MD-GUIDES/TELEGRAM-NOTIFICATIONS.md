# Telegram Notifications Guide

**Implemented:** 2026-03-20
**Scope:** API app (notification dispatch + bot webhook) + Doctor app (Integraciones UI)
**Type:** Outbound only — app sends messages to doctor via Telegram Bot API

---

## Overview

When a patient books an appointment through the **public portal**, the booking is created with status `PENDING` (awaiting doctor confirmation). The doctor receives an instant Telegram message with the booking details so they can act on it quickly without having to check the dashboard.

Notifications are **per-doctor** — each doctor links their own Telegram account via a Chat ID stored on their profile.

```
Public portal patient books appointment
         │
         ▼
POST /api/appointments/bookings
  bookingStatus = PENDING (no auth = public user)
         │
         ├── SMS to patient (existing)
         ├── SMS to doctor (existing)
         └── Telegram to doctor (NEW) ──► Doctor's Telegram app
                                          "🗓 Nueva cita pendiente
                                           Paciente: Juan García
                                           Tel: 5512345678
                                           Fecha: viernes, 20 de marzo de 2026
                                           Hora: 10:00 - 11:00
                                           Código: ABC-1234"
```

> **PENDING only:** Telegram fires only when `bookingStatus === 'PENDING'`. Bookings created directly by the doctor from the dashboard are auto-confirmed (`CONFIRMED`) and do not trigger Telegram.

---

## Architecture

### How it works

1. Doctor creates a Telegram bot via **@BotFather** → gets a token → added to Railway env vars
2. Doctor opens the bot, sends any message → bot replies with their Chat ID
3. Doctor pastes the Chat ID in **Integraciones** tab of their profile → saved to `doctors.telegram_chat_id`
4. On every `PENDING` booking, the API fires a fire-and-forget fetch to `api.telegram.org/sendMessage`

### No polling, no webhooks for notifications

The notification flow is **purely outbound** — the API calls Telegram's REST API directly. No background jobs, no queues, no webhooks needed on our side for sending.

The **bot webhook** (`/api/telegram/webhook`) only exists so the bot can reply to a doctor who messages it, telling them their Chat ID. It has zero involvement in the notification flow.

---

## Database

### Schema change

`telegramChatId` added to the `Doctor` model (`public` schema):

```prisma
// packages/database/prisma/schema.prisma
model Doctor {
  // ...
  telegramChatId  String?  @map("telegram_chat_id")
  // ...
}
```

### Migration

```sql
-- packages/database/prisma/migrations/add_telegram_chat_id.sql
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
```

Migration already executed on Railway (2026-03-20). Safe to re-run (`IF NOT EXISTS`).

---

## Files

### New files

| File | Purpose |
|---|---|
| `apps/api/src/lib/telegram.ts` | Notification library — `sendTelegramMessage`, `sendNewBookingTelegram`, `isTelegramConfigured` |
| `apps/api/src/app/api/telegram/webhook/route.ts` | Bot webhook — echoes the sender's Chat ID back to them |
| `apps/api/src/app/api/doctors/[slug]/telegram/route.ts` | GET / PUT / DELETE — manage a doctor's `telegramChatId` |
| `packages/database/prisma/migrations/add_telegram_chat_id.sql` | DB migration |

### Modified files

| File | Change |
|---|---|
| `packages/database/prisma/schema.prisma` | Added `telegramChatId` field to `Doctor` model |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Added Telegram dispatch after booking creation |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Added Telegram card to Integraciones tab |

---

## API Reference

### `GET /api/doctors/[slug]/telegram`
Returns the doctor's current Telegram Chat ID.

**Auth:** Doctor JWT required

**Response:**
```json
{ "chatId": "123456789" }
// or
{ "chatId": null }
```

---

### `PUT /api/doctors/[slug]/telegram`
Saves the doctor's Telegram Chat ID.

**Auth:** Doctor JWT required

**Body:**
```json
{ "chatId": "123456789" }
```

**Response:**
```json
{ "chatId": "123456789" }
```

---

### `DELETE /api/doctors/[slug]/telegram`
Removes the doctor's Telegram Chat ID (disables notifications).

**Auth:** Doctor JWT required

**Response:**
```json
{ "chatId": null }
```

---

### `POST /api/telegram/webhook`
Receives Telegram updates (messages sent to the bot). Replies to the sender with their Chat ID.

**Auth:** None — public endpoint (called by Telegram servers)

**Always returns 200** — Telegram retries on non-200 responses, so all code paths return `{ ok: true }`.

---

## Notification Library (`apps/api/src/lib/telegram.ts`)

### `isTelegramConfigured(): boolean`
Returns `true` if `TELEGRAM_BOT_TOKEN` env var is set. Used as a guard before any Telegram call — if not configured, the notification is silently skipped (no error thrown).

### `sendTelegramMessage(chatId, text): Promise<boolean>`
Low-level function. Sends an HTML-formatted message to any Telegram chat. Returns `true` on success, `false` on failure (logs error, does not throw).

### `sendNewBookingTelegram(chatId, details): Promise<boolean>`
High-level function. Formats a pending booking notification and calls `sendTelegramMessage`. Message format:

```
🗓 Nueva cita pendiente

Paciente: {patientName}
Tel: {patientPhone}
Servicio: {serviceName}       ← omitted if no service
Fecha: {weekday, day month year}
Hora: {startTime} - {endTime}
Código: {confirmationCode}
```

Date is formatted in `es-MX` locale with `timeZone: 'America/Mexico_City'`.

---

## Booking Route Integration

Location: `apps/api/src/app/api/appointments/bookings/route.ts`

The Telegram block runs after the SMS block, fire-and-forget (`.then().catch()` — never awaited, never blocks the HTTP response):

```typescript
if (bookingStatus === 'PENDING' && isTelegramConfigured()) {
  prisma.doctor.findUnique({
    where: { id: slot.doctorId },
    select: { telegramChatId: true },
  }).then((doc) => {
    if (!doc?.telegramChatId) return;
    return sendNewBookingTelegram(doc.telegramChatId, {
      patientName,
      patientPhone,
      serviceName: serviceName ?? null,
      date: slot.date.toISOString(),
      startTime: slot.startTime,
      endTime: slot.endTime,
      confirmationCode,
    });
  }).catch((err) => console.error('Telegram notification failed:', err));
}
```

Key notes:
- Uses `slot` (from transaction result) — not `bookingWithSlot` — to avoid a null-safety issue
- `isTelegramConfigured()` is checked first to skip the DB query entirely if no token is set
- If the doctor has no `telegramChatId`, the `.then` returns early — no Telegram call made

---

## Doctor UI (Integraciones Tab)

Location: `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`

The Telegram card is the second card in the **Integraciones** tab, below Google Calendar.

**State variables:**
- `telegramChatId` — saved value from DB (null if not set)
- `telegramInput` — controlled input value
- `telegramLoading` — disables buttons while saving/deleting
- `telegramMessage` — success/error feedback
- `telegramLoaded` — prevents re-fetching on tab re-visits

**Load behavior:** Fetches `/api/doctors/[slug]/telegram` the first time the Integraciones tab is opened (`telegramLoaded` gate).

**Save:** PUT with `{ chatId }` → updates `telegramChatId` state + shows success message.

**Remove:** DELETE → clears `telegramChatId` + `telegramInput` + shows success message. Remove button only renders when `telegramChatId` is set.

**Active badge:** Green "Activo" badge shows in the card header when `telegramChatId` is set.

---

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `apps/api` (Railway) | Bot token from @BotFather. Format: `123456:ABC-DEFxxx` |

If `TELEGRAM_BOT_TOKEN` is not set, all Telegram calls are silently skipped. No errors, no crashes.

---

## Setup Instructions (one-time, done by developer)

When a patient books from the public portal, the booking lands as `PENDING`. The API immediately fires a message to `api.telegram.org/sendMessage` with the patient's details — no queue, no polling, just a direct HTTP call.

### 1. Create the bot via @BotFather

- Open Telegram → search `@BotFather` → send `/newbot`
- Pick a name and username (e.g. `@tusalud_bot`)
- BotFather gives you a token like `7123456789:AAF...` — copy it

### 2. Add the token to Railway

Railway dashboard → `api` service → Variables → add:
```
TELEGRAM_BOT_TOKEN=<your token>
```
Redeploy the `api` service.

### 3. Register the webhook (one curl command)

Each doctor needs to message the bot to get their Chat ID. For the bot to be able to reply, Telegram needs to know where to send incoming messages — that's what this step does. Run it once after deploying:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-api-domain>/api/telegram/webhook"
```

Expected response:
```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

Verify at any time:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### 4. Update the bot username in the source code (one-time code change)

The Integraciones tab shows doctors which bot to open. The bot username is hardcoded as a placeholder in the source code — replace it with your real bot username before deploying:

In `apps/doctor/src/app/dashboard/mi-perfil/page.tsx`:
```tsx
// Replace @tusalud_bot with your actual bot username
<span className="font-mono text-gray-900">@tusalud_bot</span>
```

This is a one-time code change, not something repeated per doctor.

---

## Doctor Setup Instructions (per doctor, done once)

1. Open Telegram → search your bot (e.g. `@tusalud_bot`) → press **Start**
2. The bot auto-replies: *"Tu Chat ID es: `123456789`"*
3. Go to dashboard → **Mi Perfil** → **Integraciones** tab → Telegram section
4. Paste the number → click **Guardar**
5. Green "Activo" badge appears — done

To stop notifications: click the red ✕ button in the same section.

---

## Telegram Bot API Reference

All calls use the REST API:
```
POST https://api.telegram.org/bot<TOKEN>/sendMessage
```

Required parameters:
- `chat_id` — the doctor's Telegram numeric ID (stored as TEXT in DB)
- `text` — message content
- `parse_mode` — `"HTML"` (supports `<b>`, `<code>` tags)

Telegram chat IDs are 64-bit integers. Stored as `TEXT` in PostgreSQL to avoid integer overflow issues.

---

## Troubleshooting

### Doctor not receiving notifications

1. Check `TELEGRAM_BOT_TOKEN` is set on the `api` Railway service
2. Check the doctor has a `telegramChatId` saved (visible in Integraciones tab — "Activo" badge)
3. Check Railway deploy logs for `Telegram notification failed:` errors
4. Verify the bot token is valid: `curl "https://api.telegram.org/bot<TOKEN>/getMe"`

### Bot doesn't reply when doctor messages it

1. Verify the webhook is registered: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
2. Check `url` field matches `https://<API_DOMAIN>/api/telegram/webhook`
3. Check Railway logs for the `api` service for errors on `POST /api/telegram/webhook`

### `invalid date` in notification message

Would appear as "Invalid Date" in the formatted date line. This would mean `slot.date.toISOString()` returned something unexpected. Check the `date` column format in `AppointmentSlot` — should be a valid `DateTime`.

### Webhook registration fails

Telegram requires the webhook URL to be **HTTPS** and reachable from the internet. Local development URLs (`localhost`) will not work. Register only against the production Railway API URL.
