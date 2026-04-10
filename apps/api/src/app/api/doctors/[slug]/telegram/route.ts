// GET  /api/doctors/[slug]/telegram — get current telegramChatId
// PUT  /api/doctors/[slug]/telegram — save telegramChatId
// DELETE /api/doctors/[slug]/telegram — remove telegramChatId

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, AuthError } from '@/lib/auth';

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
        telegramChatId: true,
        telegramNotifyBooking: true,
        telegramNotifyForm: true,
        telegramNotifyReminderConfirmed: true,
        telegramNotifyReminderPending: true,
        telegramReminderOffsetMinutes: true,
        telegramNotifyTaskReminder: true,
        telegramTaskReminderOffsetMinutes: true,
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({
      chatId: doctor.telegramChatId ?? null,
      notifyBooking: doctor.telegramNotifyBooking,
      notifyForm: doctor.telegramNotifyForm,
      notifyReminderConfirmed: doctor.telegramNotifyReminderConfirmed,
      notifyReminderPending: doctor.telegramNotifyReminderPending,
      reminderOffsetMinutes: doctor.telegramReminderOffsetMinutes,
      notifyTaskReminder: doctor.telegramNotifyTaskReminder,
      taskReminderOffsetMinutes: doctor.telegramTaskReminderOffsetMinutes,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireDoctorAuth(request);

    const { chatId, notifyBooking, notifyForm, notifyReminderConfirmed, notifyReminderPending, reminderOffsetMinutes, notifyTaskReminder, taskReminderOffsetMinutes } = await request.json();

    const updateData: {
      telegramChatId?: string;
      telegramNotifyBooking?: boolean;
      telegramNotifyForm?: boolean;
      telegramNotifyReminderConfirmed?: boolean;
      telegramNotifyReminderPending?: boolean;
      telegramReminderOffsetMinutes?: number;
      telegramNotifyTaskReminder?: boolean;
      telegramTaskReminderOffsetMinutes?: number;
    } = {};

    if (chatId !== undefined) {
      if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
        return NextResponse.json({ error: 'chatId must be a non-empty string' }, { status: 400 });
      }
      updateData.telegramChatId = chatId.trim();
    }
    if (notifyBooking !== undefined) updateData.telegramNotifyBooking = Boolean(notifyBooking);
    if (notifyForm !== undefined) updateData.telegramNotifyForm = Boolean(notifyForm);
    if (notifyReminderConfirmed !== undefined) updateData.telegramNotifyReminderConfirmed = Boolean(notifyReminderConfirmed);
    if (notifyReminderPending !== undefined) updateData.telegramNotifyReminderPending = Boolean(notifyReminderPending);
    if (reminderOffsetMinutes !== undefined) {
      const offset = Number(reminderOffsetMinutes);
      if (![15, 30, 60, 120, 240, 1440].includes(offset)) {
        return NextResponse.json({ error: 'Invalid reminderOffsetMinutes' }, { status: 400 });
      }
      updateData.telegramReminderOffsetMinutes = offset;
    }
    if (notifyTaskReminder !== undefined) updateData.telegramNotifyTaskReminder = Boolean(notifyTaskReminder);
    if (taskReminderOffsetMinutes !== undefined) {
      const offset = Number(taskReminderOffsetMinutes);
      if (![15, 30, 60, 120, 240, 1440].includes(offset)) {
        return NextResponse.json({ error: 'Invalid taskReminderOffsetMinutes' }, { status: 400 });
      }
      updateData.telegramTaskReminderOffsetMinutes = offset;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const doctor = await prisma.doctor.update({
      where: { slug },
      data: updateData,
      select: {
        telegramChatId: true,
        telegramNotifyBooking: true,
        telegramNotifyForm: true,
        telegramNotifyReminderConfirmed: true,
        telegramNotifyReminderPending: true,
        telegramReminderOffsetMinutes: true,
        telegramNotifyTaskReminder: true,
        telegramTaskReminderOffsetMinutes: true,
      },
    });

    return NextResponse.json({
      chatId: doctor.telegramChatId,
      notifyBooking: doctor.telegramNotifyBooking,
      notifyForm: doctor.telegramNotifyForm,
      notifyReminderConfirmed: doctor.telegramNotifyReminderConfirmed,
      notifyReminderPending: doctor.telegramNotifyReminderPending,
      reminderOffsetMinutes: doctor.telegramReminderOffsetMinutes,
      notifyTaskReminder: doctor.telegramNotifyTaskReminder,
      taskReminderOffsetMinutes: doctor.telegramTaskReminderOffsetMinutes,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireDoctorAuth(request);

    const doctor = await prisma.doctor.update({
      where: { slug },
      data: { telegramChatId: null },
      select: {
        telegramNotifyBooking: true,
        telegramNotifyForm: true,
        telegramNotifyReminderConfirmed: true,
        telegramNotifyReminderPending: true,
        telegramReminderOffsetMinutes: true,
        telegramNotifyTaskReminder: true,
        telegramTaskReminderOffsetMinutes: true,
      },
    });

    return NextResponse.json({
      chatId: null,
      notifyBooking: doctor.telegramNotifyBooking,
      notifyForm: doctor.telegramNotifyForm,
      notifyReminderConfirmed: doctor.telegramNotifyReminderConfirmed,
      notifyReminderPending: doctor.telegramNotifyReminderPending,
      reminderOffsetMinutes: doctor.telegramReminderOffsetMinutes,
      notifyTaskReminder: doctor.telegramNotifyTaskReminder,
      taskReminderOffsetMinutes: doctor.telegramTaskReminderOffsetMinutes,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
