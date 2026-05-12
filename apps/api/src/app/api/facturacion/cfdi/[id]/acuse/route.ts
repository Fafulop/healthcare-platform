import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { getCancellationAcuse } from '@/lib/facturama';

// GET /api/facturacion/cfdi/:id/acuse - Download cancellation acknowledgment (acuse de cancelación)
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

    if (cfdi.status !== 'cancelled' && cfdi.status !== 'cancellation_pending') {
      return NextResponse.json(
        { error: 'Este CFDI no ha sido cancelado' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'html' ? 'html' : 'pdf';

    const acuseBase64 = await getCancellationAcuse(cfdi.facturamaId, format);
    const acuseBuffer = Buffer.from(acuseBase64, 'base64');

    const contentType = format === 'html' ? 'text/html; charset=utf-8' : 'application/pdf';
    const ext = format === 'html' ? 'html' : 'pdf';

    return new NextResponse(acuseBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="Acuse_${cfdi.uuid}.${ext}"`,
        'Content-Length': String(acuseBuffer.length),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al obtener acuse de cancelación: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error fetching cancellation acuse:', error);
    return NextResponse.json({ error: 'Error al obtener acuse de cancelación' }, { status: 500 });
  }
}
