import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// PATCH /api/practice-management/conciliacion-bancaria/[id]/movements/[movId]
// Actions: confirm_match, ignore, create_entry, update_category, unmatch
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; movId: string } }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const statementId = parseInt(params.id);
    const movementId = parseInt(params.movId);

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
        return handleUnmatch(movement, statementId);

      case 'ignore':
        return handleIgnore(movement);

      case 'create_entry':
        return handleCreateEntry(movement, doctor.id, body, statementId);

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

// ─── Action Handlers ─────────────────────────────────────────────────────────

async function handleConfirmMatch(movement: any, doctorId: string) {
  if (!movement.ledgerEntryId) {
    return NextResponse.json({ error: 'Este movimiento no tiene un match asignado' }, { status: 400 });
  }

  const updated = await prisma.bankMovement.update({
    where: { id: movement.id },
    data: { matchStatus: 'matched_confirmed' },
  });

  await updateStatementCounts(movement.bankStatementId);

  return NextResponse.json({ data: updated });
}

async function handleUnmatch(movement: any, statementId: number) {
  if (!movement.ledgerEntryId) {
    return NextResponse.json({ error: 'Este movimiento no tiene un match' }, { status: 400 });
  }

  const updated = await prisma.bankMovement.update({
    where: { id: movement.id },
    data: {
      matchStatus: 'unmatched',
      matchConfidence: null,
      ledgerEntryId: null,
    },
  });

  await updateStatementCounts(statementId);

  return NextResponse.json({ data: updated });
}

async function handleIgnore(movement: any) {
  const updated = await prisma.bankMovement.update({
    where: { id: movement.id },
    data: { matchStatus: 'ignored' },
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
    // Create the LedgerEntry
    const entry = await tx.ledgerEntry.create({
      data: {
        doctorId,
        entryType,
        area,
        subarea: subarea || null,
        concept: concept || movement.description,
        amount: movement.amount,
        transactionDate: movement.transactionDate,
        origin: 'banco',
        hasComprobante: true, // the bank statement itself is the comprobante
      },
    });

    // Link movement to new entry
    const updated = await tx.bankMovement.update({
      where: { id: movement.id },
      data: {
        matchStatus: 'matched_confirmed',
        matchConfidence: 1.0,
        ledgerEntryId: entry.id,
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
