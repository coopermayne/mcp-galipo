// Helper functions for CaseDetail components

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

// Urgency and Status config for task groups (1-4 scale: Low, Medium, High, Urgent)
export const urgencyConfig: Record<number, { label: string; color: string; bgColor: string }> = {
  4: {
    label: 'Urgent',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  3: {
    label: 'High',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  2: {
    label: 'Medium',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  1: {
    label: 'Low',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
};

export const statusConfig: Record<string, { color: string; bgColor: string }> = {
  Pending: {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
  },
  Active: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  Blocked: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  'Awaiting Atty Review': {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  Done: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
};

export const dateGroupConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  overdue: {
    label: 'Overdue',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  today: {
    label: 'Today',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  thisWeek: {
    label: 'This Week',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  nextWeek: {
    label: 'Next Week',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
  },
  later: {
    label: 'Later',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800/50',
  },
  noDate: {
    label: 'No Date',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
  },
};
