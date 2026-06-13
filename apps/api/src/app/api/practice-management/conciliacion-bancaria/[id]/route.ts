import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

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

    // Cascade delete handles movements via FK constraint
    await prisma.bankStatement.delete({ where: { id: statementId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error deleting bank statement:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
