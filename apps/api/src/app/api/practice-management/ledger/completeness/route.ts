import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/completeness
// Returns completeness stats: evidence layers, breakdown by origin, alerts
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const doctorId = doctor.id;

    // Shared filter for "bank matched" entries (has a linked BankMovement with confirmed/auto status)
    const bankMatchedFilter = {
      bankMovement: { is: { matchStatus: { in: ['matched_auto', 'matched_confirmed'] } } },
    };
    const bankUnmatchedFilter = {
      OR: [
        { bankMovement: { is: null } },
        { bankMovement: { is: { matchStatus: { notIn: ['matched_auto', 'matched_confirmed'] } } } },
      ],
    };

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
      // Bank reconciliation stats
      bankReconcilableCount,
      bankMatchedCount,
      cashCount,
      webhookCount,
      needsReviewCount,
      // Cross-status matrix (ingresos only): CFDI x Bank
      matrixFullyReconciled,
      matrixInvoicedUnmatched,
      matrixMatchedNoInvoice,
      matrixUndocumented,
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

      // Bank reconcilable = non-cash AND non-webhook entries
      // Cash (efectivo) leaves no bank trace, webhook_pago is already self-proven
      prisma.ledgerEntry.count({
        where: {
          doctorId,
          formaDePago: { not: 'efectivo' },
          origin: { not: 'webhook_pago' },
        },
      }),

      // Bank matched = entries that have a BankMovement linked to them
      prisma.bankMovement.count({
        where: {
          ledgerEntry: { is: { doctorId } },
          matchStatus: { in: ['matched_auto', 'matched_confirmed'] },
        },
      }),

      // Excluded: cash entries that are NOT also webhook (no bank trace possible)
      prisma.ledgerEntry.count({
        where: { doctorId, formaDePago: 'efectivo', origin: { not: 'webhook_pago' } },
      }),

      // Excluded: webhook entries (self-proven, payout aggregation makes matching impossible)
      // Includes webhook+efectivo (e.g. OXXO) to avoid double-counting with cashCount
      prisma.ledgerEntry.count({
        where: { doctorId, origin: 'webhook_pago' },
      }),

      // Entries pending review (auto-linked with medium confidence)
      prisma.ledgerEntry.count({
        where: { doctorId, needsReview: true },
      }),

      // Cross-status matrix: hasFactura x bankMatched (ingresos only)
      // Fully reconciled: has CFDI + bank matched
      prisma.ledgerEntry.count({
        where: { doctorId, entryType: 'ingreso', hasFactura: true, ...bankMatchedFilter },
      }),
      // Invoiced but unmatched: has CFDI but no bank match
      prisma.ledgerEntry.count({
        where: { doctorId, entryType: 'ingreso', hasFactura: true, ...bankUnmatchedFilter },
      }),
      // Bank matched but no invoice
      prisma.ledgerEntry.count({
        where: { doctorId, entryType: 'ingreso', hasFactura: false, ...bankMatchedFilter },
      }),
      // Undocumented: no CFDI, no bank match
      prisma.ledgerEntry.count({
        where: { doctorId, entryType: 'ingreso', hasFactura: false, ...bankUnmatchedFilter },
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

    // Bank reconciliation percentage (only for reconcilable entries)
    const pctBankReconciled = bankReconcilableCount > 0
      ? Math.round((bankMatchedCount / bankReconcilableCount) * 100)
      : 100; // No reconcilable entries = nothing to reconcile

    const bankUnmatched = bankReconcilableCount - bankMatchedCount;

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

    if (bankUnmatched > 0) {
      alerts.push({
        type: 'bank_unmatched',
        severity: bankUnmatched > 10 ? 'high' : 'medium',
        count: bankUnmatched,
        message: `${bankUnmatched} movimiento${bankUnmatched > 1 ? 's' : ''} sin conciliar con banco (excluye efectivo y pagos online)`,
      });
    }

    if (needsReviewCount > 0) {
      alerts.push({
        type: 'needs_review',
        severity: needsReviewCount > 10 ? 'high' : 'medium',
        count: needsReviewCount,
        message: `${needsReviewCount} movimiento${needsReviewCount > 1 ? 's' : ''} vinculado${needsReviewCount > 1 ? 's' : ''} automáticamente por revisar`,
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
        bankReconciliation: {
          reconcilable: bankReconcilableCount,
          matched: bankMatchedCount,
          unmatched: bankUnmatched,
          pctReconciled: pctBankReconciled,
          excludedCash: cashCount,
          excludedWebhook: webhookCount,
        },
        reconciliationMatrix: {
          fullyReconciled: matrixFullyReconciled,
          invoicedUnmatched: matrixInvoicedUnmatched,
          matchedNoInvoice: matrixMatchedNoInvoice,
          undocumented: matrixUndocumented,
          totalIngresos: matrixFullyReconciled + matrixInvoicedUnmatched + matrixMatchedNoInvoice + matrixUndocumented,
        },
        needsReview: needsReviewCount,
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
