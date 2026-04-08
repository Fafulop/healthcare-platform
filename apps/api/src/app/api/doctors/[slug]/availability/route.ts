// GET /api/doctors/[slug]/availability - Get available appointment slots for a doctor

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const month = searchParams.get('month'); // YYYY-MM format

    // Find doctor by slug
    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      select: { id: true, doctorFullName: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Build date filter
    let dateFilter: any = {};

    if (month) {
      // Get all slots for a specific month
      const [year, monthNum] = month.split('-').map(Number);
      const startOfMonth = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00Z`);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endOfMonth = new Date(`${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`);

      dateFilter = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    } else if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      // Default to 30 days from startDate
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);
      dateFilter = {
        gte: start,
        lte: end,
      };
    } else {
      // Default to next 30 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDay = new Date(today);
      endDay.setDate(endDay.getDate() + 30);
      dateFilter = {
        gte: today,
        lte: endDay,
      };
    }

    // Get available public slots (isOpen = true, isPublic = true), compute live booking count via _count
    const allSlots = await prisma.appointmentSlot.findMany({
      where: {
        doctorId: doctor.id,
        date: dateFilter,
        isOpen: true,
        isPublic: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        duration: true,
        basePrice: true,
        discount: true,
        discountType: true,
        finalPrice: true,
        maxBookings: true,
        isOpen: true,
        location: {
          select: { name: true, address: true },
        },
        _count: {
          select: {
            bookings: {
              where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
            },
          },
        },
      },
    });

    // Filter out fully booked slots using live booking count (not stale currentBookings field)
    // Also filter out slots on today that have already passed or are within 1 hour from now.
    // All times are evaluated in America/Mexico_City since that's where clinics operate.
    // sv-SE locale with a named timezone gives a "YYYY-MM-DD HH:MM:SS" string that is easy to parse.
    const nowMXStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
    const todayMX = nowMXStr.split(' ')[0]; // "YYYY-MM-DD"
    const [currentHour, currentMinute] = nowMXStr.split(' ')[1].slice(0, 5).split(':').map(Number);
    // Cutoff = current time + 60 minutes. Slots starting at or before this are hidden.
    const cutoffTotalMinutes = currentHour * 60 + currentMinute + 60;
    // If cutoff overflows past midnight, use "24:00" which is > any valid HH:MM slot time.
    const cutoffTime = cutoffTotalMinutes >= 24 * 60
      ? '24:00'
      : `${String(Math.floor(cutoffTotalMinutes / 60)).padStart(2, '0')}:${String(cutoffTotalMinutes % 60).padStart(2, '0')}`;

    const slots = allSlots.filter(slot => {
      if (slot._count.bookings >= slot.maxBookings) return false; // fully booked
      const dateKey = slot.date.toISOString().split('T')[0];
      if (dateKey !== todayMX) return true;            // not today → always visible
      return slot.startTime > cutoffTime;              // today → hide if within 1 hour
    });

    // Group slots by date for easier frontend consumption
    const slotsByDate: Record<string, any[]> = {};
    const availableDates: string[] = [];

    slots.forEach((slot) => {
      const { _count, location, ...slotData } = slot;
      const dateKey = slot.date.toISOString().split('T')[0];

      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
        availableDates.push(dateKey);
      }

      slotsByDate[dateKey].push({
        ...slotData,
        currentBookings: _count.bookings, // live count for backward compat
        location: location ?? null,
      });
    });

    return NextResponse.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.doctorFullName,
      },
      availableDates, // Array of dates with availability
      slotsByDate, // Slots grouped by date
      totalSlots: slots.length,
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch availability',
      },
      { status: 500 }
    );
  }
}
