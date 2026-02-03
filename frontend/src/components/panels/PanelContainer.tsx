/**
 * PanelContainer - Generic panel wrapper with filters and widget content
 *
 * Renders:
 * - Header with widget type selector and filter button
 * - Filter dropdown (specific to widget type)
 * - Widget content (TasksWidget, EventsWidget, etc.)
 */
import { useState, useRef, useEffect } from 'react';
import {
  Settings2,
  Search,
  Calendar,
  Briefcase,
  LayoutGrid,
  Eye,
  EyeOff,
  Check,
  Clock,
} from 'lucide-react';
import { WidgetTypeSelector } from './WidgetTypeSelector';
import { TasksWidget } from '../widgets/TasksWidget';
import { EventsWidget } from '../widgets/EventsWidget';
import type {
  WidgetType,
  WidgetConfig,
  TasksWidgetConfig,
  EventsWidgetConfig,
  TasksGroupMode,
  EventsGroupMode,
} from '../../types/panel-layout';

interface PanelContainerProps {
  config: WidgetConfig;
  allowedWidgets: WidgetType[];
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
  onTypeChange: (type: WidgetType) => void;
}

const TASKS_GROUP_OPTIONS: { value: TasksGroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { value: 'case', label: 'Case', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'urgency', label: 'Urgency', icon: <LayoutGrid className="w-4 h-4" /> },
];

const EVENTS_GROUP_OPTIONS: { value: EventsGroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { value: 'case', label: 'Case', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'none', label: 'None', icon: <LayoutGrid className="w-4 h-4" /> },
];

export function PanelContainer({
  config,
  allowedWidgets,
  onConfigChange,
  onTypeChange,
}: PanelContainerProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(config.searchQuery || '');
  const filterRef = useRef<HTMLDivElement>(null);

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

  // Build filter summary text based on widget type
  const getFilterSummary = () => {
    const parts: string[] = [];

    if (config.type === 'tasks') {
      const taskConfig = config as TasksWidgetConfig;
      const groupLabel = TASKS_GROUP_OPTIONS.find((g) => g.value === taskConfig.groupBy)?.label || 'Date';
      parts.push(`By ${groupLabel}`);
      if (taskConfig.showDone) parts.push('Done');
    } else if (config.type === 'events') {
      const eventConfig = config as EventsWidgetConfig;
      const groupLabel = EVENTS_GROUP_OPTIONS.find((g) => g.value === eventConfig.groupBy)?.label || 'Date';
      parts.push(`By ${groupLabel}`);
      if (eventConfig.showPast) parts.push('Past');
    }

    return parts.join(' | ');
  };

  const renderFilters = () => {
    if (config.type === 'tasks') {
      const taskConfig = config as TasksWidgetConfig;
      return (
        <>
          {/* Group By */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Group by
            </label>
            <div className="flex gap-1">
              {TASKS_GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onConfigChange({ groupBy: option.value })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors ${
                    taskConfig.groupBy === option.value
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Show Done Toggle */}
          <div>
            <button
              onClick={() => onConfigChange({ showDone: !taskConfig.showDone })}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                taskConfig.showDone
                  ? 'border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'border-border text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {taskConfig.showDone ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              <span>Show completed tasks</span>
              {taskConfig.showDone && <Check className="w-4 h-4 ml-auto" />}
            </button>
          </div>
        </>
      );
    }

    if (config.type === 'events') {
      const eventConfig = config as EventsWidgetConfig;
      return (
        <>
          {/* Group By */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Group by
            </label>
            <div className="flex gap-1">
              {EVENTS_GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onConfigChange({ groupBy: option.value })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors ${
                    eventConfig.groupBy === option.value
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Show Past Toggle */}
          <div>
            <button
              onClick={() => onConfigChange({ showPast: !eventConfig.showPast })}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                eventConfig.showPast
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'border-border text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Show past events</span>
              {eventConfig.showPast && <Check className="w-4 h-4 ml-auto" />}
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  const renderWidget = () => {
    switch (config.type) {
      case 'tasks':
        return <TasksWidget config={config as TasksWidgetConfig} onConfigChange={onConfigChange} />;
      case 'events':
        return <EventsWidget config={config as EventsWidgetConfig} onConfigChange={onConfigChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-surface rounded-lg border border-border overflow-hidden">
      {/* Panel Header */}
      <div className="relative flex-shrink-0" ref={filterRef}>
        <div
          className={`flex items-center justify-between px-3 py-2 border-b transition-colors ${
            isFilterOpen
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-border'
          }`}
        >
          {/* Widget Type Selector */}
          <WidgetTypeSelector
            value={config.type}
            allowedWidgets={allowedWidgets}
            onChange={onTypeChange}
          />

          {/* Right side: Search + Filter Button */}
          <div className="flex items-center gap-2">
            {/* Inline Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  onConfigChange({ searchQuery: e.target.value });
                }}
                className="w-32 sm:w-40 pl-7 pr-2 py-1 rounded border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                isFilterOpen
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <span className="text-xs text-text-muted truncate max-w-[200px]">
                {getFilterSummary()}
              </span>
              <Settings2 className="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Filter Dropdown */}
        {isFilterOpen && (
          <div className="absolute left-0 right-0 top-full z-50 bg-bg-surface border border-border border-t-0 rounded-b-lg shadow-lg">
            <div className="p-3 space-y-3">
              {/* Widget-specific filters */}
              {renderFilters()}
            </div>
          </div>
        )}
      </div>

      {/* Panel Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderWidget()}
      </div>
    </div>
  );
}
