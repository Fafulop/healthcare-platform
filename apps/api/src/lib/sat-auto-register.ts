/**
 * SAT Auto-Registration — Phase 1 of Consolidated Money Model
 *
 * After a SAT sync job completes, automatically register new CFDIs as LedgerEntries.
 * Uses match-before-create to avoid duplicates: links to existing entries when confident,
 * flags for review when uncertain, creates new entries when no match.
 */

import { prisma } from '@healthcare/database';
import type { PrismaClient, SatCfdiMetadata } from '@healthcare/database';
import { generateLedgerInternalId, getDefaultArea } from './practice-utils';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ─── Scoring ────────────────────────────────────────────────────────────────

const MAX_RAW_SCORE = 120; // 40 (amount) + 30 (date) + 30 (RFC) + 20 (concept)

/** Lowercase, strip accents (NFD), collapse whitespace — for tolerant name matching. */
function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize an RFC for comparison (uppercase, no spaces). */
function normalizeRfc(s: string | null | undefined): string {
  return (s || '').toUpperCase().replace(/\s+/g, '');
}

export interface MatchCandidate {
  ledgerEntryId: number;
  rawScore: number;
  normalizedConfidence: number;
  concept: string;
  origin: string | null;
  amount: number;
  transactionDate: Date;
}

/**
 * Score a single ledger entry against a CFDI for potential matching.
 * Returns raw score (0-120) or null if the entry doesn't qualify.
 */
