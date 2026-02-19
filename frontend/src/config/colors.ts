/**
 * Centralized color configuration for badges, chips, and status indicators.
 *
 * All pill/badge colors should be imported from this file to ensure
 * consistency across the app and proper dark mode support.
 *
 * Pattern: Each color provides `bg` and `text` classes with dark variants.
 */

export interface ColorClasses {
  bg: string;
  text: string;
}

/** Combined bg + text as single string (convenience helper) */
export function colorToClasses(color: ColorClasses): string {
  return `${color.bg} ${color.text}`;
}

// =============================================================================
// BADGE PALETTE - Colorful palette for distinguishing items (cases, users, etc.)
// =============================================================================

export const BADGE_PALETTE = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-300',
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-700 dark:text-pink-300',
  },
  cyan: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    text: 'text-teal-700 dark:text-teal-300',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
  },
  lime: {
    bg: 'bg-lime-100 dark:bg-lime-900/30',
    text: 'text-lime-700 dark:text-lime-300',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
  },
  sky: {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-700 dark:text-sky-300',
  },
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
  },
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
  },
} as const;

export type BadgePaletteKey = keyof typeof BADGE_PALETTE;

/** Ordered array for consistent ID-based color assignment */
export const BADGE_PALETTE_KEYS: BadgePaletteKey[] = [
  'blue',
  'emerald',
  'amber',
  'red',
  'violet',
  'pink',
  'cyan',
  'orange',
  'indigo',
  'teal',
];

/** Get badge color by numeric ID (cycles through palette) */
export function getBadgeColorById(id: number): ColorClasses {
  const key = BADGE_PALETTE_KEYS[id % BADGE_PALETTE_KEYS.length];
  return BADGE_PALETTE[key];
}

/** Get badge color classes as single string by ID */
export function getBadgeColorClassesById(id: number): string {
  return colorToClasses(getBadgeColorById(id));
}

// =============================================================================
// TASK STATUS COLORS
// =============================================================================

export const TASK_STATUS_COLORS = {
  Pending: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-400',
  },
  Active: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  Done: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
  },
  'Partially Complete': {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
  Blocked: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
  },
  'Awaiting Atty Review': {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
} as const;

export type TaskStatusKey = keyof typeof TASK_STATUS_COLORS;

// =============================================================================
// CASE STATUS COLORS
// =============================================================================

export const CASE_STATUS_COLORS = {
  'Signing Up': {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  Prospective: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
  },
  'Pre-Filing': {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  Pleadings: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
  Discovery: {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-700 dark:text-sky-300',
  },
  'Expert Discovery': {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    text: 'text-teal-700 dark:text-teal-300',
  },
  'Pre-trial': {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
  },
  Trial: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
  'Post-Trial': {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
  },
  Appeal: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
  'Settl. Pend.': {
    bg: 'bg-lime-100 dark:bg-lime-900/30',
    text: 'text-lime-700 dark:text-lime-300',
  },
  Stayed: {
    bg: 'bg-slate-100 dark:bg-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
  },
  Closed: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
  },
} as const;

export type CaseStatusKey = keyof typeof CASE_STATUS_COLORS;

/** Hex colors for SVG fills - matches the Tailwind -500 shade used in status badges */
export const CASE_STATUS_HEX_COLORS: Record<string, string> = {
  'Signing Up': '#3b82f6',     // blue-500
  Prospective: '#a855f7',      // purple-500
  'Pre-Filing': '#6366f1',     // indigo-500
  Pleadings: '#06b6d4',        // cyan-500
  Discovery: '#0ea5e9',        // sky-500
  'Expert Discovery': '#14b8a6', // teal-500
  'Pre-trial': '#f59e0b',      // amber-500
  Trial: '#f97316',            // orange-500
  'Post-Trial': '#f43f5e',     // rose-500
  Appeal: '#ef4444',           // red-500
  'Settl. Pend.': '#84cc16',   // lime-500
  Stayed: '#64748b',           // slate-500
  Closed: '#6b7280',           // gray-500
};

// =============================================================================
// ROLE CATEGORY COLORS (for unified roles system)
// =============================================================================

export const ROLE_CATEGORY_COLORS = {
  expert: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
  },
  counsel: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  mediator: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
  },
  client: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  defendant: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
  other: {
    bg: 'bg-slate-100 dark:bg-slate-900/30',
    text: 'text-slate-700 dark:text-slate-300',
  },
} as const;

export type RoleCategoryKey = keyof typeof ROLE_CATEGORY_COLORS;

/** Get role category color */
export function getRoleCategoryColor(category: string): ColorClasses {
  return ROLE_CATEGORY_COLORS[category as RoleCategoryKey] || BADGE_PALETTE.slate;
}

/** Get role category color classes as single string */
export function getRoleCategoryColorClasses(category: string): string {
  return colorToClasses(getRoleCategoryColor(category));
}

