import { X } from 'lucide-react';
import type { CaseStaffUser } from '../../types';

// Color map for user initials
const INITIAL_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
];

function getColorForId(id: number): string {
  return INITIAL_COLORS[id % INITIAL_COLORS.length];
}

interface UserChipProps {
  user: CaseStaffUser;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  showName?: boolean;
}

export function UserChip({ user, onRemove, size = 'sm', showName = true }: UserChipProps) {
  const colorClass = getColorForId(user.id);
  const sizeClasses = size === 'sm'
    ? 'h-6 text-xs'
    : 'h-8 text-sm';
  const initialsSizeClasses = size === 'sm'
    ? 'w-5 h-5 text-[10px]'
    : 'w-6 h-6 text-xs';

  const fullName = `${user.first_name} ${user.last_name}`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${sizeClasses}`}
      title={fullName}
    >
      {/* Initials circle */}
      <span className={`inline-flex items-center justify-center rounded-full font-medium ${colorClass} ${initialsSizeClasses}`}>
        {user.initials}
      </span>

      {/* Name (optional) */}
      {showName && (
        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
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
          className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"
        >
          <X className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
        </button>
      )}
    </div>
  );
}
