// GET /api/appointments/bookings/[id] - Get booking by ID or confirmation code
// PATCH /api/appointments/bookings/[id] - Update booking status
// DELETE /api/appointments/bookings/[id] - Delete booking and its slot

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { sendPatientSMS, isSMSEnabled } from '@/lib/sms';
import { validateAuthToken } from '@/lib/auth';
import {
  logBookingConfirmed,
  logBookingCancelled,
  logBookingCompleted,
  logBookingNoShow,
  logSlotDeleted,
} from '@/lib/activity-logger';
import { updateSlotEvent, deleteEvent, resolveTokens } from '@/lib/google-calendar';

async function getCalendarTokens(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      googleCalendarId: true,
      googleCalendarEnabled: true,
      user: {
        select: {
          id: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
        },
      },
    },
  });
  if (!doctor?.googleCalendarEnabled || !doctor.googleCalendarId || !doctor.user) return null;
  try {
    const { accessToken, refreshToken, updatedToken } = await resolveTokens(doctor.user);
    if (updatedToken) {
      await prisma.user.update({
        where: { id: doctor.user.id },
        data: { googleAccessToken: updatedToken.accessToken, googleTokenExpiry: updatedToken.expiresAt },
      });
    }
    return { accessToken, refreshToken, calendarId: doctor.googleCalendarId };
  } catch { return null; }
}

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

      // CANCELLED: revert event to "Disponible"
      if (newStatus === 'CANCELLED' && currentBooking.slot.googleEventId) {
        getCalendarTokens(currentBooking.doctorId).then(tokens => {
          if (!tokens) return;
          const dateStr = currentBooking.slot.date.toISOString().split('T')[0];
          updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, currentBooking.slot.googleEventId!, {
            id: currentBooking.slot.id,
            date: dateStr,
            startTime: currentBooking.slot.startTime,
            endTime: currentBooking.slot.endTime,
            isOpen: currentBooking.slot.isOpen,
            patientName: undefined,
            finalPrice: currentBooking.slot.finalPrice.toNumber(),
          }).catch((err) => console.error('[GCal sync] updateSlotEvent (booking CANCELLED):', err));
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CANCELLED):', err));
      }

      // COMPLETED: "✓ Cita: Patient" (basil green) — keeps history of completed visit
      // NO_SHOW:   "✗ Cita: Patient" (graphite)    — marks patient did not appear
      if ((newStatus === 'COMPLETED' || newStatus === 'NO_SHOW') && currentBooking.slot.googleEventId) {
        getCalendarTokens(currentBooking.doctorId).then(tokens => {
          if (!tokens) return;
          const dateStr = currentBooking.slot.date.toISOString().split('T')[0];
          updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, currentBooking.slot.googleEventId!, {
            id: currentBooking.slot.id,
            date: dateStr,
            startTime: currentBooking.slot.startTime,
            endTime: currentBooking.slot.endTime,
            isOpen: currentBooking.slot.isOpen,
            patientName: currentBooking.patientName,
            bookingStatus: newStatus as 'COMPLETED' | 'NO_SHOW',
            patientPhone: currentBooking.patientPhone,
            patientNotes: currentBooking.notes ?? undefined,
            finalPrice: currentBooking.slot.finalPrice.toNumber(),
          }).catch((err) => console.error('[GCal sync] updateSlotEvent (booking COMPLETED/NO_SHOW):', err));
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking COMPLETED/NO_SHOW):', err));
      }

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

    // Sync slot event title to Google Calendar (fire-and-forget)
    if (updatedBooking.slot.googleEventId) {
      getCalendarTokens(currentBooking.doctorId).then(async tokens => {
        if (!tokens) return;
        const dateStr = updatedBooking.slot.date.toISOString().split('T')[0];

        // When confirming, check if any active tasks overlap this slot's time
        let conflictNote: string | undefined;
        if (newStatus === 'CONFIRMED') {
          const dayTasks = await prisma.task.findMany({
            where: {
              doctorId: currentBooking.doctorId,
              dueDate: updatedBooking.slot.date,
              status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
            },
            select: { title: true, startTime: true, endTime: true },
          });
          const hit = dayTasks.find(t =>
            t.startTime && t.endTime &&
            t.startTime < updatedBooking.slot.endTime &&
            t.endTime > updatedBooking.slot.startTime
          );
          if (hit) {
            conflictNote = `⚠️ Conflicto: pendiente "${hit.title}"${hit.startTime ? ` a las ${hit.startTime}` : ''}`;
          }
        }

        updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, updatedBooking.slot.googleEventId!, {
          id: updatedBooking.slot.id,
          date: dateStr,
          startTime: updatedBooking.slot.startTime,
          endTime: updatedBooking.slot.endTime,
          isOpen: updatedBooking.slot.isOpen,
          patientName: newStatus === 'CONFIRMED' ? updatedBooking.patientName : undefined,
          bookingStatus: newStatus as 'CONFIRMED' | 'PENDING',
          patientPhone: newStatus === 'CONFIRMED' ? updatedBooking.patientPhone : undefined,
          patientNotes: newStatus === 'CONFIRMED' ? (updatedBooking.notes ?? undefined) : undefined,
          conflictNote,
          finalPrice: updatedBooking.slot.finalPrice.toNumber(),
        }).catch((err) => console.error('[GCal sync] updateSlotEvent (booking CONFIRMED):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CONFIRMED):', err));
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

// DELETE - Delete booking and its associated slot
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Doctors can only delete their own bookings
    if (role === 'DOCTOR' && booking.doctorId !== authenticatedDoctorId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const slotId = booking.slotId;
    const slot = booking.slot;

    // Sync deletion to Google Calendar before removing from DB (fire-and-forget)
    if (slot.googleEventId) {
      getCalendarTokens(slot.doctorId).then(tokens => {
        if (!tokens) return;
        deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId!).catch((err) => console.error('[GCal sync] deleteEvent (booking DELETE):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking DELETE):', err));
    }

    // Delete booking and slot in a single transaction
    await prisma.$transaction([
      prisma.booking.delete({ where: { id } }),
      prisma.appointmentSlot.delete({ where: { id: slotId } }),
    ]);

    // Log slot deletion
    logSlotDeleted({
      doctorId: slot.doctorId,
      slotId: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: slot.date.toISOString().split('T')[0],
    });

    return NextResponse.json({
      success: true,
      message: 'Cita y horario eliminados exitosamente',
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}
