// Shared guards for every path that creates a booking or extends its blocked window.
//
// Two invariants, enforced together:
//  1. Writers for the same doctor+day must serialize (lockBookingDay) — the overlap
//     checks are read-then-create, so without the lock two concurrent requests for the
//     same time both pass the check and both create (double booking).
//  2. A new/extended time window must not overlap an active booking's blocked window
//     (findBookingOverlap). The window math mirrors calculateAvailability
//     (availability-calculator.ts): [start, max(end, start + extendedBlockMinutes) + buffer)

import type { Prisma } from '@healthcare/database';
import { timeToMinutes, minutesToTime } from './availability-calculator';

const LAST_MINUTE_OF_DAY = 24 * 60 - 1;

/**
 * Serialize concurrent booking writes for a doctor+date. Transaction-scoped: the lock
 * is released automatically when the transaction commits or rolls back. Every route
 * that creates bookings for a doctor+date must take this lock with the same key, or
 * it does not participate in the serialization.
 */
export async function lockBookingDay(
  tx: Prisma.TransactionClient,
  doctorId: string,
  dateKey: string
): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${doctorId + ':' + dateKey}))`;
}

export interface BookingOverlapConflict {
  /** Existing booking's real start/end times ("HH:MM") */
  startTime: string;
  endTime: string;
  /** End of the effective blocked window (incl. extendedBlock + buffer), clamped to 23:59 */
  blockEndTime: string;
}

export interface FindBookingOverlapOptions {
  doctorId: string;
  /** Booking date, normalized to midnight UTC */
  date: Date;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  /** Doctor's appointmentBufferMinutes. Omit (0) on doctor-override paths. */
  bufferMinutes?: number;
  /**
   * Only check freeform (slotId = null) bookings. Slot-based routes guard the slot
   * table separately but can't see freeform bookings there — this closes that gap.
   */
  freeformOnly?: boolean;
  /** Exclude this booking id (when validating a mutation of an existing booking). */
  excludeBookingId?: string;
}

/**
 * Returns the first active (PENDING/CONFIRMED) booking whose blocked window overlaps
 * the requested [startTime, endTime) window, or null if the time is free.
 */
export async function findBookingOverlap(
  tx: Prisma.TransactionClient,
  opts: FindBookingOverlapOptions
): Promise<BookingOverlapConflict | null> {
  const {
    doctorId,
    date,
    startTime,
    endTime,
    bufferMinutes = 0,
    freeformOnly = false,
    excludeBookingId,
  } = opts;

  const activeBookings = await tx.booking.findMany({
    where: {
      doctorId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      OR: freeformOnly
        ? [{ slotId: null, date }]
        : [{ slotId: null, date }, { slot: { date } }],
    },
    select: {
      startTime: true,
      endTime: true,
      extendedBlockMinutes: true,
      slot: { select: { startTime: true, endTime: true } },
    },
  });

  const newStartMin = timeToMinutes(startTime);
  const newEndMin = timeToMinutes(endTime);

  for (const ab of activeBookings) {
    const abStart = ab.startTime ?? ab.slot?.startTime;
    const abEnd = ab.endTime ?? ab.slot?.endTime;
    if (!abStart || !abEnd) continue;

    const abStartMin = timeToMinutes(abStart);
    const abEndMin = timeToMinutes(abEnd);
    // Effective blocked end: max of endTime and startTime + extendedBlockMinutes, plus
    // the buffer — the same window calculateAvailability blocks, so a time the
    // availability endpoint hides can't be created via direct POST.
    const extendedEnd = ab.extendedBlockMinutes != null
      ? Math.max(abEndMin, abStartMin + ab.extendedBlockMinutes)
      : abEndMin;
    const blockEnd = extendedEnd + bufferMinutes;

    // Overlap: newStart < existingBlockEnd AND newEnd > existingStart
    if (newStartMin < blockEnd && newEndMin > abStartMin) {
      return {
        startTime: abStart,
        endTime: abEnd,
        blockEndTime: minutesToTime(Math.min(blockEnd, LAST_MINUTE_OF_DAY)),
      };
    }
  }

  return null;
}
