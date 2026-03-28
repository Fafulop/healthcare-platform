// Telegram Bot notification service
// Sends appointment notifications to doctors via Telegram

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export interface NewBookingDetails {
  patientName: string;
  patientPhone: string;
  serviceName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  confirmationCode: string;
}

/**
 * Check if Telegram bot is configured (token present)
 */
export function isTelegramConfigured(): boolean {
  return !!TELEGRAM_BOT_TOKEN;
}

/**
 * Send a plain text message to a Telegram chat
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!isTelegramConfigured()) {
    console.warn('⚠️ Telegram bot not configured. Skipping notification.');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('❌ Telegram sendMessage failed:', err);
      return false;
    }

    console.log(`✅ Telegram notification sent to chat ${chatId}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending Telegram message:', error);
    return false;
  }
}

export interface FormSubmittedDetails {
  patientName: string;
  date: string | null;   // ISO date string YYYY-MM-DD, nullable for freeform bookings
  startTime: string | null;
}

/**
 * Send a form-submitted notification to the doctor
 */
export async function sendFormSubmittedTelegram(
  chatId: string,
  details: FormSubmittedDetails
): Promise<boolean> {
  const dateLine = details.date
    ? `\nFecha: ${new Date(details.date + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Mexico_City',
      })}`
    : '';
  const timeLine = details.startTime ? `\nHora: ${details.startTime}` : '';

  const message =
    `📋 <b>Formulario recibido</b>\n` +
    `\nPaciente: ${details.patientName}` +
    dateLine +
    timeLine +
    `\n\nEl paciente llenó su formulario pre-consulta.`;

  return sendTelegramMessage(chatId, message);
}

/**
 * Send a new pending booking notification to the doctor
 */
export async function sendNewBookingTelegram(
  chatId: string,
  details: NewBookingDetails
): Promise<boolean> {
  const formattedDate = new Date(details.date).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  const serviceLine = details.serviceName ? `\nServicio: ${details.serviceName}` : '';

  const message =
    `🗓 <b>Nueva cita pendiente</b>\n` +
    `\nPaciente: ${details.patientName}` +
    `\nTel: ${details.patientPhone}` +
    serviceLine +
    `\nFecha: ${formattedDate}` +
    `\nHora: ${details.startTime} - ${details.endTime}` +
    `\nCódigo: ${details.confirmationCode}`;

  return sendTelegramMessage(chatId, message);
}
