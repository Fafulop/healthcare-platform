import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { getCFDIHtml } from '@/lib/facturama';

// GET /api/facturacion/cfdi/:id/html - Download CFDI as HTML (in-browser preview)
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

    const htmlBase64 = await getCFDIHtml(cfdi.facturamaId);
    const htmlBuffer = Buffer.from(htmlBase64, 'base64');

    return new NextResponse(htmlBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': String(htmlBuffer.length),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al obtener HTML: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error fetching CFDI HTML:', error);
    return NextResponse.json({ error: 'Error al obtener HTML' }, { status: 500 });
  }
}
