/**
 * POST /api/cron/sat-sync-worker
 *
 * Background worker that processes pending SAT sync jobs.
 * Called by Railway cron every 2 minutes, or manually for testing.
 * Protected by CRON_SECRET.
 *
 * Flow per job:
 *   1. Load doctor's encrypted e.Firma from DB → decrypt
 *   2. Authenticate with SAT → JWT token
 *   3. Request metadata download → IdSolicitud
 *   4. Verify status (single check, re-queued if not ready)
 *   5. Download packages → ZIP
 *   6. Parse metadata → upsert into sat_cfdi_metadata
 */

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { decrypt } from '@/lib/encryption';
import {
  loadCredentials,
  authenticate,
  requestMetadata,
  verifyRequest,
  downloadPackage,
  parseMetadataFromZip,
  SatError,
  type SyncDirection,
} from '@/lib/sat-descarga';

export async function POST(request: Request) {
  // Auth: cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ jobId: number; status: string; error?: string }> = [];

  // Pick up pending jobs (limit to 3 per run to stay within timeout)
  const pendingJobs = await prisma.satSyncJob.findMany({
    where: {
      status: { in: ['pending', 'authenticating', 'requesting', 'polling', 'downloading'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 3,
    include: {
      fiscalProfile: {
        select: {
          fielCerEncrypted: true,
          fielKeyEncrypted: true,
          fielPasswordEncrypted: true,
          rfc: true,
        },
      },
    },
  });

  for (const job of pendingJobs) {
    try {
      const result = await processJob(job);
      results.push({ jobId: job.id, status: result });
    } catch (error: any) {
      const msg = error instanceof SatError ? error.message : 'Error interno';
      console.error(`SAT worker error (job ${job.id}):`, error.message);

      await prisma.satSyncJob.update({
        where: { id: job.id },
        data: {
          status: job.attempts + 1 >= job.maxAttempts ? 'failed' : job.status,
          attempts: { increment: 1 },
          lastError: msg,
        },
      });

      results.push({ jobId: job.id, status: 'error', error: msg });
    }
  }

  return NextResponse.json({
    data: {
      processed: results.length,
      results,
    },
  });
}

// ---------------------------------------------------------------------------
// Process a single job through its current state
// ---------------------------------------------------------------------------

type JobWithProfile = Awaited<ReturnType<typeof prisma.satSyncJob.findMany>>[0] & {
  fiscalProfile: {
    fielCerEncrypted: string | null;
    fielKeyEncrypted: string | null;
    fielPasswordEncrypted: string | null;
    rfc: string;
  };
};

async function processJob(job: JobWithProfile): Promise<string> {
  const { fiscalProfile } = job;

  // Validate credentials exist
  if (!fiscalProfile.fielCerEncrypted || !fiscalProfile.fielKeyEncrypted || !fiscalProfile.fielPasswordEncrypted) {
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: { status: 'failed', lastError: 'e.Firma no configurada' },
    });
    return 'failed: no credentials';
  }

  // Decrypt credentials
  const cred = loadCredentials({
    cerBase64: decrypt(fiscalProfile.fielCerEncrypted),
    keyBase64: decrypt(fiscalProfile.fielKeyEncrypted),
    password: decrypt(fiscalProfile.fielPasswordEncrypted),
  });

  // State machine: each invocation advances the job one step
  switch (job.status) {
    case 'pending':
    case 'authenticating':
      return await stepAuthenticate(job, cred);

    case 'requesting':
      return await stepRequest(job, cred);

    case 'polling':
      return await stepVerify(job, cred);

    case 'downloading':
      return await stepDownload(job, cred);

    default:
      return `skipped: status=${job.status}`;
  }
}

// ---------------------------------------------------------------------------
// Step: Authenticate → Request
// ---------------------------------------------------------------------------

async function stepAuthenticate(job: JobWithProfile, cred: ReturnType<typeof loadCredentials>): Promise<string> {
  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { status: 'authenticating', startedAt: job.startedAt || new Date() },
  });

  const token = await authenticate(cred);

  console.log('[SAT worker] stepAuthenticate dates:', {
    jobId: job.id,
    dateFrom: job.dateFrom?.toISOString(),
    dateTo: job.dateTo?.toISOString(),
  });

  // Immediately proceed to request
  const idSolicitud = await requestMetadata(
    token,
    cred,
    job.direction as SyncDirection,
    job.dateFrom,
    job.dateTo,
  );

  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { status: 'polling', requestId: idSolicitud, attempts: { increment: 1 } },
  });

  return 'polling';
}

