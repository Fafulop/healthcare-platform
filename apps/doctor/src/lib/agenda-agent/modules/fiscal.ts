/**
 * FISCAL module — PR F1.5: READ-ONLY tools over the SAT analytics tabs
 * (/dashboard/sat-descarga: Deducciones · Declaraciones · PPD/Pagos).
 *
 * Design (blueprint GENERAL AGENTES + AGENTE FACTURAS docs):
 * - Regla 0 / clase-E7 HARD BOUNDARY: this module aggregates RAW FACTS from
 *   the XML-parsed CFDIs (sums, counts, cash-basis bucketing). It NEVER
 *   computes ISR (progressive tables live in apps/api/lib/isr-tables and are
 *   not re-implemented here) and NEVER classifies deductibility by category
 *   (apps/api/lib/deduction-categories). Estimates/classification = the tabs.
 * - Cash basis mirrors the declaration endpoint EXACTLY (its 3 SQL queries,
 *   adapted): PUE counts at invoice date; PPD counts at PAYMENT date, prorated
 *   by the complemento's base_dr (fallback: monto_pagado/total share); PPD
 *   without complemento is EXCLUDED and reported separately.
 * - Source is the XML detail layer (sat_cfdi_details): only CFDIs whose XML
 *   is downloaded count — the tools say so.
 * - Money amounts round to cents; lists are capped (8KB tool-result budget).
 */

import { prisma } from '@healthcare/database';
import type { AnthropicTool } from '../anthropic';
import type { ToolContext } from '../tools';
import { mxTodayKey } from '../dates';
import type { AgentModule } from './types';

const PPD_LIST_CAP = 10;
const MX_TZ = 'America/Mexico_City';

const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// -----------------------------------------------------------------------------
// Tool definitions
// -----------------------------------------------------------------------------

const FISCAL_TOOLS: AnthropicTool[] = [
  {
    name: 'get_resumen_fiscal',
    description:
      'Resumen fiscal MENSUAL del año (base de efectivo, desde los XML del SAT): ingresos y gastos/deducciones (subtotales), IVA cobrado vs IVA acreditable, retenciones de ISR/IVA que te hicieron, facturas PPD excluidas por no tener complemento de pago, y qué meses ya tienen declaración registrada (con montos pagados). Úsala para "¿cuánto ingresé/gasté en X mes?", "¿cuánto IVA cobré?", "¿ya declaré junio?". OJO: NO calcula el ISR a pagar — la estimación con tablas vive en la pestaña Declaraciones del dashboard SAT.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Año (opcional, default: año actual)' },
      },
    },
  },
  {
    name: 'get_ppd_cobranza',
    description:
      'Cobranza de facturas PPD (pago diferido): qué facturas PPD emitiste, cuáles ya tienen complemento de pago (REP) y CUÁNTO TE DEBEN todavía — o al revés (direction "received": facturas PPD que TÚ debes pagar a proveedores). Úsala para "¿quién me debe?", "¿qué facturas siguen sin pagarse?", "¿debo algún complemento?". La vista completa con sugerencias de matching vive en la pestaña PPD del dashboard SAT.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Año (opcional, default: año actual)' },
        direction: {
          type: 'string',
          enum: ['emitted', 'received'],
          description: 'emitted = facturas que TÚ emitiste (te deben). received = facturas de proveedores (tú debes). Default: emitted',
        },
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

function mxDayOf(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: MX_TZ });
}

/** Model-supplied year: bounded integer or current year. */
function asYear(v: unknown): number {
  const current = Number(mxTodayKey().slice(0, 4));
  const n = typeof v === 'number' ? Math.trunc(v) : NaN;
  return Number.isFinite(n) && n >= 2020 && n <= current + 1 ? n : current;
}

// -----------------------------------------------------------------------------
// get_resumen_fiscal — the declaration endpoint's cash-basis aggregation,
// STOPPING before the ISR tables (clase-E7 boundary).
// -----------------------------------------------------------------------------

interface MonthRow {
  month: number;
  direction: string;
  efecto: string;
  count: bigint;
  sum_subtotal: number | null;
  sum_iva_trasladado: number | null;
  sum_isr_retenido: number | null;
  sum_iva_retenido: number | null;
}

