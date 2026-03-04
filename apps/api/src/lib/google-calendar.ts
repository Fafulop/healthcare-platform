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
  finalPrice?: number;
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
}

function slotToEvent(slot: SlotEventData) {
  const title = slot.patientName
    ? `Cita: ${slot.patientName}`
    : slot.isOpen
    ? "Disponible"
    : "Bloqueado";

  const colorId = slot.patientName ? "2" : slot.isOpen ? "7" : "8";
  // 2=Sage(green), 7=Peacock(teal), 8=Graphite(grey)

  return {
    summary: title,
    description: slot.finalPrice != null ? `$${slot.finalPrice} MXN` : undefined,
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

function taskToEvent(task: TaskEventData) {
  const priorityEmoji =
    task.priority === "ALTA" ? "🔴" : task.priority === "MEDIA" ? "🟡" : "🟢";

  const colorId =
    task.priority === "ALTA" ? "11" : task.priority === "MEDIA" ? "5" : "10";
  // 11=Tomato, 5=Banana, 10=Basil

  const isAllDay = !task.startTime || !task.endTime;

  return {
    summary: `${priorityEmoji} ${task.title}`,
    description: task.description ?? undefined,
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
