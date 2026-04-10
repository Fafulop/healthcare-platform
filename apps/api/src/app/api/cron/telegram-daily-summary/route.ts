// POST /api/cron/telegram-daily-summary
// Sends a daily agenda briefing to doctors via Telegram at their configured time.
// Shows all appointments (CONFIRMED + PENDING) and all tasks for that calendar day.
// "Today" is always the Mexico City local date at the moment the cron fires.
// Called by the Railway cron service every 15 minutes.
// Protected by CRON_SECRET env var.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { isTelegramConfigured, sendDailySummaryTelegram } from '@/lib/telegram';

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

  // All date/time logic uses Mexico City local time.
  // sv-SE locale gives "YYYY-MM-DD HH:MM:SS" — reliable across all environments.
  const nowMxFull = now.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
  // "today" in Mexico City — the calendar date doctors see on their wall
  const todayMx = nowMxFull.slice(0, 10);         // "YYYY-MM-DD"
  const nowMxHHMM = nowMxFull.slice(11, 16);      // "HH:MM"

  // Fetch all doctors with daily summary enabled and a Telegram Chat ID
  const doctors = await prisma.doctor.findMany({
    where: {
      telegramDailySummaryEnabled: true,
      telegramChatId: { not: null },
    },
    select: {
      id: true,
      telegramChatId: true,
      telegramDailySummaryTime: true,
      telegramDailySummarySentAt: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const doctor of doctors) {
    try {
      if (!doctor.telegramChatId) { skipped++; continue; }

      // Skip if already sent today (compare MX local date of last send to today MX)
      if (doctor.telegramDailySummarySentAt) {
        const lastSentMx = doctor.telegramDailySummarySentAt
          .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
          .slice(0, 10);
        if (lastSentMx === todayMx) { skipped++; continue; }
      }

      // Check if now falls within the doctor's configured 15-min send window.
      // Compare only the HH:MM portion using fixed-date fake UTC so DST doesn't affect
      // the time-of-day arithmetic (we only care about relative minutes, not absolute UTC).
      const doctorTimeFakeMs = Date.parse(`2000-01-01T${doctor.telegramDailySummaryTime}:00Z`);
      const nowTimeFakeMs    = Date.parse(`2000-01-01T${nowMxHHMM}:00Z`);
      if (nowTimeFakeMs < doctorTimeFakeMs || nowTimeFakeMs >= doctorTimeFakeMs + 15 * 60 * 1000) {
        skipped++;
        continue;
      }

      // "Today" as UTC midnight — used for DB date range queries.
      // slot.date is stored as midnight UTC of the MX local date, so this matches correctly.
      const todayUtcStart = new Date(todayMx + 'T00:00:00Z');
      const todayUtcEnd   = new Date(todayMx + 'T23:59:59Z');

      // Fetch today's appointments (CONFIRMED + PENDING, slot-based and freeform)
      const bookings = await prisma.booking.findMany({
        where: {
          doctorId: doctor.id,
          status: { in: ['CONFIRMED', 'PENDING'] },
          OR: [
            { slot: { date: { gte: todayUtcStart, lte: todayUtcEnd } } },
            { slotId: null, date: { gte: todayUtcStart, lte: todayUtcEnd } },
          ],
        },
        include: {
          slot: { select: { startTime: true, endTime: true } },
        },
      });

      // Sort in application code so freeform bookings (slot === null) order correctly
      // alongside slot-based ones — Prisma's orderBy on a relation is undefined for nulls.
      bookings.sort((a, b) => {
        const aTime = (a.slot?.startTime ?? a.startTime ?? '99:99').slice(0, 5);
        const bTime = (b.slot?.startTime ?? b.startTime ?? '99:99').slice(0, 5);
        return aTime.localeCompare(bTime);
      });

      // Fetch today's tasks (all statuses)
      const tasks = await prisma.task.findMany({
        where: {
          doctorId: doctor.id,
          dueDate: { gte: todayUtcStart, lte: todayUtcEnd },
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: [
          { startTime: 'asc' },
          { priority: 'asc' },
        ],
      });

      // Shape appointments for the message
      const apptSummary = bookings.map((b) => ({
        startTime:   (b.slot?.startTime ?? b.startTime ?? '??:??').slice(0, 5),
        endTime:     (b.slot?.endTime   ?? b.endTime   ?? '??:??').slice(0, 5),
        patientName: b.patientName,
        status:      b.status,
        serviceName: b.serviceName ?? null,
      }));

      // Tasks without startTime go to the bottom (sorted by title)
      const tasksWithTime    = tasks.filter((t) => t.startTime);
      const tasksWithoutTime = tasks.filter((t) => !t.startTime);
      const orderedTasks = [...tasksWithTime, ...tasksWithoutTime];

      const taskSummary = orderedTasks.map((t) => ({
        title:       t.title,
        startTime:   t.startTime ? t.startTime.slice(0, 5) : null,
        priority:    t.priority,
        status:      t.status,
        patientName: t.patient
          ? `${t.patient.firstName} ${t.patient.lastName}`.trim()
          : null,
      }));

      await sendDailySummaryTelegram(
        doctor.telegramChatId,
        todayMx,
        apptSummary,
        taskSummary
      );

      // Stamp sent time to prevent duplicate sends today
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: { telegramDailySummarySentAt: now },
      });

      sent++;
    } catch (err) {
      errors.push(`doctor ${doctor.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  console.log(`[telegram-daily-summary] sent=${sent} skipped=${skipped} errors=${errors.length}`);

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