async function getResumenFiscal(ctx: ToolContext, input: { year?: number }) {
  const year = asYear(input.year);
  const doctorId = ctx.doctorId;

  // The 3 queries mirror apps/api/.../sat-descarga/declaration/route.ts —
  // divergence here would make the assistant contradict the tab.
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

  const ppdExcludedRows = prisma.$queryRaw<
    Array<{ direction: string; count: bigint; sum_subtotal: number | null }>
  >`
    SELECT m.direction, COUNT(*)::bigint AS count,
      SUM(d.subtotal)::float AS sum_subtotal
    FROM practice_management.sat_cfdi_details d
    JOIN practice_management.sat_cfdi_metadata m
      ON m.doctor_id = d.doctor_id AND LOWER(m.uuid) = LOWER(d.uuid)
    LEFT JOIN practice_management.sat_pagos p
      ON p.doctor_id = d.doctor_id
      AND LOWER(p.factura_uuid) = LOWER(d.uuid)
      AND p.unlinked_at IS NULL
    WHERE d.doctor_id = ${doctorId}
      AND m.sat_status = 'Vigente'
      AND m.efecto = 'I'
      AND d.metodo_pago = 'PPD'
      AND p.id IS NULL
      AND EXTRACT(YEAR FROM m.issued_at) = ${year}
    GROUP BY m.direction
  `;

  const [profile, receipts, rows1, rows2, excludedRows] = await Promise.all([
    prisma.doctorFiscalProfile.findUnique({
      where: { doctorId },
      select: { regimenFiscal: true, regimenFiscalDesc: true },
    }),
    prisma.satDeclarationReceipt.findMany({
      where: { doctorId, year },
      select: { month: true, isrPagado: true, ivaPagado: true },
      orderBy: { month: 'asc' },
    }),
    pueRows,
    ppdRows,
    ppdExcludedRows,
  ]);

  type Monthly = {
    ingresos: number; deducciones: number; ivaCobrado: number;
    ivaAcreditable: number; isrRetenido: number; ivaRetenido: number;
  };
  const monthly: Record<number, Monthly> = {};
  for (let m = 1; m <= 12; m++) {
    monthly[m] = { ingresos: 0, deducciones: 0, ivaCobrado: 0, ivaAcreditable: 0, isrRetenido: 0, ivaRetenido: 0 };
  }
  for (const row of [...rows1, ...rows2]) {
    const e = monthly[row.month];
    if (!e) continue;
    const sign = row.efecto === 'E' ? -1 : 1; // egresos (notas de crédito) restan
    if (row.direction === 'emitted') {
      e.ingresos += (row.sum_subtotal ?? 0) * sign;
      e.ivaCobrado += (row.sum_iva_trasladado ?? 0) * sign;
      e.isrRetenido += (row.sum_isr_retenido ?? 0) * sign;
      e.ivaRetenido += (row.sum_iva_retenido ?? 0) * sign;
    } else {
      e.deducciones += (row.sum_subtotal ?? 0) * sign;
      e.ivaAcreditable += (row.sum_iva_trasladado ?? 0) * sign;
    }
  }

  const receiptByMonth = new Map(receipts.map((r) => [r.month, r]));
  const meses = [];
  const totals: Monthly = { ingresos: 0, deducciones: 0, ivaCobrado: 0, ivaAcreditable: 0, isrRetenido: 0, ivaRetenido: 0 };
  for (let m = 1; m <= 12; m++) {
    const e = monthly[m];
    const hasData = Object.values(e).some((v) => v !== 0);
    const receipt = receiptByMonth.get(m);
    for (const k of Object.keys(totals) as (keyof Monthly)[]) totals[k] += e[k];
    if (!hasData && !receipt) continue; // skip empty months — token budget
    meses.push({
      mes: `${MESES[m]} (${m})`,
      ingresos: round2(e.ingresos),
      deducciones: round2(e.deducciones),
      ivaCobrado: round2(e.ivaCobrado),
      ivaAcreditable: round2(e.ivaAcreditable),
      isrRetenido: round2(e.isrRetenido),
      ivaRetenido: round2(e.ivaRetenido),
      declaracionRegistrada: receipt
        ? { isrPagado: receipt.isrPagado ? Number(receipt.isrPagado) : null, ivaPagado: receipt.ivaPagado ? Number(receipt.ivaPagado) : null }
        : null,
    });
  }

  const ppdExcluidas = excludedRows.map((r) => ({
    direccion: r.direction === 'emitted' ? 'emitidas (tus facturas)' : 'recibidas (gastos)',
    cantidad: Number(r.count),
    subtotal: round2(r.sum_subtotal ?? 0),
  }));

  // month 13 = declaración ANUAL (convention of sat_declaration_receipts)
  const anual = receiptByMonth.get(13);

  const regimen = profile?.regimenFiscal || null;
  return {
    year,
    regimenFiscal: regimen ? `${regimen}${profile?.regimenFiscalDesc ? ` (${profile.regimenFiscalDesc})` : ''}` : 'sin perfil fiscal',
    fuente:
      'XML de CFDIs descargados del SAT (base de efectivo: PUE por fecha de factura, PPD por fecha de PAGO del complemento). Solo cuenta lo que ya tiene XML descargado — la frescura del sync la da get_sat_cfdis.',
    meses,
    totalesAnuales: {
      ingresos: round2(totals.ingresos),
      deducciones: round2(totals.deducciones),
      ivaCobrado: round2(totals.ivaCobrado),
      ivaAcreditable: round2(totals.ivaAcreditable),
      isrRetenido: round2(totals.isrRetenido),
      ivaRetenido: round2(totals.ivaRetenido),
    },
    declaracionAnual: anual
      ? { registrada: true, isrPagado: anual.isrPagado ? Number(anual.isrPagado) : null, ivaPagado: anual.ivaPagado ? Number(anual.ivaPagado) : null }
      : { registrada: false },
    ...(ppdExcluidas.length > 0
      ? {
          ppdSinComplemento: {
            nota: 'Facturas PPD SIN complemento de pago — NO cuentan aún en base de efectivo (se contarán cuando se paguen).',
            detalle: ppdExcluidas,
          },
        }
      : {}),
    notas: [
      regimen === '626'
        ? 'RESICO (626): los gastos NO reducen el ISR (tasa fija sobre ingreso bruto), pero el IVA de los gastos SÍ es acreditable.'
        : 'Régimen 612: las deducciones reducen la base de ISR y el IVA de gastos es acreditable.',
      'El ISR a pagar NO se calcula aquí — la estimación con tablas y pagos previos vive en la pestaña Declaraciones del dashboard SAT.',
      'El desglose de gastos POR CATEGORÍA y las banderas de deducibilidad viven en la pestaña Deducciones.',
    ],
  };
}

