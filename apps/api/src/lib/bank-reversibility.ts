/**
 * Reversible bank matching (gap §7/EXP-F13).
 *
 * Matching enriches a ledger entry (hasComprobante / paymentStatus / amountPaid / bank refs) or
 * creates a bank-born entry (origin=banco via create_entry, origin=comision via a settlement).
 * To undo a match cleanly we snapshot the entry's pre-enrich state into the movement's matchHistory
 * at match time, then on undo either restore that snapshot or delete the born entry — instead of
 * guessing what to clear (which would wipe a manual mark, a PPD complement, or a manual comprobante).
 *
 * Shared by the per-movement actions (`unmatch` / `unlink_settlement`) and statement deletion, so
 * deleting a whole statement reverses its effects too instead of stranding entries.
 *
 * Functions take a Prisma transaction client (`tx`) and only touch ledger entries — the caller is
 * responsible for the movement row and its settlement items (delete or cascade).
 */

export interface EvidenceSnapshot {
  hasComprobante: boolean;
  needsReview: boolean;
  bankAccount: string | null;
  bankMovementId: string | null;
  paymentStatus: string | null;
  amountPaid: number | null;
}

/** Fields to select when fetching an entry we're about to enrich (so the snapshot is complete). */
export const EVIDENCE_SELECT = {
  hasComprobante: true, needsReview: true, bankAccount: true,
  bankMovementId: true, paymentStatus: true, amountPaid: true,
} as const;

export function snapshotEvidence(e: any): EvidenceSnapshot {
  return {
    hasComprobante: !!e.hasComprobante,
    needsReview: !!e.needsReview,
    bankAccount: e.bankAccount ?? null,
    bankMovementId: e.bankMovementId ?? null,
    paymentStatus: e.paymentStatus ?? null,
    amountPaid: e.amountPaid != null ? Number(e.amountPaid) : null,
  };
}

/** Prisma update data that restores an entry to a snapshot. */
export function restoreData(snap: EvidenceSnapshot) {
  return {
    hasComprobante: snap.hasComprobante,
    needsReview: snap.needsReview,
    bankAccount: snap.bankAccount,
    bankMovementId: snap.bankMovementId,
    paymentStatus: snap.paymentStatus,
    amountPaid: snap.amountPaid ?? 0,
  };
}

/**
 * The most recent 1:1 link action recorded in a movement's history — the one we'd undo.
 * Either it ENRICHED an existing entry (`prevLedger` snapshot → restore) or CREATED a born entry
 * (`createdLedgerEntry` id → delete). Returns whichever is more recent so a stale marker from an
 * earlier, already-undone cycle can't fire. (Settlements use findLastSettlement.)
 */
export function findLastLinkAction(
  history: any,
): { prevLedger?: EvidenceSnapshot; createdLedgerEntry?: number } | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h?.createdLedgerEntry != null) return { createdLedgerEntry: Number(h.createdLedgerEntry) };
    if (h?.prevLedger) return { prevLedger: h.prevLedger as EvidenceSnapshot };
  }
  return null;
}

/** Most recent settlement (N:1) action: per-entry snapshots to restore + the commission egreso it spawned. */
export function findLastSettlement(
  history: any,
): { prevLedgerById: Record<string, EvidenceSnapshot>; commissionEntryId?: number } | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h?.prevLedgerById) {
      return {
        prevLedgerById: h.prevLedgerById as Record<string, EvidenceSnapshot>,
        commissionEntryId: h.commissionEntryId != null ? Number(h.commissionEntryId) : undefined,
      };
    }
  }
  return null;
}

/**
 * A bank-born entry (create_entry's `origin=banco`, or a settlement's `origin=comision`) is safe to
 * delete on undo only if the user hasn't built on it: still the expected origin, no factura/CFDI
 * (downloaded or emitted)/attachment, and not referenced by any other bank movement or settlement.
 */
export async function bornEntryIsPristine(
  tx: any, entryId: number, doctorId: string, expectedOrigin: string, excludeMovementId?: number,
): Promise<boolean> {
  const e = await tx.ledgerEntry.findFirst({
    where: { id: entryId, doctorId },
    select: { origin: true, hasFactura: true, satCfdiUuid: true },
  });
  if (!e || e.origin !== expectedOrigin || e.hasFactura || e.satCfdiUuid) return false;
  const [otherMovements, settledRefs, attachments, emittedCfdis] = await Promise.all([
    tx.bankMovement.count({ where: { ledgerEntryId: entryId, ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}) } }),
    tx.bankSettlementItem.count({ where: { ledgerEntryId: entryId } }),
    tx.ledgerAttachment.count({ where: { ledgerEntryId: entryId } }),
    // System-emitted CFDI linked to this entry — don't depend on the hasFactura side-effect to catch it.
    tx.cfdiEmitted.count({ where: { ledgerEntryId: entryId } }),
  ]);
  return otherMovements === 0 && settledRefs === 0 && attachments === 0 && emittedCfdis === 0;
}

/**
 * Reverse a single movement's effect on the ledger: restore enriched entries to their pre-match
 * snapshot, delete pristine bank-born entries (origin=banco) and the settlement's commission egreso.
 * Does NOT touch the movement row or its settlement items — the caller deletes/cascades those.
 *
 * `movement` must carry `id`, `ledgerEntryId`, and `matchHistory`.
 */
export async function revertEntryEffects(tx: any, movement: any, doctorId: string): Promise<void> {
  // Settlement (N:1) — only if the movement actually has settlement items right now.
  const settlement = findLastSettlement(movement.matchHistory);
  if (settlement) {
    const itemCount = await tx.bankSettlementItem.count({ where: { bankMovementId: movement.id } });
    if (itemCount > 0) {
      for (const [idStr, snap] of Object.entries(settlement.prevLedgerById)) {
        await tx.ledgerEntry.updateMany({ where: { id: Number(idStr), doctorId }, data: restoreData(snap) });
      }
      if (settlement.commissionEntryId != null
          && await bornEntryIsPristine(tx, settlement.commissionEntryId, doctorId, 'comision')) {
        await tx.ledgerEntry.delete({ where: { id: settlement.commissionEntryId } });
      }
      return;
    }
  }

  // 1:1
  if (!movement.ledgerEntryId) return;
  const action = findLastLinkAction(movement.matchHistory);
  if (action?.createdLedgerEntry === movement.ledgerEntryId) {
    // bank_movements.ledger_entry_id is onDelete:SetNull, so deleting the entry is FK-safe.
    if (await bornEntryIsPristine(tx, movement.ledgerEntryId, doctorId, 'banco', movement.id)) {
      await tx.ledgerEntry.delete({ where: { id: movement.ledgerEntryId } });
    }
    // else: leave the entry intact; only the movement is removed by the caller.
  } else if (action?.prevLedger) {
    // updateMany (not update) so a since-deleted entry doesn't throw.
    await tx.ledgerEntry.updateMany({
      where: { id: movement.ledgerEntryId, doctorId },
      data: restoreData(action.prevLedger),
    });
  }
}
