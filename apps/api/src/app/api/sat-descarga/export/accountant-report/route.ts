import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  classifyConcepto,
  checkDeductibility,
} from '@/lib/deduction-categories';

/**
 * GET /api/sat-descarga/export/accountant-report — Downloadable report for accountant
 *
 * Generates a multi-section CSV with everything an accountant needs to prepare
 * monthly (declaración provisional) or annual (declaración anual) tax filings.
 *
 * Query params:
 *   month  — 'YYYY-MM' (required for monthly)
 *   period — 'monthly' | 'annual' (default: monthly)
 *   year   — YYYY (for annual, defaults to current year)
 *
 * Supports regimes 612 (Actividad Empresarial) and 626 (RESICO).
 */

// ---------------------------------------------------------------------------
// ISR Art. 96 — Monthly provisional rate table (2024-2026)
// ---------------------------------------------------------------------------

interface IsrBracket {
  limiteInferior: number;
  limiteSuperior: number;
  cuotaFija: number;
  tasa: number;
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

function calculateIsr612(baseGravable: number): number {
  if (baseGravable <= 0) return 0;
  for (const bracket of ISR_MONTHLY_TABLE) {
    if (baseGravable <= bracket.limiteSuperior || bracket.limiteSuperior === Infinity) {
      return bracket.cuotaFija + ((baseGravable - bracket.limiteInferior) * bracket.tasa);
    }
  }
  const top = ISR_MONTHLY_TABLE[ISR_MONTHLY_TABLE.length - 1];
  return top.cuotaFija + ((baseGravable - top.limiteInferior) * top.tasa);
}

function calculateIsrResico(ingresos: number): { isr: number; tasa: number } {
  if (ingresos <= 0) return { isr: 0, tasa: 0 };
  for (const bracket of RESICO_MONTHLY_TABLE) {
    if (ingresos <= bracket.limiteSuperior) {
      return { isr: ingresos * bracket.tasa, tasa: bracket.tasa };
    }
  }
  const top = RESICO_MONTHLY_TABLE[RESICO_MONTHLY_TABLE.length - 1];
  return { isr: ingresos * top.tasa, tasa: top.tasa };
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateMx(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const period = url.searchParams.get('period') || 'monthly';
    const monthParam = url.searchParams.get('month'); // YYYY-MM

    let year: number;
    let targetMonth: number | null = null; // 1-12

    if (period === 'annual') {
      year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);
    } else {
      if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
        return NextResponse.json({ error: 'month es requerido (formato YYYY-MM)' }, { status: 400 });
      }
      const [y, m] = monthParam.split('-').map(Number);
      year = y;
      targetMonth = m;
    }