// ---------------------------------------------------------------------------
// Step: Request (re-entry after auth if needed)
// ---------------------------------------------------------------------------

async function stepRequest(job: JobWithProfile, cred: ReturnType<typeof loadCredentials>): Promise<string> {
  const token = await authenticate(cred);

  const idSolicitud = await requestMetadata(
    token,
    cred,
    job.direction as SyncDirection,
    job.dateFrom,
    job.dateTo,
  );

  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { status: 'polling', requestId: idSolicitud, attempts: { increment: 1 } },
  });

  return 'polling';
}

// ---------------------------------------------------------------------------
// Step: Verify (polling — one check per worker invocation)
// ---------------------------------------------------------------------------

async function stepVerify(job: JobWithProfile, cred: ReturnType<typeof loadCredentials>): Promise<string> {
  if (!job.requestId) {
    // No requestId — go back to requesting
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: { status: 'requesting' },
    });
    return 'requesting: missing requestId';
  }

  const token = await authenticate(cred);
  const result = await verifyRequest(token, cred, job.requestId);

  if (result.estado === '3') {
    // Ready to download
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'downloading',
        packageIds: result.packageIds,
        cfdiCount: result.numeroCFDIs,
        attempts: { increment: 1 },
      },
    });
    return 'downloading';
  }

  if (result.estado === '4' || result.estado === '5' || result.estado === '6') {
    // Terminal error
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        lastError: `SAT: ${result.estadoName} (${result.codEstatus})`,
        attempts: { increment: 1 },
      },
    });
    return `failed: ${result.estadoName}`;
  }

  // Still processing (estado 1 or 2) — increment attempts, stay in polling
  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { attempts: { increment: 1 } },
  });

  return `polling: ${result.estadoName}`;
}

// ---------------------------------------------------------------------------
// Step: Download packages + parse + store
// ---------------------------------------------------------------------------

async function stepDownload(job: JobWithProfile, cred: ReturnType<typeof loadCredentials>): Promise<string> {
  const packageIds = job.packageIds || [];

  if (packageIds.length === 0) {
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date(), cfdiCount: 0 },
    });
    return 'completed: no packages';
  }

  const token = await authenticate(cred);

  let totalRecords = 0;

  for (const pkgId of packageIds) {
    const zipBuffer = await downloadPackage(token, cred, pkgId);
    const records = parseMetadataFromZip(zipBuffer);

    // Upsert each record
    for (const record of records) {
      await prisma.satCfdiMetadata.upsert({
        where: {
          doctorId_uuid: {
            doctorId: job.doctorId,
            uuid: record.uuid,
          },
        },
        create: {
          doctorId: job.doctorId,
          syncJobId: job.id,
          uuid: record.uuid,
          direction: job.direction,
          issuerRfc: record.rfcEmisor,
          issuerName: record.nombreEmisor,
          receiverRfc: record.rfcReceptor,
          receiverName: record.nombreReceptor,
          pacRfc: record.pacCertifico || null,
          monto: record.monto,
          efecto: record.efectoComprobante || null,
          satStatus: record.estatus,
          cancelationDate: record.fechaCancelacion
            ? new Date(record.fechaCancelacion)
            : null,
          issuedAt: new Date(record.fechaEmision),
          certifiedAt: record.fechaCertificacionSat
            ? new Date(record.fechaCertificacionSat)
            : null,
        },
        update: {
          satStatus: record.estatus,
          cancelationDate: record.fechaCancelacion
            ? new Date(record.fechaCancelacion)
            : null,
          monto: record.monto,
          syncJobId: job.id,
        },
      });
    }

    totalRecords += records.length;
  }

  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      cfdiCount: totalRecords,
    },
  });

  return `completed: ${totalRecords} CFDIs`;
}
