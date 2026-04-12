// GET /api/appointments/bookings/stats
// Returns booking counts grouped by month and status for the authenticated doctor.
// Query params:
//   year (optional) — 4-digit year, defaults to current year

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { getAuthenticatedDoctor } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { doctor } = await getAuthenticatedDoctor(request);

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: 'Año inválido' }, { status: 400 });
    }

    const startDate = new Date(year, 0, 1);       // Jan 1
    const endDate   = new Date(year + 1, 0, 1);   // Jan 1 of next year

    // Fetch all bookings for the doctor in the given year.
    // Date comes from the linked slot (slot-based) or directly from the booking (freeform).
    const bookings = await prisma.booking.findMany({
      where: { doctorId: doctor.id },
      select: {
        status: true,
        slot:   { select: { date: true } },
        date:   true,
        createdAt: true,
      },
    });

    // Group by month key (YYYY-MM) for the requested year
    const monthlyStats: Record<string, Record<string, number>> = {};

    for (const booking of bookings) {
      const raw = booking.slot?.date ?? booking.date ?? booking.createdAt;
      if (!raw) continue;

      const d = new Date(raw);
      if (d < startDate || d >= endDate) continue;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {};
      }
      const s = booking.status;
      monthlyStats[monthKey][s] = (monthlyStats[monthKey][s] ?? 0) + 1;
    }

    // Build all 12 months for the year (fill gaps with zeros)
    const months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }

    const data = months.map((month) => {
      const counts = monthlyStats[month] ?? {};
      return {
        month,
        PENDING:   counts['PENDING']   ?? 0,
        CONFIRMED: counts['CONFIRMED'] ?? 0,
        COMPLETED: counts['COMPLETED'] ?? 0,
        NO_SHOW:   counts['NO_SHOW']   ?? 0,
        CANCELLED: counts['CANCELLED'] ?? 0,
      };
    });

    // Also return available years that have at least one booking (for the year selector)
    const allYears = new Set<number>();
    for (const booking of bookings) {
      const raw = booking.slot?.date ?? booking.date ?? booking.createdAt;
      if (!raw) continue;
      allYears.add(new Date(raw).getFullYear());
    }
    // Always include current year
    allYears.add(new Date().getFullYear());

    return NextResponse.json({
      success: true,
      year,
      data,
      availableYears: [...allYears].sort((a, b) => b - a),
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas de citas' },
      { status: 500 }
    );
  }
}