export function scoreCfdiMatch(
  candidate: {
    id: number;
    amount: any;
    concept: string;
    transactionDate: Date;
    entryType: string;
    origin: string | null;
    counterpartyRfc?: string | null;
    counterpartyName?: string | null;
    client?: { rfc: string | null } | null;
    supplier?: { rfc: string | null } | null;
  },
  cfdi: {
    monto: any;
    issuedAt: Date;
    issuerRfc: string;
    receiverRfc: string;
    issuerName: string | null;
    receiverName: string | null;
    direction: string;
  },
): number {
  const amount = Number(cfdi.monto);
  let score = 0;

  // Amount scoring (up to 40)
  const amountDiff = Math.abs(Number(candidate.amount) - amount);
  if (amountDiff === 0) score += 40;
  else if (amountDiff < amount * 0.001) score += 30;
  else score += 20;

  // Date scoring (up to 30)
  const entryDay = new Date(new Date(candidate.transactionDate).toISOString().split('T')[0] + 'T00:00:00Z');
  const cfdiDay = new Date(new Date(cfdi.issuedAt).toISOString().split('T')[0] + 'T00:00:00Z');
  const daysDiff = Math.abs((entryDay.getTime() - cfdiDay.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 1) score += 30;
  else if (daysDiff <= 2) score += 25;
  else if (daysDiff <= 4) score += 15;
  else score += 12;

  // RFC scoring (30) — counterpartyRfc (e.g. patient RFC on a cita entry) takes precedence,
  // falling back to the CRM client/supplier relation.
  const isReceived = cfdi.direction === 'received';
  const cfdiRfc = normalizeRfc(isReceived ? cfdi.issuerRfc : cfdi.receiverRfc);
  const entryRfc = normalizeRfc(
    candidate.counterpartyRfc
      || (candidate.entryType === 'ingreso' ? candidate.client?.rfc : candidate.supplier?.rfc),
  );
  if (entryRfc && cfdiRfc && entryRfc === cfdiRfc) score += 30;

  // Concept/name scoring (20) — compare the CFDI counterpart name against the entry's
  // counterpartyName (razón social) and concept, accent/case-insensitive.
  const cfdiName = foldText((isReceived ? cfdi.issuerName : cfdi.receiverName) || '');
  const entryNames = [candidate.counterpartyName, candidate.concept]
    .filter(Boolean)
    .map((s) => foldText(s as string));
  if (cfdiName.length >= 4) {
    const nameHit = entryNames.some(
      (n) => n.length >= 4 && (n.includes(cfdiName) || cfdiName.includes(n)),
    );
    if (nameHit) score += 20;
  }

  return score;
}

/** Normalize raw score to 0.00-1.00 */
export function normalizeScore(rawScore: number): number {
  return Math.round((rawScore / MAX_RAW_SCORE) * 10000) / 10000;
}

// ─── Entry type resolution ──────────────────────────────────────────────────

export function resolveEntryType(direction: string, efecto: string | null): 'ingreso' | 'egreso' {
  const isReceived = direction === 'received';
  if (isReceived) {
    return efecto === 'E' ? 'ingreso' : 'egreso';
  }
  return efecto === 'I' ? 'ingreso' : 'egreso';
}

// ─── Forma de pago mapping ──────────────────────────────────────────────────

const FORMA_PAGO_MAP: Record<string, string> = {
  '01': 'efectivo', '03': 'transferencia', '04': 'tarjeta',
  '02': 'cheque', '28': 'tarjeta', '06': 'transferencia',
};

// ─── Auto-register results ──────────────────────────────────────────────────

export interface AutoRegisterResult {
  uuid: string;
  action: 'auto_linked' | 'auto_linked_review' | 'created';
  ledgerEntryId: number;
  confidence: number | null;
}

export interface AutoRegisterSummary {
  autoLinked: number;
  autoLinkedNeedsReview: number;
  created: number;
  skipped: number;
  results: AutoRegisterResult[];
}

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Auto-register unlinked CFDIs from a SAT sync as LedgerEntries.
 *
 * For each CFDI:
 * 1. Skip if already linked, cancelled, or efecto is P/T/N
 * 2. Search for existing unlinked entries that match
 * 3. High confidence (>= 0.67) → auto-link silently
 * 4. Medium confidence (0.50-0.66) → auto-link + needsReview
 * 5. No match → create new entry
 */
export async function autoRegisterCfdisToLedger(
  doctorId: string,
  syncJobId?: number,
): Promise<AutoRegisterSummary> {
  // 1. Find unlinked CFDIs
  const where: any = {
    doctorId,
    satStatus: 'Vigente',
    efecto: { in: ['I', 'E'] }, // Skip P (pagos), T (traslados), N (nomina)
  };
  if (syncJobId) {
    where.syncJobId = syncJobId;
  }

  const cfdis = await prisma.satCfdiMetadata.findMany({ where });

  if (cfdis.length === 0) {
    return { autoLinked: 0, autoLinkedNeedsReview: 0, created: 0, skipped: 0, results: [] };
  }

  // 2. Filter out already-registered UUIDs
  const existingLinks = await prisma.ledgerEntry.findMany({
    where: {
      doctorId,
      satCfdiUuid: { in: cfdis.map((c) => c.uuid) },
    },
    select: { satCfdiUuid: true },
  });
  const alreadyLinked = new Set(existingLinks.map((e) => e.satCfdiUuid));
  const toProcess = cfdis.filter((c) => !alreadyLinked.has(c.uuid));

  if (toProcess.length === 0) {
    return {
      autoLinked: 0, autoLinkedNeedsReview: 0, created: 0,
      skipped: cfdis.length, results: [],
    };
  }

  // 3. Fetch XML details for richer data
  const details = await prisma.satCfdiDetail.findMany({
    where: {
      doctorId,
      uuid: { in: toProcess.map((c) => c.uuid.toLowerCase()) },
    },
    include: { conceptos: true },
  });
  const detailMap = new Map(details.map((d) => [d.uuid.toLowerCase(), d]));

  // 4. Process in transaction
  const results = await prisma.$transaction(async (tx) => {
    const entries: AutoRegisterResult[] = [];

    for (const cfdi of toProcess) {
      const result = await processOneCfdi(cfdi, detailMap, doctorId, tx);
      entries.push(result);
    }

    return entries;
  }, { timeout: 60000 });

  const autoLinked = results.filter((r) => r.action === 'auto_linked').length;
  const autoLinkedNeedsReview = results.filter((r) => r.action === 'auto_linked_review').length;
  const created = results.filter((r) => r.action === 'created').length;

  return {
    autoLinked,
    autoLinkedNeedsReview,
    created,
    skipped: cfdis.length - toProcess.length,
    results,
  };
}

// ─── Process a single CFDI ──────────────────────────────────────────────────

async function processOneCfdi(
  cfdi: SatCfdiMetadata,
  detailMap: Map<string, any>,
  doctorId: string,
  tx: TxClient,
): Promise<AutoRegisterResult> {
  const detail = detailMap.get(cfdi.uuid.toLowerCase());
  const isReceived = cfdi.direction === 'received';
  const entryType = resolveEntryType(cfdi.direction, cfdi.efecto);
  const amount = Number(cfdi.monto) || (detail?.total ? Number(detail.total) : 0);
  const cfdiDate = new Date(cfdi.issuedAt);

  // ── Try to match existing entries ──
  const tolerance = amount * 0.01;
  const dateFrom = new Date(cfdiDate);
  dateFrom.setDate(dateFrom.getDate() - 7);
  const dateTo = new Date(cfdiDate);
  dateTo.setDate(dateTo.getDate() + 7);

  const matchCandidates = await (tx as unknown as PrismaClient).ledgerEntry.findMany({
    where: {
      doctorId,
      satCfdiUuid: null,
      entryType,
      amount: { gte: amount - tolerance, lte: amount + tolerance },
      transactionDate: { gte: dateFrom, lte: dateTo },
    },
    include: {
      client: { select: { rfc: true } },
      supplier: { select: { rfc: true } },
    },
    // counterpartyRfc / counterpartyName are scalar columns and come back by default.
    take: 10,
  });

  // Score all candidates
  let bestMatch: { entry: typeof matchCandidates[0]; rawScore: number; confidence: number } | null = null;

  for (const candidate of matchCandidates) {
    const rawScore = scoreCfdiMatch(candidate, cfdi);
    const confidence = normalizeScore(rawScore);

    if (confidence >= 0.50 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { entry: candidate, rawScore, confidence };
    }
  }

  // ── High confidence: auto-link silently ──
  if (bestMatch && bestMatch.confidence >= 0.67) {
    await (tx as unknown as PrismaClient).ledgerEntry.update({
      where: { id: bestMatch.entry.id },
      data: {
        satCfdiUuid: cfdi.uuid,
        hasFactura: true,
        autoLinkedConfidence: bestMatch.confidence,
        needsReview: false,
      },
    });
    return {
      uuid: cfdi.uuid,
      action: 'auto_linked',
      ledgerEntryId: bestMatch.entry.id,
      confidence: bestMatch.confidence,
    };
  }

  // ── Medium confidence: auto-link + flag for review ──
  if (bestMatch && bestMatch.confidence >= 0.50) {
    await (tx as unknown as PrismaClient).ledgerEntry.update({
      where: { id: bestMatch.entry.id },
      data: {
        satCfdiUuid: cfdi.uuid,
        hasFactura: true,
        autoLinkedConfidence: bestMatch.confidence,
        needsReview: true,
      },
    });
    return {
      uuid: cfdi.uuid,
      action: 'auto_linked_review',
      ledgerEntryId: bestMatch.entry.id,
      confidence: bestMatch.confidence,
    };
  }

  // ── No match: create new entry ──
  return createEntryFromCfdi(cfdi, detail, entryType, amount, cfdiDate, isReceived, doctorId, tx);
}

// ─── Create a new LedgerEntry from a CFDI ───────────────────────────────────

async function createEntryFromCfdi(
  cfdi: SatCfdiMetadata,
  detail: any,
  entryType: string,
  amount: number,
  cfdiDate: Date,
  isReceived: boolean,
  doctorId: string,
  tx: TxClient,
): Promise<AutoRegisterResult> {
  // Build concept
  let concept = '';
  if (detail?.conceptos && detail.conceptos.length > 0) {
    const descriptions = detail.conceptos
      .map((c: any) => c.descripcion)
      .filter(Boolean)
      .slice(0, 3);
    concept = descriptions.join(', ');
    if (detail.conceptos.length > 3) concept += ` (+${detail.conceptos.length - 3} más)`;
  }
  if (!concept) {
    const counterpart = isReceived ? cfdi.issuerName : cfdi.receiverName;
    concept = `CFDI ${isReceived ? 'recibido de' : 'emitido a'} ${counterpart || (isReceived ? cfdi.issuerRfc : cfdi.receiverRfc)}`;
  }

  // Area
  const areaType = entryType === 'ingreso' ? 'INGRESO' as const : 'EGRESO' as const;
  const defaultArea = await getDefaultArea(doctorId, areaType, tx);

  // Forma de pago
  const formaPago = detail?.formaPago
    ? (FORMA_PAGO_MAP[detail.formaPago] || 'transferencia')
    : 'transferencia';

  const internalId = await generateLedgerInternalId(doctorId, entryType, tx);

  // Supplier for received egresos
  let supplierId: number | null = null;
  if (isReceived && entryType === 'egreso' && cfdi.issuerRfc) {
    const existing = await (tx as unknown as PrismaClient).proveedor.findFirst({
      where: { doctorId, rfc: cfdi.issuerRfc },
    });
    if (existing) {
      supplierId = existing.id;
    } else {
      const newSupplier = await (tx as unknown as PrismaClient).proveedor.create({
        data: {
          doctorId,
          businessName: cfdi.issuerName || cfdi.issuerRfc,
          rfc: cfdi.issuerRfc,
        },
      });
      supplierId = newSupplier.id;
    }
  }

  // Payment defaults: emitted → PAID, received → PENDING (per plan Phase 1.6)
  const paymentStatus = isReceived ? 'PENDING' : 'PAID';
  const amountPaid = isReceived ? 0 : amount;

  const entry = await (tx as unknown as PrismaClient).ledgerEntry.create({
    data: {
      doctorId,
      amount,
      concept: concept.substring(0, 500),
      entryType,
      transactionDate: cfdiDate,
      internalId,
      formaDePago: formaPago,
      area: defaultArea.area,
      subarea: defaultArea.subarea,
      origin: isReceived ? 'sat_recibido' : 'sat_emitido',
      hasFactura: true,
      satCfdiUuid: cfdi.uuid,
      transactionType: 'N/A',
      amountPaid,
      paymentStatus,
      // Denormalize the CFDI counterpart so this entry can later match a bank line / be read by an agent.
      counterpartyRfc: normalizeRfc(isReceived ? cfdi.issuerRfc : cfdi.receiverRfc) || null,
      counterpartyName: (isReceived ? cfdi.issuerName : cfdi.receiverName)?.slice(0, 300) || null,
      ...(supplierId ? { supplierId } : {}),
    },
  });

  return {
    uuid: cfdi.uuid,
    action: 'created',
    ledgerEntryId: entry.id,
    confidence: null,
  };
}