// -----------------------------------------------------------------------------
// get_ppd_cobranza — PPD invoices vs complementos, compact
// -----------------------------------------------------------------------------

async function getPpdCobranza(
  ctx: ToolContext,
  input: { year?: number; direction?: string }
) {
  const year = asYear(input.year);
  const direction = input.direction === 'received' ? 'received' : 'emitted';
  const isEmitted = direction === 'emitted';
  const doctorId = ctx.doctorId;

  const dateFrom = new Date(`${year}-01-01T00:00:00Z`);
  const dateTo = new Date(`${year + 1}-01-01T00:00:00Z`);

  // 1. Vigente type-I invoices of the year for this direction
  const invoices = await prisma.satCfdiMetadata.findMany({
    where: { doctorId, direction, efecto: 'I', satStatus: 'Vigente', issuedAt: { gte: dateFrom, lt: dateTo } },
    select: { uuid: true, monto: true, issuerRfc: true, issuerName: true, receiverRfc: true, receiverName: true, issuedAt: true },
  });
  const uuidsLower = invoices.map((i) => i.uuid.toLowerCase());

  // 2. Which are PPD (XML detail) + their pagos + complemento CFDI statuses.
  // `total` selected as fallback for NULL/0 metadata monto (parity: ppd/route.ts).
  const ppdDetails = uuidsLower.length > 0
    ? await prisma.satCfdiDetail.findMany({
        where: { doctorId, uuid: { in: uuidsLower }, metodoPago: 'PPD' },
        select: { uuid: true, folio: true, serie: true, total: true },
      })
    : [];
  const ppdSet = new Map(ppdDetails.map((d) => [d.uuid, d]));
  const ppdUuids = Array.from(ppdSet.keys());

  const pagos = ppdUuids.length > 0
    ? await prisma.satPago.findMany({
        where: { doctorId, facturaUuid: { in: ppdUuids }, unlinkedAt: null },
        select: { facturaUuid: true, pagoUuid: true, montoPagado: true, saldoInsoluto: true, numParcialidad: true },
      })
    : [];

  // Exclude pagos whose complemento CFDI (tipo P) was CANCELLED at the SAT —
  // same rule the tab applies via filterActiveByVigenteComplement.
  const pagoUuids = Array.from(new Set(pagos.map((p) => p.pagoUuid))).flatMap((u) => [u.toUpperCase(), u.toLowerCase()]);
  const cancelledComplements = pagoUuids.length > 0
    ? await prisma.satCfdiMetadata.findMany({
        where: { doctorId, uuid: { in: pagoUuids }, satStatus: 'Cancelado' },
        select: { uuid: true },
      })
    : [];
  const cancelledSet = new Set(cancelledComplements.map((c) => c.uuid.toLowerCase()));
  const activePagos = pagos.filter((p) => !cancelledSet.has(p.pagoUuid.toLowerCase()));

  const pagosByFactura = new Map<string, typeof activePagos>();
  for (const p of activePagos) {
    const k = p.facturaUuid.toLowerCase();
    const arr = pagosByFactura.get(k) ?? [];
    arr.push(p);
    pagosByFactura.set(k, arr);
  }

  // 3. Status per PPD invoice — REPLICA of computePpdStatus
  // (apps/api/src/lib/sat-ppd-reconcile.ts): the LAST parcialidad's
  // saldoInsoluto decides pagado/parcial (0 = pagado, even if the sums don't
  // add up — condonaciones reales); pendiente = ese saldo, no total-pagado.
  type PpdItem = {
    uuid: string; folio: string | null; contraparte: string; total: number;
    pagado: number; pendiente: number; estado: 'pagado' | 'parcial' | 'pendiente'; emitida: string;
  };
  const items: PpdItem[] = [];
  for (const inv of invoices) {
    const k = inv.uuid.toLowerCase();
    const det = ppdSet.get(k);
    if (!det) continue;
    const total = Number(inv.monto) || Number(det.total) || 0;
    const invPagos = (pagosByFactura.get(k) ?? [])
      .slice()
      .sort((a, b) => (a.numParcialidad ?? 0) - (b.numParcialidad ?? 0));
    const pagado = invPagos.reduce((s, p) => s + (p.montoPagado ? Number(p.montoPagado) : 0), 0);
    const lastPago = invPagos.length > 0 ? invPagos[invPagos.length - 1] : null;
    const saldoInsoluto = lastPago?.saldoInsoluto != null ? Number(lastPago.saldoInsoluto) : null;
    const estado: PpdItem['estado'] =
      saldoInsoluto === 0 ? 'pagado' : invPagos.length > 0 ? 'parcial' : 'pendiente';
    const pendiente = Math.max(0, round2(saldoInsoluto !== null ? saldoInsoluto : total - pagado));
    items.push({
      uuid: inv.uuid,
      folio: det.folio ?? null,
      contraparte: isEmitted
        ? `${inv.receiverName ?? '?'} (${inv.receiverRfc})`
        : `${inv.issuerName ?? '?'} (${inv.issuerRfc})`,
      total: round2(total),
      pagado: round2(pagado),
      pendiente,
      estado,
      emitida: mxDayOf(inv.issuedAt),
    });
  }

  const pendientes = items.filter((i) => i.estado !== 'pagado');
  pendientes.sort((a, b) => b.pendiente - a.pendiente);
  const totalPendiente = round2(pendientes.reduce((s, i) => s + i.pendiente, 0));

  // 4. Complementos (tipo P) of this direction not linked to any factura.
  // Linkage checked against satPago by pagoUuid across ALL facturas (parity:
  // ppd/route.ts:150-157) — NOT against this year's invoices only (a Jan
  // complemento paying a Dec factura would falsely count as "sin ligar").
  const complementos = await prisma.satCfdiMetadata.findMany({
    where: { doctorId, direction, efecto: 'P', satStatus: 'Vigente', issuedAt: { gte: new Date(`${year - 1}-01-01T00:00:00Z`), lt: dateTo } },
    select: { uuid: true },
  });
  const complementoUuidsLower = complementos.map((c) => c.uuid.toLowerCase());
  const linkedRows = complementoUuidsLower.length > 0
    ? await prisma.satPago.findMany({
        where: { doctorId, pagoUuid: { in: complementoUuidsLower }, unlinkedAt: null },
        select: { pagoUuid: true },
      })
    : [];
  const linkedPagoUuids = new Set(linkedRows.map((r) => r.pagoUuid.toLowerCase()));
  const complementosSinLigar = complementoUuidsLower.filter((u) => !linkedPagoUuids.has(u)).length;

  return {
    year,
    direccion: isEmitted
      ? 'emitidas — facturas PPD que TÚ emitiste (cobranza: te deben)'
      : 'recibidas — facturas PPD de proveedores (tú debes complemento/pago)',
    resumen: {
      facturasPpd: items.length,
      pagadas: items.filter((i) => i.estado === 'pagado').length,
      parciales: items.filter((i) => i.estado === 'parcial').length,
      pendientes: items.filter((i) => i.estado === 'pendiente').length,
      totalPendiente,
    },
    pendientesYParciales: pendientes.slice(0, PPD_LIST_CAP),
    ...(pendientes.length > PPD_LIST_CAP
      ? { nota: `Solo las ${PPD_LIST_CAP} con mayor saldo de ${pendientes.length} — la lista completa está en la pestaña PPD.` }
      : {}),
    complementosSinLigar,
    notas: [
      'Solo facturas con XML descargado y método PPD; los montos pagados vienen de complementos de pago (REP) vigentes.',
      'Ligar complementos sueltos a su factura (con sugerencias de matching) se hace en la pestaña PPD del dashboard SAT.',
    ],
  };
}

