import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/conciliacion-bancaria/[id]/movements/[movId]
// Returns match suggestions: existing ledger entries that could match this bank movement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id, movId } = await params;
    const statementId = parseInt(id);
    const movementId = parseInt(movId);

    if (isNaN(statementId) || isNaN(movementId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      select: { id: true, doctorId: true },
    });
    if (!statement || statement.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const movement = await prisma.bankMovement.findUnique({
      where: { id: movementId },
    });
    if (!movement || movement.bankStatementId !== statementId) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    const amount = Number(movement.amount);
    const movDate = new Date(movement.transactionDate);
    const tolerance = amount * 0.02; // 2% tolerance for bank matching
    // Card payouts arrive NET of commission, so a card (gross) entry can be a few % ABOVE the
    // deposit. Widen the upper bound for deposits to surface those gross entries.
    const upperPct = movement.movementType === 'deposit' ? 0.045 : 0.02;
    const dateFrom = new Date(movDate);
    dateFrom.setDate(dateFrom.getDate() - 5);
    const dateTo = new Date(movDate);
    dateTo.setDate(dateTo.getDate() + 5);

    const entryType = movement.movementType === 'deposit' ? 'ingreso' : 'egreso';

    // Find candidate entries not already linked to a bank movement or settlement
    const candidates = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        entryType,
        amount: { gte: amount - tolerance, lte: amount * (1 + upperPct) },
        transactionDate: { gte: dateFrom, lte: dateTo },
        bankMovement: { is: null }, // not already linked to another bank movement
        settlementItem: { is: null }, // not already part of a settlement
        origin: { not: 'comision' }, // settlement commission egresos are not standalone bank lines
      },
      select: {
        id: true,
        amount: true,
        concept: true,
        transactionDate: true,
        origin: true,
        area: true,
        subarea: true,
        formaDePago: true,
        internalId: true,
        hasFactura: true,
        hasComprobante: true,
      },
      take: 10,
    });

    // Score and rank
    const suggestions = candidates.map((c) => {
      let score = 0;

      const cAmt = Number(c.amount);
      const amountDiff = Math.abs(cAmt - amount);
      // Card deposit landed net of commission: gross entry sits just above the deposit.
      const cardFee = movement.movementType === 'deposit' && c.formaDePago === 'tarjeta'
        && cAmt > amount && cAmt <= amount * 1.045;
      if (amountDiff === 0) score += 40;
      else if (amountDiff < amount * 0.005) score += 30;
      else if (cardFee) score += 28;
      else score += 15;

      const daysDiff = Math.abs(
        (new Date(c.transactionDate).getTime() - movDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff < 1) score += 40;
      else if (daysDiff <= 2) score += 25;
      else score += 10;

      // Bonus for entries that already have evidence (more likely to be real)
      if (c.hasFactura) score += 10;

      const confidence = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';

      return { ...c, amount: Number(c.amount), score, confidence };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    return NextResponse.json({ data: suggestions });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching movement match suggestions:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH /api/practice-management/conciliacion-bancaria/[id]/movements/[movId]
// Actions: confirm_match, ignore, create_entry, link_existing, update_category, unmatch
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; movId: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id, movId } = await params;
    const statementId = parseInt(id);
    const movementId = parseInt(movId);

    if (isNaN(statementId) || isNaN(movementId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
    }

    // Verify ownership: statement belongs to doctor
    const statement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      select: { id: true, doctorId: true },
    });
    if (!statement || statement.doctorId !== doctor.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Verify movement belongs to statement
    const movement = await prisma.bankMovement.findUnique({
      where: { id: movementId },
    });
    if (!movement || movement.bankStatementId !== statementId) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'confirm_match':
        return handleConfirmMatch(movement, doctor.id);

      case 'unmatch':
        return handleUnmatch(movement, statementId, doctor.id);

      case 'ignore':
        return handleIgnore(movement, doctor.id);

      case 'create_entry':
        return handleCreateEntry(movement, doctor.id, body, statementId);

      case 'link_existing':
        return handleLinkExisting(movement, doctor.id, body, statementId);

      case 'link_settlement':
        return handleLinkSettlement(movement, doctor.id, body, statementId);

      case 'unlink_settlement':
        return handleUnlinkSettlement(movement, statementId, doctor.id);

      case 'update_category':
        return handleUpdateCategory(movement, doctor.id, body);

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error updating bank movement:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ─── Audit Trail Helper ──────────────────────────────────────────────────────

function buildAuditEntry(action: string, movement: any, doctorId: string) {
  return {
    action,
    at: new Date().toISOString(),
    by: doctorId,
    from: movement.matchStatus,
    ledgerEntryId: movement.ledgerEntryId,
    confidence: movement.matchConfidence ? Number(movement.matchConfidence) : null,
  };
}

function appendHistory(existing: any, entry: any): any[] {
  const history = Array.isArray(existing) ? existing : [];
  return [...history, entry];
}

// ─── Evidence snapshot/restore (reversible matching) ─────────────────────────
// Matching enriches the ledger entry (hasComprobante / paymentStatus / amountPaid / bank refs).
// To make `unmatch` truly reversible, we snapshot the entry's pre-enrich state into the movement's
// matchHistory at match time and restore it on unmatch — instead of guessing what to clear (which
// would wipe a manual mark, a PPD complement, or a manually-uploaded comprobante). See gap §7/EXP-F13.

interface EvidenceSnapshot {
  hasComprobante: boolean;
  needsReview: boolean;
  bankAccount: string | null;
  bankMovementId: string | null;
  paymentStatus: string | null;
  amountPaid: number | null;
}

/** Fields to select when fetching an entry we're about to enrich (so the snapshot is complete). */
const EVIDENCE_SELECT = {
  hasComprobante: true, needsReview: true, bankAccount: true,
  bankMovementId: true, paymentStatus: true, amountPaid: true,
} as const;

function snapshotEvidence(e: any): EvidenceSnapshot {
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
function restoreData(snap: EvidenceSnapshot) {
  return {
    hasComprobante: snap.hasComprobante,
    needsReview: snap.needsReview,
    bankAccount: snap.bankAccount,
    bankMovementId: snap.bankMovementId,
    paymentStatus: snap.paymentStatus,
    amountPaid: snap.amountPaid ?? 0,
  };
}

/** Most recent 1:1 snapshot recorded in a movement's history (the enrich we'd be undoing). */
function findLastSnapshot(history: any): EvidenceSnapshot | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.prevLedger) return history[i].prevLedger as EvidenceSnapshot;
  }
  return null;
}

