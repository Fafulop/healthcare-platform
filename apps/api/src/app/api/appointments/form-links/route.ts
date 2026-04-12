// GET  /api/appointments/form-links         — All SUBMITTED formLinks for the authenticated doctor.
// POST /api/appointments/form-links         — Create a standalone formLink (no booking) linked to a patient.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { randomBytes } from 'crypto';
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
        patient: {
          select: { id: true, firstName: true, lastName: true },
        },
        booking: {
          select: {
            date: true,
            startTime: true,
            patient: {
              select: { id: true, firstName: true, lastName: true },
            },
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
      const appointmentDate = fl.booking?.slot?.date ?? fl.booking?.date ?? null;
      const appointmentTime = fl.booking?.slot?.startTime ?? fl.booking?.startTime ?? null;
      return {
        id: fl.id,
        patientName: fl.patientName,
        patientEmail: fl.patientEmail,
        appointmentDate: appointmentDate ? appointmentDate.toISOString().split('T')[0] : null,
        appointmentTime,
        templateName: templateMap[fl.templateId] ?? null,
        submittedAt: fl.submittedAt,
        linkedPatient: fl.patient ?? fl.booking?.patient ?? null,
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

export async function POST(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const body = await request.json();
    const { patientId, templateId } = body;

    if (!patientId || !templateId) {
      return NextResponse.json(
        { success: false, error: 'Se requieren patientId y templateId' },
        { status: 400 }
      );
    }

    // Verify patient belongs to this doctor
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, doctorId: true, firstName: true, lastName: true, email: true },
    });

    if (!patient || patient.doctorId !== doctor.id) {
      return NextResponse.json(
        { success: false, error: 'Paciente no encontrado' },
        { status: 404 }
      );
    }

    // Verify template: must be active, custom, isPreAppointment, and belong to this doctor
    const template = await prisma.encounterTemplate.findFirst({
      where: {
        id: templateId,
        doctorId: doctor.id,
        isCustom: true,
        isPreAppointment: true,
        isActive: true,
      },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada o no está marcada como pre-cita' },
        { status: 404 }
      );
    }

    const token = randomBytes(20).toString('hex');
    const publicUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro';

    await prisma.appointmentFormLink.create({
      data: {
        token,
        doctorId: doctor.id,
        templateId,
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientEmail: patient.email ?? '',
        // bookingId intentionally omitted — this is a standalone form not tied to an appointment
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        url: `${publicUrl}/formulario-cita/${token}`,
      },
    });
  } catch (error) {
    console.error('Error generating standalone form link:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar el enlace del formulario' },
      { status: 500 }
    );
  }
}
