/**
 * Bank Movement Matching Engine
 *
 * Matches bank movements against existing LedgerEntries using 4 priority levels.
 */

import type { LedgerEntry, BankMovement } from '@healthcare/database';

interface MatchCandidate {
  ledgerEntryId: number;
  confidence: number;
  matchReason: string;
}

type LedgerEntryForMatch = Pick<LedgerEntry, 'id' | 'amount' | 'transactionDate' | 'entryType' | 'concept' | 'bankMovementId'>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDateStr(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().split('T')[0];
}

function daysDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

function amountsMatch(a: number | string | { toNumber(): number }, b: number | string | { toNumber(): number }): boolean {
  const na = typeof a === 'object' && 'toNumber' in a ? a.toNumber() : typeof a === 'string' ? parseFloat(a) : a;
  const nb = typeof b === 'object' && 'toNumber' in b ? b.toNumber() : typeof b === 'string' ? parseFloat(b) : b;
  return Math.abs(na - nb) < 0.01;
}

function movementTypeMatchesEntryType(movementType: string, entryType: string): boolean {
  return (movementType === 'deposit' && entryType === 'ingreso') ||
         (movementType === 'withdrawal' && entryType === 'egreso');
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return matches / Math.max(wordsA.size, wordsB.size);
}

// ─── Main Matching ──────────────────────────────────────────────────────────

export interface MatchResult {
  movementIdx: number;
  match: MatchCandidate | null;
}

/**
 * For a single bank movement, find the best matching LedgerEntry.
 * Returns null if no match found above minimum confidence threshold.
 */
function findBestMatch(
  movement: { transactionDate: string; description: string; reference: string | null; amount: number; movementType: string },
  entries: LedgerEntryForMatch[],
  usedEntryIds: Set<number>,
): MatchCandidate | null {
  let best: MatchCandidate | null = null;

  for (const entry of entries) {
    if (usedEntryIds.has(entry.id)) continue;
    if (!movementTypeMatchesEntryType(movement.movementType, entry.entryType)) continue;
    if (!amountsMatch(movement.amount, entry.amount)) continue;

    const entryDateStr = toDateStr(entry.transactionDate);
    const days = daysDiff(movement.transactionDate, entryDateStr);

    // Priority 1: reference match + same amount + date within 1 day
    if (movement.reference && entry.bankMovementId &&
        movement.reference.trim() === entry.bankMovementId.trim() &&
        days <= 1) {
      return { ledgerEntryId: entry.id, confidence: 0.99, matchReason: 'Referencia bancaria + monto + fecha' };
    }

    // Priority 2: exact date + same amount
    if (days === 0) {
      const candidate: MatchCandidate = { ledgerEntryId: entry.id, confidence: 0.85, matchReason: 'Monto + fecha exacta' };
      if (!best || candidate.confidence > best.confidence) best = candidate;
      continue;
    }

    // Priority 3: close date (+/- 2 days) + same amount
    if (days <= 2) {
      const candidate: MatchCandidate = { ledgerEntryId: entry.id, confidence: 0.70, matchReason: `Monto + fecha cercana (${days} día${days > 1 ? 's' : ''})` };
      if (!best || candidate.confidence > best.confidence) best = candidate;
      continue;
    }

    // Priority 4: same amount + concept overlap (within 7 days)
    if (days <= 7) {
      const overlap = wordOverlap(movement.description, entry.concept);
      if (overlap >= 0.3) {
        const confidence = 0.50 + overlap * 0.15;
        const candidate: MatchCandidate = { ledgerEntryId: entry.id, confidence: Math.min(confidence, 0.65), matchReason: 'Monto + concepto similar' };
        if (!best || candidate.confidence > best.confidence) best = candidate;
      }
    }
  }

  return best;
}

/**
 * Match all bank movements against existing LedgerEntries.
 * Each entry can only be matched once (greedy: highest confidence first).
 */
export function matchMovements(
  movements: { transactionDate: string; description: string; reference: string | null; amount: number; movementType: string }[],
  entries: LedgerEntryForMatch[],
): MatchResult[] {
  // First pass: compute best match for each movement
  const candidates: { idx: number; match: MatchCandidate }[] = [];
  const usedEntryIds = new Set<number>();

  // Sort by confidence descending to assign best matches first
  const preliminary = movements.map((m, idx) => ({
    idx,
    match: findBestMatch(m, entries, new Set()),
  })).filter((c): c is { idx: number; match: MatchCandidate } => c.match !== null);

  preliminary.sort((a, b) => b.match.confidence - a.match.confidence);

  const results: MatchResult[] = movements.map((_, idx) => ({ movementIdx: idx, match: null }));

  for (const { idx, match } of preliminary) {
    if (usedEntryIds.has(match.ledgerEntryId)) {
      // This entry was already claimed by a higher-confidence match — try re-matching
      const reMatch = findBestMatch(movements[idx], entries, usedEntryIds);
      if (reMatch) {
        usedEntryIds.add(reMatch.ledgerEntryId);
        results[idx].match = reMatch;
      }
    } else {
      usedEntryIds.add(match.ledgerEntryId);
      results[idx].match = match;
    }
  }

  return results;
}
