/**
 * TasksPanel - Wrapper for TasksComponent with configurable filters
 *
 * Features:
 * - Clickable header showing current filter summary
 * - Filter modal for search, groupBy, caseId, showDone
 * - Independent scrolling within the panel
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings2,
  Search,
  Calendar,
  Briefcase,
  LayoutGrid,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { TasksComponent } from './TasksComponent';
import type { TasksPanelConfig } from '../../types';
import type { GroupMode } from './TasksControls';
import type { CaseSummary } from '../../types';
import { getCases } from '../../api';

interface TasksPanelProps {
  config: TasksPanelConfig;
  onConfigChange: (updates: Partial<TasksPanelConfig>) => void;
}

const GROUP_OPTIONS: { value: GroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { value: 'case', label: 'Case', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'urgency', label: 'Urgency', icon: <LayoutGrid className="w-4 h-4" /> },
];

export function TasksPanel({ config, onConfigChange }: TasksPanelProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(config.searchQuery);
  const filterRef = useRef<HTMLDivElement>(null);

  // Fetch cases for the case filter dropdown
  const { data: casesData } = useQuery({
    queryKey: ['cases', { limit: 200 }],
    queryFn: () => getCases({ limit: 200 }),
  });
  const cases = casesData?.cases || [];

  // Sync local search with config when filter closes
  useEffect(() => {
    if (!isFilterOpen) {
      setLocalSearch(config.searchQuery);
    }
  }, [isFilterOpen, config.searchQuery]);

  // Close filter on click outside
  useEffect(() => {
    if (!isFilterOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        // Apply search on close
        if (localSearch !== config.searchQuery) {
          onConfigChange({ searchQuery: localSearch });
        }
        setIsFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen, localSearch, config.searchQuery, onConfigChange]);

  // Build filter summary text
  const getFilterSummary = () => {
    const parts: string[] = [];

    // Group by
    const groupLabel = GROUP_OPTIONS.find((g) => g.value === config.groupBy)?.label || 'Date';
    parts.push(`By ${groupLabel}`);

    // Case filter
    if (config.caseId) {
      const caseName = cases.find((c: CaseSummary) => c.id === config.caseId)?.short_name;
      if (caseName) {
        parts.push(caseName);
      }
    }

    // Show done
    if (config.showDone) {
      parts.push('Done');
    }

    // Search
    if (config.searchQuery) {
      parts.push(`"${config.searchQuery}"`);
    }

    return parts.join(' | ');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfigChange({ searchQuery: localSearch });
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    onConfigChange({ searchQuery: '' });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Panel Header */}
      <div className="relative flex-shrink-0" ref={filterRef}>
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`w-full flex items-center justify-between px-3 py-2 border-b transition-colors ${
            isFilterOpen
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span className="text-sm text-slate-600 dark:text-slate-300 truncate">
            {getFilterSummary()}
          </span>
          <Settings2 className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
        </button>

        {/* Filter Dropdown */}
        {isFilterOpen && (
          <div className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-t-0 rounded-b-lg shadow-lg">
            <div className="p-3 space-y-3">
              {/* Search */}
              <form onSubmit={handleSearchSubmit}>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                  {localSearch && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              {/* Group By */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Group by
                </label>
                <div className="flex gap-1">
                  {GROUP_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onConfigChange({ groupBy: option.value })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors ${
                        config.groupBy === option.value
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Case Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Filter by Case
                </label>
                <select
                  value={config.caseId ?? ''}
                  onChange={(e) =>
                    onConfigChange({
                      caseId: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value="">All cases</option>
                  {cases.map((c: CaseSummary) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show Done Toggle */}
              <div>
                <button
                  onClick={() => onConfigChange({ showDone: !config.showDone })}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    config.showDone
                      ? 'border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {config.showDone ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                  <span>Show completed tasks</span>
                  {config.showDone && <Check className="w-4 h-4 ml-auto" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3">
        <TasksComponent
          caseId={config.caseId}
          showAllTasks={!config.caseId}
          showControls={false}
          showDetailSheet
          enableInlineCreate
          defaultGroupBy={config.groupBy}
          showDone={config.showDone}
          onShowDoneChange={(showDone) => onConfigChange({ showDone })}
        />
      </div>
    </div>
  );
}
