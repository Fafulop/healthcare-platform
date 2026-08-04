// GET /api/doctors/[slug]/range-availability
// Public endpoint — computes available appointment times from availability ranges.
// When serviceId is provided: returns availableDates + timeSlots (full computation).
// When serviceId is omitted: returns only availableDates (dates that have ranges, for calendar display).
//
// freeform=1 (AUTHENTICATED ONLY, see below) computes availability from a synthetic
// whole-day range instead of the doctor's published ranges — the doctor booking outside
// (or on top of) their own availability. Docs: CITAS/01-PLAN-agendar-sin-rango.md.

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { validateAuthToken } from '@/lib/auth';
import {
  calculateAvailability,
  applyCutoff,
  applyPastFilter,
  type AvailabilityRangeInput,
  type BookingInput,
  type BlockedTimeInput,
  type AvailableSlot,
} from '@/lib/availability-calculator';

/** Synthetic range id returned for freeform slots — NOT a real AvailabilityRange row. */
const FREEFORM_RANGE_ID = 'freeform';
/** Grid for the freeform day. Finer than any doctor's defaultIntervalMinutes (all 30 in prod)
 *  on purpose: squeezing a patient between two appointments is the point. */
const FREEFORM_INTERVAL_MINUTES = 15;
/** Without ranges to bound it, a year would be 365 x 96 = ~35k entries in one response. */
const FREEFORM_MAX_DAYS = 62;

