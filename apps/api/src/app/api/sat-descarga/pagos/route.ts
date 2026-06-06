import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/pagos — Get payment status for PPD invoices
 *
 * Query params:
 *   uuid — specific invoice UUID (returns payments for that invoice)
 *   month — 'YYYY-MM' (returns payment status for all PPD invoices in that month)
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const uuid = url.searchParams.get('uuid');
    const month = url.searchParams.get('month');

    if (uuid) {
      // Get active (non-unlinked) payments for a specific invoice
      const pagos = await prisma.satPago.findMany({
        where: {
          doctorId: doctor.id,
          facturaUuid: uuid.toLowerCase(),
          unlinkedAt: null,
        },
        orderBy: { numParcialidad: 'asc' },
      });

      const totalPagado = pagos.reduce((sum, p) => sum + (p.montoPagado?.toNumber() ?? 0), 0);
      const lastSaldo = pagos.length > 0 ? (pagos[pagos.length - 1].saldoInsoluto?.toNumber() ?? null) : null;

      return NextResponse.json({
        data: {
          uuid,
          pagos,
          totalPagado,
          saldoInsoluto: lastSaldo,
          status: lastSaldo === 0 ? 'pagado' : lastSaldo !== null ? 'parcial' : pagos.length > 0 ? 'parcial' : 'pendiente',
        },
      });
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      // Get payment status for all PPD invoices in a month
      const [year, monthNum] = month.split('-').map(Number);
      const dateFrom = new Date(Date.UTC(year, monthNum - 1, 1));
      const dateTo = new Date(Date.UTC(year, monthNum, 1));

      // Find PPD invoices in the month
      const ppdInvoices = await prisma.satCfdiMetadata.findMany({
        where: {
          doctorId: doctor.id,
          issuedAt: { gte: dateFrom, lt: dateTo },
          satStatus: 'Vigente',
        },
        select: { uuid: true, monto: true, direction: true, issuerName: true },
      });

      // Get details to check which are PPD
      const uuids = ppdInvoices.map(i => i.uuid.toLowerCase());
      const details = await prisma.satCfdiDetail.findMany({
        where: {
          doctorId: doctor.id,
          uuid: { in: uuids },
          metodoPago: 'PPD',
        },
        select: { uuid: true },
      });

      const ppdUuids = new Set(details.map(d => d.uuid));

      // Get all active pagos for these PPD invoices
      const pagos = await prisma.satPago.findMany({
        where: {
          doctorId: doctor.id,
          facturaUuid: { in: Array.from(ppdUuids) },
          unlinkedAt: null,
        },
      });

      // Group pagos by factura
      const pagosByFactura = new Map<string, typeof pagos>();
      for (const p of pagos) {
        const existing = pagosByFactura.get(p.facturaUuid) || [];
        existing.push(p);
        pagosByFactura.set(p.facturaUuid, existing);
      }

      // Build status for each PPD invoice
      const invoiceStatuses = ppdInvoices
        .filter(inv => ppdUuids.has(inv.uuid.toLowerCase()))
        .map(inv => {
          const invPagos = pagosByFactura.get(inv.uuid.toLowerCase()) || [];
          const totalPagado = invPagos.reduce((sum, p) => sum + (p.montoPagado?.toNumber() ?? 0), 0);
          const lastSaldo = invPagos.length > 0
            ? (invPagos.sort((a, b) => (a.numParcialidad ?? 0) - (b.numParcialidad ?? 0))[invPagos.length - 1].saldoInsoluto?.toNumber() ?? null)
            : null;

          return {
            uuid: inv.uuid,
            monto: inv.monto.toNumber(),
            direction: inv.direction,
            issuerName: inv.issuerName,
            totalPagado,
            saldoInsoluto: lastSaldo,
            pagosCount: invPagos.length,
            status: lastSaldo === 0 ? 'pagado' : lastSaldo !== null ? 'parcial' : invPagos.length > 0 ? 'parcial' : 'pendiente',
          };
        });

      return NextResponse.json({ data: invoiceStatuses });
    }

    return NextResponse.json({ error: 'Provide uuid or month parameter' }, { status: 400 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching pagos:', error);
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

/**
 * PATCH /api/sat-descarga/pagos — Unlink or re-link a pago record
 *
 * Body: { id: number, action: 'unlink' | 'relink' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { id, action } = body;

    if (!id || !['unlink', 'relink'].includes(action)) {
      return NextResponse.json({ error: 'Provide id and action (unlink|relink)' }, { status: 400 });
    }

    // Verify the pago belongs to this doctor
    const pago = await prisma.satPago.findFirst({
      where: { id: Number(id), doctorId: doctor.id },
    });
    if (!pago) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const updated = await prisma.satPago.update({
      where: { id: pago.id },
      data: {
        unlinkedAt: action === 'unlink' ? new Date() : null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating pago:', error);
    return NextResponse.json({ error: 'Error al actualizar pago' }, { status: 500 });
  }
}

/**
 * POST /api/sat-descarga/pagos — Manually link a complemento to a factura
 *
 * Body: { pagoUuid: string, facturaUuid: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { pagoUuid, facturaUuid } = body;

    if (!pagoUuid || !facturaUuid) {
      return NextResponse.json({ error: 'Provide pagoUuid and facturaUuid' }, { status: 400 });
    }

    const pagoId = pagoUuid.toLowerCase();
    const facturaId = facturaUuid.toLowerCase();

    // Verify both CFDIs exist and belong to this doctor
    const [pagoMeta, facturaMeta] = await Promise.all([
      prisma.satCfdiMetadata.findFirst({
        where: { doctorId: doctor.id, uuid: { equals: pagoId, mode: 'insensitive' } },
        select: { uuid: true, efecto: true },
      }),
      prisma.satCfdiMetadata.findFirst({
        where: { doctorId: doctor.id, uuid: { equals: facturaId, mode: 'insensitive' } },
        select: { uuid: true },
      }),
    ]);

    if (!pagoMeta) {
      return NextResponse.json({ error: 'Complemento de pago no encontrado' }, { status: 404 });
    }
    if (pagoMeta.efecto !== 'P') {
      return NextResponse.json({ error: 'El CFDI seleccionado no es un complemento de pago (tipo P)' }, { status: 400 });
    }
    if (!facturaMeta) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    // Get pago detail for serie/folio and factura detail for monto
    const [pagoDetail, facturaDetail] = await Promise.all([
      prisma.satCfdiDetail.findFirst({
        where: { doctorId: doctor.id, uuid: pagoId },
        select: { serie: true, folio: true, formaPago: true },
      }),
      prisma.satCfdiDetail.findFirst({
        where: { doctorId: doctor.id, uuid: facturaId },
        select: { total: true },
      }),
    ]);

    const created = await prisma.satPago.upsert({
      where: {
        doctorId_pagoUuid_facturaUuid: {
          doctorId: doctor.id,
          pagoUuid: pagoId,
          facturaUuid: facturaId,
        },
      },
      create: {
        doctorId: doctor.id,
        pagoUuid: pagoId,
        facturaUuid: facturaId,
        serie: pagoDetail?.serie ?? null,
        folio: pagoDetail?.folio ?? null,
        formaPago: pagoDetail?.formaPago ?? null,
        fechaPago: new Date(),
        montoPagado: facturaDetail?.total ?? null,
        numParcialidad: 1,
        source: 'manual',
      },
      update: {
        unlinkedAt: null,
        source: 'manual',
      },
    });

    return NextResponse.json({ data: created });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating manual pago link:', error);
    return NextResponse.json({ error: 'Error al vincular pago' }, { status: 500 });
  }
}
