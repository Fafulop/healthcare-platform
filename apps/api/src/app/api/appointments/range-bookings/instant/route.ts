// POST /api/appointments/range-bookings/instant
// Doctor/admin creates a confirmed range-based booking (slotId = null).
// No range required — doctor can book outside their public availability ranges.
// Always CONFIRMED (no PENDING state).

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logBookingCreated } from '@/lib/activity-logger';
import { createSlotEvent } from '@/lib/google-calendar';
import { getCalendarTokens, generateConfirmationCode, generateReviewToken } from '@/lib/appointments-utils';
import { sendPatientSMS, sendDoctorSMS, isSMSEnabled } from '@/lib/sms';
import { sendBookingConfirmationEmail } from '@/lib/send-confirmation-email';
import { timeToMinutes, minutesToTime } from '@/lib/availability-calculator';

export async function POST(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const {
      doctorId,
      date,           // "YYYY-MM-DD"
      startTime,      // "HH:MM"
      serviceId,
      patientName,
      patientEmail,
      patientPhone,
      patientWhatsapp,
      notes,
      isFirstTime,
      appointmentMode,
      isRescheduled,
      patientId,
    } = body;

    if (!doctorId || !date || !startTime || !serviceId || !patientName) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: doctorId, date, startTime, serviceId, patientName' },
        { status: 400 }
      );
    }

    // Authorization: only the doctor themselves or an admin
    if (role === 'DOCTOR') {
      if (!authenticatedDoctorId || doctorId !== authenticatedDoctorId) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Fetch doctor with instant field settings
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        doctorFullName: true,
        primarySpecialty: true,
        clinicAddress: true,
        clinicPhone: true,
        bookingInstantEmailRequired: true,
        bookingInstantPhoneRequired: true,
        bookingInstantWhatsappRequired: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor no encontrado' },
        { status: 404 }
      );
    }

    // Validate required contact fields (instant flow settings)
    const emailRequired = doctor.bookingInstantEmailRequired ?? true;
    const phoneRequired = doctor.bookingInstantPhoneRequired ?? true;
    const whatsappRequired = doctor.bookingInstantWhatsappRequired ?? true;

    const missing = [
      emailRequired && !patientEmail ? 'patientEmail' : null,
      phoneRequired && !patientPhone ? 'patientPhone' : null,
      whatsappRequired && !patientWhatsapp ? 'patientWhatsapp' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Faltan campos requeridos: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate service (must belong to doctor)
    const service = await prisma.service.findFirst({
      where: { id: serviceId, doctorId },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'El servicio seleccionado no es válido' },
        { status: 400 }
      );
    }

    const serviceDuration = service.durationMinutes;
    const serviceName = service.serviceName;
    const finalPrice = Number(service.price) || 0;

    // Compute endTime from startTime + service duration
    const normalizedStartTime = startTime.length > 5 ? startTime.slice(0, 5) : startTime;
    const startMin = timeToMinutes(normalizedStartTime);
    const endMin = startMin + serviceDuration;
    const endTime = minutesToTime(endMin);

    // Normalize date to midnight UTC
    const bookingDate = new Date(date + 'T12:00:00Z');
    bookingDate.setUTCHours(0, 0, 0, 0);
    const dateKey = bookingDate.toISOString().split('T')[0];

    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    // Atomic transaction: overlap check + create booking.
    // No range check — doctor can book outside their public ranges.
    let booking: any;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Overlap check against both freeform and slot-based bookings
        const overlappingBooking = await tx.booking.findFirst({
          where: {
            doctorId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            OR: [
              // Range-based (freeform) bookings
              {
                slotId: null,
                date: bookingDate,
                startTime: { lt: endTime },
                endTime: { gt: normalizedStartTime },
              },
              // Legacy slot-based bookings
              {
                slot: {
                  date: bookingDate,
                  startTime: { lt: endTime },
                  endTime: { gt: normalizedStartTime },
                },
              },
            ],
          },
          select: { startTime: true, endTime: true, slot: { select: { startTime: true, endTime: true } } },
        });

        if (overlappingBooking) {
          const ovStart = overlappingBooking.startTime ?? overlappingBooking.slot?.startTime;
          const ovEnd = overlappingBooking.endTime ?? overlappingBooking.slot?.endTime;
          throw Object.assign(
            new Error('TIME_OVERLAP'),
            { bookingError: true, overlapStart: ovStart, overlapEnd: ovEnd }
          );
        }

        // Create booking (slotId = null → range-based freeform)
        const b = await tx.booking.create({
          data: {
            doctorId,
            slotId: null,
            date: bookingDate,
            startTime: normalizedStartTime,
            endTime,
            duration: serviceDuration,
            patientName,
            patientEmail,
            patientPhone,
            patientWhatsapp: patientWhatsapp || null,
            notes: notes || null,
            serviceId,
            serviceName,
            isFirstTime: isFirstTime ?? null,
            appointmentMode: appointmentMode || null,
            finalPrice,
            confirmationCode,
            reviewToken,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            isRescheduled: isRescheduled === true,
            patientId: patientId || null,
          },
        });

        return b;
      });
    } catch (txErr: any) {
      if (txErr?.bookingError) {
        return NextResponse.json(
          {
            success: false,
            error: `Este horario se traslapa con una cita existente (${txErr.overlapStart}–${txErr.overlapEnd}). Elige otro momento.`,
          },
          { status: 409 }
        );
      }
      throw txErr;
    }

    // Send SMS notifications (async, non-blocking)
    const smsEnabled = await isSMSEnabled();
    if (smsEnabled) {
      const smsDetails = {
        patientName,
        patientPhone,
        doctorName: doctor.doctorFullName,
        doctorPhone: doctor.clinicPhone || undefined,
        date: bookingDate.toISOString(),
        startTime: normalizedStartTime,
        endTime,
        duration: serviceDuration,
        finalPrice,
        confirmationCode,
        clinicAddress: doctor.clinicAddress || undefined,
        specialty: doctor.primarySpecialty || undefined,
        reviewToken,
      };

      sendPatientSMS(smsDetails, 'CONFIRMED').catch((err) =>
        console.error('SMS patient notification (range-instant):', err)
      );
      sendDoctorSMS(smsDetails).catch((err) =>
        console.error('SMS doctor notification (range-instant):', err)
      );
    }

    // Log activity (non-blocking)
    logBookingCreated({
      doctorId,
      bookingId: booking.id,
      patientName,
      patientEmail,
      patientPhone,
      date: dateKey,
      time: `${normalizedStartTime}-${endTime}`,
      confirmationCode,
      finalPrice,
    });

    // Sync to Google Calendar (fire-and-forget).
    // Confirmation email chained after GCal so googleEventId is persisted before ensureMeetLink (TELEMEDICINA).
    getCalendarTokens(doctorId).then(async (tokens) => {
      if (!tokens) return;
      const eventId = await createSlotEvent(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.calendarId,
        {
          id: booking.id,
          date: dateKey,
          startTime: normalizedStartTime,
          endTime,
          isOpen: false,
          patientName,
          bookingStatus: 'CONFIRMED',
          patientPhone,
          patientNotes: notes ?? undefined,
          finalPrice,
        }
      );
      await prisma.booking.update({
        where: { id: booking.id },
        data: { googleEventId: eventId },
      });
    }).catch((err) => console.error('[GCal sync] range-instant POST:', err))
    .finally(() => {
      // Always send confirmation email for instant bookings
      sendBookingConfirmationEmail(booking.id).catch((err) =>
        console.error('[Email] auto-send confirmation (range-instant POST):', err)
      );
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Cita creada y confirmada exitosamente',
        data: {
          id: booking.id,
          confirmationCode,
          bookingId: booking.id,
          date: dateKey,
          startTime: normalizedStartTime,
          endTime,
          duration: serviceDuration,
          finalPrice,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating range-based instant booking:', error);

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
      { success: false, error: 'Error al crear la cita' },
      { status: 500 }
    );
  }
}
