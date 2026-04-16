// DELETE /api/appointments/slots/purge - Bulk delete available slots with filters
// Supports dry-run mode (returns count without deleting)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logSlotsBulkDeleted } from '@/lib/activity-logger';

export async function DELETE(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    if (role !== 'DOCTOR' && role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      doctorId,
      dryRun = false,
      dateFrom,   // optional "YYYY-MM-DD"
      dateTo,     // optional "YYYY-MM-DD"
      daysOfWeek, // optional number[] (0=Sun, 1=Mon, ..., 6=Sat — JS getUTCDay convention)
      timeFrom,   // optional "HH:MM"
      timeTo,     // optional "HH:MM"
    } = body;

    const targetDoctorId = role === 'ADMIN' && doctorId ? doctorId : authenticatedDoctorId;

    if (!targetDoctorId) {
      return NextResponse.json({ success: false, error: 'Doctor ID required' }, { status: 400 });
    }

    if (role === 'DOCTOR' && doctorId && doctorId !== authenticatedDoctorId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Build date filter
    const dateFilter: any = {};
    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00Z');
      dateFilter.gte = from;
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59.999Z');
      dateFilter.lte = to;
    }

    // Step 1: Find all candidate slots (open, public, belonging to doctor)
    const candidates = await prisma.appointmentSlot.findMany({
      where: {
        doctorId: targetDoctorId,
        isOpen: true,
        isPublic: true,
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      include: {
        bookings: {
          where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
          select: { id: true },
        },
      },
    });

    // Step 2: Filter out slots with active bookings, then apply daysOfWeek and time filters
    let eligible = candidates.filter((s) => s.bookings.length === 0);

    if (daysOfWeek && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      eligible = eligible.filter((s) => daysOfWeek.includes(s.date.getUTCDay()));
    }

    if (timeFrom) {
      eligible = eligible.filter((s) => s.startTime >= timeFrom);
    }
    if (timeTo) {
      eligible = eligible.filter((s) => s.startTime < timeTo);
    }

    const eligibleIds = eligible.map((s) => s.id);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: eligibleIds.length,
        message: eligibleIds.length === 0
          ? 'No hay horarios disponibles que coincidan con los filtros'
          : `Se eliminarán ${eligibleIds.length} horario(s) disponibles`,
      });
    }

    if (eligibleIds.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No hay horarios disponibles que coincidan con los filtros',
      });
    }

    // Step 3: Detach historical bookings (CANCELLED/COMPLETED/NO_SHOW) so cascade
    // doesn't destroy booking history, then delete the slots — in a single transaction.
    const [, deleted] = await prisma.$transaction([
      prisma.booking.updateMany({
        where: {
          slotId: { in: eligibleIds },
          status: { in: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        },
        data: { slotId: null },
      }),
      prisma.appointmentSlot.deleteMany({
        where: { id: { in: eligibleIds } },
      }),
    ]);

    logSlotsBulkDeleted({ doctorId: targetDoctorId, count: deleted.count });

    return NextResponse.json({
      success: true,
      count: deleted.count,
      message: `Eliminados ${deleted.count} horarios disponibles`,
    });
  } catch (error) {
    console.error('Error purging slots:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to purge slots' },
      { status: 500 }
    );
  }
}
