/**
 * Natural language date parser for task/event creation.
 *
 * Supports patterns like:
 * - Relative: "today", "tomorrow", "tom"
 * - Day names: "monday", "mon", "wed", "wednesday"
 * - Month + day: "feb 4", "february 4", "feb 4th", "4 feb"
 * - Numeric: "2/4", "02/04", "2-4"
 *
 * Smart year inference: assumes nearest future date.
 * If "1/4" is typed on 2/3/2026, it means 1/4/2027 (not past).
 */

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const DAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export interface ParsedDate {
  date: Date;
  /** The matched text that was parsed */
  matchedText: string;
  /** Start index of matched text in original string */
  startIndex: number;
  /** End index of matched text in original string */
  endIndex: number;
}

/**
 * Parse a date from natural language text.
 * Returns null if no date pattern is found.
 */
export function parseDateFromText(text: string): ParsedDate | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lowerText = text.toLowerCase();

  // Try each pattern in order of specificity
  const patterns: Array<{
    regex: RegExp;
    parse: (match: RegExpMatchArray) => Date | null;
  }> = [
    // "today" / "tod"
    {
      regex: /\b(today|tod)\b/i,
      parse: () => today,
    },
    // "tomorrow" / "tom" / "tmr" / "tmrw"
    {
      regex: /\b(tomorrow|tmrw|tmr|tom)\b/i,
      parse: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
      },
    },
    // "next week"
    {
      regex: /\bnext\s+week\b/i,
      parse: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        return d;
      },
    },
    // "next monday", "next tue", etc.
    {
      regex: /\bnext\s+(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\b/i,
      parse: (match) => {
        const dayName = match[1].toLowerCase();
        const targetDay = Object.entries(DAYS).find(([key]) => dayName.startsWith(key))?.[1];
        if (targetDay === undefined) return null;

        const d = new Date(today);
        const currentDay = d.getDay();
        // Next week's occurrence of that day
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        daysToAdd += 7; // "next" means the week after
        d.setDate(d.getDate() + daysToAdd);
        return d;
      },
    },
    // Day names: "monday", "mon", "wed", etc. (means this coming occurrence)
    {
      regex: /\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\b/i,
      parse: (match) => {
        const dayName = match[1].toLowerCase();
        const targetDay = Object.entries(DAYS).find(([key]) => dayName.startsWith(key))?.[1];
        if (targetDay === undefined) return null;

        const d = new Date(today);
        const currentDay = d.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
        d.setDate(d.getDate() + daysToAdd);
        return d;
      },
    },
    // "feb 4", "february 4", "feb 4th", "feb4"
    {
      regex: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?\b/i,
      parse: (match) => {
        const monthName = match[1].toLowerCase();
        const day = parseInt(match[2], 10);
        const month = Object.entries(MONTHS).find(([key]) => monthName.startsWith(key))?.[1];
        if (month === undefined || day < 1 || day > 31) return null;
        return createSmartDate(month, day, today);
      },
    },
    // "4 feb", "4th february", "4feb"
    {
      regex: /\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
      parse: (match) => {
        const day = parseInt(match[1], 10);
        const monthName = match[2].toLowerCase();
        const month = Object.entries(MONTHS).find(([key]) => monthName.startsWith(key))?.[1];
        if (month === undefined || day < 1 || day > 31) return null;
        return createSmartDate(month, day, today);
      },
    },
    // Numeric with slash or dash: "2/4", "02/04", "2-4", "02-04"
    // Also supports year: "2/4/26", "2/4/2026"
    {
      regex: /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/,
      parse: (match) => {
        const month = parseInt(match[1], 10) - 1; // 0-indexed
        const day = parseInt(match[2], 10);
        const yearStr = match[3];

        if (month < 0 || month > 11 || day < 1 || day > 31) return null;

        if (yearStr) {
          let year = parseInt(yearStr, 10);
          if (year < 100) year += 2000; // "26" -> 2026
          const d = new Date(year, month, day);
          d.setHours(0, 0, 0, 0);
          return d;
        }

        return createSmartDate(month, day, today);
      },
    },
  ];

  for (const { regex, parse } of patterns) {
    const match = lowerText.match(regex);
    if (match && match.index !== undefined) {
      const date = parse(match);
      if (date) {
        // Find the actual match in original text (preserving case)
        const originalMatch = text.substring(match.index, match.index + match[0].length);
        return {
          date,
          matchedText: originalMatch,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        };
      }
    }
  }

  return null;
}

/**
 * Create a date with smart year inference.
 * If the date would be in the past, use next year.
 */
function createSmartDate(month: number, day: number, today: Date): Date {
  const thisYear = today.getFullYear();
  const candidate = new Date(thisYear, month, day);
  candidate.setHours(0, 0, 0, 0);

  // If the date is in the past, use next year
  if (candidate < today) {
    candidate.setFullYear(thisYear + 1);
  }

  return candidate;
}

/**
 * Remove the date pattern from text and clean up whitespace.
 */
export function removeDateFromText(text: string, parsed: ParsedDate): string {
  const before = text.substring(0, parsed.startIndex);
  const after = text.substring(parsed.endIndex);

  // Clean up: remove extra spaces, trim
  return (before + after).replace(/\s+/g, ' ').trim();
}

/**
 * Parse date from text and return both the date and cleaned text.
 * Convenience function combining parseDateFromText and removeDateFromText.
 */
export function extractDateFromText(text: string): {
  date: Date | null;
  cleanedText: string;
  matchedText: string | null;
} {
  const parsed = parseDateFromText(text);
  if (!parsed) {
    return { date: null, cleanedText: text, matchedText: null };
  }
  return {
    date: parsed.date,
    cleanedText: removeDateFromText(text, parsed),
    matchedText: parsed.matchedText,
  };
}
