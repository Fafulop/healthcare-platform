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

    console.log(`🔍 Looking for doctor with slug: "${slug}"`);
    console.log(`👨‍⚕️ Found doctor:`, doctor);

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
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0);
      startOfMonth.setHours(0, 0, 0, 0);
      endOfMonth.setHours(23, 59, 59, 999);

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

    // Get available slots
    const slots = await prisma.appointmentSlot.findMany({
      where: {
        doctorId: doctor.id,
        date: dateFilter,
        status: 'AVAILABLE',
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
        currentBookings: true,
      },
    });

    console.log(`📅 Date filter:`, dateFilter);
    console.log(`📍 Found ${slots.length} AVAILABLE slots for doctor ID: ${doctor.id}`);

    // Debug: Check ALL slots for this doctor (any status)
    const allSlotsCount = await prisma.appointmentSlot.count({
      where: {
        doctorId: doctor.id,
        date: dateFilter,
      },
    });
    console.log(`🔢 Total slots (all statuses) for this doctor in date range: ${allSlotsCount}`);

    // Group slots by date for easier frontend consumption
    const slotsByDate: Record<string, any[]> = {};
    const availableDates: string[] = [];

    slots.forEach((slot) => {
      const dateKey = slot.date.toISOString().split('T')[0];

      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
        availableDates.push(dateKey);
      }

      slotsByDate[dateKey].push(slot);
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
