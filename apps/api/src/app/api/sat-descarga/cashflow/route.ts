import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/cashflow — Cash flow projection from unpaid PPD invoices
 *
 * Finds all emitted PPD invoices, cross-references with received complementos de pago,
 * and returns aging report with pending collection amounts.
 *
 * Query params:
 *   year — optional, defaults to current year
 *
 * Response:
 * {
 *   data: {
 *     year,
 *     summary: { totalPending, totalOverdue, invoiceCount, overdueCount },
 *     buckets: [{ label, range, count, total, invoices[] }],
 *     recentPayments: [{ uuid, issuerName, montoPagado, fechaPago }]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

    const dateFrom = new Date(`${year}-01-01T00:00:00Z`);
    const dateTo = new Date(`${year + 1}-01-01T00:00:00Z`);

    // Find all emitted Vigente invoices for the year
    const emittedInvoices = await prisma.satCfdiMetadata.findMany({
      where: {
        doctorId: doctor.id,
        direction: 'emitted',
        efecto: 'I',
        satStatus: 'Vigente',
        issuedAt: { gte: dateFrom, lt: dateTo },
      },
      select: {
        uuid: true,
        monto: true,
        receiverRfc: true,
        receiverName: true,
        issuedAt: true,
      },
    });

    if (emittedInvoices.length === 0) {
      return NextResponse.json({
        data: {
          year,
          summary: { totalPending: 0, totalOverdue: 0, invoiceCount: 0, overdueCount: 0 },
          buckets: [],
          recentPayments: [],
        },
      });
    }

    // Check which are PPD (metodoPago from XML details)
    const uuids = emittedInvoices.map(i => i.uuid.toLowerCase());
    const ppdDetails = await prisma.satCfdiDetail.findMany({
      where: {
        doctorId: doctor.id,
        uuid: { in: uuids },
        metodoPago: 'PPD',
      },
      select: { uuid: true, total: true, folio: true, serie: true },
    });

    const ppdSet = new Map(ppdDetails.map(d => [d.uuid, d]));

    if (ppdSet.size === 0) {
      return NextResponse.json({
        data: {
          year,
          summary: { totalPending: 0, totalOverdue: 0, invoiceCount: 0, overdueCount: 0 },
          buckets: [],
          recentPayments: [],
        },
      });
    }

    // Get all pagos for these PPD invoices
    const ppdUuids = Array.from(ppdSet.keys());
    const allPagos = await prisma.satPago.findMany({
      where: {
        doctorId: doctor.id,
        facturaUuid: { in: ppdUuids },
      },
      orderBy: { numParcialidad: 'asc' },
    });

    // Group pagos by factura
    const pagosByFactura = new Map<string, typeof allPagos>();
    for (const p of allPagos) {
      const arr = pagosByFactura.get(p.facturaUuid) || [];
      arr.push(p);
      pagosByFactura.set(p.facturaUuid, arr);
    }

    // Build invoice status list
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    interface CashflowInvoice {
      uuid: string;
      folio: string | null;
      serie: string | null;
      receiverRfc: string;
      receiverName: string | null;
      total: number;
      totalPagado: number;
      pendiente: number;
      issuedAt: string;
      daysSinceIssued: number;
      pagosCount: number;
      status: 'pendiente' | 'parcial' | 'pagado';
    }

    const unpaidInvoices: CashflowInvoice[] = [];

    for (const inv of emittedInvoices) {
      const uuidLower = inv.uuid.toLowerCase();
      if (!ppdSet.has(uuidLower)) continue;

      const detail = ppdSet.get(uuidLower)!;
      const invoiceTotal = Number(detail.total) || Number(inv.monto);
      const invPagos = pagosByFactura.get(uuidLower) || [];
      const totalPagado = invPagos.reduce((s, p) => s + (p.montoPagado?.toNumber() ?? 0), 0);

      // Check saldo insoluto from last pago
      const lastPago = invPagos.length > 0 ? invPagos[invPagos.length - 1] : null;
      const saldoInsoluto = lastPago?.saldoInsoluto?.toNumber() ?? null;

      // If fully paid, skip
      if (saldoInsoluto === 0) continue;

      const pendiente = saldoInsoluto !== null ? saldoInsoluto : (invoiceTotal - totalPagado);
      if (pendiente <= 0) continue;

      const daysSinceIssued = Math.floor((today.getTime() - new Date(inv.issuedAt).getTime()) / 86400000);

      unpaidInvoices.push({
        uuid: inv.uuid,
        folio: detail.folio ?? null,
        serie: detail.serie ?? null,
        receiverRfc: inv.receiverRfc,
        receiverName: inv.receiverName,
        total: invoiceTotal,
        totalPagado,
        pendiente,
        issuedAt: inv.issuedAt.toISOString(),
        daysSinceIssued,
        pagosCount: invPagos.length,
        status: invPagos.length > 0 ? 'parcial' : 'pendiente',
      });
    }

    // Aging buckets
    const bucketDefs = [
      { label: '0-30 dias', min: 0, max: 30 },
      { label: '31-60 dias', min: 31, max: 60 },
      { label: '61-90 dias', min: 61, max: 90 },
      { label: '90+ dias', min: 91, max: Infinity },
    ];

    const buckets = bucketDefs.map(b => {
      const invoices = unpaidInvoices
        .filter(i => i.daysSinceIssued >= b.min && i.daysSinceIssued <= b.max)
        .sort((a, z) => z.pendiente - a.pendiente);
      return {
        label: b.label,
        range: `${b.min}-${b.max === Infinity ? '+' : b.max}`,
        count: invoices.length,
        total: Math.round(invoices.reduce((s, i) => s + i.pendiente, 0) * 100) / 100,
        invoices: invoices.slice(0, 50),
      };
    });

    const totalPending = Math.round(unpaidInvoices.reduce((s, i) => s + i.pendiente, 0) * 100) / 100;
    const overdueInvoices = unpaidInvoices.filter(i => i.daysSinceIssued > 30);
    const totalOverdue = Math.round(overdueInvoices.reduce((s, i) => s + i.pendiente, 0) * 100) / 100;

    // Recent payments (last 10)
    const recentPagos = allPagos
      .filter(p => p.fechaPago)
      .sort((a, b) => (b.fechaPago?.getTime() ?? 0) - (a.fechaPago?.getTime() ?? 0))
      .slice(0, 10)
      .map(p => {
        const inv = emittedInvoices.find(i => i.uuid.toLowerCase() === p.facturaUuid);
        return {
          uuid: p.facturaUuid,
          receiverName: inv?.receiverName ?? null,
          montoPagado: p.montoPagado?.toNumber() ?? 0,
          fechaPago: p.fechaPago?.toISOString() ?? null,
        };
      });

    return NextResponse.json({
      data: {
        year,
        summary: {
          totalPending,
          totalOverdue,
          invoiceCount: unpaidInvoices.length,
          overdueCount: overdueInvoices.length,
        },
        buckets,
        recentPayments: recentPagos,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error computing cashflow:', error);
    return NextResponse.json({ error: 'Error al calcular flujo de cobro' }, { status: 500 });
  }
}
