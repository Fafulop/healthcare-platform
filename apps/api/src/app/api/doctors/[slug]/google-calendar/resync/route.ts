// POST /api/doctors/[slug]/google-calendar/resync
// Full bidirectional resync: deletes stale GCal events (orphans), upserts all
// active slots (next 60 days) and tasks. Called by "Sincronizar ahora".

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { google } from "googleapis";
import { requireDoctorAuth } from "@/lib/auth";
import {
  createSlotEvent,
  updateSlotEvent,
  createTaskEvent,
  updateTaskEvent,
  resolveTokens,
} from "@/lib/google-calendar";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const authUser = await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { slug },
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

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }
    if (authUser.doctorId !== doctor.id && authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!doctor.googleCalendarEnabled || !doctor.googleCalendarId || !doctor.user) {
      return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
    }

    const calendarId = doctor.googleCalendarId;

    const { accessToken, refreshToken, updatedToken } = await resolveTokens(doctor.user);
    if (updatedToken) {
      await prisma.user.update({
        where: { id: doctor.user.id },
        data: { googleAccessToken: updatedToken.accessToken, googleTokenExpiry: updatedToken.expiresAt },
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken ?? undefined });
    const calendarApi = google.calendar({ version: "v3", auth: oauth2Client });

    // ── 1. Load active DB records ─────────────────────────────────────────────

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in60Days = new Date(today);
    in60Days.setDate(today.getDate() + 60);
    const in90Days = new Date(today);
    in90Days.setDate(today.getDate() + 90); // slightly wider window for GCal listing

    const slots = await prisma.appointmentSlot.findMany({
      where: { doctorId: doctor.id, date: { gte: today, lte: in60Days } },
      include: {
        bookings: {
          where: { status: { in: ["PENDING", "CONFIRMED"] } },
          select: { patientName: true, patientPhone: true, patientEmail: true, notes: true, status: true },
          take: 1,
        },
      },
    });

    const tasks = await prisma.task.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ["PENDIENTE", "EN_PROGRESO"] },
        dueDate: { not: null },
      },
    });

    const activeSlotIds = new Set(slots.map((s) => s.id));
    const activeTaskIds = new Set(tasks.map((t) => t.id));

    // ── 2. List all GCal events we created (source=tusalud.pro) ──────────────

    const gcalEvents: Array<{ id?: string | null; extendedProperties?: { private?: Record<string, string> } | null }> = [];
    let pageToken: string | undefined;
    do {
      const { data } = await calendarApi.events.list({
        calendarId,
        timeMin: today.toISOString(),
        timeMax: in90Days.toISOString(),
        singleEvents: true,
        maxResults: 250,
        pageToken,
        privateExtendedProperty: ["source=tusalud.pro"],
        showDeleted: false,
      });
      gcalEvents.push(...(data.items ?? []));
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    // ── 3. Delete orphan GCal events ─────────────────────────────────────────

    let deletedOrphans = 0;
    for (const event of gcalEvents) {
      if (!event.id) continue;
      const slotId = event.extendedProperties?.private?.slotId;
      const taskId = event.extendedProperties?.private?.taskId;

      if (slotId && !activeSlotIds.has(slotId)) {
        // Slot deleted from DB or outside the resync window — remove from GCal
        try {
          await calendarApi.events.delete({ calendarId, eventId: event.id });
          deletedOrphans++;
        } catch { /* already gone, ignore */ }
        // Clear stale googleEventId from any DB slot that still references it
        await prisma.appointmentSlot.updateMany({
          where: { googleEventId: event.id },
          data: { googleEventId: null },
        }).catch(() => {});
      }

      if (taskId && !activeTaskIds.has(taskId)) {
        // Task completed/cancelled/deleted — remove from GCal
        try {
          await calendarApi.events.delete({ calendarId, eventId: event.id });
          deletedOrphans++;
        } catch { /* already gone */ }
        await prisma.task.updateMany({
          where: { googleEventId: event.id },
          data: { googleEventId: null },
        }).catch(() => {});
      }
    }

    // ── 4. Upsert slot events ─────────────────────────────────────────────────

    let createdSlots = 0;
    let updatedSlots = 0;

    for (const slot of slots) {
      const booking = slot.bookings[0];

      if (!booking) {
        // No active booking — clean up any stale GCal event left from the old design
        if (slot.googleEventId) {
          try {
            await calendarApi.events.delete({ calendarId, eventId: slot.googleEventId });
            deletedOrphans++;
          } catch { /* already gone */ }
          await prisma.appointmentSlot.update({ where: { id: slot.id }, data: { googleEventId: null } }).catch(() => {});
        }
        continue;
      }

      const dateStr = slot.date.toISOString().split("T")[0];
      const slotData = {
        id: slot.id,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isOpen: slot.isOpen,
        patientName: booking.patientName,
        bookingStatus: booking.status as "PENDING" | "CONFIRMED",
        patientPhone: booking.patientPhone,
        patientEmail: booking.patientEmail,
        patientNotes: booking.notes ?? undefined,
        finalPrice: Number(slot.finalPrice),
      };

      try {
        if (slot.googleEventId) {
          try {
            await updateSlotEvent(accessToken, refreshToken, calendarId, slot.googleEventId, slotData);
            updatedSlots++;
          } catch {
            // Event may have been manually deleted in GCal — re-create it
            const eventId = await createSlotEvent(accessToken, refreshToken, calendarId, slotData);
            await prisma.appointmentSlot.update({ where: { id: slot.id }, data: { googleEventId: eventId } });
            createdSlots++;
          }
        } else {
          const eventId = await createSlotEvent(accessToken, refreshToken, calendarId, slotData);
          await prisma.appointmentSlot.update({ where: { id: slot.id }, data: { googleEventId: eventId } });
          createdSlots++;
        }
      } catch (err) {
        console.error(`[Resync] Slot ${slot.id} failed:`, err);
      }
    }

    // ── 5. Upsert task events ─────────────────────────────────────────────────

    let createdTasks = 0;
    let updatedTasks = 0;

    for (const task of tasks) {
      const taskData = {
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate!.toISOString().split("T")[0],
        startTime: task.startTime,
        endTime: task.endTime,
        status: task.status,
        priority: task.priority,
        category: task.category,
      };

      try {
        if (task.googleEventId) {
          try {
            await updateTaskEvent(accessToken, refreshToken, calendarId, task.googleEventId, taskData);
            updatedTasks++;
          } catch {
            // Re-create if event was manually deleted
            const eventId = await createTaskEvent(accessToken, refreshToken, calendarId, taskData);
            await prisma.task.update({ where: { id: task.id }, data: { googleEventId: eventId } });
            createdTasks++;
          }
        } else {
          const eventId = await createTaskEvent(accessToken, refreshToken, calendarId, taskData);
          await prisma.task.update({ where: { id: task.id }, data: { googleEventId: eventId } });
          createdTasks++;
        }
      } catch (err) {
        console.error(`[Resync] Task ${task.id} failed:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      deletedOrphans,
      createdSlots,
      updatedSlots,
      createdTasks,
      updatedTasks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Calendar Resync]", message);
    const status = message.includes("access required") ? 403 : message.includes("No Google tokens") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
