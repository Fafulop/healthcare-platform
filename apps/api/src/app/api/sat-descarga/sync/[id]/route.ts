import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/sync/[id] — Get status of a specific sync job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { id } = await params;
    const jobId = parseInt(id, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const job = await prisma.satSyncJob.findFirst({
      where: { id: jobId, doctorId: doctor.id },
      select: {
        id: true,
        status: true,
        requestId: true,
        requestType: true,
        direction: true,
        dateFrom: true,
        dateTo: true,
        cfdiCount: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Sincronización no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: job });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error getting SAT sync job:', error);
    return NextResponse.json({ error: 'Error al obtener sincronización' }, { status: 500 });
  }
}
