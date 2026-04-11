// GET /api/appointments/bookings/[id] - Get booking by ID or confirmation code
// PATCH /api/appointments/bookings/[id] - Update booking status
// DELETE /api/appointments/bookings/[id] - Delete booking record

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { sendPatientSMS, isSMSEnabled } from '@/lib/sms';
import { validateAuthToken } from '@/lib/auth';
import {
  logBookingConfirmed,
  logBookingCancelled,
  logBookingCompleted,
  logBookingNoShow,
} from '@/lib/activity-logger';
import { createSlotEvent, updateSlotEvent, deleteEvent, resolveTokens } from '@/lib/google-calendar';
import { getCalendarTokens } from '@/lib/appointments-utils';
import { sendAppointmentCancellationEmail } from '@/lib/gmail';
import { sendBookingConfirmationEmail } from '@/lib/send-confirmation-email';

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

// PATCH - Update booking status OR extendedBlockMinutes OR patientId
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status: newStatus, extendedBlockMinutes, patientId, confirmationCode: bodyConfirmationCode } = body;

    // ── Patient link update (no status change, no block change) ───────────────
    if (patientId !== undefined && newStatus === undefined && extendedBlockMinutes === undefined) {
      const auth = await validateAuthToken(request);
      const { role: callerRole, doctorId: callerDoctorId } = auth;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
      }
      if (callerRole === 'DOCTOR' && booking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      // If linking (not unlinking), verify patient belongs to this doctor
      if (patientId !== null) {
        const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { doctorId: true } });
        if (!patient) {
          return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
        }
        if (patient.doctorId !== booking.doctorId) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { patientId: patientId ?? null },
        select: { id: true, patientId: true },
      });

      // Propagate patientId to any existing formLink for this booking (fire-and-forget)
      prisma.appointmentFormLink.updateMany({
        where: { bookingId: id },
        data: { patientId: patientId ?? null },
      }).catch((err) => console.error('[formLink] patientId propagation failed:', err));

      return NextResponse.json({ success: true, data: updated });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Extended block update (no status change) ──────────────────────────────
    if (extendedBlockMinutes !== undefined && newStatus === undefined) {
      const auth = await validateAuthToken(request);
      const { role: callerRole, doctorId: callerDoctorId } = auth;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
      }
      if (callerRole === 'DOCTOR' && booking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
        return NextResponse.json(
          { success: false, error: 'Solo se puede modificar el bloqueo en citas activas' },
          { status: 400 }
        );
      }

      const value = extendedBlockMinutes === null ? null : Number(extendedBlockMinutes);
      if (value !== null && (isNaN(value) || value <= 0)) {
        return NextResponse.json({ success: false, error: 'Valor de bloqueo inválido' }, { status: 400 });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { extendedBlockMinutes: value },
      });
      return NextResponse.json({ success: true, data: updated });
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    // Try to authenticate. Doctors/admins can perform any valid transition.
    // Unauthenticated requests (patient self-cancellation) are only allowed for CANCELLED
    // status and must include the matching confirmationCode as proof of ownership.
    let callerRole: string | null = null;
    let callerDoctorId: string | null = null;
    try {
      const auth = await validateAuthToken(request);
      callerRole = auth.role;
      callerDoctorId = auth.doctorId;
    } catch {}

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

    // Authorization
    if (!callerRole) {
      // Unauthenticated — only patient self-cancellation allowed, requires confirmationCode
      if (newStatus !== 'CANCELLED') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      if (!bodyConfirmationCode || bodyConfirmationCode !== currentBooking.confirmationCode) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    } else if (callerRole === 'DOCTOR') {
      if (currentBooking.doctorId !== callerDoctorId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (callerRole !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const currentStatus = currentBooking.status;

    // Validate state transition
    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Transición no permitida: no se puede cambiar de ${currentStatus} a ${newStatus}`,
        },
        { status: 400 }
      );
    }

    const isTerminalStatus = ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(newStatus);
    const wasNotTerminal = !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(currentStatus);

    if (isTerminalStatus && wasNotTerminal) {
      // Cancel/complete/no-show: update booking status.
      // Gap A: if the booking was on a private slot (isPublic: false), clean up the now-orphaned slot.
      // We null out slotId first to prevent the cascade FK from deleting this booking record,
      // then delete the slot. This preserves the booking history (CANCELLED record stays).
      const isPrivateSlot = currentBooking.slot?.isPublic === false;

      let updatedBooking: any;
      if (isPrivateSlot) {
        // Private slot cleanup: null out slotId first to prevent cascade from deleting this booking,
        // then delete the now-orphaned slot. Applies to all terminal states (CANCELLED, COMPLETED, NO_SHOW).
        [updatedBooking] = await prisma.$transaction([
          prisma.booking.update({
            where: { id },
            data: {
              status: newStatus,
              slotId: null,
              ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
            },
          }),
          prisma.appointmentSlot.delete({ where: { id: currentBooking.slot!.id } }),
        ]);
      } else {
        // COMPLETED or NO_SHOW on a public slot: close the slot so it stops appearing in availability.
        // CANCELLED on a public slot: leave isOpen as-is so other patients can still book it.
        if ((newStatus === 'COMPLETED' || newStatus === 'NO_SHOW') && currentBooking.slotId) {
          [updatedBooking] = await prisma.$transaction([
            prisma.booking.update({
              where: { id },
              data: { status: newStatus },
            }),
            prisma.appointmentSlot.update({
              where: { id: currentBooking.slotId },
              data: { isOpen: false },
            }),
          ]);
        } else {
          updatedBooking = await prisma.booking.update({
            where: { id },
            data: {
              status: newStatus,
              ...(newStatus === 'CANCELLED' && { cancelledAt: new Date() }),
            },
          });
        }
      }

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

      // Send cancellation email to patient (fire-and-forget)
      if (newStatus === 'CANCELLED' && currentBooking.patientEmail) {
        (async () => {
          try {
            const doctor = await prisma.doctor.findUnique({
              where: { id: currentBooking.doctorId },
              select: {
                doctorFullName: true,
                primarySpecialty: true,
                clinicPhone: true,
                clinicAddress: true,
                user: {
                  select: {
                    email: true,
                    googleAccessToken: true,
                    googleRefreshToken: true,
                    googleTokenExpiry: true,
                  },
                },
              },
            });
            if (!doctor?.user?.googleAccessToken || !doctor.user.email) {
              console.warn('[Email] cancellation email skipped — doctor has no Google tokens for booking', id);
              return;
            }
            const { accessToken, refreshToken } = await resolveTokens(doctor.user);
            await sendAppointmentCancellationEmail(
              {
                patientName: currentBooking.patientName,
                patientEmail: currentBooking.patientEmail,
                doctorName: doctor.doctorFullName,
                specialty: doctor.primarySpecialty,
                date: bookingDateStr,
                startTime: bookingStartTime,
                endTime: currentBooking.slot?.endTime ?? currentBooking.endTime ?? '',
                clinicPhone: doctor.clinicPhone,
                clinicAddress: doctor.clinicAddress,
              },
              accessToken,
              refreshToken,
              doctor.doctorFullName,
              doctor.user.email
            );
          } catch (err) {
            console.error('[Email] sendCancellationEmail failed:', err);
          }
        })();
      }

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
        slot: {
          include: { location: { select: { address: true } } },
        },
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

    // Freeform bookings (slotId=null) are always created as CONFIRMED — they can never be PENDING.
    // If somehow slot is null here, skip the slot-dependent SMS/GCal work and return early.
    const slot = updatedBooking.slot;
    if (!slot) {
      return NextResponse.json({ success: true, data: updatedBooking, message: 'Booking status updated' });
    }

    // Send confirmation SMS when status changes to CONFIRMED
    const smsEnabled = await isSMSEnabled();
    if (newStatus === 'CONFIRMED' && smsEnabled) {
      const smsDetails = {
        patientName: updatedBooking.patientName,
        patientPhone: updatedBooking.patientPhone,
        doctorName: updatedBooking.doctor.doctorFullName,
        doctorPhone: updatedBooking.doctor.clinicPhone || undefined,
        date: slot.date.toISOString(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        finalPrice: Number(updatedBooking.finalPrice),
        confirmationCode: updatedBooking.confirmationCode ?? '',
        clinicAddress: (slot.location?.address ?? updatedBooking.doctor.clinicAddress) || undefined,
        specialty: updatedBooking.doctor.primarySpecialty || undefined,
        reviewToken: updatedBooking.reviewToken || undefined,
      };

      // Send CONFIRMED SMS to patient
      sendPatientSMS(smsDetails, 'CONFIRMED').catch((error) =>
        console.error('SMS confirmation notification failed:', error)
      );

    }

    // Log activity for non-terminal status changes
    if (newStatus === 'CONFIRMED') {
      logBookingConfirmed({
        doctorId: currentBooking.doctorId,
        bookingId: currentBooking.id,
        patientName: currentBooking.patientName,
        date: slot.date.toISOString().split('T')[0],
        time: slot.startTime,
        confirmationCode: updatedBooking.confirmationCode ?? undefined,
      });
    }

    // Sync to Google Calendar (fire-and-forget), then auto-send confirmation email.
    // Email is chained after GCal sync so slot.googleEventId is persisted before
    // ensureMeetLink runs — prevents duplicate calendar events for TELEMEDICINA.
    getCalendarTokens(currentBooking.doctorId).then(async tokens => {
      if (!tokens) return;
      const dateStr = slot.date.toISOString().split('T')[0];

      // When confirming, check if any active tasks overlap this slot's time
      let conflictNote: string | undefined;
      if (newStatus === 'CONFIRMED') {
        const dayTasks = await prisma.task.findMany({
          where: {
            doctorId: currentBooking.doctorId,
            dueDate: slot.date,
            status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
          },
          select: { title: true, startTime: true, endTime: true },
        });
        const hit = dayTasks.find(t =>
          t.startTime && t.endTime &&
          t.startTime < slot.endTime &&
          t.endTime > slot.startTime
        );
        if (hit) {
          conflictNote = `⚠️ Conflicto: pendiente "${hit.title}"${hit.startTime ? ` a las ${hit.startTime}` : ''}`;
        }
      }

      const slotEventData = {
        id: slot.id,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isOpen: slot.isOpen,
        patientName: newStatus === 'CONFIRMED' ? updatedBooking.patientName : undefined,
        bookingStatus: newStatus as 'CONFIRMED' | 'PENDING',
        patientPhone: newStatus === 'CONFIRMED' ? updatedBooking.patientPhone : undefined,
        patientNotes: newStatus === 'CONFIRMED' ? (updatedBooking.notes ?? undefined) : undefined,
        conflictNote,
        finalPrice: slot.finalPrice.toNumber(),
      };

      if (slot.googleEventId) {
        // Event already exists — update it
        updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId, slotEventData)
          .catch((err) => console.error('[GCal sync] updateSlotEvent (booking CONFIRMED):', err));
      } else {
        // No event yet (regular slot) — create one now and persist the ID
        const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slotEventData);
        await prisma.appointmentSlot.update({
          where: { id: slot.id },
          data: { googleEventId: eventId },
        });
      }
    }).catch((err) => console.error('[GCal sync] getCalendarTokens (booking CONFIRMED):', err))
    .finally(() => {
      // Auto-send confirmation email after GCal sync (outside smsEnabled — always fires)
      if (newStatus === 'CONFIRMED') {
        sendBookingConfirmationEmail(updatedBooking.id).catch((err) =>
          console.error('[Email] auto-send confirmation (PATCH CONFIRMED):', err)
        );
      }
    });

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
      // Freeform booking (legacy) — just delete the record, nothing else to clean up.
      await prisma.booking.delete({ where: { id } });
    } else if (slot?.isPublic === false) {
      // Gap A: private slot — delete booking first (satisfies FK), then delete the now-orphaned slot.
      await prisma.$transaction([
        prisma.booking.delete({ where: { id } }),
        prisma.appointmentSlot.delete({ where: { id: slot.id } }),
      ]);
    } else {
      // Regular public slot — delete booking record; slot stays available for new bookings.
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
