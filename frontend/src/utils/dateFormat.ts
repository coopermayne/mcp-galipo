import { format, getYear } from 'date-fns';

export interface DateFormatOptions {
  /** Show 2-letter day of week (Mo, Tu, etc.) - default: true */
  showDayOfWeek?: boolean;
  /** Always show year even if same as current year - default: false */
  alwaysShowYear?: boolean;
  /** Use numeric format (2/16/26) instead of text (Feb 16) - default: false */
  numeric?: boolean;
}

/**
 * Format a date with smart year display and optional 2-letter day of week.
 *
 * Examples with defaults (showDayOfWeek: true, alwaysShowYear: false, numeric: false):
 *   Current year: "Mo, Jan 22"
 *   Different year: "Tu, Mar 15, 2025"
 *
 * With numeric: true:
 *   Current year: "Mo, 1/22"
 *   Different year: "Tu, 3/15/25"
 *
 * With showDayOfWeek: false:
 *   Current year: "Jan 22"
 *   Different year: "Mar 15, 2025"
 *
 * With alwaysShowYear: true:
 *   "Mo, Jan 22, 2026"
 */
export function formatSmartDate(date: Date, options: DateFormatOptions = {}): string {
  const { showDayOfWeek = true, alwaysShowYear = false, numeric = false } = options;

  const currentYear = getYear(new Date());
  const dateYear = getYear(date);
  const includeYear = alwaysShowYear || dateYear !== currentYear;

  // Build the date part
  let datePart: string;
  if (numeric) {
    if (includeYear) {
      // Use 2-digit year for numeric: 3/15/25
      datePart = format(date, 'M/d/yy');
    } else {
      datePart = format(date, 'M/d');
    }
  } else {
    if (includeYear) {
      datePart = format(date, 'MMM d, yyyy');
    } else {
      datePart = format(date, 'MMM d');
    }
  }

  // Add day of week prefix if requested
  if (showDayOfWeek) {
    const dayOfWeek = format(date, 'EEEE').slice(0, 2);
    return `${dayOfWeek}, ${datePart}`;
  }

  return datePart;
}
