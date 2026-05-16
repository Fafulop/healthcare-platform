import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * POST /api/sat-descarga/sync — Create a new SAT sync job
 *
 * Body: { direction: 'emitted' | 'received', month: 'YYYY-MM' }
 *
 * Creates a pending job in sat_sync_jobs. The background worker picks it up.
 */
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Primero debes configurar tu perfil fiscal' },
        { status: 400 }
      );
    }

    if (!profile.fielUploaded) {
      return NextResponse.json(
        { error: 'Primero debes cargar tu e.Firma para consultar el SAT' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { direction, month } = body;

    if (!direction || !['emitted', 'received'].includes(direction)) {
      return NextResponse.json(
        { error: 'direction debe ser "emitted" o "received"' },
        { status: 400 }
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month debe ser formato YYYY-MM' },
        { status: 400 }
      );
    }

    // Calculate date range from month (use UTC to avoid timezone shifts)
    const [year, monthNum] = month.split('-').map(Number);
    const dateFrom = new Date(Date.UTC(year, monthNum - 1, 1));
    const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const dateTo = new Date(Date.UTC(year, monthNum - 1, lastDay));

    // Check for duplicate active job
    const existingJob = await prisma.satSyncJob.findFirst({
      where: {
        doctorId: doctor.id,
        direction,
        dateFrom,
        dateTo,
        status: { in: ['pending', 'authenticating', 'requesting', 'polling', 'downloading', 'parsing'] },
      },
    });

    if (existingJob) {
      return NextResponse.json(
        { error: 'Ya existe una sincronización activa para este periodo y dirección', data: existingJob },
        { status: 409 }
      );
    }

    const job = await prisma.satSyncJob.create({
      data: {
        doctorId: doctor.id,
        fiscalProfileId: profile.id,
        requestType: 'metadata',
        direction,
        dateFrom,
        dateTo,
      },
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating SAT sync job:', error);
    return NextResponse.json({ error: 'Error al crear sincronización' }, { status: 500 });
  }
}

/**
 * GET /api/sat-descarga/sync — List sync jobs for current doctor
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const jobs = await prisma.satSyncJob.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        requestType: true,
        direction: true,
        dateFrom: true,
        dateTo: true,
        cfdiCount: true,
        attempts: true,
        lastError: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: jobs });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing SAT sync jobs:', error);
    return NextResponse.json({ error: 'Error al listar sincronizaciones' }, { status: 500 });
  }
}
