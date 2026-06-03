import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

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
// ISR Art. 96 — Monthly provisional rate table (2024-2026)
// Tabla del Art. 96 LISR para pagos provisionales mensuales
// ---------------------------------------------------------------------------

interface IsrBracket {
  limiteInferior: number;
  limiteSuperior: number;
  cuotaFija: number;
  tasa: number; // percentage over excess (e.g. 0.0192 = 1.92%)
}

const ISR_MONTHLY_TABLE: IsrBracket[] = [
  { limiteInferior: 0.01,      limiteSuperior: 746.04,       cuotaFija: 0,         tasa: 0.0192 },
  { limiteInferior: 746.05,    limiteSuperior: 6332.05,      cuotaFija: 14.32,     tasa: 0.0640 },
  { limiteInferior: 6332.06,   limiteSuperior: 11128.01,     cuotaFija: 371.83,    tasa: 0.1088 },
  { limiteInferior: 11128.02,  limiteSuperior: 12935.82,     cuotaFija: 893.63,    tasa: 0.16 },
  { limiteInferior: 12935.83,  limiteSuperior: 15487.71,     cuotaFija: 1182.88,   tasa: 0.1792 },
  { limiteInferior: 15487.72,  limiteSuperior: 31236.49,     cuotaFija: 1640.18,   tasa: 0.2136 },
  { limiteInferior: 31236.50,  limiteSuperior: 49233.00,     cuotaFija: 5004.12,   tasa: 0.2352 },
  { limiteInferior: 49233.01,  limiteSuperior: 93993.90,     cuotaFija: 9236.89,   tasa: 0.30 },
  { limiteInferior: 93993.91,  limiteSuperior: 125325.20,    cuotaFija: 22665.17,  tasa: 0.32 },
  { limiteInferior: 125325.21, limiteSuperior: 375975.61,    cuotaFija: 32691.18,  tasa: 0.34 },
  { limiteInferior: 375975.62, limiteSuperior: Infinity,     cuotaFija: 117912.32, tasa: 0.35 },
];

// RESICO monthly ISR table (Art. 113-E LISR)
interface ResicoBracket {
  limiteInferior: number;
  limiteSuperior: number;
  tasa: number;
}

const RESICO_MONTHLY_TABLE: ResicoBracket[] = [
  { limiteInferior: 0.01,      limiteSuperior: 25000.00,     tasa: 0.01 },
  { limiteInferior: 25000.01,  limiteSuperior: 50000.00,     tasa: 0.011 },
  { limiteInferior: 50000.01,  limiteSuperior: 83333.33,     tasa: 0.015 },
  { limiteInferior: 83333.34,  limiteSuperior: 208333.33,    tasa: 0.02 },
  { limiteInferior: 208333.34, limiteSuperior: 291666.67,    tasa: 0.025 },
];

function calculateIsr612(baseGravable: number): { isr: number; bracket: IsrBracket | null } {
  if (baseGravable <= 0) return { isr: 0, bracket: null };

  for (const bracket of ISR_MONTHLY_TABLE) {
    if (baseGravable <= bracket.limiteSuperior || bracket.limiteSuperior === Infinity) {
      const excedente = baseGravable - bracket.limiteInferior;
      const isr = bracket.cuotaFija + (excedente * bracket.tasa);
      return { isr, bracket };
    }
  }
  // Shouldn't reach here, but fallback to top bracket
  const top = ISR_MONTHLY_TABLE[ISR_MONTHLY_TABLE.length - 1];
  return { isr: top.cuotaFija + ((baseGravable - top.limiteInferior) * top.tasa), bracket: top };
}

function calculateIsrResico(ingresosMensuales: number): { isr: number; tasa: number } {
  if (ingresosMensuales <= 0) return { isr: 0, tasa: 0 };

  for (const bracket of RESICO_MONTHLY_TABLE) {
    if (ingresosMensuales <= bracket.limiteSuperior) {
      return { isr: ingresosMensuales * bracket.tasa, tasa: bracket.tasa };
    }
  }
  // Above max bracket — use top rate
  const top = RESICO_MONTHLY_TABLE[RESICO_MONTHLY_TABLE.length - 1];
  return { isr: ingresosMensuales * top.tasa, tasa: top.tasa };
}

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
      };
      // IVA
      iva: {
        ivaCobrado: number;           // IVA you charged
        ivaAcreditable: number;       // IVA you paid
        ivaRetenido: number;          // IVA retained by clients
        ivaAPagar: number;            // Net IVA to pay (negative = saldo a favor)
      };
    }

    const months: MonthDeclaration[] = [];

    if (regimenFiscal === '626') {
      // RESICO: Each month is independent, fixed rate on gross income
      for (let m = 1; m <= 12; m++) {
        const raw = monthlyRaw[m];
        const hasData = raw.ingresos > 0 || raw.deducciones > 0;

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

        cumulativeIngresos += raw.ingresos;
        cumulativeDeducciones += raw.deducciones;
        cumulativeIsrRetenido += raw.isrRetenido;

        // Base gravable = cumulative (ingresos - deducciones)
        const baseGravable = Math.max(0, cumulativeIngresos - cumulativeDeducciones);

        // Apply progressive table to cumulative base
        const { isr: isrCausado } = calculateIsr612(baseGravable);

        // ISR a pagar = ISR causado - retenciones acumuladas - pagos provisionales previos
        const isrAPagar = Math.max(0, isrCausado - cumulativeIsrRetenido - cumulativeIsrPaid);

        // IVA is always monthly (not cumulative)
        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;

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
          },
          iva: {
            ivaCobrado: round2(raw.ivaCobrado),
            ivaAcreditable: round2(raw.ivaAcreditable),
            ivaRetenido: round2(raw.ivaRetenido),
            ivaAPagar: round2(ivaNeto),
          },
        });

        // This month's ISR a pagar becomes next month's "pagos previos"
        cumulativeIsrPaid += isrAPagar;
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
