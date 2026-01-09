import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/media/:mediaId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, mediaId } = await params;

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

    // Fetch media
    const media = await prisma.patientMedia.findFirst({
      where: {
        id: mediaId,
        patientId,
        doctorId
      },
      include: {
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
          }
        }
      }
    });

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_media_item',
      resourceType: 'media',
      resourceId: mediaId,
      request
    });

    return NextResponse.json({ data: media });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/media/[mediaId]');
  }
}

// PUT /api/medical-records/patients/:id/media/:mediaId
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, mediaId } = await params;
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

    // Verify media exists and belongs to this patient
    const existingMedia = await prisma.patientMedia.findFirst({
      where: {
        id: mediaId,
        patientId,
        doctorId
      }
    });

    if (!existingMedia) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
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

    // Update media (only allow updating metadata, not the actual file)
    const media = await prisma.patientMedia.update({
      where: { id: mediaId },
      data: {
        encounterId: body.encounterId !== undefined ? body.encounterId : undefined,
        category: body.category !== undefined ? body.category : undefined,
        bodyArea: body.bodyArea !== undefined ? body.bodyArea : undefined,
        captureDate: body.captureDate ? new Date(body.captureDate) : undefined,
        description: body.description !== undefined ? body.description : undefined,
        doctorNotes: body.doctorNotes !== undefined ? body.doctorNotes : undefined,
        visibility: body.visibility !== undefined ? body.visibility : undefined,
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'update_media',
      resourceType: 'media',
      resourceId: mediaId,
      changes: body,
      request
    });

    return NextResponse.json({ data: media });
  } catch (error) {
    return handleApiError(error, 'PUT /api/medical-records/patients/[id]/media/[mediaId]');
  }
}

// DELETE /api/medical-records/patients/:id/media/:mediaId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { doctorId, userId, role } = await requireDoctorAuth(request);
    const { id: patientId, mediaId } = await params;

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

    // Verify media exists and belongs to this patient
    const media = await prisma.patientMedia.findFirst({
      where: {
        id: mediaId,
        patientId,
        doctorId
      }
    });

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    // Delete media record (Note: This does not delete the actual file from storage)
    // You may want to implement file deletion from UploadThing here
    await prisma.patientMedia.delete({
      where: { id: mediaId }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'delete_media',
      resourceType: 'media',
      resourceId: mediaId,
      request
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/medical-records/patients/[id]/media/[mediaId]');
  }
}
