import { NextResponse } from 'next/server';
import { validateAuthToken } from '@/lib/auth';
import { getDoctorAnalytics } from '@/lib/analytics';
import { prisma } from '@healthcare/database';
import type { DateRange } from '@healthcare/types';

const VALID_RANGES: DateRange[] = ['7d', '28d', '90d'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await validateAuthToken(request);
    const { slug } = await params;

    // Doctors can only view their own analytics; admins can view any
    if (user.role === 'DOCTOR') {
      const doctor = user.doctorId
        ? await prisma.doctor.findUnique({
            where: { id: user.doctorId },
            select: { slug: true },
          })
        : null;

      if (!doctor || doctor.slug !== slug) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const url = new URL(request.url);
    const range = (url.searchParams.get('range') || '28d') as DateRange;
    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range. Use 7d, 28d, or 90d' }, { status: 400 });
    }

    const data = await getDoctorAnalytics(slug, range);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('authorization') || message.includes('token') || message.includes('expired') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
