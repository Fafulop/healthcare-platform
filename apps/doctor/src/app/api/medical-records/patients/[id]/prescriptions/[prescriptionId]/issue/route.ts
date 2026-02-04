import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { logPrescriptionIssued } from '@/lib/activity-logger';
import { handleApiError } from '@/lib/api-error-handler';

// POST /api/medical-records/patients/:id/prescriptions/:prescriptionId/issue
// Issue/lock a prescription (change status from draft to issued)
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
    const existingPrescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId,
        doctorId
      },
      include: {
        medications: true
      }
    });

    if (!existingPrescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Can only issue draft prescriptions
    if (existingPrescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Prescription is already issued or cancelled' },
        { status: 400 }
      );
    }

    // Validate prescription has at least one medication
    if (existingPrescription.medications.length === 0) {
      return NextResponse.json(
        { error: 'Cannot issue prescription without medications' },
        { status: 400 }
      );
    }

    // Issue the prescription
    const prescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'issued',
        issuedBy: userId,
        issuedAt: new Date(),
        doctorSignature: body.doctorSignature || existingPrescription.doctorSignature,
      },
      include: {
        medications: {
          orderBy: { order: 'asc' }
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            internalId: true,
            dateOfBirth: true,
            sex: true,
          }
        }
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'issue_prescription',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      changes: {
        status: 'issued',
        issuedAt: new Date().toISOString(),
      },
      request
    });

    // Log activity for dashboard
    logPrescriptionIssued({
      doctorId,
      prescriptionId,
      patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
      medicationCount: existingPrescription.medications.length,
      userId,
    });

    return NextResponse.json({
      data: prescription,
      message: 'Prescription issued successfully'
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/issue');
  }
}
