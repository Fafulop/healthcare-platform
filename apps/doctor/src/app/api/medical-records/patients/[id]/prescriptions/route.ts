import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

/**
 * GET /api/medical-records/patients/[id]/prescriptions
 * List all prescriptions for a patient
 */
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

    const { searchParams } = new URL(request.url);

    // Query parameters for filtering
    const status = searchParams.get('status');
    const encounterId = searchParams.get('encounterId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // Build where clause
    const where: any = {
      patientId,
      doctorId,
    };

    if (status) {
      where.status = status;
    }

    if (encounterId) {
      where.encounterId = encounterId;
    }

    if (startDate || endDate) {
      where.prescriptionDate = {};
      if (startDate) {
        where.prescriptionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.prescriptionDate.lte = new Date(endDate);
      }
    }

    // Filter out expired prescriptions unless explicitly requested
    if (!includeExpired) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ];
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        medications: {
          orderBy: { order: 'asc' }
        },
        encounter: {
          select: {
            id: true,
            encounterDate: true,
            chiefComplaint: true,
          }
        }
      },
      orderBy: { prescriptionDate: 'desc' },
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_prescriptions',
      resourceType: 'prescription',
      request
    });

    return NextResponse.json({ data: prescriptions });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/prescriptions');
  }
}

/**
 * POST /api/medical-records/patients/[id]/prescriptions
 * Create a new prescription (draft status)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;
    const body = await request.json();

    // Basic validation
    if (!body.prescriptionDate || !body.doctorFullName || !body.doctorLicense) {
      return NextResponse.json(
        { error: 'Missing required fields: prescriptionDate, doctorFullName, doctorLicense' },
        { status: 400 }
      );
    }

    // Verify patient exists and belongs to this doctor
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        doctorId,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found or access denied' },
        { status: 404 }
      );
    }

    // If encounterId provided, verify it exists and belongs to this patient
    if (body.encounterId) {
      const encounter = await prisma.clinicalEncounter.findFirst({
        where: {
          id: body.encounterId,
          patientId,
          doctorId,
        },
      });

      if (!encounter) {
        return NextResponse.json(
          { error: 'Encounter not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Create prescription with draft status
    const prescription = await prisma.prescription.create({
      data: {
        patientId,
        doctorId,
        encounterId: body.encounterId || null,
        prescriptionDate: new Date(body.prescriptionDate),
        status: 'draft',
        doctorFullName: body.doctorFullName,
        doctorLicense: body.doctorLicense,
        diagnosis: body.diagnosis || null,
        clinicalNotes: body.clinicalNotes || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        versionNumber: 1,
      },
      include: {
        medications: true,
      },
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'create_prescription',
      resourceType: 'prescription',
      resourceId: prescription.id,
      request
    });

    return NextResponse.json({ data: prescription }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/prescriptions');
  }
}