/** Most recent settlement (N:1) snapshot map { entryId: snapshot } recorded in a movement's history. */
function findLastSnapshotMap(history: any): Record<string, EvidenceSnapshot> | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.prevLedgerById) return history[i].prevLedgerById as Record<string, EvidenceSnapshot>;
  }
  return null;
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

async function handleConfirmMatch(movement: any, doctorId: string) {
  if (!movement.ledgerEntryId) {
    return NextResponse.json({ error: 'Este movimiento no tiene un match asignado' }, { status: 400 });
  }

  // Fetch statement for bank account info + the linked entry
  const [statement, entry] = await Promise.all([
    prisma.bankStatement.findUnique({
      where: { id: movement.bankStatementId },
      select: { bankName: true, accountNumber: true },
    }),
    prisma.ledgerEntry.findUnique({
      where: { id: movement.ledgerEntryId },
      select: { ...EVIDENCE_SELECT, amount: true },
    }),
  ]);

  const audit: any = buildAuditEntry('confirm_match', movement, doctorId);
  if (entry) audit.prevLedger = snapshotEvidence(entry); // for reversible unmatch

  await prisma.$transaction(async (tx) => {
    await tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'matched_confirmed',
        matchedAt: new Date(),
        matchedBy: doctorId,
        matchHistory: appendHistory(movement.matchHistory, audit),
      },
    });

    // Enrich ledger entry on confirm (same as link_existing)
    if (entry) {
      const enrichData: any = {
        hasComprobante: true,
        needsReview: false,
      };
      if (!entry.bankAccount && statement) {
        enrichData.bankAccount = `${statement.bankName} ${statement.accountNumber}`;
      }
      if (!entry.bankMovementId && movement.reference) {
        enrichData.bankMovementId = movement.reference;
      }
      if (entry.paymentStatus !== 'PAID') {
        enrichData.paymentStatus = 'PAID';
        enrichData.amountPaid = entry.amount;
      }
      await tx.ledgerEntry.update({
        where: { id: movement.ledgerEntryId },
        data: enrichData,
      });
    }
  });

  await updateStatementCounts(movement.bankStatementId);

  const updated = await prisma.bankMovement.findUnique({ where: { id: movement.id } });
  return NextResponse.json({ data: updated });
}

