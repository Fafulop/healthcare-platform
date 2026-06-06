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
// ISR Art. 96 — Monthly rate table (Anexo 8 RMF 2026, DOF 28/12/2025)
// For provisional payments (Art. 106), multiply limits & cuotaFija by month #
// ---------------------------------------------------------------------------

interface IsrBracket {
  limiteInferior: number;
  limiteSuperior: number;
  cuotaFija: number;
  tasa: number; // percentage over excess (e.g. 0.0192 = 1.92%)
}

const ISR_MONTHLY_TABLE: IsrBracket[] = [
  { limiteInferior: 0.01,      limiteSuperior: 844.58,       cuotaFija: 0,         tasa: 0.0192 },
  { limiteInferior: 844.59,    limiteSuperior: 7167.67,      cuotaFija: 16.22,     tasa: 0.0640 },
  { limiteInferior: 7167.68,   limiteSuperior: 12601.03,     cuotaFija: 420.90,    tasa: 0.1088 },
  { limiteInferior: 12601.04,  limiteSuperior: 14648.87,     cuotaFija: 1012.08,   tasa: 0.16 },
  { limiteInferior: 14648.88,  limiteSuperior: 17533.64,     cuotaFija: 1339.74,   tasa: 0.1792 },
  { limiteInferior: 17533.65,  limiteSuperior: 35362.83,     cuotaFija: 1856.84,   tasa: 0.2136 },
  { limiteInferior: 35362.84,  limiteSuperior: 55734.75,     cuotaFija: 5662.62,   tasa: 0.2352 },
  { limiteInferior: 55734.76,  limiteSuperior: 79388.37,     cuotaFija: 10454.09,  tasa: 0.30 },
  { limiteInferior: 79388.38,  limiteSuperior: 106410.50,    cuotaFija: 17550.18,  tasa: 0.32 },
  { limiteInferior: 106410.51, limiteSuperior: 375975.61,    cuotaFija: 26197.27,  tasa: 0.34 },
  { limiteInferior: 375975.62, limiteSuperior: Infinity,     cuotaFija: 117829.97, tasa: 0.35 },
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

/**
 * Calculate ISR for regime 612 using the accumulated table.
 * Per Art. 106 LISR + Anexo 8 RMF, the monthly table limits and cuotaFija
 * are multiplied by the month number to get the accumulated table.
 * e.g. for March (month 3), each bracket limit × 3 and cuotaFija × 3.
 */
function calculateIsr612(baseGravable: number, months: number = 1): { isr: number; bracket: IsrBracket | null } {
  if (baseGravable <= 0) return { isr: 0, bracket: null };

  for (const bracket of ISR_MONTHLY_TABLE) {
    const limSup = bracket.limiteSuperior === Infinity ? Infinity : bracket.limiteSuperior * months;
    const limInf = bracket.limiteInferior * months;
    const cuota = bracket.cuotaFija * months;
    if (baseGravable <= limSup || limSup === Infinity) {
      const excedente = baseGravable - limInf;
      const isr = cuota + (excedente * bracket.tasa);
      return { isr, bracket };
    }
  }
  // Shouldn't reach here, but fallback to top bracket
  const top = ISR_MONTHLY_TABLE[ISR_MONTHLY_TABLE.length - 1];
  const limInf = top.limiteInferior * months;
  const cuota = top.cuotaFija * months;
  return { isr: cuota + ((baseGravable - limInf) * top.tasa), bracket: top };
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

        // Apply progressive table to cumulative base (scaled by month count)
        const { isr: isrCausado } = calculateIsr612(baseGravable, m);

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
