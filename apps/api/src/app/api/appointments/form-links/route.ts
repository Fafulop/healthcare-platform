// GET /api/appointments/form-links
// Returns all SUBMITTED AppointmentFormLink records for the authenticated doctor.
// Used by apps/doctor formularios list page.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const formLinks = await prisma.appointmentFormLink.findMany({
      where: {
        doctorId: doctor.id,
        status: 'SUBMITTED',
      },
      select: {
        id: true,
        templateId: true,
        submittedAt: true,
        patientName: true,
        patientEmail: true,
        booking: {
          select: {
            date: true,
            startTime: true,
            slot: {
              select: {
                date: true,
                startTime: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Fetch template names in one query (templateId is a cross-schema plain string)
    const templateIds = [...new Set(formLinks.map((fl) => fl.templateId))];
    const templates = templateIds.length > 0
      ? await prisma.encounterTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, name: true },
        })
      : [];
    const templateMap = Object.fromEntries(templates.map((t) => [t.id, t.name]));

    const data = formLinks.map((fl) => {
      const appointmentDate = fl.booking.slot?.date ?? fl.booking.date ?? null;
      const appointmentTime = fl.booking.slot?.startTime ?? fl.booking.startTime ?? null;
      return {
        id: fl.id,
        patientName: fl.patientName,
        patientEmail: fl.patientEmail,
        appointmentDate: appointmentDate ? appointmentDate.toISOString().split('T')[0] : null,
        appointmentTime,
        templateName: templateMap[fl.templateId] ?? null,
        submittedAt: fl.submittedAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching form links:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los formularios' },
      { status: 500 }
    );
  }
}
