import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/history
export async function GET(
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

    // Get medical history with pagination support
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [history, total] = await Promise.all([
      prisma.patientMedicalHistory.findMany({
        where: {
          patientId,
          doctorId
        },
        orderBy: { changedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.patientMedicalHistory.count({
        where: {
          patientId,
          doctorId
        }
      })
    ]);

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_medical_history',
      resourceType: 'patient',
      resourceId: patientId,
      request
    });

    return NextResponse.json({
      data: history,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + history.length < total
      }
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/history');
  }
}
