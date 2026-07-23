/**
 * Date helpers for the agenda agent tools (gap G7 of the design doc).
 *
 * Conventions shared with the appointments endpoints:
 * - DB dates are normalized to midnight UTC of the calendar date (via the
 *   `T12:00:00Z` trick so the calendar day never shifts).
 * - Times are "HH:MM" strings in Mexico City local time.
 * - "today" / "now" always means America/Mexico_City.
 */

/** "YYYY-MM-DD HH:MM:SS" in Mexico City (sv-SE locale gives ISO-like format). */
export function mxNowString(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
}

/** "YYYY-MM-DD" of today in Mexico City. */
export function mxTodayKey(): string {
  return mxNowString().split(' ')[0];
}

/** Spanish weekday name of today in Mexico City ("viernes"). LLMs miscompute
 * day-of-week from a bare date, so the prompt states it explicitly (E6). */
export function mxTodayWeekday(): string {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    timeZone: 'America/Mexico_City',
  });
}

/** "HH:MM" plus N minutes, clamped to 23:59 (same clamp as booking-overlap). */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "YYYY-MM-DD" of the Monday that starts the CURRENT week in Mexico City.
 * Week = Monday–Sunday MX — the assistant's usage cap is weekly (a day-less
 * window averages out zero-use days). Same noon-UTC trick as the weekday math
 * in the eval runner so the calendar day never shifts across the tz offset. */
export function mxWeekStartKey(): string {
  const d = new Date(mxTodayKey() + 'T12:00:00Z');
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** Normalize a "YYYY-MM-DD" key to the midnight-UTC Date the DB stores. */
export function dateKeyToUtcDate(dateKey: string): Date {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** "YYYY-MM-DD" key of a DB date. */
export function utcDateToKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** True if a PENDING/CONFIRMED booking's end time is already in the past (MX time). */
export function isVencida(dateKey: string, endTime: string, status: string): boolean {
  if (status !== 'PENDING' && status !== 'CONFIRMED') return false;
  return `${dateKey} ${endTime}:00` < mxNowString();
}
