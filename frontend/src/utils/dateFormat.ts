import { format, getYear, parse, isValid } from 'date-fns';

export interface DateFormatOptions {
  /** Show 3-letter day of week (Mon, Tue, etc.) - default: true */
  showDayOfWeek?: boolean;
  /** Hide year if same as current year - default: true */
  hideCurrentYear?: boolean;
  /** Use numeric format (2/16/26) instead of text (Feb 16) - default: false */
  numeric?: boolean;
}

/**
 * Format a date with smart year display and optional 3-letter day of week.
 *
 * Examples with defaults (showDayOfWeek: true, hideCurrentYear: true, numeric: false):
 *   Current year: "Mon, Jan 22"
 *   Different year: "Tue, Mar 15, 2025"
 *
 * With numeric: true:
 *   Current year: "Mon, 1/22"
 *   Different year: "Tue, 3/15/25"
 *
 * With showDayOfWeek: false:
 *   Current year: "Jan 22"
 *   Different year: "Mar 15, 2025"
 *
 * With hideCurrentYear: false:
 *   "Mon, Jan 22, 2026" (always shows year)
 */
export function formatSmartDate(date: Date, options: DateFormatOptions = {}): string {
  const { showDayOfWeek = true, hideCurrentYear = true, numeric = false } = options;

  const currentYear = getYear(new Date());
  const dateYear = getYear(date);
  const includeYear = !hideCurrentYear || dateYear !== currentYear;

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
    const dayOfWeek = format(date, 'EEE');
    return `${dayOfWeek}, ${datePart}`;
  }

  return datePart;
}

/**
 * Format time from HH:mm (24-hour) to display format (12-hour with AM/PM).
 * Returns empty string if time is null/undefined.
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';

  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Parse various date string formats into a Date object.
 * Returns null if parsing fails.
 */
export function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr.trim()) return null;

  const formats = [
    'M/d/yy',        // 2/16/26
    'M/d/yyyy',      // 2/16/2026
    'MM/dd/yyyy',    // 02/16/2026
    'MMM d, yyyy',   // Feb 16, 2026
    'MMM d yyyy',    // Feb 16 2026
    'MMMM d, yyyy',  // February 16, 2026
    'MMMM d yyyy',   // February 16 2026
    'yyyy-MM-dd',    // 2026-02-16 (ISO)
  ];

  for (const fmt of formats) {
    const parsed = parse(dateStr.trim(), fmt, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parse various time string formats into HH:mm (24-hour) format.
 * Returns null if parsing fails.
 */
export function parseFlexibleTime(timeStr: string): string | null {
  if (!timeStr.trim()) return null;

  const str = timeStr.trim().toLowerCase();

  // Try parsing with date-fns formats
  const formats = [
    'h:mm a',   // 2:30 PM
    'h:mma',    // 2:30PM
    'h:mm',     // 2:30 (assumes current period or 24-hour context)
    'H:mm',     // 14:30
    'HH:mm',    // 14:30
  ];

  for (const fmt of formats) {
    const parsed = parse(str, fmt, new Date());
    if (isValid(parsed)) {
      return format(parsed, 'HH:mm');
    }
  }

  // Manual parsing for edge cases
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toLowerCase();

    if (minutes < 0 || minutes > 59) return null;

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    if (hours < 0 || hours > 23) return null;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  return null;
}
