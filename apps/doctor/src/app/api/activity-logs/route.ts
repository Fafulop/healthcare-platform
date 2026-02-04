import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/activity-logs
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const actionType = searchParams.get('actionType');
    const entityType = searchParams.get('entityType');
    const date = searchParams.get('date'); // YYYY-MM-DD format

    // Build where clause
    const where: Record<string, unknown> = { doctorId };

    if (actionType) {
      where.actionType = actionType;
    }

    if (entityType) {
      if (entityType.includes(',')) {
        where.entityType = { in: entityType.split(',') };
      } else {
        where.entityType = entityType;
      }
    }

    if (date) {
      const dayStart = new Date(date + 'T00:00:00.000Z');
      const dayEnd = new Date(date + 'T23:59:59.999Z');
      where.timestamp = { gte: dayStart, lte: dayEnd };
    }

    // Fetch activities
    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      data: activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/activity-logs');
  }
}
