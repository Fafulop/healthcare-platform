/**
 * PPD reconciliation — Part B of the PUE/PPD gap (gap #1).
 *
 * A PPD (Pago en Parcialidades o Diferido) invoice is paid later via payment complements (CFDI
 * tipo P), which the SAT sync parses into `SatPago` (facturaUuid → montoPagado/saldoInsoluto/
 * numParcialidad). This module derives the payment status of a PPD invoice from those complements
 * and propagates it onto the matching `LedgerEntry` (the single source of truth for Flujo de Dinero).
 *
 * The same per-invoice computation feeds the SAT-descarga PPD/Pagos tab (read-only) and this
 * ledger reconcile (write), so both agree.
 */

import { prisma } from '@healthcare/database';

export type PpdStatus = 'pagado' | 'parcial' | 'pendiente';

/** Minimal shape of a SatPago row needed to compute status (Prisma Decimal exposes `.toNumber()`). */
export interface PpdPagoInput {
  montoPagado: { toNumber(): number } | null;
  saldoInsoluto: { toNumber(): number } | null;
  numParcialidad: number | null;
  unlinkedAt: Date | null;
}

/**
 * Compute a PPD invoice's payment status from its complements. Mirrors the SAT-descarga PPD tab:
 * the last (highest parcialidad) active complement's `saldoInsoluto` decides paid/partial; a zero
 * balance means fully paid. `unlinkedAt` complements (manually unlinked) are ignored.
 */
export function computePpdStatus(
  invoiceTotal: number,
  pagos: PpdPagoInput[],
): { status: PpdStatus; totalPagado: number; saldoInsoluto: number | null; pendiente: number } {
  const active = pagos
    .filter((p) => !p.unlinkedAt)
    .sort((a, b) => (a.numParcialidad ?? 0) - (b.numParcialidad ?? 0));

  const totalPagado = active.reduce((s, p) => s + (p.montoPagado?.toNumber() ?? 0), 0);
  const lastPago = active.length > 0 ? active[active.length - 1] : null;
  const saldoInsoluto = lastPago?.saldoInsoluto?.toNumber() ?? null;

  let status: PpdStatus = 'pendiente';
  if (saldoInsoluto === 0) status = 'pagado';
  else if (active.length > 0) status = 'parcial';

  const pendiente = saldoInsoluto !== null ? saldoInsoluto : invoiceTotal - totalPagado;
  return { status, totalPagado, saldoInsoluto, pendiente };
}

/**
 * Drop SatPago rows whose payment complement (tipo P) has been cancelled at the SAT.
 *
 * A cancelled complement leaves its `SatPago` behind, so counting it would mark an invoice as paid
 * for money that was never validly received. `SatPago.pagoUuid` is lowercase; `SatCfdiMetadata.uuid`
 * is UPPERCASE — match both cases. Used by both the ledger reconcile and the PPD/Pagos tab so their
 * status agrees.
 */
export async function filterActiveByVigenteComplement<T extends { pagoUuid: string }>(
  doctorId: string,
  pagos: T[],
): Promise<T[]> {
  const pagoUuids = Array.from(new Set(pagos.map((p) => p.pagoUuid)));
  if (pagoUuids.length === 0) return pagos;

  const cancelled = await prisma.satCfdiMetadata.findMany({
    where: {
      doctorId,
      efecto: 'P',
      satStatus: 'Cancelado',
      uuid: { in: pagoUuids.flatMap((u) => [u.toUpperCase(), u.toLowerCase()]) },
    },
    select: { uuid: true },
  });
  if (cancelled.length === 0) return pagos;

  const cancelledSet = new Set(cancelled.map((c) => c.uuid.toLowerCase()));
  return pagos.filter((p) => !cancelledSet.has(p.pagoUuid.toLowerCase()));
}

// Upgrade-only: a complement can only advance payment status, never undo a manual mark / downgrade.
const STATUS_RANK: Record<string, number> = { PENDING: 0, PARTIAL: 1, PAID: 2 };

export interface ReconcilePpdSummary {
  updated: number;
}

/**
 * Reconcile PPD payment complements onto their ledger entries.
 *
 * For each invoice that has complements, derive its status and (upgrade-only) advance the matching
 * `LedgerEntry.paymentStatus`/`amountPaid`. The entry is found by `satCfdiUuid == facturaUuid`
 * (case-insensitive: satCfdiUuid is UPPERCASE, facturaUuid is lowercase). Only invoices with at
 * least one complement are touched — PUE invoices have no `SatPago` rows, so they're never affected.
 *
 * @param facturaUuids restrict to these invoice UUIDs (e.g. complements just parsed by a sync job).
 *                     Omit to reconcile every invoice that has complements (one-time catch-up).
 */
export async function reconcilePpdToLedger(
  doctorId: string,
  facturaUuids?: string[],
): Promise<ReconcilePpdSummary> {
  const pagoWhere: any = { doctorId, unlinkedAt: null };
  if (facturaUuids) {
    if (facturaUuids.length === 0) return { updated: 0 };
    pagoWhere.facturaUuid = { in: Array.from(new Set(facturaUuids.map((u) => u.toLowerCase()))) };
  }

  const rawPagos = await prisma.satPago.findMany({
    where: pagoWhere,
    orderBy: { numParcialidad: 'asc' },
  });
  // Exclude complements whose tipo-P CFDI was cancelled (their SatPago row lingers).
  const pagos = await filterActiveByVigenteComplement(doctorId, rawPagos);
  if (pagos.length === 0) return { updated: 0 };

  // Group complements by invoice (facturaUuid is lowercase).
  const byFactura = new Map<string, typeof pagos>();
  for (const p of pagos) {
    const key = p.facturaUuid.toLowerCase();
    const arr = byFactura.get(key) || [];
    arr.push(p);
    byFactura.set(key, arr);
  }

  // Find the ledger entries for these invoices (satCfdiUuid @unique → at most one per invoice).
  // satCfdiUuid is normally UPPERCASE, but match both cases for robustness (see 02 §4 casing note).
  const uuidVariants = Array.from(byFactura.keys()).flatMap((u) => [u.toUpperCase(), u.toLowerCase()]);
  const entries = await prisma.ledgerEntry.findMany({
    where: { doctorId, satCfdiUuid: { in: uuidVariants } },
    select: { id: true, satCfdiUuid: true, amount: true, paymentStatus: true },
  });

  let updated = 0;
  for (const entry of entries) {
    const invPagos = byFactura.get((entry.satCfdiUuid || '').toLowerCase());
    if (!invPagos) continue;

    const invoiceTotal = Number(entry.amount);
    const { status, totalPagado } = computePpdStatus(invoiceTotal, invPagos);

    const target = status === 'pagado' ? 'PAID' : status === 'parcial' ? 'PARTIAL' : 'PENDING';
    const currentRank = STATUS_RANK[entry.paymentStatus || 'PENDING'] ?? 0;
    const targetRank = STATUS_RANK[target] ?? 0;
    if (targetRank <= currentRank) continue; // upgrade-only — never downgrade or fight a manual mark

    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        paymentStatus: target,
        amountPaid: status === 'pagado' ? invoiceTotal : totalPagado,
      },
    });
    updated++;
  }

  return { updated };
}
