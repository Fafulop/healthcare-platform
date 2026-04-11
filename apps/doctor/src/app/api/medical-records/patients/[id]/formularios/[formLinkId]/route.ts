// DELETE /api/medical-records/patients/[id]/formularios/[formLinkId]
// Hard deletes an AppointmentFormLink from the patient's expediente.
// Only the doctor who owns the patient and the formLink may call this.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; formLinkId: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId, formLinkId } = await params;

    // Verify patient belongs to this doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    // Verify formLink belongs to this doctor and is linked to this patient
    const formLink = await prisma.appointmentFormLink.findFirst({
      where: { id: formLinkId, doctorId, patientId },
      select: { id: true },
    });
    if (!formLink) {
      return NextResponse.json({ success: false, error: 'Formulario no encontrado' }, { status: 404 });
    }

    await prisma.appointmentFormLink.delete({ where: { id: formLinkId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/formularios/[formLinkId]');
  }
}
