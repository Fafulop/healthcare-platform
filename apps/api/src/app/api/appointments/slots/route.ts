// POST /api/appointments/slots - Create appointment slots (single or bulk)
// GET /api/appointments/slots - Get slots for a doctor (with filters)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdmin } from '@healthcare/auth';

// Helper function to calculate final price
function calculateFinalPrice(
  basePrice: number,
  discount: number | null,
  discountType: string | null
): number {
  if (!discount || !discountType) return basePrice;

  if (discountType === 'PERCENTAGE') {
    return basePrice - (basePrice * discount) / 100;
  } else if (discountType === 'FIXED') {
    return Math.max(0, basePrice - discount);
  }

  return basePrice;
}

// Helper function to generate time slots
function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  breakStart?: string,
  breakEnd?: string
): Array<{ startTime: string; endTime: string }> {
  const slots: Array<{ startTime: string; endTime: string }> = [];

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentHour = startHour;
  let currentMin = startMin;

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  let breakStartMin: number | null = null;
  let breakEndMin: number | null = null;

  if (breakStart && breakEnd) {
    const [bsHour, bsMin] = breakStart.split(':').map(Number);
    const [beHour, beMin] = breakEnd.split(':').map(Number);
    breakStartMin = bsHour * 60 + bsMin;
    breakEndMin = beHour * 60 + beMin;
  }

  let currentMinutes = startMinutes;

  while (currentMinutes + duration <= endMinutes) {
    const slotEndMinutes = currentMinutes + duration;

    // Skip if slot overlaps with break time
    if (
      breakStartMin !== null &&
      breakEndMin !== null &&
      !(slotEndMinutes <= breakStartMin || currentMinutes >= breakEndMin)
    ) {
      // This slot overlaps with break, skip to after break
      if (currentMinutes < breakEndMin) {
        currentMinutes = breakEndMin;
      }
      continue;
    }

    const sh = Math.floor(currentMinutes / 60);
    const sm = currentMinutes % 60;
    const eh = Math.floor(slotEndMinutes / 60);
    const em = slotEndMinutes % 60;

    slots.push({
      startTime: `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}`,
      endTime: `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`,
    });

    currentMinutes += duration;
  }

  return slots;
}

// GET - Get slots for a doctor
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    if (!doctorId) {
      return NextResponse.json(
        { success: false, error: 'doctorId is required' },
        { status: 400 }
      );
    }

    const where: any = { doctorId };

    // Date range filter
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    const slots = await prisma.appointmentSlot.findMany({
      where,
      include: {
        bookings: {
          where: { status: { notIn: ['CANCELLED'] } },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      count: slots.length,
      data: slots,
    });
  } catch (error) {
    console.error('Error fetching appointment slots:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch appointment slots',
      },
      { status: 500 }
    );
  }
}

// POST - Create appointment slots
export async function POST(request: Request) {
  try {
    // TODO: Add authentication check for doctor or admin
    // For now, allow creation in development

    const body = await request.json();
    const {
      doctorId,
      mode, // "single" or "recurring"
      date,
      startDate,
      endDate,
      daysOfWeek, // [0, 1, 2, 3, 4] (Monday-Friday)
      startTime,
      endTime,
      duration,
      breakStart,
      breakEnd,
      basePrice,
      discount,
      discountType,
    } = body;

    // Validation
    if (!doctorId || !basePrice || !duration || !startTime || !endTime) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    if (duration !== 30 && duration !== 60) {
      return NextResponse.json(
        {
          success: false,
          error: 'Duration must be 30 or 60 minutes',
        },
        { status: 400 }
      );
    }

    const finalPrice = calculateFinalPrice(basePrice, discount, discountType);

    // Generate time slots for the day
    const timeSlots = generateTimeSlots(
      startTime,
      endTime,
      duration,
      breakStart,
      breakEnd
    );

    if (timeSlots.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid time slots generated',
        },
        { status: 400 }
      );
    }

    // Single day mode
    if (mode === 'single') {
      if (!date) {
        return NextResponse.json(
          { success: false, error: 'Date is required for single mode' },
          { status: 400 }
        );
      }

      const slotDate = new Date(date);
      slotDate.setHours(0, 0, 0, 0);

      const slotsToCreate = timeSlots.map((slot) => ({
        doctorId,
        date: slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration,
        basePrice,
        discount,
        discountType,
        finalPrice,
      }));

      const created = await prisma.appointmentSlot.createMany({
        data: slotsToCreate,
        skipDuplicates: true, // Skip if slot already exists
      });

      return NextResponse.json({
        success: true,
        message: `Created ${created.count} slots`,
        count: created.count,
      });
    }

    // Recurring mode
    if (mode === 'recurring') {
      if (!startDate || !endDate || !daysOfWeek || daysOfWeek.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              'startDate, endDate, and daysOfWeek are required for recurring mode',
          },
          { status: 400 }
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const allSlotsToCreate: any[] = [];

      // Iterate through each day in the range
      for (
        let currentDate = new Date(start);
        currentDate <= end;
        currentDate.setDate(currentDate.getDate() + 1)
      ) {
        const dayOfWeek = currentDate.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Sunday=6

        if (daysOfWeek.includes(adjustedDay)) {
          const slotDate = new Date(currentDate);
          slotDate.setHours(0, 0, 0, 0);

          const slotsForDay = timeSlots.map((slot) => ({
            doctorId,
            date: slotDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            duration,
            basePrice,
            discount,
            discountType,
            finalPrice,
          }));

          allSlotsToCreate.push(...slotsForDay);
        }
      }

      if (allSlotsToCreate.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No slots to create for the selected days',
          },
          { status: 400 }
        );
      }

      const created = await prisma.appointmentSlot.createMany({
        data: allSlotsToCreate,
        skipDuplicates: true,
      });

      return NextResponse.json({
        success: true,
        message: `Created ${created.count} recurring slots`,
        count: created.count,
        totalPossible: allSlotsToCreate.length,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid mode. Must be "single" or "recurring"',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating appointment slots:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create appointment slots',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
