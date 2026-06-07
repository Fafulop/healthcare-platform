import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/ppd — PPD invoices + complementos + matching suggestions
 *
 * Returns:
 * - All emitted PPD invoices (with linked pagos and status)
 * - All received complementos tipo P (with linked factura info)
 * - Suggestions for unmatched complementos
 *
 * Query params:
 *   year — optional, defaults to current year
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

    const dateFrom = new Date(`${year}-01-01T00:00:00Z`);
    const dateTo = new Date(`${year + 1}-01-01T00:00:00Z`);

    // 1. Get all emitted invoices for the year
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

    // 2. Find which are PPD (from XML details)
    const emittedUuids = emittedInvoices.map(i => i.uuid.toLowerCase());
    const ppdDetails = await prisma.satCfdiDetail.findMany({
      where: {
        doctorId: doctor.id,
        uuid: { in: emittedUuids },
        metodoPago: 'PPD',
      },
      select: { uuid: true, total: true, folio: true, serie: true, metodoPago: true },
    });

    const ppdSet = new Map(ppdDetails.map(d => [d.uuid, d]));

    // 3. Get all pagos for these PPD invoices
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

    // 4. Build PPD invoice list with status
    interface PpdInvoice {
      uuid: string;
      folio: string | null;
      serie: string | null;
      receiverRfc: string;
      receiverName: string | null;
      total: number;
      issuedAt: string;
      totalPagado: number;
      pendiente: number;
      status: 'pagado' | 'parcial' | 'pendiente';
      pagos: Array<{
        id: number;
        pagoUuid: string;
        fechaPago: string | null;
        montoPagado: number;
        numParcialidad: number | null;
        saldoInsoluto: number | null;
        formaPago: string | null;
        source: string;
        unlinkedAt: string | null;
      }>;
    }

    const ppdInvoices: PpdInvoice[] = [];

    for (const inv of emittedInvoices) {
      const uuidLower = inv.uuid.toLowerCase();
      if (!ppdSet.has(uuidLower)) continue;

      const detail = ppdSet.get(uuidLower)!;
      const invoiceTotal = Number(detail.total) || Number(inv.monto);
      const invPagos = pagosByFactura.get(uuidLower) || [];

      // Only count active (non-unlinked) pagos for status
      const activePagos = invPagos.filter(p => !p.unlinkedAt);
      const totalPagado = activePagos.reduce((s, p) => s + (p.montoPagado?.toNumber() ?? 0), 0);
      const lastPago = activePagos.length > 0 ? activePagos[activePagos.length - 1] : null;
      const saldoInsoluto = lastPago?.saldoInsoluto?.toNumber() ?? null;

      let status: 'pagado' | 'parcial' | 'pendiente' = 'pendiente';
      if (saldoInsoluto === 0) status = 'pagado';
      else if (activePagos.length > 0) status = 'parcial';

      const pendiente = saldoInsoluto !== null ? saldoInsoluto : (invoiceTotal - totalPagado);

      ppdInvoices.push({
        uuid: inv.uuid,
        folio: detail.folio ?? null,
        serie: detail.serie ?? null,
        receiverRfc: inv.receiverRfc,
        receiverName: inv.receiverName,
        total: invoiceTotal,
        issuedAt: inv.issuedAt.toISOString(),
        totalPagado,
        pendiente: Math.max(0, pendiente),
        status,
        pagos: invPagos.map(p => ({
          id: p.id,
          pagoUuid: p.pagoUuid,
          fechaPago: p.fechaPago?.toISOString() ?? null,
          montoPagado: p.montoPagado?.toNumber() ?? 0,
          numParcialidad: p.numParcialidad,
          saldoInsoluto: p.saldoInsoluto?.toNumber() ?? null,
          formaPago: p.formaPago,
          source: p.source ?? 'auto',
          unlinkedAt: p.unlinkedAt?.toISOString() ?? null,
        })),
      });
    }

    // Sort: pendiente first, then parcial, then pagado
    const statusOrder = { pendiente: 0, parcial: 1, pagado: 2 };
    ppdInvoices.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    // 5. Get all received complementos tipo P for the year (and broader — pagos can arrive later)
    const complementos = await prisma.satCfdiMetadata.findMany({
      where: {
        doctorId: doctor.id,
        direction: 'received',
        efecto: 'P',
        satStatus: 'Vigente',
        issuedAt: { gte: new Date(`${year - 1}-01-01T00:00:00Z`), lt: dateTo },
      },
      select: {
        uuid: true,
        monto: true,
        issuerRfc: true,
        issuerName: true,
        issuedAt: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    // 6. Determine which complementos are already linked
    const complementoUuids = complementos.map(c => c.uuid.toLowerCase());
    const linkedPagos = await prisma.satPago.findMany({
      where: {
        doctorId: doctor.id,
        pagoUuid: { in: complementoUuids },
        unlinkedAt: null,
      },
      select: { pagoUuid: true, facturaUuid: true },
    });

    const linkedPagoMap = new Map<string, string[]>();
    for (const lp of linkedPagos) {
      const arr = linkedPagoMap.get(lp.pagoUuid) || [];
      arr.push(lp.facturaUuid);
      linkedPagoMap.set(lp.pagoUuid, arr);
    }

    // 7. Build complemento list with suggestions for unmatched
    // For suggestions: match by RFC (complemento issuer = factura receiver) + amount proximity
    const pendingFacturas = ppdInvoices.filter(f => f.status === 'pendiente' || f.status === 'parcial');

    interface ComplementoItem {
      uuid: string;
      issuerRfc: string;
      issuerName: string | null;
      monto: number;
      issuedAt: string;
      linkedTo: string[]; // factura UUIDs already linked
      suggestions: Array<{
        facturaUuid: string;
        folio: string | null;
        serie: string | null;
        receiverName: string | null;
        total: number;
        pendiente: number;
        confidence: 'high' | 'medium' | 'low';
        reason: string;
      }>;
    }

    const complementoItems: ComplementoItem[] = complementos.map(c => {
      const uuidLower = c.uuid.toLowerCase();
      const linked = linkedPagoMap.get(uuidLower) || [];
      const montoNum = Number(c.monto);

      // Generate suggestions for unlinked complementos
      const suggestions: ComplementoItem['suggestions'] = [];

      if (linked.length === 0) {
        for (const factura of pendingFacturas) {
          let confidence: 'high' | 'medium' | 'low' = 'low';
          const reasons: string[] = [];

          // RFC match (strongest signal)
          if (c.issuerRfc === factura.receiverRfc) {
            reasons.push('RFC coincide');

            // Amount match
            const amountDiff = Math.abs(montoNum - factura.pendiente);
            const amountPct = factura.pendiente > 0 ? amountDiff / factura.pendiente : 1;

            if (amountPct < 0.01) {
              confidence = 'high';
              reasons.push('Monto exacto');
            } else if (amountPct < 0.15) {
              confidence = 'high';
              reasons.push('Monto similar');
            } else {
              confidence = 'medium';
            }

            // Date: complemento should be after factura
            if (new Date(c.issuedAt) >= new Date(factura.issuedAt)) {
              reasons.push('Fecha posterior');
            }

            suggestions.push({
              facturaUuid: factura.uuid,
              folio: factura.folio,
              serie: factura.serie,
              receiverName: factura.receiverName,
              total: factura.total,
              pendiente: factura.pendiente,
              confidence,
              reason: reasons.join(' · '),
            });
          }
        }

        // Sort suggestions: high confidence first
        const confOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => confOrder[a.confidence] - confOrder[b.confidence]);
      }

      return {
        uuid: c.uuid,
        issuerRfc: c.issuerRfc,
        issuerName: c.issuerName,
        monto: montoNum,
        issuedAt: c.issuedAt.toISOString(),
        linkedTo: linked,
        suggestions: suggestions.slice(0, 5),
      };
    });

    // Split into linked and unmatched
    const unmatchedComplementos = complementoItems.filter(c => c.linkedTo.length === 0);
    const matchedComplementos = complementoItems.filter(c => c.linkedTo.length > 0);

    // Summary
    const totalFacturas = ppdInvoices.length;
    const pagadas = ppdInvoices.filter(f => f.status === 'pagado').length;
    const parciales = ppdInvoices.filter(f => f.status === 'parcial').length;
    const pendientes = ppdInvoices.filter(f => f.status === 'pendiente').length;
    const totalPendiente = ppdInvoices.reduce((s, f) => s + f.pendiente, 0);

    return NextResponse.json({
      data: {
        year,
        summary: { totalFacturas, pagadas, parciales, pendientes, totalPendiente },
        facturas: ppdInvoices,
        unmatchedComplementos,
        matchedComplementos,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching PPD data:', error);
    return NextResponse.json({ error: 'Error al obtener datos PPD' }, { status: 500 });
  }
}
