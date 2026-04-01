import { google } from "googleapis";

const CALENDAR_NAME = "tusalud.pro";

// ─── Token refresh ────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token");
  }

  return {
    accessToken: credentials.access_token,
    expiresAt: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000),
  };
}

// ─── OAuth client helper ──────────────────────────────────────────────────────

function buildOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
}

function buildAuthedClient(accessToken: string, refreshToken: string | null) {
  const oauth2Client = buildOAuthClient();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return oauth2Client;
}

// ─── Calendar management ─────────────────────────────────────────────────────

// Creates the dedicated "tusalud.pro" calendar in the doctor's Google account.
// Returns the new calendar's ID.
export async function createDedicatedCalendar(
  accessToken: string,
  refreshToken: string | null
): Promise<string> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.calendars.insert({
    requestBody: {
      summary: CALENDAR_NAME,
      description: "Citas y pendientes sincronizados desde tusalud.pro",
      timeZone: "America/Mexico_City",
    },
  });

  if (!data.id) throw new Error("Google Calendar creation returned no ID");
  return data.id;
}

// Permanently deletes the dedicated calendar (on disconnect).
export async function deleteDedicatedCalendar(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string
): Promise<void> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.calendars.delete({ calendarId });
}

// ─── Event helpers ────────────────────────────────────────────────────────────

export interface SlotEventData {
  id: string;           // slot ID (stored as extendedProperties.private.slotId)
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
  isOpen: boolean;
  patientName?: string; // set when a booking exists
  patientPhone?: string;
  patientEmail?: string;
  patientNotes?: string;
  bookingStatus?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW';
  finalPrice?: number;
  conflictNote?: string; // ⚠️ shown when a task overlaps this slot's time
}

export interface TaskEventData {
  id: string;           // task ID (stored as extendedProperties.private.taskId)
  title: string;
  description?: string | null;
  dueDate: string;      // YYYY-MM-DD
  startTime?: string | null;  // HH:MM
  endTime?: string | null;    // HH:MM
  status: string;
  priority: string;
  category?: string | null;
  conflictNote?: string; // ⚠️ shown when a booked slot overlaps this task's time
}

function slotToEvent(slot: SlotEventData) {
  let title: string;
  let colorId: string;

  if (slot.patientName) {
    if (slot.bookingStatus === 'COMPLETED') {
      title = `✓ Cita: ${slot.patientName}`;
      colorId = "10"; // Basil (dark green) — appointment completed
    } else if (slot.bookingStatus === 'NO_SHOW') {
      title = `✗ Cita: ${slot.patientName}`;
      colorId = "8";  // Graphite — patient did not show
    } else {
      title = `Cita: ${slot.patientName}`;
      colorId = "2";  // Sage (green) — active booking (PENDING/CONFIRMED)
    }
  } else if (slot.isOpen) {
    title = "Disponible";
    colorId = "7"; // Peacock (teal)
  } else {
    title = "Bloqueado";
    colorId = "8"; // Graphite
  }

  // Conflict warning: prefix the title for active (actionable) bookings only
  const isActiveBooking = slot.patientName && !['COMPLETED', 'NO_SHOW'].includes(slot.bookingStatus ?? '');
  if (slot.conflictNote && isActiveBooking) title = `⚠️ ${title}`;

  const descLines: string[] = [];
  if (slot.finalPrice != null) descLines.push(`$${slot.finalPrice} MXN`);
  if (slot.patientPhone) descLines.push(`Tel: ${slot.patientPhone}`);
  if (slot.patientEmail) descLines.push(`Email: ${slot.patientEmail}`);
  if (slot.patientNotes) descLines.push(`Notas: ${slot.patientNotes}`);
  if (slot.conflictNote) descLines.push(slot.conflictNote);

  return {
    summary: title,
    description: descLines.length ? descLines.join('\n') : undefined,
    start: {
      dateTime: `${slot.date}T${slot.startTime}:00`,
      timeZone: "America/Mexico_City",
    },
    end: {
      dateTime: `${slot.date}T${slot.endTime}:00`,
      timeZone: "America/Mexico_City",
    },
    colorId,
    extendedProperties: {
      private: {
        source: "tusalud.pro",
        slotId: slot.id,
      },
    },
  };
}

const PRIORITY_LABELS: Record<string, string> = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };
const CATEGORY_LABELS: Record<string, string> = {
  SEGUIMIENTO: "Seguimiento", ADMINISTRATIVO: "Administrativo",
  LABORATORIO: "Laboratorio", RECETA: "Receta",
  REFERENCIA: "Referencia", PERSONAL: "Personal", OTRO: "Otro",
};

