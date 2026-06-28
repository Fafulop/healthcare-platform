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

// SAT c_FormaPago → canonical ledger value. Codes outside this set (notably `99`
// "Por definir", very common on received/PPD invoices) map to null instead of being
// silently mislabeled as a transfer.
const FORMA_PAGO_MAP: Record<string, string> = {
  '01': 'efectivo',
  '02': 'cheque',
  '03': 'transferencia',
  '04': 'tarjeta',
  '05': 'tarjeta',        // monedero electrónico
  '06': 'transferencia',  // dinero electrónico
  '28': 'tarjeta',        // tarjeta de débito
  '29': 'tarjeta',        // tarjeta de servicios
};

/** Map a SAT forma-de-pago code to the canonical ledger value, or null if unknown / «por definir». */
export function mapFormaPago(code: string | null | undefined): string | null {
  if (!code) return null;
  return FORMA_PAGO_MAP[code] ?? null;
}

// ─── Concept building ─────────────────────────────────────────────────────────

/** Matches the generic placeholder concept produced when a CFDI is registered before its XML. */
const GENERIC_CONCEPT_RE = /^CFDI (recibido de|emitido a) /;

/**
 * Build a ledger concept from a CFDI: the XML line items when available, otherwise a
 * generic "CFDI recibido de / emitido a <counterpart>" placeholder. Truncated to 500 chars.
 */
function buildConcept(detail: any, cfdi: SatCfdiMetadata, isReceived: boolean): string {
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
  return concept.substring(0, 500);
}

// ─── Payment status ───────────────────────────────────────────────────────────

/**
 * Payment status at registration. PUE (Pago en Una Exhibición) is paid on emission; PPD
 * (Pago en Parcialidades o Diferido) is paid later via a payment complement, so an emitted PPD
 * starts PENDING — a factura is not proof the money moved. Received CFDIs start PENDING (we don't
 * know payment status yet). metodoPago comes from the XML; when it's absent (metadata stage, no XML)
 * we fall back to the common case (emitted → PAID) and let the XML back-enrich downgrade PPDs.
 */
