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
