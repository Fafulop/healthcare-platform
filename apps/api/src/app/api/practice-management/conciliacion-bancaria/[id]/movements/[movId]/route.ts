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
    const dateFrom = new Date(movDate);
    dateFrom.setDate(dateFrom.getDate() - 5);
    const dateTo = new Date(movDate);
    dateTo.setDate(dateTo.getDate() + 5);

    const entryType = movement.movementType === 'deposit' ? 'ingreso' : 'egreso';

    // Find candidate entries not already linked to a bank movement
    const candidates = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        entryType,
        amount: { gte: amount - tolerance, lte: amount + tolerance },
        transactionDate: { gte: dateFrom, lte: dateTo },
        bankMovement: null, // not already linked to another bank movement
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

      const amountDiff = Math.abs(Number(c.amount) - amount);
      if (amountDiff === 0) score += 40;
      else if (amountDiff < amount * 0.005) score += 30;
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

// ─── Action Handlers ─────────────────────────────────────────────────────────

async function handleConfirmMatch(movement: any, doctorId: string) {
  if (!movement.ledgerEntryId) {
    return NextResponse.json({ error: 'Este movimiento no tiene un match asignado' }, { status: 400 });
  }

  const audit = buildAuditEntry('confirm_match', movement, doctorId);
  const updated = await prisma.bankMovement.update({
    where: { id: movement.id },
    data: {
      matchStatus: 'matched_confirmed',
      matchedAt: new Date(),
      matchedBy: doctorId,
      matchHistory: appendHistory(movement.matchHistory, audit),
    },
  });

  await updateStatementCounts(movement.bankStatementId);

  return NextResponse.json({ data: updated });
}

async function handleUnmatch(movement: any, statementId: number, doctorId: string) {
  if (!movement.ledgerEntryId) {
    return NextResponse.json({ error: 'Este movimiento no tiene un match' }, { status: 400 });
  }

  const audit = buildAuditEntry('unmatch', movement, doctorId);
  const updated = await prisma.bankMovement.update({
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

  const result = await prisma.$transaction(async (tx) => {
    const { generateLedgerInternalId } = await import('@/lib/practice-utils');
    const internalId = await generateLedgerInternalId(doctorId, entryType, tx);

    // Create the LedgerEntry
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
        hasComprobante: true, // the bank statement itself is the comprobante
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

  // Verify the movement is not already linked to a different entry
  if (movement.ledgerEntryId && movement.ledgerEntryId !== ledgerEntryId) {
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

  const audit = buildAuditEntry('link_existing', movement, doctorId);

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

    // Mark the ledger entry as having bank comprobante
    await tx.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: { hasComprobante: true },
    });

    return updated;
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: result });
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
