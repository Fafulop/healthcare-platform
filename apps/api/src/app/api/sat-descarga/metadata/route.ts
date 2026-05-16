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
        orderBy: { issuedAt: 'desc' },
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

    // Compute summary for current filter
    const summary = await prisma.satCfdiMetadata.aggregate({
      where: { ...where, satStatus: 'Vigente' },
      _sum: { monto: true },
      _count: true,
    });

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
