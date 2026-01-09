import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth, logAudit } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/medical-records/patients/:id/media
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

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('mediaType'); // image, video, audio
    const category = searchParams.get('category'); // wound, x-ray, etc.
    const encounterId = searchParams.get('encounterId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {
      patientId,
      doctorId,
    };

    if (mediaType) {
      where.mediaType = mediaType;
    }

    if (category) {
      where.category = category;
    }

    if (encounterId) {
      where.encounterId = encounterId;
    }

    if (startDate || endDate) {
      where.captureDate = {};
      if (startDate) {
        where.captureDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.captureDate.lte = new Date(endDate);
      }
    }

    // Fetch media
    const media = await prisma.patientMedia.findMany({
      where,
      orderBy: { captureDate: 'desc' },
      include: {
        encounter: {
          select: {
            id: true,
            encounterDate: true,
            encounterType: true,
            chiefComplaint: true,
          }
        }
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'view_media',
      resourceType: 'media',
      request
    });

    return NextResponse.json({ data: media });
  } catch (error) {
    return handleApiError(error, 'GET /api/medical-records/patients/[id]/media');
  }
}

// POST /api/medical-records/patients/:id/media
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

    // Validation
    if (!body.mediaType || !body.fileName || !body.fileUrl || !body.captureDate) {
      return NextResponse.json(
        { error: 'Missing required fields: mediaType, fileName, fileUrl, captureDate' },
        { status: 400 }
      );
    }

    // Validate mediaType
    if (!['image', 'video', 'audio'].includes(body.mediaType)) {
      return NextResponse.json(
        { error: 'Invalid mediaType. Must be: image, video, or audio' },
        { status: 400 }
      );
    }

    // If encounterId is provided, verify it exists and belongs to this patient
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

    // Create media record
    const media = await prisma.patientMedia.create({
      data: {
        patientId,
        doctorId,
        encounterId: body.encounterId || null,
        mediaType: body.mediaType,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        fileSize: body.fileSize || null,
        mimeType: body.mimeType || null,
        thumbnailUrl: body.thumbnailUrl || null,
        category: body.category || null,
        bodyArea: body.bodyArea || null,
        captureDate: new Date(body.captureDate),
        description: body.description || null,
        doctorNotes: body.doctorNotes || null,
        visibility: body.visibility || 'internal',
        uploadedBy: userId,
      }
    });

    // Log audit
    await logAudit({
      patientId,
      doctorId,
      userId,
      userRole: role,
      action: 'upload_media',
      resourceType: 'media',
      resourceId: media.id,
      request
    });

    return NextResponse.json({ data: media }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/medical-records/patients/[id]/media');
  }
}
