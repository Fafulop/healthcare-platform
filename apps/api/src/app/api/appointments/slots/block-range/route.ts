// POST /api/appointments/slots/block-range - Block or unblock a date/time range of slots

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    if (role !== 'DOCTOR' && role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { doctorId, startDate, endDate, startTime, endTime, action, dryRun } = body;

    if (!doctorId || !startDate || !endDate || !action) {
      return NextResponse.json(
        { success: false, error: 'doctorId, startDate, endDate, and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'block' && action !== 'unblock') {
      return NextResponse.json(
        { success: false, error: 'action must be "block" or "unblock"' },
        { status: 400 }
      );
    }

    if (role === 'DOCTOR' && doctorId !== authenticatedDoctorId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    // Build the where clause
    const where: any = {
      doctorId,
      date: { gte: start, lte: end },
    };

    if (startTime && endTime) {
      where.startTime = { gte: startTime, lt: endTime };
    } else if (startTime) {
      where.startTime = { gte: startTime };
    } else if (endTime) {
      where.startTime = { lt: endTime };
    }

    // Fetch all matching slots with active booking counts
    const slots = await prisma.appointmentSlot.findMany({
      where,
      select: {
        id: true,
        isOpen: true,
        _count: {
          select: {
            bookings: {
              where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
            },
          },
        },
      },
    });

    const targetState = action === 'block' ? false : true;

    const skippedIds: string[] = [];
    const alreadyInStateIds: string[] = [];
    const toChangeIds: string[] = [];

    for (const slot of slots) {
      const hasActiveBookings = slot._count.bookings > 0;

      // Only skip slots with active bookings when blocking (unblock is always safe)
      if (action === 'block' && hasActiveBookings) {
        skippedIds.push(slot.id);
      } else if (slot.isOpen === targetState) {
        alreadyInStateIds.push(slot.id);
      } else {
        toChangeIds.push(slot.id);
      }
    }

    const preview = {
      toChange: toChangeIds.length,
      alreadyInState: alreadyInStateIds.length,
      skipped: skippedIds.length,
    };

    if (dryRun) {
      return NextResponse.json({ success: true, preview });
    }

    if (toChangeIds.length > 0) {
      await prisma.appointmentSlot.updateMany({
        where: { id: { in: toChangeIds } },
        data: { isOpen: targetState },
      });
    }

    return NextResponse.json({
      success: true,
      preview,
      affected: toChangeIds.length,
      message:
        action === 'block'
          ? `${toChangeIds.length} horario(s) bloqueados`
          : `${toChangeIds.length} horario(s) desbloqueados`,
    });
  } catch (error) {
    console.error('Error in block-range:', error);
    if (
      error instanceof Error &&
      (error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication'))
    ) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to perform block-range operation' },
      { status: 500 }
    );
  }
}
