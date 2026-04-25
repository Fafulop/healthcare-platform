// GET /api/doctors/[slug]/range-availability
// Public endpoint — computes available appointment times from availability ranges.
// Requires serviceId to determine duration for gap calculation.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import {
  calculateAvailability,
  applyCutoff,
  type AvailabilityRangeInput,
  type BookingInput,
  type AvailableSlot,
} from '@/lib/availability-calculator';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const month = searchParams.get('month'); // YYYY-MM
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // serviceId is required — drives duration for gap calculation
    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'serviceId is required' },
        { status: 400 }
      );
    }

    // Find doctor by slug
    const doctor = await prisma.doctor.findUnique({
      where: { slug },
      select: {
        id: true,
        doctorFullName: true,
        appointmentBufferMinutes: true,
        defaultIntervalMinutes: true,
      },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Fetch the selected service (must belong to this doctor and be active)
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        doctorId: doctor.id,
        isBookingActive: true,
      },
      select: {
        id: true,
        serviceName: true,
        durationMinutes: true,
        price: true,
      },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Service not found or not active' },
        { status: 404 }
      );
    }

    // Build date filter
    let dateFilter: { gte: Date; lte: Date };

    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startOfMonth = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00Z`);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endOfMonth = new Date(
        `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`
      );
      dateFilter = { gte: startOfMonth, lte: endOfMonth };
    } else if (startDate && endDate) {
      dateFilter = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);
      dateFilter = { gte: start, lte: end };
    } else {
      // Default: next 30 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      dateFilter = { gte: today, lte: end };
    }

    // Fetch availability ranges for this doctor + date range
    const ranges = await prisma.availabilityRange.findMany({
      where: {
        doctorId: doctor.id,
        date: dateFilter,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        intervalMinutes: true,
        locationId: true,
        location: {
          select: { name: true },
        },
      },
    });

    // Fetch active bookings (PENDING/CONFIRMED) for this doctor + date range.
    // Includes both range-based (slotId = null) and legacy slot-based bookings.
    const bookings = await prisma.booking.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          // Range-based bookings (freeform: slotId is null, date/startTime/endTime set)
          {
            slotId: null,
            date: dateFilter,
            startTime: { not: null },
            endTime: { not: null },
          },
          // Legacy slot-based bookings
          {
            slot: { date: dateFilter },
          },
        ],
      },
      select: {
        slotId: true,
        date: true,
        startTime: true,
        endTime: true,
        extendedBlockMinutes: true,
        slot: {
          select: {
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // Group ranges by date key
    const rangesByDate = new Map<string, AvailabilityRangeInput[]>();
    for (const r of ranges) {
      const dateKey = r.date.toISOString().split('T')[0];
      if (!rangesByDate.has(dateKey)) rangesByDate.set(dateKey, []);
      rangesByDate.get(dateKey)!.push({
        id: r.id,
        startTime: r.startTime,
        endTime: r.endTime,
        intervalMinutes: r.intervalMinutes,
        locationId: r.locationId,
        locationName: r.location?.name ?? null,
      });
    }

    // Group bookings by date key
    const bookingsByDate = new Map<string, BookingInput[]>();
    for (const b of bookings) {
      // Resolve date/time from either freeform fields or slot
      const rawDate = b.slotId ? b.slot?.date : b.date;
      const rawStart = b.slotId ? b.slot?.startTime : b.startTime;
      const rawEnd = b.slotId ? b.slot?.endTime : b.endTime;
      if (!rawDate || !rawStart || !rawEnd) continue;

      const dateKey = (rawDate instanceof Date ? rawDate : new Date(rawDate))
        .toISOString()
        .split('T')[0];

      if (!bookingsByDate.has(dateKey)) bookingsByDate.set(dateKey, []);
      bookingsByDate.get(dateKey)!.push({
        startTime: rawStart,
        endTime: rawEnd,
        extendedBlockMinutes: b.extendedBlockMinutes,
      });
    }

    // Compute availability for each date
    const timeSlots: Record<string, AvailableSlot[]> = {};
    const availableDates: string[] = [];

    for (const [dateKey, dateRanges] of rangesByDate) {
      const dateBookings = bookingsByDate.get(dateKey) ?? [];

      let slots = calculateAvailability({
        ranges: dateRanges,
        bookings: dateBookings,
        serviceDurationMinutes: service.durationMinutes,
        bufferMinutes: doctor.appointmentBufferMinutes,
      });

      // Apply 1-hour cutoff for today (Mexico City TZ)
      slots = applyCutoff(slots, dateKey);

      if (slots.length > 0) {
        availableDates.push(dateKey);
        timeSlots[dateKey] = slots;
      }
    }

    return NextResponse.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.doctorFullName,
      },
      service: {
        id: service.id,
        name: service.serviceName,
        durationMinutes: service.durationMinutes,
        price: service.price,
      },
      bufferMinutes: doctor.appointmentBufferMinutes,
      availableDates,
      timeSlots,
    });
  } catch (error) {
    console.error('Error fetching range availability:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
