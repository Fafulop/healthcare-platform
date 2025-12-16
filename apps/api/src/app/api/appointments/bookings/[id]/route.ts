// GET /api/appointments/bookings/[id] - Get booking by ID or confirmation code
// PATCH /api/appointments/bookings/[id] - Update booking status

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

// GET - Get booking by ID or confirmation code
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find by ID first, then by confirmation code
    let booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: true,
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            clinicAddress: true,
            clinicPhone: true,
            clinicWhatsapp: true,
          },
        },
      },
    });

    if (!booking) {
      // Try by confirmation code
      booking = await prisma.booking.findUnique({
        where: { confirmationCode: id },
        include: {
          slot: true,
          doctor: {
            select: {
              doctorFullName: true,
              primarySpecialty: true,
              clinicAddress: true,
              clinicPhone: true,
              clinicWhatsapp: true,
            },
          },
        },
      });
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch booking',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update booking status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get current booking
    const currentBooking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!currentBooking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Handle cancellation - free up the slot
    if (status === 'CANCELLED' && currentBooking.status !== 'CANCELLED') {
      const [updatedBooking, updatedSlot] = await prisma.$transaction([
        prisma.booking.update({
          where: { id },
          data: {
            status,
            cancelledAt: new Date(),
          },
        }),
        prisma.appointmentSlot.update({
          where: { id: currentBooking.slotId },
          data: {
            currentBookings: { decrement: 1 },
            status: 'AVAILABLE', // Make slot available again
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: updatedBooking,
        message: 'Booking cancelled successfully',
      });
    }

    // Handle confirmation
    if (status === 'CONFIRMED' && currentBooking.status === 'PENDING') {
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status,
          confirmedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedBooking,
        message: 'Booking confirmed successfully',
      });
    }

    // Regular status update
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update booking status',
      },
      { status: 500 }
    );
  }
}
