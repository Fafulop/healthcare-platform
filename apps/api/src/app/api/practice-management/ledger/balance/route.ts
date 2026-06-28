import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/balance
// Calculate balance: total ingresos - total egresos (excluding por realizar)
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
        amount: true
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
        amount: true
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

    const totalIngresos = ingresos._sum.amount || 0;
    const totalEgresos = egresos._sum.amount || 0;
    const totalPendingIngresos = pendingIngresos._sum.amount || 0;
    const totalPendingEgresos = pendingEgresos._sum.amount || 0;

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
