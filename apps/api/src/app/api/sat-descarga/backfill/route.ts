import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateMonthRange(fromMonth: string) {
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
  return { months, nowMx };
}

function getDateRange(year: number, month: number, nowMx: Date) {
  const dateFrom = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const todayMx = new Date(Date.UTC(nowMx.getFullYear(), nowMx.getMonth(), nowMx.getDate()));
  const endOfMonth = new Date(Date.UTC(year, month, lastDay));
  const dateTo = endOfMonth > todayMx ? todayMx : endOfMonth;
  return { dateFrom, dateTo };
}

const JOB_RESET_DATA = {
  status: 'pending' as const,
  requestId: null,
  packageIds: [] as string[],
  attempts: 0,
  lastError: null,
  startedAt: null,
  completedAt: null,
  cfdiCount: null,
};

// ---------------------------------------------------------------------------
// POST /api/sat-descarga/backfill
// ---------------------------------------------------------------------------

/**
 * POST /api/sat-descarga/backfill — Create/retry sync jobs
 *
 * Body: { fromMonth?: "YYYY-MM", force?: boolean, retryFailed?: boolean }
 *
 * Modes:
 * - Default: create missing jobs for months without completed jobs
 * - retryFailed=true: reset genuinely failed jobs (not orphans, auto-bumps offset for 5002)
 * - force=true: reset ALL completed XML jobs for re-download (bumps offset)
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

    if (profile.fielValidUntil && new Date() > profile.fielValidUntil) {
      return NextResponse.json(
        { error: 'Tu e.Firma ha expirado. Sube una nueva para continuar.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const fromMonth = body.fromMonth || '2025-01';
    const force = body.force === true;
    const retryFailed = body.retryFailed === true;

    if (!/^\d{4}-\d{2}$/.test(fromMonth)) {
      return NextResponse.json({ error: 'fromMonth debe ser YYYY-MM' }, { status: 400 });
    }

    const { months, nowMx } = generateMonthRange(fromMonth);

    // -----------------------------------------------------------------------
    // Mode: retryFailed — smart retry of genuinely failed jobs
    // -----------------------------------------------------------------------
    if (retryFailed) {
      // Find all failed jobs for this doctor
      const failedJobs = await prisma.satSyncJob.findMany({
        where: { doctorId: doctor.id, status: 'failed' },
        select: { id: true, dateFrom: true, direction: true, requestType: true, lastError: true },
      });

      let cleaned = 0;
      let retried = 0;
      let needsOffsetBump = false;

      for (const fj of failedJobs) {
        // Check if a completed sibling exists — if so, this is an orphan
        const completedSibling = await prisma.satSyncJob.findFirst({
          where: {
            doctorId: doctor.id,
            dateFrom: fj.dateFrom,
            direction: fj.direction,
            requestType: fj.requestType,
            status: 'completed',
          },
          select: { id: true },
        });

        if (completedSibling) {
          // Orphan — delete it
          await prisma.satSyncJob.delete({ where: { id: fj.id } });
          cleaned++;
          continue;
        }

        // Check if it's a permanent 5002 failure
        if (fj.lastError && fj.lastError.includes('5002')) {
          needsOffsetBump = true;
        }
      }

      // Auto-bump offset if any 5002 failures found
      if (needsOffsetBump) {
        await prisma.doctorFiscalProfile.update({
          where: { doctorId: doctor.id },
          data: { xmlOffsetSeconds: { increment: 1 } },
        });
      }

      // Now reset remaining non-orphan failures to pending
      const remainingFailed = await prisma.satSyncJob.findMany({
        where: { doctorId: doctor.id, status: 'failed' },
        select: { id: true, dateFrom: true },
      });

      for (const fj of remainingFailed) {
        const { dateTo } = getDateRange(
          fj.dateFrom.getUTCFullYear(),
          fj.dateFrom.getUTCMonth(),
          nowMx,
        );
        await prisma.satSyncJob.update({
          where: { id: fj.id },
          data: { ...JOB_RESET_DATA, dateTo },
        });
        retried++;
      }

      return NextResponse.json({
        data: { cleaned, retried, offsetBumped: needsOffsetBump },
      }, { status: 200 });
    }

    // -----------------------------------------------------------------------
    // Mode: force — reset all completed XML jobs for re-download
    // -----------------------------------------------------------------------
    if (force) {
      // Bump offset first since all XML ranges will be re-requested
      await prisma.doctorFiscalProfile.update({
        where: { doctorId: doctor.id },
        data: { xmlOffsetSeconds: { increment: 1 } },
      });

      const result = await prisma.satSyncJob.updateMany({
        where: {
          doctorId: doctor.id,
          requestType: 'xml',
          status: 'completed',
        },
        data: JOB_RESET_DATA,
      });

      // Also clean up orphan failures while we're at it
      const orphans = await cleanOrphanFailures(doctor.id);

      return NextResponse.json({
        data: { reset: result.count, orphansCleaned: orphans },
      }, { status: 200 });
    }

    // -----------------------------------------------------------------------
    // Default mode: create missing jobs
    // -----------------------------------------------------------------------
    let created = 0;
    let skipped = 0;
    let orphansCleaned = 0;

    for (const { year, month } of months) {
      const { dateFrom, dateTo } = getDateRange(year, month, nowMx);

      for (const direction of ['received', 'emitted'] as const) {
        for (const requestType of ['metadata', 'xml'] as const) {
          // Check for completed or active jobs
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
            // Clean up any orphan failures for this combo
            const deleted = await prisma.satSyncJob.deleteMany({
              where: {
                doctorId: doctor.id,
                direction,
                requestType,
                dateFrom,
                status: 'failed',
              },
            });
            orphansCleaned += deleted.count;
            skipped++;
            continue;
          }

          // Check for failed jobs — reset them instead of creating duplicates
          const failedJob = await prisma.satSyncJob.findFirst({
            where: {
              doctorId: doctor.id,
              direction,
              requestType,
              dateFrom,
              status: 'failed',
            },
          });

          if (failedJob) {
            await prisma.satSyncJob.update({
              where: { id: failedJob.id },
              data: { ...JOB_RESET_DATA, dateTo },
            });
            created++;
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
        orphansCleaned,
        total: months.length * 4,
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

// ---------------------------------------------------------------------------
// Helper: clean orphan failures (failed jobs that have a completed sibling)
// ---------------------------------------------------------------------------

async function cleanOrphanFailures(doctorId: string): Promise<number> {
  const failedJobs = await prisma.satSyncJob.findMany({
    where: { doctorId, status: 'failed' },
    select: { id: true, dateFrom: true, direction: true, requestType: true },
  });

  let cleaned = 0;
  for (const fj of failedJobs) {
    const completedSibling = await prisma.satSyncJob.findFirst({
      where: {
        doctorId,
        dateFrom: fj.dateFrom,
        direction: fj.direction,
        requestType: fj.requestType,
        status: 'completed',
      },
      select: { id: true },
    });

    if (completedSibling) {
      await prisma.satSyncJob.delete({ where: { id: fj.id } });
      cleaned++;
    }
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// GET /api/sat-descarga/backfill — Get backfill progress + completeness
// ---------------------------------------------------------------------------

/**
 * GET /api/sat-descarga/backfill — Get backfill progress
 *
 * Returns per-month sync status and data completeness (metadata vs XML counts).
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const fromMonth = '2025-01';
    const { months, nowMx } = generateMonthRange(fromMonth);
    const currentYear = nowMx.getFullYear();
    const currentMonth = nowMx.getMonth();

    let completedMonths = 0;
    let pendingMonths = 0;
    let failedMonths = 0;

    for (const { year, month } of months) {
      const dateFrom = new Date(Date.UTC(year, month, 1));

      const [completedJobs, failedJobs] = await Promise.all([
        prisma.satSyncJob.count({
          where: { doctorId: doctor.id, dateFrom, status: 'completed' },
        }),
        // Only count failures that DON'T have a completed sibling
        // We check this by looking for failed jobs in combos without a completed one
        prisma.satSyncJob.count({
          where: {
            doctorId: doctor.id,
            dateFrom,
            status: 'failed',
            // Exclude orphans: only count if no completed job exists for same params
            // We can't do this in a single Prisma query efficiently, so we handle below
          },
        }),
      ]);

      if (completedJobs >= 4) {
        // All 4 combos completed — any failures are orphans, don't count them
        completedMonths++;
      } else if (failedJobs > 0) {
        // Check if some failures are orphans
        const realFailures = await countRealFailures(doctor.id, dateFrom);
        if (realFailures > 0) {
          failedMonths++;
        } else if (completedJobs > 0) {
          // All failures are orphans, but month not fully complete — pending
          pendingMonths++;
        } else {
          pendingMonths++;
        }
      } else {
        pendingMonths++;
      }
    }

    // Count active jobs and real (non-orphan) failed jobs
    const activeJobs = await prisma.satSyncJob.count({
      where: {
        doctorId: doctor.id,
        status: { in: ['pending', 'authenticating', 'requesting', 'polling', 'downloading'] },
      },
    });

    const allFailedJobs = await prisma.satSyncJob.findMany({
      where: { doctorId: doctor.id, status: 'failed' },
      select: { id: true, dateFrom: true, direction: true, requestType: true, lastError: true },
    });

    // Filter out orphans from the total count
    let realFailedJobs = 0;
    const failedJobDetails: Array<{
      id: number;
      month: string;
      direction: string;
      requestType: string;
      lastError: string | null;
      is5002: boolean;
    }> = [];

    for (const fj of allFailedJobs) {
      const completedSibling = await prisma.satSyncJob.findFirst({
        where: {
          doctorId: doctor.id,
          dateFrom: fj.dateFrom,
          direction: fj.direction,
          requestType: fj.requestType,
          status: 'completed',
        },
        select: { id: true },
      });

      if (!completedSibling) {
        realFailedJobs++;
        const d = fj.dateFrom;
        failedJobDetails.push({
          id: fj.id,
          month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
          direction: fj.direction,
          requestType: fj.requestType,
          lastError: fj.lastError,
          is5002: !!(fj.lastError && fj.lastError.includes('5002')),
        });
      }
    }

    // Data completeness: metadata records vs XML details
    const [metadataCount, detailCount] = await Promise.all([
      prisma.satCfdiMetadata.count({ where: { doctorId: doctor.id } }),
      prisma.satCfdiDetail.count({ where: { doctorId: doctor.id } }),
    ]);

    // Auto-sync status
    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
      select: { autoSyncEnabled: true, xmlOffsetSeconds: true },
    });

    return NextResponse.json({
      data: {
        totalMonths: months.length,
        completedMonths,
        pendingMonths,
        failedMonths,
        activeJobs,
        failedJobs: realFailedJobs,
        failedJobDetails,
        fromMonth,
        toMonth: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
        // Data completeness
        metadataCount,
        detailCount,
        missingXmlCount: Math.max(0, metadataCount - detailCount),
        // Config
        autoSyncEnabled: profile?.autoSyncEnabled ?? false,
        xmlOffsetSeconds: profile?.xmlOffsetSeconds ?? 0,
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

async function countRealFailures(doctorId: string, dateFrom: Date): Promise<number> {
  const failedJobs = await prisma.satSyncJob.findMany({
    where: { doctorId, dateFrom, status: 'failed' },
    select: { id: true, direction: true, requestType: true },
  });

  let real = 0;
  for (const fj of failedJobs) {
    const completedSibling = await prisma.satSyncJob.findFirst({
      where: {
        doctorId,
        dateFrom,
        direction: fj.direction,
        requestType: fj.requestType,
        status: 'completed',
      },
      select: { id: true },
    });
    if (!completedSibling) real++;
  }
  return real;
}

// ---------------------------------------------------------------------------
// PATCH /api/sat-descarga/backfill — Update sync config (autoSyncEnabled)
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    const data: Record<string, any> = {};
    if (typeof body.autoSyncEnabled === 'boolean') {
      data.autoSyncEnabled = body.autoSyncEnabled;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data,
    });

    return NextResponse.json({ data: { updated: true, ...data } });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/sat-descarga/backfill — Reset total (nuke and restart)
// ---------------------------------------------------------------------------

/**
 * DELETE /api/sat-descarga/backfill — Delete all SAT data and restart sync
 *
 * Deletes: all sync jobs, metadata, details, conceptos, pagos, alerts.
 * Unlinks: LedgerEntry.satCfdiUuid references.
 * Preserves: declaration receipts (manual ISR/IVA amounts).
 * Auto-bumps xmlOffsetSeconds and triggers a new backfill.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const profile = await prisma.doctorFiscalProfile.findUnique({
      where: { doctorId: doctor.id },
    });

    if (!profile || !profile.fielUploaded) {
      return NextResponse.json(
        { error: 'Necesitas e.Firma configurada para reiniciar' },
        { status: 400 }
      );
    }

    if (profile.fielValidUntil && new Date() > profile.fielValidUntil) {
      return NextResponse.json(
        { error: 'Tu e.Firma ha expirado. Sube una nueva para continuar.' },
        { status: 400 }
      );
    }

    // Delete in dependency order
    // SatCfdiConcepto has onDelete: Cascade on detail, so deleting details auto-deletes conceptos
    const [detailsDeleted, metadataDeleted, pagosDeleted, alertsDeleted, jobsDeleted] =
      await prisma.$transaction([
        prisma.satCfdiDetail.deleteMany({
          where: { doctorId: doctor.id },
        }),
        prisma.satCfdiMetadata.deleteMany({
          where: { doctorId: doctor.id },
        }),
        prisma.satPago.deleteMany({
          where: { doctorId: doctor.id },
        }),
        prisma.satAlert.deleteMany({
          where: { doctorId: doctor.id },
        }),
        prisma.satSyncJob.deleteMany({
          where: { doctorId: doctor.id },
        }),
      ]);

    // Unlink ledger entries (null out satCfdiUuid, don't delete entries)
    const unlinked = await prisma.ledgerEntry.updateMany({
      where: { doctorId: doctor.id, satCfdiUuid: { not: null } },
      data: { satCfdiUuid: null },
    });

    // Bump xmlOffsetSeconds for fresh SAT requests
    await prisma.doctorFiscalProfile.update({
      where: { doctorId: doctor.id },
      data: { xmlOffsetSeconds: { increment: 1 } },
    });

    // Auto-create backfill jobs for all months
    const fromMonth = '2025-01';
    const { months, nowMx } = generateMonthRange(fromMonth);
    let jobsCreated = 0;

    for (const { year, month } of months) {
      const { dateFrom, dateTo } = getDateRange(year, month, nowMx);

      for (const direction of ['received', 'emitted'] as const) {
        for (const requestType of ['metadata', 'xml'] as const) {
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
          jobsCreated++;
        }
      }
    }

    return NextResponse.json({
      data: {
        deleted: {
          details: detailsDeleted.count,
          metadata: metadataDeleted.count,
          pagos: pagosDeleted.count,
          alerts: alertsDeleted.count,
          jobs: jobsDeleted.count,
          ledgerUnlinked: unlinked.count,
        },
        jobsCreated,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error resetting SAT data:', error);
    return NextResponse.json({ error: 'Error al reiniciar sincronización' }, { status: 500 });
  }
}
