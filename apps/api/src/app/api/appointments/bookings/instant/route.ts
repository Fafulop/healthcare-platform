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

    // Normalize startTime to HH:MM (strip seconds if browser sends HH:MM:SS)
    const normalizedStartTime = startTime.length > 5 ? startTime.slice(0, 5) : startTime;
    const endTime = calcEndTime(normalizedStartTime, durationNum);

    // Normalize date to midnight UTC (same as slot creation API)
    const slotDate = new Date(date + 'T12:00:00Z');
    slotDate.setUTCHours(0, 0, 0, 0);

    // Resolve service name and price before the transaction
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

    // All slot-check + slot-create/reuse + booking-create logic is in ONE atomic transaction.
    // orderBy isInstant asc ensures a regular slot (false) is preferred over an instant slot (true)
    // when both somehow exist at the same time, so the 409 guard always fires for regular slots.
    const confirmationCode = generateConfirmationCode();
    const reviewToken = generateReviewToken();

    let slot: any;
    let booking: any;
    try {
      ({ slot, booking } = await prisma.$transaction(async (tx) => {
        const existingSlot = await tx.appointmentSlot.findFirst({
          where: { doctorId, date: slotDate, startTime: normalizedStartTime },
          orderBy: { isInstant: 'asc' }, // regular slots (false) first
        });

        let resolvedSlot: any;

        if (existingSlot) {
          if (!existingSlot.isInstant) {
            // A pre-planned regular slot exists — "Nuevo horario" must not overwrite it.
            throw Object.assign(
              new Error(`Ya existe un horario a las ${normalizedStartTime} del ${date}. Para agendar en él, usa "Horarios disponibles".`),
              { isConflict: true, status: 409 }
            );
          }
          // Instant slot exists — guard against occupied or closed orphaned slots.
          if (!existingSlot.isOpen || existingSlot.currentBookings >= existingSlot.maxBookings) {
            throw Object.assign(
              new Error(`Ya tienes una cita a las ${normalizedStartTime} del ${date}. Cancélala primero o elige otra hora.`),
              { isConflict: true, status: 409 }
            );
          }
          // Orphaned instant slot (open, 0 bookings) — reuse it.
          resolvedSlot = existingSlot;
        } else {
          // Create a new instant slot on the fly.
          resolvedSlot = await tx.appointmentSlot.create({
            data: {
              doctorId,
              date: slotDate,
              startTime: normalizedStartTime,
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

        const b = await tx.booking.create({
          data: {
            slotId: resolvedSlot.id,
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
        // No counter increment — currentBookings is now computed from live bookings count.
        return { slot: resolvedSlot, booking: b };
      }));
    } catch (txErr: any) {
      if (txErr?.isConflict) {
        return NextResponse.json(
          { success: false, error: txErr.message },
          { status: txErr.status ?? 409 }
        );
      }
      throw txErr;
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

    // Sync to Google Calendar (fire-and-forget)
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
        patientNotes: notes ?? undefined,
        finalPrice,
      });
      await prisma.appointmentSlot.update({
        where: { id: slot.id },
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
          slot: { date, startTime: normalizedStartTime, endTime, duration: durationNum, finalPrice },
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
