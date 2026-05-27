import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/sat-descarga/received-reconciliation?month=2026-05
// Cross-reference received CFDIs from SAT against egreso ledger entries
// Matching: by UUID (already registered) or by amount + RFC + date proximity (unlinked)
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    // Build date range filter
    let dateFilter: any = {};
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59);
      dateFilter = { gte: start, lte: end };
    }

    // 1. Get all received CFDIs from SAT (vigente only)
    const satWhere: any = {
      doctorId: doctor.id,
      direction: 'received',
      satStatus: 'Vigente',
    };
    if (month) satWhere.issuedAt = dateFilter;

    const satReceived = await prisma.satCfdiMetadata.findMany({
      where: satWhere,
      select: {
        uuid: true,
        issuerRfc: true,
        issuerName: true,
        monto: true,
        issuedAt: true,
        efecto: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    // 2. Get egreso ledger entries that have satCfdiUuid (already registered from SAT)
    // Normalize to uppercase for case-insensitive matching (SAT metadata stores uppercase UUIDs)
    const registeredUuids = new Set(
      (await prisma.ledgerEntry.findMany({
        where: {
          doctorId: doctor.id,
          satCfdiUuid: { not: null },
        },
        select: { satCfdiUuid: true },
      })).map((e) => e.satCfdiUuid!.toUpperCase())
    );

    // 3. Get egreso ledger entries WITHOUT satCfdiUuid (candidates for matching)
    const egresoWhere: any = {
      doctorId: doctor.id,
      entryType: 'egreso',
      satCfdiUuid: null,
    };
    if (month) egresoWhere.transactionDate = dateFilter;

    const unmatchedEgresos = await prisma.ledgerEntry.findMany({
      where: egresoWhere,
      select: {
        id: true,
        amount: true,
        concept: true,
        transactionDate: true,
        origin: true,
        supplierId: true,
        supplier: { select: { rfc: true, businessName: true } },
        hasFactura: true,
        formaDePago: true,
      },
      orderBy: { transactionDate: 'desc' },
    });

    // 4. Classify each received CFDI
    const registered: any[] = [];
    const suggestedMatches: any[] = [];
    const unregistered: any[] = [];

    for (const cfdi of satReceived) {
      // Already registered via register-to-ledger?
      if (registeredUuids.has(cfdi.uuid.toUpperCase())) {
        registered.push({
          uuid: cfdi.uuid,
          issuerRfc: cfdi.issuerRfc,
          issuerName: cfdi.issuerName,
          monto: cfdi.monto,
          issuedAt: cfdi.issuedAt,
          efecto: cfdi.efecto,
          status: 'registered',
        });
        continue;
      }

      // Try to find a matching unlinked egreso by amount + RFC + date
      const match = findBestMatch(cfdi, unmatchedEgresos);
      if (match) {
        suggestedMatches.push({
          uuid: cfdi.uuid,
          issuerRfc: cfdi.issuerRfc,
          issuerName: cfdi.issuerName,
          monto: cfdi.monto,
          issuedAt: cfdi.issuedAt,
          efecto: cfdi.efecto,
          status: 'suggested_match',
          suggestedLedgerEntry: {
            id: match.entry.id,
            amount: match.entry.amount,
            concept: match.entry.concept,
            transactionDate: match.entry.transactionDate,
            origin: match.entry.origin,
            supplierName: match.entry.supplier?.businessName,
          },
          matchConfidence: match.confidence,
          matchReason: match.reason,
        });
      } else {
        unregistered.push({
          uuid: cfdi.uuid,
          issuerRfc: cfdi.issuerRfc,
          issuerName: cfdi.issuerName,
          monto: cfdi.monto,
          issuedAt: cfdi.issuedAt,
          efecto: cfdi.efecto,
          status: 'unregistered',
        });
      }
    }

    return NextResponse.json({
      data: {
        registered,
        suggestedMatches,
        unregistered,
      },
      summary: {
        totalReceived: satReceived.length,
        registered: registered.length,
        suggestedMatches: suggestedMatches.length,
        unregistered: unregistered.length,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error in received CFDI reconciliation:', error);
    return NextResponse.json({ error: 'Error en reconciliación de recibidos' }, { status: 500 });
  }
}

// POST /api/sat-descarga/received-reconciliation
// Link a received CFDI to an existing ledger entry
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();
    const { uuid, ledgerEntryId } = body;

    const trimmedUuid = typeof uuid === 'string' ? uuid.trim() : '';
    if (!trimmedUuid || !ledgerEntryId) {
      return NextResponse.json({ error: 'uuid y ledgerEntryId son requeridos' }, { status: 400 });
    }

    // Verify the CFDI belongs to this doctor
    const cfdi = await prisma.satCfdiMetadata.findFirst({
      where: { doctorId: doctor.id, uuid: trimmedUuid, direction: 'received' },
    });
    if (!cfdi) {
      return NextResponse.json({ error: 'CFDI no encontrado' }, { status: 404 });
    }

    // Verify the ledger entry belongs to this doctor, is an egreso, and has no CFDI linked
    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: ledgerEntryId, doctorId: doctor.id },
    });
    if (!entry) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }
    if (entry.entryType !== 'egreso') {
      return NextResponse.json({ error: 'Solo se pueden vincular CFDIs recibidos a egresos' }, { status: 400 });
    }
    if (entry.satCfdiUuid) {
      return NextResponse.json({ error: 'Este movimiento ya tiene un CFDI vinculado' }, { status: 400 });
    }

    // Link them
    const updated = await prisma.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: {
        satCfdiUuid: trimmedUuid,
        hasFactura: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error linking received CFDI:', error);
    return NextResponse.json({ error: 'Error al vincular CFDI' }, { status: 500 });
  }
}

// ─── Matching Logic ────────────────────────────────────────────────────────

interface MatchResult {
  entry: any;
  confidence: number;
  reason: string;
}

function findBestMatch(
  cfdi: { monto: any; issuerRfc: string; issuedAt: Date },
  candidates: any[]
): MatchResult | null {
  const cfdiAmount = Number(cfdi.monto);
  let bestMatch: MatchResult | null = null;

  for (const entry of candidates) {
    const entryAmount = Number(entry.amount);
    const amountMatch = Math.abs(cfdiAmount - entryAmount) < 0.01;
    if (!amountMatch) continue;

    // Amount matches — now check RFC and date proximity
    const rfcMatch = entry.supplier?.rfc === cfdi.issuerRfc;
    const daysDiff = Math.abs(
      (new Date(cfdi.issuedAt).getTime() - new Date(entry.transactionDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    let confidence = 0;
    const reasons: string[] = ['monto exacto'];

    if (rfcMatch && daysDiff <= 1) {
      confidence = 0.95;
      reasons.push('RFC coincide', 'misma fecha');
    } else if (rfcMatch && daysDiff <= 7) {
      confidence = 0.85;
      reasons.push('RFC coincide', `±${Math.round(daysDiff)} días`);
    } else if (rfcMatch) {
      confidence = 0.70;
      reasons.push('RFC coincide', `±${Math.round(daysDiff)} días`);
    } else if (daysDiff <= 1) {
      confidence = 0.60;
      reasons.push('misma fecha', 'RFC no verificado');
    } else if (daysDiff <= 7) {
      confidence = 0.50;
      reasons.push(`±${Math.round(daysDiff)} días`, 'RFC no verificado');
    } else {
      // Amount matches but date too far and no RFC match — skip
      continue;
    }

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = { entry, confidence, reason: reasons.join(', ') };
    }
  }

  return bestMatch;
}
