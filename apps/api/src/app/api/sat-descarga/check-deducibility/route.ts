import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  classifyConcepto,
  checkDeductibilityExtended,
  type DeductibilityFlag,
} from '@/lib/deduction-categories';

/**
 * GET /api/sat-descarga/check-deducibility — Scan received CFDIs for deducibility issues
 *
 * Fetches all received CFDIs for the year, runs extended deductibility checks,
 * returns flagged items grouped by severity and flag type.
 *
 * Query params:
 *   year — optional, defaults to current year
 *
 * Response shape:
 * {
 *   data: {
 *     year,
 *     summary: { total, flagged, errors, warnings, infos },
 *     byType: { [flagType]: { count, severity, message, cfdiUuids } },
 *     flaggedCfdis: [{ uuid, issuerRfc, issuerName, subtotal, issuedAt, flags }]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()), 10);

    // Fetch all received CFDIs for the year (include cancelled for this check)
    const cfdis = await prisma.satCfdiMetadata.findMany({
      where: {
        doctorId: doctor.id,
        direction: 'received',
        efecto: 'I',
        issuedAt: {
          gte: new Date(`${year}-01-01T00:00:00Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00Z`),
        },
      },
      select: {
        uuid: true,
        issuerRfc: true,
        issuerName: true,
        monto: true,
        satStatus: true,
        issuedAt: true,
      },
    });

    // Batch-fetch XML details
    const uuids = cfdis.map(c => c.uuid.toLowerCase());
    const details = uuids.length > 0
      ? await prisma.satCfdiDetail.findMany({
          where: { doctorId: doctor.id, uuid: { in: uuids } },
          select: {
            uuid: true,
            subtotal: true,
            total: true,
            formaPago: true,
            moneda: true,
            conceptos: {
              select: {
                claveProdServ: true,
                descripcion: true,
                importe: true,
              },
            },
          },
        })
      : [];

    const detailMap = new Map(details.map(d => [d.uuid.toLowerCase(), d]));

    // Check each CFDI
    interface FlaggedCfdi {
      uuid: string;
      issuerRfc: string;
      issuerName: string | null;
      subtotal: number;
      issuedAt: string;
      flags: DeductibilityFlag[];
    }

    const flaggedCfdis: FlaggedCfdi[] = [];
    const byType: Record<string, { count: number; severity: string; message: string; cfdiUuids: string[] }> = {};
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const cfdi of cfdis) {
      const detail = detailMap.get(cfdi.uuid.toLowerCase());
      const cfdiSubtotal = detail ? Number(detail.subtotal) : Number(cfdi.monto);
      const cfdiTotal = detail ? Number(detail.total) : Number(cfdi.monto);

      // Classify primary category
      let primaryCategory = 'otros';
      if (detail && detail.conceptos.length > 0) {
        let maxImporte = 0;
        for (const concepto of detail.conceptos) {
          const importe = Number(concepto.importe) || 0;
          const catId = classifyConcepto(concepto.claveProdServ, concepto.descripcion);
          if (importe > maxImporte) {
            maxImporte = importe;
            primaryCategory = catId;
          }
        }
      }

      const flags = checkDeductibilityExtended({
        formaPago: detail?.formaPago || null,
        subtotal: cfdiSubtotal,
        total: cfdiTotal,
        satStatus: cfdi.satStatus,
        hasDetails: !!detail,
        categoryId: primaryCategory,
        conceptoDescriptions: detail?.conceptos.map(c => c.descripcion || '') || [],
        moneda: detail?.moneda || null,
      });

      if (flags.length > 0) {
        flaggedCfdis.push({
          uuid: cfdi.uuid,
          issuerRfc: cfdi.issuerRfc,
          issuerName: cfdi.issuerName,
          subtotal: cfdiSubtotal,
          issuedAt: cfdi.issuedAt.toISOString(),
          flags,
        });

        for (const flag of flags) {
          if (!byType[flag.type]) {
            byType[flag.type] = { count: 0, severity: flag.severity, message: flag.message, cfdiUuids: [] };
          }
          byType[flag.type].count++;
          if (byType[flag.type].cfdiUuids.length < 20) {
            byType[flag.type].cfdiUuids.push(cfdi.uuid);
          }

          if (flag.severity === 'error') errorCount++;
          else if (flag.severity === 'warning') warningCount++;
          else infoCount++;
        }
      }
    }

    // Sort flagged CFDIs: errors first, then warnings, then info
    const severityOrder = { error: 0, warning: 1, info: 2 };
    flaggedCfdis.sort((a, b) => {
      const aMax = Math.min(...a.flags.map(f => severityOrder[f.severity]));
      const bMax = Math.min(...b.flags.map(f => severityOrder[f.severity]));
      return aMax - bMax;
    });

    return NextResponse.json({
      data: {
        year,
        summary: {
          total: cfdis.length,
          flagged: flaggedCfdis.length,
          errors: errorCount,
          warnings: warningCount,
          infos: infoCount,
        },
        byType,
        flaggedCfdis: flaggedCfdis.slice(0, 200), // Cap at 200 for response size
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error checking deducibility:', error);
    return NextResponse.json({ error: 'Error al verificar deducibilidad' }, { status: 500 });
  }
}
