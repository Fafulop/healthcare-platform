/**
 * availability-calculator.ts
 *
 * Core algorithm for range-based scheduling.
 * Pure function — no DB calls, no side effects, fully unit-testable.
 *
 * Given a doctor's availability ranges, existing bookings, a service duration,
 * and a buffer setting, computes which start times are available for booking.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailabilityRangeInput {
  id: string;
  startTime: string;       // "HH:MM"
  endTime: string;         // "HH:MM"
  intervalMinutes: number; // 15 | 30 | 45 | 60
  locationId?: string | null;
  locationName?: string | null;
}

export interface BookingInput {
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
}

export interface AvailableSlot {
  startTime: string;       // "HH:MM"
  endTime: string;         // "HH:MM" (startTime + serviceDuration)
  rangeId: string;
  locationId?: string | null;
  locationName?: string | null;
}

export interface CalculateAvailabilityInput {
  ranges: AvailabilityRangeInput[];
  bookings: BookingInput[];
  serviceDurationMinutes: number;
  bufferMinutes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "HH:MM" to total minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convert total minutes from midnight to "HH:MM". */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Represents a continuous window of free time as [start, end) in minutes.
 */
interface Window {
  start: number; // inclusive
  end: number;   // exclusive
}

/**
 * Subtract blocked intervals from a single free window.
 * Returns the remaining free windows (sorted, non-overlapping).
 *
 * blockedWindows MUST be sorted by start and non-overlapping before calling.
 */
function subtractBlocked(free: Window, blocked: Window[]): Window[] {
  const result: Window[] = [];
  let cursor = free.start;

  for (const b of blocked) {
    // Block is entirely before cursor — skip
    if (b.end <= cursor) continue;
    // Block starts after free window ends — done
    if (b.start >= free.end) break;

    // There's a gap before this block
    if (b.start > cursor) {
      result.push({ start: cursor, end: Math.min(b.start, free.end) });
    }

    // Advance cursor past this block
    cursor = Math.max(cursor, b.end);
    if (cursor >= free.end) break;
  }

  // Remaining gap after last block
  if (cursor < free.end) {
    result.push({ start: cursor, end: free.end });
  }

  return result;
}

/**
 * Merge overlapping/touching windows and sort them by start.
 */
function mergeWindows(windows: Window[]): Window[] {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged: Window[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Main algorithm
// ---------------------------------------------------------------------------

/**
 * Compute available start times for a given date.
 *
 * Algorithm (from plan Section 4):
 * 1. For each range, create a timeline [startTime → endTime]
 * 2. For each booking, compute blocked window [startTime → endTime + buffer]
 * 3. Subtract all blocked windows from each range → free windows
 * 4. For each free window within a range, generate start times at that range's
 *    intervalMinutes. A start time T is valid only if T + serviceDuration <= window end.
 * 5. Return the list of available start times.
 */
export function calculateAvailability(
  input: CalculateAvailabilityInput
): AvailableSlot[] {
  const { ranges, bookings, serviceDurationMinutes, bufferMinutes } = input;

  if (ranges.length === 0 || serviceDurationMinutes <= 0) return [];

  // Step 2: Build blocked windows from bookings (with buffer AFTER only)
  const blockedWindows: Window[] = bookings.map((b) => ({
    start: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime) + bufferMinutes,
  }));

  // Sort and merge blocked windows so subtraction works correctly
  const mergedBlocked = mergeWindows(blockedWindows);

  const result: AvailableSlot[] = [];

  // Process each range independently (each has its own interval)
  for (const range of ranges) {
    const rangeStart = timeToMinutes(range.startTime);
    const rangeEnd = timeToMinutes(range.endTime);

    // Step 1: range as a free window
    const rangeWindow: Window = { start: rangeStart, end: rangeEnd };

    // Step 3: subtract blocked windows → free gaps
    const freeWindows = subtractBlocked(rangeWindow, mergedBlocked);

    // Step 4: generate start times at this range's interval
    const interval = range.intervalMinutes;

    for (const free of freeWindows) {
      // First start time: snap UP to the next interval boundary relative to range start
      let t = free.start;

      // Align to range's interval grid (based on range start)
      const offsetFromRange = t - rangeStart;
      if (offsetFromRange % interval !== 0) {
        t = rangeStart + Math.ceil(offsetFromRange / interval) * interval;
      }

      while (t + serviceDurationMinutes <= free.end) {
        result.push({
          startTime: minutesToTime(t),
          endTime: minutesToTime(t + serviceDurationMinutes),
          rangeId: range.id,
          locationId: range.locationId,
          locationName: range.locationName,
        });
        t += interval;
      }
    }
  }

  // Sort by start time (ranges are already processed in order, but ensure consistency)
  result.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return result;
}

// ---------------------------------------------------------------------------
// Cutoff filter (1-hour rule for today)
// ---------------------------------------------------------------------------

/**
 * Filter out times that are within 1 hour of the current time in Mexico City.
 * Only applies to "today" — other dates are not filtered.
 *
 * @param slots - Available slots to filter
 * @param dateKey - The date these slots are for ("YYYY-MM-DD")
 * @returns Filtered slots
 */
export function applyCutoff(
  slots: AvailableSlot[],
  dateKey: string
): AvailableSlot[] {
  // Get current time in Mexico City
  const nowMXStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
  const todayMX = nowMXStr.split(' ')[0]; // "YYYY-MM-DD"

  // Not today → no filtering needed
  if (dateKey !== todayMX) return slots;

  const [currentHour, currentMinute] = nowMXStr.split(' ')[1].slice(0, 5).split(':').map(Number);
  const cutoffMinutes = currentHour * 60 + currentMinute + 60;

  // If cutoff overflows past midnight, hide all times (same as existing availability endpoint)
  if (cutoffMinutes >= 24 * 60) return [];

  return slots.filter((slot) => timeToMinutes(slot.startTime) > cutoffMinutes);
}
