// GET /api/doctors/[slug]/google-calendar/status
// Returns whether the doctor has Google Calendar connected.

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { requireDoctorAuth } from "@/lib/auth";

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
        user: {
          select: {
            googleAccessToken: true,
            googleTokenExpiry: true,
          },
        },
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const hasTokens = !!doctor.user?.googleAccessToken;

    const connected =
      !!doctor.googleCalendarId &&
      hasTokens &&
      doctor.googleCalendarEnabled;

    return NextResponse.json({
      connected,
      hasTokens,
      calendarId: doctor.googleCalendarId ?? null,
      enabled: doctor.googleCalendarEnabled,
      tokenExpiry: doctor.user?.googleTokenExpiry ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
