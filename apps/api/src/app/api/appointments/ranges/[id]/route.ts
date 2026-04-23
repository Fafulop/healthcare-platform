// GET    /api/appointments/ranges/[id] - Get a single availability range
// DELETE /api/appointments/ranges/[id] - Delete a range (blocks if active bookings exist)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';

// ---------------------------------------------------------------------------
// GET — Single range by ID
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);
    const { id } = await params;

    const range = await prisma.availabilityRange.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });

    if (!range) {
      return NextResponse.json(
        { success: false, error: 'Availability range not found' },
        { status: 404 }
      );
    }

    // Doctors can only see their own ranges
    if (role === 'DOCTOR' && range.doctorId !== authenticatedDoctorId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: range });
  } catch (error) {
    console.error('Error fetching availability range:', error);

    if (error instanceof Error && (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('authentication'))) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch availability range' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Remove a range (blocked if active bookings overlap)
// ---------------------------------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate
    const { role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    // Fetch the range
    const range = await prisma.availabilityRange.findUnique({
      where: { id },
      select: {
        id: true,
        doctorId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!range) {
      return NextResponse.json(
        { success: false, error: 'Availability range not found' },
        { status: 404 }
      );
    }

    // Authorization: doctors can only delete their own ranges
    if (role === 'DOCTOR') {
      if (range.doctorId !== authenticatedDoctorId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized — you can only delete your own ranges' },
          { status: 403 }
        );
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check for active bookings that overlap with this range's time window.
    // Active = PENDING or CONFIRMED (not cancelled/completed/no-show).
    // Check both range-based (slotId = null) and legacy slot-based bookings.
    const activeBookings = await prisma.booking.findMany({
      where: {
        doctorId: range.doctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          // Range-based bookings (freeform: slotId is null)
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
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar este rango porque tiene ${activeBookings.length} cita(s) activa(s). Cancela las citas primero.`,
          activeBookings: activeBookings.map((b) => ({
            id: b.id,
            patientName: b.patientName,
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        },
        { status: 409 }
      );
    }

    // Safe to delete
    await prisma.availabilityRange.delete({ where: { id } });

    // Log activity
    const dateKey = range.date.toISOString().split('T')[0];
    logActivity({
      doctorId: range.doctorId,
      userId,
      actionType: 'RANGE_DELETED',
      entityType: 'APPOINTMENT',
      entityId: id,
      displayMessage: `Eliminado rango de disponibilidad: ${range.startTime}–${range.endTime} (${dateKey})`,
      icon: 'Trash2',
      color: 'red',
      metadata: {
        type: 'availability_range',
        date: dateKey,
        startTime: range.startTime,
        endTime: range.endTime,
      },
    }).catch((err) => console.error('Activity log failed:', err));

    return NextResponse.json({
      success: true,
      message: 'Availability range deleted',
    });
  } catch (error) {
    console.error('Error deleting availability range:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete availability range' },
      { status: 500 }
    );
  }
}
