import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@healthcare/database';
import { normalizeDate } from '@/lib/conflict-checker';

export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

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

    // Fetch appointment slots from API app
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
    const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`;

    let appointmentSlots: any[] = [];
    try {
      const slotsResponse = await fetch(slotsUrl);
      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        appointmentSlots = slotsData.data || [];
      } else {
        console.error('❌ Slots API error:', await slotsResponse.text());
      }
    } catch (error) {
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
        status: { notIn: ['CANCELLED'] },
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
    });
  } catch (error) {
    return handleApiError(error, 'fetching calendar data');
  }
}
