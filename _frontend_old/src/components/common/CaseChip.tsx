/**
 * CaseChip - Colored rectangular badge for displaying case names
 *
 * Used in TaskItem, EventItem, and TaskDetailSheet to make cases
 * visually distinguishable with auto-assigned persistent colors.
 * Uses soft pastel backgrounds matching the app's existing badge style.
 */
import { Link } from 'react-router-dom';
import { BADGE_PALETTE, colorToClasses, type BadgePaletteKey } from '../../config/colors';

export interface CaseChipProps {
  caseId: number;
  caseName?: string;
  shortName?: string;
  color?: string;
  /** If true, render as plain span instead of link */
  asSpan?: boolean;
}

const DEFAULT_CLASSES = colorToClasses(BADGE_PALETTE.slate);

export function CaseChip({
  caseId,
  caseName,
  shortName,
  color,
  asSpan = false,
}: CaseChipProps) {
  const displayName = shortName || caseName || `#${caseId}`;

  // Color is stored as a key like "blue", "emerald", etc.
  const paletteColor = color && BADGE_PALETTE[color as BadgePaletteKey];
  const colorClasses = paletteColor ? colorToClasses(paletteColor) : DEFAULT_CLASSES;

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
