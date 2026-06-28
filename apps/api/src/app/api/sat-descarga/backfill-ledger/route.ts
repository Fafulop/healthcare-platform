import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { autoRegisterCfdisToLedger } from '@/lib/sat-auto-register';

// In-memory lock per doctor to prevent concurrent backfill runs
const activeBackfills = new Set<string>();

// POST /api/sat-descarga/backfill-ledger
// One-time backfill: auto-register ALL unlinked CFDIs for the doctor
// No syncJobId filter — processes everything
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    if (activeBackfills.has(doctor.id)) {
      return NextResponse.json(
        { error: 'Ya hay un backfill en proceso para este doctor' },
        { status: 429 },
      );
    }

    activeBackfills.add(doctor.id);
    try {
      const result = await autoRegisterCfdisToLedger(doctor.id);

      return NextResponse.json({
        data: {
          autoLinked: result.autoLinked,
          autoLinkedNeedsReview: result.autoLinkedNeedsReview,
          created: result.created,
          enriched: result.enriched,
          skipped: result.skipped,
          total: result.results.length,
        },
        message: `Backfill completado: ${result.created} creados, ${result.autoLinked} vinculados, ${result.autoLinkedNeedsReview} para revisión, ${result.enriched} enriquecidos, ${result.skipped} ya registrados`,
      });
    } finally {
      activeBackfills.delete(doctor.id);
    }
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error in backfill-ledger:', error);
    return NextResponse.json({ error: 'Error al ejecutar backfill', details: error.message }, { status: 500 });
  }
}
