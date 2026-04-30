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

    // Get complete timeline - encounters, media, prescriptions, notes, and formularios
    const [encounters, media, prescriptions, patientNotes, formLinks] = await Promise.all([
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
          media: {
            select: {
              id: true,
              mediaType: true,
              fileName: true,
              fileUrl: true,
              thumbnailUrl: true,
              category: true,
              captureDate: true,
              description: true,
            },
            orderBy: { captureDate: 'desc' },
          },
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
      }),
      prisma.patientNote.findMany({
        where: { patientId, doctorId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, content: true, createdAt: true, updatedAt: true },
      }),
      prisma.appointmentFormLink.findMany({
        where: { status: 'SUBMITTED', doctorId, patientId },
        orderBy: { submittedAt: 'desc' },
        select: {
          id: true,
          templateId: true,
          submittedAt: true,
          booking: {
            select: {
              date: true,
              startTime: true,
              slot: { select: { date: true, startTime: true } },
            },
          },
        },
      }),
    ]);

    // Resolve template names for formularios
    const templateIds = [...new Set(formLinks.map((fl) => fl.templateId))];
    const templates = templateIds.length > 0
      ? await prisma.encounterTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, name: true },
        })
      : [];
    const templateMap = Object.fromEntries(templates.map((t) => [t.id, t.name]));

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
      })),
      ...patientNotes.map(n => ({
        type: 'note',
        date: n.createdAt,
        data: n
      })),
      ...formLinks
        .filter((fl) => fl.submittedAt !== null)
        .map(fl => {
          const appointmentDate = fl.booking?.slot?.date ?? fl.booking?.date ?? null;
          const appointmentTime = fl.booking?.slot?.startTime ?? fl.booking?.startTime ?? null;
          return {
            type: 'formulario',
            date: fl.submittedAt!,
            data: {
              id: fl.id,
              templateName: templateMap[fl.templateId] ?? null,
              submittedAt: fl.submittedAt!,
              appointmentDate: appointmentDate ? appointmentDate.toISOString().split('T')[0] : null,
              appointmentTime,
            },
          };
        }),
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
