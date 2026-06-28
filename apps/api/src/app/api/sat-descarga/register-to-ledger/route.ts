import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { generateLedgerInternalId, getDefaultArea } from '@/lib/practice-utils';
import { scoreCfdiMatch, normalizeScore, resolveEntryType, mapFormaPago, resolvePaymentStatus } from '@/lib/sat-auto-register';

// POST /api/sat-descarga/register-to-ledger
// Register one or more SAT CFDIs as LedgerEntries
// Body: { uuids: string[], areaOverride?, subareaOverride? }
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const { uuids, areaOverride, subareaOverride, skipMatchUuids } = body;
    const skipMatchSet = new Set<string>(Array.isArray(skipMatchUuids) ? skipMatchUuids : []);

    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un UUID' }, { status: 400 });
    }

    if (uuids.length > 100) {
      return NextResponse.json({ error: 'Máximo 100 CFDIs por lote' }, { status: 400 });
    }

    // Fetch the CFDIs from SAT metadata
    const cfdis = await prisma.satCfdiMetadata.findMany({
      where: {
        doctorId: doctor.id,
        uuid: { in: uuids },
        satStatus: 'Vigente',
      },
    });

    if (cfdis.length === 0) {
      return NextResponse.json({ error: 'No se encontraron CFDIs vigentes con esos UUIDs' }, { status: 404 });
    }

    // Check which are already registered
    const existingEntries = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        satCfdiUuid: { in: cfdis.map((c) => c.uuid) },
      },
      select: { satCfdiUuid: true },
    });
    const alreadyRegistered = new Set(existingEntries.map((e) => e.satCfdiUuid));

    const toRegister = cfdis.filter((c) => !alreadyRegistered.has(c.uuid));

    if (toRegister.length === 0) {
      return NextResponse.json({
        data: { created: 0, skipped: cfdis.length },
        message: 'Todos los CFDIs seleccionados ya están registrados',
      });
    }

    // Fetch XML details for richer data (if available)
    const details = await prisma.satCfdiDetail.findMany({
      where: {
        doctorId: doctor.id,
        uuid: { in: toRegister.map((c) => c.uuid.toLowerCase()) },
      },
      include: { conceptos: true },
    });
    const detailMap = new Map(details.map((d) => [d.uuid.toLowerCase(), d]));

    // Create or link entries in transaction
    const results = await prisma.$transaction(async (tx) => {
      const entries: any[] = [];

      for (const cfdi of toRegister) {
        const detail = detailMap.get(cfdi.uuid.toLowerCase());
        const isReceived = cfdi.direction === 'received';
        const entryType = resolveEntryType(cfdi.direction, cfdi.efecto);

        // Use monto from SAT metadata (always correct) over detail.total
        const amount = Number(cfdi.monto) || (detail?.total ? Number(detail.total) : 0);
        const cfdiDate = new Date(cfdi.issuedAt);

        // --- Match-before-create: search for existing entries to suggest linking ---
        const tolerance = amount * 0.01;
        const dateFrom = new Date(cfdiDate);
        dateFrom.setDate(dateFrom.getDate() - 7);
        const dateTo = new Date(cfdiDate);
        dateTo.setDate(dateTo.getDate() + 7);

        const matchCandidates = await tx.ledgerEntry.findMany({
          where: {
            doctorId: doctor.id,
            satCfdiUuid: null,
            entryType,
            amount: { gte: amount - tolerance, lte: amount + tolerance },
            transactionDate: { gte: dateFrom, lte: dateTo },
          },
          include: {
            client: { select: { rfc: true } },
            supplier: { select: { rfc: true } },
          },
          take: 10,
        });

        // Score candidates using shared scoring function
        const scoredMatches: { entry: typeof matchCandidates[0]; score: number }[] = [];

        for (const candidate of matchCandidates) {
          const score = scoreCfdiMatch(candidate, cfdi);
          if (score >= 70) {
            scoredMatches.push({ entry: candidate, score });
          }
        }

        // If matches found, return as suggestions (don't auto-link)
        // User must confirm the link from the frontend
        // Skip if user explicitly chose "create new" for this CFDI
        const topMatches = scoredMatches
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (topMatches.length > 0 && !skipMatchSet.has(cfdi.uuid)) {
          entries.push({
            uuid: cfdi.uuid,
            entryType,
            amount,
            action: 'suggestion',
            suggestions: topMatches.map((m) => ({
              ledgerEntryId: m.entry.id,
              score: m.score,
              confidence: m.score >= 80 ? 'high' as const : 'medium' as const,
              concept: m.entry.concept,
              origin: m.entry.origin,
              amount: Number(m.entry.amount),
              transactionDate: m.entry.transactionDate,
            })),
          });
          continue;
        }

        // --- No match found: CREATE new entry (original behavior) ---

        // Build concept from XML details or metadata
        let concept = '';
        if (detail?.conceptos && detail.conceptos.length > 0) {
          const descriptions = detail.conceptos
            .map((c) => c.descripcion)
            .filter(Boolean)
            .slice(0, 3);
          concept = descriptions.join(', ');
          if (detail.conceptos.length > 3) concept += ` (+${detail.conceptos.length - 3} más)`;
        }
        if (!concept) {
          const counterpart = isReceived ? cfdi.issuerName : cfdi.receiverName;
          concept = `CFDI ${isReceived ? 'recibido de' : 'emitido a'} ${counterpart || (isReceived ? cfdi.issuerRfc : cfdi.receiverRfc)}`;
        }

        // Determine area from doctor's configured areas
        const areaType = entryType === 'ingreso' ? 'INGRESO' : 'EGRESO';
        let area = areaOverride || null;
        let subarea = subareaOverride || null;
        if (!area) {
          const defaultArea = await getDefaultArea(doctor.id, areaType, tx);
          area = defaultArea.area;
          subarea = subarea || defaultArea.subarea;
        } else if (!subarea) {
          const defaultArea = await getDefaultArea(doctor.id, areaType, tx);
          subarea = defaultArea.subarea;
        }

        // Forma de pago from XML detail (null → "—" when unknown, instead of mislabeling as transfer)
        const formaPago = mapFormaPago(detail?.formaPago);

        // Payment status: received → PENDING; emitted → PAID for PUE, PENDING for PPD (no money yet).
        const paymentStatus = resolvePaymentStatus(isReceived, detail?.metodoPago);
        const amountPaid = paymentStatus === 'PAID' ? amount : 0;

        const internalId = await generateLedgerInternalId(doctor.id, entryType);

        // Find or create supplier for received CFDIs (egresos)
        let supplierId: number | null = null;
        if (isReceived && entryType === 'egreso' && cfdi.issuerRfc) {
          const existing = await tx.proveedor.findFirst({
            where: { doctorId: doctor.id, rfc: cfdi.issuerRfc },
          });
          if (existing) {
            supplierId = existing.id;
          } else {
            const newSupplier = await tx.proveedor.create({
              data: {
                doctorId: doctor.id,
                businessName: cfdi.issuerName || cfdi.issuerRfc,
                rfc: cfdi.issuerRfc,
              },
            });
            supplierId = newSupplier.id;
          }
        }

        const entry = await tx.ledgerEntry.create({
          data: {
            doctorId: doctor.id,
            amount,
            concept: concept.substring(0, 500),
            entryType,
            transactionDate: cfdiDate,
            internalId,
            formaDePago: formaPago,
            area,
            subarea,
            origin: isReceived ? 'sat_recibido' : 'sat_emitido',
            hasFactura: true,
            satCfdiUuid: cfdi.uuid,
            transactionType: 'N/A',
            amountPaid,
            paymentStatus,
            ...(supplierId ? { supplierId } : {}),
          },
        });

        entries.push({ uuid: cfdi.uuid, ledgerEntryId: entry.id, entryType, amount, action: 'created' });
      }

      return entries;
    });

    const suggestions = results.filter((r) => r.action === 'suggestion');
    const created = results.filter((r) => r.action === 'created');

    return NextResponse.json({
      data: {
        created: created.length,
        suggestions: suggestions.length,
        skipped: cfdis.length - toRegister.length,
        entries: results,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Uno o más CFDIs ya están registrados' }, { status: 409 });
    }
    console.error('Error registering SAT CFDIs to ledger:', error);
    return NextResponse.json({ error: 'Error al registrar CFDIs', details: error.message }, { status: 500 });
  }
}

// GET /api/sat-descarga/register-to-ledger?uuids=uuid1,uuid2
// Check which UUIDs are already registered
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);
    const uuidsParam = searchParams.get('uuids');

    if (!uuidsParam) {
      return NextResponse.json({ error: 'Se requiere parámetro uuids' }, { status: 400 });
    }

    const uuids = uuidsParam.split(',').map((u) => u.trim()).filter(Boolean);

    const registered = await prisma.ledgerEntry.findMany({
      where: {
        doctorId: doctor.id,
        satCfdiUuid: { in: uuids },
      },
      select: { satCfdiUuid: true, id: true },
    });

    const registeredMap: Record<string, number> = {};
    for (const r of registered) {
      if (r.satCfdiUuid) registeredMap[r.satCfdiUuid] = r.id;
    }

    return NextResponse.json({ data: registeredMap });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error checking registered CFDIs:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
