/**
 * CaseChip - Colored rectangular badge for displaying case names
 *
 * Used in TaskItem, EventItem, and TaskDetailSheet to make cases
 * visually distinguishable with auto-assigned persistent colors.
 * Uses soft pastel backgrounds matching the app's existing badge style.
 */
import { Link } from 'react-router-dom';

export interface CaseChipProps {
  caseId: number;
  caseName?: string;
  shortName?: string;
  color?: string;
  /** If true, render as plain span instead of link */
  asSpan?: boolean;
}

/**
 * Map color keys to Tailwind classes for soft pastel style
 * Matches the app's existing badge pattern (bg-*-100 text-*-700)
 */
const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
};

const DEFAULT_CLASSES = 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';

export function CaseChip({
  caseId,
  caseName,
  shortName,
  color,
  asSpan = false,
}: CaseChipProps) {
  const displayName = shortName || caseName || `#${caseId}`;

  // Color is stored as a key like "blue", "emerald", etc.
  const colorClasses = color && COLOR_CLASSES[color] ? COLOR_CLASSES[color] : DEFAULT_CLASSES;

  const baseClasses = `
    inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium
    max-w-[120px] truncate
    ${colorClasses}
    transition-opacity hover:opacity-80
  `;

  if (asSpan) {
    return (
      <span
        className={baseClasses}
        title={caseName || `Case #${caseId}`}
      >
        {displayName}
      </span>
    );
  }

  return (
    <Link
      to={`/cases/${caseId}`}
      onClick={(e) => e.stopPropagation()}
      className={baseClasses}
      title={caseName || `Case #${caseId}`}
    >
      {displayName}
    </Link>
  );
}
