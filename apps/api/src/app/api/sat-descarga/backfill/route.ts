import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * POST /api/sat-descarga/backfill — Create sync jobs for all months from a start date to now
 *
 * Body: { fromMonth?: "YYYY-MM" } (defaults to "2025-01")
 *
 * Creates metadata + XML jobs for both directions for each month not already completed.
 * Returns count of created/skipped jobs.
 */
export async function POST(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile || !profile.fielUploaded) {
      return NextResponse.json(
        { error: 'Necesitas e.Firma configurada para hacer backfill' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const fromMonth = body.fromMonth || '2025-01';

    if (!/^\d{4}-\d{2}$/.test(fromMonth)) {
      return NextResponse.json({ error: 'fromMonth debe ser YYYY-MM' }, { status: 400 });
    }

    // Generate all months from fromMonth to current month
    const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const currentYear = nowMx.getFullYear();
    const currentMonth = nowMx.getMonth(); // 0-indexed

    const [startYear, startMonth] = fromMonth.split('-').map(Number);
    const months: Array<{ year: number; month: number }> = [];

    let y = startYear;
    let m = startMonth - 1; // 0-indexed
    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      months.push({ year: y, month: m });
      m++;
      if (m > 11) { m = 0; y++; }
    }

    let created = 0;
    let skipped = 0;

    for (const { year, month } of months) {
      const dateFrom = new Date(Date.UTC(year, month, 1));
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const todayMx = new Date(Date.UTC(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate()));
      const endOfMonth = new Date(Date.UTC(year, month, lastDay));
      const dateTo = endOfMonth > todayMx ? todayMx : endOfMonth;

      for (const direction of ['received', 'emitted'] as const) {
        for (const requestType of ['metadata', 'xml'] as const) {
          // Skip if already completed or active
          const existingJob = await prisma.satSyncJob.findFirst({
            where: {
              doctorId: doctor.id,
              direction,
              requestType,
              dateFrom,
              status: { in: ['completed', 'pending', 'authenticating', 'requesting', 'polling', 'downloading'] },
            },
          });

          if (existingJob) {
            skipped++;
            continue;
          }

          await prisma.satSyncJob.create({
            data: {
              doctorId: doctor.id,
              fiscalProfileId: profile.id,
              requestType,
              direction,
              dateFrom,
              dateTo,
            },
          });
          created++;
        }
      }
    }

    return NextResponse.json({
      data: {
        months: months.length,
        created,
        skipped,
        total: months.length * 4, // 4 jobs per month (2 directions × 2 types)
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating backfill jobs:', error);
    return NextResponse.json({ error: 'Error al crear backfill' }, { status: 500 });
  }
}

/**
 * GET /api/sat-descarga/backfill — Get backfill progress
 *
 * Returns how many months have been fully synced since 2025-01.
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const fromMonth = '2025-01';
    const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const currentYear = nowMx.getFullYear();
    const currentMonth = nowMx.getMonth();

    const [startYear, startMonth] = fromMonth.split('-').map(Number);
    const months: Array<{ year: number; month: number }> = [];

    let y = startYear;
    let m = startMonth - 1;
    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      months.push({ year: y, month: m });
      m++;
      if (m > 11) { m = 0; y++; }
    }

    // Count completed jobs grouped by month
    let completedMonths = 0;
    let pendingMonths = 0;

    for (const { year, month } of months) {
      const dateFrom = new Date(Date.UTC(year, month, 1));

      // A month is "complete" if all 4 jobs are done (received+emitted × metadata+xml)
      const completedJobs = await prisma.satSyncJob.count({
        where: {
          doctorId: doctor.id,
          dateFrom,
          status: 'completed',
        },
      });

      if (completedJobs >= 4) {
        completedMonths++;
      } else {
        pendingMonths++;
      }
    }

    // Count active jobs
    const activeJobs = await prisma.satSyncJob.count({
      where: {
        doctorId: doctor.id,
        status: { in: ['pending', 'authenticating', 'requesting', 'polling', 'downloading'] },
      },
    });

    return NextResponse.json({
      data: {
        totalMonths: months.length,
        completedMonths,
        pendingMonths,
        activeJobs,
        fromMonth,
        toMonth: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error getting backfill progress:', error);
    return NextResponse.json({ error: 'Error al obtener progreso' }, { status: 500 });
  }
}
