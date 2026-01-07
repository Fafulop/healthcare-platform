import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// POST /api/practice-management/ledger/:id/attachments
// Save a file attachment metadata after upload to UploadThing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'ID de entrada inválido' },
        { status: 400 }
      );
    }

    // Verify entry exists and belongs to doctor
    const entry = await prisma.ledgerEntry.findFirst({
      where: {
        id: entryId,
        doctorId: doctor.id
      }
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Parse request body (file metadata from UploadThing)
    const body = await request.json();
    const { fileUrl, fileName, fileSize, fileType } = body;

    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: 'URL y nombre de archivo requeridos' },
        { status: 400 }
      );
    }

    // Create attachment record
    const attachment = await prisma.ledgerAttachment.create({
      data: {
        ledgerEntryId: entryId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        fileType: fileType || 'application/octet-stream',
        attachmentType: 'file',
        uploadedBy: doctor.userId
      }
    });

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving attachment:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error al guardar archivo' },
      { status: 500 }
    );
  }
}

// GET /api/practice-management/ledger/:id/attachments
// Get all attachments for a ledger entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'ID de entrada inválido' },
        { status: 400 }
      );
    }

    // Verify entry exists and belongs to doctor
    const entry = await prisma.ledgerEntry.findFirst({
      where: {
        id: entryId,
        doctorId: doctor.id
      }
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Entrada no encontrada' },
        { status: 404 }
      );
    }

    // Get attachments
    const attachments = await prisma.ledgerAttachment.findMany({
      where: {
        ledgerEntryId: entryId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ data: attachments });
  } catch (error: any) {
    console.error('Error fetching attachments:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
