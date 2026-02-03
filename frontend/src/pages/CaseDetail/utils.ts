// Helper functions for CaseDetail components

import {
  URGENCY_COLORS,
  TASK_STATUS_COLORS,
  DATE_GROUP_COLORS,
} from '../../config/colors';

/**
 * Parse a date string (YYYY-MM-DD) as local time, not UTC.
 * This avoids timezone shift issues where "2026-01-27" parsed as UTC
 * becomes Jan 26 at 4pm in Pacific time.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

export function getPrimaryPhone(
  phones: Array<{ value: string; label?: string; primary?: boolean }> | undefined
): string | null {
  if (!phones || phones.length === 0) return null;
  const primary = phones.find((p) => p.primary);
  return primary?.value || phones[0]?.value || null;
}

export function getPrimaryEmail(
  emails: Array<{ value: string; label?: string; primary?: boolean }> | undefined
): string | null {
  if (!emails || emails.length === 0) return null;
  const primary = emails.find((e) => e.primary);
  return primary?.value || emails[0]?.value || null;
}

// Re-export color configs with the expected shape for backwards compatibility
export const urgencyConfig: Record<number, { label: string; color: string; bgColor: string }> = {
  4: { label: URGENCY_COLORS[4].label, color: URGENCY_COLORS[4].text, bgColor: URGENCY_COLORS[4].bg },
  3: { label: URGENCY_COLORS[3].label, color: URGENCY_COLORS[3].text, bgColor: URGENCY_COLORS[3].bg },
  2: { label: URGENCY_COLORS[2].label, color: URGENCY_COLORS[2].text, bgColor: URGENCY_COLORS[2].bg },
  1: { label: URGENCY_COLORS[1].label, color: URGENCY_COLORS[1].text, bgColor: URGENCY_COLORS[1].bg },
};

export const statusConfig: Record<string, { color: string; bgColor: string }> = {
  Pending: { color: TASK_STATUS_COLORS.Pending.text, bgColor: TASK_STATUS_COLORS.Pending.bg },
  Active: { color: TASK_STATUS_COLORS.Active.text, bgColor: TASK_STATUS_COLORS.Active.bg },
  Blocked: { color: TASK_STATUS_COLORS.Blocked.text, bgColor: TASK_STATUS_COLORS.Blocked.bg },
  'Awaiting Atty Review': { color: TASK_STATUS_COLORS['Awaiting Atty Review'].text, bgColor: TASK_STATUS_COLORS['Awaiting Atty Review'].bg },
  Done: { color: TASK_STATUS_COLORS.Done.text, bgColor: TASK_STATUS_COLORS.Done.bg },
};

export const dateGroupConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  overdue: { label: DATE_GROUP_COLORS.overdue.label, color: DATE_GROUP_COLORS.overdue.text, bgColor: DATE_GROUP_COLORS.overdue.bg },
  today: { label: DATE_GROUP_COLORS.today.label, color: DATE_GROUP_COLORS.today.text, bgColor: DATE_GROUP_COLORS.today.bg },
  thisWeek: { label: DATE_GROUP_COLORS.thisWeek.label, color: DATE_GROUP_COLORS.thisWeek.text, bgColor: DATE_GROUP_COLORS.thisWeek.bg },
  nextWeek: { label: DATE_GROUP_COLORS.nextWeek.label, color: DATE_GROUP_COLORS.nextWeek.text, bgColor: DATE_GROUP_COLORS.nextWeek.bg },
  later: { label: DATE_GROUP_COLORS.later.label, color: DATE_GROUP_COLORS.later.text, bgColor: DATE_GROUP_COLORS.later.bg },
  noDate: { label: DATE_GROUP_COLORS.noDate.label, color: DATE_GROUP_COLORS.noDate.text, bgColor: DATE_GROUP_COLORS.noDate.bg },
};