function taskToEvent(task: TaskEventData) {
  const priorityEmoji =
    task.priority === "ALTA" ? "🔴" : task.priority === "MEDIA" ? "🟡" : "🟢";

  const colorId =
    task.priority === "ALTA" ? "11" : task.priority === "MEDIA" ? "5" : "10";
  // 11=Tomato, 5=Banana, 10=Basil

  const meta: string[] = [];
  if (task.category) meta.push(`Categoría: ${CATEGORY_LABELS[task.category] ?? task.category}`);
  meta.push(`Prioridad: ${PRIORITY_LABELS[task.priority] ?? task.priority}`);
  const descLines = [meta.join(' | ')];
  if (task.description) {
    descLines.push('');
    descLines.push(task.description);
  }
  if (task.conflictNote) {
    descLines.push('');
    descLines.push(task.conflictNote);
  }

  const isAllDay = !task.startTime || !task.endTime;

  return {
    summary: `${task.conflictNote ? '⚠️ ' : ''}${priorityEmoji} ${task.title}`,
    description: descLines.join('\n'),
    colorId,
    ...(isAllDay
      ? { start: { date: task.dueDate }, end: { date: task.dueDate } }
      : {
          start: {
            dateTime: `${task.dueDate}T${task.startTime}:00`,
            timeZone: "America/Mexico_City",
          },
          end: {
            dateTime: `${task.dueDate}T${task.endTime}:00`,
            timeZone: "America/Mexico_City",
          },
        }),
    extendedProperties: {
      private: {
        source: "tusalud.pro",
        taskId: task.id,
      },
    },
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createSlotEvent(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  slot: SlotEventData
): Promise<string> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: slotToEvent(slot),
  });

  if (!data.id) throw new Error("Event creation returned no ID");
  return data.id;
}

export async function updateSlotEvent(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  googleEventId: string,
  slot: SlotEventData
): Promise<void> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.update({
    calendarId,
    eventId: googleEventId,
    requestBody: slotToEvent(slot),
  });
}

export async function createTaskEvent(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  task: TaskEventData
): Promise<string> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: taskToEvent(task),
  });

  if (!data.id) throw new Error("Event creation returned no ID");
  return data.id;
}

export async function updateTaskEvent(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  googleEventId: string,
  task: TaskEventData
): Promise<void> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.update({
    calendarId,
    eventId: googleEventId,
    requestBody: taskToEvent(task),
  });
}

export async function deleteEvent(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  googleEventId: string
): Promise<void> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({ calendarId, eventId: googleEventId });
}

// ─── Token helper for routes ──────────────────────────────────────────────────

// Resolves a fresh access token, refreshing if expired.
// Returns the access token to use and any updated token data to persist.
export async function resolveTokens(user: {
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiry: Date | null;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  updatedToken?: { accessToken: string; expiresAt: Date };
}> {
  if (!user.googleAccessToken && !user.googleRefreshToken) {
    throw new Error("No Google tokens found for this user");
  }

  const isExpired =
    !user.googleAccessToken ||
    (user.googleTokenExpiry && user.googleTokenExpiry <= new Date());

  if (isExpired && user.googleRefreshToken) {
    const refreshed = await refreshAccessToken(user.googleRefreshToken);
    return {
      accessToken: refreshed.accessToken,
      refreshToken: user.googleRefreshToken,
      updatedToken: refreshed,
    };
  }

  return {
    accessToken: user.googleAccessToken!,
    refreshToken: user.googleRefreshToken,
  };
}

// ─── Webhook / push notifications ────────────────────────────────────────────

export async function watchCalendar(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  webhookUrl: string,
  channelId: string,
  channelToken: string
): Promise<{ resourceId: string; expiration: string }> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      token: channelToken,
    },
  });

  return {
    resourceId: data.resourceId!,
    expiration: data.expiration!,
  };
}

// ─── Google Meet ─────────────────────────────────────────────────────────────

// Creates or fetches a Google Meet link for a telemedicine booking.
// If googleEventId is provided, patches the existing event with conferenceData.
// If no event exists, creates a minimal calendar event to obtain the Meet URL.
// The requestId is derived from bookingId and is idempotent — calling again returns the same URL.
export async function ensureMeetLink(
  accessToken: string,
  refreshToken: string | null,
  calendarId: string,
  googleEventId: string | null,
  bookingId: string,
  fallback: {
    date: string;        // YYYY-MM-DD
    startTime: string;   // HH:MM
    endTime: string;     // HH:MM
    patientName: string;
  }
): Promise<{ meetUrl: string; newEventId?: string } | null> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: 'v3', auth });
  const requestId = `meet-${bookingId}`;

  if (googleEventId) {
    try {
      const { data } = await calendar.events.patch({
        calendarId,
        eventId: googleEventId,
        conferenceDataVersion: 1,
        requestBody: {
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      const meetUrl =
        data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? null;
      if (meetUrl) return { meetUrl };
    } catch {
      // Fall through to create a new event
    }
  }

  // No existing event or patch failed — create a minimal event to get a Meet link
  const { data } = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: `Telemedicina: ${fallback.patientName}`,
      start: {
        dateTime: `${fallback.date}T${fallback.startTime}:00`,
        timeZone: 'America/Mexico_City',
      },
      end: {
        dateTime: `${fallback.date}T${fallback.endTime}:00`,
        timeZone: 'America/Mexico_City',
      },
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      extendedProperties: {
        private: { source: 'tusalud.pro', bookingId },
      },
    },
  });

  const meetUrl =
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? null;

  if (!meetUrl) return null;
  return { meetUrl, newEventId: data.id ?? undefined };
}

export async function stopCalendarWatch(
  accessToken: string,
  refreshToken: string | null,
  channelId: string,
  resourceId: string
): Promise<void> {
  const auth = buildAuthedClient(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.channels.stop({
    requestBody: { id: channelId, resourceId },
  });
}
