import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/summary — Monthly financial summary from XML details
 *
 * Joins sat_cfdi_details with sat_cfdi_metadata to get direction + issuedAt,
 * then aggregates subtotal, IVA, ISR, totals by month and direction.
 *
 * Query params:
 *   year — optional, defaults to current year
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

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

    // Query 1: PUE invoices — count at invoice date
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
      WHERE d.doctor_id = ${doctor.id}
        AND m.sat_status = 'Vigente'
        AND m.efecto IN ('I', 'E')
        AND (d.metodo_pago = 'PUE' OR d.metodo_pago IS NULL)
        AND EXTRACT(YEAR FROM m.issued_at) = ${year}
      GROUP BY EXTRACT(MONTH FROM m.issued_at), m.direction, m.efecto
    `;

    // Query 2: PPD invoices WITH complemento — count at payment date
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
      WHERE p.doctor_id = ${doctor.id}
        AND m.sat_status = 'Vigente'
        AND m.efecto IN ('I', 'E')
        AND p.unlinked_at IS NULL
        AND p.fecha_pago IS NOT NULL
        AND EXTRACT(YEAR FROM p.fecha_pago) = ${year}
      GROUP BY EXTRACT(MONTH FROM p.fecha_pago), m.direction, m.efecto
    `;

    const [rows1, rows2] = await Promise.all([pueRows, ppdRows]);
    const rows: MonthRow[] = [...rows1, ...rows2];

    // Transform into structured response
    const months: Record<number, {
      month: number;
      ingresos: { count: number; subtotal: number; iva: number; isrRetenido: number; ivaRetenido: number; total: number };
      gastos: { count: number; subtotal: number; iva: number; isrRetenido: number; ivaRetenido: number; total: number };
    }> = {};

    for (let m = 1; m <= 12; m++) {
      months[m] = {
        month: m,
        ingresos: { count: 0, subtotal: 0, iva: 0, isrRetenido: 0, ivaRetenido: 0, total: 0 },
        gastos: { count: 0, subtotal: 0, iva: 0, isrRetenido: 0, ivaRetenido: 0, total: 0 },
      };
    }

    for (const row of rows) {
      const entry = months[row.month];
      if (!entry) continue;

      // emitted = ingresos side, received = gastos side
      const bucket = row.direction === 'emitted' ? entry.ingresos : entry.gastos;

      // Egresos (E = notas de credito) subtract from the bucket
      // emitted+E = reduces your ingresos, received+E = reduces your gastos
      const sign = row.efecto === 'E' ? -1 : 1;

      bucket.count += Number(row.count);
      bucket.subtotal += (row.sum_subtotal ?? 0) * sign;
      bucket.iva += (row.sum_iva_trasladado ?? 0) * sign;
      bucket.isrRetenido += (row.sum_isr_retenido ?? 0) * sign;
      bucket.ivaRetenido += (row.sum_iva_retenido ?? 0) * sign;
      bucket.total += (row.sum_total ?? 0) * sign;
    }

    // Filter to only months with data
    const data = Object.values(months).filter(m => m.ingresos.count > 0 || m.gastos.count > 0);

    // Annual totals
    const annual = {
      ingresos: { count: 0, subtotal: 0, iva: 0, isrRetenido: 0, ivaRetenido: 0, total: 0 },
      gastos: { count: 0, subtotal: 0, iva: 0, isrRetenido: 0, ivaRetenido: 0, total: 0 },
    };
    for (const m of data) {
      annual.ingresos.count += m.ingresos.count;
      annual.ingresos.subtotal += m.ingresos.subtotal;
      annual.ingresos.iva += m.ingresos.iva;
      annual.ingresos.isrRetenido += m.ingresos.isrRetenido;
      annual.ingresos.ivaRetenido += m.ingresos.ivaRetenido;
      annual.ingresos.total += m.ingresos.total;
      annual.gastos.count += m.gastos.count;
      annual.gastos.subtotal += m.gastos.subtotal;
      annual.gastos.iva += m.gastos.iva;
      annual.gastos.isrRetenido += m.gastos.isrRetenido;
      annual.gastos.ivaRetenido += m.gastos.ivaRetenido;
      annual.gastos.total += m.gastos.total;
    }

    return NextResponse.json({
      data: {
        year,
        months: data,
        annual,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error computing SAT summary:', error);
    return NextResponse.json({ error: 'Error al calcular resumen fiscal' }, { status: 500 });
  }
}
