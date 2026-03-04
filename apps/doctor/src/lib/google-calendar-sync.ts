/**
 * Google Calendar sync helper for the doctor app.
 * Uses raw fetch against the Google Calendar REST API — no googleapis package needed.
 * All calls are fire-and-forget: errors are logged but never thrown to callers.
 */

import { prisma } from "@healthcare/database";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

// ─── Token handling ───────────────────────────────────────────────────────────

async function getValidToken(userId: string): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
      doctor: {
        select: {
          googleCalendarId: true,
          googleCalendarEnabled: true,
        },
      },
    },
  });

  if (
    !user?.doctor?.googleCalendarEnabled ||
    !user.doctor.googleCalendarId
  ) {
    return null;
  }

  if (!user.googleAccessToken && !user.googleRefreshToken) {
    return null;
  }

  const isExpired =
    !user.googleAccessToken ||
    (user.googleTokenExpiry && user.googleTokenExpiry <= new Date());

  let accessToken = user.googleAccessToken!;

  if (isExpired && user.googleRefreshToken) {
    const refreshed = await refreshToken(user.googleRefreshToken);
    if (!refreshed) return null;

    accessToken = refreshed.accessToken;
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: refreshed.accessToken,
        googleTokenExpiry: refreshed.expiresAt,
      },
    });
  }

  return { accessToken, calendarId: user.doctor.googleCalendarId };
}

async function refreshToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch {
    return null;
  }
}

// ─── Get userId from doctorId ─────────────────────────────────────────────────

async function getUserIdForDoctor(doctorId: string): Promise<string | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { user: { select: { id: true } } },
  });
  return doctor?.user?.id ?? null;
}

// ─── Event builders ───────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };
const CATEGORY_LABELS: Record<string, string> = {
  SEGUIMIENTO: "Seguimiento", ADMINISTRATIVO: "Administrativo",
  LABORATORIO: "Laboratorio", RECETA: "Receta",
  REFERENCIA: "Referencia", PERSONAL: "Personal", OTRO: "Otro",
};

function buildTaskEvent(task: {
  id: string;
  title: string;
  description?: string | null;
  dueDate: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  priority: string;
  status: string;
  category?: string | null;
  conflictNote?: string;
}) {
  if (!task.dueDate) return null;

  const dateStr = task.dueDate.toISOString().split("T")[0];
  const priorityEmoji =
    task.priority === "ALTA" ? "🔴" : task.priority === "MEDIA" ? "🟡" : "🟢";
  const colorId =
    task.priority === "ALTA" ? "11" : task.priority === "MEDIA" ? "5" : "10";

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
      ? { start: { date: dateStr }, end: { date: dateStr } }
      : {
          start: {
            dateTime: `${dateStr}T${task.startTime}:00`,
            timeZone: "America/Mexico_City",
          },
          end: {
            dateTime: `${dateStr}T${task.endTime}:00`,
            timeZone: "America/Mexico_City",
          },
        }),
    extendedProperties: {
      private: { source: "tusalud.pro", taskId: task.id },
    },
  };
}

// ─── Conflict detection ───────────────────────────────────────────────────────

// Returns a warning note if any PENDING/CONFIRMED slot overlaps the given task time.
async function findSlotConflict(
  doctorId: string,
  dueDate: Date,
  startTime: string,
  endTime: string
): Promise<string | undefined> {
  try {
    const slots = await prisma.appointmentSlot.findMany({
      where: {
        doctorId,
        date: dueDate,
        bookings: { some: { status: { in: ['PENDING', 'CONFIRMED'] } } },
      },
      include: {
        bookings: {
          where: { status: { in: ['PENDING', 'CONFIRMED'] } },
          select: { patientName: true },
          take: 1,
        },
      },
    });
    const hit = slots.find(s => s.startTime < endTime && s.endTime > startTime);
    if (!hit) return undefined;
    const patient = hit.bookings[0]?.patientName;
    return `⚠️ Conflicto: cita${patient ? ` con ${patient}` : ''} a las ${hit.startTime}`;
  } catch {
    return undefined; // never break sync over a conflict check
  }
}

// ─── Public sync functions (all fire-and-forget) ──────────────────────────────

export async function syncTaskCreated(doctorId: string, task: {
  id: string;
  title: string;
  description?: string | null;
  dueDate: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  priority: string;
  status: string;
  category?: string | null;
}): Promise<void> {
  try {
    const userId = await getUserIdForDoctor(doctorId);
    if (!userId) return;

    const tokens = await getValidToken(userId);
    if (!tokens) return;

    // Check for overlapping booked appointments (timed tasks only)
    const conflictNote = (task.startTime && task.endTime && task.dueDate)
      ? await findSlotConflict(doctorId, task.dueDate, task.startTime, task.endTime)
      : undefined;

    const body = buildTaskEvent({ ...task, conflictNote });
    if (!body) return;

    const res = await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.id) {
        await prisma.task.update({
          where: { id: task.id },
          data: { googleEventId: data.id },
        });
      }
    }
  } catch (err) {
    console.error("[GCalSync] syncTaskCreated failed:", err);
  }
}

export async function syncTaskUpdated(doctorId: string, task: {
  id: string;
  title: string;
  description?: string | null;
  dueDate: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  priority: string;
  status: string;
  category?: string | null;
  googleEventId?: string | null;
}): Promise<void> {
  try {
    if (!task.googleEventId) {
      // No event yet — create it
      await syncTaskCreated(doctorId, task);
      return;
    }

    const userId = await getUserIdForDoctor(doctorId);
    if (!userId) return;

    const tokens = await getValidToken(userId);
    if (!tokens) return;

    // Check for overlapping booked appointments (timed tasks only)
    const conflictNote = (task.startTime && task.endTime && task.dueDate)
      ? await findSlotConflict(doctorId, task.dueDate, task.startTime, task.endTime)
      : undefined;

    const body = buildTaskEvent({ ...task, conflictNote });
    if (!body) return;

    // If task is completed/cancelled, delete the event
    if (task.status === "COMPLETADA" || task.status === "CANCELADA") {
      await fetch(
        `${CAL_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events/${task.googleEventId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );
      await prisma.task.update({
        where: { id: task.id },
        data: { googleEventId: null },
      });
      return;
    }

    await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events/${task.googleEventId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    console.error("[GCalSync] syncTaskUpdated failed:", err);
  }
}

export async function syncTaskDeleted(doctorId: string, googleEventId: string | null, calendarIdHint?: string): Promise<void> {
  if (!googleEventId) return;
  try {
    const userId = await getUserIdForDoctor(doctorId);
    if (!userId) return;

    const tokens = await getValidToken(userId);
    if (!tokens) return;

    await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(tokens.calendarId)}/events/${googleEventId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }
    );
  } catch (err) {
    console.error("[GCalSync] syncTaskDeleted failed:", err);
  }
}
