import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@healthcare/database';
import { normalizeDate } from '@/lib/conflict-checker';
import { fetchSlotsDelDoctor } from '@/lib/api-slots';
import { puedeVer } from '@/lib/visitas';

// This route lives under `medical-records/tasks` (toggle `tareas`) but also returns the range's
// APPOINTMENTS, with patient name, email, phone, notes and price. Since 2026-09-25 appointments are
// only sent with `citas`: without it the response has tasks only plus `citasOcultas: true`, and if
// the (now authenticated) slots call fails, `citasIncompletas: true` — an empty list must never be
// read as "no appointments". See NUEVOS USUARIOS/05-COBERTURA §"Fugas por CAMPO".
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireDoctorAuth(request);
    const { doctorId } = ctx;
    const verCitas = puedeVer(ctx, 'citas');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate'); // "2026-01-01"
    const endDate = searchParams.get('endDate');     // "2026-01-31"

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate y endDate son requeridos' },
        { status: 400 }
      );
    }

    // Fetch tasks from local DB
    const tasks = await prisma.task.findMany({
      where: {
        doctorId,
        dueDate: {
          gte: normalizeDate(startDate),
          lte: normalizeDate(endDate),
        },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!verCitas) {
      return NextResponse.json({ data: { tasks, appointmentSlots: [] }, citasOcultas: true });
    }

    // Fetch appointment slots from API app — AUTHENTICATED (the endpoint is no longer public).
    let appointmentSlots: any[] = [];
    let citasIncompletas = false;
    try {
      const slotsResponse = await fetchSlotsDelDoctor(ctx, startDate, endDate);
      if (slotsResponse?.ok) {
        const slotsData = await slotsResponse.json();
        appointmentSlots = slotsData.data || [];
      } else {
        citasIncompletas = true;
        if (slotsResponse) console.error('❌ Slots API error:', slotsResponse.status, await slotsResponse.text());
      }
    } catch (error) {
      citasIncompletas = true;
      console.error('Error fetching appointment slots:', error);
    }

    // Fetch freeform bookings (slotId = null) for this date range.
    // These are doctor-created appointments with no pre-planned slot.
    // Normalize them to the same shape as slot objects so the dashboard renders them identically.
    const freeformBookings = await prisma.booking.findMany({
      where: {
        doctorId,
        slotId: null,
        date: {
          gte: normalizeDate(startDate),
          lte: normalizeDate(endDate),
        },
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        duration: true,
        finalPrice: true,
        patientName: true,
        patientEmail: true,
        patientPhone: true,
        status: true,
        confirmationCode: true,
        serviceName: true,
        notes: true,
      },
    });

    // Normalize freeform bookings to slot shape so DayItineraryContent renders them as-is
    const freeformAsSlots = freeformBookings.map(b => ({
      id: b.id,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      duration: b.duration,
      basePrice: 0,
      finalPrice: b.finalPrice,
      isOpen: false,
      currentBookings: 1,
      maxBookings: 1,
      isFreeform: true,
      bookings: [{
        id: b.id,
        patientName: b.patientName,
        patientEmail: b.patientEmail,
        patientPhone: b.patientPhone,
        status: b.status,
        confirmationCode: b.confirmationCode,
        serviceName: b.serviceName,
        notes: b.notes,
        finalPrice: b.finalPrice,
      }],
    }));

    return NextResponse.json({
      data: {
        tasks,
        appointmentSlots: [...appointmentSlots, ...freeformAsSlots],
      },
      ...(citasIncompletas ? { citasIncompletas: true } : {}),
    });
  } catch (error) {
    return handleApiError(error, 'fetching calendar data');
  }
}
