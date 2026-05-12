import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { cancelCFDI } from '@/lib/facturama';

// POST /api/facturacion/cfdi/:id/cancel - Cancel a CFDI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cfdiId = parseInt(id);

  try {
    const { doctor } = await getAuthenticatedDoctor(request);

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

    if (cfdi.status !== 'active') {
      return NextResponse.json(
        { error: `No se puede cancelar un CFDI con status: ${cfdi.status}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { motive, uuidReplacement } = body;

    // Validate motive
    const validMotives = ['01', '02', '03', '04'];
    if (!motive || !validMotives.includes(motive)) {
      return NextResponse.json(
        { error: 'Motivo de cancelación requerido (01, 02, 03, 04)' },
        { status: 400 }
      );
    }

    // Motive 01 requires a replacement UUID
    if (motive === '01' && !uuidReplacement) {
      return NextResponse.json(
        { error: 'Motivo 01 requiere UUID del CFDI que sustituye' },
        { status: 400 }
      );
    }

    // Cancel in Facturama
    const result = await cancelCFDI(cfdi.facturamaId, profile.rfc, motive, uuidReplacement);

    // Reject if Facturama says it's not cancelable (e.g., has linked documents)
    if (result.Status === 'active' && result.IsCancelable?.toLowerCase().includes('no cancelable')) {
      return NextResponse.json(
        { error: 'Este CFDI no puede ser cancelado (tiene documentos relacionados activos)', details: result },
        { status: 400 }
      );
    }

    // Determine local status based on Facturama response
    const isPending = result.Status === 'pending' ||
      result.IsCancelable?.toLowerCase().includes('con aceptacion');
    const newStatus = isPending ? 'cancellation_pending' : 'cancelled';

    // Update status in our DB
    await prisma.cfdiEmitted.update({
      where: { id: cfdi.id },
      data: {
        status: newStatus,
        cancelledAt: isPending ? null : new Date(),
        cancelMotivo: motive,
      },
    });

    return NextResponse.json({
      data: {
        status: newStatus,
        motive,
        isCancelable: result.IsCancelable,
        expirationDate: result.ExpirationDate,
        acuseStatus: result.AcuseStatus,
        acuseStatusDetails: result.AcuseStatusDetails,
        facturamaResponse: result,
      }
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      console.error('Facturama cancel error:', error.details);

      // If SAT returns "en proceso", mark as pending
      if (error.details?.Status === 'pending' || error.message?.includes('proceso')) {
        await prisma.cfdiEmitted.update({
          where: { id: cfdiId },
          data: { status: 'cancellation_pending' },
        });
        return NextResponse.json({
          data: { status: 'cancellation_pending', message: 'La cancelación está en proceso ante el SAT' }
        });
      }

      return NextResponse.json(
        { error: `Error al cancelar CFDI: ${error.message}`, details: error.details },
        { status: error.status >= 400 && error.status < 500 ? error.status : 502 }
      );
    }
    console.error('Error cancelling CFDI:', error);
    return NextResponse.json({ error: 'Error al cancelar factura' }, { status: 500 });
  }
}
