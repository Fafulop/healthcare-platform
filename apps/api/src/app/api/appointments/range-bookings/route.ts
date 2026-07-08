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
import { lockBookingDay, findBookingOverlap } from '@/lib/booking-overlap';
import { validatePatientLink, patientLinkGoneResponse } from '@/lib/patient-link';

export async function POST(request: Request) {
  try {
    // Optional auth — doctors/admins get auto-confirmed, public gets PENDING
    let callerRole: string | null = null;
    let callerDoctorId: string | null = null;
    try {
      const auth = await validateAuthToken(request);
      callerRole = auth.role;
      callerDoctorId = auth.doctorId ?? null;
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

    // Doctors can only create bookings on their own agenda (admins can book for anyone;
    // unauthenticated/public callers get PENDING and are allowed for any doctor).
    if (callerRole === 'DOCTOR' && callerDoctorId !== doctorId) {
      return NextResponse.json(
        { success: false, error: 'No autorizado — solo puedes crear citas en tu propia agenda' },
        { status: 403 }
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

    // A provided patientId must reference a patient of this same doctor
    // (public callers get a uniform 404 — no existence/ownership oracle)
    const patientLinkError = await validatePatientLink(patientId, doctorId, !!callerRole);
    if (patientLinkError) {
      return NextResponse.json(
        { success: false, error: patientLinkError.error },
        { status: patientLinkError.status }
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

    const bufferMinutes = doctor.appointmentBufferMinutes ?? 0;

    // Atomic transaction: verify range exists, check overlap, create booking
    let booking: any;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Serialize concurrent booking writes for this doctor+date (see booking-overlap.ts)
        await lockBookingDay(tx, doctorId, dateKey);

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

        // 3. Overlap check: no active booking (freeform or legacy slot-based) may overlap
        // the requested window, including extendedBlockMinutes and the doctor's buffer —
        // the same blocked window calculateAvailability uses (see booking-overlap.ts).
        const conflict = await findBookingOverlap(tx, {
          doctorId,
          date: bookingDate,
          startTime: normalizedStartTime,
          endTime,
          bufferMinutes,
        });

        if (conflict) {
          throw Object.assign(
            new Error('TIME_OVERLAP'),
            { bookingError: true, overlapStart: conflict.startTime, overlapEnd: conflict.blockEndTime }
          );
        }

        // 3c. Check blocked times — the requested slot must not overlap any BlockedTime
        const blockedTimes = await tx.blockedTime.findMany({
          where: {
            doctorId,
            date: bookingDate,
            startTime: { lt: endTime },
            endTime: { gt: normalizedStartTime },
          },
          select: { startTime: true, endTime: true },
        });

        if (blockedTimes.length > 0) {
          throw Object.assign(
            new Error('TIME_BLOCKED'),
            { bookingError: true, blockedStart: blockedTimes[0].startTime, blockedEnd: blockedTimes[0].endTime }
          );
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
            : txErr.message === 'TIME_BLOCKED'
            ? `Este horario se encuentra bloqueado (${txErr.blockedStart}–${txErr.blockedEnd}). Elige otro momento.`
            : 'Este horario no está disponible';
        const statusCode = txErr.message === 'NO_RANGE' ? 400 : txErr.message === 'TIME_OVERLAP' || txErr.message === 'TIME_BLOCKED' ? 409 : 400;
        return NextResponse.json({ success: false, error: msg }, { status: statusCode });
      }
      // P2028 = transaction timeout — advisory-lock waits under a booking burst count
      // toward it. Retriable, so return 503 instead of a generic 500.
      if (txErr?.code === 'P2028') {
        return NextResponse.json(
          { success: false, error: 'Hay muchas reservas en proceso en este momento. Intenta de nuevo en unos segundos.' },
          { status: 503 }
        );
      }
      // GAP-1 race: patient deleted between the pre-check and the create
      const patientGone = patientLinkGoneResponse(txErr);
      if (patientGone) return patientGone;
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
