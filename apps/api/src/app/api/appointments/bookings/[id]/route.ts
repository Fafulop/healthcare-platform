// GET /api/appointments/bookings/[id] - Get booking by ID or confirmation code
// PATCH /api/appointments/bookings/[id] - Update booking status
// DELETE /api/appointments/bookings/[id] - Delete booking (and slot if instant)

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
import { createSlotEvent, updateSlotEvent, deleteEvent, resolveTokens } from '@/lib/google-calendar';

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

    const isTerminalStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(newStatus);
    const wasNotTerminal = !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(currentStatus);

    if (isTerminalStatus && wasNotTerminal) {
      // Cancel/complete/no-show: always just update the booking status.
      // - Freeform bookings (slotId = null): no slot to touch, done.
      // - Slot-based bookings: slot availability is computed live from bookings count, no counter to update.
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
        },
      });

      // Resolve date/time from slot (slot-based) or directly from booking (freeform)
      const bookingDateStr = currentBooking.slot
        ? currentBooking.slot.date.toISOString().split('T')[0]
        : currentBooking.date?.toISOString().split('T')[0] ?? '';
      const bookingStartTime = currentBooking.slot?.startTime ?? currentBooking.startTime ?? '';

      // Log activity
      const bookingLogParams = {
        doctorId: currentBooking.doctorId,
        bookingId: currentBooking.id,
        patientName: currentBooking.patientName,
        date: bookingDateStr,
        time: bookingStartTime,
        confirmationCode: currentBooking.confirmationCode ?? undefined,
      };
      if (newStatus === 'CANCELLED') logBookingCancelled(bookingLogParams);
      else if (newStatus === 'COMPLETED') logBookingCompleted(bookingLogParams);
      else if (newStatus === 'NO_SHOW') logBookingNoShow(bookingLogParams);

      // GCal sync — freeform bookings use booking.googleEventId; slot-based use slot.googleEventId
      const gcalEventId = currentBooking.slot?.googleEventId ?? currentBooking.googleEventId;

      if (newStatus === 'CANCELLED' && gcalEventId) {
        getCalendarTokens(currentBooking.doctorId).then(tokens => {
          if (!tokens) return;
          deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId)
            .catch((err) => console.error('[GCal sync] deleteEvent (booking CANCELLED):', err));
        }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CANCELLED):', err));
      }

      if ((newStatus === 'COMPLETED' || newStatus === 'NO_SHOW') && gcalEventId) {
        getCalendarTokens(currentBooking.doctorId).then(tokens => {
          if (!tokens) return;
          const slot = currentBooking.slot;
          updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId, {
            id: slot?.id ?? currentBooking.id,
            date: bookingDateStr,
            startTime: bookingStartTime,
            endTime: slot?.endTime ?? currentBooking.endTime ?? '',
            isOpen: slot?.isOpen ?? false,
            patientName: currentBooking.patientName,
            bookingStatus: newStatus as 'COMPLETED' | 'NO_SHOW',
            patientPhone: currentBooking.patientPhone,
            patientNotes: currentBooking.notes ?? undefined,
            finalPrice: slot ? slot.finalPrice.toNumber() : Number(currentBooking.finalPrice),
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

    // Sync to Google Calendar (fire-and-forget)
    // Regular slots have no event until confirmed — create one here if needed.
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

      const slotEventData = {
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
      };

      if (updatedBooking.slot.googleEventId) {
        // Event already exists (instant slot or legacy slot) — update it
        updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, updatedBooking.slot.googleEventId, slotEventData)
          .catch((err) => console.error('[GCal sync] updateSlotEvent (booking CONFIRMED):', err));
      } else {
        // No event yet (regular slot) — create one now and persist the ID
        const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slotEventData);
        await prisma.appointmentSlot.update({
          where: { id: updatedBooking.slot.id },
          data: { googleEventId: eventId },
        });
      }
    }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CONFIRMED):', err));

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

    const slot = booking.slot;
    // GCal event ID lives on the booking (freeform) or on the slot (slot-based)
    const gcalEventId = booking.googleEventId ?? slot?.googleEventId ?? null;

    // Delete the GCal event (fire-and-forget)
    if (gcalEventId) {
      getCalendarTokens(booking.doctorId).then(tokens => {
        if (!tokens) return;
        deleteEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, gcalEventId)
          .catch((err) => console.error('[GCal sync] deleteEvent (booking DELETE):', err));
      }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking DELETE):', err));
    }

    if (!booking.slotId) {
      // Freeform booking — just delete the record, nothing else to clean up.
      await prisma.booking.delete({ where: { id } });
    } else {
      // Slot-based booking — delete booking record; slot stays available.
      // Clear the stale GCal event ID from the slot if it had one.
      await prisma.$transaction([
        prisma.booking.delete({ where: { id } }),
        ...(slot?.googleEventId
          ? [prisma.appointmentSlot.update({ where: { id: booking.slotId }, data: { googleEventId: null } })]
          : []),
      ]);
    }

    return NextResponse.json({
      success: true,
      message: 'Cita eliminada exitosamente',
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}
