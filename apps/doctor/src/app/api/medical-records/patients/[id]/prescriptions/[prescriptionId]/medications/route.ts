import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/prescriptions/:prescriptionId/medications
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId } = await params;

    // Verify patient belongs to doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId }
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Verify prescription exists and belongs to this patient
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId,
        doctorId
      }
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Fetch medications
    const medications = await prisma.prescriptionMedication.findMany({
      where: { prescriptionId },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ data: medications });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/medications');
  }
}

// POST /api/medical-records/patients/:id/prescriptions/:prescriptionId/medications
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId } = await params;
    const body = await request.json();

    // Verify patient belongs to doctor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId }
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Verify prescription exists and belongs to this patient
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId,
        doctorId
      }
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Only allow adding medications to draft prescriptions
    if (prescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot add medications to prescription with status: ' + prescription.status },
        { status: 400 }
      );
    }

    // Validation
    if (!body.drugName || !body.dosage || !body.frequency || !body.instructions) {
      return NextResponse.json(
        { error: 'Missing required fields: drugName, dosage, frequency, instructions' },
        { status: 400 }
      );
    }

    // Get current max order
    const maxOrderMed = await prisma.prescriptionMedication.findFirst({
      where: { prescriptionId },
      orderBy: { order: 'desc' }
    });

    const nextOrder = maxOrderMed ? maxOrderMed.order + 1 : 0;

    // Create medication
    const medication = await prisma.prescriptionMedication.create({
      data: {
        prescriptionId,
        drugName: body.drugName,
        presentation: body.presentation || null,
        dosage: body.dosage,
        frequency: body.frequency,
        duration: body.duration || null,
        quantity: body.quantity || null,
        instructions: body.instructions,
        warnings: body.warnings || null,
        order: body.order !== undefined ? body.order : nextOrder,
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'add_prescription_medication',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      changes: {
        medicationId: medication.id,
        drugName: body.drugName,
      },
      request
    });

    return NextResponse.json({ data: medication }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/medications');
  }
}
