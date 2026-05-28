/**
 * POST /api/bank-statement-import
 *
 * Bulk-creates LedgerEntries from user-reviewed bank statement PDF items.
 * Each item becomes a LedgerEntry with origin='banco'.
 *
 * Request:  { entries: ImportEntry[], bank, periodMonth, periodYear, fileUrl }
 * Response: { success, data: { created: number, internalIds: string[] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { prisma } from '@healthcare/database';

async function generateLedgerInternalId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  doctorId: string,
  entryType: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = entryType === 'ingreso' ? `ING-${year}-` : `EGR-${year}-`;
  const last = await tx.ledgerEntry.findFirst({
    where: { doctorId, internalId: { startsWith: prefix } },
    orderBy: { internalId: 'desc' },
    select: { internalId: true },
  });
  if (!last?.internalId) return `${prefix}001`;
  const parts = last.internalId.split('-');
  const lastNum = parseInt(parts[parts.length - 1], 10);
  const next = isNaN(lastNum) ? 1 : lastNum + 1;
  return `${prefix}${next.toString().padStart(3, '0')}`;
}

interface ImportEntry {
  transactionDate: string;
  concept: string;
  amount: number;
  entryType: 'ingreso' | 'egreso';
  area: string;
  subarea: string;
  formaDePago: string;
  reference?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const body = await request.json();
    const { entries, bank, periodMonth, periodYear, fileUrl } = body as {
      entries: ImportEntry[];
      bank?: string;
      periodMonth?: number;
      periodYear?: number;
      fileUrl?: string;
    };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere al menos un movimiento' },
        { status: 400 },
      );
    }

    if (entries.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Máximo 500 movimientos por importación' },
        { status: 400 },
      );
    }

    // Validate each entry
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e.amount || e.amount <= 0) {
        return NextResponse.json(
          { success: false, error: `Movimiento ${i + 1}: monto inválido` },
          { status: 400 },
        );
      }
      if (!e.entryType || !['ingreso', 'egreso'].includes(e.entryType)) {
        return NextResponse.json(
          { success: false, error: `Movimiento ${i + 1}: tipo debe ser ingreso o egreso` },
          { status: 400 },
        );
      }
      if (!e.transactionDate) {
        return NextResponse.json(
          { success: false, error: `Movimiento ${i + 1}: fecha requerida` },
          { status: 400 },
        );
      }
    }

    // Bulk create in an interactive transaction (IDs generated sequentially inside)
    const bankLabel = bank || 'PDF';
    const periodLabel = periodMonth && periodYear ? `${periodMonth}/${periodYear}` : '';

    const created = await prisma.$transaction(async (tx) => {
      const results: { id: number; internalId: string }[] = [];
      for (const e of entries) {
        const internalId = await generateLedgerInternalId(tx, doctorId, e.entryType);
        const entry = await tx.ledgerEntry.create({
          data: {
            doctorId,
            internalId,
            entryType: e.entryType,
            amount: e.amount,
            concept: (e.concept || '').substring(0, 500),
            transactionDate: new Date(e.transactionDate.split('T')[0] + 'T12:00:00'),
            area: e.area || null,
            subarea: e.subarea || null,
            formaDePago: e.formaDePago || 'transferencia',
            bankMovementId: e.reference || null,
            transactionType: 'N/A',
            amountPaid: e.amount,
            paymentStatus: 'PAID',
            origin: 'banco',
            hasComprobante: true,
            porRealizar: false,
          },
          select: { id: true, internalId: true },
        });
        results.push(entry);
      }
      return results;
    });

    console.log(`[Bank PDF Import] Doctor: ${doctorId}, Created ${created.length} entries from ${bankLabel} ${periodLabel}`);

    return NextResponse.json({
      success: true,
      data: {
        created: created.length,
        internalIds: created.map((c) => c.internalId),
      },
    });
  } catch (error: any) {
    console.error('[Bank PDF Import Error]', error);
    return handleApiError(error, 'POST /api/bank-statement-import');
  }
}
