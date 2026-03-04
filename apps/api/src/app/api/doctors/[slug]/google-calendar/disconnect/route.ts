// DELETE /api/doctors/[slug]/google-calendar/disconnect
// Disables the Google Calendar integration. Clears tokens and calendar ID.

import { NextResponse } from "next/server";
import { prisma } from "@healthcare/database";
import { requireDoctorAuth } from "@/lib/auth";
import { deleteDedicatedCalendar, resolveTokens } from "@/lib/google-calendar";

export async function DELETE(
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

    // Attempt to delete the calendar from Google (best-effort)
    if (doctor.user?.googleAccessToken && doctor.googleCalendarId) {
      try {
        const { accessToken, refreshToken } = await resolveTokens(doctor.user);
        await deleteDedicatedCalendar(
          accessToken,
          refreshToken,
          doctor.googleCalendarId
        );
      } catch (err) {
        // Don't block disconnect if calendar deletion fails (may already be deleted)
        console.warn("[Google Calendar disconnect] Could not delete calendar:", err);
      }
    }

    // Clear all Google Calendar data from DB
    await prisma.$transaction([
      // Remove event IDs from slots
      prisma.appointmentSlot.updateMany({
        where: { doctorId: doctor.id },
        data: { googleEventId: null },
      }),
      // Remove event IDs from tasks
      prisma.task.updateMany({
        where: { doctorId: doctor.id },
        data: { googleEventId: null },
      }),
      // Disable integration on doctor
      prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          googleCalendarEnabled: false,
          googleCalendarId: null,
        },
      }),
      // Clear tokens from user
      ...(doctor.user
        ? [
            prisma.user.update({
              where: { id: doctor.user.id },
              data: {
                googleAccessToken: null,
                googleRefreshToken: null,
                googleTokenExpiry: null,
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Google Calendar disconnect]", message);
    const status = message.includes("access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
