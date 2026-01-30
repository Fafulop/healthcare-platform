import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');           // "2026-01-15"
    const startTime = searchParams.get('startTime'); // "09:00"
    const endTime = searchParams.get('endTime');     // "10:00"

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'date, startTime y endTime son requeridos' },
        { status: 400 }
      );
    }

    // Fetch appointment slots for the date
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
    const slotsUrl = `${apiUrl}/api/appointments/slots?doctorId=${doctorId}&startDate=${date}&endDate=${date}`;

    let conflicts = [];
    try {
      const slotsResponse = await fetch(slotsUrl);
      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        const slots = slotsData.data || [];

        // Filter for overlapping slots
        // Overlap: slotStart < taskEnd AND slotEnd > taskStart
        conflicts = slots.filter((slot: any) => {
          const slotStart = slot.startTime; // e.g., "09:00"
          const slotEnd = slot.endTime;     // e.g., "10:00"
          return slotStart < endTime && slotEnd > startTime;
        });
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
    }

    return NextResponse.json({
      data: {
        conflicts,
      },
    });
  } catch (error) {
    return handleApiError(error, 'checking task conflicts');
  }
}
