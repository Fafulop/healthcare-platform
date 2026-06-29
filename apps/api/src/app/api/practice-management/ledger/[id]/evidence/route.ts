import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/[id]/evidence
// Bank reconciliation evidence for one ledger entry, fetched lazily when the evidence modal opens
// (kept off the list query). Returns the direct 1:1 bank movement and/or the settlement's movement,
// each with its statement (bank / cuenta / periodo).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const movementSelect = {
      id: true, transactionDate: true, description: true, reference: true,
      amount: true, movementType: true,
      bankStatement: { select: { bankName: true, accountNumber: true, periodMonth: true, periodYear: true } },
    };

    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, doctorId: doctor.id },
      select: {
        id: true,
        bankAccount: true,
        bankMovement: { select: movementSelect },
        settlementItem: { select: { id: true, bankMovement: { select: movementSelect } } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        bankAccount: entry.bankAccount,
        bankMovement: entry.bankMovement,
        settlementItem: entry.settlementItem,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching ledger evidence:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
