// GET /api/appointments/form-links/[id]
// Returns a single AppointmentFormLink for the authenticated doctor.
// Used by apps/doctor formularios/[id] detail page.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;

    const formLink = await prisma.appointmentFormLink.findUnique({
      where: { id },
      select: {
        id: true,
        templateId: true,
        status: true,
        submissionData: true,
        submittedAt: true,
        patientName: true,
        patientEmail: true,
        doctorId: true,
        booking: {
          select: {
            id: true,
            patientName: true,
            patientEmail: true,
            patientPhone: true,
            patientId: true,
            patient: {
              select: { id: true, firstName: true, lastName: true },
            },
            isFirstTime: true,
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
    });

    if (!formLink) {
      return NextResponse.json(
        { success: false, error: 'Formulario no encontrado' },
        { status: 404 }
      );
    }

    if (formLink.doctorId !== doctor.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este formulario' },
        { status: 403 }
      );
    }

    // Fetch template separately (cross-schema plain string reference)
    const template = await prisma.encounterTemplate.findUnique({
      where: { id: formLink.templateId },
      select: {
        name: true,
        description: true,
        customFields: true,
      },
    });

    const appointmentDate = formLink.booking.slot?.date ?? formLink.booking.date ?? null;
    const appointmentTime = formLink.booking.slot?.startTime ?? formLink.booking.startTime ?? null;

    return NextResponse.json({
      success: true,
      data: {
        id: formLink.id,
        templateId: formLink.templateId,
        status: formLink.status,
        submissionData: formLink.submissionData,
        submittedAt: formLink.submittedAt,
        patientName: formLink.patientName,
        patientEmail: formLink.patientEmail,
        appointment: {
          bookingId: formLink.booking.id,
          date: appointmentDate ? appointmentDate.toISOString().split('T')[0] : null,
          time: appointmentTime,
          isFirstTime: formLink.booking.isFirstTime,
          patientName: formLink.booking.patientName,
          patientEmail: formLink.booking.patientEmail,
          patientPhone: formLink.booking.patientPhone,
          linkedPatient: formLink.booking.patient ?? null,
        },
        template: template
          ? {
              name: template.name,
              description: template.description,
              customFields: Array.isArray(template.customFields) ? template.customFields : [],
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching form link detail:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener el formulario' },
      { status: 500 }
    );
  }
}
