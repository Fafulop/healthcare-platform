// POST /api/cron/appointment-reminders
// Sends reminder emails to patients with CONFIRMED appointments in ~2 hours.
// Called by a Railway cron job every 15 minutes.
// Protected by CRON_SECRET env var.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { resolveTokens } from '@/lib/google-calendar';
import { sendAppointmentReminderEmail } from '@/lib/gmail';

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Current UTC timestamp — all arithmetic done in UTC to avoid timezone parsing bugs
  const now = new Date();

  // Mexico City local date strings (for rough date filter and window comparison)
  // toLocaleString with sv-SE gives "YYYY-MM-DD HH:MM:SS" in the target timezone
  const nowMxStr = now.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
  // nowMxStr is like "2026-04-15 09:30:00"

  // Window: send reminders for appointments starting between now+1h45m and now+2h15m
  // Compute window bounds in UTC, then express as Mexico City local time strings for
  // comparison against apptDateTimeStr (which is also in Mexico City local time)
  const windowStartMxStr = new Date(now.getTime() + (105 * 60 * 1000))
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).slice(0, 16).replace(' ', 'T');
  const windowEndMxStr   = new Date(now.getTime() + (135 * 60 * 1000))
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).slice(0, 16).replace(' ', 'T');

  // Fetch all CONFIRMED bookings with no reminder sent yet
  // Rough date filter: today and tomorrow (avoids full table scan)
  const todayMx = nowMxStr.slice(0, 10); // "YYYY-MM-DD"
  const tomorrowMx = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' }).slice(0, 10);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      reminderEmailSentAt: null,
      OR: [
        { slot: { date: { gte: new Date(todayMx + 'T00:00:00Z'), lte: new Date(tomorrowMx + 'T23:59:59Z') } } },
        { slotId: null, date: { gte: new Date(todayMx + 'T00:00:00Z'), lte: new Date(tomorrowMx + 'T23:59:59Z') } },
      ],
    },
    include: {
      slot: {
        select: {
          date: true,
          startTime: true,
          endTime: true,
          location: { select: { name: true, address: true, phone: true } },
        },
      },
      doctor: {
        select: {
          id: true,
          slug: true,
          doctorFullName: true,
          primarySpecialty: true,
          clinicAddress: true,
          clinicPhone: true,
          reminderEmailEnabled: true,
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
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const booking of bookings) {
    try {
      // Skip if doctor has reminders disabled
      if (!booking.doctor.reminderEmailEnabled) {
        skipped++;
        continue;
      }

      // Skip if no patient email
      if (!booking.patientEmail) {
        skipped++;
        continue;
      }

      // Resolve appointment date and time
      const apptDate = (booking.slot?.date ?? booking.date)?.toISOString().split('T')[0];
      const apptStart = booking.slot?.startTime ?? booking.startTime;
      const apptEnd   = booking.slot?.endTime   ?? booking.endTime;

      if (!apptDate || !apptStart) {
        skipped++;
        continue;
      }

      // Build appointment datetime string in Mexico City local time for window comparison
      // apptDate is the local date (YYYY-MM-DD), apptStart is local time (HH:MM)
      const apptDateTimeStr = `${apptDate}T${apptStart.slice(0, 5)}`; // "YYYY-MM-DDTHH:MM"
      if (apptDateTimeStr < windowStartMxStr || apptDateTimeStr > windowEndMxStr) {
        skipped++;
        continue;
      }

      // Skip if doctor has no Google token
      const doctorUser = booking.doctor.user;
      if (!doctorUser?.googleAccessToken) {
        skipped++;
        continue;
      }

      // Resolve OAuth tokens
      let accessToken: string;
      let refreshToken: string | null;
      try {
        const resolved = await resolveTokens(doctorUser);
        accessToken = resolved.accessToken;
        refreshToken = resolved.refreshToken;

        if (resolved.updatedToken) {
          await prisma.user.update({
            where: { id: doctorUser.id },
            data: {
              googleAccessToken: resolved.updatedToken.accessToken,
              googleTokenExpiry: resolved.updatedToken.expiresAt,
            },
          });
        }
      } catch {
        skipped++;
        continue;
      }

      const clinicName    = booking.slot?.location?.name ?? undefined;
      const clinicAddress = booking.slot?.location?.address ?? booking.doctor.clinicAddress ?? undefined;
      const clinicPhone   = booking.slot?.location?.phone ?? booking.doctor.clinicPhone ?? undefined;

      // Send reminder email
      await sendAppointmentReminderEmail(
        {
          patientName:     booking.patientName,
          patientEmail:    booking.patientEmail,
          doctorName:      booking.doctor.doctorFullName,
          specialty:       booking.doctor.primarySpecialty ?? null,
          date:            apptDate,
          startTime:       apptStart,
          endTime:         apptEnd ?? '',
          serviceName:     booking.serviceName,
          appointmentMode: booking.appointmentMode,
          confirmationCode: booking.confirmationCode ?? '',
          clinicName,
          clinicAddress,
          clinicPhone,
        },
        accessToken,
        refreshToken,
        booking.doctor.doctorFullName,
        doctorUser.email!
      );

      // Mark reminder as sent
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderEmailSentAt: new Date() },
      });

      sent++;
    } catch (err) {
      errors.push(`booking ${booking.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  console.log(`[appointment-reminders] sent=${sent} skipped=${skipped} errors=${errors.length}`);

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