/** Every "YYYY-MM-DD" from start to end inclusive, in UTC (ranges store midnight UTC). */
function enumerateDateKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    keys.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

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
    // skipCutoff=1: omit the 1-hour lead-time filter meant for public patients.
    // Used by doctor-context callers (agenda agent) — doctors can book inside the
    // hour themselves; the booking POST still enforces the cutoff for public.
    const skipCutoff = searchParams.get('skipCutoff') === '1';
    const freeformRequested = searchParams.get('freeform') === '1';
    // excludeBookingIds=id1,id2: compute availability AS IF these bookings didn't
    // exist. Used by reschedule/plan-aware pre-checks (agenda agent GAP-2/3) so
    // they always ask THIS canonical engine instead of re-deriving the occupied
    // window. Only ever removes occupied windows, and the bookings query below is
    // already scoped to this doctor, so foreign/unknown ids are a no-op.
    const excludeBookingIds = (searchParams.get('excludeBookingIds') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Reject rather than silently truncate — a dropped id would count a
    // plan-cancelled booking as still occupying and produce false conflicts.
    if (excludeBookingIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'excludeBookingIds accepts at most 50 ids' },
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

    // --- freeform=1 REQUIRES auth; this endpoint is otherwise public ---
    //
    // Unauthenticated, this endpoint only reveals availability INSIDE the ranges the doctor
    // chose to publish. freeform=1 answers over the whole day, so an anonymous caller with
    // just the slug could derive the doctor's entire OCCUPIED schedule by inversion (every
    // time not returned is taken by a booking or a block) — a free/busy leak for a doctor
    // who may not even use the public page.
    //
    // On failure the flag is IGNORED (fall through to normal range mode) rather than 403:
    // a 403 confirms the parameter exists, ignoring it tells an unauthenticated caller
    // nothing. validateAuthToken also runs tier + member-route enforcement, so a member
    // without the citas toggle is rejected here for free.
    let freeform = false;
    if (freeformRequested) {
      try {
        const { role, doctorId: authDoctorId } = await validateAuthToken(request);
        freeform = role === 'ADMIN' || (role === 'DOCTOR' && authDoctorId === doctor.id);
      } catch {
        freeform = false;
      }
    }

    // Freeform is time-slot computation by definition — "which dates have ranges" is
    // meaningless when the answer is "all of them". Require the service up front instead of
    // inventing dates-only freeform semantics.
    if (freeform && !serviceId) {
      return NextResponse.json(
        { success: false, error: 'freeform=1 requires serviceId' },
        { status: 400 }
      );
    }

    // Fetch the selected service if provided
    let service: { id: string; serviceName: string; durationMinutes: number; price: any } | null = null;
    if (serviceId) {
      service = await prisma.service.findFirst({
        where: {
          id: serviceId,
          doctorId: doctor.id,
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

    // In freeform the window is not bounded by how many ranges exist, so it must be bounded
    // here: a year would be 365 x 96 = ~35k entries. Same shape as the agent's get_ranges cap.
    const freeformDateKeys = freeform
      ? enumerateDateKeys(dateFilter.gte, dateFilter.lte)
      : [];
    if (freeform && freeformDateKeys.length > FREEFORM_MAX_DAYS) {
      return NextResponse.json(
        {
          success: false,
          error: `freeform=1 admite como máximo ${FREEFORM_MAX_DAYS} días por llamada (se pidieron ${freeformDateKeys.length}) — divide el periodo.`,
        },
        { status: 400 }
      );
    }

    // Fetch availability ranges for this doctor + date range.
    // Skipped in freeform: the synthetic whole-day range replaces them as the window source.
    const ranges = freeform ? [] : await prisma.availabilityRange.findMany({
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
        ...(excludeBookingIds.length > 0 && { id: { notIn: excludeBookingIds } }),
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

    // --- Freeform: one synthetic whole-day range per date in the window ---
    //
    // The ENTIRE point is that this goes through calculateAvailability unchanged: bookings,
    // extendedBlockMinutes, BlockedTime and the buffer are all subtracted by the same engine
    // the public page uses. No second definition of "occupied" is created anywhere.
    //
    // Since ranges are always on 15-min boundaries and this grid is 15 min from 00:00, the
    // freeform list is always a SUPERSET of the range list: the two can never contradict.
    //
    // ⚠️ The day ends at "23:59", NOT "24:00". calculateAvailability only requires
    // `start + duration <= rangeEnd`, so "24:00" (1440) would let a 30-min service start at
    // 23:30 and produce `endTime = "24:00"` — a string no AvailabilityRange can hold
    // (isValid15MinBoundary caps the hour at 23) and that had never existed in the DB.
    // range-bookings/instant persists that endTime verbatim, and google-calendar.ts builds
    // `${date}T${endTime}:00` => "2026-08-05T24:00:00", which is not a valid RFC3339 hour and
    // the Calendar API rejects. 1439 caps the last endTime at "23:59" and the problem is gone
    // by construction instead of by clamping downstream.
    if (freeform) {
      for (const dateKey of freeformDateKeys) {
        rangesByDate.set(dateKey, [
          {
            id: FREEFORM_RANGE_ID,
            startTime: '00:00',
            endTime: '23:59',
            intervalMinutes: FREEFORM_INTERVAL_MINUTES,
            locationId: null,
            locationName: null,
          },
        ]);
      }
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

    // Fetch blocked times for this doctor + date range
    const blockedTimes = await prisma.blockedTime.findMany({
      where: {
        doctorId: doctor.id,
        date: dateFilter,
      },
      select: {
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    // Group blocked times by date key
    const blockedByDate = new Map<string, BlockedTimeInput[]>();
    for (const bt of blockedTimes) {
      const dateKey = bt.date.toISOString().split('T')[0];
      if (!blockedByDate.has(dateKey)) blockedByDate.set(dateKey, []);
      blockedByDate.get(dateKey)!.push({
        startTime: bt.startTime,
        endTime: bt.endTime,
      });
    }

    // --- Dates-only mode (no serviceId) ---
    // Return dates that have any range — for calendar display before service selection.
    if (!service) {
      const availableDates: string[] = [];
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      for (const [dateKey] of rangesByDate) {
        if (dateKey < todayStr) continue;
        availableDates.push(dateKey);
      }

      return NextResponse.json({
        success: true,
        doctor: { id: doctor.id, name: doctor.doctorFullName },
        service: null,
        bufferMinutes: doctor.appointmentBufferMinutes,
        availableDates,
        timeSlots: {},
      });
    }

    // --- Full mode (with serviceId) ---
    // Compute available time slots per date.
    const timeSlots: Record<string, AvailableSlot[]> = {};
    const availableDates: string[] = [];

    for (const [dateKey, dateRanges] of rangesByDate) {
      const dateBookings = bookingsByDate.get(dateKey) ?? [];

      let slots = calculateAvailability({
        ranges: dateRanges,
        bookings: dateBookings,
        blockedTimes: blockedByDate.get(dateKey) ?? [],
        serviceDurationMinutes: service.durationMinutes,
        bufferMinutes: doctor.appointmentBufferMinutes,
      });

      // freeform implies doctor-context (auth-gated above), so the 1-hour LEAD TIME does not
      // apply — the doctor can book inside the hour, same as the agent with skipCutoff=1.
      // But dropping applyCutoff wholesale also dropped "not in the past", which is not a
      // lead time and is nonsense in every flow. applyPastFilter keeps exactly that half.
      if (freeform) {
        slots = applyPastFilter(slots, dateKey);
      } else if (!skipCutoff) {
        slots = applyCutoff(slots, dateKey);
      }

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
      // The mode ACTUALLY served. `freeform=1` is ignored (not 403'd) when auth fails, so
      // without this the client cannot tell "you are seeing the whole day" from "your token
      // expired and you are seeing published ranges" — it would keep showing the freeform
      // banner over range-only times. The client compares and corrects itself.
      freeform,
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
