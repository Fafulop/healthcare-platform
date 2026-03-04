// POST /api/calendar/webhook
// Receives Google Calendar push notifications (bidirectional sync).
// Google sends a POST whenever events change in the watched calendar.
//
// Setup: call watchCalendar() from google-calendar.ts when connecting.
// The channel token is stored as GOOGLE_CALENDAR_WEBHOOK_SECRET in env.
//
// NOTE: This endpoint must be publicly reachable (not localhost).
// Set NEXT_PUBLIC_API_URL to your Railway URL in production.

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { google } from "googleapis";
import { resolveTokens } from "@/lib/google-calendar";

export async function POST(request: Request) {
  try {
    // Validate channel token to ensure request is from Google
    const channelToken = request.headers.get("x-goog-channel-token");
    const expectedToken = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;

    if (!expectedToken || channelToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resourceState = request.headers.get("x-goog-resource-state");
    const channelId = request.headers.get("x-goog-channel-id");

    // "sync" is a verification ping — just acknowledge it
    if (resourceState === "sync") {
      return new NextResponse(null, { status: 200 });
    }

    // "exists" or "not_exists" means events changed — fetch and process
    if (!channelId) {
      return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
    }

    // Look up doctor by stored channelId (format: "doctor_{doctorId}_{randomHex}")
    const doctor = await prisma.doctor.findFirst({
      where: { googleChannelId: channelId },
      select: {
        id: true,
        googleCalendarId: true,
        googleCalendarEnabled: true,
        user: {
          select: {
            id: true,
            googleAccessToken: true,
            googleRefreshToken: true,
            googleTokenExpiry: true,
          },
        },
      },
    });

    if (!doctor?.googleCalendarEnabled || !doctor.googleCalendarId || !doctor.user) {
      return new NextResponse(null, { status: 200 });
    }

    const { accessToken, refreshToken, updatedToken } = await resolveTokens(doctor.user);

    if (updatedToken) {
      await prisma.user.update({
        where: { id: doctor.user.id },
        data: {
          googleAccessToken: updatedToken.accessToken,
          googleTokenExpiry: updatedToken.expiresAt,
        },
      });
    }

    // Fetch recently changed events (last 2 minutes)
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
    });

    const calendarApi = google.calendar({ version: "v3", auth: oauth2Client });
    const updatedMin = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data } = await calendarApi.events.list({
      calendarId: doctor.googleCalendarId,
      updatedMin,
      singleEvents: true,
    });

    const events = data.items ?? [];

    for (const event of events) {
      if (!event.id) continue;

      const slotId = event.extendedProperties?.private?.slotId;
      const taskId = event.extendedProperties?.private?.taskId;
      const source = event.extendedProperties?.private?.source;

      if (source !== "tusalud.pro") continue;

      // Handle cancelled events (deleted in Google Calendar)
      if (event.status === "cancelled") {
        if (slotId) {
          await prisma.appointmentSlot.updateMany({
            where: { id: slotId, doctorId: doctor.id },
            data: { isOpen: false, googleEventId: null },
          });
        }
        if (taskId) {
          await prisma.task.updateMany({
            where: { id: taskId, doctorId: doctor.id },
            data: { status: "CANCELADA", googleEventId: null },
          });
        }
        continue;
      }

      // Handle updated/moved events (time change from Google Calendar drag-and-drop)
      if (slotId && event.start?.dateTime && event.end?.dateTime) {
        const newStart = new Date(event.start.dateTime);
        const newEnd = new Date(event.end.dateTime);
        const newDate = newStart.toISOString().split("T")[0];
        const newStartTime = newStart.toTimeString().slice(0, 5);
        const newEndTime = newEnd.toTimeString().slice(0, 5);

        await prisma.appointmentSlot.updateMany({
          where: { id: slotId, doctorId: doctor.id },
          data: {
            date: new Date(newDate),
            startTime: newStartTime,
            endTime: newEndTime,
          },
        });
      }

      if (taskId && event.start) {
        const isAllDay = !!event.start.date && !event.start.dateTime;

        if (isAllDay && event.start.date) {
          await prisma.task.updateMany({
            where: { id: taskId, doctorId: doctor.id },
            data: {
              dueDate: new Date(event.start.date),
              startTime: null,
              endTime: null,
            },
          });
        } else if (event.start.dateTime && event.end?.dateTime) {
          const newStart = new Date(event.start.dateTime);
          const newEnd = new Date(event.end.dateTime);
          await prisma.task.updateMany({
            where: { id: taskId, doctorId: doctor.id },
            data: {
              dueDate: new Date(newStart.toISOString().split("T")[0]),
              startTime: newStart.toTimeString().slice(0, 5),
              endTime: newEnd.toTimeString().slice(0, 5),
            },
          });
        }
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Google Calendar Webhook]", error);
    // Always return 200 to Google — a non-2xx response stops the watch channel
    return new NextResponse(null, { status: 200 });
  }
}
