import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { parseBankStatementCSV, type SupportedBank } from '@/lib/bank-statement-parser';
import { categorizeMovement } from '@/lib/bank-categorization';
import { matchMovements } from '@/lib/bank-matching';

// GET /api/practice-management/conciliacion-bancaria
// List all bank statements for the authenticated doctor
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const statements = await prisma.bankStatement.findMany({
      where: { doctorId: doctor.id },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: {
        _count: { select: { movements: true } },
      },
    });

    return NextResponse.json({ data: statements });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching bank statements:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/practice-management/conciliacion-bancaria
// Upload and process a bank statement (CSV or pre-parsed PDF movements), then auto-match and categorize
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const { csvContent, movements: preParseMovements, fileName, fileUrl, bank, accountNumber, periodMonth, periodYear } = body;

    // Must have either CSV content or pre-parsed movements (from PDF)
    if (!csvContent && !preParseMovements) {
      return NextResponse.json({ error: 'Se requiere contenido CSV o movimientos pre-procesados' }, { status: 400 });
    }
    if (!fileName || !fileUrl) {
      return NextResponse.json({ error: 'Nombre y URL del archivo requeridos' }, { status: 400 });
    }
    if (!bank || !['bbva', 'banorte', 'hsbc', 'santander', 'scotiabank', 'otro'].includes(bank)) {
      return NextResponse.json({ error: 'Banco no soportado' }, { status: 400 });
    }
    if (!accountNumber || !periodMonth || !periodYear) {
      return NextResponse.json({ error: 'Número de cuenta, mes y año requeridos' }, { status: 400 });
    }
    if (periodMonth < 1 || periodMonth > 12 || periodYear < 2020 || periodYear > 2030) {
      return NextResponse.json({ error: 'Periodo inválido' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.bankStatement.findUnique({
      where: {
        doctorId_bankName_accountNumber_periodMonth_periodYear: {
          doctorId: doctor.id,
          bankName: bank,
          accountNumber: accountNumber.trim(),
          periodMonth: parseInt(periodMonth),
          periodYear: parseInt(periodYear),
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un estado de cuenta para este banco, cuenta y periodo' },
        { status: 409 }
      );
    }

    // Parse CSV or use pre-parsed movements from PDF
    let parseResult;
    if (csvContent) {
      try {
        parseResult = parseBankStatementCSV(csvContent, bank as SupportedBank);
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } else {
      // Pre-parsed movements from PDF (GPT-4o)
      const movements = (preParseMovements as any[]).map(m => ({
        transactionDate: m.transactionDate,
        description: m.concept || m.description || '',
        reference: m.reference || '',
        amount: Number(m.amount) || 0,
        movementType: m.movementType === 'deposit' || m.entryType === 'ingreso' ? 'deposit' : 'withdrawal',
        balance: m.balance != null ? Number(m.balance) : null,
      }));
      const totalDeposits = movements.filter(m => m.movementType === 'deposit').reduce((s, m) => s + m.amount, 0);
      const totalWithdrawals = movements.filter(m => m.movementType === 'withdrawal').reduce((s, m) => s + m.amount, 0);
      parseResult = {
        movements,
        totalDeposits,
        totalWithdrawals,
        endingBalance: null as number | null,
      };
    }

    // Fetch doctor's learned categorization rules
    const learnedRules = await prisma.bankCategorizationRule.findMany({
      where: { doctorId: doctor.id },
      orderBy: { timesUsed: 'desc' },
    });

    // Fetch existing ledger entries for matching (last 90 days around the statement period)
    const periodStart = new Date(parseInt(periodYear), parseInt(periodMonth) - 1, 1);
    const periodEnd = new Date(parseInt(periodYear), parseInt(periodMonth), 0); // last day of month
    const matchStart = new Date(periodStart);
    matchStart.setDate(matchStart.getDate() - 7);
    const matchEnd = new Date(periodEnd);
    matchEnd.setDate(matchEnd.getDate() + 7);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        transactionDate: { gte: matchStart, lte: matchEnd },
      },
      select: {
        id: true,
        amount: true,
        transactionDate: true,
        entryType: true,
        concept: true,
        bankMovementId: true,
      },
    });

    // Run matching
    const matchResults = matchMovements(
      parseResult.movements.map(m => ({
        transactionDate: m.transactionDate,
        description: m.description,
        reference: m.reference,
        amount: m.amount,
        movementType: m.movementType,
      })),
      ledgerEntries,
    );

    // Create statement + movements in a transaction
    const statement = await prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          doctorId: doctor.id,
          fileName,
          fileUrl,
          fileType: csvContent ? 'csv' : 'pdf',
          bankName: bank,
          accountNumber: accountNumber.trim(),
          periodMonth: parseInt(periodMonth),
          periodYear: parseInt(periodYear),
          totalDeposits: parseResult.totalDeposits,
          totalWithdrawals: parseResult.totalWithdrawals,
          endingBalance: parseResult.endingBalance,
          status: 'processed',
          movementCount: parseResult.movements.length,
        },
      });

      // Create movements with match + categorization results
      let matchedCount = 0;
      let newCount = 0;

      for (let i = 0; i < parseResult.movements.length; i++) {
        const m = parseResult.movements[i];
        const matchResult = matchResults[i];

        let matchStatus = 'unmatched';
        let matchConfidence: number | null = null;
        let ledgerEntryId: number | null = null;
        let suggestedArea: string | null = null;
        let suggestedSubarea: string | null = null;
        let suggestedConcept: string | null = null;

        if (matchResult.match) {
          matchStatus = 'matched_auto';
          matchConfidence = matchResult.match.confidence;
          ledgerEntryId = matchResult.match.ledgerEntryId;
          matchedCount++;
        } else {
          // Try categorization for unmatched
          const suggestion = categorizeMovement(m.description, m.movementType as 'deposit' | 'withdrawal', learnedRules);
          if (suggestion) {
            suggestedArea = suggestion.area;
            suggestedSubarea = suggestion.subarea;
            suggestedConcept = suggestion.concept;
          }
          newCount++;
        }

        await tx.bankMovement.create({
          data: {
            bankStatementId: stmt.id,
            transactionDate: new Date(m.transactionDate + 'T12:00:00'),
            description: m.description,
            reference: m.reference,
            amount: m.amount,
            movementType: m.movementType,
            balance: m.balance,
            matchStatus,
            matchConfidence,
            ledgerEntryId,
            suggestedArea,
            suggestedSubarea,
            suggestedConcept,
            // Audit trail for auto-matched movements
            ...(matchResult.match ? {
              matchedAt: new Date(),
              matchedBy: doctor.id,
              matchHistory: [{ action: 'matched_auto', at: new Date().toISOString(), by: 'system', confidence: matchResult.match.confidence }],
            } : {}),
          },
        });
      }

      // Update counts
      await tx.bankStatement.update({
        where: { id: stmt.id },
        data: { matchedCount, newCount },
      });

      return { ...stmt, matchedCount, newCount };
    });

    return NextResponse.json({
      data: statement,
      summary: {
        totalMovements: parseResult.movements.length,
        matched: statement.matchedCount,
        new: statement.newCount,
        totalDeposits: parseResult.totalDeposits,
        totalWithdrawals: parseResult.totalWithdrawals,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un estado de cuenta para este periodo' }, { status: 409 });
    }
    console.error('Error uploading bank statement:', error);
    return NextResponse.json({ error: 'Error al procesar estado de cuenta', details: error.message }, { status: 500 });
  }
}
