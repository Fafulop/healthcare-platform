import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/conciliacion-bancaria/[id]/movements/[movId]/settlement-candidates
// Returns unlinked ledger entries that could be combined to settle ONE bank deposit
// (e.g. the individual appointment incomes that make up a card-processor payout).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id, movId } = await params;
    const statementId = parseInt(id);
    const movementId = parseInt(movId);

    if (isNaN(statementId) || isNaN(movementId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      select: { id: true, doctorId: true },
    });
    if (!statement || statement.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const movement = await prisma.bankMovement.findUnique({ where: { id: movementId } });
    if (!movement || movement.bankStatementId !== statementId) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    const deposit = Number(movement.amount);
    const movDate = new Date(movement.transactionDate);
    const entryType = movement.movementType === 'deposit' ? 'ingreso' : 'egreso';

    // Window: settlements usually batch a few days of activity before the payout date.
    const dateFrom = new Date(movDate);
    dateFrom.setDate(dateFrom.getDate() - 14);
    const dateTo = new Date(movDate);
    dateTo.setDate(dateTo.getDate() + 3);

    const candidates = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        entryType,
        transactionDate: { gte: dateFrom, lte: dateTo },
        // Each component should be at or below the deposit (many sum up to it).
        amount: { lte: deposit + 0.01 },
        bankMovement: { is: null },
        settlementItem: { is: null },
        origin: { not: 'comision' }, // settlement commission egresos are not standalone bank lines
      },
      select: {
        id: true,
        amount: true,
        concept: true,
        transactionDate: true,
        origin: true,
        formaDePago: true,
        counterpartyName: true,
        internalId: true,
      },
      orderBy: { transactionDate: 'asc' },
      take: 100,
    });

    return NextResponse.json({
      data: {
        deposit,
        movementType: movement.movementType,
        candidates: candidates.map((c) => ({ ...c, amount: Number(c.amount) })),
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching settlement candidates:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
