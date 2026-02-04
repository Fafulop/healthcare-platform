import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { logPrescriptionCancelled } from '@/lib/activity-logger';
import { handleApiError } from '@/lib/api-error-handler';

// POST /api/medical-records/patients/:id/prescriptions/:prescriptionId/cancel
// Cancel an issued prescription
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
      }
    });

    if (!existingPrescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Can only cancel issued prescriptions
    if (existingPrescription.status !== 'issued') {
      return NextResponse.json(
        { error: 'Can only cancel issued prescriptions. Current status: ' + existingPrescription.status },
        { status: 400 }
      );
    }

    // Require cancellation reason
    if (!body.cancellationReason || body.cancellationReason.trim() === '') {
      return NextResponse.json(
        { error: 'Cancellation reason is required' },
        { status: 400 }
      );
    }

    // Cancel the prescription
    const prescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: body.cancellationReason,
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
      action: 'cancel_prescription',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      changes: {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancellationReason: body.cancellationReason,
      },
      request
    });

    // Log activity for dashboard
    logPrescriptionCancelled({
      doctorId,
      prescriptionId,
      patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
      reason: body.cancellationReason,
      userId,
    });

    return NextResponse.json({
      data: prescription,
      message: 'Prescription cancelled successfully'
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/prescriptions/[prescriptionId]/cancel');
  }
}
