import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/encounters/:encounterId/versions
export async function GET(
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

    // Get all versions
    const versions = await prisma.encounterVersion.findMany({
      where: { encounterId },
      orderBy: { versionNumber: 'desc' }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_encounter_versions',
      resourceType: 'encounter',
      resourceId: encounterId,
      request
    });

    return NextResponse.json({ data: versions });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/encounters/[encounterId]/versions');
  }
}
