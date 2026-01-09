import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/prescriptions/:prescriptionId
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

    // Fetch prescription with full details
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId,
        doctorId
      },
      include: {
        medications: {
          orderBy: { order: 'asc' }
        },
        encounter: {
          select: {
            id: true,
            encounterDate: true,
            encounterType: true,
            chiefComplaint: true,
          }
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

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found' },
        { status: 404 }
      );
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_prescription',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      request
    });

    return NextResponse.json({ data: prescription });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/prescriptions/[prescriptionId]');
  }
}

// PUT /api/medical-records/patients/:id/prescriptions/:prescriptionId
export async function PUT(
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

    // Only allow editing draft prescriptions
    if (existingPrescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot edit prescription with status: ' + existingPrescription.status },
        { status: 400 }
      );
    }

    // If encounterId is being updated, verify it exists and belongs to this patient
    if (body.encounterId) {
      const encounter = await prisma.clinicalEncounter.findFirst({
        where: {
          id: body.encounterId,
          patientId,
          doctorId
        }
      });

      if (!encounter) {
        return NextResponse.json(
          { error: 'Encounter not found or does not belong to this patient' },
          { status: 404 }
        );
      }
    }

    // Update prescription (only metadata, not status - use issue/cancel endpoints for that)
    const prescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        encounterId: body.encounterId !== undefined ? body.encounterId : undefined,
        prescriptionDate: body.prescriptionDate ? new Date(body.prescriptionDate) : undefined,
        doctorFullName: body.doctorFullName !== undefined ? body.doctorFullName : undefined,
        doctorLicense: body.doctorLicense !== undefined ? body.doctorLicense : undefined,
        diagnosis: body.diagnosis !== undefined ? body.diagnosis : undefined,
        clinicalNotes: body.clinicalNotes !== undefined ? body.clinicalNotes : undefined,
        expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? new Date(body.expiresAt) : null) : undefined,
      },
      include: {
        medications: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'update_prescription',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      changes: body,
      request
    });

    return NextResponse.json({ data: prescription });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]/prescriptions/[prescriptionId]');
  }
}

// DELETE /api/medical-records/patients/:id/prescriptions/:prescriptionId
export async function DELETE(
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

    // Only allow deleting draft prescriptions
    if (prescription.status !== 'draft') {
      return NextResponse.json(
        { error: 'Cannot delete prescription with status: ' + prescription.status + '. Use cancel endpoint instead.' },
        { status: 400 }
      );
    }

    // Delete prescription (cascade will delete medications)
    await prisma.prescription.delete({
      where: { id: prescriptionId }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'delete_prescription',
      resourceType: 'prescription',
      resourceId: prescriptionId,
      request
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/prescriptions/[prescriptionId]');
  }
}
