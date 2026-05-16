import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

/**
 * GET /api/sat-descarga/alerts — List alerts for current doctor
 *
 * Query params:
 *   unreadOnly — "true" to filter only unread (default: false)
 *   limit — number of alerts to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const url = new URL(request.url);

    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    const where: any = { doctorId: doctor.id };
    if (unreadOnly) where.read = false;

    const [alerts, unreadCount] = await Promise.all([
      prisma.satAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.satAlert.count({
        where: { doctorId: doctor.id, read: false },
      }),
    ]);

    return NextResponse.json({ data: { alerts, unreadCount } });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching SAT alerts:', error);
    return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 });
  }
}

/**
 * PATCH /api/sat-descarga/alerts — Mark alerts as read
 *
 * Body: { ids: number[] } or { all: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);
    const body = await request.json();

    if (body.all === true) {
      await prisma.satAlert.updateMany({
        where: { doctorId: doctor.id, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await prisma.satAlert.updateMany({
        where: {
          id: { in: body.ids },
          doctorId: doctor.id, // ownership check
        },
        data: { read: true },
      });
    } else {
      return NextResponse.json({ error: 'Provide ids array or all: true' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating SAT alerts:', error);
    return NextResponse.json({ error: 'Error al actualizar alertas' }, { status: 500 });
  }
}