// =============================================================================
// EVENT STATUS COLORS
// =============================================================================

export const EVENT_STATUS_COLORS = {
  Met: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
  },
  Missed: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
} as const;

export type EventStatusKey = keyof typeof EVENT_STATUS_COLORS;

// =============================================================================
// PRIORITY COLORS (for task checkboxes and inline styles)
// Priority 1 = highest urgency (red), Priority 4 = lowest (muted)
// Includes hex values for use in inline styles (e.g., borderColor)
// =============================================================================

export const PRIORITY_COLORS = {
  Urgent: {
    label: 'Priority 1',
    textClass: 'text-red-500',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    hex: '#ef4444', // red-500
  },
  High: {
    label: 'Priority 2',
    textClass: 'text-orange-500',
    bgClass: 'bg-orange-50 dark:bg-orange-900/20',
    hex: '#f97316', // orange-500
  },
  Medium: {
    label: 'Priority 3',
    textClass: 'text-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    hex: '#3b82f6', // blue-500
  },
  Low: {
    label: 'Priority 4',
    textClass: 'text-text-muted',
    bgClass: 'bg-bg-hover',
    hex: '#94a3b8', // slate-400 (muted)
  },
} as const;

export type PriorityLevel = keyof typeof PRIORITY_COLORS;

/** Get priority config by urgency level */
export function getPriorityColor(level: string): (typeof PRIORITY_COLORS)[PriorityLevel] {
  return PRIORITY_COLORS[level as PriorityLevel] || PRIORITY_COLORS.Low;
}

// =============================================================================
// URGENCY COLORS (1-4 scale: Low, Medium, High, Urgent)
// =============================================================================

export const URGENCY_COLORS = {
  Low: {
    label: 'Low',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
  },
  Medium: {
    label: 'Medium',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  High: {
    label: 'High',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
  },
  Urgent: {
    label: 'Urgent',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
  },
} as const;

export type UrgencyLevel = keyof typeof URGENCY_COLORS;

/** Ordering map for sorting urgency strings (higher = more urgent) */
export const URGENCY_ORDER: Record<string, number> = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

// =============================================================================
// DATE GROUP COLORS (for task/event grouping)
// =============================================================================

export const DATE_GROUP_COLORS = {
  overdue: {
    label: 'Overdue',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
  },
  today: {
    label: 'Today',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  thisWeek: {
    label: 'This Week',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  nextWeek: {
    label: 'Next Week',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  later: {
    label: 'Later',
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-400',
  },
  noDate: {
    label: 'No Date',
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-500 dark:text-slate-400',
  },
} as const;

export type DateGroupKey = keyof typeof DATE_GROUP_COLORS;

// =============================================================================
// INTAKE STATUS COLORS
// =============================================================================

export const INTAKE_STATUS_COLORS = {
  New: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-600 dark:text-slate-400',
  },
  Screened: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  'Needs Follow-Up': {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
  },
  'Atty Review': {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  Rejected: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
  'Rejection Sent': {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
  },
  'Send Retainer': {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-300',
  },
  'Retainer Sent': {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
  },
  Retained: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
  },
  Archived: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
  },
} as const;

export type IntakeStatusKey = keyof typeof INTAKE_STATUS_COLORS;

// =============================================================================
// COMBINED STATUS LOOKUP (for generic Badge component)
// =============================================================================

/** Get color for any status type (task, case, or event) */
export function getStatusColor(status: string): ColorClasses {
  const taskColor = TASK_STATUS_COLORS[status as TaskStatusKey];
  if (taskColor) return taskColor;

  const caseColor = CASE_STATUS_COLORS[status as CaseStatusKey];
  if (caseColor) return caseColor;

  const eventColor = EVENT_STATUS_COLORS[status as EventStatusKey];
  if (eventColor) return eventColor;

  const intakeColor = INTAKE_STATUS_COLORS[status as IntakeStatusKey];
  if (intakeColor) return intakeColor;

  // Default fallback
  return BADGE_PALETTE.slate;
}

/** Get color classes as single string for any status */
export function getStatusColorClasses(status: string): string {
  return colorToClasses(getStatusColor(status));
}

/** Get urgency color by level */
export function getUrgencyColor(level: string): ColorClasses {
  const color = URGENCY_COLORS[level as UrgencyLevel];
  return color || URGENCY_COLORS.Low;
}

/** Get urgency color classes as single string */
export function getUrgencyColorClasses(level: string): string {
  return colorToClasses(getUrgencyColor(level));
}

// =============================================================================
// INPUT HIGHLIGHT COLORS (for overlay-based text highlighting)
// Uses transparency so text underneath remains visible
// =============================================================================

export const INPUT_HIGHLIGHT = {
  /** Date detection highlight in task/event creation inputs */
  date: 'bg-primary-500/20 dark:bg-primary-400/25',
} as const;
