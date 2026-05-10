import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { getCFDIXml } from '@/lib/facturama';

// GET /api/facturacion/cfdi/:id/xml - Download CFDI XML
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

    // Get XML from Facturama (returns base64)
    const xmlBase64 = await getCFDIXml(cfdi.facturamaId);
    const xmlContent = Buffer.from(xmlBase64, 'base64').toString('utf-8');

    // Optionally store XML content in our DB for future reference
    if (!cfdi.xmlContent) {
      await prisma.cfdiEmitted.update({
        where: { id: cfdi.id },
        data: { xmlContent },
      });
    }

    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="CFDI_${cfdi.uuid}.xml"`,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al obtener XML: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error fetching CFDI XML:', error);
    return NextResponse.json({ error: 'Error al obtener XML' }, { status: 500 });
  }
}
