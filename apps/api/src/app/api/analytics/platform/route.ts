import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { getPlatformAnalytics } from '@/lib/analytics';
import type { DateRange } from '@healthcare/types';

const VALID_RANGES: DateRange[] = ['7d', '28d', '90d'];

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);

    const url = new URL(request.url);
    const range = (url.searchParams.get('range') || '28d') as DateRange;
    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range. Use 7d, 28d, or 90d' }, { status: 400 });
    }

    const data = await getPlatformAnalytics(range);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Admin access') ? 403
      : message.includes('authorization') || message.includes('token') || message.includes('expired') ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
