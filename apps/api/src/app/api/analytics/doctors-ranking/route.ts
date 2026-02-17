import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { getDoctorsRankingCached } from '@/lib/analytics';
import type { DateRange } from '@healthcare/types';

const VALID_RANGES: DateRange[] = ['7d', '28d', '90d'];
const VALID_METRICS = ['profile_view', 'contact_click', 'booking_complete', 'appointment_click', 'blog_view', 'map_click'];

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);

    const url = new URL(request.url);
    const range = (url.searchParams.get('range') || '28d') as DateRange;
    const metric = url.searchParams.get('metric') || 'profile_view';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    }
    if (!VALID_METRICS.includes(metric)) {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
    }

    const data = await getDoctorsRankingCached(range, metric, limit);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Admin access') ? 403
      : message.includes('authorization') || message.includes('token') || message.includes('expired') ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
