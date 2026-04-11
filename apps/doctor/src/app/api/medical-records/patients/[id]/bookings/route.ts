// GET /api/medical-records/patients/[id]/bookings
// Returns all bookings linked to a patient, ordered by appointment date descending.
// Scoped to the authenticated doctor — only returns bookings where booking.doctorId === doctor.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    // Verify patient belongs to this doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { patientId, doctorId },
      select: {
        id: true,
        status: true,
        serviceName: true,
        appointmentMode: true,
        slot: {
          select: {
            date: true,
            startTime: true,
            endTime: true,
          },
        },
        // freeform booking time fields
        date: true,
        startTime: true,
        endTime: true,
      },
      orderBy: [
        { slot: { date: 'desc' } },
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const data = bookings.map((b) => ({
      id: b.id,
      date: (b.slot?.date ?? b.date)?.toISOString().split('T')[0] ?? null,
      startTime: b.slot?.startTime ?? b.startTime ?? null,
      endTime: b.slot?.endTime ?? b.endTime ?? null,
      serviceName: b.serviceName ?? null,
      status: b.status,
      appointmentMode: b.appointmentMode ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/bookings');
  }
}
