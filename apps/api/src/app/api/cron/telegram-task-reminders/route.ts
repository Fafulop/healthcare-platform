// POST /api/cron/telegram-task-reminders
// Sends Telegram reminder notifications to doctors for upcoming tasks.
// Tasks with a startTime use that time; tasks without default to 07:00 Mexico City.
// Called by the Railway cron service every 15 minutes.
// Protected by CRON_SECRET env var.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { isTelegramConfigured, sendTaskReminderTelegram } from '@/lib/telegram';

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
  const nowMxStr = now
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
    .slice(0, 16)
    .replace(' ', 'T');

  // nowFakeMs: treat MX local "now" as UTC-0 for offset arithmetic
  const nowFakeMs = Date.parse(nowMxStr + ':00Z');
  const windowEndFakeMs = nowFakeMs + 15 * 60 * 1000; // 15-min window matching cron frequency

  // Rough date filter: today and tomorrow in Mexico City
  const todayMx = nowMxStr.slice(0, 10);
  const tomorrowMx = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
    .slice(0, 10);

  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
      telegramReminderSentAt: null,
      dueDate: {
        gte: new Date(todayMx + 'T00:00:00Z'),
        lte: new Date(tomorrowMx + 'T23:59:59Z'),
      },
    },
    include: {
      doctor: {
        select: {
          telegramChatId: true,
          telegramNotifyTaskReminder: true,
          telegramTaskReminderOffsetMinutes: true,
        },
      },
      patient: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      const { doctor } = task;

      if (!doctor.telegramChatId) { skipped++; continue; }
      if (!doctor.telegramNotifyTaskReminder) { skipped++; continue; }
      if (!task.dueDate) { skipped++; continue; }

      const taskDate = task.dueDate.toISOString().split('T')[0]; // YYYY-MM-DD (MX local date)

      // Use task startTime if set, otherwise default to 07:00 Mexico City
      const effectiveTime = task.startTime ?? '07:00';

      // Compute trigger time using "fake UTC" arithmetic:
      // treat MX-local times as UTC-0 — consistent with nowFakeMs so differences are correct
      const taskFakeMs = Date.parse(`${taskDate}T${effectiveTime}:00Z`);
      const triggerFakeMs = taskFakeMs - doctor.telegramTaskReminderOffsetMinutes * 60 * 1000;

      if (triggerFakeMs < nowFakeMs || triggerFakeMs > windowEndFakeMs) {
        skipped++;
        continue;
      }

      const patientName = task.patient
        ? `${task.patient.firstName} ${task.patient.lastName}`.trim()
        : null;

      await sendTaskReminderTelegram(doctor.telegramChatId, {
        title:       task.title,
        description: task.description ?? null,
        date:        taskDate,
        startTime:   task.startTime ?? null,
        endTime:     task.endTime   ?? null,
        priority:    task.priority,
        category:    task.category,
        patientName,
      });

      await prisma.task.update({
        where: { id: task.id },
        data: { telegramReminderSentAt: new Date() },
      });

      sent++;
    } catch (err) {
      errors.push(`task ${task.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  console.log(`[telegram-task-reminders] sent=${sent} skipped=${skipped} errors=${errors.length}`);

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
