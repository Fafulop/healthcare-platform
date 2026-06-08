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

    // Fetch monthly aggregates from XML details (same query pattern as summary)
    const rows = await prisma.$queryRaw<Array<{
      month: number;
      direction: string;
      efecto: string;
      count: bigint;
      sum_subtotal: number | null;
      sum_iva_trasladado: number | null;
      sum_isr_retenido: number | null;
      sum_iva_retenido: number | null;
    }>>`
      SELECT
        EXTRACT(MONTH FROM m.issued_at)::int AS month,
        m.direction,
        m.efecto,
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
        AND EXTRACT(YEAR FROM m.issued_at) = ${year}
      GROUP BY EXTRACT(MONTH FROM m.issued_at), m.direction, m.efecto
      ORDER BY month
    `;

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
    const totalIsrAPagar = activeMonths.reduce((s, m) => s + m.isr.isrAPagar, 0);
    const totalIvaAPagar = activeMonths.reduce((s, m) => s + m.iva.ivaAPagar, 0);
    const totalIngresos = activeMonths.reduce((s, m) => s + m.ingresos, 0);
    const totalDeducciones = activeMonths.reduce((s, m) => s + m.deducciones, 0);
    const totalIsrRetenido = activeMonths.reduce((s, m) => s + (regimenFiscal === '626' ? m.isr.isrRetenido : 0), 0);

    return NextResponse.json({
      data: {
        year,
        regimenFiscal,
        months: activeMonths,
        totals: {
          ingresos: round2(totalIngresos),
          deducciones: round2(totalDeducciones),
          isrAPagar: round2(totalIsrAPagar),
          ivaAPagar: round2(totalIvaAPagar),
          isrRetenido: round2(regimenFiscal === '612'
            ? activeMonths[activeMonths.length - 1]?.isr.isrRetenido ?? 0
            : totalIsrRetenido),
        },
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