async function handleUnmatch(movement: any, statementId: number, doctorId: string) {
  // A movement is matched either 1:1 (ledgerEntryId) or as a settlement (settlement items).
  const settlementCount = await prisma.bankSettlementItem.count({
    where: { bankMovementId: movement.id },
  });

  if (!movement.ledgerEntryId && settlementCount === 0) {
    return NextResponse.json({ error: 'Este movimiento no tiene un match' }, { status: 400 });
  }

  const audit = buildAuditEntry('unmatch', movement, doctorId);
  // Restore the entry to its pre-enrich state so unmatch is truly reversible (§7/EXP-F13).
  // Edge: if a PPD complement upgraded paymentStatus between confirm and unmatch, restoring the
  // (older) snapshot may briefly under-state it — the next PPD reconcile (upgrade-only) re-asserts it.
  const snap = findLastSnapshot(movement.matchHistory);
  const updated = await prisma.$transaction(async (tx) => {
    if (settlementCount > 0) {
      await tx.bankSettlementItem.deleteMany({ where: { bankMovementId: movement.id } });
    }
    if (movement.ledgerEntryId && snap) {
      // updateMany (not update) so a since-deleted entry doesn't throw and abort the unmatch.
      await tx.ledgerEntry.updateMany({
        where: { id: movement.ledgerEntryId, doctorId },
        data: restoreData(snap),
      });
    }
    return tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'unmatched',
        matchConfidence: null,
        ledgerEntryId: null,
        matchedAt: null,
        matchedBy: null,
        matchHistory: appendHistory(movement.matchHistory, audit),
      },
    });
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: updated });
}

async function handleIgnore(movement: any, doctorId: string) {
  const audit = buildAuditEntry('ignore', movement, doctorId);
  const updated = await prisma.bankMovement.update({
    where: { id: movement.id },
    data: {
      matchStatus: 'ignored',
      matchedAt: new Date(),
      matchedBy: doctorId,
      matchHistory: appendHistory(movement.matchHistory, audit),
    },
  });

  await updateStatementCounts(movement.bankStatementId);

  return NextResponse.json({ data: updated });
}

async function handleCreateEntry(
  movement: any,
  doctorId: string,
  body: any,
  statementId: number
) {
  const { entryType, area, subarea, concept, saveRule } = body;

  if (!entryType || !area) {
    return NextResponse.json({ error: 'entryType y area son requeridos' }, { status: 400 });
  }

  // Fetch statement for bank account info
  const stmt = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    select: { bankName: true, accountNumber: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const { generateLedgerInternalId } = await import('@/lib/practice-utils');
    const internalId = await generateLedgerInternalId(doctorId, entryType, tx);

    // Create the LedgerEntry with bank metadata
    const entry = await tx.ledgerEntry.create({
      data: {
        doctorId,
        internalId,
        entryType,
        area,
        subarea: subarea || null,
        concept: concept || movement.description,
        amount: movement.amount,
        transactionDate: movement.transactionDate,
        formaDePago: 'transferencia',
        transactionType: 'N/A',
        amountPaid: movement.amount,
        paymentStatus: 'PAID',
        origin: 'banco',
        hasComprobante: true,
        bankAccount: stmt ? `${stmt.bankName} ${stmt.accountNumber}` : null,
        bankMovementId: movement.reference || null,
      },
    });

    // Link movement to new entry
    const audit = buildAuditEntry('create_entry', movement, doctorId);
    const updated = await tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'matched_confirmed',
        matchConfidence: 1.0,
        ledgerEntryId: entry.id,
        matchedAt: new Date(),
        matchedBy: doctorId,
        matchHistory: appendHistory(movement.matchHistory, audit),
        suggestedArea: area,
        suggestedSubarea: subarea || null,
        suggestedConcept: concept || null,
      },
    });

    // Optionally save as learned categorization rule
    if (saveRule && movement.description) {
      const pattern = extractPattern(movement.description);
      const existing = await tx.bankCategorizationRule.findFirst({
        where: {
          doctorId,
          pattern,
          movementType: movement.movementType,
        },
      });

      if (existing) {
        await tx.bankCategorizationRule.update({
          where: { id: existing.id },
          data: {
            entryType,
            area,
            subarea: subarea || null,
            concept: concept || null,
            timesUsed: { increment: 1 },
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.bankCategorizationRule.create({
          data: {
            doctorId,
            pattern,
            patternType: 'contains',
            movementType: movement.movementType,
            entryType,
            area,
            subarea: subarea || null,
            concept: concept || null,
          },
        });
      }
    }

    return { entry, movement: updated };
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: result }, { status: 201 });
}