// -----------------------------------------------------------------------------
// Module
// -----------------------------------------------------------------------------

async function executeFiscalTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_resumen_fiscal':
      return getResumenFiscal(ctx, input as { year?: number });
    case 'get_ppd_cobranza':
      return getPpdCobranza(ctx, input as { year?: number; direction?: string });
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

const FISCAL_DOMAIN_MODEL = `## Cómo funcionan los números fiscales (invariantes)
- Todo sale de los XML descargados del SAT (**base de efectivo**): las facturas PUE cuentan en
  el mes en que se EMITIERON; las PPD cuentan en el mes en que se PAGARON (complemento REP),
  prorrateadas por lo efectivamente pagado. Una PPD sin complemento NO cuenta todavía.
- Ingresos = tus CFDIs emitidos (efecto I, menos notas de crédito E); deducciones/gastos = los
  CFDIs que te emitieron a ti. El IVA de tus gastos es ACREDITABLE contra el IVA que cobras.
- **Tú NUNCA calculas impuestos**: el ISR a pagar (tablas progresivas 612 / tasa RESICO) y la
  clasificación de deducibilidad por categoría los calcula el sistema en las pestañas
  Declaraciones y Deducciones — tú reportas los agregados y diriges ahí para la estimación.`;

const FISCAL_RULES = `## Números fiscales — reglas (SOLO CONSULTA)
- **Desempate con get_sat_cfdis** (miden cosas DISTINTAS): "¿cuánto FACTURÉ/emití?" =
  get_sat_cfdis (totales CON IVA por fecha de emisión, incluye PPD sin cobrar); "¿cuánto
  INGRESÉ?" / números para declarar = **get_resumen_fiscal** (subtotales en base de EFECTIVO —
  PPD cuenta al pagarse). Si la pregunta es ambigua y das cifras, di cuál de las dos es.
- Para deducciones/IVA/retenciones mensuales (lo FACTURADO, para declarar) usa
  **get_resumen_fiscal**; los gastos del día a día (todo el dinero que salió, con o sin
  factura) viven en el ledger (get_balance/get_movimientos — regla de desempate del módulo
  de flujo). Para cobranza de facturas PPD ("¿quién me debe?") usa **get_ppd_cobranza**.
- NUNCA estimes ISR a pagar ni digas si un gasto "es deducible" — reporta los números del
  sistema y señala la pestaña (Declaraciones / Deducciones) para la estimación o clasificación.
- No des consejo fiscal (régimen óptimo, estrategias de deducción) — eso es del contador; si te
  lo piden, dilo y ofrece los DATOS que sí tienes.
- Estos números dependen de la frescura del sync del SAT — si get_sat_cfdis reporta datos
  posiblemente desactualizados, adviértelo también aquí.`;

export const fiscalModule: AgentModule = {
  name: 'fiscal',
  readTools: FISCAL_TOOLS,
  proposalTools: [],
  executeRead: executeFiscalTool,
  executeProposal: async () => null,
  prompt: {
    domainModel: FISCAL_DOMAIN_MODEL,
    domainRules: FISCAL_RULES,
  },
};
