// DELETE /api/appointments/ranges/bulk
// Bulk-delete availability ranges across a date range, protecting ranges with active bookings.
// Supports dryRun for preview before execution.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';

export async function DELETE(request: Request) {
  try {
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const { doctorId, startDate, endDate, startTime, endTime, dryRun = true } = body;

    if (!doctorId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: doctorId, startDate, endDate' },
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

    // Build date filter
    const dateStart = new Date(startDate + 'T00:00:00Z');
    const dateEnd = new Date(endDate + 'T23:59:59.999Z');

    // Fetch matching ranges
    const ranges = await prisma.availabilityRange.findMany({
      where: {
        doctorId,
        date: { gte: dateStart, lte: dateEnd },
        // Optional time filters
        ...(startTime ? { startTime: { gte: startTime } } : {}),
        ...(endTime ? { endTime: { lte: endTime } } : {}),
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    if (ranges.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        protected: 0,
        protectedRanges: [],
        message: 'No se encontraron rangos en el período seleccionado',
      });
    }

    // For each range, check for active bookings overlapping it
    const deletable: typeof ranges = [];
    const protectedRanges: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      activeBookings: Array<{ id: string; patientName: string; startTime: string; endTime: string }>;
    }> = [];

    for (const range of ranges) {
      const activeBookings = await prisma.booking.findMany({
        where: {
          doctorId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            // Range-based bookings (freeform)
            {
              slotId: null,
              date: range.date,
              startTime: { lt: range.endTime },
              endTime: { gt: range.startTime },
            },
            // Legacy slot-based bookings
            {
              slot: {
                date: range.date,
                startTime: { lt: range.endTime },
                endTime: { gt: range.startTime },
              },
            },
          ],
        },
        select: { id: true, patientName: true, startTime: true, endTime: true },
      });

      if (activeBookings.length > 0) {
        protectedRanges.push({
          id: range.id,
          date: range.date.toISOString().split('T')[0],
          startTime: range.startTime,
          endTime: range.endTime,
          activeBookings: activeBookings.map((b) => ({
            id: b.id,
            patientName: b.patientName,
            startTime: b.startTime ?? '',
            endTime: b.endTime ?? '',
          })),
        });
      } else {
        deletable.push(range);
      }
    }

    // Dry run — return preview only
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        deleted: deletable.length,
        protected: protectedRanges.length,
        protectedRanges,
      });
    }

    // Execute deletion
    if (deletable.length > 0) {
      await prisma.availabilityRange.deleteMany({
        where: { id: { in: deletable.map((r) => r.id) } },
      });
    }

    // Log activity
    logActivity({
      doctorId,
      userId,
      actionType: 'RANGES_BULK_DELETED',
      entityType: 'APPOINTMENT',
      entityId: doctorId,
      displayMessage: `Eliminados ${deletable.length} rango(s) de disponibilidad (${startDate} a ${endDate})${protectedRanges.length > 0 ? `. ${protectedRanges.length} protegido(s) por citas activas.` : ''}`,
      icon: 'Trash2',
      color: 'red',
      metadata: {
        type: 'bulk_range_delete',
        startDate,
        endDate,
        deleted: deletable.length,
        protected: protectedRanges.length,
      },
    }).catch((err) => console.error('Activity log failed:', err));

    return NextResponse.json({
      success: true,
      deleted: deletable.length,
      protected: protectedRanges.length,
      protectedRanges,
    });
  } catch (error) {
    console.error('Error bulk-deleting ranges:', error);

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
      { success: false, error: 'Error al eliminar rangos' },
      { status: 500 }
    );
  }
}
