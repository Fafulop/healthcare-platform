import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// PUT /api/medical-records/patients/:id/prescriptions/:prescriptionId/lab-studies/:studyId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string; studyId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId, studyId } = await params;
    const body = await request.json();

    const patient = await prisma.patient.findFirst({ where: { id: patientId, doctorId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId, doctorId },
    });
    if (!prescription) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    if (prescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot edit studies on prescription with status: ' + prescription.status },
        { status: 400 }
      );
    }

    const study = await prisma.prescriptionLabStudy.update({
      where: { id: parseInt(studyId) },
      data: {
        studyName: body.studyName,
        indication: body.indication ?? null,
        urgency: body.urgency ?? null,
        fasting: body.fasting ?? null,
        notes: body.notes ?? null,
        order: body.order ?? 0,
      },
    });

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'update_prescription_lab_study',
      resourceType: 'prescription', resourceId: prescriptionId,
      changes: { studyId: study.id },
      request,
    });

    return NextResponse.json({ data: study });
  } catch (error) {
    return handleApiError(error, 'PUT lab-studies/[studyId]');
  }
}

// DELETE /api/medical-records/patients/:id/prescriptions/:prescriptionId/lab-studies/:studyId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string; studyId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId, studyId } = await params;

    const patient = await prisma.patient.findFirst({ where: { id: patientId, doctorId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId, doctorId },
    });
    if (!prescription) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    await prisma.prescriptionLabStudy.delete({ where: { id: parseInt(studyId) } });

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'delete_prescription_lab_study',
      resourceType: 'prescription', resourceId: prescriptionId,
      changes: { studyId },
      request,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE lab-studies/[studyId]');
  }
}