async function handleLinkExisting(
  movement: any,
  doctorId: string,
  body: any,
  statementId: number
) {
  const { ledgerEntryId } = body;

  if (!ledgerEntryId || typeof ledgerEntryId !== 'number') {
    return NextResponse.json({ error: 'ledgerEntryId es requerido' }, { status: 400 });
  }

  // Already linked to the same entry — return success (idempotent)
  if (movement.ledgerEntryId === ledgerEntryId) {
    return NextResponse.json({ data: movement });
  }

  // Verify the movement is not already linked to a different entry
  if (movement.ledgerEntryId) {
    return NextResponse.json(
      { error: 'Este movimiento bancario ya está vinculado a otro movimiento' },
      { status: 409 }
    );
  }

  // Verify the ledger entry exists and belongs to this doctor
  const entry = await prisma.ledgerEntry.findFirst({
    where: { id: ledgerEntryId, doctorId },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Movimiento de ledger no encontrado' }, { status: 404 });
  }

  // Check if this entry is already linked to another bank movement
  const alreadyLinked = await prisma.bankMovement.findFirst({
    where: { ledgerEntryId, id: { not: movement.id } },
    select: { id: true },
  });

  if (alreadyLinked) {
    return NextResponse.json(
      { error: 'Este movimiento de ledger ya está vinculado a otro movimiento bancario' },
      { status: 409 }
    );
  }

  // Fetch statement for bank account info
  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    select: { bankName: true, accountNumber: true },
  });

  const audit: any = buildAuditEntry('link_existing', movement, doctorId);
  audit.prevLedger = snapshotEvidence(entry); // for reversible unmatch

  const result = await prisma.$transaction(async (tx) => {
    // Link bank movement to existing entry
    const updated = await tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'matched_confirmed',
        matchConfidence: 1.0,
        ledgerEntryId,
        matchedAt: new Date(),
        matchedBy: doctorId,
        matchHistory: appendHistory(movement.matchHistory, audit),
      },
    });

    // Enrich the ledger entry with bank evidence
    const enrichData: any = {
      hasComprobante: true,
      needsReview: false,
    };

    // Set bank account info if not already set
    if (!entry.bankAccount && statement) {
      enrichData.bankAccount = `${statement.bankName} ${statement.accountNumber}`;
    }

    // Set bank reference if not already set
    if (!entry.bankMovementId && movement.reference) {
      enrichData.bankMovementId = movement.reference;
    }

    // Confirm payment — bank evidence proves money moved
    if (entry.paymentStatus !== 'PAID') {
      enrichData.paymentStatus = 'PAID';
      enrichData.amountPaid = entry.amount;
    }

    await tx.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: enrichData,
    });

    return updated;
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: result });
}

// Sanity cap on the implied commission of a settlement (gross sum vs net deposit).
const MAX_SETTLEMENT_FEE_PCT = 0.08;

