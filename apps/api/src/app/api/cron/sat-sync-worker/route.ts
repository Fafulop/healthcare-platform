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
  requestXml,
  verifyRequest,
  downloadPackage,
  parseMetadataFromZip,
  extractZipEntries,
  SatError,
  type SyncDirection,
} from '@/lib/sat-descarga';
import { parseCfdiXml, parsePagoComplement } from '@/lib/sat-xml-parser';
import { autoRegisterCfdisToLedger } from '@/lib/sat-auto-register';

/**
 * GET /api/cron/sat-sync-worker — Diagnostic: show all job statuses
 * Protected by CRON_SECRET (passed as ?secret= query param).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ?reset=<jobId|all-xml|force-xml> — reset job(s) to pending for re-processing
  // all-xml: reset failed XML jobs only
  // force-xml: reset ALL completed XML jobs (for re-download after parser fixes)
  const resetId = url.searchParams.get('reset');
  if (resetId) {
    const where = resetId === 'force-xml'
      ? { status: 'completed' as const, requestType: 'xml' as const }
      : resetId === 'all-xml'
        ? { status: 'failed' as const, requestType: 'xml' as const }
        : { id: parseInt(resetId, 10) };
    const updated = await prisma.satSyncJob.updateMany({
      where,
      data: { status: 'pending', requestId: null, packageIds: [], attempts: 0, lastError: null, startedAt: null, completedAt: null, cfdiCount: null },
    });
    return NextResponse.json({ reset: updated.count, param: resetId });
  }

  const jobs = await prisma.satSyncJob.findMany({
    orderBy: { id: 'asc' },
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
      requestId: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const summary = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    polling: jobs.filter(j => j.status === 'polling').length,
    pending: jobs.filter(j => j.status === 'pending').length,
    other: jobs.filter(j => !['completed', 'failed', 'polling', 'pending'].includes(j.status)).length,
  };

  return NextResponse.json({ summary, jobs });
}

export async function POST(request: Request) {
  // Auth: cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ jobId: number; status: string; error?: string }> = [];

  // SAT rejects XML solicitudes when too many are active simultaneously.
  // Strategy: process in-progress jobs first (polling/downloading), then only
  // start ONE new XML job at a time. Metadata jobs are unthrottled.
  // Count only actively-processing XML jobs (not pending ones waiting in queue)
  const activeXmlCount = await prisma.satSyncJob.count({
    where: {
      requestType: 'xml',
      status: { in: ['authenticating', 'requesting', 'polling', 'downloading'] },
    },
  });

  // Pick up: always process in-progress jobs, but only start new XML if none active
  const pendingJobs = await prisma.satSyncJob.findMany({
    where: {
      OR: [
        // Always continue in-progress jobs (any type)
        { status: { in: ['authenticating', 'requesting', 'polling', 'downloading'] } },
        // Start new metadata jobs freely
        { status: 'pending', requestType: 'metadata' },
        // Only start a new XML job if no XML jobs are currently active
        ...(activeXmlCount <= 1 ? [{ status: 'pending' as const, requestType: 'xml' as const }] : []),
      ],
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
          xmlOffsetSeconds: true,
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
    xmlOffsetSeconds: number;
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

  // Immediately proceed to request (metadata or XML depending on job type)
  const idSolicitud = job.requestType === 'xml'
    ? await requestXml(token, cred, job.direction as SyncDirection, job.dateFrom, job.dateTo, job.fiscalProfile.xmlOffsetSeconds ?? 0)
    : await requestMetadata(token, cred, job.direction as SyncDirection, job.dateFrom, job.dateTo);

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

  const idSolicitud = job.requestType === 'xml'
    ? await requestXml(token, cred, job.direction as SyncDirection, job.dateFrom, job.dateTo, job.fiscalProfile.xmlOffsetSeconds ?? 0)
    : await requestMetadata(token, cred, job.direction as SyncDirection, job.dateFrom, job.dateTo);

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
    // Terminal error from SAT
    const errorDetail = `SAT: ${result.estadoName} cod=${result.codEstatus} codSol=${result.codigoEstadoSolicitud} msg=${result.mensaje} cfdis=${result.numeroCFDIs}`;
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        lastError: errorDetail,
        attempts: { increment: 1 },
      },
    });
    return `failed: ${errorDetail}`;
  }

  // 5004 = "Información de solicitud no encontrada" — the request expired (SAT keeps
  // them for 72h). Reset to pending so a fresh solicitud is created on the next run.
  if (result.codEstatus === '5004') {
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'pending',
        requestId: null,
        packageIds: [],
        attempts: { increment: 1 },
        lastError: `SAT: solicitud expirada (5004), reintentando`,
      },
    });
    return 'pending: solicitud expired (5004), will retry';
  }

  // Unknown/unexpected estado — fail after 5 attempts to avoid blocking the queue
  if (result.estado !== '1' && result.estado !== '2' && job.attempts >= 5) {
    await prisma.satSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        lastError: `SAT: estado=${result.estado} cod=${result.codEstatus} after ${job.attempts} attempts`,
        attempts: { increment: 1 },
      },
    });
    return `failed: unexpected estado=${result.estado} after ${job.attempts} attempts`;
  }

  // Still processing (estado 1 or 2) — increment attempts, stay in polling
  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { attempts: { increment: 1 } },
  });

  const msgSuffix = result.mensaje ? ` msg=${result.mensaje}` : '';
  return `polling: estado=${result.estado} cod=${result.codEstatus} name=${result.estadoName}${msgSuffix}`;
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

  if (job.requestType === 'xml') {
    return await downloadAndParseXml(job, token, cred, packageIds);
  }

  return await downloadAndParseMetadata(job, token, cred, packageIds);
}

// ---------------------------------------------------------------------------
// Download + Parse: Metadata
// ---------------------------------------------------------------------------

async function downloadAndParseMetadata(
  job: JobWithProfile,
  token: string,
  cred: ReturnType<typeof loadCredentials>,
  packageIds: string[],
): Promise<string> {
  let totalRecords = 0;
  const alerts: Array<{ type: string; uuid: string; direction: string; issuerName: string | null; monto: number; message: string }> = [];

  for (const pkgId of packageIds) {
    const zipBuffer = await downloadPackage(token, cred, pkgId);
    const records = parseMetadataFromZip(zipBuffer);

    for (const record of records) {
      // Check if this UUID already exists (to detect new vs update)
      const existing = await prisma.satCfdiMetadata.findUnique({
        where: { doctorId_uuid: { doctorId: job.doctorId, uuid: record.uuid } },
        select: { satStatus: true },
      });

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

      // Generate alerts
      if (!existing) {
        // New CFDI detected
        alerts.push({
          type: 'new_cfdi',
          uuid: record.uuid,
          direction: job.direction,
          issuerName: record.nombreEmisor,
          monto: record.monto,
          message: `Nuevo CFDI ${job.direction === 'received' ? 'recibido' : 'emitido'} de ${record.nombreEmisor || record.rfcEmisor} por $${record.monto}`,
        });
      } else if (existing.satStatus === 'Vigente' && record.estatus === 'Cancelado') {
        // Status changed to Cancelado
        alerts.push({
          type: 'cancelled',
          uuid: record.uuid,
          direction: job.direction,
          issuerName: record.nombreEmisor,
          monto: record.monto,
          message: `CFDI cancelado: ${record.nombreEmisor || record.rfcEmisor} por $${record.monto}`,
        });
      }
    }

    totalRecords += records.length;
  }

  // Batch create alerts (skip if too many — likely first-time sync)
  if (alerts.length > 0 && alerts.length <= 50) {
    await prisma.satAlert.createMany({
      data: alerts.map(a => ({
        doctorId: job.doctorId,
        type: a.type,
        uuid: a.uuid,
        direction: a.direction,
        issuerName: a.issuerName,
        monto: a.monto,
        message: a.message,
      })),
    });
  }

  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { status: 'completed', completedAt: new Date(), cfdiCount: totalRecords },
  });

  // Auto-register new CFDIs to ledger (Phase 1 — Consolidated Money Model)
  try {
    const autoResult = await autoRegisterCfdisToLedger(job.doctorId, job.id);
    console.log(`[sat-sync-worker] Auto-register for job ${job.id}: ` +
      `linked=${autoResult.autoLinked}, review=${autoResult.autoLinkedNeedsReview}, ` +
      `created=${autoResult.created}, skipped=${autoResult.skipped}`);
  } catch (err) {
    console.error(`[sat-sync-worker] Auto-register failed for job ${job.id}:`, err);
    // Don't fail the sync job — auto-register is best-effort
  }

  return `completed: ${totalRecords} CFDIs`;
}

// ---------------------------------------------------------------------------
// Download + Parse: XML (Phase 2)
// ---------------------------------------------------------------------------

async function downloadAndParseXml(
  job: JobWithProfile,
  token: string,
  cred: ReturnType<typeof loadCredentials>,
  packageIds: string[],
): Promise<string> {
  let totalRecords = 0;

  for (const pkgId of packageIds) {
    const zipBuffer = await downloadPackage(token, cred, pkgId);
    const entries = extractZipEntries(zipBuffer);

    for (const entry of entries) {
      if (!entry.name.endsWith('.xml')) continue;

      const detail = parseCfdiXml(entry.data);
      if (!detail) {
        console.warn(`[SAT worker] Skipped XML (no UUID found): ${entry.name} in job ${job.id}`);
        continue;
      }

      // Upsert the detail record
      const upserted = await prisma.satCfdiDetail.upsert({
        where: {
          doctorId_uuid: {
            doctorId: job.doctorId,
            uuid: detail.uuid,
          },
        },
        create: {
          doctorId: job.doctorId,
          syncJobId: job.id,
          uuid: detail.uuid,
          subtotal: detail.subtotal,
          descuento: detail.descuento,
          total: detail.total,
          ivaTrasladado: detail.ivaTrasladado,
          isrRetenido: detail.isrRetenido,
          ivaRetenido: detail.ivaRetenido,
          ieps: detail.ieps,
          metodoPago: detail.metodoPago,
          formaPago: detail.formaPago,
          usoCfdi: detail.usoCfdi,
          moneda: detail.moneda,
          tipoCambio: detail.tipoCambio,
          serie: detail.serie,
          folio: detail.folio,
          lugarExpedicion: detail.lugarExpedicion,
        },
        update: {
          subtotal: detail.subtotal,
          descuento: detail.descuento,
          total: detail.total,
          ivaTrasladado: detail.ivaTrasladado,
          isrRetenido: detail.isrRetenido,
          ivaRetenido: detail.ivaRetenido,
          ieps: detail.ieps,
          metodoPago: detail.metodoPago,
          formaPago: detail.formaPago,
          usoCfdi: detail.usoCfdi,
          moneda: detail.moneda,
          tipoCambio: detail.tipoCambio,
          serie: detail.serie,
          folio: detail.folio,
          lugarExpedicion: detail.lugarExpedicion,
          syncJobId: job.id,
        },
      });

      // Delete existing conceptos and re-insert (simpler than diffing)
      if (detail.conceptos.length > 0) {
        await prisma.satCfdiConcepto.deleteMany({
          where: { detailId: upserted.id },
        });

        await prisma.satCfdiConcepto.createMany({
          data: detail.conceptos.map(c => ({
            detailId: upserted.id,
            claveProdServ: c.claveProdServ,
            descripcion: c.descripcion,
            cantidad: c.cantidad,
            claveUnidad: c.claveUnidad,
            unidad: c.unidad,
            valorUnitario: c.valorUnitario,
            importe: c.importe,
            descuento: c.descuento,
            ivaTrasladado: c.ivaTrasladado,
            isrRetenido: c.isrRetenido,
          })),
        });
      }

      // Parse payment complement (tipo P) and store pago records
      const pago = parsePagoComplement(entry.data);
      if (detail.usoCfdi === 'CP01' && (!pago || pago.documentos.length === 0)) {
        console.warn(`[SAT worker] CP01 complement parsed but no DoctoRelacionado found: ${detail.uuid} in job ${job.id}`);
      }
      if (pago && pago.documentos.length > 0) {
        for (const doc of pago.documentos) {
          // Skip if this link was manually unlinked by the user
          const existing = await prisma.satPago.findUnique({
            where: {
              doctorId_pagoUuid_facturaUuid: {
                doctorId: job.doctorId,
                pagoUuid: pago.pagoUuid,
                facturaUuid: doc.facturaUuid,
              },
            },
            select: { unlinkedAt: true },
          });
          if (existing?.unlinkedAt) continue;

          await prisma.satPago.upsert({
            where: {
              doctorId_pagoUuid_facturaUuid: {
                doctorId: job.doctorId,
                pagoUuid: pago.pagoUuid,
                facturaUuid: doc.facturaUuid,
              },
            },
            create: {
              doctorId: job.doctorId,
              pagoUuid: pago.pagoUuid,
              facturaUuid: doc.facturaUuid,
              serie: doc.serie,
              folio: doc.folio,
              fechaPago: pago.fechaPago ? new Date(pago.fechaPago) : null,
              formaPago: pago.formaPago,
              montoPagado: doc.montoPagado,
              saldoAnterior: doc.saldoAnterior,
              saldoInsoluto: doc.saldoInsoluto,
              numParcialidad: doc.numParcialidad,
              baseDr: doc.baseDr,
              ivaTrasladadoDr: doc.ivaTrasladadoDr,
              isrRetenidoDr: doc.isrRetenidoDr,
              ivaRetenidoDr: doc.ivaRetenidoDr,
              source: 'auto',
            },
            update: {
              montoPagado: doc.montoPagado,
              saldoAnterior: doc.saldoAnterior,
              saldoInsoluto: doc.saldoInsoluto,
              numParcialidad: doc.numParcialidad,
              fechaPago: pago.fechaPago ? new Date(pago.fechaPago) : null,
              formaPago: pago.formaPago,
              baseDr: doc.baseDr,
              ivaTrasladadoDr: doc.ivaTrasladadoDr,
              isrRetenidoDr: doc.isrRetenidoDr,
              ivaRetenidoDr: doc.ivaRetenidoDr,
            },
          });
        }
      }

      totalRecords++;
    }
  }

  await prisma.satSyncJob.update({
    where: { id: job.id },
    data: { status: 'completed', completedAt: new Date(), cfdiCount: totalRecords },
  });

  // Auto-register new CFDIs to ledger (Phase 1 — Consolidated Money Model)
  try {
    const autoResult = await autoRegisterCfdisToLedger(job.doctorId, job.id);
    console.log(`[sat-sync-worker] Auto-register (XML) for job ${job.id}: ` +
      `linked=${autoResult.autoLinked}, review=${autoResult.autoLinkedNeedsReview}, ` +
      `created=${autoResult.created}, skipped=${autoResult.skipped}`);
  } catch (err) {
    console.error(`[sat-sync-worker] Auto-register (XML) failed for job ${job.id}:`, err);
  }

  return `completed: ${totalRecords} XML CFDIs parsed`;
}
