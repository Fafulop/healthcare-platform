// POST /api/appointments/bookings/instant
// Creates a private AppointmentSlot (isPublic: false, isOpen: false) + a confirmed Booking
// in one transaction. Used when the doctor schedules a patient outside pre-planned slots ("Nuevo horario").
// No freeform bookings (slotId: null) are created — every booking references a slot.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logBookingCreated } from '@/lib/activity-logger';
import { createSlotEvent } from '@/lib/google-calendar';
import { getCalendarTokens, generateConfirmationCode, generateReviewToken, calcEndTime } from '@/lib/appointments-utils';
import { sendPatientSMS, sendDoctorSMS, isSMSEnabled } from '@/lib/sms';
import { sendBookingConfirmationEmail } from '@/lib/send-confirmation-email';

export async function POST(request: Request) {
  try {
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const {
      doctorId,
      date,           // "YYYY-MM-DD"
      startTime,      // "HH:MM"
      duration,       // 30 or 60
      patientName,
      patientEmail,
      patientPhone,
      patientWhatsapp,
      notes,
      serviceId,
      isFirstTime,
      appointmentMode,
      locationId,     // optional — links to ClinicLocation
      isRescheduled,
      patientId,
    } = body;

    if (!doctorId || !date || !startTime || !duration || !patientName) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Fetch doctor booking field settings for instant flow
    const doctorFieldSettings = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        bookingInstantEmailRequired:     true,
        bookingInstantPhoneRequired:     true,
        bookingInstantWhatsappRequired:  true,
      },
    });

    const emailRequired    = doctorFieldSettings?.bookingInstantEmailRequired    ?? true;
    const phoneRequired    = doctorFieldSettings?.bookingInstantPhoneRequired    ?? true;
    const whatsappRequired = doctorFieldSettings?.bookingInstantWhatsappRequired ?? true;

    const missing = [
      emailRequired    && !patientEmail    ? 'patientEmail'    : null,
      phoneRequired    && !patientPhone    ? 'patientPhone'    : null,
      whatsappRequired && !patientWhatsapp ? 'patientWhatsapp' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Faltan campos requeridos: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const durationNum = Number(duration);
    if (durationNum !== 30 && durationNum !== 60) {
      return NextResponse.json(
        { success: false, error: 'La duración debe ser 30 o 60 minutos' },
        { status: 400 }
      );
    }

    if (role === 'DOCTOR') {
      if (!authenticatedDoctorId || doctorId !== authenticatedDoctorId) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Normalize startTime to HH:MM (strip seconds if browser sends HH:MM:SS)
    const normalizedStartTime = startTime.length > 5 ? startTime.slice(0, 5) : startTime;
    const endTime = calcEndTime(normalizedStartTime, durationNum);

    // Resolve locationId — if not provided, default to doctor's first ClinicLocation
    let resolvedLocationId: string | null = locationId || null;
    if (!resolvedLocationId) {
      const defaultLoc = await prisma.clinicLocation.findFirst({
        where: { doctorId },
        orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }],
        select: { id: true },
      });
      resolvedLocationId = defaultLoc?.id ?? null;
    }

    // Normalize date to midnight UTC
    const bookingDate = new Date(date + 'T12:00:00Z');
    bookingDate.setUTCHours(0, 0, 0, 0);

    // Resolve service name and price
    let serviceName: string | null = null;
    let finalPrice = 0;
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, doctorId },
      });
      if (service) {
        serviceName = service.serviceName;
        finalPrice = Number(service.price) || 0;
      }
    }

    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    // Create private slot + confirmed booking atomically.
    // The slot is isPublic: false (hidden from public booking page) and isOpen: false
    // (doctor is committed to this patient — no further bookings accepted on this slot).
    // P2002 = unique constraint (doctorId, date, startTime) violated — slot already exists at this time.
    let slot: any;
    let booking: any;
    try {
      [slot, booking] = await prisma.$transaction(async (tx) => {
        // Overlap check: reject if any existing slot on this doctor+date overlaps the requested time range.
        // String comparison works for zero-padded "HH:MM" times (lexicographic = chronological).
        const overlapping = await tx.appointmentSlot.findFirst({
          where: {
            doctorId,
            date: bookingDate,
            startTime: { lt: endTime },
            endTime: { gt: normalizedStartTime },
          },
        });
        if (overlapping) {
          throw Object.assign(
            new Error('TIME_OVERLAP'),
            { bookingError: true, overlap: overlapping }
          );
        }

        const s = await tx.appointmentSlot.create({
          data: {
            doctorId,
            date: bookingDate,
            startTime: normalizedStartTime,
            endTime,
            duration: durationNum,
            basePrice: finalPrice,
            finalPrice,
            isPublic: false,
            isOpen: false,
            ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
          },
          include: {
            location: { select: { address: true } },
          },
        });

        const b = await tx.booking.create({
          data: {
            doctorId,
            slotId: s.id,
            patientName,
            patientEmail,
            patientPhone,
            patientWhatsapp: patientWhatsapp || null,
            notes: notes || null,
            serviceId: serviceId || null,
            serviceName,
            isFirstTime: isFirstTime ?? null,
            appointmentMode: appointmentMode || null,
            finalPrice,
            confirmationCode,
            reviewToken,
            status: 'CONFIRMED',
            isRescheduled: isRescheduled === true,
            patientId: patientId || null,
            confirmedAt: new Date(),
          },
        });

        return [s, b];
      });
    } catch (txErr: any) {
      if (txErr?.message === 'TIME_OVERLAP') {
        const ov = txErr.overlap;
        return NextResponse.json(
          { success: false, error: `Este horario se traslapa con un horario existente (${ov.startTime}–${ov.endTime}). Elige otro momento.` },
          { status: 409 }
        );
      }
      if (txErr?.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un horario en este tiempo. Usa el horario existente o elige otro momento.' },
          { status: 409 }
        );
      }
      throw txErr;
    }

    // Send SMS notifications (async, non-blocking)
    const smsEnabled = await isSMSEnabled();
    if (smsEnabled) {
      const doctorForSms = await prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { doctorFullName: true, clinicPhone: true, clinicAddress: true, primarySpecialty: true },
      });
      if (doctorForSms) {
        const smsDetails = {
          patientName,
          patientPhone,
          doctorName: doctorForSms.doctorFullName,
          doctorPhone: doctorForSms.clinicPhone || undefined,
          date: bookingDate.toISOString(),
          startTime: normalizedStartTime,
          endTime,
          duration: durationNum,
          finalPrice,
          confirmationCode,
          clinicAddress: slot.location?.address ?? doctorForSms.clinicAddress ?? undefined,
          specialty: doctorForSms.primarySpecialty || undefined,
          reviewToken,
        };
        sendPatientSMS(smsDetails, 'CONFIRMED').catch((err) =>
          console.error('SMS patient notification (instant):', err)
        );
        sendDoctorSMS(smsDetails).catch((err) =>
          console.error('SMS doctor notification (instant):', err)
        );
      }
    }

    // Log activity
    logBookingCreated({
      doctorId,
      bookingId: booking.id,
      patientName,
      patientEmail,
      patientPhone,
      date,
      time: `${normalizedStartTime}-${endTime}`,
      confirmationCode,
      finalPrice,
    });

    // Sync to Google Calendar (fire-and-forget) — event ID stored on the slot (not the booking).
    // Auto-send confirmation email chained after sync so googleEventId is persisted before ensureMeetLink runs (TELEMEDICINA).
    getCalendarTokens(doctorId).then(async tokens => {
      if (!tokens) return;
      const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, {
        id: slot.id,
        date,
        startTime: normalizedStartTime,
        endTime,
        isOpen: false,
        patientName,
        bookingStatus: 'CONFIRMED',
        patientPhone,
        patientEmail,
        patientNotes: notes ?? undefined,
        finalPrice,
      });
      await prisma.appointmentSlot.update({
        where: { id: slot.id },
        data: { googleEventId: eventId },
      });
    }).catch((err) => console.error('[GCal sync] createSlotEvent (instant booking):', err))
    .finally(() => {
      sendBookingConfirmationEmail(booking.id).catch((err) =>
        console.error('[Email] auto-send confirmation (instant POST):', err)
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
          slotId: slot.id,
          slot: { date, startTime: normalizedStartTime, endTime, duration: durationNum, finalPrice },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating instant booking:', error);

    if (error instanceof Error) {
      if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('authentication')) {
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error al crear la cita' },
      { status: 500 }
    );
  }
}
