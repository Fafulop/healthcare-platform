import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { parseCFDIXml } from '@/lib/cfdiParser';

// POST /api/practice-management/ledger/:id/facturas-xml
// Parse and save an XML invoice (CFDI) after upload to UploadThing
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

    // Parse request body (file metadata and XML content from client)
    const body = await request.json();
    const { fileUrl, fileName, fileSize, xmlContent, notes } = body;

    if (!fileUrl || !fileName || !xmlContent) {
      return NextResponse.json(
        { error: 'URL, nombre de archivo y contenido XML requeridos' },
        { status: 400 }
      );
    }

    // Parse CFDI XML
    let cfdiData;
    try {
      cfdiData = await parseCFDIXml(xmlContent);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Error al parsear XML: ${error.message}` },
        { status: 400 }
      );
    }

    // Check if UUID already exists (must be globally unique)
    const existingXml = await prisma.ledgerFacturaXml.findUnique({
      where: { uuid: cfdiData.uuid }
    });

    if (existingXml) {
      return NextResponse.json(
        { error: 'UUID duplicado: esta factura ya existe en el sistema' },
        { status: 409 }
      );
    }

    // Create factura XML record with parsed data
    const facturaXml = await prisma.ledgerFacturaXml.create({
      data: {
        ledgerEntryId: entryId,
        fileName,
        fileUrl,
        fileSize: fileSize || 0,
        xmlContent,
        folio: cfdiData.folio,
        uuid: cfdiData.uuid,
        rfcEmisor: cfdiData.rfcEmisor,
        rfcReceptor: cfdiData.rfcReceptor,
        total: cfdiData.total,
        subtotal: cfdiData.subtotal,
        iva: cfdiData.iva,
        fecha: cfdiData.fecha,
        metodoPago: cfdiData.metodoPago,
        formaPago: cfdiData.formaPago,
        moneda: cfdiData.moneda,
        notes: notes || null,
        uploadedBy: doctor.userId
      }
    });

    return NextResponse.json(
      {
        data: facturaXml,
        parsed: {
          uuid: cfdiData.uuid,
          folio: cfdiData.folio,
          total: cfdiData.total,
          rfcEmisor: cfdiData.rfcEmisor,
          rfcReceptor: cfdiData.rfcReceptor,
          nombreEmisor: cfdiData.nombreEmisor,
          nombreReceptor: cfdiData.nombreReceptor
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error saving XML factura:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    if (error.message.includes('UUID') || error.message.includes('duplicado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    if (error.message.includes('archivo') || error.message.includes('XML') || error.message.includes('parsear')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al guardar factura XML' },
      { status: 500 }
    );
  }
}

// GET /api/practice-management/ledger/:id/facturas-xml
// Get all XML invoices for a ledger entry
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

    // Get facturas XML
    const facturasXml = await prisma.ledgerFacturaXml.findMany({
      where: {
        ledgerEntryId: entryId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ data: facturasXml });
  } catch (error: any) {
    console.error('Error fetching facturas XML:', error);

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
