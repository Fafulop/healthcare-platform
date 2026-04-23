// POST /api/appointments/ranges - Create availability ranges (single or recurring)
// GET  /api/appointments/ranges - Get ranges for a doctor (with date filters)

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import { logActivity } from '@/lib/activity-logger';

const VALID_INTERVALS = [15, 30, 45, 60];

/** Validate that a time string is on a 15-minute boundary ("HH:00", "HH:15", "HH:30", "HH:45"). */
function isValid15MinBoundary(time: string): boolean {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 0 && h <= 23 && [0, 15, 30, 45].includes(m);
}

/** Check if two time ranges overlap. Times are "HH:MM" strings. */
function timesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// GET — List ranges for a doctor
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    // Authenticate — ranges are doctor-private data
    const { role, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const { searchParams } = new URL(request.url);
    const requestedDoctorId = searchParams.get('doctorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Scope by role (same pattern as bookings GET)
    const where: any = {};

    if (role === 'ADMIN') {
      if (requestedDoctorId) {
        where.doctorId = requestedDoctorId;
      }
    } else if (role === 'DOCTOR') {
      if (!authenticatedDoctorId) {
        return NextResponse.json(
          { success: false, error: 'Doctor profile not found for this user' },
          { status: 403 }
        );
      }
      // Doctors can ONLY see their own ranges
      where.doctorId = authenticatedDoctorId;
    } else {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.date = { gte: new Date(startDate) };
    }

    const ranges = await prisma.availabilityRange.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });

    return NextResponse.json({
      success: true,
      count: ranges.length,
      data: ranges,
    });
  } catch (error) {
    console.error('Error fetching availability ranges:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch availability ranges' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create availability ranges (single day or recurring)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // Authenticate
    const { email, role, userId, doctorId: authenticatedDoctorId } = await validateAuthToken(request);

    const body = await request.json();
    const {
      doctorId,
      mode,           // "single" | "recurring"
      date,           // single mode: "YYYY-MM-DD"
      startDate,      // recurring mode
      endDate,        // recurring mode
      daysOfWeek,     // recurring mode: [0,1,2,3,4] (Mon=0 … Sun=6)
      startTime,      // "HH:MM"
      endTime,        // "HH:MM"
      intervalMinutes, // optional — defaults to doctor's defaultIntervalMinutes
      locationId,     // optional
    } = body;

    // --- Basic validation ---

    if (!doctorId || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'doctorId, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    // --- Authorization: doctors can only create for themselves ---

    if (role === 'DOCTOR') {
      if (!authenticatedDoctorId) {
        return NextResponse.json(
          { success: false, error: 'Doctor profile not found for this user' },
          { status: 403 }
        );
      }
      if (doctorId !== authenticatedDoctorId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized — you can only create ranges for yourself' },
          { status: 403 }
        );
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — only doctors and admins can create ranges' },
        { status: 403 }
      );
    }

    // --- Time validation ---

    if (!isValid15MinBoundary(startTime) || !isValid15MinBoundary(endTime)) {
      return NextResponse.json(
        { success: false, error: 'startTime and endTime must be on 15-minute boundaries (e.g., 09:00, 09:15, 09:30, 09:45)' },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { success: false, error: 'endTime must be after startTime' },
        { status: 400 }
      );
    }

    // --- Interval validation ---

    // Fetch doctor to get default interval
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, defaultIntervalMinutes: true },
    });

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      );
    }

    const resolvedInterval = intervalMinutes ?? doctor.defaultIntervalMinutes;

    if (!VALID_INTERVALS.includes(resolvedInterval)) {
      return NextResponse.json(
        { success: false, error: 'intervalMinutes must be 15, 30, 45, or 60' },
        { status: 400 }
      );
    }

    // --- Location validation (if provided) ---

    if (locationId) {
      const location = await prisma.clinicLocation.findFirst({
        where: { id: locationId, doctorId },
      });
      if (!location) {
        return NextResponse.json(
          { success: false, error: 'Location not found or does not belong to this doctor' },
          { status: 400 }
        );
      }
    }

    // --- Resolve location: default to doctor's first location if not provided ---

    let resolvedLocationId: string | null = locationId || null;
    if (!resolvedLocationId) {
      const defaultLoc = await prisma.clinicLocation.findFirst({
        where: { doctorId },
        orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }],
        select: { id: true },
      });
      resolvedLocationId = defaultLoc?.id ?? null;
    }

    // --- Build list of dates ---

    const dates: Date[] = [];

    if (mode === 'single') {
      if (!date) {
        return NextResponse.json(
          { success: false, error: 'date is required for single mode' },
          { status: 400 }
        );
      }
      const d = new Date(date + 'T12:00:00Z');
      d.setUTCHours(0, 0, 0, 0);
      dates.push(d);

    } else if (mode === 'recurring') {
      if (!startDate || !endDate || !daysOfWeek || daysOfWeek.length === 0) {
        return NextResponse.json(
          { success: false, error: 'startDate, endDate, and daysOfWeek are required for recurring mode' },
          { status: 400 }
        );
      }

      const start = new Date(startDate + 'T12:00:00Z');
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate + 'T12:00:00Z');
      end.setUTCHours(0, 0, 0, 0);

      for (
        let cur = new Date(start);
        cur <= end;
        cur.setDate(cur.getDate() + 1)
      ) {
        const dayOfWeek = cur.getUTCDay();
        // Convert JS Sunday=0 to our format Monday=0…Sunday=6
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (daysOfWeek.includes(adjustedDay)) {
          const d = new Date(cur);
          d.setUTCHours(0, 0, 0, 0);
          dates.push(d);
        }
      }

      if (dates.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No matching dates found for the selected days' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'mode must be "single" or "recurring"' },
        { status: 400 }
      );
    }

    // --- Overlap detection: check existing ranges on these dates ---

    const existingRanges = await prisma.availabilityRange.findMany({
      where: {
        doctorId,
        date: { in: dates },
      },
      select: { id: true, date: true, startTime: true, endTime: true },
    });

    const conflicts: Array<{ date: string; existingStart: string; existingEnd: string }> = [];

    for (const existing of existingRanges) {
      const dateKey = existing.date.toISOString().split('T')[0];
      // Check if the date we're creating for overlaps in time
      if (timesOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
        conflicts.push({
          date: dateKey,
          existingStart: existing.startTime,
          existingEnd: existing.endTime,
        });
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Se encontraron ${conflicts.length} conflicto(s) con rangos existentes`,
          conflicts,
        },
        { status: 409 }
      );
    }

    // --- Create ranges ---

    const rangesToCreate = dates.map((d) => ({
      doctorId,
      date: d,
      startTime,
      endTime,
      intervalMinutes: resolvedInterval,
      locationId: resolvedLocationId,
    }));

    const created = await prisma.availabilityRange.createMany({
      data: rangesToCreate,
    });

    // --- Log activity ---

    const dateInfo = mode === 'single'
      ? date
      : `${startDate} a ${endDate}`;

    logActivity({
      doctorId,
      userId,
      actionType: 'RANGES_CREATED',
      entityType: 'APPOINTMENT',
      displayMessage: `Creados ${created.count} rango(s) de disponibilidad: ${startTime}–${endTime} (${dateInfo})`,
      icon: 'CalendarPlus',
      color: 'blue',
      metadata: {
        type: 'availability_range',
        count: created.count,
        mode,
        startTime,
        endTime,
        intervalMinutes: resolvedInterval,
        dateInfo,
      },
    }).catch((err) => console.error('Activity log failed:', err));

    return NextResponse.json({
      success: true,
      count: created.count,
      message: `Created ${created.count} availability range(s)`,
    });
  } catch (error) {
    console.error('Error creating availability ranges:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('authentication')
      ) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create availability ranges' },
      { status: 500 }
    );
  }
}
