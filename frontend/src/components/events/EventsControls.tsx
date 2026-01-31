/**
 * EventsControls - Reusable filter bar for event lists
 *
 * Matches TasksControls pattern:
 * - Search input
 * - View dropdown (grouping mode)
 * - Past/Upcoming toggle
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

export type GroupMode = 'none' | 'date' | 'case';

interface EventsControlsProps {
  /** Current grouping mode */
  groupBy?: GroupMode;
  /** Callback when grouping mode changes */
  onGroupByChange?: (mode: GroupMode) => void;
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Whether showing past events */
  showPast: boolean;
  /** Callback when past/upcoming toggle changes */
  onShowPastChange: (showPast: boolean) => void;
  /** Hide the group by dropdown */
  hideGroupBy?: boolean;
  /** Hide the "Case" grouping option (when already in a case context) */
  hideCaseGrouping?: boolean;
  /** Hide the past/upcoming toggle */
  hidePastToggle?: boolean;
}

export function EventsControls({
  groupBy = 'none',
  onGroupByChange,
  searchQuery,
  onSearchChange,
  showPast,
  onShowPastChange,
  hideGroupBy = false,
  hideCaseGrouping = false,
  hidePastToggle = false,
}: EventsControlsProps) {
  const [isViewOpen, setIsViewOpen] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-28 sm:w-48 pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
        />
      </div>

      {/* View/Group by dropdown */}
      {!hideGroupBy && onGroupByChange && (
        <div className="relative">
          <button
            onClick={() => setIsViewOpen(!isViewOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isViewOpen
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>View</span>
          </button>

          {isViewOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsViewOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute left-0 top-full mt-1 w-48 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Group by
                </div>
                <button
                  onClick={() => {
                    onGroupByChange('date');
                    setIsViewOpen(false);
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
                {!hideCaseGrouping && (
                  <button
                    onClick={() => {
                      onGroupByChange('case');
                      setIsViewOpen(false);
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
                )}
                <button
                  onClick={() => {
                    onGroupByChange('none');
                    setIsViewOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    List
                  </span>
                  {groupBy === 'none' && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Past/Upcoming toggle */}
      {!hidePastToggle && (
        <button
          onClick={() => onShowPastChange(!showPast)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showPast
              ? 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {showPast ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span>{showPast ? 'Past' : 'Upcoming'}</span>
        </button>
      )}
    </div>
  );
}
