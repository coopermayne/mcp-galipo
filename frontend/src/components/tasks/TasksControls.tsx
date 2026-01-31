/**
 * TasksControls - Reusable filter bar for task lists
 *
 * Includes:
 * - Search input (responsive width)
 * - View dropdown (Date/Case/List grouping)
 * - Done toggle button
 */
import { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Calendar,
  Briefcase,
  LayoutGrid,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';

export type GroupMode = 'date' | 'case' | 'urgency';

interface TasksControlsProps {
  /** Current grouping mode */
  groupBy: GroupMode;
  /** Callback when grouping mode changes */
  onGroupByChange: (mode: GroupMode) => void;
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Whether showing done tasks */
  showDone: boolean;
  /** Callback when show done toggle changes */
  onShowDoneChange: (showDone: boolean) => void;
  /** Hide the group by dropdown (e.g., when only one mode makes sense) */
  hideGroupBy?: boolean;
}

export function TasksControls({
  groupBy,
  onGroupByChange,
  searchQuery,
  onSearchChange,
  showDone,
  onShowDoneChange,
  hideGroupBy = false,
}: TasksControlsProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-28 sm:w-48 pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
        />
      </div>

      {/* View/Group by dropdown */}
      {!hideGroupBy && (
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isFilterOpen
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>View</span>
          </button>

          {isFilterOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsFilterOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute left-0 top-full mt-1 w-48 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Group by
                </div>
                <button
                  onClick={() => {
                    onGroupByChange('date');
                    setIsFilterOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date
                  </span>
                  {groupBy === 'date' && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
                <button
                  onClick={() => {
                    onGroupByChange('case');
                    setIsFilterOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Case
                  </span>
                  {groupBy === 'case' && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
                <button
                  onClick={() => {
                    onGroupByChange('urgency');
                    setIsFilterOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    Urgency
                  </span>
                  {groupBy === 'urgency' && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Show Done toggle */}
      <button
        onClick={() => onShowDoneChange(!showDone)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
          showDone
            ? 'border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        {showDone ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        <span>Done</span>
      </button>
    </div>
  );
}
