// POST /api/cron/telegram-reminders
// Sends Telegram reminder notifications to doctors for upcoming CONFIRMED and PENDING appointments.
// Called by the Railway cron service every 15 minutes.
// Protected by CRON_SECRET env var.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { isTelegramConfigured, sendAppointmentReminderTelegram } from '@/lib/telegram';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, reason: 'Telegram not configured' });
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
      status: { in: ['CONFIRMED', 'PENDING'] },
      telegramReminderSentAt: null,
      OR: [
        {
          slot: {
            date: {
              gte: new Date(todayMx + 'T00:00:00Z'),
              lte: new Date(tomorrowMx + 'T23:59:59Z'),
            },
          },
        },
        {
          slotId: null,
          date: {
            gte: new Date(todayMx + 'T00:00:00Z'),
            lte: new Date(tomorrowMx + 'T23:59:59Z'),
          },
        },
      ],
    },
    include: {
      slot: {
        select: { date: true, startTime: true, endTime: true },
      },
      doctor: {
        select: {
          telegramChatId: true,
          telegramNotifyReminderConfirmed: true,
          telegramNotifyReminderPending: true,
          telegramReminderOffsetMinutes: true,
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const booking of bookings) {
    try {
      const { doctor } = booking;

      if (!doctor.telegramChatId) { skipped++; continue; }

      if (booking.status === 'CONFIRMED' && !doctor.telegramNotifyReminderConfirmed) { skipped++; continue; }
      if (booking.status === 'PENDING'   && !doctor.telegramNotifyReminderPending)   { skipped++; continue; }

      // Resolve appointment date + time (slot-based or freeform)
      const apptDate  = (booking.slot?.date ?? booking.date)?.toISOString().split('T')[0];
      const apptStart = booking.slot?.startTime ?? booking.startTime;
      const apptEnd   = booking.slot?.endTime   ?? booking.endTime;

      if (!apptDate || !apptStart || !apptEnd) { skipped++; continue; }

      // apptDate (YYYY-MM-DD) and apptStart (HH:MM) are both in Mexico City local time.
      // To compute triggerTime = apptTime - offset, we use "fake UTC" arithmetic:
      // treat both MX-local times as UTC-0. Differences are correct because both sides
      // use the same convention — DST offsets cancel out when comparing to nowFakeMs.
      const apptFakeMs = Date.parse(`${apptDate}T${apptStart.slice(0, 5)}:00Z`);
      const triggerFakeMs = apptFakeMs - doctor.telegramReminderOffsetMinutes * 60 * 1000;

      if (triggerFakeMs < nowFakeMs || triggerFakeMs > windowEndFakeMs) {
        skipped++;
        continue;
      }

      await sendAppointmentReminderTelegram(doctor.telegramChatId, {
        patientName:      booking.patientName,
        patientPhone:     booking.patientPhone,
        serviceName:      booking.serviceName ?? null,
        date:             apptDate,
        startTime:        apptStart.slice(0, 5),
        endTime:          apptEnd.slice(0, 5),
        confirmationCode: booking.confirmationCode ?? '',
        status:           booking.status as 'CONFIRMED' | 'PENDING',
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { telegramReminderSentAt: new Date() },
      });

      sent++;
    } catch (err) {
      errors.push(`booking ${booking.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  console.log(`[telegram-reminders] sent=${sent} skipped=${skipped} errors=${errors.length}`);

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
