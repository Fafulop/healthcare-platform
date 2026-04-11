// POST /api/cron/appointment-reminders
// Sends reminder emails to patients with CONFIRMED appointments.
// Lead time is configurable per doctor (reminderEmailOffsetMinutes, default 120 = 2h).
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

  const now = new Date();

  // Express "now" as Mexico City local time string "YYYY-MM-DDTHH:MM"
  // Used as "fake UTC" for consistent arithmetic with appt local times (see below)
  const nowMxStr = now
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
    .slice(0, 16)
    .replace(' ', 'T');

  // nowFakeMs: treat MX local "now" as UTC-0 for offset arithmetic
  const nowFakeMs = Date.parse(nowMxStr + ':00Z');
  const windowEndFakeMs = nowFakeMs + 15 * 60 * 1000; // 15-min window matching cron frequency

  // Rough date filter: today and tomorrow in Mexico City (avoids full table scan)
  const todayMx = nowMxStr.slice(0, 10);
  const tomorrowMx = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
    .slice(0, 10);

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
          reminderEmailOffsetMinutes: true,
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
      const apptDate  = (booking.slot?.date ?? booking.date)?.toISOString().split('T')[0];
      const apptStart = booking.slot?.startTime ?? booking.startTime;
      const apptEnd   = booking.slot?.endTime   ?? booking.endTime;

      if (!apptDate || !apptStart) {
        skipped++;
        continue;
      }

      // apptDate (YYYY-MM-DD) and apptStart (HH:MM) are both in Mexico City local time.
      // To compute triggerTime = apptTime - offset, use "fake UTC" arithmetic:
      // treat both MX-local times as UTC-0. DST offsets cancel out because both sides
      // use the same convention — no timezone conversion needed.
      const apptFakeMs = Date.parse(`${apptDate}T${apptStart.slice(0, 5)}:00Z`);
      const triggerFakeMs = apptFakeMs - booking.doctor.reminderEmailOffsetMinutes * 60 * 1000;

      if (triggerFakeMs < nowFakeMs || triggerFakeMs > windowEndFakeMs) {
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

      await sendAppointmentReminderEmail(
        {
          patientName:      booking.patientName,
          patientEmail:     booking.patientEmail,
          doctorName:       booking.doctor.doctorFullName,
          specialty:        booking.doctor.primarySpecialty ?? null,
          date:             apptDate,
          startTime:        apptStart,
          endTime:          apptEnd ?? '',
          serviceName:      booking.serviceName,
          appointmentMode:  booking.appointmentMode,
          confirmationCode: booking.confirmationCode ?? '',
          clinicName,
          clinicAddress,
          clinicPhone,
          meetLink:         booking.meetLink ?? null,
        },
        accessToken,
        refreshToken,
        booking.doctor.doctorFullName,
        doctorUser.email!
      );

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
