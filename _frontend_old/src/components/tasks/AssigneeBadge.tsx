/**
 * AssigneeBadge - Displays assignee initials in a colored circle
 *
 * Used in task lists to show who a task is assigned to.
 * Uses shared color utility for consistency across components.
 */
import { getUserColorClass } from '../../utils';
import type { TaskAssignee } from '../../types';

interface AssigneeBadgeProps {
  assignee: TaskAssignee;
  /** Show full name alongside initials */
  showName?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm';
}

export function AssigneeBadge({ assignee, showName = false, size = 'xs' }: AssigneeBadgeProps) {
  const colorClass = getUserColorClass(assignee.id);
  const fullName = `${assignee.first_name} ${assignee.last_name}`;

  const sizeClasses = size === 'xs'
    ? 'w-4 h-4 text-[9px]'
    : 'w-5 h-5 text-[10px]';

  return (
    <span
      className="inline-flex items-center gap-1 group"
      title={fullName}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-150 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-border ${colorClass} ${sizeClasses}`}
      >
        {assignee.initials}
      </span>
      {showName && (
        <span className="text-xs text-text-secondary">
          {fullName}
        </span>
      )}
    </span>
  );
}
