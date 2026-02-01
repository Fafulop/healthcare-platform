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
    // Pass date strings directly without timezone conversion
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
    const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`;

    console.log('🔗 Fetching slots from API:', slotsUrl);

    let appointmentSlots = [];
    try {
      const slotsResponse = await fetch(slotsUrl);
      console.log('📡 Slots API response status:', slotsResponse.status);
      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        console.log('📊 Slots API data:', slotsData);
        appointmentSlots = slotsData.data || [];
        console.log('✅ Appointment slots fetched:', appointmentSlots.length);
      } else {
        const errorText = await slotsResponse.text();
        console.error('❌ Slots API error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching appointment slots:', error);
      // Continue without slots rather than failing
    }

    return NextResponse.json({
      data: {
        tasks,
        appointmentSlots,
      },
    });
  } catch (error) {
    return handleApiError(error, 'fetching calendar data');
  }
}
