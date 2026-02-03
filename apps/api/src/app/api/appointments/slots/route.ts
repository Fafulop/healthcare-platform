// POST /api/appointments/slots - Create appointment slots (single or bulk)
// GET /api/appointments/slots - Get slots for a doctor (with filters)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logSlotsCreated } from '@/lib/activity-logger';

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

    // isOpen filter (replaces status filter)
    if (status) {
      // Map old status values to isOpen for backward compatibility
      if (status === 'AVAILABLE') {
        where.isOpen = true;
      } else if (status === 'BLOCKED') {
        where.isOpen = false;
      }
      // Note: BOOKED is now computed (currentBookings >= maxBookings), not stored
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
    // Authenticate user
    const { email, role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

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
      replaceConflicts, // NEW: If true, delete conflicting slots and create new ones
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

    // Authorization: Doctors can only create slots for themselves, admins can create for anyone
    if (role === 'DOCTOR') {
      if (!authenticatedDoctorId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Doctor profile not found for this user',
          },
          { status: 403 }
        );
      }

      if (doctorId !== authenticatedDoctorId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized - you can only create appointment slots for yourself',
          },
          { status: 403 }
        );
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - only doctors and admins can create appointment slots',
        },
        { status: 403 }
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

      const slotDate = new Date(date + 'T12:00:00Z');
      slotDate.setUTCHours(0, 0, 0, 0);

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

      // Check for existing slots (same-type conflict detection)
      const existingSlots = await prisma.appointmentSlot.findMany({
        where: {
          doctorId,
          date: slotDate,
          startTime: {
            in: slotsToCreate.map((s) => s.startTime),
          },
        },
        include: {
          bookings: {
            where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
          },
        },
      });

      // If conflicts exist and replaceConflicts is false, return 409
      if (existingSlots.length > 0 && !replaceConflicts) {
        return NextResponse.json(
          {
            success: false,
            error: 'Slot conflicts detected',
            conflicts: existingSlots.map((slot) => ({
              id: slot.id,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              currentBookings: slot.currentBookings,
              maxBookings: slot.maxBookings,
              hasBookings: slot.bookings.length > 0,
            })),
            message: `Ya existen ${existingSlots.length} horarios en estos tiempos`,
          },
          { status: 409 }
        );
      }

      // Check for tasks at these times (informational only, not blocking)
      const tasksAtTimes = await prisma.task.findMany({
        where: {
          doctorId,
          dueDate: slotDate,
          startTime: {
            not: null,
          },
          endTime: {
            not: null,
          },
          status: {
            in: ['PENDIENTE', 'EN_PROGRESO'],
          },
        },
      });

      // Filter tasks that actually overlap with our slots
      const overlappingTasks = tasksAtTimes.filter((task) => {
        return slotsToCreate.some((slot) => {
          // Time overlap check: task.start < slot.end AND task.end > slot.start
          return task.startTime! < slot.endTime && task.endTime! > slot.startTime;
        });
      });

      // If replaceConflicts, delete existing slots first (atomic with creation)
      if (replaceConflicts && existingSlots.length > 0) {
        await prisma.appointmentSlot.deleteMany({
          where: {
            id: {
              in: existingSlots.map((s) => s.id),
            },
          },
        });
      }

      // Create new slots
      const created = await prisma.appointmentSlot.createMany({
        data: slotsToCreate,
        skipDuplicates: false, // Don't skip, we already handled conflicts
      });

      // Log activity
      logSlotsCreated({
        doctorId,
        count: created.count,
        mode: 'single',
        date,
        startTime,
        endTime,
        duration,
        basePrice,
      });

      return NextResponse.json({
        success: true,
        message: `Created ${created.count} slots`,
        count: created.count,
        replaced: replaceConflicts ? existingSlots.length : 0,
        tasksInfo:
          overlappingTasks.length > 0
            ? {
                count: overlappingTasks.length,
                message: `Tienes ${overlappingTasks.length} pendiente(s) a estas horas`,
                tasks: overlappingTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  startTime: t.startTime,
                  endTime: t.endTime,
                })),
              }
            : null,
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

      const start = new Date(startDate + 'T12:00:00Z');
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate + 'T12:00:00Z');
      end.setUTCHours(23, 59, 59, 999);

      const allSlotsToCreate: any[] = [];

      // Iterate through each day in the range
      for (
        let currentDate = new Date(start);
        currentDate <= end;
        currentDate.setDate(currentDate.getDate() + 1)
      ) {
        const dayOfWeek = currentDate.getUTCDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Sunday=6

        if (daysOfWeek.includes(adjustedDay)) {
          const slotDate = new Date(currentDate);
          slotDate.setUTCHours(0, 0, 0, 0);

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

      // Check for existing slots (same-type conflict detection)
      // Get all dates we're trying to create slots for
      const uniqueDates = Array.from(
        new Set(allSlotsToCreate.map((s) => s.date.toISOString()))
      ).map((d) => new Date(d));

      const existingSlots = await prisma.appointmentSlot.findMany({
        where: {
          doctorId,
          date: {
            in: uniqueDates,
          },
          // Check if any of the times match
          OR: allSlotsToCreate.map((slot) => ({
            date: slot.date,
            startTime: slot.startTime,
          })),
        },
        include: {
          bookings: {
            where: { status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
          },
        },
      });

      // If conflicts exist and replaceConflicts is false, return 409
      if (existingSlots.length > 0 && !replaceConflicts) {
        return NextResponse.json(
          {
            success: false,
            error: 'Slot conflicts detected',
            conflicts: existingSlots.map((slot) => ({
              id: slot.id,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              currentBookings: slot.currentBookings,
              maxBookings: slot.maxBookings,
              hasBookings: slot.bookings.length > 0,
            })),
            message: `Ya existen ${existingSlots.length} horarios en estos tiempos`,
          },
          { status: 409 }
        );
      }

      // Check for tasks at these times (informational only)
      const tasksAtTimes = await prisma.task.findMany({
        where: {
          doctorId,
          dueDate: {
            in: uniqueDates,
          },
          startTime: {
            not: null,
          },
          endTime: {
            not: null,
          },
          status: {
            in: ['PENDIENTE', 'EN_PROGRESO'],
          },
        },
      });

      // Filter tasks that actually overlap
      const overlappingTasks = tasksAtTimes.filter((task) => {
        return allSlotsToCreate.some((slot) => {
          const sameDate = task.dueDate?.toISOString() === slot.date.toISOString();
          const timeOverlap =
            task.startTime! < slot.endTime && task.endTime! > slot.startTime;
          return sameDate && timeOverlap;
        });
      });

      // If replaceConflicts, delete existing slots first
      if (replaceConflicts && existingSlots.length > 0) {
        await prisma.appointmentSlot.deleteMany({
          where: {
            id: {
              in: existingSlots.map((s) => s.id),
            },
          },
        });
      }

      // Create new slots
      const created = await prisma.appointmentSlot.createMany({
        data: allSlotsToCreate,
        skipDuplicates: false,
      });

      // Log activity
      logSlotsCreated({
        doctorId,
        count: created.count,
        mode: 'recurring',
        startDate,
        endDate,
        startTime,
        endTime,
        duration,
        basePrice,
      });

      return NextResponse.json({
        success: true,
        message: `Created ${created.count} recurring slots`,
        count: created.count,
        totalPossible: allSlotsToCreate.length,
        replaced: replaceConflicts ? existingSlots.length : 0,
        tasksInfo:
          overlappingTasks.length > 0
            ? {
                count: overlappingTasks.length,
                message: `Tienes ${overlappingTasks.length} pendiente(s) a estas horas`,
                tasks: overlappingTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  dueDate: t.dueDate,
                  startTime: t.startTime,
                  endTime: t.endTime,
                })),
              }
            : null,
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

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 401 }
        );
      }
    }

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
