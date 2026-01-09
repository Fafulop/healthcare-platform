import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/encounters/:encounterId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; encounterId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, encounterId } = await params;

    const encounter = await prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        doctorId
      },
      include: {
        patient: {
          select: {
            id: true,
            internalId: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            sex: true,
          }
        }
      }
    });

    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found' },
        { status: 404 }
      );
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_encounter',
      resourceType: 'encounter',
      resourceId: encounterId,
      request
    });

    return NextResponse.json({ data: encounter });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/encounters/[encounterId]');
  }
}

// PUT /api/medical-records/patients/:id/encounters/:encounterId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; encounterId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, encounterId } = await params;
    const body = await request.json();

    // Verify encounter belongs to doctor
    const existingEncounter = await prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        doctorId
      }
    });

    if (!existingEncounter) {
      return NextResponse.json(
        { error: 'Encounter not found' },
        { status: 404 }
      );
    }

    // Create version snapshot before updating
    const versionCount = await prisma.encounterVersion.count({
      where: { encounterId }
    });

    await prisma.encounterVersion.create({
      data: {
        encounterId,
        versionNumber: versionCount + 1,
        encounterData: existingEncounter as any,
        createdBy: userId,
        changeReason: body.amendmentReason || 'Updated encounter',
      }
    });

    // Update encounter
    const encounter = await prisma.clinicalEncounter.update({
      where: { id: encounterId },
      data: {
        encounterDate: body.encounterDate ? new Date(body.encounterDate) : undefined,
        encounterType: body.encounterType,
        chiefComplaint: body.chiefComplaint,
        location: body.location,
        status: body.status,
        clinicalNotes: body.clinicalNotes,
        subjective: body.subjective,
        objective: body.objective,
        assessment: body.assessment,
        plan: body.plan,
        vitalsBloodPressure: body.vitalsBloodPressure,
        vitalsHeartRate: body.vitalsHeartRate,
        vitalsTemperature: body.vitalsTemperature,
        vitalsWeight: body.vitalsWeight,
        vitalsHeight: body.vitalsHeight,
        vitalsOxygenSat: body.vitalsOxygenSat,
        vitalsOther: body.vitalsOther,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        followUpNotes: body.followUpNotes,
        amendedAt: new Date(),
        amendmentReason: body.amendmentReason,
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'update_encounter',
      resourceType: 'encounter',
      resourceId: encounterId,
      changes: body,
      request
    });

    return NextResponse.json({ data: encounter });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]/encounters/[encounterId]');
  }
}

// DELETE /api/medical-records/patients/:id/encounters/:encounterId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; encounterId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, encounterId } = await params;

    // Verify encounter belongs to doctor
    const encounter = await prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        doctorId
      }
    });

    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found' },
        { status: 404 }
      );
    }

    // Delete encounter
    await prisma.clinicalEncounter.delete({
      where: { id: encounterId }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'delete_encounter',
      resourceType: 'encounter',
      resourceId: encounterId,
      request
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/encounters/[encounterId]');
  }
}