/**
 * Settle ONE bank deposit against MANY ledger entries (e.g. a card-processor payout or a batched
 * cash deposit). The deposit may land net of a commission, so the sum of the entries' gross
 * amounts can exceed the deposit amount; the difference is the implied commission, which can
 * optionally be recorded as an egreso.
 */
async function handleLinkSettlement(
  movement: any,
  doctorId: string,
  body: any,
  statementId: number,
) {
  const { ledgerEntryIds, commission } = body as {
    ledgerEntryIds: unknown;
    commission?: { area?: string; subarea?: string; concept?: string };
  };

  if (!Array.isArray(ledgerEntryIds) || ledgerEntryIds.length === 0
      || !ledgerEntryIds.every((x) => typeof x === 'number')) {
    return NextResponse.json({ error: 'ledgerEntryIds debe ser una lista de IDs' }, { status: 400 });
  }
  const ids = ledgerEntryIds as number[];

  // Movement must be free (not 1:1-linked, not already settled)
  if (movement.ledgerEntryId) {
    return NextResponse.json({ error: 'Este movimiento ya está vinculado' }, { status: 409 });
  }
  const existingSettlement = await prisma.bankSettlementItem.count({
    where: { bankMovementId: movement.id },
  });
  if (existingSettlement > 0) {
    return NextResponse.json({ error: 'Este movimiento ya está conciliado como grupo' }, { status: 409 });
  }

  // Fetch + validate the candidate entries
  const entries = await prisma.ledgerEntry.findMany({
    where: { id: { in: ids }, doctorId },
    include: {
      bankMovement: { select: { id: true } },
      settlementItem: { select: { id: true } },
    },
  });
  if (entries.length !== ids.length) {
    return NextResponse.json({ error: 'Algunos movimientos no se encontraron' }, { status: 404 });
  }
  const expectedType = movement.movementType === 'deposit' ? 'ingreso' : 'egreso';
  for (const e of entries) {
    if (e.entryType !== expectedType) {
      return NextResponse.json({ error: 'Todos los movimientos deben ser del mismo tipo que el depósito' }, { status: 400 });
    }
    if (e.bankMovement || e.settlementItem) {
      return NextResponse.json({ error: 'Uno de los movimientos ya está conciliado' }, { status: 409 });
    }
  }

  const deposit = Number(movement.amount);
  const grossSum = entries.reduce((s, e) => s + Number(e.amount), 0);
  const commissionAmt = Math.round((grossSum - deposit) * 100) / 100;

  // The deposit cannot exceed the gross it supposedly settles (beyond rounding).
  if (deposit - grossSum > 0.01) {
    return NextResponse.json({ error: 'La suma de los movimientos es menor al depósito' }, { status: 400 });
  }
  // The implied commission must be plausible.
  if (commissionAmt > grossSum * MAX_SETTLEMENT_FEE_PCT + 0.01) {
    return NextResponse.json({ error: 'La diferencia entre la suma y el depósito es demasiado grande' }, { status: 400 });
  }

  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    select: { bankName: true, accountNumber: true },
  });
  const bankAccountLabel = statement ? `${statement.bankName} ${statement.accountNumber}` : null;

  const audit = buildAuditEntry('link_settlement', movement, doctorId);

  const result = await prisma.$transaction(async (tx) => {
    // Allocate each entry to this deposit + enrich with bank evidence
    for (const e of entries) {
      await tx.bankSettlementItem.create({
        data: { bankMovementId: movement.id, ledgerEntryId: e.id, doctorId },
      });
      const enrich: any = { hasComprobante: true, needsReview: false };
      if (!e.bankAccount && bankAccountLabel) enrich.bankAccount = bankAccountLabel;
      if (e.paymentStatus !== 'PAID') {
        enrich.paymentStatus = 'PAID';
        enrich.amountPaid = e.amount;
      }
      await tx.ledgerEntry.update({ where: { id: e.id }, data: enrich });
    }

    // Optionally record the implied commission as an egreso
    let commissionEntryId: number | null = null;
    if (commission && commission.area && commissionAmt > 0.01) {
      const { generateLedgerInternalId } = await import('@/lib/practice-utils');
      const internalId = await generateLedgerInternalId(doctorId, 'egreso', tx);
      const ce = await tx.ledgerEntry.create({
        data: {
          doctorId,
          internalId,
          entryType: 'egreso',
          area: commission.area,
          subarea: commission.subarea || null,
          concept: commission.concept || 'Comisión bancaria / terminal',
          amount: commissionAmt,
          transactionDate: movement.transactionDate,
          formaDePago: 'tarjeta',
          transactionType: 'N/A',
          amountPaid: commissionAmt,
          paymentStatus: 'PAID',
          // Distinct origin: this egreso is the netted commission of a deposit, not a standalone
          // bank line. Excluded from bank-match candidate pools so it can't be falsely matched later.
          origin: 'comision',
          hasComprobante: true,
          bankAccount: bankAccountLabel,
        },
      });
      commissionEntryId = ce.id;
    }

    const updated = await tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'matched_confirmed',
        matchConfidence: 1.0,
        matchedAt: new Date(),
        matchedBy: doctorId,
        matchHistory: appendHistory(movement.matchHistory, {
          ...audit,
          settledCount: entries.length,
          grossSum,
          commission: commissionAmt,
          // Per-entry pre-enrich snapshots for reversible unlink (§7/EXP-F13).
          prevLedgerById: Object.fromEntries(entries.map((e) => [e.id, snapshotEvidence(e)])),
        }),
      },
    });

    return { movement: updated, settledCount: entries.length, commission: commissionAmt, commissionEntryId };
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: result }, { status: 201 });
}

