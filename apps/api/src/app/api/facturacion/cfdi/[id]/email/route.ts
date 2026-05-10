import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { sendCFDIByEmail } from '@/lib/facturama';

// POST /api/facturacion/cfdi/:id/email - Send CFDI via email
export async function POST(
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

    const body = await request.json();
    const { email } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Email del destinatario inválido o no proporcionado' },
        { status: 400 }
      );
    }

    await sendCFDIByEmail(cfdi.facturamaId, email);

    return NextResponse.json({
      data: { sent: true, email }
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      return NextResponse.json(
        { error: `Error al enviar email: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error sending CFDI email:', error);
    return NextResponse.json({ error: 'Error al enviar factura por email' }, { status: 500 });
  }
}
