import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { autoRegisterCfdisToLedger } from '@/lib/sat-auto-register';

// POST /api/sat-descarga/backfill-ledger
// One-time backfill: auto-register ALL unlinked CFDIs for the doctor
// No syncJobId filter — processes everything
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const result = await autoRegisterCfdisToLedger(doctor.id);

    return NextResponse.json({
      data: {
        autoLinked: result.autoLinked,
        autoLinkedNeedsReview: result.autoLinkedNeedsReview,
        created: result.created,
        skipped: result.skipped,
        total: result.results.length,
      },
      message: `Backfill completado: ${result.created} creados, ${result.autoLinked} vinculados, ${result.autoLinkedNeedsReview} para revisión, ${result.skipped} ya registrados`,
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error in backfill-ledger:', error);
    return NextResponse.json({ error: 'Error al ejecutar backfill', details: error.message }, { status: 500 });
  }
}
