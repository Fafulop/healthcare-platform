import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// POST /api/practice-management/ledger/:id/facturas
// Save a PDF invoice metadata after upload to UploadThing
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
    const { fileUrl, fileName, fileSize, fileType, folio, uuid, rfcEmisor, rfcReceptor, total, notes } = body;

    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: 'URL y nombre de archivo requeridos' },
        { status: 400 }
      );
    }

    // Create factura record
    const factura = await prisma.ledgerFactura.create({
      data: {
        ledgerEntryId: entryId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        fileType: fileType || 'application/pdf',
        folio: folio || null,
        uuid: uuid || null,
        rfcEmisor: rfcEmisor || null,
        rfcReceptor: rfcReceptor || null,
        total: total ? parseFloat(total) : null,
        notes: notes || null,
        uploadedBy: doctor.userId
      }
    });

    return NextResponse.json({ data: factura }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving factura:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error al guardar factura' },
      { status: 500 }
    );
  }
}

// GET /api/practice-management/ledger/:id/facturas
// Get all PDF invoices for a ledger entry
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

    // Get facturas
    const facturas = await prisma.ledgerFactura.findMany({
      where: {
        ledgerEntryId: entryId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ data: facturas });
  } catch (error: any) {
    console.error('Error fetching facturas:', error);

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
