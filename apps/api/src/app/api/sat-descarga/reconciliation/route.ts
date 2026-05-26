import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

// GET /api/sat-descarga/reconciliation?month=2026-05
// Cross-reference CfdiEmitted (internal) vs SatCfdiMetadata (SAT) by UUID
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM

    // Build date range filter
    let dateFilter: any = {};
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59);
      dateFilter = { gte: start, lte: end };
    }

    // 1. Get all CfdiEmitted from the doctor (through fiscal profile)
    const emittedWhere: any = {
      fiscalProfile: { doctorId: doctor.id },
    };
    if (month) emittedWhere.issuedAt = dateFilter;

    const cfdisEmitted = await prisma.cfdiEmitted.findMany({
      where: emittedWhere,
      select: {
        id: true,
        uuid: true,
        folio: true,
        serie: true,
        rfcReceptor: true,
        nombreReceptor: true,
        total: true,
        issuedAt: true,
        status: true,
      },
      orderBy: { issuedAt: 'desc' },
    });

    // 2. Get SAT metadata for emitted direction (what SAT knows the doctor emitted)
    const satWhere: any = {
      doctorId: doctor.id,
      direction: 'emitted',
    };
    if (month) satWhere.issuedAt = dateFilter;

    const satEmitted = await prisma.satCfdiMetadata.findMany({
      where: satWhere,
      select: {
        uuid: true,
        monto: true,
        satStatus: true,
        issuedAt: true,
        receiverRfc: true,
        receiverName: true,
        cancelationDate: true,
      },
    });

    // 3. Cross-reference by UUID
    const satMap = new Map(satEmitted.map((s) => [s.uuid, s]));
    const emittedUuids = new Set(cfdisEmitted.map((e) => e.uuid));

    const matched: any[] = [];
    const missingFromSat: any[] = [];
    const cancelledInSat: any[] = [];
    const onlyInSat: any[] = [];

    for (const cfdi of cfdisEmitted) {
      const satRecord = satMap.get(cfdi.uuid);
      if (!satRecord) {
        // In system but not found in SAT downloads
        missingFromSat.push({
          uuid: cfdi.uuid,
          folio: cfdi.folio,
          serie: cfdi.serie,
          receptor: cfdi.nombreReceptor,
          rfcReceptor: cfdi.rfcReceptor,
          total: cfdi.total,
          issuedAt: cfdi.issuedAt,
          systemStatus: cfdi.status,
        });
      } else if (satRecord.satStatus === 'Cancelado') {
        // SAT says it's cancelled
        cancelledInSat.push({
          uuid: cfdi.uuid,
          folio: cfdi.folio,
          serie: cfdi.serie,
          receptor: cfdi.nombreReceptor,
          rfcReceptor: cfdi.rfcReceptor,
          total: cfdi.total,
          issuedAt: cfdi.issuedAt,
          systemStatus: cfdi.status,
          cancelationDate: satRecord.cancelationDate,
          alert: cfdi.status === 'active' ? 'Activa en sistema pero cancelada en SAT' : null,
        });
      } else {
        // Matched and vigente
        matched.push({
          uuid: cfdi.uuid,
          folio: cfdi.folio,
          serie: cfdi.serie,
          receptor: cfdi.nombreReceptor,
          total: cfdi.total,
          issuedAt: cfdi.issuedAt,
          satStatus: satRecord.satStatus,
        });
      }
    }

    // CFDIs in SAT but not in internal system
    for (const sat of satEmitted) {
      if (!emittedUuids.has(sat.uuid)) {
        onlyInSat.push({
          uuid: sat.uuid,
          receptor: sat.receiverName,
          rfcReceptor: sat.receiverRfc,
          monto: sat.monto,
          issuedAt: sat.issuedAt,
          satStatus: sat.satStatus,
        });
      }
    }

    return NextResponse.json({
      data: {
        matched,
        missingFromSat,
        cancelledInSat,
        onlyInSat,
      },
      summary: {
        totalEmitted: cfdisEmitted.length,
        totalInSat: satEmitted.length,
        matched: matched.length,
        missingFromSat: missingFromSat.length,
        cancelledInSat: cancelledInSat.length,
        onlyInSat: onlyInSat.length,
        hasAlerts: cancelledInSat.some((c) => c.alert),
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Doctor') || error.message?.includes('access required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error in SAT reconciliation:', error);
    return NextResponse.json({ error: 'Error en reconciliación' }, { status: 500 });
  }
}
