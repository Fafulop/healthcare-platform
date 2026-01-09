import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        doctorId
      },
      include: {
        encounters: {
          orderBy: { encounterDate: 'desc' },
          take: 5 // Get last 5 encounters
        },
        medicalHistory: {
          orderBy: { changedAt: 'desc' },
          take: 10 // Get last 10 history changes
        }
      }
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_patient',
      resourceType: 'patient',
      resourceId: patientId,
      request
    });

    return NextResponse.json({ data: patient });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]');
  }
}

// PUT /api/medical-records/patients/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await request.json();

    // Verify patient belongs to doctor
    const existingPatient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId }
    });

    if (!existingPatient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Track changes to medical baseline fields
    const medicalFields = [
      'currentAllergies',
      'currentChronicConditions',
      'currentMedications',
      'bloodType'
    ];

    const historyEntries = [];
    for (const field of medicalFields) {
      if (body[field] !== undefined && body[field] !== existingPatient[field as keyof typeof existingPatient]) {
        historyEntries.push({
          patientId,
          doctorId,
          fieldName: field,
          oldValue: existingPatient[field as keyof typeof existingPatient] as string || null,
          newValue: body[field] || null,
          changedBy: userId,
          changeReason: body.changeReason || null,
        });
      }
    }

    // Update patient
    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        sex: body.sex,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        emergencyContactRelation: body.emergencyContactRelation,
        status: body.status,
        tags: body.tags,
        currentAllergies: body.currentAllergies,
        currentChronicConditions: body.currentChronicConditions,
        currentMedications: body.currentMedications,
        bloodType: body.bloodType,
        generalNotes: body.generalNotes,
        photoUrl: body.photoUrl,
      }
    });

    // Create history entries if any medical fields changed
    if (historyEntries.length > 0) {
      await prisma.patientMedicalHistory.createMany({
        data: historyEntries
      });
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'update_patient',
      resourceType: 'patient',
      resourceId: patientId,
      changes: body,
      request
    });

    return NextResponse.json({ data: patient });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]');
  }
}

// DELETE /api/medical-records/patients/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;

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

    // Soft delete by setting status to archived
    await prisma.patient.update({
      where: { id: patientId },
      data: { status: 'archived' }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'archive_patient',
      resourceType: 'patient',
      resourceId: patientId,
      request
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]');
  }
}
