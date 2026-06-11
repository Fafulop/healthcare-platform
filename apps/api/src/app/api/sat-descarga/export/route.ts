import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/export — Export CFDIs as CSV
 *
 * Query params:
 *   month     — 'YYYY-MM' (required)
 *   direction — 'emitted' | 'received' (optional, defaults to both)
 *   type      — 'metadata' | 'details' | 'resumen' (default: details)
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const month = url.searchParams.get('month');
    const direction = url.searchParams.get('direction');
    const type = url.searchParams.get('type') || 'details';

    if (!['metadata', 'details', 'resumen'].includes(type)) {
      return NextResponse.json({ error: 'type inválido (metadata, details, resumen)' }, { status: 400 });
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month es requerido (formato YYYY-MM)' }, { status: 400 });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const dateFrom = new Date(year, monthNum - 1, 1);
    const dateTo = new Date(year, monthNum, 1);

    if (type === 'resumen') {
      return exportResumen(doctor.id, year);
    }

    // Build where clause for metadata
    const where: any = {
      doctorId: doctor.id,
      satStatus: 'Vigente',
      issuedAt: { gte: dateFrom, lt: dateTo },
    };
    if (direction && ['emitted', 'received'].includes(direction)) {
      where.direction = direction;
    }

    if (type === 'details') {
      return exportDetails(doctor.id, where, month, direction);
    }

    return exportMetadata(where, month, direction);
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error exporting SAT data:', error);
    return NextResponse.json({ error: 'Error al exportar datos' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Export metadata only (no XML details)
// ---------------------------------------------------------------------------

async function exportMetadata(where: any, month: string, direction: string | null) {
  const items = await prisma.satCfdiMetadata.findMany({
    where,
    orderBy: { issuedAt: 'desc' },
    select: {
      uuid: true,
      direction: true,
      issuerRfc: true,
      issuerName: true,
      receiverRfc: true,
      receiverName: true,
      monto: true,
      efecto: true,
      satStatus: true,
      issuedAt: true,
    },
  });

  const headers = ['Fecha', 'Direccion', 'Emisor', 'RFC Emisor', 'Receptor', 'RFC Receptor', 'Monto', 'Tipo', 'Status', 'UUID'];
  const rows = items.map(item => [
    formatDate(item.issuedAt),
    item.direction === 'received' ? 'Recibido' : 'Emitido',
    csvEscape(item.issuerName || ''),
    item.issuerRfc,
    csvEscape(item.receiverName || ''),
    item.receiverRfc,
    item.monto.toNumber().toFixed(2),
    csvEscape(item.efecto || ''),
    item.satStatus,
    item.uuid,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const filename = `cfdi-metadata-${month}${direction ? `-${direction}` : ''}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Export with XML details (enriched)
// ---------------------------------------------------------------------------

async function exportDetails(doctorId: string, metaWhere: any, month: string, direction: string | null) {
  const items = await prisma.satCfdiMetadata.findMany({
    where: metaWhere,
    orderBy: { issuedAt: 'desc' },
    select: {
      uuid: true,
      direction: true,
      issuerRfc: true,
      issuerName: true,
      receiverRfc: true,
      receiverName: true,
      monto: true,
      efecto: true,
      satStatus: true,
      issuedAt: true,
    },
  });

  // Fetch XML details for all UUIDs in this batch
  const uuids = items.map(i => i.uuid.toLowerCase());
  const details = await prisma.satCfdiDetail.findMany({
    where: { doctorId, uuid: { in: uuids } },
    select: {
      uuid: true,
      subtotal: true,
      descuento: true,
      total: true,
      ivaTrasladado: true,
      isrRetenido: true,
      ivaRetenido: true,
      metodoPago: true,
      formaPago: true,
      usoCfdi: true,
    },
  });

  const detailMap = new Map(details.map(d => [d.uuid, d]));

  const headers = [
    'Fecha', 'Direccion', 'Emisor', 'RFC Emisor', 'Receptor', 'RFC Receptor',
    'Subtotal', 'IVA Trasladado', 'ISR Retenido', 'IVA Retenido', 'Total',
    'Metodo Pago', 'Forma Pago', 'Uso CFDI', 'Tipo', 'UUID',
  ];

  const rows = items.map(item => {
    const d = detailMap.get(item.uuid.toLowerCase());
    return [
      formatDate(item.issuedAt),
      item.direction === 'received' ? 'Recibido' : 'Emitido',
      csvEscape(item.issuerName || ''),
      item.issuerRfc,
      csvEscape(item.receiverName || ''),
      item.receiverRfc,
      d?.subtotal?.toNumber().toFixed(2) ?? '',
      d?.ivaTrasladado?.toNumber().toFixed(2) ?? '',
      d?.isrRetenido?.toNumber().toFixed(2) ?? '',
      d?.ivaRetenido?.toNumber().toFixed(2) ?? '',
      d?.total?.toNumber().toFixed(2) ?? item.monto.toNumber().toFixed(2),
      csvEscape(d?.metodoPago ?? ''),
      csvEscape(d?.formaPago ?? ''),
      csvEscape(d?.usoCfdi ?? ''),
      csvEscape(item.efecto || ''),
      item.uuid,
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const filename = `cfdi-detalle-${month}${direction ? `-${direction}` : ''}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Export annual resumen fiscal
// ---------------------------------------------------------------------------

async function exportResumen(doctorId: string, year: number) {
  // --- Cash-basis queries: PUE at invoice date, PPD at payment date ---
  type MonthRow = {
    month: number;
    direction: string;
    efecto: string;
    count: bigint;
    sum_subtotal: number | null;
    sum_total: number | null;
    sum_iva_trasladado: number | null;
    sum_isr_retenido: number | null;
    sum_iva_retenido: number | null;
  };

  const pueRows = prisma.$queryRaw<MonthRow[]>`
    SELECT
      EXTRACT(MONTH FROM m.issued_at)::int AS month,
      m.direction, m.efecto,
      COUNT(*)::bigint AS count,
      SUM(d.subtotal)::float AS sum_subtotal,
      SUM(d.total)::float AS sum_total,
      SUM(d.iva_trasladado)::float AS sum_iva_trasladado,
      SUM(d.isr_retenido)::float AS sum_isr_retenido,
      SUM(d.iva_retenido)::float AS sum_iva_retenido
    FROM practice_management.sat_cfdi_details d
    JOIN practice_management.sat_cfdi_metadata m
      ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
    WHERE d.doctor_id = ${doctorId}
      AND m.sat_status = 'Vigente'
      AND m.efecto IN ('I', 'E')
      AND (d.metodo_pago = 'PUE' OR d.metodo_pago IS NULL)
      AND EXTRACT(YEAR FROM m.issued_at) = ${year}
    GROUP BY EXTRACT(MONTH FROM m.issued_at), m.direction, m.efecto
  `;

  const ppdRows = prisma.$queryRaw<MonthRow[]>`
    SELECT
      EXTRACT(MONTH FROM p.fecha_pago)::int AS month,
      m.direction, m.efecto,
      COUNT(DISTINCT p.id)::bigint AS count,
      SUM(COALESCE(p.base_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.subtotal))::float AS sum_subtotal,
      SUM(p.monto_pagado)::float AS sum_total,
      SUM(COALESCE(p.iva_trasladado_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.iva_trasladado))::float AS sum_iva_trasladado,
      SUM(COALESCE(p.isr_retenido_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.isr_retenido))::float AS sum_isr_retenido,
      SUM(COALESCE(p.iva_retenido_dr, (p.monto_pagado / NULLIF(d.total, 0)) * d.iva_retenido))::float AS sum_iva_retenido
    FROM practice_management.sat_pagos p
    JOIN practice_management.sat_cfdi_metadata m
      ON m.doctor_id = p.doctor_id AND LOWER(m.uuid) = LOWER(p.factura_uuid)
    JOIN practice_management.sat_cfdi_details d
      ON d.doctor_id = p.doctor_id AND LOWER(d.uuid) = LOWER(p.factura_uuid)
    WHERE p.doctor_id = ${doctorId}
      AND m.sat_status = 'Vigente'
      AND m.efecto IN ('I', 'E')
      AND p.unlinked_at IS NULL
      AND p.fecha_pago IS NOT NULL
      AND EXTRACT(YEAR FROM p.fecha_pago) = ${year}
    GROUP BY EXTRACT(MONTH FROM p.fecha_pago), m.direction, m.efecto
  `;

  const [rows1, rows2] = await Promise.all([pueRows, ppdRows]);
  const rows: MonthRow[] = [...rows1, ...rows2];

  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Aggregate by month
  const months: Record<number, { ingSubtotal: number; ingIva: number; ingIsrRet: number; ingIvaRet: number; ingTotal: number; gasSubtotal: number; gasIva: number; gasTotal: number }> = {};
  for (let m = 1; m <= 12; m++) {
    months[m] = { ingSubtotal: 0, ingIva: 0, ingIsrRet: 0, ingIvaRet: 0, ingTotal: 0, gasSubtotal: 0, gasIva: 0, gasTotal: 0 };
  }

  for (const row of rows) {
    const entry = months[row.month];
    if (!entry) continue;
    const sign = row.efecto === 'E' ? -1 : 1;
    if (row.direction === 'emitted') {
      entry.ingSubtotal += (row.sum_subtotal ?? 0) * sign;
      entry.ingIva += (row.sum_iva_trasladado ?? 0) * sign;
      entry.ingIsrRet += (row.sum_isr_retenido ?? 0) * sign;
      entry.ingIvaRet += (row.sum_iva_retenido ?? 0) * sign;
      entry.ingTotal += (row.sum_total ?? 0) * sign;
    } else {
      entry.gasSubtotal += (row.sum_subtotal ?? 0) * sign;
      entry.gasIva += (row.sum_iva_trasladado ?? 0) * sign;
      entry.gasTotal += (row.sum_total ?? 0) * sign;
    }
  }

  const headers = ['Mes', 'Ingresos Subtotal', 'IVA Cobrado', 'ISR Retenido', 'IVA Retenido', 'Ingresos Total', 'Gastos Subtotal', 'IVA Pagado', 'Gastos Total', 'Balance', 'IVA Neto'];
  const csvRows = Object.entries(months)
    .filter(([_, v]) => v.ingTotal !== 0 || v.gasTotal !== 0)
    .map(([m, v]) => [
      MONTHS[Number(m) - 1],
      v.ingSubtotal.toFixed(2),
      v.ingIva.toFixed(2),
      v.ingIsrRet.toFixed(2),
      v.ingIvaRet.toFixed(2),
      v.ingTotal.toFixed(2),
      v.gasSubtotal.toFixed(2),
      v.gasIva.toFixed(2),
      v.gasTotal.toFixed(2),
      (v.ingTotal - v.gasTotal).toFixed(2),
      (v.ingIva - v.gasIva).toFixed(2),
    ]);

  const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="resumen-fiscal-${year}.csv"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
