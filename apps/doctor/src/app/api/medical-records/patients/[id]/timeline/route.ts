import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/timeline
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

    // Get complete timeline - encounters, media and prescriptions
    const [encounters, media, prescriptions] = await Promise.all([
      prisma.clinicalEncounter.findMany({
        where: { patientId, doctorId },
        orderBy: { encounterDate: 'desc' },
        select: {
          id: true,
          encounterDate: true,
          encounterType: true,
          chiefComplaint: true,
          status: true,
          subjective: true,
          objective: true,
          assessment: true,
          plan: true,
          clinicalNotes: true,
          vitalsBloodPressure: true,
          vitalsHeartRate: true,
          vitalsTemperature: true,
          vitalsWeight: true,
          vitalsHeight: true,
          vitalsOxygenSat: true,
          vitalsOther: true,
          location: true,
          followUpDate: true,
          followUpNotes: true,
          templateId: true,
          customData: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          amendedAt: true,
        }
      }),
      prisma.patientMedia.findMany({
        where: { patientId, doctorId },
        orderBy: { captureDate: 'desc' },
        select: {
          id: true,
          mediaType: true,
          fileName: true,
          fileUrl: true,
          thumbnailUrl: true,
          category: true,
          bodyArea: true,
          captureDate: true,
          description: true,
          doctorNotes: true,
          encounterId: true,
          createdAt: true,
        }
      }),
      prisma.prescription.findMany({
        where: { patientId, doctorId },
        orderBy: { prescriptionDate: 'desc' },
        select: {
          id: true,
          prescriptionDate: true,
          status: true,
          diagnosis: true,
          medications: {
            select: { id: true, drugName: true },
            orderBy: { order: 'asc' }
          },
          createdAt: true,
        }
      })
    ]);

    // Build unified timeline
    const timeline = [
      ...encounters.map(e => ({
        type: 'encounter',
        date: e.encounterDate,
        data: e
      })),
      ...media.map(m => ({
        type: 'media',
        date: m.captureDate,
        data: m
      })),
      ...prescriptions.map(p => ({
        type: 'prescription',
        date: p.prescriptionDate,
        data: p
      }))
    ];

    // Sort by date (most recent first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_timeline',
      resourceType: 'patient',
      resourceId: patientId,
      request
    });

    return NextResponse.json({
      data: {
        timeline,
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
        }
      }
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/timeline');
  }
}
