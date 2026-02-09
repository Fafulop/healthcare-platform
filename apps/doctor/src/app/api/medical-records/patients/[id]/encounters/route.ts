import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { logEncounterCreated } from '@/lib/activity-logger';
import {
  handleApiError,
  validateRequired,
  validateEncounterDate,
  validateEnum
} from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/encounters
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

    const encounters = await prisma.clinicalEncounter.findMany({
      where: {
        patientId,
        doctorId
      },
      orderBy: { encounterDate: 'desc' }
    });

    return NextResponse.json({ data: encounters });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/encounters');
  }
}

// POST /api/medical-records/patients/:id/encounters
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId } = await params;
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

    // Validate required fields - chiefComplaint is only required for standard templates
    // Custom templates use customData with their own field definitions
    const isCustomTemplate = !!body.customData;
    const requiredFields = isCustomTemplate
      ? ['encounterDate', 'encounterType']
      : ['encounterDate', 'encounterType', 'chiefComplaint'];
    validateRequired(body, requiredFields);

    // Validate encounter date
    const encounterDate = validateEncounterDate(body.encounterDate);

    // Validate encounter type
    validateEnum(
      body.encounterType,
      ['consultation', 'follow-up', 'emergency', 'telemedicine'] as const,
      'encounterType'
    );

    // Validate status if provided
    if (body.status) {
      validateEnum(
        body.status,
        ['draft', 'completed', 'amended'] as const,
        'status'
      );
    }

    const encounter = await prisma.clinicalEncounter.create({
      data: {
        patientId,
        doctorId,
        encounterDate,
        encounterType: body.encounterType,
        chiefComplaint: body.chiefComplaint,
        location: body.location,
        status: body.status || 'draft',
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
        templateId: body.templateId || null,
        customData: body.customData || null,
        createdBy: userId,
      }
    });

    // Update patient's last visit date
    await prisma.patient.update({
      where: { id: patientId },
      data: { lastVisitDate: new Date(body.encounterDate) }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'create_encounter',
      resourceType: 'encounter',
      resourceId: encounter.id,
      request
    });

    // Log activity for dashboard
    logEncounterCreated({
      doctorId,
      encounterId: encounter.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      encounterType: body.encounterType,
      chiefComplaint: body.chiefComplaint,
      userId,
    });

    return NextResponse.json({ data: encounter }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/encounters');
  }
}
