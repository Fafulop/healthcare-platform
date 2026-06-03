import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/practice-management/ledger/:id/cfdi-suggestions
// Find unlinked SAT CFDIs that match this ledger entry by amount, date, and direction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const resolvedParams = await params;
    const entryId = parseInt(resolvedParams.id);

    if (isNaN(entryId)) {
      return NextResponse.json({ error: 'ID de entrada inválido' }, { status: 400 });
    }

    const entry = await prisma.ledgerEntry.findFirst({
      where: { id: entryId, doctorId: doctor.id },
      include: {
        client: { select: { rfc: true } },
        supplier: { select: { rfc: true } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    // Already has a linked CFDI
    if (entry.satCfdiUuid) {
      return NextResponse.json({ data: [] });
    }

    const amount = Number(entry.amount);
    const entryDate = new Date(entry.transactionDate);
    const tolerance = amount * 0.01; // 1% tolerance
    const dayRange = 7;

    const dateFrom = new Date(entryDate);
    dateFrom.setDate(dateFrom.getDate() - dayRange);
    const dateTo = new Date(entryDate);
    dateTo.setDate(dateTo.getDate() + dayRange);

    // Determine expected CFDI direction+efecto based on entryType
    // ingreso: emitted+I (doctor sold) OR received+E (credit note received)
    // egreso: received+I (doctor bought) OR emitted+E (credit note emitted)
    const directionFilters =
      entry.entryType === 'ingreso'
        ? [
            { direction: 'emitted', efecto: 'I' },
            { direction: 'received', efecto: 'E' },
          ]
        : [
            { direction: 'received', efecto: { not: 'E' } },
            { direction: 'emitted', efecto: 'E' },
          ];

    // Get all UUIDs already linked to any ledger entry
    const linkedUuids = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        satCfdiUuid: { not: null },
      },
      select: { satCfdiUuid: true },
    });
    const linkedSet = new Set(linkedUuids.map((e) => e.satCfdiUuid));

    // Query matching CFDIs
    const candidates = await prisma.satCfdiMetadata.findMany({
      where: {
        doctorId: doctor.id,
        satStatus: 'Vigente',
        monto: { gte: amount - tolerance, lte: amount + tolerance },
        issuedAt: { gte: dateFrom, lte: dateTo },
        OR: directionFilters,
      },
      orderBy: { issuedAt: 'desc' },
      take: 20,
    });

    // Filter out already-linked and score
    const entryRfc = entry.entryType === 'ingreso'
      ? entry.client?.rfc
      : entry.supplier?.rfc;

    const suggestions = candidates
      .filter((c) => !linkedSet.has(c.uuid))
      .map((c) => {
        let score = 0;

        // Amount match scoring
        const amountDiff = Math.abs(Number(c.monto) - amount);
        if (amountDiff === 0) score += 40;
        else if (amountDiff < amount * 0.001) score += 30;
        else score += 20;

        // Date match scoring (gradual decay over 7-day window)
        const daysDiff = Math.abs(
          (new Date(c.issuedAt).getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff < 1) score += 30;
        else if (daysDiff <= 2) score += 25;
        else if (daysDiff <= 4) score += 15;
        else score += 8;

        // RFC match scoring
        const cfdiRfc = c.direction === 'received' ? c.issuerRfc : c.receiverRfc;
        if (entryRfc && cfdiRfc === entryRfc) score += 30;

        // Name/concept match scoring — counterpart name appears in entry concept
        const cfdiName = (c.direction === 'received' ? c.issuerName : c.receiverName)?.toLowerCase() || '';
        const entryConcept = (entry.concept || '').toLowerCase();
        if (cfdiName && entryConcept && (entryConcept.includes(cfdiName) || cfdiName.includes(entryConcept.split(' - ')[0].trim()))) {
          score += 20;
        }

        const confidence = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

        return {
          uuid: c.uuid,
          direction: c.direction,
          efecto: c.efecto,
          issuerRfc: c.issuerRfc,
          issuerName: c.issuerName,
          receiverRfc: c.receiverRfc,
          receiverName: c.receiverName,
          monto: c.monto,
          issuedAt: c.issuedAt,
          score,
          confidence,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ data: suggestions });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching CFDI suggestions:', error);
    return NextResponse.json({ error: 'Error al buscar sugerencias de CFDI' }, { status: 500 });
  }
}
