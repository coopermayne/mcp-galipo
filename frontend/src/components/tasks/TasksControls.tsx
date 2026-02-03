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
} from 'lucide-react';
import { StatusFilterDropdown } from './StatusFilterDropdown';
import { AssigneeFilterDropdown, type AssigneeFilterValue } from './AssigneeFilterDropdown';
import type { TaskStatus, CaseStaffUser } from '../../types';

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
  /** Selected status filter */
  statusFilter: TaskStatus[];
  /** Callback when status filter changes */
  onStatusFilterChange: (statuses: TaskStatus[]) => void;
  /** Hide the group by dropdown (e.g., when only one mode makes sense) */
  hideGroupBy?: boolean;
  /** Hide the "Case" grouping option (when already in a case context) */
  hideCaseGrouping?: boolean;
  /** Current assignee filter */
  assigneeFilter?: AssigneeFilterValue;
  /** Callback when assignee filter changes */
  onAssigneeFilterChange?: (value: AssigneeFilterValue) => void;
  /** Paralegals available for filtering */
  paralegals?: CaseStaffUser[];
  /** Hide the assignee filter dropdown */
  hideAssigneeFilter?: boolean;
}

export function TasksControls({
  groupBy,
  onGroupByChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  hideGroupBy = false,
  hideCaseGrouping = false,
  assigneeFilter = 'all',
  onAssigneeFilterChange,
  paralegals = [],
  hideAssigneeFilter = false,
}: TasksControlsProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-28 sm:w-48 pl-9 pr-3 py-2 rounded-lg border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
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
                : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-hover'
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
              <div className="absolute left-0 top-full mt-1 w-48 py-2 bg-bg-surface border border-border rounded-lg shadow-lg z-50">
                <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Group by
                </div>
                <button
                  onClick={() => {
                    onGroupByChange('date');
                    setIsFilterOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
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
                      setIsFilterOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
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
                    onGroupByChange('urgency');
                    setIsFilterOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
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

      {/* Status filter dropdown */}
      <StatusFilterDropdown
        selectedStatuses={statusFilter}
        onChange={onStatusFilterChange}
      />

      {/* Assignee filter dropdown */}
      {!hideAssigneeFilter && onAssigneeFilterChange && (
        <AssigneeFilterDropdown
          value={assigneeFilter}
          onChange={onAssigneeFilterChange}
          paralegals={paralegals}
        />
      )}
    </div>
  );
}
