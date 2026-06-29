import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { revertEntryEffects } from '@/lib/bank-reversibility';

// GET /api/practice-management/conciliacion-bancaria/[id]
// Get statement detail with all movements
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const statementId = parseInt(id);
    if (isNaN(statementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        movements: {
          orderBy: { transactionDate: 'asc' },
          include: {
            ledgerEntry: {
              select: {
                id: true,
                concept: true,
                amount: true,
                entryType: true,
                area: true,
                subarea: true,
                transactionDate: true,
              },
            },
            settlementItems: {
              select: {
                id: true,
                ledgerEntry: {
                  select: {
                    id: true,
                    concept: true,
                    amount: true,
                    entryType: true,
                    transactionDate: true,
                    counterpartyName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }
    if (statement.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ data: statement });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching bank statement:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/practice-management/conciliacion-bancaria/[id]
// Delete a statement and all its movements (cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const statementId = parseInt(id);
    if (isNaN(statementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      select: { id: true, doctorId: true },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Estado de cuenta no encontrado' }, { status: 404 });
    }
    if (statement.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Reverse each movement's ledger effects BEFORE the cascade, so entries aren't stranded with
    // stale evidence and bank-born entries aren't orphaned (§7/EXP-F13). The cascade then removes the
    // movements + settlement items; reverting the ledger entries is what this transaction adds.
    // Only `matched_confirmed` movements ever touched a ledger entry (enriched / created / settled) —
    // upload auto-matches, unmatched and ignored rows are no-ops, so we skip them to keep this
    // transaction small on large statements.
    await prisma.$transaction(async (tx) => {
      const movements = await tx.bankMovement.findMany({
        where: { bankStatementId: statementId, matchStatus: 'matched_confirmed' },
        select: { id: true, ledgerEntryId: true, matchHistory: true },
      });
      for (const m of movements) {
        await revertEntryEffects(tx, m, statement.doctorId);
      }
      await tx.bankStatement.delete({ where: { id: statementId } });
    }, { timeout: 60000 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting bank statement:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
