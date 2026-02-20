/**
 * GET /api/llm-usage
 *
 * Admin-only endpoint: returns LLM token usage aggregated across all doctors.
 *
 * Query params:
 *   range: '7d' | '28d' | '90d' (default '28d')
 *
 * Response:
 *   { range, since, totalTokens, totalRequests, promptTokens, completionTokens,
 *     byDoctor: [...], byEndpoint: [...] }
 */

import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { prisma } from '@healthcare/database';

const VALID_RANGES = ['7d', '28d', '90d'] as const;
type Range = typeof VALID_RANGES[number];

function getSince(range: Range): Date {
  const days = range === '7d' ? 7 : range === '28d' ? 28 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);

    const url = new URL(request.url);
    const range = (url.searchParams.get('range') || '28d') as Range;
    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range. Use 7d, 28d, or 90d' }, { status: 400 });
    }

    const since = getSince(range);

    // Aggregate totals by doctor
    const byDoctorRaw = await prisma.llmTokenUsage.groupBy({
      by: ['doctorId'],
      where: { createdAt: { gte: since } },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    });

    // Aggregate totals by endpoint (global)
    const byEndpointRaw = await prisma.llmTokenUsage.groupBy({
      by: ['endpoint'],
      where: { createdAt: { gte: since } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    });

    // Aggregate by doctor + endpoint for detailed breakdown
    const byDoctorEndpointRaw = await prisma.llmTokenUsage.groupBy({
      by: ['doctorId', 'endpoint'],
      where: { createdAt: { gte: since } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
    });

    // Fetch doctor names
    const doctorIds = byDoctorRaw.map((d) => d.doctorId);
    const doctors = await prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, doctorFullName: true, slug: true },
    });
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    // Build per-doctor endpoint map
    const doctorEndpoints = new Map<string, Array<{ endpoint: string; totalTokens: number; promptTokens: number; completionTokens: number; requests: number }>>();
    for (const row of byDoctorEndpointRaw) {
      const list = doctorEndpoints.get(row.doctorId) ?? [];
      list.push({
        endpoint: row.endpoint,
        totalTokens: row._sum.totalTokens ?? 0,
        promptTokens: row._sum.promptTokens ?? 0,
        completionTokens: row._sum.completionTokens ?? 0,
        requests: row._count.id,
      });
      doctorEndpoints.set(row.doctorId, list);
    }

    // Compute overall totals
    let totalTokens = 0;
    let totalRequests = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    for (const row of byDoctorRaw) {
      totalTokens += row._sum.totalTokens ?? 0;
      totalRequests += row._count.id;
      totalPromptTokens += row._sum.promptTokens ?? 0;
      totalCompletionTokens += row._sum.completionTokens ?? 0;
    }

    const byDoctor = byDoctorRaw.map((row) => {
      const doctor = doctorMap.get(row.doctorId);
      const endpoints = (doctorEndpoints.get(row.doctorId) ?? []).sort(
        (a, b) => b.totalTokens - a.totalTokens
      );
      return {
        doctorId: row.doctorId,
        doctorName: doctor?.doctorFullName ?? 'Doctor desconocido',
        slug: doctor?.slug ?? '',
        totalTokens: row._sum.totalTokens ?? 0,
        promptTokens: row._sum.promptTokens ?? 0,
        completionTokens: row._sum.completionTokens ?? 0,
        requests: row._count.id,
        byEndpoint: endpoints,
      };
    });

    const byEndpoint = byEndpointRaw.map((row) => ({
      endpoint: row.endpoint,
      totalTokens: row._sum.totalTokens ?? 0,
      promptTokens: row._sum.promptTokens ?? 0,
      completionTokens: row._sum.completionTokens ?? 0,
      requests: row._count.id,
    }));

    return NextResponse.json({
      range,
      since: since.toISOString(),
      totalTokens,
      totalRequests,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      uniqueDoctors: byDoctorRaw.length,
      byDoctor,
      byEndpoint,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Admin access') ? 403
      : message.includes('authorization') || message.includes('token') || message.includes('expired') ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
