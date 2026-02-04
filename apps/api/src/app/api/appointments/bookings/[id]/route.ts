// GET /api/appointments/bookings/[id] - Get booking by ID or confirmation code
// PATCH /api/appointments/bookings/[id] - Update booking status

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { sendPatientSMS, isSMSEnabled } from '@/lib/sms';
import {
  logBookingConfirmed,
  logBookingCancelled,
  logBookingCompleted,
  logBookingNoShow,
} from '@/lib/activity-logger';

// Booking state machine transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  CANCELLED: [], // Terminal state
  COMPLETED: [], // Terminal state
  NO_SHOW: [], // Terminal state
};

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
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get current booking with slot
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

    const currentStatus = currentBooking.status;

    // Validate state transition
    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid transition: cannot go from ${currentStatus} to ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // Terminal statuses: only CANCELLED frees up the slot
    const isTerminalStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(newStatus);
    const wasNotTerminal = !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(currentStatus);

    if (isTerminalStatus && wasNotTerminal) {
      // Only free up the slot when CANCELLED (patient won't come).
      // COMPLETED and NO_SHOW keep the slot occupied — the time was used/reserved.
      const shouldFreeSlot = newStatus === 'CANCELLED';

      const transactionOps = [
        prisma.booking.update({
          where: { id },
          data: {
            status: newStatus,
            ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
          },
        }),
        ...(shouldFreeSlot
          ? [
              prisma.appointmentSlot.update({
                where: { id: currentBooking.slotId },
                data: {
                  currentBookings: { decrement: 1 },
                },
              }),
            ]
          : []),
      ];

      const [updatedBooking] = await prisma.$transaction(transactionOps);

      // Log activity
      const slotDateTerminal = currentBooking.slot.date.toISOString().split('T')[0];
      const bookingLogParams = {
        doctorId: currentBooking.doctorId,
        bookingId: currentBooking.id,
        patientName: currentBooking.patientName,
        date: slotDateTerminal,
        time: currentBooking.slot.startTime,
        confirmationCode: currentBooking.confirmationCode ?? undefined,
      };
      if (newStatus === 'CANCELLED') logBookingCancelled(bookingLogParams);
      else if (newStatus === 'COMPLETED') logBookingCompleted(bookingLogParams);
      else if (newStatus === 'NO_SHOW') logBookingNoShow(bookingLogParams);

      const statusMessages = {
        CANCELLED: 'Booking cancelled successfully',
        COMPLETED: 'Booking marked as completed',
        NO_SHOW: 'Booking marked as no-show',
      };

      return NextResponse.json({
        success: true,
        data: updatedBooking,
        message: statusMessages[newStatus as keyof typeof statusMessages],
      });
    }

    // Non-terminal status updates (PENDING → CONFIRMED)
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: newStatus,
        ...(newStatus === 'CONFIRMED' && { confirmedAt: new Date() }),
      },
      include: {
        slot: true,
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            clinicAddress: true,
            clinicPhone: true,
          },
        },
      },
    });

    // Send confirmation SMS when status changes to CONFIRMED
    const smsEnabled = await isSMSEnabled();
    if (newStatus === 'CONFIRMED' && smsEnabled) {
      const smsDetails = {
        patientName: updatedBooking.patientName,
        patientPhone: updatedBooking.patientPhone,
        doctorName: updatedBooking.doctor.doctorFullName,
        doctorPhone: updatedBooking.doctor.clinicPhone || undefined,
        date: updatedBooking.slot.date.toISOString(),
        startTime: updatedBooking.slot.startTime,
        endTime: updatedBooking.slot.endTime,
        duration: updatedBooking.slot.duration,
        finalPrice: Number(updatedBooking.finalPrice),
        confirmationCode: updatedBooking.confirmationCode ?? '',
        clinicAddress: updatedBooking.doctor.clinicAddress || undefined,
        specialty: updatedBooking.doctor.primarySpecialty || undefined,
        reviewToken: updatedBooking.reviewToken || undefined,
      };

      // Send CONFIRMED SMS to patient
      sendPatientSMS(smsDetails, 'CONFIRMED').catch((error) =>
        console.error('SMS confirmation notification failed:', error)
      );

      // TODO: Send confirmation email to patient (future implementation)
      // sendPatientEmail(emailDetails, 'CONFIRMED').catch(...)
    }

    // Log activity for non-terminal status changes
    if (newStatus === 'CONFIRMED') {
      logBookingConfirmed({
        doctorId: currentBooking.doctorId,
        bookingId: currentBooking.id,
        patientName: currentBooking.patientName,
        date: updatedBooking.slot.date.toISOString().split('T')[0],
        time: updatedBooking.slot.startTime,
        confirmationCode: updatedBooking.confirmationCode ?? undefined,
      });
    }

    const statusMessages: Record<string, string> = {
      CONFIRMED: 'Booking confirmed successfully',
      PENDING: 'Booking reverted to pending',
    };

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: statusMessages[newStatus] || 'Booking status updated',
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
