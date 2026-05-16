import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/metadata — List downloaded CFDI metadata
 *
 * Query params:
 *   direction — 'emitted' | 'received' (optional, defaults to both)
 *   month     — 'YYYY-MM' (optional filter)
 *   status    — 'Vigente' | 'Cancelado' (optional filter)
 *   sort      — 'asc' | 'desc' (optional, default desc)
 *   page      — page number (default 1)
 *   limit     — items per page (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const direction = url.searchParams.get('direction') as string | null;
    const month = url.searchParams.get('month');
    const status = url.searchParams.get('status');
    const sort = url.searchParams.get('sort') === 'asc' ? 'asc' as const : 'desc' as const;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

    // Build where clause
    const where: any = { doctorId: doctor.id };

    if (direction && ['emitted', 'received'].includes(direction)) {
      where.direction = direction;
    }

    if (status && ['Vigente', 'Cancelado'].includes(status)) {
      where.satStatus = status;
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNum] = month.split('-').map(Number);
      where.issuedAt = {
        gte: new Date(year, monthNum - 1, 1),
        lt: new Date(year, monthNum, 1),
      };
    }

    const [items, total] = await Promise.all([
      prisma.satCfdiMetadata.findMany({
        where,
        orderBy: { issuedAt: sort },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          uuid: true,
          direction: true,
          issuerRfc: true,
          issuerName: true,
          receiverRfc: true,
          receiverName: true,
          pacRfc: true,
          monto: true,
          efecto: true,
          satStatus: true,
          cancelationDate: true,
          issuedAt: true,
          certifiedAt: true,
        },
      }),
      prisma.satCfdiMetadata.count({ where }),
    ]);

    // Compute summary for entire month (vigentes only, ignores direction/status filters)
    // This ensures the Ingresos/Gastos/Balance cards always reflect the full month
    const baseWhere: any = { doctorId: doctor.id, satStatus: 'Vigente' };
    if (where.issuedAt) baseWhere.issuedAt = where.issuedAt;

    const [summary, ingresosAgg, gastosAgg] = await Promise.all([
      prisma.satCfdiMetadata.aggregate({
        where: baseWhere,
        _sum: { monto: true },
        _count: true,
      }),
      // Ingresos: emitted+I or received+P
      prisma.satCfdiMetadata.aggregate({
        where: {
          ...baseWhere,
          OR: [
            { direction: 'emitted', efecto: 'I' },
            { direction: 'received', efecto: 'P' },
          ],
        },
        _sum: { monto: true },
      }),
      // Gastos: received+I or emitted+P
      prisma.satCfdiMetadata.aggregate({
        where: {
          ...baseWhere,
          OR: [
            { direction: 'received', efecto: 'I' },
            { direction: 'emitted', efecto: 'P' },
          ],
        },
        _sum: { monto: true },
      }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalVigentes: summary._count,
        totalMonto: summary._sum.monto?.toNumber() ?? 0,
        totalIngresos: ingresosAgg._sum.monto?.toNumber() ?? 0,
        totalGastos: gastosAgg._sum.monto?.toNumber() ?? 0,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error listing SAT metadata:', error);
    return NextResponse.json({ error: 'Error al listar CFDIs del SAT' }, { status: 500 });
  }
}