/** Remove a settlement: delete all allocations and return the deposit to unmatched. */
async function handleUnlinkSettlement(movement: any, statementId: number, doctorId: string) {
  const count = await prisma.bankSettlementItem.count({ where: { bankMovementId: movement.id } });
  if (count === 0) {
    return NextResponse.json({ error: 'Este movimiento no es una conciliación grupal' }, { status: 400 });
  }

  const audit = buildAuditEntry('unlink_settlement', movement, doctorId);
  // Restore each settled entry to its pre-enrich state so unlink is reversible (§7/EXP-F13).
  const snapMap = findLastSnapshotMap(movement.matchHistory);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.bankSettlementItem.deleteMany({ where: { bankMovementId: movement.id } });
    if (snapMap) {
      for (const [idStr, snap] of Object.entries(snapMap)) {
        await tx.ledgerEntry.updateMany({
          where: { id: Number(idStr), doctorId },
          data: restoreData(snap),
        });
      }
    }
    return tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'unmatched',
        matchConfidence: null,
        matchedAt: null,
        matchedBy: null,
        matchHistory: appendHistory(movement.matchHistory, audit),
      },
    });
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: updated });
}

async function handleUpdateCategory(movement: any, doctorId: string, body: any) {
  const { area, subarea, concept } = body;

  if (!area) {
    return NextResponse.json({ error: 'area es requerido' }, { status: 400 });
  }

  const updated = await prisma.bankMovement.update({
    where: { id: movement.id },
    data: {
      suggestedArea: area,
      suggestedSubarea: subarea || null,
      suggestedConcept: concept || null,
    },
  });

  return NextResponse.json({ data: updated });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPattern(description: string): string {
  // Extract a reusable pattern from description:
  // Remove numbers, dates, and reference codes to keep the "essence"
  return description
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // dates
    .replace(/\b\d{6,}\b/g, '')              // long numbers (refs)
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100)
    .toLowerCase();
}

async function updateStatementCounts(statementId: number) {
  const counts = await prisma.bankMovement.groupBy({
    by: ['matchStatus'],
    where: { bankStatementId: statementId },
    _count: true,
  });

  let matchedCount = 0;
  let newCount = 0;
  for (const c of counts) {
    if (c.matchStatus === 'matched_auto' || c.matchStatus === 'matched_confirmed') {
      matchedCount += c._count;
    } else if (c.matchStatus === 'unmatched') {
      newCount += c._count;
    }
  }

  await prisma.bankStatement.update({
    where: { id: statementId },
    data: { matchedCount, newCount },
  });
}
