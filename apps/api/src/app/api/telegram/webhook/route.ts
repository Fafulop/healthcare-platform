// POST /api/telegram/webhook
// Receives updates from Telegram and replies with the sender's chat ID.
// Doctors use this to find their chat ID for the Integraciones settings.
//
// Register this webhook once with:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<API_DOMAIN>/api/telegram/webhook"

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  // Always return 200 to Telegram — even on errors — to prevent retries
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: true });
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