    // Fiscal profile
    const fiscalProfile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: { regimenFiscal: true, rfc: true, razonSocial: true },
    });
    const regimenFiscal = fiscalProfile?.regimenFiscal || '612';
    const isResico = regimenFiscal === '626';
    const rfc = fiscalProfile?.rfc || 'N/A';
    const razonSocial = fiscalProfile?.razonSocial || 'N/A';

    // -----------------------------------------------------------------------
    // 1. Monthly aggregation for ISR/IVA (same query as declaration route)
    // -----------------------------------------------------------------------
    const aggRows = await prisma.$queryRaw<Array<{
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

    interface MonthlyRaw {
      ingresos: number;
      deducciones: number;
      ivaCobrado: number;
      ivaAcreditable: number;
      isrRetenido: number;
      ivaRetenido: number;
    }

    const monthlyRaw: Record<number, MonthlyRaw> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyRaw[m] = { ingresos: 0, deducciones: 0, ivaCobrado: 0, ivaAcreditable: 0, isrRetenido: 0, ivaRetenido: 0 };
    }

    for (const row of aggRows) {
      const entry = monthlyRaw[row.month];
      if (!entry) continue;
      const sign = row.efecto === 'E' ? -1 : 1;
      if (row.direction === 'emitted') {
        entry.ingresos += (row.sum_subtotal ?? 0) * sign;
        entry.ivaCobrado += (row.sum_iva_trasladado ?? 0) * sign;
        entry.isrRetenido += (row.sum_isr_retenido ?? 0) * sign;
        entry.ivaRetenido += (row.sum_iva_retenido ?? 0) * sign;
      } else {
        entry.deducciones += (row.sum_subtotal ?? 0) * sign;
        entry.ivaAcreditable += (row.sum_iva_trasladado ?? 0) * sign;
      }
    }

    // -----------------------------------------------------------------------
    // 2. Compute ISR for all months up to target (needed for cumulative 612)
    // -----------------------------------------------------------------------
    interface MonthIsr {
      month: number;
      ingresos: number;
      deducciones: number;
      baseGravable: number;
      isrCausado: number;
      isrRetenido: number;
      pagosPrevios: number;
      isrAPagar: number;
      tasaEfectiva: number;
      tasaResico?: number;
      ivaCobrado: number;
      ivaAcreditable: number;
      ivaRetenido: number;
      ivaAPagar: number;
    }

    const allMonthIsr: MonthIsr[] = [];

    if (isResico) {
      for (let m = 1; m <= 12; m++) {
        const raw = monthlyRaw[m];
        const { isr: isrCausado, tasa } = calculateIsrResico(raw.ingresos);
        const isrAPagar = Math.max(0, isrCausado - raw.isrRetenido);
        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;
        allMonthIsr.push({
          month: m,
          ingresos: round2(raw.ingresos),
          deducciones: round2(raw.deducciones),
          baseGravable: round2(raw.ingresos),
          isrCausado: round2(isrCausado),
          isrRetenido: round2(raw.isrRetenido),
          pagosPrevios: 0,
          isrAPagar: round2(isrAPagar),
          tasaEfectiva: raw.ingresos > 0 ? round2((isrCausado / raw.ingresos) * 100) : 0,
          tasaResico: tasa,
          ivaCobrado: round2(raw.ivaCobrado),
          ivaAcreditable: round2(raw.ivaAcreditable),
          ivaRetenido: round2(raw.ivaRetenido),
          ivaAPagar: round2(ivaNeto),
        });
      }
    } else {
      let cumIngresos = 0, cumDeducciones = 0, cumIsrRetenido = 0, cumIsrPaid = 0;
      for (let m = 1; m <= 12; m++) {
        const raw = monthlyRaw[m];
        cumIngresos += raw.ingresos;
        cumDeducciones += raw.deducciones;
        cumIsrRetenido += raw.isrRetenido;
        const baseGravable = Math.max(0, cumIngresos - cumDeducciones);
        const isrCausado = calculateIsr612(baseGravable);
        const isrAPagar = Math.max(0, isrCausado - cumIsrRetenido - cumIsrPaid);
        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;
        allMonthIsr.push({
          month: m,
          ingresos: round2(raw.ingresos),
          deducciones: round2(raw.deducciones),
          baseGravable: round2(baseGravable),
          isrCausado: round2(isrCausado),
          isrRetenido: round2(cumIsrRetenido),
          pagosPrevios: round2(cumIsrPaid),
          isrAPagar: round2(isrAPagar),
          tasaEfectiva: baseGravable > 0 ? round2((isrCausado / baseGravable) * 100) : 0,
          ivaCobrado: round2(raw.ivaCobrado),
          ivaAcreditable: round2(raw.ivaAcreditable),
          ivaRetenido: round2(raw.ivaRetenido),
          ivaAPagar: round2(ivaNeto),
        });
        cumIsrPaid += isrAPagar;
      }
    }

    // -----------------------------------------------------------------------
    // 3. Fetch CFDI detail rows for the period
    // -----------------------------------------------------------------------
    const dateFrom = targetMonth
      ? new Date(year, targetMonth - 1, 1)
      : new Date(`${year}-01-01T00:00:00Z`);
    const dateTo = targetMonth
      ? new Date(year, targetMonth, 1)
      : new Date(`${year + 1}-01-01T00:00:00Z`);

    const [emittedCfdis, receivedCfdis] = await Promise.all([
      prisma.satCfdiMetadata.findMany({
        where: {
          doctorId: doctor.id,
          direction: 'emitted',
          satStatus: 'Vigente',
          issuedAt: { gte: dateFrom, lt: dateTo },
        },
        orderBy: { issuedAt: 'asc' },
        select: {
          uuid: true, issuerRfc: true, issuerName: true,
          receiverRfc: true, receiverName: true,
          monto: true, efecto: true, satStatus: true, issuedAt: true,
        },
      }),
      prisma.satCfdiMetadata.findMany({
        where: {
          doctorId: doctor.id,
          direction: 'received',
          satStatus: 'Vigente',
          efecto: 'I',
          issuedAt: { gte: dateFrom, lt: dateTo },
        },
        orderBy: { issuedAt: 'asc' },
        select: {
          uuid: true, issuerRfc: true, issuerName: true,
          receiverRfc: true, receiverName: true,
          monto: true, efecto: true, satStatus: true, issuedAt: true,
        },
      }),
    ]);

    // Fetch XML details for both sets
    const allUuids = [...emittedCfdis, ...receivedCfdis].map(c => c.uuid.toLowerCase());
    const allDetails = allUuids.length > 0
      ? await prisma.satCfdiDetail.findMany({
          where: { doctorId: doctor.id, uuid: { in: allUuids } },
          select: {
            uuid: true, subtotal: true, total: true,
            ivaTrasladado: true, isrRetenido: true, ivaRetenido: true,
            metodoPago: true, formaPago: true, usoCfdi: true,
            conceptos: {
              select: { claveProdServ: true, descripcion: true, importe: true },
            },
          },
        })
      : [];

    const detailMap = new Map(allDetails.map(d => [d.uuid.toLowerCase(), d]));

    // -----------------------------------------------------------------------
    // 4. Build CSV sections
    // -----------------------------------------------------------------------
    const lines: string[] = [];

    const addBlank = () => lines.push('');
    const addSection = (title: string) => { addBlank(); lines.push(csvEscape(`--- ${title} ---`)); };
    const addRow = (cells: (string | number)[]) => lines.push(cells.map(c => typeof c === 'number' ? c.toFixed(2) : csvEscape(String(c))).join(','));
    const addHeaders = (headers: string[]) => lines.push(headers.map(h => csvEscape(h)).join(','));

    // --- Header ---
    const regimenLabel = isResico
      ? '626 - Regimen Simplificado de Confianza (RESICO)'
      : '612 - Personas Fisicas con Actividades Empresariales y Profesionales';
    const periodLabel = targetMonth
      ? `${MONTH_NAMES[targetMonth - 1]} ${year}`
      : `Anual ${year}`;

    lines.push(csvEscape(`REPORTE PARA CONTADOR - ${targetMonth ? 'DECLARACION MENSUAL' : 'DECLARACION ANUAL'}`));
    addRow([`Periodo: ${periodLabel}`]);
    addRow([`Regimen: ${regimenLabel}`]);
    addRow([`RFC: ${rfc}`]);
    addRow([`Razon Social: ${razonSocial}`]);
    addRow([`Generado: ${formatDateMx(new Date())}`]);

    // --- Annual 12-month summary table (annual only) ---
    if (!targetMonth) {
      addSection('RESUMEN MENSUAL');
      if (isResico) {
        addHeaders(['Mes', 'Ingresos', 'Tasa RESICO', 'ISR Causado', 'ISR Retenido', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acreditable', 'IVA Retenido', 'IVA a Pagar']);
        for (const mi of allMonthIsr) {
          if (mi.ingresos === 0 && mi.deducciones === 0) continue;
          addRow([
            MONTH_NAMES[mi.month - 1],
            mi.ingresos, `${((mi.tasaResico || 0) * 100).toFixed(1)}%`,
            mi.isrCausado, mi.isrRetenido, mi.isrAPagar,
            mi.ivaCobrado, mi.ivaAcreditable, mi.ivaRetenido, mi.ivaAPagar,
          ]);
        }
        // Totals row
        const activeMonths = allMonthIsr.filter(m => m.ingresos > 0 || m.deducciones > 0);
        addRow([
          'TOTAL',
          round2(activeMonths.reduce((s, m) => s + m.ingresos, 0)),
          '',
          round2(activeMonths.reduce((s, m) => s + m.isrCausado, 0)),
          round2(activeMonths.reduce((s, m) => s + m.isrRetenido, 0)),
          round2(activeMonths.reduce((s, m) => s + m.isrAPagar, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaCobrado, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaAcreditable, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaRetenido, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaAPagar, 0)),
        ]);
      } else {
        addHeaders(['Mes', 'Ingresos', 'Deducciones', 'Base Gravable (Acum)', 'ISR Causado (Acum)', 'ISR Retenido (Acum)', 'Pagos Previos', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acreditable', 'IVA Retenido', 'IVA a Pagar']);
        for (const mi of allMonthIsr) {
          if (mi.ingresos === 0 && mi.deducciones === 0) continue;
          addRow([
            MONTH_NAMES[mi.month - 1],
            mi.ingresos, mi.deducciones, mi.baseGravable,
            mi.isrCausado, mi.isrRetenido, mi.pagosPrevios, mi.isrAPagar,
            mi.ivaCobrado, mi.ivaAcreditable, mi.ivaRetenido, mi.ivaAPagar,
          ]);
        }
        const activeMonths = allMonthIsr.filter(m => m.ingresos > 0 || m.deducciones > 0);
        addRow([
          'TOTAL',
          round2(activeMonths.reduce((s, m) => s + m.ingresos, 0)),
          round2(activeMonths.reduce((s, m) => s + m.deducciones, 0)),
          '', '', '', '',
          round2(activeMonths.reduce((s, m) => s + m.isrAPagar, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaCobrado, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaAcreditable, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaRetenido, 0)),
          round2(activeMonths.reduce((s, m) => s + m.ivaAPagar, 0)),
        ]);
      }
    }

    // --- ISR Summary (monthly report or annual summary of target month) ---
    if (targetMonth) {
      const mi = allMonthIsr[targetMonth - 1];
      addSection('RESUMEN ISR');
      if (isResico) {
        addHeaders(['Concepto', 'Monto']);
        addRow(['Ingresos del mes', mi.ingresos]);
        addRow([`Tasa RESICO aplicable`, `${((mi.tasaResico || 0) * 100).toFixed(1)}%`]);
        addRow(['ISR causado', mi.isrCausado]);
        addRow(['(-) ISR retenido por clientes', mi.isrRetenido]);
        addRow(['(=) ISR a pagar', mi.isrAPagar]);
      } else {
        addHeaders(['Concepto', 'Mes', 'Acumulado']);
        addRow(['Ingresos acumulables', mi.ingresos, round2(allMonthIsr.slice(0, targetMonth).reduce((s, m) => s + m.ingresos, 0))]);
        addRow(['(-) Deducciones autorizadas', mi.deducciones, round2(allMonthIsr.slice(0, targetMonth).reduce((s, m) => s + m.deducciones, 0))]);
        addRow(['(=) Base gravable', '', mi.baseGravable]);
        addRow(['ISR segun tarifa Art. 96', '', mi.isrCausado]);
        addRow(['(-) ISR retenido acumulado', '', mi.isrRetenido]);
        addRow(['(-) Pagos provisionales previos', '', mi.pagosPrevios]);
        addRow(['(=) ISR a pagar este mes', '', mi.isrAPagar]);
        addRow(['Tasa efectiva', '', `${mi.tasaEfectiva}%`]);
      }

      // --- IVA Summary ---
      addSection('RESUMEN IVA');
      addHeaders(['Concepto', 'Monto']);
      addRow(['IVA trasladado (cobrado)', mi.ivaCobrado]);
      addRow(['(-) IVA acreditable (pagado)', mi.ivaAcreditable]);
      addRow(['(-) IVA retenido por clientes', mi.ivaRetenido]);
      addRow([`(=) IVA a ${mi.ivaAPagar >= 0 ? 'pagar' : 'favor'}`, mi.ivaAPagar]);
      addRow(['Nota: Servicios medicos exentos Art. 15 frac XIV LIVA', '']);
    }

    // --- Emitted CFDIs (Ingresos) ---
    addSection('CFDI EMITIDOS (INGRESOS)');
    addHeaders(['Fecha', 'UUID', 'RFC Receptor', 'Nombre Receptor', 'Subtotal', 'IVA Trasladado', 'ISR Retenido', 'IVA Retenido', 'Total', 'Metodo Pago', 'Forma Pago', 'Tipo']);

    let emSubtotal = 0, emIva = 0, emIsrRet = 0, emIvaRet = 0, emTotal = 0;
    for (const cfdi of emittedCfdis) {
      const d = detailMap.get(cfdi.uuid.toLowerCase());
      const sub = d ? Number(d.subtotal) : Number(cfdi.monto);
      const iva = d ? Number(d.ivaTrasladado) : 0;
      const isrR = d ? Number(d.isrRetenido) : 0;
      const ivaR = d ? Number(d.ivaRetenido) : 0;
      const tot = d ? Number(d.total) : Number(cfdi.monto);
      emSubtotal += sub; emIva += iva; emIsrRet += isrR; emIvaRet += ivaR; emTotal += tot;
      addRow([
        formatDateMx(cfdi.issuedAt), cfdi.uuid,
        cfdi.receiverRfc, cfdi.receiverName || '',
        round2(sub), round2(iva), round2(isrR), round2(ivaR), round2(tot),
        d?.metodoPago || '', d?.formaPago || '',
        cfdi.efecto || 'I',
      ]);
    }
    addRow(['SUBTOTAL', '', '', '', round2(emSubtotal), round2(emIva), round2(emIsrRet), round2(emIvaRet), round2(emTotal), '', '', '']);

    // --- Received CFDIs (Gastos) ---
    addSection('CFDI RECIBIDOS (GASTOS)');
    addHeaders(['Fecha', 'UUID', 'RFC Emisor', 'Nombre Emisor', 'Subtotal', 'IVA Trasladado', 'ISR Retenido', 'IVA Retenido', 'Total', 'Metodo Pago', 'Forma Pago', 'Uso CFDI', 'Categoria', 'Deducible', 'Observaciones']);

    let recSubtotal = 0, recIva = 0, recIsrRet = 0, recIvaRet = 0, recTotal = 0;
    interface FlaggedExpense { date: string; uuid: string; rfc: string; name: string; subtotal: number; motivo: string }
    const nonDeductibles: FlaggedExpense[] = [];

    for (const cfdi of receivedCfdis) {
      const d = detailMap.get(cfdi.uuid.toLowerCase());
      const sub = d ? Number(d.subtotal) : Number(cfdi.monto);
      const iva = d ? Number(d.ivaTrasladado) : 0;
      const isrR = d ? Number(d.isrRetenido) : 0;
      const ivaR = d ? Number(d.ivaRetenido) : 0;
      const tot = d ? Number(d.total) : Number(cfdi.monto);
      recSubtotal += sub; recIva += iva; recIsrRet += isrR; recIvaRet += ivaR; recTotal += tot;

      // Classify category
      let primaryCategory = 'sin_clasificar';
      if (d && d.conceptos.length > 0) {
        let maxImporte = 0;
        for (const concepto of d.conceptos) {
          const importe = Number(concepto.importe) || 0;
          const catId = classifyConcepto(concepto.claveProdServ, concepto.descripcion);
          if (importe > maxImporte) {
            maxImporte = importe;
            primaryCategory = catId;
          }
        }
      }

      // Check deductibility
      const flags = checkDeductibility({
        formaPago: d?.formaPago || null,
        subtotal: sub,
        total: tot,
        satStatus: cfdi.satStatus,
        hasDetails: !!d,
        categoryId: primaryCategory,
        usoCfdi: d?.usoCfdi || null,
        regimenFiscal,
      });

      const hasNonDeductibleFlag = flags.some(f => f.type === 'cash_over_2k' || f.type === 'sin_efectos' || f.type === 'cancelled');
      let deducible: string;
      if (isResico) {
        deducible = 'N/A (RESICO)';
      } else if (hasNonDeductibleFlag) {
        deducible = 'No';
      } else if (flags.some(f => f.type === 'proportional')) {
        deducible = 'Parcial';
      } else {
        deducible = 'Si';
      }

      const observaciones = flags.map(f => f.message).join('; ');

      if (!isResico && hasNonDeductibleFlag) {
        nonDeductibles.push({
          date: formatDateMx(cfdi.issuedAt),
          uuid: cfdi.uuid,
          rfc: cfdi.issuerRfc,
          name: cfdi.issuerName || '',
          subtotal: round2(sub),
          motivo: flags.filter(f => f.severity === 'error').map(f => f.message).join('; '),
        });
      }

      addRow([
        formatDateMx(cfdi.issuedAt), cfdi.uuid,
        cfdi.issuerRfc, cfdi.issuerName || '',
        round2(sub), round2(iva), round2(isrR), round2(ivaR), round2(tot),
        d?.metodoPago || '', d?.formaPago || '', d?.usoCfdi || '',
        primaryCategory, deducible, observaciones,
      ]);
    }
    addRow(['SUBTOTAL', '', '', '', round2(recSubtotal), round2(recIva), round2(recIsrRet), round2(recIvaRet), round2(recTotal), '', '', '', '', '', '']);

    // --- Retentions by client ---
    addSection('RETENCIONES POR CLIENTE');
    addHeaders(['RFC', 'Nombre', 'ISR Retenido', 'IVA Retenido', 'Total Retenido']);

    const retentionMap: Record<string, { name: string; isr: number; iva: number }> = {};
    for (const cfdi of emittedCfdis) {
      const d = detailMap.get(cfdi.uuid.toLowerCase());
      const isrR = d ? Number(d.isrRetenido) : 0;
      const ivaR = d ? Number(d.ivaRetenido) : 0;
      if (isrR === 0 && ivaR === 0) continue;
      const key = cfdi.receiverRfc;
      if (!retentionMap[key]) {
        retentionMap[key] = { name: cfdi.receiverName || '', isr: 0, iva: 0 };
      }
      retentionMap[key].isr += isrR;
      retentionMap[key].iva += ivaR;
    }

    let retIsrTotal = 0, retIvaTotal = 0;
    for (const [rfc, ret] of Object.entries(retentionMap).sort((a, b) => (b[1].isr + b[1].iva) - (a[1].isr + a[1].iva))) {
      const total = round2(ret.isr + ret.iva);
      retIsrTotal += ret.isr;
      retIvaTotal += ret.iva;
      addRow([rfc, ret.name, round2(ret.isr), round2(ret.iva), total]);
    }
    if (Object.keys(retentionMap).length > 0) {
      addRow(['TOTAL', '', round2(retIsrTotal), round2(retIvaTotal), round2(retIsrTotal + retIvaTotal)]);
    }

    // --- Non-deductible expenses (612 only) ---
    if (!isResico && nonDeductibles.length > 0) {
      addSection('GASTOS NO DEDUCIBLES');
      addHeaders(['Fecha', 'UUID', 'RFC Emisor', 'Nombre Emisor', 'Subtotal', 'Motivo']);
      for (const nd of nonDeductibles) {
        addRow([nd.date, nd.uuid, nd.rfc, nd.name, nd.subtotal, nd.motivo]);
      }
    }

    // --- Deduction breakdown by category (annual + 612 only) ---
    if (!targetMonth && !isResico) {
      addSection('DESGLOSE DE DEDUCCIONES POR CATEGORIA');
      addHeaders(['Categoria', 'Cantidad CFDIs', 'Subtotal', 'IVA']);

      const catAgg: Record<string, { count: number; subtotal: number; iva: number }> = {};
      for (const cfdi of receivedCfdis) {
        const d = detailMap.get(cfdi.uuid.toLowerCase());
        let primaryCategory = 'sin_clasificar';
        if (d && d.conceptos.length > 0) {
          let maxImporte = 0;
          for (const concepto of d.conceptos) {
            const importe = Number(concepto.importe) || 0;
            const catId = classifyConcepto(concepto.claveProdServ, concepto.descripcion);
            if (importe > maxImporte) { maxImporte = importe; primaryCategory = catId; }
          }
        }
        if (!catAgg[primaryCategory]) catAgg[primaryCategory] = { count: 0, subtotal: 0, iva: 0 };
        catAgg[primaryCategory].count++;
        catAgg[primaryCategory].subtotal += d ? Number(d.subtotal) : Number(cfdi.monto);
        catAgg[primaryCategory].iva += d ? Number(d.ivaTrasladado) : 0;
      }

      for (const [cat, agg] of Object.entries(catAgg).sort((a, b) => b[1].subtotal - a[1].subtotal)) {
        addRow([cat, agg.count, round2(agg.subtotal), round2(agg.iva)]);
      }
    }

    // --- Alerts ---
    addSection('ALERTAS Y OBSERVACIONES');
    if (isResico) {
      // RESICO monitor
      const incomeResult = await prisma.$queryRaw<Array<{ total_income: number | null }>>`
        SELECT SUM(d.subtotal)::float AS total_income
        FROM practice_management.sat_cfdi_details d
        JOIN practice_management.sat_cfdi_metadata m
          ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
        WHERE d.doctor_id = ${doctor.id}
          AND m.sat_status = 'Vigente'
          AND m.direction = 'emitted'
          AND m.efecto = 'I'
          AND EXTRACT(YEAR FROM m.issued_at) = ${year}
      `;
      const ytdIncome = incomeResult[0]?.total_income || 0;
      const limit = 3500000;
      const pct = round2((ytdIncome / limit) * 100);
      addRow([`RESICO: Ingresos acumulados ${year}: $${round2(ytdIncome).toLocaleString()} de $${limit.toLocaleString()} (${pct}%)`]);
      if (pct > 80) {
        addRow(['ATENCION: Cerca del limite de $3.5M para permanecer en RESICO']);
      }
    }

    if (nonDeductibles.length > 0 && !isResico) {
      addRow([`${nonDeductibles.length} gasto(s) no deducible(s) por un total de $${round2(nonDeductibles.reduce((s, n) => s + n.subtotal, 0))}`]);
    }

    const noXmlCount = receivedCfdis.filter(c => !detailMap.has(c.uuid.toLowerCase())).length;
    if (noXmlCount > 0) {
      addRow([`${noXmlCount} CFDI(s) recibidos sin detalles XML - clasificacion aproximada`]);
    }

    addBlank();
    addRow([`Nota: Este reporte es informativo. Los calculos de ISR e IVA son aproximados basados en los CFDI disponibles.`]);
    addRow([`El contador debe verificar contra las constancias de retenciones y la contabilidad oficial.`]);

    // -----------------------------------------------------------------------
    // 5. Return CSV with BOM for Excel
    // -----------------------------------------------------------------------
    const csv = '\uFEFF' + lines.join('\n');
    const filename = targetMonth
      ? `reporte-contador-${year}-${String(targetMonth).padStart(2, '0')}.csv`
      : `reporte-contador-anual-${year}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error generating accountant report:', error);
    return NextResponse.json({ error: 'Error al generar reporte para contador' }, { status: 500 });
  }
}
