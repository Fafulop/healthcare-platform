import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { calculateIsr612, calculateIsrResico } from '@/lib/isr-tables';

/**
 * GET /api/sat-descarga/declaration — Monthly ISR/IVA declaration helper
 *
 * Pre-calculates the amounts a doctor needs for their monthly tax declarations.
 * Uses data from sat_cfdi_details + sat_cfdi_metadata (XML-parsed CFDIs).
 *
 * Query params:
 *   year — optional, defaults to current year
 *
 * Two calculation modes based on régimen:
 *   612 — ISR provisional cumulative (progressive table)
 *   626 — ISR RESICO (fixed rate on monthly gross income)
 *
 * IVA calculation is the same for both régimes.
 */

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

    // Get régimen
    const fiscalProfile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: { regimenFiscal: true },
    });
    const regimenFiscal = fiscalProfile?.regimenFiscal || '612';

    // Fetch actual payment receipts for this year
    const receipts = await prisma.satDeclarationReceipt.findMany({
      where: { doctorId: doctor.id, year },
      select: {
        month: true,
        isrPagado: true,
        ivaPagado: true,
        pdfUrl: true,
        pdfFileName: true,
        notes: true,
      },
    });
    const receiptMap = new Map(receipts.map(r => [r.month, {
      isrPagado: r.isrPagado ? Number(r.isrPagado) : null,
      ivaPagado: r.ivaPagado ? Number(r.ivaPagado) : null,
      pdfUrl: r.pdfUrl,
      pdfFileName: r.pdfFileName,
      notes: r.notes,
    }]));

    // --- Cash-basis queries: PUE at invoice date, PPD at payment date ---
    type MonthRow = {
      month: number;
      direction: string;
      efecto: string;
      count: bigint;
      sum_subtotal: number | null;
      sum_iva_trasladado: number | null;
      sum_isr_retenido: number | null;
      sum_iva_retenido: number | null;
    };

    // Query 1: PUE invoices (paid at issuance) — count at invoice date
    const pueRows = prisma.$queryRaw<MonthRow[]>`
      SELECT
        EXTRACT(MONTH FROM m.issued_at)::int AS month,
        m.direction, m.efecto,
        COUNT(*)::bigint AS count,
        SUM(d.subtotal)::float AS sum_subtotal,
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

    // Query 3: PPD invoices WITHOUT complemento — excluded, but count for info
    const ppdExcludedRows = prisma.$queryRaw<Array<{
      direction: string;
      count: bigint;
      sum_subtotal: number | null;
    }>>`
      SELECT m.direction, COUNT(*)::bigint AS count,
        SUM(d.subtotal)::float AS sum_subtotal
      FROM practice_management.sat_cfdi_details d
      JOIN practice_management.sat_cfdi_metadata m
        ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
      LEFT JOIN practice_management.sat_pagos p
        ON p.doctor_id = d.doctor_id
        AND LOWER(p.factura_uuid) = LOWER(d.uuid)
        AND p.unlinked_at IS NULL
      WHERE d.doctor_id = ${doctor.id}
        AND m.sat_status = 'Vigente'
        AND m.efecto = 'I'
        AND d.metodo_pago = 'PPD'
        AND p.id IS NULL
        AND EXTRACT(YEAR FROM m.issued_at) = ${year}
      GROUP BY m.direction
    `;

    // Execute all 3 queries in parallel
    const [rows1, rows2, excludedRows] = await Promise.all([pueRows, ppdRows, ppdExcludedRows]);
    const rows: MonthRow[] = [...rows1, ...rows2];

    // Build PPD excluded summary
    const ppdExcluded = {
      emitted: 0, emittedSubtotal: 0,
      received: 0, receivedSubtotal: 0,
    };
    for (const r of excludedRows) {
      if (r.direction === 'emitted') {
        ppdExcluded.emitted = Number(r.count);
        ppdExcluded.emittedSubtotal = r.sum_subtotal ?? 0;
      } else {
        ppdExcluded.received = Number(r.count);
        ppdExcluded.receivedSubtotal = r.sum_subtotal ?? 0;
      }
    }

    // Build monthly data structure
    interface MonthlyRaw {
      ingresos: number;    // subtotal emitidos I
      deducciones: number; // subtotal recibidos I
      ivaCobrado: number;  // IVA trasladado emitidos
      ivaAcreditable: number; // IVA trasladado recibidos (what doctor paid)
      isrRetenido: number; // ISR retenido emitidos (retained by PM clients)
      ivaRetenido: number; // IVA retenido emitidos
    }

    const monthlyRaw: Record<number, MonthlyRaw> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyRaw[m] = { ingresos: 0, deducciones: 0, ivaCobrado: 0, ivaAcreditable: 0, isrRetenido: 0, ivaRetenido: 0 };
    }

    for (const row of rows) {
      const entry = monthlyRaw[row.month];
      if (!entry) continue;

      const sign = row.efecto === 'E' ? -1 : 1;

      if (row.direction === 'emitted') {
        entry.ingresos += (row.sum_subtotal ?? 0) * sign;
        entry.ivaCobrado += (row.sum_iva_trasladado ?? 0) * sign;
        entry.isrRetenido += (row.sum_isr_retenido ?? 0) * sign;
        entry.ivaRetenido += (row.sum_iva_retenido ?? 0) * sign;
      } else {
        // received = gastos/deducciones
        entry.deducciones += (row.sum_subtotal ?? 0) * sign;
        entry.ivaAcreditable += (row.sum_iva_trasladado ?? 0) * sign;
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Calculate ISR + IVA per month
    interface MonthDeclaration {
      month: number;
      hasData: boolean;
      // Input values
      ingresos: number;
      deducciones: number;
      // ISR
      isr: {
        baseGravable: number;         // 612: cumulative income - deductions. RESICO: monthly income
        isrCausado: number;           // ISR from table
        isrRetenido: number;          // ISR already retained by clients (cumulative for 612)
        pagosPrevios: number;         // ISR paid in previous months (612 only)
        isrAPagar: number;            // Net ISR to pay this month
        tasaEfectiva: number;         // Effective rate (%)
        tasaResico?: number;          // RESICO bracket rate
        // Bracket details for transparency (612 only)
        bracket?: {
          limiteInferior: number;     // Scaled by month
          limiteSuperior: number;     // Scaled by month
          cuotaFija: number;          // Scaled by month
          tasa: number;               // Percentage (e.g. 0.30 = 30%)
          excedente: number;          // baseGravable - limiteInferior
        };
      };
      // IVA
      iva: {
        ivaCobrado: number;           // IVA you charged
        ivaAcreditable: number;       // IVA you paid
        ivaRetenido: number;          // IVA retained by clients
        ivaAPagar: number;            // Net IVA to pay (negative = saldo a favor)
      };
      // Actual payment receipt (from user input)
      receipt: {
        isrPagado: number | null;     // Actual ISR paid (from acuse)
        ivaPagado: number | null;     // Actual IVA paid (from acuse)
        pdfUrl: string | null;
        pdfFileName: string | null;
        notes: string | null;
      } | null;
    }

    const months: MonthDeclaration[] = [];

    if (regimenFiscal === '626') {
      // RESICO: Each month is independent, fixed rate on gross income
      for (let m = 1; m <= 12; m++) {
        const raw = monthlyRaw[m];
        const hasData = raw.ingresos > 0 || raw.deducciones > 0;
        const receipt = receiptMap.get(m) || null;

        const { isr: isrCausado, tasa: tasaResico } = calculateIsrResico(raw.ingresos);

        // In RESICO, ISR retained by PM clients counts against ISR to pay
        const isrAPagar = Math.max(0, isrCausado - raw.isrRetenido);

        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;

        months.push({
          month: m,
          hasData,
          ingresos: round2(raw.ingresos),
          deducciones: round2(raw.deducciones),
          isr: {
            baseGravable: round2(raw.ingresos),
            isrCausado: round2(isrCausado),
            isrRetenido: round2(raw.isrRetenido),
            pagosPrevios: 0,
            isrAPagar: round2(isrAPagar),
            tasaEfectiva: raw.ingresos > 0 ? round2((isrCausado / raw.ingresos) * 100) : 0,
            tasaResico,
          },
          iva: {
            ivaCobrado: round2(raw.ivaCobrado),
            ivaAcreditable: round2(raw.ivaAcreditable),
            ivaRetenido: round2(raw.ivaRetenido),
            ivaAPagar: round2(ivaNeto),
          },
          receipt,
        });
      }
    } else {
      // 612: ISR provisional is cumulative
      // Each month: cumulative(ingresos - deducciones) → table → - cumulative retenciones - previous payments
      let cumulativeIngresos = 0;
      let cumulativeDeducciones = 0;
      let cumulativeIsrRetenido = 0;
      let cumulativeIsrPaid = 0; // Sum of ISR a pagar from previous months

      for (let m = 1; m <= 12; m++) {
        const raw = monthlyRaw[m];
        const hasData = raw.ingresos > 0 || raw.deducciones > 0;
        const receipt = receiptMap.get(m) || null;

        cumulativeIngresos += raw.ingresos;
        cumulativeDeducciones += raw.deducciones;
        cumulativeIsrRetenido += raw.isrRetenido;

        // Base gravable = cumulative (ingresos - deducciones)
        const baseGravable = Math.max(0, cumulativeIngresos - cumulativeDeducciones);

        // Apply progressive table to cumulative base (scaled by month count)
        const { isr: isrCausado, bracket } = calculateIsr612(baseGravable, m);

        // ISR a pagar = ISR causado - retenciones acumuladas - pagos provisionales previos
        const isrAPagar = Math.max(0, isrCausado - cumulativeIsrRetenido - cumulativeIsrPaid);

        // IVA is always monthly (not cumulative)
        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;

        // Build bracket detail for transparency
        const bracketDetail = bracket && baseGravable > 0 ? {
          limiteInferior: round2(bracket.limiteInferior * m),
          limiteSuperior: bracket.limiteSuperior === Infinity ? -1 : round2(bracket.limiteSuperior * m),
          cuotaFija: round2(bracket.cuotaFija * m),
          tasa: bracket.tasa,
          excedente: round2(baseGravable - bracket.limiteInferior * m),
        } : undefined;

        months.push({
          month: m,
          hasData,
          ingresos: round2(raw.ingresos),
          deducciones: round2(raw.deducciones),
          isr: {
            baseGravable: round2(baseGravable),
            isrCausado: round2(isrCausado),
            isrRetenido: round2(cumulativeIsrRetenido),
            pagosPrevios: round2(cumulativeIsrPaid),
            isrAPagar: round2(isrAPagar),
            tasaEfectiva: baseGravable > 0 ? round2((isrCausado / baseGravable) * 100) : 0,
            bracket: bracketDetail,
          },
          iva: {
            ivaCobrado: round2(raw.ivaCobrado),
            ivaAcreditable: round2(raw.ivaAcreditable),
            ivaRetenido: round2(raw.ivaRetenido),
            ivaAPagar: round2(ivaNeto),
          },
          receipt,
        });

        // Use actual ISR paid (from receipt) if available, otherwise use calculated
        const actualIsrPaid = receipt?.isrPagado ?? isrAPagar;
        cumulativeIsrPaid += actualIsrPaid;
      }
    }

    // Filter to months with data
    const activeMonths = months.filter(m => m.hasData);

    // Annual totals
    const totalIngresos = activeMonths.reduce((s, m) => s + m.ingresos, 0);
    const totalDeducciones = activeMonths.reduce((s, m) => s + m.deducciones, 0);
    const totalIvaAPagar = activeMonths.reduce((s, m) => s + m.iva.ivaAPagar, 0);

    // ISR totals differ by regime:
    // - 612 (cumulative): last month's ISR causado IS the year-to-date liability.
    //   Summing individual months' ISR a pagar double-counts in a cumulative system.
    // - 626 (RESICO): each month is independent, so summing IS correct.
    const lastActive = activeMonths[activeMonths.length - 1];

    const totalIsrRetenido = regimenFiscal === '612'
      ? lastActive?.isr.isrRetenido ?? 0
      : activeMonths.reduce((s, m) => s + m.isr.isrRetenido, 0);

    const totalIsrPagado = receipts
      .filter(r => r.month <= 12 && r.isrPagado != null)
      .reduce((s, r) => s + Number(r.isrPagado), 0);

    let totalIsrCausado: number;
    let totalIsrAPagar: number;
    let totalIsrAFavor: number;

    if (regimenFiscal === '626') {
      // RESICO: sum of monthly values
      totalIsrCausado = activeMonths.reduce((s, m) => s + m.isr.isrCausado, 0);
      totalIsrAPagar = activeMonths.reduce((s, m) => s + m.isr.isrAPagar, 0);
      totalIsrAFavor = 0;
    } else {
      // 612: cumulative — last month's ISR causado is the year-to-date figure
      totalIsrCausado = lastActive?.isr.isrCausado ?? 0;
      const netIsr = totalIsrCausado - totalIsrRetenido - totalIsrPagado;
      totalIsrAPagar = Math.max(0, netIsr);
      totalIsrAFavor = Math.max(0, -netIsr);
    }

    return NextResponse.json({
      data: {
        year,
        regimenFiscal,
        months: activeMonths,
        totals: {
          ingresos: round2(totalIngresos),
          deducciones: round2(totalDeducciones),
          isrCausado: round2(totalIsrCausado),
          isrAPagar: round2(totalIsrAPagar),
          isrAFavor: round2(totalIsrAFavor),
          isrPagado: round2(totalIsrPagado),
          ivaAPagar: round2(totalIvaAPagar),
          isrRetenido: round2(totalIsrRetenido),
        },
        // PPD invoices excluded (no complemento de pago)
        ppdExcluded,
        // Include table reference so frontend can show bracket info
        isrTable: regimenFiscal === '626' ? 'resico' : 'art96',
        // Annual declaration receipt (month=13)
        annualReceipt: receiptMap.get(13) || null,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error computing declaration:', error);
    return NextResponse.json({ error: 'Error al calcular declaraciones' }, { status: 500 });
  }
}
