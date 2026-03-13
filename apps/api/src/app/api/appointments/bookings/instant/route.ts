// POST /api/appointments/bookings/instant
// Creates a freeform booking directly — no AppointmentSlot is created.
// Used when the doctor schedules a patient outside of pre-planned slots ("Nuevo horario").
// The booking stores date/startTime/endTime/duration directly instead of referencing a slot.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import crypto from 'crypto';
import { validateAuthToken } from '@/lib/auth';
import { logBookingCreated } from '@/lib/activity-logger';
import { createSlotEvent, resolveTokens } from '@/lib/google-calendar';

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

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateReviewToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function calcEndTime(startTime: string, duration: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const endMins = h * 60 + m + duration;
  return `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
}

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
    } = body;

    if (!doctorId || !date || !startTime || !duration || !patientName || !patientEmail || !patientPhone) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
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

    // Create the freeform booking — no slot involved.
    // date/startTime/endTime/duration are stored directly on the booking.
    const booking = await prisma.booking.create({
      data: {
        doctorId,
        slotId: null,
        date: bookingDate,
        startTime: normalizedStartTime,
        endTime,
        duration: durationNum,
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
        confirmedAt: new Date(),
      },
    });

    // Close any open slots at this same date+time — the doctor is now committed here.
    // This prevents public patients from booking into a slot that overlaps this freeform appointment.
    await prisma.appointmentSlot.updateMany({
      where: {
        doctorId,
        date: bookingDate,
        startTime: normalizedStartTime,
        isOpen: true,
      },
      data: { isOpen: false },
    });

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

    // Sync to Google Calendar (fire-and-forget) — event ID stored on the booking itself
    getCalendarTokens(doctorId).then(async tokens => {
      if (!tokens) return;
      const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, {
        id: booking.id,
        date,
        startTime: normalizedStartTime,
        endTime,
        isOpen: false,
        patientName,
        bookingStatus: 'CONFIRMED',
        patientPhone,
        patientNotes: notes ?? undefined,
        finalPrice,
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { googleEventId: eventId },
      });
    }).catch((err) => console.error('[GCal sync] createSlotEvent (freeform booking):', err));

    return NextResponse.json(
      {
        success: true,
        message: 'Cita creada y confirmada exitosamente',
        data: {
          confirmationCode,
          bookingId: booking.id,
          slot: { date, startTime: normalizedStartTime, endTime, duration: durationNum, finalPrice },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating freeform booking:', error);

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
