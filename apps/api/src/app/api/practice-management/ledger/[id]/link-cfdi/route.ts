import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// POST /api/practice-management/ledger/:id/link-cfdi
// Link a SAT CFDI to an existing ledger entry
// Body: { uuid: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);

    if (isNaN(entryId)) {
      return NextResponse.json({ error: 'ID de entrada inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { uuid } = body;

    if (!uuid || typeof uuid !== 'string') {
      return NextResponse.json({ error: 'Se requiere UUID del CFDI' }, { status: 400 });
    }

    // Verify the entry belongs to the doctor and has no CFDI linked
    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, doctorId: doctor.id },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    if (entry.satCfdiUuid) {
      return NextResponse.json(
        { error: 'Este movimiento ya tiene un CFDI vinculado' },
        { status: 409 }
      );
    }

    // Verify the CFDI exists, belongs to the doctor, and is not already linked
    const cfdi = await prisma.satCfdiMetadata.findFirst({
      where: { doctorId: doctor.id, uuid, satStatus: 'Vigente' },
    });

    if (!cfdi) {
      return NextResponse.json({ error: 'CFDI no encontrado o no vigente' }, { status: 404 });
    }

    const alreadyLinked = await prisma.ledgerEntry.findFirst({
      where: { doctorId: doctor.id, satCfdiUuid: uuid },
      select: { id: true },
    });

    if (alreadyLinked) {
      return NextResponse.json(
        { error: 'Este CFDI ya está vinculado a otro movimiento' },
        { status: 409 }
      );
    }

    // Fetch XML detail if available to create a LedgerFacturaXml record
    const detail = await prisma.satCfdiDetail.findFirst({
      where: { doctorId: doctor.id, uuid },
      include: { conceptos: true },
    });

    // Link in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update the ledger entry
      const updatedEntry = await tx.ledgerEntry.update({
        where: { id: entryId },
        data: {
          satCfdiUuid: uuid,
          hasFactura: true,
        },
      });

      // Create LedgerFacturaXml from detail if available
      if (detail) {
        await tx.ledgerFacturaXml.create({
          data: {
            ledgerEntryId: entryId,
            fileName: `CFDI-${uuid}.xml`,
            fileUrl: '',
            uuid,
            rfcEmisor: cfdi.issuerRfc,
            rfcReceptor: cfdi.receiverRfc,
            total: detail.total,
            subtotal: detail.subtotal,
            iva: detail.ivaTrasladado,
            fecha: new Date(cfdi.issuedAt),
            metodoPago: detail.metodoPago,
            formaPago: detail.formaPago,
            moneda: detail.moneda,
            folio: detail.folio,
          },
        });
      }

      return updatedEntry;
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, satCfdiUuid: updated.satCfdiUuid, hasFactura: updated.hasFactura },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Este CFDI ya está vinculado' }, { status: 409 });
    }
    console.error('Error linking CFDI to ledger entry:', error);
    return NextResponse.json({ error: 'Error al vincular CFDI' }, { status: 500 });
  }
}
