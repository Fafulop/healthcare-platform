// GET /api/doctors/[slug]/google-calendar/status
// Returns whether the doctor has Google Calendar connected.

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { requireDoctorAuth, AuthError } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireDoctorAuth(request);

    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      select: {
        id: true,
        googleCalendarId: true,
        googleCalendarEnabled: true,
        googleChannelExpiry: true,
        user: {
          select: {
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

    // hasRefreshToken is what matters — if present, the API auto-refreshes and no re-auth is needed.
    // hasTokens kept for backwards compat (access token or refresh token present).
    const hasRefreshToken = !!doctor.user?.googleRefreshToken;
    const hasTokens = !!doctor.user?.googleAccessToken || hasRefreshToken;

    const connected =
      !!doctor.googleCalendarId &&
      hasRefreshToken &&
      doctor.googleCalendarEnabled;

    return NextResponse.json({
      connected,
      hasTokens,
      hasRefreshToken,
      calendarId: doctor.googleCalendarId ?? null,
      enabled: doctor.googleCalendarEnabled,
      tokenExpiry: doctor.user?.googleTokenExpiry ?? null,
      channelExpiry: doctor.googleChannelExpiry ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
