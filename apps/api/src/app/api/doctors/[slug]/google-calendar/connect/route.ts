// POST /api/doctors/[slug]/google-calendar/connect
// Creates the "tusalud.pro" calendar in the doctor's Google account,
// runs an initial sync of upcoming slots and pending tasks, then enables the integration.

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { requireDoctorAuth } from "@/lib/auth";
import {
  createDedicatedCalendar,
  createSlotEvent,
  createTaskEvent,
  resolveTokens,
  watchCalendar,
  stopCalendarWatch,
} from "@/lib/google-calendar";
import crypto from "crypto";

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
        googleChannelId: true,
        googleChannelResourceId: true,
        user: {
          select: {
            id: true,
            email: true,
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

    // Only the doctor themselves (or admin) can connect their calendar
    if (authUser.doctorId !== doctor.id && authUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!doctor.user) {
      return NextResponse.json(
        { error: "No user account linked to this doctor" },
        { status: 400 }
      );
    }

    const { accessToken, refreshToken, updatedToken } = await resolveTokens(
      doctor.user
    );

    // Persist refreshed token if needed
    if (updatedToken) {
      await prisma.user.update({
        where: { id: doctor.user.id },
        data: {
          googleAccessToken: updatedToken.accessToken,
          googleTokenExpiry: updatedToken.expiresAt,
        },
      });
    }

    // If already connected, just re-enable
    let calendarId = doctor.googleCalendarId;
    if (!calendarId) {
      calendarId = await createDedicatedCalendar(accessToken, refreshToken);
    }

    // Mark integration as enabled and save calendar ID
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        googleCalendarId: calendarId,
        googleCalendarEnabled: true,
      },
    });

    // ── Initial sync: upcoming slots (next 60 days) ──
    const today = new Date();
    const in60Days = new Date();
    in60Days.setDate(today.getDate() + 60);

    const slots = await prisma.appointmentSlot.findMany({
      where: {
        doctorId: doctor.id,
        date: { gte: today, lte: in60Days },
        googleEventId: null,
      },
      include: {
        bookings: {
          where: { status: { in: ["PENDING", "CONFIRMED"] } },
          select: { patientName: true, status: true },
          take: 1,
        },
      },
    });

    for (const slot of slots) {
      try {
        const dateStr = slot.date.toISOString().split("T")[0];
        const booking = slot.bookings[0];
        const googleEventId = await createSlotEvent(
          accessToken,
          refreshToken,
          calendarId,
          {
            id: slot.id,
            date: dateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isOpen: slot.isOpen,
            patientName: booking?.patientName,
            finalPrice: Number(slot.finalPrice),
          }
        );
        await prisma.appointmentSlot.update({
          where: { id: slot.id },
          data: { googleEventId },
        });
      } catch (err) {
        console.error(`[Google Calendar] Failed to sync slot ${slot.id}:`, err);
      }
    }

    // ── Initial sync: pending/in-progress tasks (with dueDate) ──
    const tasks = await prisma.task.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ["PENDIENTE", "EN_PROGRESO"] },
        dueDate: { not: null },
        googleEventId: null,
      },
    });

    for (const task of tasks) {
      try {
        const dueDateStr = task.dueDate!.toISOString().split("T")[0];
        const googleEventId = await createTaskEvent(
          accessToken,
          refreshToken,
          calendarId,
          {
            id: task.id,
            title: task.title,
            description: task.description,
            dueDate: dueDateStr,
            startTime: task.startTime,
            endTime: task.endTime,
            status: task.status,
            priority: task.priority,
          }
        );
        await prisma.task.update({
          where: { id: task.id },
          data: { googleEventId },
        });
      } catch (err) {
        console.error(`[Google Calendar] Failed to sync task ${task.id}:`, err);
      }
    }

    // ── Set up push notifications for bidirectional sync ──
    const webhookUrl = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/webhook`
      : null;

    let channelExpiry: string | null = null;

    if (webhookUrl && process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET) {
      try {
        // Stop existing channel before creating a new one (safe to call even if none exists)
        if (doctor.googleChannelId && doctor.googleChannelResourceId) {
          await stopCalendarWatch(
            accessToken,
            refreshToken,
            doctor.googleChannelId,
            doctor.googleChannelResourceId
          ).catch(() => {}); // Ignore errors — old channel may already be expired
        }

        // Generate a unique channel ID for this doctor
        const newChannelId = `doctor_${doctor.id}_${crypto.randomBytes(4).toString("hex")}`;

        const { resourceId, expiration } = await watchCalendar(
          accessToken,
          refreshToken,
          calendarId,
          webhookUrl,
          newChannelId,
          process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET
        );

        await prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            googleChannelId: newChannelId,
            googleChannelResourceId: resourceId,
            googleChannelExpiry: new Date(Number(expiration)),
          },
        });

        channelExpiry = new Date(Number(expiration)).toISOString();
      } catch (err) {
        // Webhook setup failure is non-fatal — sync still works app → Google
        console.warn("[Google Calendar connect] Webhook setup failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      calendarId,
      syncedSlots: slots.length,
      syncedTasks: tasks.length,
      webhookActive: !!channelExpiry,
      channelExpiry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Google Calendar connect]", message);
    const status = message.includes("access required")
      ? 403
      : message.includes("No Google tokens")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
