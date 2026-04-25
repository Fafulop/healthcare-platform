// GET  /api/appointments/ranges/block — List blocked times
// POST /api/appointments/ranges/block — Create blocked time(s)
// DELETE /api/appointments/ranges/block — Unblock (remove BlockedTime records)
//
// BlockedTime is an overlay: it doesn't modify AvailabilityRange rows.
// The availability calculator subtracts blocked times from range windows.
// To unblock, simply delete the BlockedTime record.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';

/** Validate that a time string is on a 30-minute boundary. */
function isValid30MinBoundary(time: string): boolean {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 0 && h <= 23 && [0, 30].includes(m);
}

// ---------------------------------------------------------------------------
// GET — List blocked times for a doctor + date range
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!doctorId) {
      return NextResponse.json(
        { success: false, error: 'doctorId es requerido' },
        { status: 400 }
      );
    }

    // Authorization
    if (role === 'DOCTOR') {
      if (doctorId !== authenticatedDoctorId) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const where: any = { doctorId };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }

    const blockedTimes = await prisma.blockedTime.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      count: blockedTimes.length,
      data: blockedTimes,
    });
  } catch (error) {
    console.error('Error fetching blocked times:', error);

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
      { success: false, error: 'Error al obtener horarios bloqueados' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create blocked time records
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const { doctorId, startDate, endDate, blockStartTime, blockEndTime, reason, dryRun = true } = body;

    if (!doctorId || !startDate || !endDate || !blockStartTime || !blockEndTime) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: doctorId, startDate, endDate, blockStartTime, blockEndTime' },
        { status: 400 }
      );
    }

    // Authorization
    if (role === 'DOCTOR') {
      if (doctorId !== authenticatedDoctorId) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Validate time boundaries (30-min increments)
    if (!isValid30MinBoundary(blockStartTime) || !isValid30MinBoundary(blockEndTime)) {
      return NextResponse.json(
        { success: false, error: 'Los horarios deben ser en intervalos de 30 minutos (ej: 09:00, 09:30, 10:00)' },
        { status: 400 }
      );
    }

    if (blockStartTime >= blockEndTime) {
      return NextResponse.json(
        { success: false, error: 'La hora de inicio del bloqueo debe ser anterior a la hora de fin' },
        { status: 400 }
      );
    }

    // Build list of dates
    const start = new Date(startDate + 'T12:00:00Z');
    const end = new Date(endDate + 'T12:00:00Z');
    const dates: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const normalized = new Date(d);
      normalized.setUTCHours(0, 0, 0, 0);
      dates.push(new Date(normalized));
    }

    if (dates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El rango de fechas es inválido' },
        { status: 400 }
      );
    }

    // Check each date for booking conflicts and existing blocks
    const datesToBlock: Date[] = [];
    const skippedDuplicates: string[] = [];
    let skippedNoRanges = 0;
    const conflicts: Array<{
      date: string;
      activeBookings: Array<{ patientName: string; startTime: string; endTime: string }>;
    }> = [];

    for (const dateObj of dates) {
      const dateKey = dateObj.toISOString().split('T')[0];

      // Check if any ranges exist for this date
      const rangeCount = await prisma.availabilityRange.count({
        where: { doctorId, date: dateObj },
      });
      if (rangeCount === 0) { skippedNoRanges++; continue; }

      // Check for existing identical blocked time
      const existing = await prisma.blockedTime.findFirst({
        where: {
          doctorId,
          date: dateObj,
          startTime: blockStartTime,
          endTime: blockEndTime,
        },
      });

      if (existing) {
        skippedDuplicates.push(dateKey);
        continue;
      }

      // Check for active bookings overlapping the block window
      const activeBookings = await prisma.booking.findMany({
        where: {
          doctorId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            {
              slotId: null,
              date: dateObj,
              startTime: { lt: blockEndTime },
              endTime: { gt: blockStartTime },
            },
            {
              slot: {
                date: dateObj,
                startTime: { lt: blockEndTime },
                endTime: { gt: blockStartTime },
              },
            },
          ],
        },
        select: { patientName: true, startTime: true, endTime: true },
      });

      if (activeBookings.length > 0) {
        conflicts.push({
          date: dateKey,
          activeBookings: activeBookings.map((b) => ({
            patientName: b.patientName,
            startTime: b.startTime ?? '',
            endTime: b.endTime ?? '',
          })),
        });
        // Still block the day — active bookings are protected at booking-creation level
        // and the availability calculator handles both overlays correctly.
      }

      datesToBlock.push(dateObj);
    }

    // Dry run — return preview
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        datesToBlock: datesToBlock.length,
        skippedDuplicates: skippedDuplicates.length,
        skippedNoRanges,
        conflicts: conflicts.length,
        conflictDetails: conflicts,
      });
    }

    // Execute — create BlockedTime records
    if (datesToBlock.length > 0) {
      await prisma.blockedTime.createMany({
        data: datesToBlock.map((dateObj) => ({
          doctorId,
          date: dateObj,
          startTime: blockStartTime,
          endTime: blockEndTime,
          reason: reason || null,
        })),
        skipDuplicates: true,
      });
    }

    // Log activity
    logActivity({
      doctorId,
      userId,
      actionType: 'RANGES_BLOCKED',
      entityType: 'APPOINTMENT',
      entityId: doctorId,
      displayMessage: `Bloqueado horario ${blockStartTime}–${blockEndTime} (${startDate} a ${endDate}): ${datesToBlock.length} día(s) bloqueado(s)${conflicts.length > 0 ? `, ${conflicts.length} con conflictos` : ''}`,
      icon: 'Ban',
      color: 'orange',
      metadata: {
        type: 'range_block',
        startDate,
        endDate,
        blockStartTime,
        blockEndTime,
        reason,
        datesBlocked: datesToBlock.length,
        conflicts: conflicts.length,
      },
    }).catch((err) => console.error('Activity log failed:', err));

    return NextResponse.json({
      success: true,
      datesBlocked: datesToBlock.length,
      skippedDuplicates: skippedDuplicates.length,
      skippedNoRanges,
      conflicts: conflicts.length,
      conflictDetails: conflicts,
    });
  } catch (error) {
    console.error('Error blocking time:', error);

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
      { success: false, error: 'Error al bloquear horario' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Unblock (remove BlockedTime records by IDs)
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un array de IDs a desbloquear' },
        { status: 400 }
      );
    }

    // Fetch the blocked times to verify ownership
    const blockedTimes = await prisma.blockedTime.findMany({
      where: { id: { in: ids } },
      select: { id: true, doctorId: true, date: true, startTime: true, endTime: true },
    });

    if (blockedTimes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron bloqueos con los IDs proporcionados' },
        { status: 404 }
      );
    }

    // Authorization: doctor can only unblock their own
    if (role === 'DOCTOR') {
      const unauthorized = blockedTimes.find((bt) => bt.doctorId !== authenticatedDoctorId);
      if (unauthorized) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Delete
    await prisma.blockedTime.deleteMany({
      where: { id: { in: blockedTimes.map((bt) => bt.id) } },
    });

    const doctorId = blockedTimes[0].doctorId;

    // Log activity
    logActivity({
      doctorId,
      userId,
      actionType: 'RANGES_UNBLOCKED',
      entityType: 'APPOINTMENT',
      entityId: doctorId,
      displayMessage: `Desbloqueados ${blockedTimes.length} horario(s)`,
      icon: 'CheckCircle',
      color: 'green',
      metadata: {
        type: 'range_unblock',
        count: blockedTimes.length,
        unblockedIds: blockedTimes.map((bt) => bt.id),
      },
    }).catch((err) => console.error('Activity log failed:', err));

    return NextResponse.json({
      success: true,
      unblocked: blockedTimes.length,
    });
  } catch (error) {
    console.error('Error unblocking time:', error);

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
      { success: false, error: 'Error al desbloquear horario' },
      { status: 500 }
    );
  }
}
