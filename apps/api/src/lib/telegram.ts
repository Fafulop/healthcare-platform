// Telegram Bot notification service
// Sends appointment notifications to doctors via Telegram

export interface DailySummaryAppointment {
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  patientName: string;
  status: string;      // CONFIRMED | PENDING
  serviceName: string | null;
}

export interface DailySummaryTask {
  title: string;
  startTime: string | null; // HH:MM, null if no time
  priority: string;         // ALTA | MEDIA | BAJA
  status: string;           // PENDIENTE | EN_PROGRESO | COMPLETADA | CANCELADA
  patientName: string | null;
}

/**
 * Send a daily agenda summary to the doctor
 */
export async function sendDailySummaryTelegram(
  chatId: string,
  date: string, // YYYY-MM-DD (MX local date)
  appointments: DailySummaryAppointment[],
  tasks: DailySummaryTask[]
): Promise<boolean> {
  const formattedDate = new Date(date + 'T12:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  const priorityLabel: Record<string, string> = { ALTA: '🔴', MEDIA: '🟡', BAJA: '🟢' };
  const statusLabel: Record<string, string> = {
    CONFIRMED: 'Agendada', PENDING: 'Pendiente',
    PENDIENTE: 'Pendiente', EN_PROGRESO: 'En progreso',
    COMPLETADA: 'Completada', CANCELADA: 'Cancelada',
  };

  // Appointments section
  let apptSection: string;
  if (appointments.length === 0) {
    apptSection = '🗓 <b>CITAS</b>\nSin citas agendadas para hoy';
  } else {
    const lines = appointments.map((a) => {
      const service = a.serviceName ? ` | ${a.serviceName}` : '';
      return `• ${a.startTime} - ${a.endTime} | ${a.patientName}${service} | ${statusLabel[a.status] ?? a.status}`;
    });
    apptSection = `🗓 <b>CITAS (${appointments.length})</b>\n${lines.join('\n')}`;
  }

  // Tasks section
  let taskSection: string;
  if (tasks.length === 0) {
    taskSection = '📋 <b>TAREAS</b>\nSin tareas para hoy';
  } else {
    const lines = tasks.map((t) => {
      const time = t.startTime ? `${t.startTime} | ` : 'Sin hora | ';
      const patient = t.patientName ? ` | ${t.patientName}` : '';
      const icon = priorityLabel[t.priority] ?? '';
      return `• ${time}${t.title}${patient} ${icon}`;
    });
    taskSection = `📋 <b>TAREAS (${tasks.length})</b>\n${lines.join('\n')}`;
  }

  const message =
    `📅 <b>Agenda del día</b>\n${formattedDate}\n\n` +
    apptSection +
    `\n\n` +
    taskSection;

  return sendTelegramMessage(chatId, message);
}

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
    ? `\nFecha: ${new Date(details.date + 'T12:00:00Z').toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Mexico_City',
      })}`
    : '';
  const timeLine = details.startTime ? `\nHora: ${details.startTime}` : '';

  const message =
    `📝 <b>Formulario recibido</b>\n` +
    `\nPaciente: ${details.patientName}` +
    dateLine +
    timeLine +
    `\n\nEl paciente llenó su formulario pre-consulta.`;

  return sendTelegramMessage(chatId, message);
}

export interface TaskReminderDetails {
  title: string;
  description: string | null;
  date: string;             // YYYY-MM-DD (MX local date)
  startTime: string | null; // HH:MM, null if no time set (reminder sent at 07:00)
  endTime: string | null;
  priority: string;         // ALTA | MEDIA | BAJA
  category: string;
  patientName: string | null;
}

/**
 * Send a scheduled task reminder to the doctor
 */
export async function sendTaskReminderTelegram(
  chatId: string,
  details: TaskReminderDetails
): Promise<boolean> {
  const formattedDate = new Date(details.date + 'T12:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  const priorityLabel: Record<string, string> = { ALTA: '🔴 Alta', MEDIA: '🟡 Media', BAJA: '🟢 Baja' };
  const timeLine = details.startTime
    ? `\nHora: ${details.startTime}${details.endTime ? ` - ${details.endTime}` : ''}`
    : '';
  const descriptionLine = details.description ? `\n\n${details.description}` : '';
  const patientLine = details.patientName ? `\nPaciente: ${details.patientName}` : '';

  const message =
    `📌 <b>Recordatorio de tarea</b>\n` +
    `\n<b>${details.title}</b>` +
    descriptionLine +
    `\n\nFecha: ${formattedDate}` +
    timeLine +
    patientLine +
    `\nPrioridad: ${priorityLabel[details.priority] ?? details.priority}` +
    `\nCategoría: ${details.category}`;

  return sendTelegramMessage(chatId, message);
}

export interface AppointmentReminderDetails {
  patientName: string;
  patientPhone: string;
  serviceName: string | null;
  date: string;       // YYYY-MM-DD (MX local date)
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  confirmationCode: string;
  status: 'CONFIRMED' | 'PENDING';
}

/**
 * Send a scheduled appointment reminder to the doctor
 */
export async function sendAppointmentReminderTelegram(
  chatId: string,
  details: AppointmentReminderDetails
): Promise<boolean> {
  const formattedDate = new Date(details.date + 'T12:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  const statusLabel = details.status === 'CONFIRMED' ? 'Agendada' : 'Pendiente';
  const headerEmoji = details.status === 'CONFIRMED' ? '✅' : '⏳';
  const serviceLine = details.serviceName ? `\nServicio: ${details.serviceName}` : '';

  const message =
    `${headerEmoji} <b>Recordatorio de cita · ${statusLabel}</b>\n` +
    `\nPaciente: ${details.patientName}` +
    `\nTel: ${details.patientPhone}` +
    serviceLine +
    `\nFecha: ${formattedDate}` +
    `\nHora: ${details.startTime} - ${details.endTime}` +
    `\nCódigo: ${details.confirmationCode}`;

  return sendTelegramMessage(chatId, message);
}

/**
 * Send a new pending booking notification to the doctor
 */
export async function sendNewBookingTelegram(
  chatId: string,
  details: NewBookingDetails
): Promise<boolean> {
  const formattedDate = new Date(details.date.substring(0, 10) + 'T12:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  const serviceLine = details.serviceName ? `\nServicio: ${details.serviceName}` : '';

  const message =
    `🆕 <b>Nueva cita pendiente</b>\n` +
    `\nPaciente: ${details.patientName}` +
    `\nTel: ${details.patientPhone}` +
    serviceLine +
    `\nFecha: ${formattedDate}` +
    `\nHora: ${details.startTime} - ${details.endTime}` +
    `\nCódigo: ${details.confirmationCode}`;

  return sendTelegramMessage(chatId, message);
}
