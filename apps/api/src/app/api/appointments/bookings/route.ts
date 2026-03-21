// POST /api/appointments/bookings - Create a new booking
// GET /api/appointments/bookings - Get bookings (for doctor or admin)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import {
  sendPatientSMS,
  sendDoctorSMS,
  isSMSEnabled,
} from '@/lib/sms';
import { sendNewBookingTelegram, isTelegramConfigured } from '@/lib/telegram';
import { validateAuthToken } from '@/lib/auth';
import { logBookingCreated } from '@/lib/activity-logger';
import { createSlotEvent, updateSlotEvent } from '@/lib/google-calendar';
import { getCalendarTokens, generateConfirmationCode, generateReviewToken } from '@/lib/appointments-utils';

// POST - Create a booking
export async function POST(request: Request) {
  try {
    // Optional auth — doctors/admins get auto-confirmed bookings, public gets PENDING.
    let callerRole: string | null = null;
    try {
      const auth = await validateAuthToken(request);
      callerRole = auth.role;
    } catch {}

    const body = await request.json();
    const {
      slotId,
      patientName,
      patientEmail,
      patientPhone,
      patientWhatsapp,
      notes,
      serviceId,
      isFirstTime,
      appointmentMode,
    } = body;

    // Validation
    if (!slotId || !patientName || !patientEmail || !patientPhone) {
      return NextResponse.json(
        {
          success: false,
          error: 'slotId, patientName, patientEmail, and patientPhone are required',
        },
        { status: 400 }
      );
    }

    // Pre-flight: verify slot exists and belongs to the right doctor (for service validation).
    // The critical availability check (isOpen, currentBookings) happens inside the transaction below.
    const slotForValidation = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
    });

    if (!slotForValidation) {
      return NextResponse.json(
        { success: false, error: 'Appointment slot not found' },
        { status: 404 }
      );
    }

    // Validate service selection
    const doctorServicesCount = await prisma.service.count({
      where: { doctorId: slotForValidation.doctorId },
    });

    if (doctorServicesCount > 0 && !serviceId) {
      return NextResponse.json(
        { success: false, error: 'Por favor selecciona un servicio para continuar' },
        { status: 400 }
      );
    }

    let serviceName: string | null = null;
    let servicePrice: number = 0;
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, doctorId: slotForValidation.doctorId },
      });
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'El servicio seleccionado no es válido' },
          { status: 400 }
        );
      }
      serviceName = service.serviceName;
      servicePrice = Number(service.price) || 0;
    }

    // Generate confirmation code and review token
    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    // Doctors/admins booking directly → CONFIRMED immediately (no pending review step).
    // Public portal bookings → PENDING until doctor confirms.
    const autoConfirm = callerRole === 'DOCTOR' || callerRole === 'ADMIN';
    const bookingStatus = autoConfirm ? 'CONFIRMED' : 'PENDING';

    // Create booking atomically: re-check availability INSIDE the transaction to prevent
    // race-condition double-booking (two concurrent requests seeing the same slot state).
    // The DB partial unique index on (slot_id) WHERE status is active is the final safety net.
    let booking: any;
    let slot: any;
    try {
      [booking, slot] = await prisma.$transaction(async (tx) => {
        const freshSlot = await tx.appointmentSlot.findUnique({ where: { id: slotId } });
        if (!freshSlot) throw Object.assign(new Error('SLOT_NOT_FOUND'), { bookingError: true });
        if (!freshSlot.isPublic) throw Object.assign(new Error('SLOT_CLOSED'), { bookingError: true });
        if (!freshSlot.isOpen) throw Object.assign(new Error('SLOT_CLOSED'), { bookingError: true });

        const b = await tx.booking.create({
          data: {
            slotId,
            doctorId: freshSlot.doctorId,
            patientName,
            patientEmail,
            patientPhone,
            patientWhatsapp,
            notes,
            serviceId: serviceId || null,
            serviceName,
            isFirstTime: isFirstTime ?? null,
            appointmentMode: appointmentMode || null,
            finalPrice: servicePrice,
            confirmationCode,
            reviewToken,
            status: bookingStatus,
            ...(autoConfirm && { confirmedAt: new Date() }),
          },
        });
        return [b, freshSlot];
      });
    } catch (txErr: any) {
      if (txErr?.bookingError) {
        const statusCode = txErr.message === 'SLOT_NOT_FOUND' ? 404 : 400;
        const msg = txErr.message === 'SLOT_NOT_FOUND'
          ? 'Appointment slot not found'
          : 'This slot is not available for booking';
        return NextResponse.json({ success: false, error: msg }, { status: statusCode });
      }
      // DB unique index violation = slot already has an active booking
      if ((txErr as any)?.code === 'P2002') {
        return NextResponse.json({ success: false, error: 'This slot is fully booked' }, { status: 400 });
      }
      throw txErr;
    }

    // Include slot details in response
    const bookingWithSlot = await prisma.booking.findUnique({
      where: { id: booking.id },
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
            clinicWhatsapp: true,
          },
        },
      },
    });

    // Sync to Google Calendar (fire-and-forget)
    getCalendarTokens(slot.doctorId).then(async tokens => {
      if (!tokens) return;
      const dateStr = slot.date.toISOString().split('T')[0];
      const slotEventData = {
        id: slot.id,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isOpen: slot.isOpen,
        patientName: autoConfirm ? patientName : `⏳ ${patientName}`,
        bookingStatus: bookingStatus as 'PENDING' | 'CONFIRMED',
        patientPhone: patientPhone,
        patientEmail: patientEmail,
        patientNotes: notes ?? undefined,
        finalPrice: Number(slot.finalPrice),
      };
      if (slot.googleEventId) {
        await updateSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slot.googleEventId, slotEventData);
      } else {
        // Create GCal event for any new booking (PENDING from public app or CONFIRMED from doctor)
        const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, slotEventData);
        await prisma.appointmentSlot.update({ where: { id: slot.id }, data: { googleEventId: eventId } });
      }
    }).catch((err) => console.error('[GCal sync] booking POST:', err));

    // Send SMS notifications (async, non-blocking)
    const smsEnabled = await isSMSEnabled();
    if (smsEnabled && bookingWithSlot?.slot) {
      const smsDetails = {
        patientName,
        patientPhone: patientPhone,
        doctorName: bookingWithSlot.doctor.doctorFullName,
        doctorPhone: bookingWithSlot.doctor.clinicPhone || undefined,
        date: bookingWithSlot.slot.date.toISOString(),
        startTime: bookingWithSlot.slot.startTime,
        endTime: bookingWithSlot.slot.endTime,
        duration: bookingWithSlot.slot.duration,
        finalPrice: Number(bookingWithSlot.finalPrice),
        confirmationCode,
        clinicAddress: (bookingWithSlot.slot?.location?.address ?? bookingWithSlot.doctor.clinicAddress) || undefined,
        specialty: bookingWithSlot.doctor.primarySpecialty || undefined,
        reviewToken,
      };

      // Send SMS to patient — CONFIRMED if doctor booked directly, PENDING if public portal.
      sendPatientSMS(smsDetails, bookingStatus as 'PENDING' | 'CONFIRMED').catch((error) =>
        console.error(`SMS patient notification (${bookingStatus}) failed:`, error)
      );

      // Send to doctor (don't await - let it run in background)
      sendDoctorSMS(smsDetails).catch((error) =>
        console.error('SMS doctor notification failed:', error)
      );

      // TODO: Send email to patient (future implementation)
      // sendPatientEmail(emailDetails, 'PENDING').catch(...)
    }

    // Send Telegram notification to doctor for PENDING bookings (from public portal)
    if (bookingStatus === 'PENDING' && isTelegramConfigured()) {
      prisma.doctor.findUnique({
        where: { id: slot.doctorId },
        select: { telegramChatId: true },
      }).then((doc) => {
        if (!doc?.telegramChatId) return;
        return sendNewBookingTelegram(doc.telegramChatId, {
          patientName,
          patientPhone,
          serviceName: serviceName ?? null,
          date: slot.date.toISOString(),
          startTime: slot.startTime,
          endTime: slot.endTime,
          confirmationCode,
        });
      }).catch((err) => console.error('Telegram notification failed:', err));
    }

    // Log activity (non-blocking)
    logBookingCreated({
      doctorId: slot.doctorId,
      bookingId: booking.id,
      patientName,
      patientEmail,
      patientPhone,
      date: slot.date.toISOString().split('T')[0],
      time: `${slot.startTime}-${slot.endTime}`,
      confirmationCode,
      finalPrice: servicePrice,
    });

    return NextResponse.json(
      {
        success: true,
        data: bookingWithSlot,
        message: 'Booking created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Get bookings (filtered by doctor or email)
export async function GET(request: Request) {
  try {
    // Authenticate user
    const { email, role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const { searchParams } = new URL(request.url);
    const requestedDoctorId = searchParams.get('doctorId');
    const patientEmail = searchParams.get('patientEmail');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    // Authorization scoping: doctors can only see their own bookings
    if (role === 'ADMIN') {
      // Admins can filter by doctorId if provided, otherwise see all
      if (requestedDoctorId) {
        where.doctorId = requestedDoctorId;
      }
    } else if (role === 'DOCTOR') {
      // Doctors can ONLY see their own bookings
      if (!authenticatedDoctorId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Doctor profile not found for this user',
          },
          { status: 403 }
        );
      }

      // Force scope to authenticated doctor's ID only
      where.doctorId = authenticatedDoctorId;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - only doctors and admins can view bookings',
        },
        { status: 403 }
      );
    }

    if (patientEmail) {
      where.patientEmail = patientEmail;
    }

    if (status) {
      where.status = status;
    }

    // Date range filter — covers both slot-based (slot.date) and freeform (booking.date) bookings.
    // Use OR so freeform bookings aren't dropped when slot is null.
    if (startDate || endDate) {
      const dateFilter: any = startDate && endDate
        ? { gte: new Date(startDate), lte: new Date(endDate) }
        : startDate
        ? { gte: new Date(startDate) }
        : { lte: new Date(endDate!) };

      where.OR = [
        { slot: { date: dateFilter } },
        { slotId: null, date: dateFilter },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where,
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
        formLink: {
          select: {
            id: true,
            token: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}
