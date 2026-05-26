import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/completeness
// Returns completeness stats: evidence layers, breakdown by origin, alerts
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const doctorId = doctor.id;

    // Run all counts in parallel
    const [
      total,
      withComprobante,
      withFactura,
      withArea,
      byOrigin,
      byEntryType,
      uncategorized,
      unpaidIngresos,
    ] = await Promise.all([
      prisma.ledgerEntry.count({ where: { doctorId } }),

      prisma.ledgerEntry.count({ where: { doctorId, hasComprobante: true } }),

      prisma.ledgerEntry.count({ where: { doctorId, hasFactura: true } }),

      prisma.ledgerEntry.count({ where: { doctorId, area: { not: null } } }),

      prisma.ledgerEntry.groupBy({
        by: ['origin'],
        where: { doctorId },
        _count: { id: true },
        _sum: { amount: true },
      }),

      prisma.ledgerEntry.groupBy({
        by: ['entryType'],
        where: { doctorId },
        _count: { id: true },
        _sum: { amount: true },
      }),

      // Alerts: entries without area assigned
      prisma.ledgerEntry.count({
        where: { doctorId, area: null },
      }),

      // Alerts: ingresos not fully paid
      prisma.ledgerEntry.count({
        where: {
          doctorId,
          entryType: 'ingreso',
          porRealizar: false,
          paymentStatus: { in: ['PENDING', 'PARTIAL'] },
        },
      }),
    ]);

    // Build origin breakdown
    const originBreakdown = byOrigin.map((g) => ({
      origin: g.origin || 'sin_origen',
      count: g._count.id,
      total: Number(g._sum.amount || 0),
    }));

    // Build entry type breakdown
    const typeBreakdown = byEntryType.map((g) => ({
      entryType: g.entryType,
      count: g._count.id,
      total: Number(g._sum.amount || 0),
    }));

    // Evidence completeness percentages
    const pctComprobante = total > 0 ? Math.round((withComprobante / total) * 100) : 0;
    const pctFactura = total > 0 ? Math.round((withFactura / total) * 100) : 0;
    const pctCategorized = total > 0 ? Math.round((withArea / total) * 100) : 0;

    // Build alerts
    const alerts: { type: string; severity: string; count: number; message: string }[] = [];

    if (uncategorized > 0) {
      alerts.push({
        type: 'uncategorized',
        severity: uncategorized > 10 ? 'high' : 'medium',
        count: uncategorized,
        message: `${uncategorized} movimiento${uncategorized > 1 ? 's' : ''} sin area asignada`,
      });
    }

    if (unpaidIngresos > 0) {
      alerts.push({
        type: 'unpaid_ingresos',
        severity: unpaidIngresos > 5 ? 'high' : 'medium',
        count: unpaidIngresos,
        message: `${unpaidIngresos} ingreso${unpaidIngresos > 1 ? 's' : ''} pendiente${unpaidIngresos > 1 ? 's' : ''} de cobro`,
      });
    }

    const withoutComprobante = total - withComprobante;
    if (withoutComprobante > 0 && pctComprobante < 50) {
      alerts.push({
        type: 'missing_comprobante',
        severity: 'low',
        count: withoutComprobante,
        message: `${withoutComprobante} movimiento${withoutComprobante > 1 ? 's' : ''} sin comprobante`,
      });
    }

    const withoutFactura = total - withFactura;
    if (withoutFactura > 0 && pctFactura < 30) {
      alerts.push({
        type: 'missing_factura',
        severity: 'low',
        count: withoutFactura,
        message: `${withoutFactura} movimiento${withoutFactura > 1 ? 's' : ''} sin factura`,
      });
    }

    return NextResponse.json({
      data: {
        total,
        evidence: {
          withComprobante,
          withFactura,
          withArea,
          pctComprobante,
          pctFactura,
          pctCategorized,
        },
        byOrigin: originBreakdown,
        byEntryType: typeBreakdown,
        alerts,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching completeness stats:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
