// POST /api/appointments/range-bookings
// Creates a range-based booking (slotId = null, freeform date/startTime/endTime/duration).
// Public patients get PENDING; doctors/admins get auto-CONFIRMED.

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
import { createSlotEvent } from '@/lib/google-calendar';
import { getCalendarTokens, generateConfirmationCode, generateReviewToken } from '@/lib/appointments-utils';
import { sendBookingConfirmationEmail } from '@/lib/send-confirmation-email';
import { timeToMinutes, minutesToTime } from '@/lib/availability-calculator';

export async function POST(request: Request) {
  try {
    // Optional auth — doctors/admins get auto-confirmed, public gets PENDING
    let callerRole: string | null = null;
    try {
      const auth = await validateAuthToken(request);
      callerRole = auth.role;
    } catch {}

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

    // Required fields
    if (!doctorId || !date || !startTime || !serviceId || !patientName) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: doctorId, date, startTime, serviceId, patientName' },
        { status: 400 }
      );
    }

    const isDoctor = callerRole === 'DOCTOR' || callerRole === 'ADMIN';

    // Fetch doctor with field settings and buffer
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        doctorFullName: true,
        primarySpecialty: true,
        clinicAddress: true,
        clinicPhone: true,
        clinicWhatsapp: true,
        appointmentBufferMinutes: true,
        // Field requirement settings (public vs horarios)
        bookingPublicEmailRequired: true,
        bookingPublicPhoneRequired: true,
        bookingPublicWhatsappRequired: true,
        bookingHorariosEmailRequired: true,
        bookingHorariosPhoneRequired: true,
        bookingHorariosWhatsappRequired: true,
        // Telegram
        telegramChatId: true,
        telegramNotifyBooking: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor no encontrado' },
        { status: 404 }
      );
    }

    // Validate required contact fields based on caller role
    const emailRequired = isDoctor
      ? (doctor.bookingHorariosEmailRequired ?? true)
      : (doctor.bookingPublicEmailRequired ?? true);
    const phoneRequired = isDoctor
      ? (doctor.bookingHorariosPhoneRequired ?? true)
      : (doctor.bookingPublicPhoneRequired ?? true);
    const whatsappRequired = isDoctor
      ? (doctor.bookingHorariosWhatsappRequired ?? true)
      : (doctor.bookingPublicWhatsappRequired ?? true);

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

    // Validate service (must belong to doctor and be active)
    const service = await prisma.service.findFirst({
      where: { id: serviceId, doctorId, isBookingActive: true },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'El servicio seleccionado no es válido o no está activo' },
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

    const autoConfirm = callerRole === 'DOCTOR' || callerRole === 'ADMIN';
    const bookingStatus = autoConfirm ? 'CONFIRMED' : 'PENDING';

    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    // Atomic transaction: verify range exists, check overlap, create booking
    let booking: any;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // 1. Verify the requested time falls within an availability range for this doctor+date
        const matchingRange = await tx.availabilityRange.findFirst({
          where: {
            doctorId,
            date: bookingDate,
            startTime: { lte: normalizedStartTime },
            endTime: { gte: endTime },
          },
          select: { id: true, locationId: true },
        });

        if (!matchingRange) {
          throw Object.assign(new Error('NO_RANGE'), { bookingError: true });
        }

        // 2. For public bookings, enforce 1-hour cutoff (Mexico City TZ)
        if (!autoConfirm) {
          const nowMXStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
          const todayMX = nowMXStr.split(' ')[0];

          if (dateKey < todayMX) {
            throw Object.assign(new Error('SLOT_PAST'), { bookingError: true });
          }
          if (dateKey === todayMX) {
            const [h, m] = nowMXStr.split(' ')[1].slice(0, 5).split(':').map(Number);
            const cutoff = h * 60 + m + 60;
            const cutoffTime = cutoff >= 24 * 60
              ? '24:00'
              : `${String(Math.floor(cutoff / 60)).padStart(2, '0')}:${String(cutoff % 60).padStart(2, '0')}`;
            if (normalizedStartTime <= cutoffTime) {
              throw Object.assign(new Error('SLOT_TOO_SOON'), { bookingError: true });
            }
          }
        }

        // 3. Overlap check: no active bookings can overlap the requested time window.
        // Must consider extendedBlockMinutes — a booking may block time beyond its endTime.
        // Check both range-based (freeform) and legacy slot-based bookings.

        // 3a. Fetch all active bookings for this doctor+date
        const activeBookings = await tx.booking.findMany({
          where: {
            doctorId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            OR: [
              { slotId: null, date: bookingDate },
              { slot: { date: bookingDate } },
            ],
          },
          select: {
            startTime: true,
            endTime: true,
            extendedBlockMinutes: true,
            slot: { select: { startTime: true, endTime: true } },
          },
        });

        // 3b. Check each booking for overlap (considering extendedBlockMinutes)
        const newStartMin = timeToMinutes(normalizedStartTime);
        const newEndMin = timeToMinutes(endTime);

        for (const ab of activeBookings) {
          const abStart = ab.startTime ?? ab.slot?.startTime;
          const abEnd = ab.endTime ?? ab.slot?.endTime;
          if (!abStart || !abEnd) continue;

          const abStartMin = timeToMinutes(abStart);
          const abEndMin = timeToMinutes(abEnd);
          // Effective block end: max of endTime and startTime + extendedBlockMinutes
          const extendedEnd = ab.extendedBlockMinutes != null
            ? Math.max(abEndMin, abStartMin + ab.extendedBlockMinutes)
            : abEndMin;

          // Overlap: newStart < existingBlockEnd AND newEnd > existingStart
          if (newStartMin < extendedEnd && newEndMin > abStartMin) {
            throw Object.assign(
              new Error('TIME_OVERLAP'),
              { bookingError: true, overlapStart: abStart, overlapEnd: minutesToTime(extendedEnd) }
            );
          }
        }

        // 4. Create the booking (slotId = null → range-based freeform booking)
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
            status: bookingStatus,
            isRescheduled: isRescheduled === true,
            patientId: patientId || null,
            ...(autoConfirm && { confirmedAt: new Date() }),
          },
        });

        return b;
      });
    } catch (txErr: any) {
      if (txErr?.bookingError) {
        const msg =
          txErr.message === 'NO_RANGE'
            ? 'El horario seleccionado no está dentro de un rango de disponibilidad'
            : txErr.message === 'SLOT_PAST'
            ? 'Este horario ya pasó y no está disponible para reservar'
            : txErr.message === 'SLOT_TOO_SOON'
            ? 'Este horario ya no está disponible (menos de 1 hora de anticipación requerida)'
            : txErr.message === 'TIME_OVERLAP'
            ? `Este horario se traslapa con una cita existente (${txErr.overlapStart}–${txErr.overlapEnd}). Elige otro momento.`
            : 'Este horario no está disponible';
        const statusCode = txErr.message === 'NO_RANGE' ? 400 : txErr.message === 'TIME_OVERLAP' ? 409 : 400;
        return NextResponse.json({ success: false, error: msg }, { status: statusCode });
      }
      throw txErr;
    }

    // Fetch full booking with doctor details for response + SMS
    const bookingWithDoctor = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
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

    // Sync to Google Calendar (fire-and-forget).
    // Range-based bookings store googleEventId on the booking itself (not on a slot).
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
          patientName: autoConfirm ? patientName : `⏳ ${patientName}`,
          bookingStatus: bookingStatus as 'PENDING' | 'CONFIRMED',
          patientPhone,
          patientEmail,
          patientNotes: notes ?? undefined,
          finalPrice,
        }
      );
      await prisma.booking.update({
        where: { id: booking.id },
        data: { googleEventId: eventId },
      });
    }).catch((err) => console.error('[GCal sync] range-booking POST:', err))
    .finally(() => {
      if (autoConfirm) {
        sendBookingConfirmationEmail(booking.id).catch((err) =>
          console.error('[Email] auto-send confirmation (range-booking POST):', err)
        );
      }
    });

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

      sendPatientSMS(smsDetails, bookingStatus as 'PENDING' | 'CONFIRMED').catch((err) =>
        console.error(`SMS patient notification (range-booking ${bookingStatus}):`, err)
      );
      sendDoctorSMS(smsDetails).catch((err) =>
        console.error('SMS doctor notification (range-booking):', err)
      );
    }

    // Send Telegram notification for PENDING bookings (public portal)
    if (bookingStatus === 'PENDING' && isTelegramConfigured()) {
      if (doctor.telegramChatId && doctor.telegramNotifyBooking) {
        sendNewBookingTelegram(doctor.telegramChatId, {
          patientName,
          patientPhone,
          serviceName,
          date: bookingDate.toISOString(),
          startTime: normalizedStartTime,
          endTime,
          confirmationCode,
        }).catch((err) => console.error('Telegram notification (range-booking):', err));
      }
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

    return NextResponse.json(
      {
        success: true,
        message: autoConfirm ? 'Cita creada y confirmada exitosamente' : 'Reserva creada exitosamente',
        data: bookingWithDoctor,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating range-based booking:', error);

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
      { success: false, error: 'Error al crear la reserva' },
      { status: 500 }
    );
  }
}
