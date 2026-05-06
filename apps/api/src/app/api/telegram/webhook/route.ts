// POST /api/telegram/webhook
// Receives updates from Telegram and replies with the sender's chat ID.
// Doctors use this to find their chat ID for the Integraciones settings.
//
// Register this webhook once with:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<API_DOMAIN>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
//
// The secret_token param tells Telegram to include an X-Telegram-Bot-Api-Secret-Token
// header on every request, which we verify below.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: Request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  // Always return 200 to Telegram — even on errors — to prevent retries
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: true });
  }

  // Verify the request is from Telegram using the shared secret token.
  // If TELEGRAM_WEBHOOK_SECRET is set, reject requests without a matching header.
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (!safeEqual(headerSecret, webhookSecret)) {
      return NextResponse.json({ ok: true }); // 200 to avoid retries
    }
  }

  try {
    const update = await request.json();
    const message = update.message ?? update.edited_message;
    if (!message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId: number = message.chat.id;
    const firstName: string = message.chat.first_name ?? 'Doctor';

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          `👋 ¡Hola ${firstName}!\n\n` +
          `Tu Chat ID es:\n<code>${chatId}</code>\n\n` +
          `Copia ese número y pégalo en tu perfil de doctor.tusalud.pro → Integraciones → Telegram para activar las notificaciones de citas.`,
        parse_mode: 'HTML',
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Always 200 — Telegram will retry on non-200 responses
    return NextResponse.json({ ok: true });
  }
}
