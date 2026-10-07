import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/balance
// Calculate balance: ingresos COBRADOS - egresos PAGADOS (H-009); the unpaid rest and por realizar → pending
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    // Optional date range — same convention as the ledger list (entries stored at T12:00:00).
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    let transactionDate: { gte?: Date; lte?: Date } | undefined;
    if (startDate || endDate) {
      transactionDate = {};
      if (startDate) transactionDate.gte = new Date(startDate + 'T00:00:00');
      if (endDate) transactionDate.lte = new Date(endDate + 'T23:59:59.999');
    }
    const dateWhere = transactionDate ? { transactionDate } : {};

    // Realized transactions only (porRealizar: false)
    const ingresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId: doctor.id,
        entryType: 'ingreso',
        porRealizar: false,
        ...dateWhere,
      },
      _sum: {
        amount: true,
        amountPaid: true,
      }
    });

    const egresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId: doctor.id,
        entryType: 'egreso',
        porRealizar: false,
        ...dateWhere,
      },
      _sum: {
        amount: true,
        amountPaid: true,
      }
    });

    // Pending transactions (porRealizar: true)
    const pendingIngresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId: doctor.id,
        entryType: 'ingreso',
        porRealizar: true,
        ...dateWhere,
      },
      _sum: {
        amount: true
      }
    });

    const pendingEgresos = await prisma.ledgerEntry.aggregate({
      where: {
        doctorId: doctor.id,
        entryType: 'egreso',
        porRealizar: true,
        ...dateWhere,
      },
      _sum: {
        amount: true
      }
    });

    // H-009 (2026-10-06): «Total Ingresos / Egresos» and «Balance Actual» are money that actually came in or
    // went out — what was PAID (`amountPaid`), not what was recorded. An unpaid sale (PENDING, $0 paid) used
    // to count in full (prod: $561 K of income and $2.07 M of expenses not yet paid). The unpaid remainder
    // of a recorded entry joins the pending figures, so the projected balance is unchanged.
    const totalIngresos = Number(ingresos._sum.amountPaid || 0);
    const totalEgresos = Number(egresos._sum.amountPaid || 0);
    const sinCobrar = Number(ingresos._sum.amount || 0) - totalIngresos;
    const sinPagar = Number(egresos._sum.amount || 0) - totalEgresos;
    const totalPendingIngresos = Number(pendingIngresos._sum.amount || 0) + sinCobrar;
    const totalPendingEgresos = Number(pendingEgresos._sum.amount || 0) + sinPagar;

    return NextResponse.json({
      data: {
        totalIngresos: Number(totalIngresos),
        totalEgresos: Number(totalEgresos),
        balance: Number(totalIngresos) - Number(totalEgresos),
        pendingIngresos: Number(totalPendingIngresos),
        pendingEgresos: Number(totalPendingEgresos),
        projectedBalance: Number(totalIngresos) + Number(totalPendingIngresos) - Number(totalEgresos) - Number(totalPendingEgresos)
      }
    });
  } catch (error: any) {
    console.error('Error calculating balance:', error);

    if (error.message.includes('Doctor') || error.message.includes('access required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
