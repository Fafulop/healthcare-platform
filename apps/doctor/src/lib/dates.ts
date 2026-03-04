/**
 * Shared date utilities for the doctor app.
 *
 * Root problem: DB dates are stored as UTC midnight (e.g. "2026-03-04T00:00:00.000Z").
 * Passing those directly to `new Date()` in a Mexico City browser (UTC−6) shifts them
 * to the previous day at 6 PM local time, so `toLocaleDateString` shows one day less.
 *
 * All three helpers below avoid that by working with local year/month/day parts.
 */

/**
 * Convert a Date object to a "YYYY-MM-DD" string using local (not UTC) date parts.
 * Safe to use for <input type="date"> values and date comparisons.
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a DB ISO date string (e.g. "2026-03-04T00:00:00.000Z") as local midnight.
 * Use this whenever you need a Date object from a DB date field.
 */
export function parseLocalDate(isoStr: string): Date {
  const [y, m, d] = isoStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Format a DB date string directly for display (e.g. "martes, 4 de marzo de 2026").
 * Parses safely before formatting to avoid the UTC timezone shift.
 */
export function formatLocalDate(
  isoStr: string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = 'es-MX'
): string {
  try {
    return parseLocalDate(isoStr).toLocaleDateString(locale, options);
  } catch {
    return isoStr;
  }
}
