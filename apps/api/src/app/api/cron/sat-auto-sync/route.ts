/**
 * POST /api/cron/sat-auto-sync
 *
 * Automatically creates sync jobs for all doctors with auto-sync enabled.
 * Creates full (metadata + XML) sync for current month, both directions,
 * if no completed job exists for that period in the last 20 hours.
 *
 * Protected by CRON_SECRET. Called daily at 6 AM UTC (midnight MX).
 * Limits to 5 doctors per run to avoid SAT throttling.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Current month date range (Mexico City time)
  const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const year = nowMx.getFullYear();
  const monthNum = nowMx.getMonth(); // 0-indexed
  const dateFrom = new Date(Date.UTC(year, monthNum, 1));
  const lastDay = new Date(Date.UTC(year, monthNum + 1, 0)).getUTCDate();
  const todayMx = new Date(Date.UTC(year, nowMx.getMonth(), nowMx.getDate()));
  const endOfMonth = new Date(Date.UTC(year, monthNum, lastDay));
  const dateTo = endOfMonth > todayMx ? todayMx : endOfMonth;

  const recentWindow = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20 hours

  // Find doctors with auto-sync enabled and FIEL uploaded
  const profiles = await prisma.doctorFiscalProfile.findMany({
    where: {
      fielUploaded: true,
      autoSyncEnabled: true,
    },
    select: {
      id: true,
      doctorId: true,
    },
    take: 5,
  });

  const results: Array<{ doctorId: string; created: number; skipped: string }> = [];

  for (const profile of profiles) {
    let created = 0;
    const skipped: string[] = [];

    for (const direction of ['received', 'emitted'] as const) {
      for (const requestType of ['metadata', 'xml'] as const) {
        // Check if a completed job exists for this period in the last 20 hours
        const recentJob = await prisma.satSyncJob.findFirst({
          where: {
            doctorId: profile.doctorId,
            direction,
            requestType,
            dateFrom,
            status: 'completed',
            completedAt: { gte: recentWindow },
          },
        });

        if (recentJob) {
          skipped.push(`${direction}/${requestType}`);
          continue;
        }

        // Check for active job (avoid duplicates) — ignore jobs stuck for >6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const activeJob = await prisma.satSyncJob.findFirst({
          where: {
            doctorId: profile.doctorId,
            direction,
            requestType,
            dateFrom,
            dateTo,
            status: { in: ['pending', 'authenticating', 'requesting', 'polling', 'downloading'] },
            createdAt: { gte: sixHoursAgo },
          },
        });

        if (activeJob) {
          skipped.push(`${direction}/${requestType} (active)`);
          continue;
        }

        await prisma.satSyncJob.create({
          data: {
            doctorId: profile.doctorId,
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

    results.push({
      doctorId: profile.doctorId,
      created,
      skipped: skipped.join(', ') || 'none',
    });
  }

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0);

  return NextResponse.json({
    success: true,
    data: {
      doctorsChecked: profiles.length,
      jobsCreated: totalCreated,
      details: results,
    },
  });
}
