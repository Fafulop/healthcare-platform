// POST /api/calendar/renew-channels
// Finds all Google Calendar push notification channels expiring within 24 hours
// and renews them. Call this daily via a Railway cron job or scheduled task.
//
// Protected by CRON_SECRET to prevent unauthorized calls.
// Railway cron: set up a scheduled job that POSTs to this endpoint every 24 hours.
//
// Example Railway cron command:
//   curl -X POST https://your-api.railway.app/api/calendar/renew-channels \
//     -H "Authorization: Bearer $CRON_SECRET"

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { resolveTokens, watchCalendar, stopCalendarWatch } from "@/lib/google-calendar";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhookUrl = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/calendar/webhook`
      : null;

    const webhookSecret = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_API_URL or GOOGLE_CALENDAR_WEBHOOK_SECRET not configured" },
        { status: 500 }
      );
    }

    // Find all active doctors with channels expiring within 24 hours (or already expired)
    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const doctors = await prisma.doctor.findMany({
      where: {
        googleCalendarEnabled: true,
        googleCalendarId: { not: null },
        googleChannelId: { not: null },
        OR: [
          { googleChannelExpiry: null },
          { googleChannelExpiry: { lte: cutoff } },
        ],
      },
      select: {
        id: true,
        googleCalendarId: true,
        googleChannelId: true,
        googleChannelResourceId: true,
        googleChannelExpiry: true,
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

    const results = {
      total: doctors.length,
      renewed: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{ doctorId: string; status: string; error?: string }>,
    };

    for (const doctor of doctors) {
      if (!doctor.user || !doctor.googleCalendarId) {
        results.skipped++;
        results.details.push({ doctorId: doctor.id, status: "skipped — no user or calendar" });
        continue;
      }

      try {
        const { accessToken, refreshToken, updatedToken } = await resolveTokens(doctor.user);

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

        // Stop the old channel (best-effort — it may already be expired)
        if (doctor.googleChannelId && doctor.googleChannelResourceId) {
          await stopCalendarWatch(
            accessToken,
            refreshToken,
            doctor.googleChannelId,
            doctor.googleChannelResourceId
          ).catch(() => {});
        }

        // Create a new channel with a fresh unique ID
        const newChannelId = `doctor_${doctor.id}_${crypto.randomBytes(4).toString("hex")}`;

        const { resourceId, expiration } = await watchCalendar(
          accessToken,
          refreshToken,
          doctor.googleCalendarId,
          webhookUrl,
          newChannelId,
          webhookSecret
        );

        await prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            googleChannelId: newChannelId,
            googleChannelResourceId: resourceId,
            googleChannelExpiry: new Date(Number(expiration)),
          },
        });

        results.renewed++;
        results.details.push({
          doctorId: doctor.id,
          status: "renewed",
        });
      } catch (err) {
        results.failed++;
        results.details.push({
          doctorId: doctor.id,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        console.error(`[Calendar Renewal] Failed for doctor ${doctor.id}:`, err);
      }
    }

    console.log(`[Calendar Renewal] Done — renewed: ${results.renewed}, failed: ${results.failed}, skipped: ${results.skipped}`);

    return NextResponse.json(results);
  } catch (error) {
    console.error("[Calendar Renewal] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
