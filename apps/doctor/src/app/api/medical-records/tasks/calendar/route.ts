import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@healthcare/database';

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
          gte: new Date(startDate),
          lte: new Date(endDate),
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
    // Convert to ISO strings to match appointments API expectations
    const startDateISO = new Date(startDate).toISOString();
    const endDateISO = new Date(endDate).toISOString();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
    const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${startDateISO}&endDate=${endDateISO}`;

    let appointmentSlots = [];
    try {
      const slotsResponse = await fetch(slotsUrl);
      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        appointmentSlots = slotsData.data || [];
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
