/**
 * FLUJO DE DINERO module — F1: READ-ONLY tools over the ledger
 * (/dashboard/practice/flujo-de-dinero + /dashboard/practice/conciliacion-bancaria).
 *
 * Design (blueprint GENERAL AGENTES §2 + flujo docs 00-modelo-consolidado):
 * - LedgerEntry is the single source of truth; everything else ATTACHES to it.
 *   Two evidence axes per entry: 🧾 fiscal (hasFactura/satCfdiUuid) and
 *   🏦 bank (bankMovement/settlementItem). Three gates (origin): operación
 *   (cita/venta/compra/webhook_pago/manual), factura SAT (sat_emitido/
 *   sat_recibido), banco (banco); comisión is internal.
 * - Regla 0: verdicts are REPLICAS of the real endpoints' logic (files cited
 *   per tool) — the model never re-derives "conciliado"/"completo" by
 *   counting fields. Divergence here would contradict the tabs.
 * - F1 = zero writes. Conciliar/vincular/merge/ignorar stay in the UI; the
 *   Motor-4 proposal design (flujo docs 06) is F2+ territory.
 * - Money rounds to cents; lists are capped (8KB tool-result budget).
 */

import { prisma, Prisma, tierAllows } from '@healthcare/database';
import type { AnthropicTool } from '../anthropic';
import type { ToolContext } from '../tools';
import type { AgentModule } from './types';

const MOVS_LIST_CAP = 12;
const UNMATCHED_LIST_CAP = 8;
const STATEMENTS_CAP = 12;

// -----------------------------------------------------------------------------
// Tool definitions
// -----------------------------------------------------------------------------

