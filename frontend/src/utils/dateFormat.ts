import { format, getYear } from 'date-fns';

/**
 * Format a date with smart year display and 2-letter day of week.
 * - Shows 2-letter day of week (Mo, Tu, We, Th, Fr, Sa, Su)
 * - Only shows year if it's different from the current year
 *
 * Examples:
 *   Current year: "Mo, Jan 22"
 *   Different year: "Tu, Mar 15, 2025"
 */
export function formatSmartDate(date: Date): string {
  const currentYear = getYear(new Date());
  const dateYear = getYear(date);

  // Get full day name and take first 2 characters
  const dayOfWeek = format(date, 'EEEE').slice(0, 2);
  const monthDay = format(date, 'MMM d');

  if (dateYear === currentYear) {
    return `${dayOfWeek}, ${monthDay}`;
  } else {
    return `${dayOfWeek}, ${monthDay}, ${dateYear}`;
  }
}
