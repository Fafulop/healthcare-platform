import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/prescriptions/:prescriptionId/lab-studies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId } = await params;

    const patient = await prisma.patient.findFirst({ where: { id: patientId, doctorId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId, doctorId },
    });
    if (!prescription) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    const studies = await prisma.prescriptionLabStudy.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ data: studies });
  } catch (error) {
    return handleApiError(error, 'GET lab-studies');
  }
}

// POST /api/medical-records/patients/:id/prescriptions/:prescriptionId/lab-studies
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId } = await params;
    const body = await request.json();

    const patient = await prisma.patient.findFirst({ where: { id: patientId, doctorId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const prescription = await prisma.prescription.findFirst({
      where: { id: prescriptionId, patientId, doctorId },
    });
    if (!prescription) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    if (prescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot add studies to prescription with status: ' + prescription.status },
        { status: 400 }
      );
    }

    if (!body.studyName) {
      return NextResponse.json({ error: 'studyName is required' }, { status: 400 });
    }

    const maxOrder = await prisma.prescriptionLabStudy.findFirst({
      where: { prescriptionId },
      orderBy: { order: 'desc' },
    });

    const study = await prisma.prescriptionLabStudy.create({
      data: {
        prescriptionId,
        studyName: body.studyName,
        indication: body.indication || null,
        urgency: body.urgency || null,
        fasting: body.fasting || null,
        notes: body.notes || null,
        order: body.order !== undefined ? body.order : (maxOrder ? maxOrder.order + 1 : 0),
      },
    });

    await logAudit({
      patientId, doctorId, userId, userRole: role,
      action: 'add_prescription_lab_study',
      resourceType: 'prescription', resourceId: prescriptionId,
      changes: { studyId: study.id, studyName: body.studyName },
      request,
    });

    return NextResponse.json({ data: study }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST lab-studies');
  }
}
