import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/ppd — PPD invoices + complementos + matching suggestions
 *
 * Two sections:
 * - "Me deben" (emitted): PPD invoices you issued + your emitted complementos
 * - "Yo debo" (received): PPD invoices you received + vendor-issued complementos
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

    // Helper to build one side of PPD data
    async function buildPpdSide(direction: 'emitted' | 'received') {
      // 1. Get invoices (tipo I) for this direction
      const invoices = await prisma.satCfdiMetadata.findMany({
        where: {
          doctorId: doctor.id,
          direction,
          efecto: 'I',
          satStatus: 'Vigente',
          issuedAt: { gte: dateFrom, lt: dateTo },
        },
        select: {
          uuid: true,
          monto: true,
          issuerRfc: true,
          issuerName: true,
          receiverRfc: true,
          receiverName: true,
          issuedAt: true,
        },
      });

      // 2. Find which are PPD (from XML details)
      const uuids = invoices.map(i => i.uuid.toLowerCase());
      const ppdDetails = await prisma.satCfdiDetail.findMany({
        where: {
          doctorId: doctor.id,
          uuid: { in: uuids },
          metodoPago: 'PPD',
        },
        select: { uuid: true, total: true, folio: true, serie: true },
      });

      const ppdSet = new Map(ppdDetails.map(d => [d.uuid, d]));

      // 3. Get pagos for PPD invoices
      const ppdUuids = Array.from(ppdSet.keys());
      const allPagos = await prisma.satPago.findMany({
        where: {
          doctorId: doctor.id,
          facturaUuid: { in: ppdUuids },
        },
        orderBy: { numParcialidad: 'asc' },
      });

      const pagosByFactura = new Map<string, typeof allPagos>();
      for (const p of allPagos) {
        const arr = pagosByFactura.get(p.facturaUuid) || [];
        arr.push(p);
        pagosByFactura.set(p.facturaUuid, arr);
      }

      // 4. Build invoice list with status
      const ppdInvoices: any[] = [];
      for (const inv of invoices) {
        const uuidLower = inv.uuid.toLowerCase();
        if (!ppdSet.has(uuidLower)) continue;

        const detail = ppdSet.get(uuidLower)!;
        const invoiceTotal = Number(detail.total) || Number(inv.monto);
        const invPagos = pagosByFactura.get(uuidLower) || [];
        const activePagos = invPagos.filter(p => !p.unlinkedAt);
        const totalPagado = activePagos.reduce((s, p) => s + (p.montoPagado?.toNumber() ?? 0), 0);
        const lastPago = activePagos.length > 0 ? activePagos[activePagos.length - 1] : null;
        const saldoInsoluto = lastPago?.saldoInsoluto?.toNumber() ?? null;

        let status: 'pagado' | 'parcial' | 'pendiente' = 'pendiente';
        if (saldoInsoluto === 0) status = 'pagado';
        else if (activePagos.length > 0) status = 'parcial';

        const pendiente = saldoInsoluto !== null ? saldoInsoluto : (invoiceTotal - totalPagado);

        // counterparty: for emitted = receiver (client), for received = issuer (vendor)
        const counterpartyRfc = direction === 'emitted' ? inv.receiverRfc : inv.issuerRfc;
        const counterpartyName = direction === 'emitted' ? inv.receiverName : inv.issuerName;

        ppdInvoices.push({
          uuid: inv.uuid,
          folio: detail.folio ?? null,
          serie: detail.serie ?? null,
          counterpartyRfc,
          counterpartyName,
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
      ppdInvoices.sort((a: any, b: any) => statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder] || new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

      // 5. Get complementos tipo P for this direction
      // Emitted: doctor issues both invoice AND complemento (receiverRfc = client)
      // Received: vendor issues both invoice AND complemento (issuerRfc = vendor)
      const complementos = await prisma.satCfdiMetadata.findMany({
        where: {
          doctorId: doctor.id,
          direction,
          efecto: 'P',
          satStatus: 'Vigente',
          issuedAt: { gte: new Date(`${year - 1}-01-01T00:00:00Z`), lt: dateTo },
        },
        select: {
          uuid: true,
          monto: true,
          issuerRfc: true,
          issuerName: true,
          receiverRfc: true,
          receiverName: true,
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

      // 7. Build complemento list with suggestions
      const pendingFacturas = ppdInvoices.filter((f: any) => f.status === 'pendiente' || f.status === 'parcial');

      const complementoItems = complementos.map(c => {
        const uuidLower = c.uuid.toLowerCase();
        const linked = linkedPagoMap.get(uuidLower) || [];
        const montoNum = Number(c.monto);

        // Counterparty on complemento: same logic as invoice
        const counterpartyRfc = direction === 'emitted' ? c.receiverRfc : c.issuerRfc;
        const counterpartyName = direction === 'emitted' ? c.receiverName : c.issuerName;

        const suggestions: any[] = [];

        if (linked.length === 0) {
          for (const factura of pendingFacturas) {
            let confidence: 'high' | 'medium' | 'low' = 'low';
            const reasons: string[] = [];

            // RFC match: same counterparty
            if (counterpartyRfc === factura.counterpartyRfc) {
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

              if (new Date(c.issuedAt) >= new Date(factura.issuedAt)) {
                reasons.push('Fecha posterior');
              }

              suggestions.push({
                facturaUuid: factura.uuid,
                folio: factura.folio,
                serie: factura.serie,
                counterpartyName: factura.counterpartyName,
                total: factura.total,
                pendiente: factura.pendiente,
                confidence,
                reason: reasons.join(' · '),
              });
            }
          }

          const confOrder = { high: 0, medium: 1, low: 2 };
          suggestions.sort((a: any, b: any) => confOrder[a.confidence as keyof typeof confOrder] - confOrder[b.confidence as keyof typeof confOrder]);
        }

        return {
          uuid: c.uuid,
          counterpartyRfc,
          counterpartyName,
          monto: montoNum,
          issuedAt: c.issuedAt.toISOString(),
          linkedTo: linked,
          suggestions: suggestions.slice(0, 5),
        };
      });

      const unmatchedComplementos = complementoItems.filter(c => c.linkedTo.length === 0);
      const matchedComplementos = complementoItems.filter(c => c.linkedTo.length > 0);

      const totalFacturas = ppdInvoices.length;
      const pagadas = ppdInvoices.filter((f: any) => f.status === 'pagado').length;
      const parciales = ppdInvoices.filter((f: any) => f.status === 'parcial').length;
      const pendientes = ppdInvoices.filter((f: any) => f.status === 'pendiente').length;
      const totalPendiente = ppdInvoices.reduce((s: number, f: any) => s + f.pendiente, 0);

      return {
        summary: { totalFacturas, pagadas, parciales, pendientes, totalPendiente },
        facturas: ppdInvoices,
        unmatchedComplementos,
        matchedComplementos,
      };
    }

    const [emitted, received] = await Promise.all([
      buildPpdSide('emitted'),
      buildPpdSide('received'),
    ]);

    return NextResponse.json({
      data: {
        year,
        emitted,
        received,
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
