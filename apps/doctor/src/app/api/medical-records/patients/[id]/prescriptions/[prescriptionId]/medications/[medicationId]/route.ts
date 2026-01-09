import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// PUT /api/medical-records/patients/:id/prescriptions/:prescriptionId/medications/:medicationId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string; medicationId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId, medicationId } = await params;
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

    // Only allow editing medications in draft prescriptions
    if (prescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot edit medications in prescription with status: ' + prescription.status },
        { status: 400 }
      );
    }

    // Verify medication exists and belongs to this prescription
    const existingMedication = await prisma.prescriptionMedication.findFirst({
      where: {
        id: parseInt(medicationId),
        prescriptionId
      }
    });

    if (!existingMedication) {
      return NextResponse.json(
        { error: 'Medication not found' },
        { status: 404 }
      );
    }

    // Update medication
    const medication = await prisma.prescriptionMedication.update({
      where: { id: parseInt(medicationId) },
      data: {
        drugName: body.drugName !== undefined ? body.drugName : undefined,
        presentation: body.presentation !== undefined ? body.presentation : undefined,
        dosage: body.dosage !== undefined ? body.dosage : undefined,
        frequency: body.frequency !== undefined ? body.frequency : undefined,
        duration: body.duration !== undefined ? body.duration : undefined,
        quantity: body.quantity !== undefined ? body.quantity : undefined,
        instructions: body.instructions !== undefined ? body.instructions : undefined,
        warnings: body.warnings !== undefined ? body.warnings : undefined,
        order: body.order !== undefined ? body.order : undefined,
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'update_prescription_medication',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      changes: {
        medicationId: medication.id,
        updates: body,
      },
      request
    });

    return NextResponse.json({ data: medication });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/medications/[medicationId]');
  }
}

// DELETE /api/medical-records/patients/:id/prescriptions/:prescriptionId/medications/:medicationId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prescriptionId: string; medicationId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, prescriptionId, medicationId } = await params;

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

    // Only allow deleting medications from draft prescriptions
    if (prescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot delete medications from prescription with status: ' + prescription.status },
        { status: 400 }
      );
    }

    // Verify medication exists and belongs to this prescription
    const medication = await prisma.prescriptionMedication.findFirst({
      where: {
        id: parseInt(medicationId),
        prescriptionId
      }
    });

    if (!medication) {
      return NextResponse.json(
        { error: 'Medication not found' },
        { status: 404 }
      );
    }

    // Delete medication
    await prisma.prescriptionMedication.delete({
      where: { id: parseInt(medicationId) }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'delete_prescription_medication',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      changes: {
        medicationId: parseInt(medicationId),
        drugName: medication.drugName,
      },
      request
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/medications/[medicationId]');
  }
}