export function resolvePaymentStatus(
  isReceived: boolean,
  metodoPago: string | null | undefined,
): 'PENDING' | 'PAID' {
  if (isReceived) return 'PENDING';
  return metodoPago === 'PPD' ? 'PENDING' : 'PAID';
}

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
  enriched: number;
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
  uuids?: string[],
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
  // Scope to a specific set of CFDIs (e.g. the UUIDs an XML job just parsed) — bounds the work
  // and avoids re-scanning the doctor's whole history on every sync. Match case-insensitively:
  // metadata UUIDs are stored UPPERCASE while parsed-XML UUIDs are lowercased, so include both
  // variants (Postgres `in` is case-sensitive).
  if (uuids) {
    if (uuids.length === 0) {
      return { autoLinked: 0, autoLinkedNeedsReview: 0, created: 0, enriched: 0, skipped: 0, results: [] };
    }
    where.uuid = { in: Array.from(new Set(uuids.flatMap((u) => [u.toUpperCase(), u.toLowerCase()]))) };
  }

  const cfdis = await prisma.satCfdiMetadata.findMany({ where });

  if (cfdis.length === 0) {
    return { autoLinked: 0, autoLinkedNeedsReview: 0, created: 0, enriched: 0, skipped: 0, results: [] };
  }

  // 2. Look up which CFDIs already have a ledger entry (pull fields we may back-enrich).
  const existingLinks = await prisma.ledgerEntry.findMany({
    where: {
      doctorId,
      satCfdiUuid: { in: cfdis.map((c) => c.uuid) },
    },
    select: { id: true, satCfdiUuid: true, origin: true, concept: true, formaDePago: true, paymentStatus: true },
  });
  const existingByUuid = new Map(existingLinks.map((e) => [e.satCfdiUuid as string, e]));
  const toProcess = cfdis.filter((c) => !existingByUuid.has(c.uuid));

  // 3. Fetch XML details for ALL cfdis — needed both to create new entries and to back-enrich
  //    entries that were auto-created before their XML had downloaded. (The metadata-stage
  //    auto-register runs before the XML detail exists, so those entries are born with a generic
  //    concept + default forma de pago; this is where we fix them up once the XML arrives.)
  const details = await prisma.satCfdiDetail.findMany({
    where: {
      doctorId,
      uuid: { in: cfdis.map((c) => c.uuid.toLowerCase()) },
    },
    include: { conceptos: true },
  });
  const detailMap = new Map(details.map((d) => [d.uuid.toLowerCase(), d]));

  // 4. Enrich + process in a single transaction.
  const { results, enriched } = await prisma.$transaction(async (tx) => {
    // 4a. Back-enrich already-linked CFDI-origin entries from their now-present XML.
    //     Only `sat_emitido`/`sat_recibido` entries are touched.
    let enriched = 0;
    for (const cfdi of cfdis) {
      const existing = existingByUuid.get(cfdi.uuid);
      if (!existing) continue;
      if (existing.origin !== 'sat_emitido' && existing.origin !== 'sat_recibido') continue;

      const detail = detailMap.get(cfdi.uuid.toLowerCase());
      if (!detail) continue; // XML still not here — nothing to enrich yet

      const isReceived = cfdi.direction === 'received';
      const data: { concept?: string; formaDePago?: string | null; paymentStatus?: string; amountPaid?: number } = {};

      // All back-enrichment is gated on the generic placeholder concept, which marks an entry as
      // "born pre-XML and untouched since". This is what protects user edits: once an entry has a
      // real concept (enriched, or the user worked with it), we never overwrite its concept, forma,
      // or payment status here. Without this gate the PPD downgrade below would revert a manually
      // marked-PAID PPD back to PENDING on every backfill (no complement→ledger reconciliation yet).
      if (GENERIC_CONCEPT_RE.test(existing.concept)) {
        const newConcept = buildConcept(detail, cfdi, isReceived);
        if (newConcept && newConcept !== existing.concept) data.concept = newConcept;

        // Forma is replaced even when null (→ "—"), clearing the stale default.
        const fp = mapFormaPago(detail.formaPago);
        if (fp !== existing.formaDePago) data.formaDePago = fp;

        // An emitted PPD invoice has no money yet → PENDING (the born default was an unconditional PAID).
        if (existing.origin === 'sat_emitido' && detail.metodoPago === 'PPD' && existing.paymentStatus !== 'PENDING') {
          data.paymentStatus = 'PENDING';
          data.amountPaid = 0;
        }
      }

      if (Object.keys(data).length > 0) {
        await (tx as unknown as PrismaClient).ledgerEntry.update({
          where: { id: existing.id },
          data,
        });
        enriched++;
      }
    }

    // 4b. Create or link the CFDIs that have no ledger entry yet.
    const entries: AutoRegisterResult[] = [];
    for (const cfdi of toProcess) {
      entries.push(await processOneCfdi(cfdi, detailMap, doctorId, tx));
    }

    return { results: entries, enriched };
  }, { timeout: 60000 });

  const autoLinked = results.filter((r) => r.action === 'auto_linked').length;
  const autoLinkedNeedsReview = results.filter((r) => r.action === 'auto_linked_review').length;
  const created = results.filter((r) => r.action === 'created').length;

  return {
    autoLinked,
    autoLinkedNeedsReview,
    created,
    enriched,
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
  // Build concept (XML line items when present, generic placeholder otherwise)
  const concept = buildConcept(detail, cfdi, isReceived);

  // Area
  const areaType = entryType === 'ingreso' ? 'INGRESO' as const : 'EGRESO' as const;
  const defaultArea = await getDefaultArea(doctorId, areaType, tx);

  // Forma de pago — derived from XML; null (→ "—") when unknown, so it can be back-enriched later.
  const formaPago = mapFormaPago(detail?.formaPago);

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

  // Payment status: received → PENDING; emitted → PAID for PUE, PENDING for PPD (no money yet).
  const paymentStatus = resolvePaymentStatus(isReceived, detail?.metodoPago);
  const amountPaid = paymentStatus === 'PAID' ? amount : 0;

  const entry = await (tx as unknown as PrismaClient).ledgerEntry.create({
    data: {
      doctorId,
      amount,
      concept,
      entryType,
      transactionDate: cfdiDate,
      internalId,
      // Explicit null (not omitted) so an unknown forma shows "—" instead of the schema default.
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