const FLUJO_TOOLS: AnthropicTool[] = [
  {
    name: 'get_flujo_status',
    description:
      'Diagnóstico COMPLETO del flujo de dinero (todo el historial, no filtra por fecha — igual que la pestaña): total de movimientos, evidencia (% con comprobante, % con factura, % categorizados), conciliación bancaria (conciliables vs conciliados; efectivo y pagos online quedan excluidos por diseño), matriz factura×banco de ingresos, movimientos auto-vinculados por revisar, desglose por origen y tipo, y ALERTAS. Úsala para "¿cómo voy con mi conciliación?", "¿qué me falta documentar?", "¿cuántos movimientos tengo sin factura?".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_movimientos',
    description:
      'Lista movimientos del ledger (Flujo de Dinero) con filtros: fechas, tipo, origen, con/sin factura o comprobante, estatus de pago, por revisar, por realizar, o búsqueda por concepto/ID interno. Devuelve totalEncontradas + sumas (realizado y por-realizar separados), y hasta 12 filas. Úsala para "muéstrame los gastos de junio", "¿qué movimientos no tienen factura?", "¿qué ingresos me deben?", "busca el movimiento de la renta".',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde, YYYY-MM-DD (opcional)' },
        endDate: { type: 'string', description: 'Hasta, YYYY-MM-DD (opcional)' },
        entryType: { type: 'string', enum: ['ingreso', 'egreso'], description: 'Tipo (opcional)' },
        origin: {
          type: 'string',
          enum: ['cita', 'venta', 'compra', 'manual', 'banco', 'sat_emitido', 'sat_recibido', 'webhook_pago', 'comision'],
          description: 'Origen del movimiento (opcional)',
        },
        hasFactura: { type: 'boolean', description: 'true = solo con factura; false = solo sin factura (opcional)' },
        hasComprobante: { type: 'boolean', description: 'true = solo con comprobante; false = solo sin comprobante (opcional)' },
        estatusPago: {
          type: 'string',
          enum: ['PENDING', 'PARTIAL', 'PAID', 'POR_COBRAR'],
          description: 'Estatus de pago; POR_COBRAR = ingresos REALIZADOS pendientes de cobro (PENDING+PARTIAL, el mismo conteo que la alerta de get_flujo_status) (opcional)',
        },
        needsReview: { type: 'boolean', description: 'true = solo auto-vinculados pendientes de revisar (opcional)' },
        porRealizar: { type: 'boolean', description: 'true = solo movimientos POR REALIZAR (proyectados, no dinero real todavía) (opcional)' },
        search: { type: 'string', description: 'Busca en concepto e ID interno (opcional)' },
      },
    },
  },
  {
    name: 'get_balance',
    description:
      'Balance del ledger: ingresos menos egresos REALIZADOS, los POR REALIZAR (proyectados) por separado y el balance proyectado. Rango de fechas opcional. Úsala para "¿cuánto tengo de balance?", "¿cuánto entró y salió en junio?".',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Desde, YYYY-MM-DD (opcional)' },
        endDate: { type: 'string', description: 'Hasta, YYYY-MM-DD (opcional)' },
      },
    },
  },
  {
    name: 'get_movimiento_detail',
    description:
      'Detalle COMPLETO de UN movimiento por su ID interno (p.ej. "ING-2026-123" o "EGR-2026-352"): datos base, de dónde nació (origen + cita/venta/compra/paciente ligados), evidencia fiscal (CFDI vinculado, PDFs/XMLs subidos, adjuntos), evidencia bancaria (movimiento bancario 1:1 o liquidación "Varios", con banco/cuenta/periodo del estado de cuenta), pago en línea que lo creó (webhook Stripe/MP), estatus de pago y metadata de auto-vinculación (confianza, por revisar). Úsala para "¿por qué este movimiento está incompleto?", "¿de dónde salió este ingreso?".',
    input_schema: {
      type: 'object',
      properties: {
        internalId: { type: 'string', description: 'ID interno del movimiento, p.ej. "EGR-2026-352"' },
      },
      required: ['internalId'],
    },
  },
  {
    name: 'get_conciliacion_bancaria',
    description:
      'Estado de la conciliación bancaria: estados de cuenta subidos (banco, cuenta, periodo, movimientos, cuántos conciliados) y los movimientos bancarios SIN conciliar (cuántos y los más grandes). Úsala para "¿qué estados de cuenta he subido?", "¿qué movimientos del banco siguen sin conciliar?". Los movimientos se concilian en la página Conciliación Bancaria — tú solo reportas el estado.',
    input_schema: { type: 'object', properties: {} },
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (v: Prisma.Decimal | number | null | undefined) => round2(Number(v ?? 0));

/** transactionDate is @db.Date (stored at noon) — the calendar day IS the value. */
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Model-supplied YYYY-MM-DD or undefined (format guard — same convention as
 * the ledger endpoint, which trusts the UI's date inputs). Also rejects
 * well-formed but impossible dates ('2026-13-01'), which would reach Prisma
 * as Invalid Date and burn the whole tool call (review finding). */
function asDay(v: unknown): string | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return Number.isNaN(new Date(v + 'T00:00:00Z').getTime()) ? undefined : v;
}

/** Date range filter — REPLICA of ledger/route.ts GET (start-of-day gte /
 * end-of-day lte). The endpoint parses without a TZ suffix, which resolves to
 * UTC on Railway; we pin Z explicitly so the tool matches the DEPLOYED
 * behavior even when run locally (evals/smoke run in TZ America/Mexico_City,
 * where the bare parse leaks the next day in — caught in the F1 smoke test). */
export function dateWhere(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return {};
  const transactionDate: { gte?: Date; lte?: Date } = {};
  if (startDate) transactionDate.gte = new Date(startDate + 'T00:00:00Z');
  if (endDate) transactionDate.lte = new Date(endDate + 'T23:59:59.999Z');
  return { transactionDate };
}

const trunc = (s: string | null | undefined, n: number) =>
  !s ? null : s.length <= n ? s : s.slice(0, n - 1) + '…';

/**
 * TIERS T3 — the flujo tools survive in CORE, but their payloads carry two
 * evidence axes that belong to OTHER features: 🧾 fiscal (`facturacion`) and
 * 🏦 bank (`conciliacion`), both CORE-excluded. Dropping only the
 * get_conciliacion_bancaria TOOL would still leave the same data reachable
 * field-by-field here (TIERS 01-DISENO §10 Q2).
 *
 * This omits FIELDS from the response — it never re-derives or recomputes a
 * verdict, so regla 0 is untouched: what remains is byte-for-byte what the
 * replica already produced. The QUERIES are left alone on purpose (a few extra
 * counts, no correctness risk) so the replica logic stays one code path that
 * matches the endpoint it mirrors.
 *
 * Input SCHEMAS never vary by tier either — a tool whose shape changed per
 * account would fork the tools-prefix cache for no benefit; a filter the
 * account can't act on simply returns rows without the hidden fields.
 */
function evidenceScope(ctx: ToolContext) {
  const banco = tierAllows(ctx.tier, 'conciliacion');
  const fiscal = tierAllows(ctx.tier, 'facturacion');
  // The auto-linker matches against bank movements AND SAT CFDIs, so its
  // review queue only means something when both axes are in the plan.
  return { banco, fiscal, autoLink: banco && fiscal };
}

/**
 * TIERS bitácora #28 — the `origin` column NAMES the SAT gate
 * (sat_emitido/sat_recibido) even on a plan without Facturación/Descarga SAT.
 * C4 trimmed the evidence FIELDS but left this one, and the live CORE test
 * (2026-07-27, `../../TIERS/01-DISENO-tecnico.md` §12.6) measured **4/4 runs**
 * where the model used those bucket names to narrate account history ("en algún
 * momento esta cuenta tuvo habilitada la emisión de CFDIs") or to fabricate a
 * reconciliation analysis out of them. The `partial` prose told it to report
 * them as movements and nothing more; it lost every run. A surviving field is an
 * invitation, and prose does not beat what the model can see.
 *
 * So the PAYLOAD gets trimmed, following C4's rule: relabel/omit, NEVER
 * recompute a verdict (regla 0 intact). Movements are never dropped — counts and
 * per-type totals stay exact, so the doctor's own totals still reconcile
 * ("downgrade = gating, nunca borrado", §9).
 */
const SAT_ORIGINS = ['sat_emitido', 'sat_recibido'] as const;
const HISTORIC_ORIGIN = 'historico';
const isSatOrigin = (o: string | null | undefined): boolean =>
  o != null && (SAT_ORIGINS as readonly string[]).includes(o);
/** Neutral label for a SAT-born movement when the plan lacks Facturación. */
const originLabel = (o: string | null | undefined, fiscal: boolean): string =>
  !fiscal && isSatOrigin(o) ? HISTORIC_ORIGIN : (o ?? 'manual');

interface OrigenBucket {
  origen: string;
  movimientos: number;
  total?: number;
}

/**
 * `porOrigen` for get_flujo_status. On a plan WITH Facturación it is the raw
 * groupBy, unchanged. Without it, the SAT buckets merge into one neutral
 * `historico` bucket.
 *
 * The merged bucket carries `movimientos` but **no `total`, on purpose**:
 * sat_emitido are ingresos and sat_recibido egresos, so a summed amount would be
 * a number that means nothing — inventing it is exactly the "recompute a
 * verdict" move C4 forbids, while omitting a field is the move it sanctions. The
 * per-type money lives in `porTipo`, which is untouched, so nothing the doctor
 * reads as a total changes.
 */
function porOrigenBlock(
  byOrigin: Array<{ origin: string | null; _count: { id: number }; _sum: { amount: Prisma.Decimal | null } }>,
  fiscal: boolean
): { porOrigen: OrigenBucket[]; porOrigenNota?: string } {
  const rows: OrigenBucket[] = byOrigin.map((g) => ({
    origen: g.origin || 'sin_origen',
    movimientos: g._count.id,
    total: money(g._sum.amount),
  }));
  if (fiscal) return { porOrigen: rows };

  const sat = rows.filter((r) => isSatOrigin(r.origen));
  if (sat.length === 0) return { porOrigen: rows };

  return {
    porOrigen: [
      ...rows.filter((r) => !isSatOrigin(r.origen)),
      { origen: HISTORIC_ORIGIN, movimientos: sat.reduce((n, r) => n + r.movimientos, 0) },
    ],
    porOrigenNota:
      'El bucket "historico" agrupa movimientos antiguos cuya puerta de entrada ya no es una función de esta cuenta. Son dinero real y cuentan en los totales, pero NO tienes su desglose por origen ni ninguna función asociada: repórtalos solo como movimientos del ledger y no deduzcas de ellos qué funciones tuvo o tiene la cuenta. ⚠️ "historico" NO trae "total" (agrupa ingresos y egresos, sumarlos daría un número sin sentido): **NUNCA sumes los "total" de porOrigen para dar un total** — quedaría cortísimo. Los totales de dinero salen de "porTipo" o de get_balance. Y si el doctor menciona que en su pantalla de Flujo de Dinero ve orígenes con más detalle, tiene razón: la página muestra el desglose completo; tú solo no lo tienes en esta cuenta.',
  };
}

// -----------------------------------------------------------------------------
// get_flujo_status — REPLICA of GET /practice-management/ledger/completeness
// (apps/api/.../ledger/completeness/route.ts). Divergence here would make the
// assistant contradict the Flujo de Dinero tab.
// -----------------------------------------------------------------------------

async function getFlujoStatus(ctx: ToolContext) {
  const doctorId = ctx.doctorId;

  const bankMatchedFilter = {
    bankMovement: { is: { matchStatus: { in: ['matched_auto', 'matched_confirmed'] } } },
  };
  const bankUnmatchedFilter = {
    OR: [
      { bankMovement: { is: null } },
      { bankMovement: { is: { matchStatus: { notIn: ['matched_auto', 'matched_confirmed'] } } } },
    ],
  };

  const [
    total,
    withComprobante,
    withFactura,
    withArea,
    byOrigin,
    byEntryType,
    unpaidIngresos,
    bankReconcilableCount,
    bankMatchedCount,
    cashCount,
    webhookCount,
    needsReviewCount,
    matrixFullyReconciled,
    matrixInvoicedUnmatched,
    matrixMatchedNoInvoice,
    matrixUndocumented,
  ] = await Promise.all([
    prisma.ledgerEntry.count({ where: { doctorId } }),
    prisma.ledgerEntry.count({ where: { doctorId, hasComprobante: true } }),
    prisma.ledgerEntry.count({ where: { doctorId, hasFactura: true } }),
    prisma.ledgerEntry.count({ where: { doctorId, area: { not: null } } }),
    prisma.ledgerEntry.groupBy({
      by: ['origin'],
      where: { doctorId },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.groupBy({
      by: ['entryType'],
      where: { doctorId },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.count({
      where: { doctorId, entryType: 'ingreso', porRealizar: false, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
    }),
    // Reconcilable = non-cash AND non-webhook (cash leaves no bank trace;
    // webhook_pago is self-proven — same exclusions as the tab).
    prisma.ledgerEntry.count({
      where: { doctorId, formaDePago: { not: 'efectivo' }, origin: { not: 'webhook_pago' } },
    }),
    prisma.bankMovement.count({
      where: { ledgerEntry: { is: { doctorId } }, matchStatus: { in: ['matched_auto', 'matched_confirmed'] } },
    }),
    prisma.ledgerEntry.count({
      where: { doctorId, formaDePago: 'efectivo', origin: { not: 'webhook_pago' } },
    }),
    prisma.ledgerEntry.count({ where: { doctorId, origin: 'webhook_pago' } }),
    prisma.ledgerEntry.count({ where: { doctorId, needsReview: true } }),
    prisma.ledgerEntry.count({
      where: { doctorId, entryType: 'ingreso', hasFactura: true, ...bankMatchedFilter },
    }),
    prisma.ledgerEntry.count({
      where: { doctorId, entryType: 'ingreso', hasFactura: true, ...bankUnmatchedFilter },
    }),
    prisma.ledgerEntry.count({
      where: { doctorId, entryType: 'ingreso', hasFactura: false, ...bankMatchedFilter },
    }),
    prisma.ledgerEntry.count({
      where: { doctorId, entryType: 'ingreso', hasFactura: false, ...bankUnmatchedFilter },
    }),
  ]);

  const pct = (part: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
  const bankUnmatched = bankReconcilableCount - bankMatchedCount;
  const pctBankReconciled =
    bankReconcilableCount > 0 ? Math.round((bankMatchedCount / bankReconcilableCount) * 100) : 100;

  const scope = evidenceScope(ctx);

  return {
    alcance: 'TODO el historial del ledger (la pestaña no filtra por fecha aquí; para un período usa get_movimientos/get_balance).',
    totalMovimientos: total,
    evidencia: {
      conComprobante: withComprobante,
      ...(scope.fiscal ? { conFactura: withFactura } : {}),
      categorizados: withArea,
      pctComprobante: pct(withComprobante),
      ...(scope.fiscal ? { pctFactura: pct(withFactura) } : {}),
      pctCategorizados: pct(withArea),
    },
    ...(scope.banco
      ? {
          conciliacionBancaria: {
            conciliables: bankReconcilableCount,
            conciliados: bankMatchedCount,
            sinConciliar: bankUnmatched,
            pctConciliado: pctBankReconciled,
            excluidosEfectivo: cashCount,
            excluidosPagoOnline: webhookCount,
            nota:
              'Efectivo no deja huella bancaria y los pagos online (webhook) ya están auto-probados — por eso se excluyen. OJO: estos agregados (réplica de la pestaña) solo cuentan la conciliación 1:1 — los movimientos pagados vía liquidación "Varios" NO suman aquí aunque SÍ están conciliados; su estado real lo dan get_movimientos/get_movimiento_detail (bancoConciliado).',
          },
        }
      : {}),
    // The matrix crosses BOTH axes — it needs both features in the plan.
    ...(scope.fiscal && scope.banco
      ? {
          matrizIngresos: {
            facturadoYConciliado: matrixFullyReconciled,
            facturadoSinBanco: matrixInvoicedUnmatched,
            conciliadoSinFactura: matrixMatchedNoInvoice,
            sinDocumentar: matrixUndocumented,
          },
        }
      : {}),
    ...(scope.autoLink ? { porRevisar: needsReviewCount } : {}),
    ...porOrigenBlock(byOrigin, scope.fiscal),
    porTipo: byEntryType.map((g) => ({
      tipo: g.entryType,
      movimientos: g._count.id,
      total: money(g._sum.amount),
    })),
    alertas: [
      ...(total - withArea > 0 ? [`${total - withArea} movimiento(s) sin área asignada`] : []),
      ...(unpaidIngresos > 0 ? [`${unpaidIngresos} ingreso(s) pendiente(s) de cobro`] : []),
      ...(scope.banco && bankUnmatched > 0
        ? [`${bankUnmatched} movimiento(s) sin conciliar con banco (excluye efectivo y pagos online)`]
        : []),
      ...(scope.autoLink && needsReviewCount > 0
        ? [`${needsReviewCount} movimiento(s) vinculado(s) automáticamente por revisar`]
        : []),
    ],
  };
}

// -----------------------------------------------------------------------------
// get_movimientos — filter semantics REPLICA of GET /practice-management/ledger
// (apps/api/.../ledger/route.ts), compact rows + real counts.
// -----------------------------------------------------------------------------

interface MovimientosInput {
  startDate?: string;
  endDate?: string;
  entryType?: string;
  origin?: string;
  hasFactura?: boolean;
  hasComprobante?: boolean;
  estatusPago?: string;
  needsReview?: boolean;
  porRealizar?: boolean;
  search?: string;
}

async function getMovimientos(ctx: ToolContext, input: MovimientosInput) {
  const doctorId = ctx.doctorId;
  const where: Record<string, unknown> = { doctorId };

  if (input.entryType && ['ingreso', 'egreso'].includes(input.entryType)) {
    where.entryType = input.entryType;
  }
  const start = asDay(input.startDate);
  const end = asDay(input.endDate);
  Object.assign(where, dateWhere(start, end));
  const scope = evidenceScope(ctx);
  // TIERS T3: hiding a FIELD is pointless if the matching FILTER still works —
  // "movimientos sin factura" would hand back the exact evidence signal that
  // was stripped from the rows, via totalEncontradas. So an excluded filter is
  // DROPPED and echoed back (same contract as a malformed date below), never
  // applied silently: a silently-ignored filter makes the model report
  // whole-history sums as if they were the filtered subset.
  const filtrosNoDisponibles: string[] = [];
  if (typeof input.hasFactura === 'boolean') {
    if (scope.fiscal) where.hasFactura = input.hasFactura;
    else filtrosNoDisponibles.push('hasFactura');
  }
  if (typeof input.hasComprobante === 'boolean') where.hasComprobante = input.hasComprobante;
  // Same rule as hasFactura, on the `origin` axis (bitácora #28): hiding the SAT
  // buckets from porOrigen/rows is pointless if `origin: 'sat_emitido'` still
  // filters — that hands back the exact subset, with real counts and sums, that
  // the relabel just removed. The synthetic `historico` label IS filterable, so
  // the model can act on what it read instead of getting a silent zero.
  if (typeof input.origin === 'string' && input.origin) {
    if (input.origin === HISTORIC_ORIGIN) {
      where.origin = { in: [...SAT_ORIGINS] };
    } else if (!scope.fiscal && isSatOrigin(input.origin)) {
      filtrosNoDisponibles.push('origin');
    } else {
      where.origin = input.origin;
    }
  }
  // Additive filter beyond the ledger endpoint (read-only, same column the
  // completeness alert counts): POR_COBRAR = the alert's EXACT set (see the
  // unpaidIngresos count above): realized INGRESOS awaiting payment. Without
  // the entryType/porRealizar constraints it also matched pending EGRESOS
  // ("por pagar") — 331 rows vs the alert's 16 (A3 consistency audit,
  // 2026-07-14). entryType is forced: POR_COBRAR is ingreso by definition.
  if (input.estatusPago === 'POR_COBRAR') {
    where.paymentStatus = { in: ['PENDING', 'PARTIAL'] };
    where.entryType = 'ingreso';
    where.porRealizar = false;
  } else if (typeof input.estatusPago === 'string' && ['PENDING', 'PARTIAL', 'PAID'].includes(input.estatusPago)) {
    where.paymentStatus = input.estatusPago;
  }
  if (typeof input.needsReview === 'boolean') {
    if (scope.autoLink) where.needsReview = input.needsReview;
    else filtrosNoDisponibles.push('needsReview');
  }
  if (typeof input.porRealizar === 'boolean') where.porRealizar = input.porRealizar;
  if (typeof input.search === 'string' && input.search.trim()) {
    where.OR = [
      { concept: { contains: input.search.trim(), mode: 'insensitive' } },
      { internalId: { contains: input.search.trim(), mode: 'insensitive' } },
    ];
  }

  const [total, sums, entries] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    // porRealizar in the groupBy: projected money must never blend into the
    // headline sums (review finding — get_balance separates them; so do we).
    prisma.ledgerEntry.groupBy({
      by: ['entryType', 'porRealizar'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.ledgerEntry.findMany({
      where,
      select: {
        internalId: true,
        transactionDate: true,
        entryType: true,
        amount: true,
        concept: true,
        origin: true,
        hasFactura: true,
        hasComprobante: true,
        porRealizar: true,
        needsReview: true,
        paymentStatus: true,
        counterpartyName: true,
        // Bank-reconciled verdict per ENTRY (direct 1:1 match OR settlement) —
        // this is the evidence icons' definition, WIDER than the completeness
        // tab's aggregates, which only count direct links (get_flujo_status's
        // nota explains the gap so the model doesn't contradict itself).
        bankMovement: { select: { matchStatus: true } },
        settlementItem: { select: { id: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: MOVS_LIST_CAP,
    }),
  ]);

  const sumOf = (t: string, proj: boolean) =>
    money(sums.find((s) => s.entryType === t && s.porRealizar === proj)?._sum.amount);
  const porRealizarSums = {
    ingresos: sumOf('ingreso', true),
    egresos: sumOf('egreso', true),
  };

  return {
    // Echo the APPLIED filters — if a malformed date was dropped, the model
    // sees "todo el historial" instead of misreporting whole-history sums as
    // the requested month's (review finding).
    periodo: start || end ? `${start ?? 'inicio'} a ${end ?? 'hoy'}` : 'todo el historial (sin filtro de fechas)',
    ...(filtrosNoDisponibles.length
      ? {
          filtrosNoDisponibles: {
            filtros: filtrosNoDisponibles,
            nota: 'Ese filtro corresponde a una función que el plan de esta cuenta no incluye, así que NO se aplicó: los resultados de abajo NO están filtrados por él. Dilo así al doctor; no presentes estos totales como si lo estuvieran.',
          },
        }
      : {}),
    totalEncontradas: total,
    mostradas: Math.min(total, MOVS_LIST_CAP),
    sumas: { ingresos: sumOf('ingreso', false), egresos: sumOf('egreso', false) },
    ...(porRealizarSums.ingresos !== 0 || porRealizarSums.egresos !== 0
      ? {
          sumasPorRealizar: {
            ...porRealizarSums,
            nota: 'Proyectados (por realizar) — NO son dinero real todavía; no van en "sumas".',
          },
        }
      : {}),
    movimientos: entries.map((e) => ({
      id: e.internalId,
      fecha: dayOf(e.transactionDate),
      tipo: e.entryType,
      monto: money(e.amount),
      concepto: trunc(e.concept, 60),
      origen: originLabel(e.origin, scope.fiscal),
      ...(scope.fiscal ? { evidenciaFiscal: e.hasFactura } : {}),
      ...(scope.banco
        ? {
            bancoConciliado:
              (e.bankMovement != null &&
                ['matched_auto', 'matched_confirmed'].includes(e.bankMovement.matchStatus)) ||
              e.settlementItem != null,
          }
        : {}),
      ...(e.hasComprobante ? { comprobante: true } : {}),
      ...(e.porRealizar ? { porRealizar: true } : {}),
      ...(scope.autoLink && e.needsReview ? { porRevisar: true } : {}),
      ...(e.paymentStatus && e.paymentStatus !== 'PAID' ? { estatusPago: e.paymentStatus } : {}),
      ...(e.counterpartyName ? { contraparte: trunc(e.counterpartyName, 40) } : {}),
    })),
    ...(total > MOVS_LIST_CAP
      ? { nota: `Solo ${MOVS_LIST_CAP} de ${total} (las más recientes) — usa "totalEncontradas" para contar; afina filtros para ver otras.` }
      : {}),
  };
}

// -----------------------------------------------------------------------------
// get_balance — REPLICA of GET /practice-management/ledger/balance
// (realized vs porRealizar, projected).
// -----------------------------------------------------------------------------

async function getBalance(ctx: ToolContext, input: { startDate?: string; endDate?: string }) {
  const doctorId = ctx.doctorId;
  const range = dateWhere(asDay(input.startDate), asDay(input.endDate));

  const agg = (entryType: string, porRealizar: boolean) =>
    prisma.ledgerEntry.aggregate({
      where: { doctorId, entryType, porRealizar, ...range },
      _sum: { amount: true },
    });

  const [ing, egr, pIng, pEgr] = await Promise.all([
    agg('ingreso', false),
    agg('egreso', false),
    agg('ingreso', true),
    agg('egreso', true),
  ]);

  const totalIngresos = money(ing._sum.amount);
  const totalEgresos = money(egr._sum.amount);
  const pendIngresos = money(pIng._sum.amount);
  const pendEgresos = money(pEgr._sum.amount);

  return {
    ...(asDay(input.startDate) || asDay(input.endDate)
      ? { periodo: `${asDay(input.startDate) ?? 'inicio'} a ${asDay(input.endDate) ?? 'hoy'}` }
      : { periodo: 'todo el historial' }),
    realizados: { ingresos: totalIngresos, egresos: totalEgresos, balance: round2(totalIngresos - totalEgresos) },
    porRealizar: { ingresos: pendIngresos, egresos: pendEgresos },
    balanceProyectado: round2(totalIngresos + pendIngresos - totalEgresos - pendEgresos),
    fuente:
      'Ledger (Flujo de Dinero): TODO el dinero registrado, con o sin factura. Para números de declaración (base de efectivo del SAT) usa get_resumen_fiscal — miden cosas distintas.',
  };
}

// -----------------------------------------------------------------------------
// get_movimiento_detail — entry + both evidence axes. Bank/online-payment
// resolution is a REPLICA of GET /ledger/[id]/evidence
// (apps/api/.../ledger/[id]/evidence/route.ts), incl. the orphan heuristic.
// -----------------------------------------------------------------------------

/** paidAt↔createdAt proximity for the orphan webhook-payment heuristic —
 * same window as the evidence endpoint. */
const ORPHAN_MATCH_WINDOW_MS = 15 * 60 * 1000;

const PAYMENT_SELECT = {
  description: true, amount: true, currency: true, status: true, paidAt: true,
} as const;
const MP_PAYMENT_SELECT = { ...PAYMENT_SELECT, paymentMethod: true } as const;

type PaymentRow = {
  description: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  paidAt: Date | null;
  paymentMethod?: string | null;
};

async function resolveOnlinePayment(
  doctorId: string,
  entry: { origin: string | null; bookingId: string | null; amount: Prisma.Decimal; createdAt: Date },
) {
  if (entry.origin !== 'webhook_pago') return null;

  const toPayment = (
    row: PaymentRow,
    proveedor: 'Stripe' | 'Mercado Pago',
    matchHeuristico: boolean,
  ) => ({
    proveedor,
    monto: money(row.amount),
    ...(row.currency && row.currency.toUpperCase() !== 'MXN' ? { moneda: row.currency } : {}),
    estado: row.status,
    ...(row.paymentMethod ? { metodo: row.paymentMethod } : {}),
    pagadoEl: row.paidAt ? row.paidAt.toISOString() : null,
    descripcion: trunc(row.description, 60),
    ...(matchHeuristico ? { matchHeuristico: true } : {}),
  });

  if (entry.bookingId) {
    // doctorId in the where = defense-in-depth (the ledger POST accepts a
    // caller-supplied bookingId — never resolve another tenant's link data).
    const [stripe, mp] = await Promise.all([
      prisma.paymentLink.findFirst({
        where: { bookingId: entry.bookingId, doctorId },
        select: PAYMENT_SELECT,
      }),
      prisma.mpPaymentPreference.findFirst({
        where: { bookingId: entry.bookingId, doctorId },
        select: MP_PAYMENT_SELECT,
      }),
    ]);
    const stripePayment = stripe ? toPayment(stripe, 'Stripe', false) : null;
    const mpPayment = mp ? toPayment(mp, 'Mercado Pago', false) : null;
    if (stripePayment?.estado === 'PAID') return stripePayment;
    if (mpPayment?.estado === 'PAID') return mpPayment;
    return stripePayment ?? mpPayment;
  }

  // Orphan entry: match by amount + paidAt≈createdAt among orphan PAID links,
  // only when exactly ONE candidate matches (better silent than wrong).
  const from = new Date(entry.createdAt.getTime() - ORPHAN_MATCH_WINDOW_MS);
  const to = new Date(entry.createdAt.getTime() + ORPHAN_MATCH_WINDOW_MS);
  const orphanWhere = {
    doctorId,
    bookingId: null,
    status: 'PAID' as const,
    amount: entry.amount,
    paidAt: { gte: from, lte: to },
  };
  const [stripeMatches, mpMatches] = await Promise.all([
    prisma.paymentLink.findMany({ where: orphanWhere, select: PAYMENT_SELECT, take: 2 }),
    prisma.mpPaymentPreference.findMany({ where: orphanWhere, select: MP_PAYMENT_SELECT, take: 2 }),
  ]);
  if (stripeMatches.length + mpMatches.length !== 1) return null;
  if (stripeMatches.length === 1) return toPayment(stripeMatches[0], 'Stripe', true);
  return toPayment(mpMatches[0], 'Mercado Pago', true);
}

async function getMovimientoDetail(ctx: ToolContext, input: { internalId?: string }) {
  const doctorId = ctx.doctorId;
  const internalId = typeof input.internalId === 'string' ? input.internalId.trim() : '';
  if (!internalId) return { error: 'Falta internalId (p.ej. "EGR-2026-352").' };

  const movementSelect = {
    transactionDate: true,
    description: true,
    amount: true,
    movementType: true,
    matchStatus: true,
    bankStatement: {
      select: { bankName: true, accountNumber: true, periodMonth: true, periodYear: true },
    },
  } as const;

  const entry = await prisma.ledgerEntry.findFirst({
    // internalId is unique per doctor; insensitive so "egr-2026-352" also hits.
    where: { doctorId, internalId: { equals: internalId, mode: 'insensitive' } },
    include: {
      attachments: { select: { fileName: true } },
      facturas: { select: { fileName: true } },
      facturasXml: { select: { fileName: true } },
      booking: { select: { patientName: true, date: true, status: true } },
      sale: { select: { saleNumber: true, total: true } },
      purchase: { select: { purchaseNumber: true, total: true } },
      client: { select: { businessName: true, contactName: true } },
      supplier: { select: { businessName: true, contactName: true } },
      bankMovement: { select: movementSelect },
      settlementItem: { select: { bankMovement: { select: movementSelect } } },
    },
  });

  if (!entry) {
    return { error: `No existe un movimiento con ID "${internalId}" en tu ledger.` };
  }

  const onlinePayment = await resolveOnlinePayment(doctorId, entry);
  const scope = evidenceScope(ctx);

  const bankMov = entry.bankMovement ?? entry.settlementItem?.bankMovement ?? null;
  const viaSettlement = entry.bankMovement == null && entry.settlementItem != null;
  const bancoConciliado =
    (entry.bankMovement != null &&
      ['matched_auto', 'matched_confirmed'].includes(entry.bankMovement.matchStatus)) ||
    entry.settlementItem != null;

  return {
    id: entry.internalId,
    tipo: entry.entryType,
    monto: money(entry.amount),
    fecha: dayOf(entry.transactionDate),
    concepto: entry.concept,
    origen: originLabel(entry.origin, scope.fiscal),
    porRealizar: entry.porRealizar,
    area: entry.area ?? null,
    subarea: entry.subarea ?? null,
    formaDePago: entry.formaDePago ?? null,
    estatusPago: entry.paymentStatus ?? null,
    montoPagado: entry.amountPaid != null ? money(entry.amountPaid) : null,
    contraparte: entry.counterpartyName
      ? `${entry.counterpartyName}${entry.counterpartyRfc ? ` (${entry.counterpartyRfc})` : ''}`
      : null,
    nacioDe: {
      ...(entry.booking
        ? { cita: { paciente: entry.booking.patientName, fecha: entry.booking.date ? dayOf(entry.booking.date) : null, estado: entry.booking.status } }
        : {}),
      ...(entry.sale ? { venta: `${entry.sale.saleNumber} ($${money(entry.sale.total)})` } : {}),
      ...(entry.purchase ? { compra: `${entry.purchase.purchaseNumber} ($${money(entry.purchase.total)})` } : {}),
      ...(entry.client ? { cliente: entry.client.businessName || entry.client.contactName } : {}),
      ...(entry.supplier ? { proveedor: entry.supplier.businessName || entry.supplier.contactName } : {}),
      ...(entry.patientId ? { expedienteVinculado: true } : {}),
    },
    ...(scope.fiscal
      ? {
          evidenciaFiscal: {
            tieneFactura: entry.hasFactura,
            cfdiVinculado: entry.satCfdiUuid ?? null,
            pdfsSubidos: entry.facturas.map((f) => f.fileName),
            xmlsSubidos: entry.facturasXml.map((f) => f.fileName),
            ...(entry.satCfdiUuid
              ? { nota: 'Para el detalle/vigencia del CFDI usa get_sat_cfdis o get_cfdis.' }
              : {}),
          },
        }
      : {}),
    evidenciaBancaria: {
      // `conciliado` and the statement detail are conciliación data; the
      // receipt/attachments and the online payment (pagos — CORE keeps it)
      // are not, so the block itself survives.
      ...(scope.banco ? { conciliado: bancoConciliado } : {}),
      tieneComprobante: entry.hasComprobante,
      adjuntos: entry.attachments.map((a) => a.fileName),
      ...(scope.banco && bankMov
        ? {
            movimientoBancario: {
              ...(viaSettlement ? { viaLiquidacion: 'este movimiento se pagó junto con otros ("Varios")' } : {}),
              fecha: dayOf(bankMov.transactionDate),
              descripcion: trunc(bankMov.description, 60),
              monto: money(bankMov.amount),
              estadoDeCuenta: `${bankMov.bankStatement.bankName} ${bankMov.bankStatement.accountNumber} · ${bankMov.bankStatement.periodMonth}/${bankMov.bankStatement.periodYear}`,
            },
          }
        : {}),
      ...(onlinePayment ? { pagoEnLinea: onlinePayment } : {}),
    },
    ...(scope.autoLink
      ? {
          autoVinculacion: {
            porRevisar: entry.needsReview,
            ...(entry.autoLinkedConfidence != null
              ? { confianza: Number(entry.autoLinkedConfidence) }
              : {}),
            ...(entry.mergedFromId != null ? { fusionadoDeOtroMovimiento: true } : {}),
          },
        }
      : {}),
  };
}

// -----------------------------------------------------------------------------
// get_conciliacion_bancaria — statements list (REPLICA of GET
// /practice-management/conciliacion-bancaria) + unmatched movement summary.
// -----------------------------------------------------------------------------

async function getConciliacionBancaria(ctx: ToolContext) {
  const doctorId = ctx.doctorId;

  const [statementsTotal, statements, unmatchedTotal, unmatchedTop] = await Promise.all([
    prisma.bankStatement.count({ where: { doctorId } }),
    prisma.bankStatement.findMany({
      where: { doctorId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      select: {
        bankName: true,
        accountNumber: true,
        periodMonth: true,
        periodYear: true,
        movementCount: true,
        matchedCount: true,
        totalDeposits: true,
        totalWithdrawals: true,
      },
      take: STATEMENTS_CAP,
    }),
    prisma.bankMovement.count({
      where: { bankStatement: { doctorId }, matchStatus: 'unmatched' },
    }),
    prisma.bankMovement.findMany({
      where: { bankStatement: { doctorId }, matchStatus: 'unmatched' },
      select: {
        transactionDate: true,
        description: true,
        amount: true,
        movementType: true,
        bankStatement: { select: { bankName: true, periodMonth: true, periodYear: true } },
      },
      orderBy: { amount: 'desc' },
      take: UNMATCHED_LIST_CAP,
    }),
  ]);

  return {
    estadosDeCuenta: statements.map((s) => ({
      banco: s.bankName,
      cuenta: s.accountNumber,
      periodo: `${s.periodMonth}/${s.periodYear}`,
      movimientos: s.movementCount,
      conciliados: s.matchedCount,
      depositos: s.totalDeposits != null ? money(s.totalDeposits) : null,
      retiros: s.totalWithdrawals != null ? money(s.totalWithdrawals) : null,
    })),
    totalEstadosDeCuenta: statementsTotal,
    ...(statementsTotal > STATEMENTS_CAP
      ? { notaEstados: `Solo los ${STATEMENTS_CAP} más recientes de ${statementsTotal}.` }
      : {}),
    movimientosSinConciliar: {
      total: unmatchedTotal,
      masGrandes: unmatchedTop.map((m) => ({
        fecha: dayOf(m.transactionDate),
        descripcion: trunc(m.description, 50),
        monto: money(m.amount),
        tipo: m.movementType,
        estadoDeCuenta: `${m.bankStatement.bankName} ${m.bankStatement.periodMonth}/${m.bankStatement.periodYear}`,
      })),
      ...(unmatchedTotal > UNMATCHED_LIST_CAP
        ? { nota: `Solo los ${UNMATCHED_LIST_CAP} de mayor monto de ${unmatchedTotal}.` }
        : {}),
    },
    notas: [
      'Conciliar/vincular movimientos se hace en la página Conciliación Bancaria — aquí solo se consulta.',
      'El matcher automático compara monto, fecha (hasta ±7 días si el concepto se parece), referencia bancaria y similitud de concepto; NO usa el nombre/RFC de la contraparte — un "sin conciliar" con fecha lejana y concepto distinto es normal y se vincula a mano.',
    ],
  };
}

// -----------------------------------------------------------------------------
// Module
// -----------------------------------------------------------------------------

async function executeFlujoTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_flujo_status':
      return getFlujoStatus(ctx);
    case 'get_movimientos':
      return getMovimientos(ctx, input as MovimientosInput);
    case 'get_balance':
      return getBalance(ctx, input as { startDate?: string; endDate?: string });
    case 'get_movimiento_detail':
      return getMovimientoDetail(ctx, input as { internalId?: string });
    case 'get_conciliacion_bancaria':
      return getConciliacionBancaria(ctx);
    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

const FLUJO_DOMAIN_MODEL = `## Cómo funciona el Flujo de Dinero (invariantes)
- **Una tabla es la verdad**: cada ingreso/egreso real del doctor es UN movimiento del ledger;
  todo lo demás (facturas, banco, citas) se ADJUNTA a él. El mismo hecho económico nunca debe
  existir dos veces — el sistema deduplica al registrar (match-before-create).
- Cada movimiento tiene **dos evidencias independientes**: 🧾 fiscal (CFDI vinculado o factura
  subida) y 🏦 bancaria (conciliado con un movimiento del estado de cuenta, directo o vía
  liquidación "Varios"). La meta es ambas; "completo" lo decide el sistema, no tú.
- El **origen** dice por cuál puerta nació: operación (cita/venta/compra/webhook_pago/manual),
  factura del SAT (sat_emitido/sat_recibido) o banco (banco); comision es interno.
- **Efectivo y pagos online NO se concilian con banco** (el efectivo no deja huella; el pago
  online ya está probado por el webhook) — el sistema los excluye del pendiente bancario.
- Movimientos **por realizar** son proyecciones, no dinero real: los balances los separan.
- La conciliación automática puede dejar vínculos **por revisar** (confianza media): existen
  como pendiente explícito del doctor, no son errores.`;

const FLUJO_RULES = `## Flujo de dinero — reglas (SOLO CONSULTA)
- **Desempate con los números fiscales** (miden cosas DISTINTAS): dinero del día a día
  ("¿cuánto tengo/gané/gasté?", "¿cuánto entró y salió?") = **get_balance/get_movimientos**
  (ledger: todo el dinero, con o sin factura); números para DECLARAR ("¿cuánto ingresé/
  deduzco?", IVA/retenciones) = get_resumen_fiscal (base de efectivo del SAT). "¿Cuánto
  gasté?" a secas es ambiguo entre egresos del ledger y deducciones fiscales: da UNA cifra
  nombrando su fuente y menciona que existe la otra lectura.
- **"¿Quién me debe?" tiene dos lecturas**: facturas PPD sin pagar = get_ppd_cobranza;
  ingresos del ledger pendientes de cobro = get_movimientos con estatusPago "POR_COBRAR".
  Si no es obvio cuál quiere el doctor, da la que aplique y nombra la otra.
- Para contar usa SIEMPRE "totalEncontradas" (las listas vienen capadas) — nunca cuentes los
  elementos mostrados.
- Un movimiento "sin conciliar" NO es un error: lo que no alcanza confianza en el matcher
  queda para vincular a mano. Explica el estado con los datos del tool y dirige a la página
  correspondiente (Flujo de Dinero / Conciliación Bancaria) para actuar.
- NO puedes crear, editar, conciliar, vincular, fusionar ni ignorar movimientos, ni subir
  estados de cuenta — eso se hace en la UI (y las acciones asistidas llegarán después). Consultar
  y diagnosticar SÍ es tu trabajo.`;

/**
 * TIERS T3 — the variant used when the account's plan keeps Flujo de Dinero but
 * NOT Facturación/Descarga SAT/Conciliación Bancaria (CORE). The full text
 * above is written as fact: two evidence axes, bank reconciliation, and
 * tie-breaks against get_resumen_fiscal/get_ppd_cobranza — none of which this
 * account has tools for. Left in place, the model would confidently offer
 * reconciliation reads it cannot perform.
 */
const FLUJO_DOMAIN_MODEL_PARTIAL = `## Cómo funciona el Flujo de Dinero (invariantes)
- **Una tabla es la verdad**: cada ingreso/egreso real del doctor es UN movimiento del ledger;
  todo lo demás (citas, ventas, compras) se ADJUNTA a él. El mismo hecho económico nunca debe
  existir dos veces — el sistema deduplica al registrar (match-before-create).
- Cada movimiento puede tener **comprobante** adjunto (el recibo o archivo que lo respalda).
- El **origen** dice por cuál puerta nació: cita, venta, compra, pago en línea (webhook_pago) o
  manual; comision es interno. Los movimientos antiguos cuya puerta ya no es una función de esta
  cuenta aparecen agrupados como **historico** — ese es TODO el detalle disponible.
- Movimientos **por realizar** son proyecciones, no dinero real: los balances los separan.
- **Esta cuenta no tiene todas las funciones de dinero.** Los ejes de evidencia que no estén
  disponibles (🧾 factura, 🏦 banco) **simplemente NO vienen en el resultado del tool**: si un campo
  no está, no lo menciones, no lo supongas y NUNCA lo deduzcas de otros (categorizados,
  comprobante, origen, alertas — ninguno dice si algo está conciliado o facturado). Si te
  preguntan por conciliación bancaria o por facturas y no tienes esa tool, **dilo en la PRIMERA
  línea, antes de cualquier otro dato**: no encabeces la respuesta con otro diagnóstico ni pongas
  cifras de otra cosa bajo un título de "conciliación". Ofrecer después lo que SÍ tienes está bien;
  presentarlo como si contestara lo que te preguntaron, no.
- El bucket **historico** son movimientos reales del doctor y cuentan en los totales, pero no
  tienes su desglose ni función asociada. **No deduzcas de él qué funciones tuvo o tiene la
  cuenta**, no narres su historia y no lo uses para armar un diagnóstico (de conciliación o de
  cualquier otra función que no esté en tu lista de tools): repórtalo como movimientos y nada más.`;

const FLUJO_RULES_PARTIAL = `## Flujo de dinero — reglas (SOLO CONSULTA)
- "¿Cuánto tengo/gané/gasté?", "¿cuánto entró y salió?" = **get_balance/get_movimientos** (el
  ledger: TODO el dinero registrado, con o sin factura).
- **Los números para DECLARAR son OTRA COSA** (base de efectivo del SAT: IVA, retenciones,
  deducciones). Si no tienes la tool que los da, **dilo y NO los estimes desde el ledger** — dar
  cifras del ledger como si fueran fiscales es un error grave, aunque se parezcan.
- **"¿Quién me debe?"**: ingresos del ledger pendientes de cobro = get_movimientos con
  estatusPago "POR_COBRAR". (La otra lectura —facturas PPD sin complemento— requiere una tool
  fiscal que esta cuenta puede no tener; si no la tienes, no la ofrezcas.)
- Para contar usa SIEMPRE "totalEncontradas" (las listas vienen capadas) — nunca cuentes los
  elementos mostrados.
- NO puedes crear, editar, fusionar ni ignorar movimientos — eso se hace en la UI. Consultar y
  diagnosticar SÍ es tu trabajo.`;

export const flujoModule: AgentModule = {
  name: 'flujo',
  readTools: FLUJO_TOOLS,
  proposalTools: [],
  executeRead: executeFlujoTool,
  executeProposal: async () => null,
  prompt: {
    domainModel: FLUJO_DOMAIN_MODEL,
    domainRules: FLUJO_RULES,
    // El desempate de FLUJO_RULES manda los números de DECLARAR a las tools
    // fiscales. Sin ellas, el modelo puede presentar cifras del ledger como
    // fiscales — el caso ESPEJO de §11.5.1. La variante es neutral a propósito:
    // sirve tanto a CORE (sin conciliación) como a un member sin facturación.
    prosaDependsOn: ['facturacion'],
    partial: {
      domainModel: FLUJO_DOMAIN_MODEL_PARTIAL,
      domainRules: FLUJO_RULES_PARTIAL,
    },
  },
};
