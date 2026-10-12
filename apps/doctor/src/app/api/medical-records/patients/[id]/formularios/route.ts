// GET /api/medical-records/patients/[id]/formularios
// Returns all SUBMITTED AppointmentFormLink records linked to a patient
// via formLink.patientId (direct), scoped to the authenticated doctor.

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

    // N12 (2026-10-12) — `?bookingId=` (antes de la verificación del paciente: `doctorId` + la cita de
    // ESTE paciente ya acotan la fila): el formulario PRE-CONSULTA de esa cita (pendiente o contestado),
    // para enseñarlo en su VISITA (cita↔visita es 1:1). Sin el de datos fiscales: comparte tabla
    // (`templateId 'FISCAL'`), es del paciente y no de la cita. La cita tiene que ser de ESTE paciente.
    const bookingId = request.nextUrl.searchParams.get('bookingId');
    if (bookingId) {
      const fl = await prisma.appointmentFormLink.findFirst({
        where: { doctorId, bookingId, templateId: { not: 'FISCAL' }, booking: { patientId } },
        select: { id: true, status: true, templateId: true, createdAt: true, submittedAt: true },
      });
      const nombre = fl
        ? (await prisma.encounterTemplate.findFirst({ where: { id: fl.templateId }, select: { name: true } }))?.name ?? null
        : null;
      return NextResponse.json({
        success: true,
        data: fl ? { id: fl.id, status: fl.status, templateName: nombre, createdAt: fl.createdAt, submittedAt: fl.submittedAt } : null,
      });
    }

    // Verify patient belongs to this doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    const formLinks = await prisma.appointmentFormLink.findMany({
      where: {
        status: 'SUBMITTED',
        doctorId,
        patientId,
      },
      select: {
        id: true,
        templateId: true,
        submittedAt: true,
        booking: {
          select: {
            date: true,
            startTime: true,
            slot: {
              select: { date: true, startTime: true },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Fetch template names (cross-schema plain string reference)
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
        templateName: fl.templateId === 'FISCAL' ? 'Datos Fiscales' : templateMap[fl.templateId] ?? null,
        submittedAt: fl.submittedAt,
        appointmentDate: appointmentDate ? appointmentDate.toISOString().split('T')[0] : null,
        appointmentTime,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/formularios');
  }
}
