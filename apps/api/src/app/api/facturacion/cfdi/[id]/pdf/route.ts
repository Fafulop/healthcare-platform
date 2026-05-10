import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { getCFDIPdf } from '@/lib/facturama';

// GET /api/facturacion/cfdi/:id/pdf - Download CFDI PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const cfdiId = parseInt(id);

    if (isNaN(cfdiId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Perfil fiscal no encontrado' }, { status: 404 });
    }

    const cfdi = await prisma.cfdiEmitted.findFirst({
      where: { id: cfdiId, fiscalProfileId: profile.id },
    });

    if (!cfdi) {
      return NextResponse.json({ error: 'CFDI no encontrado' }, { status: 404 });
    }

    // Get PDF from Facturama (returns base64)
    const pdfBase64 = await getCFDIPdf(cfdi.facturamaId);
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CFDI_${cfdi.uuid}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al obtener PDF: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error fetching CFDI PDF:', error);
    return NextResponse.json({ error: 'Error al obtener PDF' }, { status: 500 });
  }
}
