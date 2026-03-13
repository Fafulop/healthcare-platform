// POST /api/appointments/bookings/instant
// Creates a slot on the fly (if none exists) + booking + auto-confirms in one operation.
// Used when the doctor schedules a patient without a pre-created slot.

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

    // Validate required fields
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

    // Auth: doctors can only book for themselves
    if (role === 'DOCTOR') {
      if (!authenticatedDoctorId || doctorId !== authenticatedDoctorId) {
        return NextResponse.json(
          { success: false, error: 'No autorizado' },
          { status: 403 }
        );
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      );
    }

    const endTime = calcEndTime(startTime, durationNum);

    // Normalize date to midnight UTC (same as slot creation API)
    const slotDate = new Date(date + 'T12:00:00Z');
    slotDate.setUTCHours(0, 0, 0, 0);

    // Check if a slot already exists at this date+time
    let slot = await prisma.appointmentSlot.findFirst({
      where: { doctorId, date: slotDate, startTime },
    });

    if (slot) {
      const isInstantUnavailable = slot.isInstant && (!slot.isOpen || slot.currentBookings >= slot.maxBookings);
      if (isInstantUnavailable) {
        // Previously used instant slot (cancelled, completed, or no-show) — re-open it for reuse
        slot = await prisma.appointmentSlot.update({
          where: { id: slot.id },
          data: { isOpen: true, currentBookings: 0 },
        });
      } else if (!slot.isOpen || slot.currentBookings >= slot.maxBookings) {
        // Regular slot that is closed or full — cannot book
        return NextResponse.json(
          {
            success: false,
            error: `Ya existe un horario a las ${startTime} del ${date} y no está disponible. Elige otra hora.`,
          },
          { status: 409 }
        );
      }
    } else {
      // Create a new slot on the fly (price stored as 0 — actual price comes from service)
      slot = await prisma.appointmentSlot.create({
        data: {
          doctorId,
          date: slotDate,
          startTime,
          endTime,
          duration: durationNum,
          basePrice: 0,
          finalPrice: 0,
          isOpen: true,
          currentBookings: 0,
          maxBookings: 1,
          isInstant: true,
        },
      });
    }

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

    // Create booking + confirm in a single transaction
    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          slotId: slot!.id,
          doctorId,
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
      await tx.appointmentSlot.update({
        where: { id: slot!.id },
        data: { currentBookings: { increment: 1 } },
      });
      return b;
    });

    // Log activity
    logBookingCreated({
      doctorId,
      bookingId: booking.id,
      patientName,
      patientEmail,
      patientPhone,
      date,
      time: `${startTime}-${endTime}`,
      confirmationCode,
      finalPrice,
    });

    // Sync to Google Calendar (fire-and-forget)
    getCalendarTokens(doctorId).then(async tokens => {
      if (!tokens) return;
      const eventId = await createSlotEvent(tokens.accessToken, tokens.refreshToken, tokens.calendarId, {
        id: slot!.id,
        date,
        startTime,
        endTime,
        isOpen: false,
        patientName,
        bookingStatus: 'CONFIRMED',
        patientPhone,
        patientNotes: notes ?? undefined,
        finalPrice,
      });
      await prisma.appointmentSlot.update({
        where: { id: slot!.id },
        data: { googleEventId: eventId },
      });
    }).catch((err) => console.error('[GCal sync] createSlotEvent (instant booking):', err));

    return NextResponse.json(
      {
        success: true,
        message: 'Cita creada y confirmada exitosamente',
        data: {
          confirmationCode,
          bookingId: booking.id,
          slot: { date, startTime, endTime, duration: durationNum, finalPrice },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating instant booking:', error);

    if (error instanceof Error) {
      if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('authentication')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Error al crear la cita' },
      { status: 500 }
    );
  }
}
