import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// POST /api/practice-management/ledger/merge
// Merge two ledger entries: transfer enrichment from source → target, re-link relations, delete source
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { targetId, sourceId } = body;

    if (!targetId || !sourceId || typeof targetId !== 'number' || typeof sourceId !== 'number') {
      return NextResponse.json({ error: 'targetId y sourceId son requeridos (números)' }, { status: 400 });
    }

    if (targetId === sourceId) {
      return NextResponse.json({ error: 'No se puede fusionar un movimiento consigo mismo' }, { status: 400 });
    }

    // Verify both entries exist and belong to this doctor
    const [target, source] = await Promise.all([
      prisma.ledgerEntry.findFirst({ where: { id: targetId, doctorId: doctor.id } }),
      prisma.ledgerEntry.findFirst({ where: { id: sourceId, doctorId: doctor.id } }),
    ]);

    if (!target) {
      return NextResponse.json({ error: 'Movimiento destino no encontrado' }, { status: 404 });
    }
    if (!source) {
      return NextResponse.json({ error: 'Movimiento origen no encontrado' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Build enrichment data: transfer fields from source that target is missing
      const enrichData: Record<string, any> = {};

      // Evidence flags — upgrade to true, never downgrade
      if (source.hasFactura && !target.hasFactura) {
        enrichData.hasFactura = true;
        if (source.satCfdiUuid && !target.satCfdiUuid) {
          enrichData.satCfdiUuid = source.satCfdiUuid;
        }
      }
      if (source.hasComprobante && !target.hasComprobante) {
        enrichData.hasComprobante = true;
      }

      // Bank data
      if (source.bankAccount && !target.bankAccount) {
        enrichData.bankAccount = source.bankAccount;
      }
      if (source.bankMovementId && !target.bankMovementId) {
        enrichData.bankMovementId = source.bankMovementId;
      }

      // Area/categorization
      if (source.area && !target.area) {
        enrichData.area = source.area;
        if (source.subarea) enrichData.subarea = source.subarea;
      }

      // Service link
      if (source.serviceId && !target.serviceId) {
        enrichData.serviceId = source.serviceId;
        enrichData.serviceName = source.serviceName;
      }

      // Payment status — upgrade PENDING → PARTIAL → PAID
      const statusRank: Record<string, number> = { PENDING: 0, PARTIAL: 1, PAID: 2 };
      const targetRank = statusRank[target.paymentStatus || 'PENDING'] ?? 0;
      const sourceRank = statusRank[source.paymentStatus || 'PENDING'] ?? 0;
      if (sourceRank > targetRank) {
        enrichData.paymentStatus = source.paymentStatus;
        enrichData.amountPaid = source.amountPaid;
      }

      // Auto-link metadata — clear review flag since user explicitly merged
      enrichData.needsReview = false;

      // 2. Update target with enrichment
      if (Object.keys(enrichData).length > 0) {
        await tx.ledgerEntry.update({
          where: { id: targetId },
          data: enrichData,
        });
      }

      // 3. Re-link BankMovement (1:1) from source to target
      const sourceBankMovement = await tx.bankMovement.findUnique({
        where: { ledgerEntryId: sourceId },
      });
      if (sourceBankMovement) {
        // Check if target already has a bank movement
        const targetBankMovement = await tx.bankMovement.findUnique({
          where: { ledgerEntryId: targetId },
        });
        if (!targetBankMovement) {
          await tx.bankMovement.update({
            where: { id: sourceBankMovement.id },
            data: { ledgerEntryId: targetId },
          });
        }
        // If target already has one, leave the source's bank movement unlinked
        // (it will be cleaned up when source is deleted — matchStatus set to unmatched)
        else {
          await tx.bankMovement.update({
            where: { id: sourceBankMovement.id },
            data: {
              ledgerEntryId: null,
              matchStatus: 'unmatched',
              matchConfidence: null,
              matchedAt: null,
              matchedBy: null,
            },
          });
        }
      }

      // 4. Re-link CfdiEmitted records from source to target
      await tx.cfdiEmitted.updateMany({
        where: { ledgerEntryId: sourceId },
        data: { ledgerEntryId: targetId },
      });

      // 5. Re-link attachments
      await tx.ledgerAttachment.updateMany({
        where: { ledgerEntryId: sourceId },
        data: { ledgerEntryId: targetId },
      });

      // 6. Re-link facturas and XML
      await tx.ledgerFactura.updateMany({
        where: { ledgerEntryId: sourceId },
        data: { ledgerEntryId: targetId },
      });
      await tx.ledgerFacturaXml.updateMany({
        where: { ledgerEntryId: sourceId },
        data: { ledgerEntryId: targetId },
      });

      // 7. Delete source entry
      await tx.ledgerEntry.delete({ where: { id: sourceId } });

      // 8. Return updated target
      return tx.ledgerEntry.findUnique({ where: { id: targetId } });
    }, { timeout: 30000 });

    return NextResponse.json({
      data: result,
      message: `Movimiento ${source.internalId} fusionado en ${target.internalId}`,
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error merging ledger entries:', error);
    return NextResponse.json({ error: 'Error al fusionar movimientos', details: error.message }, { status: 500 });
  }
}
