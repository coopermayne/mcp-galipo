import { X } from 'lucide-react';
import { getUserColorClass } from '../../utils';
import type { CaseStaffUser } from '../../types';

interface UserChipProps {
  user: CaseStaffUser;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  showName?: boolean;
}

export function UserChip({ user, onRemove, size = 'sm', showName = true }: UserChipProps) {
  const colorClass = getUserColorClass(user.id);
  const sizeClasses = size === 'sm'
    ? 'h-6 text-xs'
    : 'h-8 text-sm';
  const initialsSizeClasses = size === 'sm'
    ? 'w-5 h-5 text-[10px]'
    : 'w-6 h-6 text-xs';

  const fullName = `${user.first_name} ${user.last_name}`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-1.5 rounded-full border border-border bg-bg-surface ${sizeClasses}`}
      title={fullName}
    >
      {/* Initials circle */}
      <span className={`inline-flex items-center justify-center rounded-full font-medium ${colorClass} ${initialsSizeClasses}`}>
        {user.initials}
      </span>

      {/* Name (optional) */}
      {showName && (
        <span className="text-text-secondary truncate max-w-[100px]">
          {fullName}
        </span>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 hover:bg-bg-hover rounded-full transition-colors"
        >
          <X className="w-3 h-3 text-text-muted hover:text-text-secondary" />
        </button>
      )}
    </div>
  );
}
