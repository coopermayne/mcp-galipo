/**
 * EventsControls - Reusable filter bar for event lists
 *
 * Includes:
 * - Search input
 * - Past/Upcoming toggle
 */
import { Search, Eye, EyeOff } from 'lucide-react';

interface EventsControlsProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Whether showing past events */
  showPast: boolean;
  /** Callback when past/upcoming toggle changes */
  onShowPastChange: (showPast: boolean) => void;
  /** Hide the search input */
  hideSearch?: boolean;
  /** Hide the past/upcoming toggle */
  hidePastToggle?: boolean;
  /** Compact mode - smaller controls */
  compact?: boolean;
}

export function EventsControls({
  searchQuery,
  onSearchChange,
  showPast,
  onShowPastChange,
  hideSearch = false,
  hidePastToggle = false,
  compact = false,
}: EventsControlsProps) {
  const sizeClasses = compact ? 'py-1 px-2 text-xs' : 'py-2 px-3 text-sm';
  const iconSize = compact ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'mb-3' : 'mb-6'}`}>
      {/* Search */}
      {!hideSearch && (
        <div className="relative flex-1 max-w-xs">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${iconSize} text-slate-400`} />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full pl-9 pr-3 ${sizeClasses} rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none`}
          />
        </div>
      )}

      {/* Past/Upcoming toggle */}
      {!hidePastToggle && (
        <button
          onClick={() => onShowPastChange(!showPast)}
          className={`flex items-center gap-1.5 ${sizeClasses} rounded-lg border font-medium transition-colors ${
            showPast
              ? 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {showPast ? <Eye className={iconSize} /> : <EyeOff className={iconSize} />}
          <span>{showPast ? 'Past' : 'Upcoming'}</span>
        </button>
      )}
    </div>
  );
}
