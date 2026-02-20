/**
 * GET /api/llm-usage/my
 *
 * Doctor-authenticated endpoint: returns the authenticated doctor's own
 * LLM token usage, broken down by endpoint and by day.
 *
 * Query params:
 *   range: '7d' | '28d' | '90d' (default '28d')
 *
 * Response:
 *   { range, since, totalTokens, totalRequests, promptTokens, completionTokens,
 *     byEndpoint: [...], daily: [...] }
 */

import { NextResponse } from 'next/server';
import { validateAuthToken } from '@/lib/auth';
import { prisma } from '@healthcare/database';

const VALID_RANGES = ['7d', '28d', '90d'] as const;
type Range = typeof VALID_RANGES[number];

function getSince(range: Range): Date {
  const days = range === '7d' ? 7 : range === '28d' ? 28 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  try {
    const user = await validateAuthToken(request);

    if (!['DOCTOR', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
    }

    if (!user.doctorId) {
      return NextResponse.json({ error: 'No doctor profile linked to this account' }, { status: 403 });
    }

    const url = new URL(request.url);
    const range = (url.searchParams.get('range') || '28d') as Range;
    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range. Use 7d, 28d, or 90d' }, { status: 400 });
    }

    const since = getSince(range);
    const doctorId = user.doctorId;

    // Aggregate by endpoint
    const byEndpointRaw = await prisma.llmTokenUsage.groupBy({
      by: ['endpoint'],
      where: { doctorId, createdAt: { gte: since } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    });

    // Fetch raw rows for daily grouping (lightweight: only date + tokens)
    const rows = await prisma.llmTokenUsage.findMany({
      where: { doctorId, createdAt: { gte: since } },
      select: { createdAt: true, totalTokens: true, promptTokens: true, completionTokens: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date string YYYY-MM-DD
    const dailyMap = new Map<string, { tokens: number; promptTokens: number; completionTokens: number; requests: number }>();
    for (const row of rows) {
      const date = row.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) ?? { tokens: 0, promptTokens: 0, completionTokens: 0, requests: 0 };
      existing.tokens += row.totalTokens;
      existing.promptTokens += row.promptTokens;
      existing.completionTokens += row.completionTokens;
      existing.requests += 1;
      dailyMap.set(date, existing);
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    // Overall totals
    let totalTokens = 0;
    let totalRequests = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    for (const row of byEndpointRaw) {
      totalTokens += row._sum.totalTokens ?? 0;
      totalRequests += row._count.id;
      promptTokens += row._sum.promptTokens ?? 0;
      completionTokens += row._sum.completionTokens ?? 0;
    }

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
      promptTokens,
      completionTokens,
      byEndpoint,
      daily,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('authorization') || message.includes('token') || message.includes('expired') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
