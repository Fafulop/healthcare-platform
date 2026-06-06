import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  classifyConcepto,
  checkDeductibility,
} from '@/lib/deduction-categories';
import { calculateIsr612, calculateIsrResico } from '@/lib/isr-tables';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Force Node.js runtime (pdfkit requires fs for font loading)
export const runtime = 'nodejs';

/**
 * GET /api/sat-descarga/export/accountant-report
 *
 * Query params:
 *   month  — 'YYYY-MM' (required for monthly)
 *   period — 'monthly' | 'annual' (default: monthly)
 *   year   — YYYY (for annual, defaults to current year)
 *   format — 'xlsx' | 'csv' | 'pdf' (default: xlsx)
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

function formatDateMx(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ---------------------------------------------------------------------------
// Report data types (shared across all formatters)
// ---------------------------------------------------------------------------

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

interface CfdiRow {
  date: string;
  uuid: string;
  rfc: string;
  name: string;
  subtotal: number;
  iva: number;
  isrRetenido: number;
  ivaRetenido: number;
  total: number;
  metodoPago: string;
  formaPago: string;
  efecto: string;
  // received-only fields
  usoCfdi?: string;
  category?: string;
  deducible?: string;
  observaciones?: string;
}

interface RetentionRow {
  rfc: string;
  name: string;
  isr: number;
  iva: number;
}

interface FlaggedExpense {
  date: string;
  uuid: string;
  rfc: string;
  name: string;
  subtotal: number;
  motivo: string;
}

interface CategoryAgg {
  category: string;
  count: number;
  subtotal: number;
  iva: number;
}

interface ReportData {
  periodLabel: string;
  regimenLabel: string;
  rfc: string;
  razonSocial: string;
  isResico: boolean;
  year: number;
  targetMonth: number | null;
  allMonthIsr: MonthIsr[];
  emittedRows: CfdiRow[];
  receivedRows: CfdiRow[];
  emittedTotals: { subtotal: number; iva: number; isrRet: number; ivaRet: number; total: number };
  receivedTotals: { subtotal: number; iva: number; isrRet: number; ivaRet: number; total: number };
  retentions: RetentionRow[];
  retentionTotals: { isr: number; iva: number };
  nonDeductibles: FlaggedExpense[];
  categories: CategoryAgg[];
  alerts: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const period = url.searchParams.get('period') || 'monthly';
    const monthParam = url.searchParams.get('month');
    const formatParam = url.searchParams.get('format') || 'xlsx';
    if (!['xlsx', 'csv', 'pdf'].includes(formatParam)) {
      return NextResponse.json({ error: 'Formato invalido. Use xlsx, csv o pdf.' }, { status: 400 });
    }
    const format = formatParam as 'xlsx' | 'csv' | 'pdf';

    let year: number;
    let targetMonth: number | null = null;

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

    const fiscalProfile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: { regimenFiscal: true, rfc: true, razonSocial: true },
    });
    const regimenFiscal = fiscalProfile?.regimenFiscal || '612';
    const isResico = regimenFiscal === '626';
    const rfc = fiscalProfile?.rfc || 'N/A';
    const razonSocial = fiscalProfile?.razonSocial || 'N/A';

    // -----------------------------------------------------------------------
    // 1. Monthly aggregation for ISR/IVA
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
      ingresos: number; deducciones: number; ivaCobrado: number;
      ivaAcreditable: number; isrRetenido: number; ivaRetenido: number;
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
    // 2. Compute ISR for all months
    // -----------------------------------------------------------------------
    const allMonthIsr: MonthIsr[] = [];
    if (isResico) {
      for (let m = 1; m <= 12; m++) {
        const raw = monthlyRaw[m];
        const { isr: isrCausado, tasa } = calculateIsrResico(raw.ingresos);
        const isrAPagar = Math.max(0, isrCausado - raw.isrRetenido);
        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;
        allMonthIsr.push({
          month: m, ingresos: round2(raw.ingresos), deducciones: round2(raw.deducciones),
          baseGravable: round2(raw.ingresos), isrCausado: round2(isrCausado),
          isrRetenido: round2(raw.isrRetenido), pagosPrevios: 0,
          isrAPagar: round2(isrAPagar),
          tasaEfectiva: raw.ingresos > 0 ? round2((isrCausado / raw.ingresos) * 100) : 0,
          tasaResico: tasa,
          ivaCobrado: round2(raw.ivaCobrado), ivaAcreditable: round2(raw.ivaAcreditable),
          ivaRetenido: round2(raw.ivaRetenido), ivaAPagar: round2(ivaNeto),
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
        const { isr: isrCausado } = calculateIsr612(baseGravable, m);
        const isrAPagar = Math.max(0, isrCausado - cumIsrRetenido - cumIsrPaid);
        const ivaNeto = raw.ivaCobrado - raw.ivaAcreditable - raw.ivaRetenido;
        allMonthIsr.push({
          month: m, ingresos: round2(raw.ingresos), deducciones: round2(raw.deducciones),
          baseGravable: round2(baseGravable), isrCausado: round2(isrCausado),
          isrRetenido: round2(cumIsrRetenido), pagosPrevios: round2(cumIsrPaid),
          isrAPagar: round2(isrAPagar),
          tasaEfectiva: baseGravable > 0 ? round2((isrCausado / baseGravable) * 100) : 0,
          ivaCobrado: round2(raw.ivaCobrado), ivaAcreditable: round2(raw.ivaAcreditable),
          ivaRetenido: round2(raw.ivaRetenido), ivaAPagar: round2(ivaNeto),
        });
        cumIsrPaid += isrAPagar;
      }
    }

    // -----------------------------------------------------------------------
    // 3. Fetch CFDI detail rows
    // -----------------------------------------------------------------------
    const dateFrom = targetMonth ? new Date(year, targetMonth - 1, 1) : new Date(`${year}-01-01T00:00:00Z`);
    const dateTo = targetMonth ? new Date(year, targetMonth, 1) : new Date(`${year + 1}-01-01T00:00:00Z`);

    const [emittedCfdis, receivedCfdis] = await Promise.all([
      prisma.satCfdiMetadata.findMany({
        where: { doctorId: doctor.id, direction: 'emitted', satStatus: 'Vigente', issuedAt: { gte: dateFrom, lt: dateTo } },
        orderBy: { issuedAt: 'asc' },
        select: { uuid: true, issuerRfc: true, issuerName: true, receiverRfc: true, receiverName: true, monto: true, efecto: true, satStatus: true, issuedAt: true },
      }),
      prisma.satCfdiMetadata.findMany({
        where: { doctorId: doctor.id, direction: 'received', satStatus: 'Vigente', efecto: { in: ['I', 'E'] }, issuedAt: { gte: dateFrom, lt: dateTo } },
        orderBy: { issuedAt: 'asc' },
        select: { uuid: true, issuerRfc: true, issuerName: true, receiverRfc: true, receiverName: true, monto: true, efecto: true, satStatus: true, issuedAt: true },
      }),
    ]);

    const allUuids = [...emittedCfdis, ...receivedCfdis].map(c => c.uuid.toLowerCase());
    const allDetails = allUuids.length > 0
      ? await prisma.satCfdiDetail.findMany({
          where: { doctorId: doctor.id, uuid: { in: allUuids } },
          select: { uuid: true, subtotal: true, total: true, ivaTrasladado: true, isrRetenido: true, ivaRetenido: true, metodoPago: true, formaPago: true, usoCfdi: true, conceptos: { select: { claveProdServ: true, descripcion: true, importe: true } } },
        })
      : [];
    const detailMap = new Map(allDetails.map(d => [d.uuid.toLowerCase(), d]));

    // -----------------------------------------------------------------------
    // 4. Process into report data structures
    // -----------------------------------------------------------------------
    const regimenLabel = isResico ? '626 - RESICO' : '612 - Actividad Empresarial y Profesional';
    const periodLabel = targetMonth ? `${MONTH_NAMES[targetMonth - 1]} ${year}` : `Anual ${year}`;

    // Emitted rows
    const emittedRows: CfdiRow[] = [];
    let emTotals = { subtotal: 0, iva: 0, isrRet: 0, ivaRet: 0, total: 0 };
    for (const cfdi of emittedCfdis) {
      const d = detailMap.get(cfdi.uuid.toLowerCase());
      const sub = d ? Number(d.subtotal) : Number(cfdi.monto);
      const iva = d ? Number(d.ivaTrasladado) : 0;
      const isrR = d ? Number(d.isrRetenido) : 0;
      const ivaR = d ? Number(d.ivaRetenido) : 0;
      const tot = d ? Number(d.total) : Number(cfdi.monto);
      emTotals.subtotal += sub; emTotals.iva += iva; emTotals.isrRet += isrR; emTotals.ivaRet += ivaR; emTotals.total += tot;
      emittedRows.push({
        date: formatDateMx(cfdi.issuedAt), uuid: cfdi.uuid,
        rfc: cfdi.receiverRfc, name: cfdi.receiverName || '',
        subtotal: round2(sub), iva: round2(iva), isrRetenido: round2(isrR), ivaRetenido: round2(ivaR), total: round2(tot),
        metodoPago: d?.metodoPago || '', formaPago: d?.formaPago || '', efecto: cfdi.efecto || 'I',
      });
    }
    emTotals = { subtotal: round2(emTotals.subtotal), iva: round2(emTotals.iva), isrRet: round2(emTotals.isrRet), ivaRet: round2(emTotals.ivaRet), total: round2(emTotals.total) };

    // Received rows
    const receivedRows: CfdiRow[] = [];
    let recTotals = { subtotal: 0, iva: 0, isrRet: 0, ivaRet: 0, total: 0 };
    const nonDeductibles: FlaggedExpense[] = [];

    for (const cfdi of receivedCfdis) {
      const d = detailMap.get(cfdi.uuid.toLowerCase());
      const sign = cfdi.efecto === 'E' ? -1 : 1;
      const sub = (d ? Number(d.subtotal) : Number(cfdi.monto)) * sign;
      const iva = (d ? Number(d.ivaTrasladado) : 0) * sign;
      const isrR = (d ? Number(d.isrRetenido) : 0) * sign;
      const ivaR = (d ? Number(d.ivaRetenido) : 0) * sign;
      const tot = (d ? Number(d.total) : Number(cfdi.monto)) * sign;
      recTotals.subtotal += sub; recTotals.iva += iva; recTotals.isrRet += isrR; recTotals.ivaRet += ivaR; recTotals.total += tot;

      let primaryCategory = 'sin_clasificar';
      if (d && d.conceptos.length > 0) {
        let maxImporte = 0;
        for (const concepto of d.conceptos) {
          const importe = Number(concepto.importe) || 0;
          const catId = classifyConcepto(concepto.claveProdServ, concepto.descripcion);
          if (importe > maxImporte) { maxImporte = importe; primaryCategory = catId; }
        }
      }

      const flags = checkDeductibility({
        formaPago: d?.formaPago || null, subtotal: Math.abs(sub), total: Math.abs(tot),
        satStatus: cfdi.satStatus, hasDetails: !!d, categoryId: primaryCategory,
        usoCfdi: d?.usoCfdi || null, regimenFiscal,
      });

      const hasNonDeductibleFlag = flags.some(f => f.type === 'cash_over_2k' || f.type === 'sin_efectos' || f.type === 'cancelled');
      let deducible: string;
      if (cfdi.efecto === 'E') deducible = 'Nota de credito';
      else if (isResico) deducible = 'N/A (RESICO)';
      else if (hasNonDeductibleFlag) deducible = 'No';
      else if (flags.some(f => f.type === 'proportional')) deducible = 'Parcial';
      else deducible = 'Si';

      if (!isResico && hasNonDeductibleFlag && cfdi.efecto !== 'E') {
        nonDeductibles.push({
          date: formatDateMx(cfdi.issuedAt), uuid: cfdi.uuid, rfc: cfdi.issuerRfc,
          name: cfdi.issuerName || '', subtotal: round2(Math.abs(sub)),
          motivo: flags.filter(f => f.severity === 'error').map(f => f.message).join('; '),
        });
      }

      receivedRows.push({
        date: formatDateMx(cfdi.issuedAt), uuid: cfdi.uuid,
        rfc: cfdi.issuerRfc, name: cfdi.issuerName || '',
        subtotal: round2(sub), iva: round2(iva), isrRetenido: round2(isrR), ivaRetenido: round2(ivaR), total: round2(tot),
        metodoPago: d?.metodoPago || '', formaPago: d?.formaPago || '', efecto: cfdi.efecto || 'I',
        usoCfdi: d?.usoCfdi || '', category: primaryCategory, deducible,
        observaciones: flags.map(f => f.message).join('; '),
      });
    }
    recTotals = { subtotal: round2(recTotals.subtotal), iva: round2(recTotals.iva), isrRet: round2(recTotals.isrRet), ivaRet: round2(recTotals.ivaRet), total: round2(recTotals.total) };

    // Retentions
    const retMap: Record<string, { name: string; isr: number; iva: number }> = {};
    for (const cfdi of emittedCfdis) {
      const d = detailMap.get(cfdi.uuid.toLowerCase());
      const isrR = d ? Number(d.isrRetenido) : 0;
      const ivaR = d ? Number(d.ivaRetenido) : 0;
      if (isrR === 0 && ivaR === 0) continue;
      const key = cfdi.receiverRfc;
      if (!retMap[key]) retMap[key] = { name: cfdi.receiverName || '', isr: 0, iva: 0 };
      retMap[key].isr += isrR;
      retMap[key].iva += ivaR;
    }
    const retentions: RetentionRow[] = Object.entries(retMap)
      .sort((a, b) => (b[1].isr + b[1].iva) - (a[1].isr + a[1].iva))
      .map(([rfcKey, r]) => ({ rfc: rfcKey, name: r.name, isr: round2(r.isr), iva: round2(r.iva) }));
    const retTotals = { isr: round2(retentions.reduce((s, r) => s + r.isr, 0)), iva: round2(retentions.reduce((s, r) => s + r.iva, 0)) };

    // Categories (annual + 612 only)
    const categories: CategoryAgg[] = [];
    if (!targetMonth && !isResico) {
      const catAgg: Record<string, { count: number; subtotal: number; iva: number }> = {};
      for (const cfdi of receivedCfdis) {
        if (cfdi.efecto === 'E') continue;
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
        categories.push({ category: cat, count: agg.count, subtotal: round2(agg.subtotal), iva: round2(agg.iva) });
      }
    }

    // Alerts
    const alerts: string[] = [];
    if (isResico) {
      const incomeResult = await prisma.$queryRaw<Array<{ total_income: number | null }>>`
        SELECT SUM(d.subtotal)::float AS total_income
        FROM practice_management.sat_cfdi_details d
        JOIN practice_management.sat_cfdi_metadata m ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
        WHERE d.doctor_id = ${doctor.id} AND m.sat_status = 'Vigente' AND m.direction = 'emitted' AND m.efecto = 'I' AND EXTRACT(YEAR FROM m.issued_at) = ${year}
      `;
      const ytdIncome = incomeResult[0]?.total_income || 0;
      const pct = round2((ytdIncome / 3500000) * 100);
      alerts.push(`RESICO: Ingresos acumulados ${year}: $${round2(ytdIncome).toLocaleString()} de $3,500,000 (${pct}%)`);
      if (pct > 80) alerts.push('ATENCION: Cerca del limite de $3.5M para permanecer en RESICO');
    }
    if (nonDeductibles.length > 0 && !isResico) {
      alerts.push(`${nonDeductibles.length} gasto(s) no deducible(s) por un total de $${round2(nonDeductibles.reduce((s, n) => s + n.subtotal, 0)).toLocaleString()}`);
    }
    const noXmlCount = receivedCfdis.filter(c => !detailMap.has(c.uuid.toLowerCase())).length;
    if (noXmlCount > 0) alerts.push(`${noXmlCount} CFDI(s) recibidos sin detalles XML — clasificacion aproximada`);

    const reportData: ReportData = {
      periodLabel, regimenLabel, rfc, razonSocial, isResico, year, targetMonth,
      allMonthIsr, emittedRows, receivedRows,
      emittedTotals: emTotals, receivedTotals: recTotals,
      retentions, retentionTotals: retTotals,
      nonDeductibles, categories, alerts,
      generatedAt: formatDateMx(new Date()),
    };

    // -----------------------------------------------------------------------
    // 5. Generate output in requested format
    // -----------------------------------------------------------------------
    const baseName = targetMonth
      ? `reporte-contador-${year}-${String(targetMonth).padStart(2, '0')}`
      : `reporte-contador-anual-${year}`;

    if (format === 'csv') return generateCsv(reportData, baseName);
    if (format === 'pdf') return await generatePdf(reportData, baseName);
    return await generateXlsx(reportData, baseName);

  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error generating accountant report:', error);
    return NextResponse.json({ error: 'Error al generar reporte para contador' }, { status: 500 });
  }
}

// ==========================================================================
// CSV FORMATTER
// ==========================================================================

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'number' ? value.toFixed(2) : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: (string | number | null)[]): string {
  return cells.map(csvEscape).join(',');
}

function generateCsv(data: ReportData, baseName: string): NextResponse {
  const lines: string[] = [];
  const blank = () => lines.push('');
  const section = (t: string) => { blank(); lines.push(csvEscape(`--- ${t} ---`)); };

  lines.push(csvEscape(`REPORTE PARA CONTADOR — ${data.targetMonth ? 'DECLARACION MENSUAL' : 'DECLARACION ANUAL'}`));
  lines.push(csvRow(['Periodo', data.periodLabel]));
  lines.push(csvRow(['Regimen', data.regimenLabel]));
  lines.push(csvRow(['RFC', data.rfc]));
  lines.push(csvRow(['Razon Social', data.razonSocial]));
  lines.push(csvRow(['Generado', data.generatedAt]));

  // Annual summary
  if (!data.targetMonth) {
    section('RESUMEN MENSUAL');
    if (data.isResico) {
      lines.push(csvRow(['Mes', 'Ingresos', 'Tasa RESICO', 'ISR Causado', 'ISR Retenido', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acreditable', 'IVA Retenido', 'IVA a Pagar']));
      for (const mi of data.allMonthIsr) {
        if (mi.ingresos === 0 && mi.deducciones === 0) continue;
        lines.push(csvRow([MONTH_NAMES[mi.month - 1], mi.ingresos, `${((mi.tasaResico || 0) * 100).toFixed(1)}%`, mi.isrCausado, mi.isrRetenido, mi.isrAPagar, mi.ivaCobrado, mi.ivaAcreditable, mi.ivaRetenido, mi.ivaAPagar]));
      }
    } else {
      lines.push(csvRow(['Mes', 'Ingresos', 'Deducciones', 'Base Gravable (Acum)', 'ISR Causado (Acum)', 'ISR Retenido (Acum)', 'Pagos Previos', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acreditable', 'IVA Retenido', 'IVA a Pagar']));
      for (const mi of data.allMonthIsr) {
        if (mi.ingresos === 0 && mi.deducciones === 0) continue;
        lines.push(csvRow([MONTH_NAMES[mi.month - 1], mi.ingresos, mi.deducciones, mi.baseGravable, mi.isrCausado, mi.isrRetenido, mi.pagosPrevios, mi.isrAPagar, mi.ivaCobrado, mi.ivaAcreditable, mi.ivaRetenido, mi.ivaAPagar]));
      }
    }
  }

  // Monthly ISR/IVA
  if (data.targetMonth) {
    const mi = data.allMonthIsr[data.targetMonth - 1];
    section('RESUMEN ISR');
    if (data.isResico) {
      lines.push(csvRow(['Concepto', 'Monto']));
      lines.push(csvRow(['Ingresos del mes', mi.ingresos]));
      lines.push(csvRow(['Tasa RESICO', `${((mi.tasaResico || 0) * 100).toFixed(1)}%`]));
      lines.push(csvRow(['ISR causado', mi.isrCausado]));
      lines.push(csvRow(['(-) ISR retenido', mi.isrRetenido]));
      lines.push(csvRow(['ISR a pagar', mi.isrAPagar]));
    } else {
      lines.push(csvRow(['Concepto', 'Mes', 'Acumulado']));
      const cumI = round2(data.allMonthIsr.slice(0, data.targetMonth).reduce((s, m) => s + m.ingresos, 0));
      const cumD = round2(data.allMonthIsr.slice(0, data.targetMonth).reduce((s, m) => s + m.deducciones, 0));
      lines.push(csvRow(['Ingresos acumulables', mi.ingresos, cumI]));
      lines.push(csvRow(['(-) Deducciones autorizadas', mi.deducciones, cumD]));
      lines.push(csvRow(['(=) Base gravable', '', mi.baseGravable]));
      lines.push(csvRow(['ISR segun tarifa Art. 96', '', mi.isrCausado]));
      lines.push(csvRow(['(-) ISR retenido acumulado', '', mi.isrRetenido]));
      lines.push(csvRow(['(-) Pagos provisionales previos', '', mi.pagosPrevios]));
      lines.push(csvRow(['ISR a pagar este mes', '', mi.isrAPagar]));
    }
    section('RESUMEN IVA');
    lines.push(csvRow(['Concepto', 'Monto']));
    lines.push(csvRow(['IVA trasladado (cobrado)', mi.ivaCobrado]));
    lines.push(csvRow(['(-) IVA acreditable (pagado)', mi.ivaAcreditable]));
    lines.push(csvRow(['(-) IVA retenido por clientes', mi.ivaRetenido]));
    lines.push(csvRow([`IVA a ${mi.ivaAPagar >= 0 ? 'pagar' : 'favor'}`, mi.ivaAPagar]));
  }

  // Emitted CFDIs
  section('CFDI EMITIDOS (INGRESOS)');
  lines.push(csvRow(['Fecha', 'UUID', 'RFC Receptor', 'Nombre Receptor', 'Subtotal', 'IVA Trasladado', 'ISR Retenido', 'IVA Retenido', 'Total', 'Metodo Pago', 'Forma Pago', 'Tipo']));
  for (const r of data.emittedRows) {
    lines.push(csvRow([r.date, r.uuid, r.rfc, r.name, r.subtotal, r.iva, r.isrRetenido, r.ivaRetenido, r.total, r.metodoPago, r.formaPago, r.efecto]));
  }
  const et = data.emittedTotals;
  lines.push(csvRow(['TOTAL', '', '', '', et.subtotal, et.iva, et.isrRet, et.ivaRet, et.total, '', '', '']));

  // Received CFDIs
  section('CFDI RECIBIDOS (GASTOS)');
  lines.push(csvRow(['Fecha', 'UUID', 'RFC Emisor', 'Nombre Emisor', 'Subtotal', 'IVA Trasladado', 'ISR Retenido', 'IVA Retenido', 'Total', 'Metodo Pago', 'Forma Pago', 'Uso CFDI', 'Categoria', 'Deducible', 'Observaciones']));
  for (const r of data.receivedRows) {
    lines.push(csvRow([r.date, r.uuid, r.rfc, r.name, r.subtotal, r.iva, r.isrRetenido, r.ivaRetenido, r.total, r.metodoPago, r.formaPago, r.usoCfdi || '', r.category || '', r.deducible || '', r.observaciones || '']));
  }
  const rt = data.receivedTotals;
  lines.push(csvRow(['TOTAL', '', '', '', rt.subtotal, rt.iva, rt.isrRet, rt.ivaRet, rt.total, '', '', '', '', '', '']));

  // Retentions
  if (data.retentions.length > 0) {
    section('RETENCIONES POR CLIENTE');
    lines.push(csvRow(['RFC', 'Nombre', 'ISR Retenido', 'IVA Retenido', 'Total Retenido']));
    for (const r of data.retentions) lines.push(csvRow([r.rfc, r.name, r.isr, r.iva, round2(r.isr + r.iva)]));
    lines.push(csvRow(['TOTAL', '', data.retentionTotals.isr, data.retentionTotals.iva, round2(data.retentionTotals.isr + data.retentionTotals.iva)]));
  }

  // Non-deductibles
  if (data.nonDeductibles.length > 0) {
    section('GASTOS NO DEDUCIBLES');
    lines.push(csvRow(['Fecha', 'UUID', 'RFC Emisor', 'Nombre Emisor', 'Subtotal', 'Motivo']));
    for (const nd of data.nonDeductibles) lines.push(csvRow([nd.date, nd.uuid, nd.rfc, nd.name, nd.subtotal, nd.motivo]));
  }

  // Categories
  if (data.categories.length > 0) {
    section('DESGLOSE POR CATEGORIA');
    lines.push(csvRow(['Categoria', 'Cantidad', 'Subtotal', 'IVA']));
    for (const c of data.categories) lines.push(csvRow([c.category, c.count, c.subtotal, c.iva]));
  }

  // Alerts
  if (data.alerts.length > 0) {
    section('ALERTAS');
    for (const a of data.alerts) lines.push(csvEscape(a));
  }

  blank();
  lines.push(csvEscape('Este reporte es informativo. Consulte con su contador antes de presentar declaraciones.'));

  const csv = '\uFEFF' + lines.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${baseName}.csv"`,
    },
  });
}

// ==========================================================================
// EXCEL FORMATTER
// ==========================================================================

const COLORS = {
  purple: '7C3AED', purpleLight: 'EDE9FE',
  green: '059669', greenLight: 'D1FAE5',
  blue: '2563EB', blueLight: 'DBEAFE',
  red: 'DC2626', redLight: 'FEE2E2',
  orange: 'D97706', orangeLight: 'FEF3C7',
  gray: '6B7280', grayLight: 'F3F4F6',
  white: 'FFFFFF', black: '111827',
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'D1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
  left: { style: 'thin', color: { argb: 'D1D5DB' } },
  right: { style: 'thin', color: { argb: 'D1D5DB' } },
};

const NUM_FMT_MXN = '#,##0.00';

function xlsSectionTitle(ws: ExcelJS.Worksheet, title: string, colSpan: number, color: string) {
  const row = ws.addRow([title]);
  ws.mergeCells(row.number, 1, row.number, colSpan);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  row.height = 24;
}

function xlsHeaderRow(ws: ExcelJS.Worksheet, headers: string[], color: string) {
  const row = ws.addRow(headers);
  for (let i = 1; i <= headers.length; i++) {
    const cell = row.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: COLORS.black } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.border = BORDER_THIN;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  row.height = 20;
}

function xlsDataRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], numCols?: number[]) {
  const row = ws.addRow(values);
  for (let i = 1; i <= values.length; i++) {
    const cell = row.getCell(i);
    cell.border = BORDER_THIN;
    cell.font = { size: 10 };
    if (numCols?.includes(i)) { cell.numFmt = NUM_FMT_MXN; cell.alignment = { horizontal: 'right' }; }
  }
  return row;
}

function xlsTotalRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], numCols?: number[]) {
  const row = ws.addRow(values);
  for (let i = 1; i <= values.length; i++) {
    const cell = row.getCell(i);
    cell.border = { top: { style: 'medium', color: { argb: COLORS.black } }, bottom: { style: 'double', color: { argb: COLORS.black } }, left: { style: 'thin', color: { argb: 'D1D5DB' } }, right: { style: 'thin', color: { argb: 'D1D5DB' } } };
    cell.font = { bold: true, size: 10 };
    if (numCols?.includes(i)) { cell.numFmt = NUM_FMT_MXN; cell.alignment = { horizontal: 'right' }; }
  }
}

async function generateXlsx(data: ReportData, baseName: string): Promise<NextResponse> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Healthcare Platform';
  wb.created = new Date();

  // SHEET 1: Resumen
  const ws1 = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: COLORS.purple } } });
  const titleRow = ws1.addRow([`REPORTE PARA CONTADOR — ${data.targetMonth ? 'DECLARACION MENSUAL' : 'DECLARACION ANUAL'}`]);
  ws1.mergeCells(1, 1, 1, 6);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: COLORS.purple } };
  titleRow.height = 28;

  for (const [label, value] of [['Periodo', data.periodLabel], ['Regimen', data.regimenLabel], ['RFC', data.rfc], ['Razon Social', data.razonSocial], ['Generado', data.generatedAt]]) {
    const r = ws1.addRow([label, value]);
    r.getCell(1).font = { bold: true, size: 10, color: { argb: COLORS.gray } };
    r.getCell(2).font = { size: 10 };
  }
  ws1.addRow([]);

  if (data.targetMonth) {
    const mi = data.allMonthIsr[data.targetMonth - 1];
    xlsSectionTitle(ws1, 'RESUMEN ISR', 6, COLORS.purple);
    if (data.isResico) {
      xlsHeaderRow(ws1, ['Concepto', 'Monto'], COLORS.purpleLight);
      xlsDataRow(ws1, ['Ingresos del mes', mi.ingresos], [2]);
      xlsDataRow(ws1, ['Tasa RESICO', `${((mi.tasaResico || 0) * 100).toFixed(1)}%`]);
      xlsDataRow(ws1, ['ISR causado', mi.isrCausado], [2]);
      xlsDataRow(ws1, ['(-) ISR retenido', mi.isrRetenido], [2]);
      xlsTotalRow(ws1, ['ISR a pagar', mi.isrAPagar], [2]);
    } else {
      xlsHeaderRow(ws1, ['Concepto', 'Mes', 'Acumulado'], COLORS.purpleLight);
      const cumI = round2(data.allMonthIsr.slice(0, data.targetMonth).reduce((s, m) => s + m.ingresos, 0));
      const cumD = round2(data.allMonthIsr.slice(0, data.targetMonth).reduce((s, m) => s + m.deducciones, 0));
      xlsDataRow(ws1, ['Ingresos acumulables', mi.ingresos, cumI], [2, 3]);
      xlsDataRow(ws1, ['(-) Deducciones autorizadas', mi.deducciones, cumD], [2, 3]);
      xlsDataRow(ws1, ['(=) Base gravable', null, mi.baseGravable], [3]);
      xlsDataRow(ws1, ['ISR segun tarifa Art. 96', null, mi.isrCausado], [3]);
      xlsDataRow(ws1, ['(-) ISR retenido acumulado', null, mi.isrRetenido], [3]);
      xlsDataRow(ws1, ['(-) Pagos provisionales previos', null, mi.pagosPrevios], [3]);
      xlsTotalRow(ws1, ['ISR a pagar este mes', null, mi.isrAPagar], [3]);
      xlsDataRow(ws1, ['Tasa efectiva', null, `${mi.tasaEfectiva}%`]);
    }
    ws1.addRow([]);
    xlsSectionTitle(ws1, 'RESUMEN IVA', 6, COLORS.green);
    xlsHeaderRow(ws1, ['Concepto', 'Monto'], COLORS.greenLight);
    xlsDataRow(ws1, ['IVA trasladado (cobrado)', mi.ivaCobrado], [2]);
    xlsDataRow(ws1, ['(-) IVA acreditable (pagado)', mi.ivaAcreditable], [2]);
    xlsDataRow(ws1, ['(-) IVA retenido por clientes', mi.ivaRetenido], [2]);
    xlsTotalRow(ws1, [`IVA a ${mi.ivaAPagar >= 0 ? 'pagar' : 'favor'}`, mi.ivaAPagar], [2]);
    const notaRow = ws1.addRow(['Nota: Servicios medicos pueden estar exentos (Art. 15 frac XIV LIVA)']);
    notaRow.getCell(1).font = { size: 9, italic: true, color: { argb: COLORS.gray } };
  }

  if (!data.targetMonth) {
    const active = data.allMonthIsr.filter(m => m.ingresos > 0 || m.deducciones > 0);
    xlsSectionTitle(ws1, 'RESUMEN MENSUAL', 12, COLORS.purple);
    if (data.isResico) {
      xlsHeaderRow(ws1, ['Mes', 'Ingresos', 'Tasa RESICO', 'ISR Causado', 'ISR Retenido', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acreditable', 'IVA Retenido', 'IVA a Pagar'], COLORS.purpleLight);
      const nc = [2, 4, 5, 6, 7, 8, 9, 10];
      for (const mi of active) xlsDataRow(ws1, [MONTH_NAMES[mi.month - 1], mi.ingresos, `${((mi.tasaResico || 0) * 100).toFixed(1)}%`, mi.isrCausado, mi.isrRetenido, mi.isrAPagar, mi.ivaCobrado, mi.ivaAcreditable, mi.ivaRetenido, mi.ivaAPagar], nc);
      xlsTotalRow(ws1, ['TOTAL', round2(active.reduce((s, m) => s + m.ingresos, 0)), '', round2(active.reduce((s, m) => s + m.isrCausado, 0)), round2(active.reduce((s, m) => s + m.isrRetenido, 0)), round2(active.reduce((s, m) => s + m.isrAPagar, 0)), round2(active.reduce((s, m) => s + m.ivaCobrado, 0)), round2(active.reduce((s, m) => s + m.ivaAcreditable, 0)), round2(active.reduce((s, m) => s + m.ivaRetenido, 0)), round2(active.reduce((s, m) => s + m.ivaAPagar, 0))], nc);
    } else {
      xlsHeaderRow(ws1, ['Mes', 'Ingresos', 'Deducciones', 'Base Gravable', 'ISR Causado', 'ISR Retenido', 'Pagos Previos', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acreditable', 'IVA Retenido', 'IVA a Pagar'], COLORS.purpleLight);
      const nc = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      for (const mi of active) xlsDataRow(ws1, [MONTH_NAMES[mi.month - 1], mi.ingresos, mi.deducciones, mi.baseGravable, mi.isrCausado, mi.isrRetenido, mi.pagosPrevios, mi.isrAPagar, mi.ivaCobrado, mi.ivaAcreditable, mi.ivaRetenido, mi.ivaAPagar], nc);
      xlsTotalRow(ws1, ['TOTAL', round2(active.reduce((s, m) => s + m.ingresos, 0)), round2(active.reduce((s, m) => s + m.deducciones, 0)), null, null, null, null, round2(active.reduce((s, m) => s + m.isrAPagar, 0)), round2(active.reduce((s, m) => s + m.ivaCobrado, 0)), round2(active.reduce((s, m) => s + m.ivaAcreditable, 0)), round2(active.reduce((s, m) => s + m.ivaRetenido, 0)), round2(active.reduce((s, m) => s + m.ivaAPagar, 0))], nc);
    }
  }

  ws1.columns.forEach((col) => { col.width = Math.max(col.width || 8, 16); });
  if (ws1.columns[0]) ws1.columns[0].width = 32;

  // Alerts on Resumen
  ws1.addRow([]);
  xlsSectionTitle(ws1, 'ALERTAS Y OBSERVACIONES', 6, COLORS.orange);
  for (const alert of data.alerts) {
    const r = ws1.addRow([alert]);
    r.getCell(1).font = { size: 10, color: { argb: alert.includes('ATENCION') ? COLORS.red : COLORS.gray } };
  }
  ws1.addRow([]);
  const disc = ws1.addRow(['Este reporte es informativo. Consulte con su contador antes de presentar declaraciones.']);
  disc.getCell(1).font = { size: 9, italic: true, color: { argb: COLORS.gray } };

  // SHEET 2: Ingresos
  const ws2 = wb.addWorksheet('Ingresos', { properties: { tabColor: { argb: COLORS.green } } });
  xlsSectionTitle(ws2, `CFDI EMITIDOS — ${data.periodLabel}`, 12, COLORS.green);
  xlsHeaderRow(ws2, ['Fecha', 'UUID', 'RFC Receptor', 'Nombre', 'Subtotal', 'IVA', 'ISR Ret', 'IVA Ret', 'Total', 'Met. Pago', 'Forma Pago', 'Tipo'], COLORS.greenLight);
  const en = [5, 6, 7, 8, 9];
  for (const r of data.emittedRows) xlsDataRow(ws2, [r.date, r.uuid, r.rfc, r.name, r.subtotal, r.iva, r.isrRetenido, r.ivaRetenido, r.total, r.metodoPago, r.formaPago, r.efecto], en);
  xlsTotalRow(ws2, ['TOTAL', '', '', '', data.emittedTotals.subtotal, data.emittedTotals.iva, data.emittedTotals.isrRet, data.emittedTotals.ivaRet, data.emittedTotals.total, '', '', ''], en);
  ws2.getColumn(1).width = 12; ws2.getColumn(2).width = 38; ws2.getColumn(3).width = 15; ws2.getColumn(4).width = 30;
  for (const c of en) ws2.getColumn(c).width = 16;

  // SHEET 3: Gastos
  const ws3 = wb.addWorksheet('Gastos', { properties: { tabColor: { argb: COLORS.blue } } });
  xlsSectionTitle(ws3, `CFDI RECIBIDOS — ${data.periodLabel}`, 15, COLORS.blue);
  xlsHeaderRow(ws3, ['Fecha', 'UUID', 'RFC Emisor', 'Nombre', 'Subtotal', 'IVA', 'ISR Ret', 'IVA Ret', 'Total', 'Met. Pago', 'Forma Pago', 'Uso CFDI', 'Categoria', 'Deducible', 'Observaciones'], COLORS.blueLight);
  const rn = [5, 6, 7, 8, 9];
  for (const r of data.receivedRows) {
    const row = xlsDataRow(ws3, [r.date, r.uuid, r.rfc, r.name, r.subtotal, r.iva, r.isrRetenido, r.ivaRetenido, r.total, r.metodoPago, r.formaPago, r.usoCfdi || '', r.category || '', r.deducible || '', r.observaciones || ''], rn);
    if (r.deducible === 'No') for (let i = 1; i <= 15; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.redLight } };
    else if (r.deducible === 'Nota de credito') for (let i = 1; i <= 15; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.orangeLight } };
  }
  xlsTotalRow(ws3, ['TOTAL', '', '', '', data.receivedTotals.subtotal, data.receivedTotals.iva, data.receivedTotals.isrRet, data.receivedTotals.ivaRet, data.receivedTotals.total, '', '', '', '', '', ''], rn);
  ws3.getColumn(1).width = 12; ws3.getColumn(2).width = 38; ws3.getColumn(3).width = 15; ws3.getColumn(4).width = 30;
  for (const c of rn) ws3.getColumn(c).width = 16;
  ws3.getColumn(13).width = 18; ws3.getColumn(14).width = 14; ws3.getColumn(15).width = 40;

  // SHEET 4: Retenciones
  if (data.retentions.length > 0) {
    const ws4 = wb.addWorksheet('Retenciones', { properties: { tabColor: { argb: COLORS.orange } } });
    xlsSectionTitle(ws4, `RETENCIONES POR CLIENTE — ${data.periodLabel}`, 5, COLORS.orange);
    xlsHeaderRow(ws4, ['RFC', 'Nombre', 'ISR Retenido', 'IVA Retenido', 'Total'], COLORS.orangeLight);
    for (const r of data.retentions) xlsDataRow(ws4, [r.rfc, r.name, r.isr, r.iva, round2(r.isr + r.iva)], [3, 4, 5]);
    xlsTotalRow(ws4, ['TOTAL', '', data.retentionTotals.isr, data.retentionTotals.iva, round2(data.retentionTotals.isr + data.retentionTotals.iva)], [3, 4, 5]);
    ws4.getColumn(1).width = 16; ws4.getColumn(2).width = 35; ws4.getColumn(3).width = 18; ws4.getColumn(4).width = 18; ws4.getColumn(5).width = 18;
  }

  // SHEET 5: No Deducibles
  if (!data.isResico && data.nonDeductibles.length > 0) {
    const ws5 = wb.addWorksheet('No Deducibles', { properties: { tabColor: { argb: COLORS.red } } });
    xlsSectionTitle(ws5, `GASTOS NO DEDUCIBLES — ${data.periodLabel}`, 6, COLORS.red);
    xlsHeaderRow(ws5, ['Fecha', 'UUID', 'RFC Emisor', 'Nombre', 'Subtotal', 'Motivo'], COLORS.redLight);
    for (const nd of data.nonDeductibles) xlsDataRow(ws5, [nd.date, nd.uuid, nd.rfc, nd.name, nd.subtotal, nd.motivo], [5]);
    xlsTotalRow(ws5, ['TOTAL', '', '', '', round2(data.nonDeductibles.reduce((s, n) => s + n.subtotal, 0)), `${data.nonDeductibles.length} gasto(s)`], [5]);
    ws5.getColumn(1).width = 12; ws5.getColumn(2).width = 38; ws5.getColumn(3).width = 15; ws5.getColumn(4).width = 30; ws5.getColumn(5).width = 16; ws5.getColumn(6).width = 50;
  }

  // SHEET 6: Categorias
  if (data.categories.length > 0) {
    const ws6 = wb.addWorksheet('Categorias', { properties: { tabColor: { argb: COLORS.purple } } });
    xlsSectionTitle(ws6, `DEDUCCIONES POR CATEGORIA — ${data.year}`, 4, COLORS.purple);
    xlsHeaderRow(ws6, ['Categoria', 'Cantidad', 'Subtotal', 'IVA'], COLORS.purpleLight);
    for (const c of data.categories) xlsDataRow(ws6, [c.category, c.count, c.subtotal, c.iva], [3, 4]);
    ws6.getColumn(1).width = 28; ws6.getColumn(2).width = 16; ws6.getColumn(3).width = 18; ws6.getColumn(4).width = 18;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
    },
  });
}

// ==========================================================================
// PDF FORMATTER
// ==========================================================================

async function generatePdf(data: ReportData, baseName: string): Promise<NextResponse> {
  const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const PAGE_W = 792 - 80; // letter landscape minus margins
  const COL_GAP = 4;

  // Helpers
  const drawTableHeader = (headers: string[], colWidths: number[], y: number) => {
    doc.save();
    doc.rect(40, y, PAGE_W, 18).fill('#7C3AED');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    let x = 42;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, y + 4, { width: colWidths[i] - COL_GAP, align: 'center' });
      x += colWidths[i];
    }
    doc.restore();
    return y + 18;
  };

  const drawTableRow = (cells: string[], colWidths: number[], y: number, opts?: { bold?: boolean; bg?: string; numCols?: number[] }) => {
    if (y > 560) { doc.addPage(); y = 40; }
    if (opts?.bg) { doc.save(); doc.rect(40, y, PAGE_W, 16).fill(opts.bg); doc.restore(); }
    doc.fillColor('#111827').fontSize(7.5).font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica');
    let x = 42;
    for (let i = 0; i < cells.length; i++) {
      const align = opts?.numCols?.includes(i) ? 'right' as const : 'left' as const;
      doc.text(cells[i], x, y + 3, { width: colWidths[i] - COL_GAP, align });
      x += colWidths[i];
    }
    return y + 16;
  };

  const drawSectionTitle = (title: string, y: number, color = '#7C3AED') => {
    if (y > 540) { doc.addPage(); y = 40; }
    doc.save();
    doc.rect(40, y, PAGE_W, 22).fill(color);
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold');
    doc.text(title, 46, y + 5);
    doc.restore();
    return y + 26;
  };

  const fmtNum = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Page 1: Header + ISR/IVA Summary ---
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#7C3AED')
    .text(`REPORTE PARA CONTADOR`, 40, 40);
  doc.fontSize(10).font('Helvetica').fillColor('#6B7280');
  doc.text(`${data.targetMonth ? 'Declaracion Mensual' : 'Declaracion Anual'} — ${data.periodLabel}`, 40, 60);
  doc.text(`Regimen: ${data.regimenLabel}    RFC: ${data.rfc}    Generado: ${data.generatedAt}`, 40, 74);

  let y = 100;

  if (data.targetMonth) {
    const mi = data.allMonthIsr[data.targetMonth - 1];
    const summCols = [300, 180];
    y = drawSectionTitle('RESUMEN ISR', y);

    if (data.isResico) {
      y = drawTableHeader(['Concepto', 'Monto'], summCols, y);
      y = drawTableRow(['Ingresos del mes', `$${fmtNum(mi.ingresos)}`], summCols, y, { numCols: [1] });
      y = drawTableRow(['Tasa RESICO', `${((mi.tasaResico || 0) * 100).toFixed(1)}%`], summCols, y, { numCols: [1] });
      y = drawTableRow(['ISR causado', `$${fmtNum(mi.isrCausado)}`], summCols, y, { numCols: [1] });
      y = drawTableRow(['(-) ISR retenido', `$${fmtNum(mi.isrRetenido)}`], summCols, y, { numCols: [1] });
      y = drawTableRow(['ISR a pagar', `$${fmtNum(mi.isrAPagar)}`], summCols, y, { bold: true, bg: '#EDE9FE', numCols: [1] });
    } else {
      const cols3 = [240, 120, 120];
      y = drawTableHeader(['Concepto', 'Mes', 'Acumulado'], cols3, y);
      const cumI = round2(data.allMonthIsr.slice(0, data.targetMonth).reduce((s, m) => s + m.ingresos, 0));
      const cumD = round2(data.allMonthIsr.slice(0, data.targetMonth).reduce((s, m) => s + m.deducciones, 0));
      y = drawTableRow(['Ingresos acumulables', `$${fmtNum(mi.ingresos)}`, `$${fmtNum(cumI)}`], cols3, y, { numCols: [1, 2] });
      y = drawTableRow(['(-) Deducciones autorizadas', `$${fmtNum(mi.deducciones)}`, `$${fmtNum(cumD)}`], cols3, y, { numCols: [1, 2] });
      y = drawTableRow(['(=) Base gravable', '', `$${fmtNum(mi.baseGravable)}`], cols3, y, { numCols: [2] });
      y = drawTableRow(['ISR segun tarifa Art. 96', '', `$${fmtNum(mi.isrCausado)}`], cols3, y, { numCols: [2] });
      y = drawTableRow(['(-) ISR retenido acumulado', '', `$${fmtNum(mi.isrRetenido)}`], cols3, y, { numCols: [2] });
      y = drawTableRow(['(-) Pagos provisionales previos', '', `$${fmtNum(mi.pagosPrevios)}`], cols3, y, { numCols: [2] });
      y = drawTableRow(['ISR a pagar este mes', '', `$${fmtNum(mi.isrAPagar)}`], cols3, y, { bold: true, bg: '#EDE9FE', numCols: [2] });
    }

    y += 10;
    y = drawSectionTitle('RESUMEN IVA', y, '#059669');
    y = drawTableHeader(['Concepto', 'Monto'], [300, 180], y);
    y = drawTableRow(['IVA trasladado (cobrado)', `$${fmtNum(mi.ivaCobrado)}`], [300, 180], y, { numCols: [1] });
    y = drawTableRow(['(-) IVA acreditable (pagado)', `$${fmtNum(mi.ivaAcreditable)}`], [300, 180], y, { numCols: [1] });
    y = drawTableRow(['(-) IVA retenido por clientes', `$${fmtNum(mi.ivaRetenido)}`], [300, 180], y, { numCols: [1] });
    y = drawTableRow([`IVA a ${mi.ivaAPagar >= 0 ? 'pagar' : 'favor'}`, `$${fmtNum(mi.ivaAPagar)}`], [300, 180], y, { bold: true, bg: '#D1FAE5', numCols: [1] });
  }

  // Annual monthly table
  if (!data.targetMonth) {
    const active = data.allMonthIsr.filter(m => m.ingresos > 0 || m.deducciones > 0);
    y = drawSectionTitle('RESUMEN MENSUAL', y);
    if (data.isResico) {
      const cw = [65, 75, 55, 75, 75, 75, 75, 75, 55, 75];
      const hd = ['Mes', 'Ingresos', 'Tasa', 'ISR Causado', 'ISR Retenido', 'ISR a Pagar', 'IVA Cobrado', 'IVA Acredit.', 'IVA Ret.', 'IVA a Pagar'];
      y = drawTableHeader(hd, cw, y);
      const nc = [1, 3, 4, 5, 6, 7, 8, 9];
      for (const mi of active) y = drawTableRow([MONTH_NAMES[mi.month - 1], `$${fmtNum(mi.ingresos)}`, `${((mi.tasaResico || 0) * 100).toFixed(1)}%`, `$${fmtNum(mi.isrCausado)}`, `$${fmtNum(mi.isrRetenido)}`, `$${fmtNum(mi.isrAPagar)}`, `$${fmtNum(mi.ivaCobrado)}`, `$${fmtNum(mi.ivaAcreditable)}`, `$${fmtNum(mi.ivaRetenido)}`, `$${fmtNum(mi.ivaAPagar)}`], cw, y, { numCols: nc });
      y = drawTableRow(['TOTAL', `$${fmtNum(round2(active.reduce((s, m) => s + m.ingresos, 0)))}`, '', `$${fmtNum(round2(active.reduce((s, m) => s + m.isrCausado, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.isrRetenido, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.isrAPagar, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaCobrado, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaAcreditable, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaRetenido, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaAPagar, 0)))}`], cw, y, { bold: true, bg: '#EDE9FE', numCols: nc });
    } else {
      const cw = [55, 60, 60, 65, 65, 65, 60, 65, 55, 55, 50, 55];
      const hd = ['Mes', 'Ingresos', 'Deducc.', 'Base Grav.', 'ISR Caus.', 'ISR Ret.', 'Pag.Prev.', 'ISR Pagar', 'IVA Cob.', 'IVA Acred.', 'IVA Ret.', 'IVA Pagar'];
      y = drawTableHeader(hd, cw, y);
      const nc = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      for (const mi of active) y = drawTableRow([MONTH_NAMES[mi.month - 1], `$${fmtNum(mi.ingresos)}`, `$${fmtNum(mi.deducciones)}`, `$${fmtNum(mi.baseGravable)}`, `$${fmtNum(mi.isrCausado)}`, `$${fmtNum(mi.isrRetenido)}`, `$${fmtNum(mi.pagosPrevios)}`, `$${fmtNum(mi.isrAPagar)}`, `$${fmtNum(mi.ivaCobrado)}`, `$${fmtNum(mi.ivaAcreditable)}`, `$${fmtNum(mi.ivaRetenido)}`, `$${fmtNum(mi.ivaAPagar)}`], cw, y, { numCols: nc });
      y = drawTableRow(['TOTAL', `$${fmtNum(round2(active.reduce((s, m) => s + m.ingresos, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.deducciones, 0)))}`, '', '', '', '', `$${fmtNum(round2(active.reduce((s, m) => s + m.isrAPagar, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaCobrado, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaAcreditable, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaRetenido, 0)))}`, `$${fmtNum(round2(active.reduce((s, m) => s + m.ivaAPagar, 0)))}`], cw, y, { bold: true, bg: '#EDE9FE', numCols: nc });
    }
  }

  // Retentions summary
  if (data.retentions.length > 0) {
    y += 10;
    y = drawSectionTitle('RETENCIONES POR CLIENTE', y, '#D97706');
    const cw = [140, 250, 100, 100, 100];
    y = drawTableHeader(['RFC', 'Nombre', 'ISR Ret.', 'IVA Ret.', 'Total'], cw, y);
    for (const r of data.retentions) y = drawTableRow([r.rfc, r.name, `$${fmtNum(r.isr)}`, `$${fmtNum(r.iva)}`, `$${fmtNum(round2(r.isr + r.iva))}`], cw, y, { numCols: [2, 3, 4] });
    y = drawTableRow(['TOTAL', '', `$${fmtNum(data.retentionTotals.isr)}`, `$${fmtNum(data.retentionTotals.iva)}`, `$${fmtNum(round2(data.retentionTotals.isr + data.retentionTotals.iva))}`], cw, y, { bold: true, bg: '#FEF3C7', numCols: [2, 3, 4] });
  }

  // Alerts
  if (data.alerts.length > 0) {
    y += 10;
    y = drawSectionTitle('ALERTAS', y, '#D97706');
    for (const a of data.alerts) {
      doc.fontSize(8).font('Helvetica').fillColor(a.includes('ATENCION') ? '#DC2626' : '#6B7280');
      doc.text(`• ${a}`, 46, y + 2);
      y += 14;
    }
  }

  // Disclaimer
  y += 10;
  doc.fontSize(7).font('Helvetica').fillColor('#9CA3AF');
  doc.text('Este reporte es informativo. Los calculos de ISR e IVA son aproximados. Consulte con su contador antes de presentar declaraciones.', 40, y, { width: PAGE_W });

  doc.end();

  const buffer = await pdfReady;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
    },
  });
}
