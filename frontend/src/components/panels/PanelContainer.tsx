/**
 * PanelContainer - Generic panel wrapper with filters and widget content
 *
 * Renders:
 * - Header with widget type selector and filter button
 * - Filter dropdown (specific to widget type)
 * - Widget content (TasksWidget, EventsWidget, etc.)
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings2,
  Search,
  Calendar,
  Briefcase,
  LayoutGrid,
  CheckCircle2,
  ListTodo,
  Clock,
  ArrowDownUp,
  Archive,
  SortAsc,
  Users,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAttorneys } from '../../api/users';
import { getUserColorClass } from '../../utils';
import { WidgetTypeSelector } from './WidgetTypeSelector';
import { TasksWidget } from '../widgets/TasksWidget';
import { EventsWidget } from '../widgets/EventsWidget';
import { ChartWidget } from '../widgets/ChartWidget';
import { CasesWidget } from '../cases/CasesWidget';
import { PersonsWidget } from '../persons/PersonsWidget';
import { ClientsWidget } from '../persons/ClientsWidget';
import type {
  WidgetType,
  WidgetConfig,
  TasksWidgetConfig,
  EventsWidgetConfig,
  CasesWidgetConfig,
  PersonsWidgetConfig,
  ClientsWidgetConfig,
  ChartWidgetConfig,
  TasksGroupMode,
  EventsGroupMode,
  CasesGroupMode,
  PersonsGroupMode,
  CaseAttorneyFilter,
  TaskAssigneeFilter,
  CaseOwnerFilter,
  EventAttendeeFilter,
} from '../../types/panel-layout';

interface PanelContainerProps {
  config: WidgetConfig;
  allowedWidgets: WidgetType[];
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
  onTypeChange: (type: WidgetType) => void;
}

const TASKS_GROUP_OPTIONS: { value: TasksGroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'date', label: 'Date', icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: 'case', label: 'Case', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: 'urgency', label: 'Urgency', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
];

const EVENTS_GROUP_OPTIONS: { value: EventsGroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'date', label: 'Date', icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: 'case', label: 'Case', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { value: 'none', label: 'None', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
];

const CASES_GROUP_OPTIONS: { value: CasesGroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'A-Z', icon: <SortAsc className="w-3.5 h-3.5" /> },
  { value: 'alpha', label: 'Letter', icon: <SortAsc className="w-3.5 h-3.5" /> },
  { value: 'status', label: 'Status', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
];

const PERSONS_GROUP_OPTIONS: { value: PersonsGroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'category', label: 'Category', icon: <Users className="w-3.5 h-3.5" /> },
  { value: 'alpha', label: 'A-Z', icon: <SortAsc className="w-3.5 h-3.5" /> },
  { value: 'recent', label: 'Recent', icon: <Clock className="w-3.5 h-3.5" /> },
];

export function PanelContainer({
  config,
  allowedWidgets,
  onConfigChange,
  onTypeChange,
}: PanelContainerProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const configSearchQuery = 'searchQuery' in config ? (config as { searchQuery: string }).searchQuery : '';
  const [localSearch, setLocalSearch] = useState(configSearchQuery || '');
  const filterRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();

  // Fetch attorneys list for cases filter
  const { data: attorneys = [] } = useQuery({
    queryKey: ['attorneys'],
    queryFn: getAttorneys,
    enabled: config.type === 'cases',
  });

  // Sync local search with config when filter closes
  useEffect(() => {
    if (!isFilterOpen) {
      setLocalSearch(configSearchQuery);
    }
  }, [isFilterOpen, configSearchQuery]);

  // Close filter on click outside
  useEffect(() => {
    if (!isFilterOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        // Apply search on close
        if (localSearch !== configSearchQuery) {
          onConfigChange({ searchQuery: localSearch });
        }
        setIsFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen, localSearch, configSearchQuery, onConfigChange]);

  // Build filter summary text based on widget type
  const getFilterSummary = () => {
    if (config.type === 'tasks') {
      const taskConfig = config as TasksWidgetConfig;
      const parts: string[] = [];
      if (taskConfig.showDone) {
        parts.push('Done');
      } else {
        const groupLabel = TASKS_GROUP_OPTIONS.find((g) => g.value === taskConfig.groupBy)?.label || 'Date';
        parts.push(`By ${groupLabel}`);
      }
      if (taskConfig.caseOwnerFilter === 'mine') parts.push('My Cases');
      if (taskConfig.assigneeFilter === 'mine') parts.push('My Tasks');
      else if (taskConfig.assigneeFilter === 'unassigned') parts.push('Unassigned');
      return parts.join(' · ');
    } else if (config.type === 'events') {
      const eventConfig = config as EventsWidgetConfig;
      const parts: string[] = [];
      if (eventConfig.showPast) {
        parts.push('Past');
      } else {
        const groupLabel = EVENTS_GROUP_OPTIONS.find((g) => g.value === eventConfig.groupBy)?.label || 'Date';
        parts.push(`By ${groupLabel}`);
      }
      if (eventConfig.caseOwnerFilter === 'mine') parts.push('My Cases');
      if (eventConfig.attendeeFilter === 'mine') parts.push('Attending');
      return parts.join(' · ');
    } else if (config.type === 'cases') {
      const casesConfig = config as CasesWidgetConfig;
      const groupLabel = CASES_GROUP_OPTIONS.find((g) => g.value === casesConfig.groupBy)?.label || 'A-Z';
      const parts = [groupLabel];
      if (casesConfig.showClosed) parts.push('+ Closed');
      const af = casesConfig.attorneyFilter;
      if (af === 'mine') parts.push('· Mine');
      else if (af === 'unassigned') parts.push('· Unassigned');
      else if (Array.isArray(af)) parts.push(`· ${af.length} atty`);
      return parts.join(' ');
    } else if (config.type === 'persons') {
      const personsConfig = config as PersonsWidgetConfig;
      const groupLabel = PERSONS_GROUP_OPTIONS.find((g) => g.value === personsConfig.groupBy)?.label || 'Type';
      const parts = [`By ${groupLabel}`];
      if (personsConfig.showUnassigned) parts.push('No Cases');
      return parts.join(' · ');
    } else if (config.type === 'clients') {
      const clientsConfig = config as ClientsWidgetConfig;
      const parts: string[] = [];
      if (clientsConfig.caseOwnerFilter === 'mine') parts.push('My Cases');
      else parts.push('All Cases');
      return parts.join(' · ');
    } else if (config.type === 'chart') {
      const chartConfig = config as ChartWidgetConfig;
      return chartConfig.caseOwnerFilter === 'mine' ? 'My Cases' : 'All Cases';
    }

    return '';
  };

  const renderFilters = () => {
    if (config.type === 'tasks') {
      const taskConfig = config as TasksWidgetConfig;
      return (
        <div className="space-y-4">
          {/* View Mode Toggle - Active vs Done */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              View
            </label>
            <div className="flex p-0.5 rounded-lg bg-bg-hover/50 dark:bg-bg-hover/30">
              <button
                onClick={() => onConfigChange({ showDone: false })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !taskConfig.showDone
                    ? 'bg-bg-surface shadow-sm text-text border border-border/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Active</span>
              </button>
              <button
                onClick={() => onConfigChange({ showDone: true })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  taskConfig.showDone
                    ? 'bg-bg-surface shadow-sm text-text border border-border/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>

          {/* Group By - Only shown for Active tasks */}
          {!taskConfig.showDone ? (
            <div>
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
                Group by
              </label>
              <div className="flex gap-1">
                {TASKS_GROUP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onConfigChange({ groupBy: option.value })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      taskConfig.groupBy === option.value
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                        : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-bg-hover/30 text-text-muted">
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span className="text-xs">Sorted by completion date</span>
            </div>
          )}

          {/* Assigned to */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Assigned to
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ assigneeFilter: 'all' as TaskAssigneeFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  taskConfig.assigneeFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onConfigChange({ assigneeFilter: 'mine' as TaskAssigneeFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  taskConfig.assigneeFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Tasks
              </button>
              <button
                onClick={() => onConfigChange({ assigneeFilter: 'unassigned' as TaskAssigneeFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  taskConfig.assigneeFilter === 'unassigned'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Unassigned
              </button>
            </div>
          </div>

          {/* Cases */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Cases
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'all' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  taskConfig.caseOwnerFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All Cases
              </button>
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'mine' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  taskConfig.caseOwnerFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Cases
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (config.type === 'events') {
      const eventConfig = config as EventsWidgetConfig;
      return (
        <div className="space-y-4">
          {/* View Mode Toggle - Upcoming vs Past */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              View
            </label>
            <div className="flex p-0.5 rounded-lg bg-bg-hover/50 dark:bg-bg-hover/30">
              <button
                onClick={() => onConfigChange({ showPast: false })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !eventConfig.showPast
                    ? 'bg-bg-surface shadow-sm text-text border border-border/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Upcoming</span>
              </button>
              <button
                onClick={() => onConfigChange({ showPast: true })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  eventConfig.showPast
                    ? 'bg-bg-surface shadow-sm text-text border border-border/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Past</span>
              </button>
            </div>
          </div>

          {/* Group By - Only shown for Upcoming events */}
          {!eventConfig.showPast ? (
            <div>
              <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
                Group by
              </label>
              <div className="flex gap-1">
                {EVENTS_GROUP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onConfigChange({ groupBy: option.value })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      eventConfig.groupBy === option.value
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                        : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-bg-hover/30 text-text-muted">
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span className="text-xs">Most recent first</span>
            </div>
          )}

          {/* Cases filter */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Cases
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'all' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  eventConfig.caseOwnerFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All Cases
              </button>
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'mine' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  eventConfig.caseOwnerFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Cases
              </button>
            </div>
          </div>

          {/* Attending */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Attending
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ attendeeFilter: 'all' as EventAttendeeFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  eventConfig.attendeeFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => onConfigChange({ attendeeFilter: 'mine' as EventAttendeeFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  eventConfig.attendeeFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Events
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (config.type === 'cases') {
      const casesConfig = config as CasesWidgetConfig;
      return (
        <div className="space-y-4">
          {/* View Mode Toggle - Active vs Closed */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              View
            </label>
            <div className="flex p-0.5 rounded-lg bg-bg-hover/50 dark:bg-bg-hover/30">
              <button
                onClick={() => onConfigChange({ showClosed: false })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !casesConfig.showClosed
                    ? 'bg-bg-surface shadow-sm text-text border border-border/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Active</span>
              </button>
              <button
                onClick={() => onConfigChange({ showClosed: true })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  casesConfig.showClosed
                    ? 'bg-bg-surface shadow-sm text-text border border-border/50'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>+ Closed</span>
              </button>
            </div>
          </div>

          {/* Group By */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Group by
            </label>
            <div className="flex gap-1">
              {CASES_GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onConfigChange({ groupBy: option.value })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    casesConfig.groupBy === option.value
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Assigned to
            </label>
            <div className="flex flex-wrap gap-1">
              {/* Quick buttons */}
              <button
                onClick={() => onConfigChange({ attorneyFilter: 'all' as CaseAttorneyFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  casesConfig.attorneyFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onConfigChange({ attorneyFilter: 'mine' as CaseAttorneyFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  casesConfig.attorneyFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Cases
              </button>
              <button
                onClick={() => onConfigChange({ attorneyFilter: 'unassigned' as CaseAttorneyFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  casesConfig.attorneyFilter === 'unassigned'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Unassigned
              </button>
            </div>

            {/* Attorney checkboxes */}
            {attorneys.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {attorneys.map((attorney) => {
                  const isChecked = Array.isArray(casesConfig.attorneyFilter) && casesConfig.attorneyFilter.includes(attorney.id);
                  return (
                    <button
                      key={attorney.id}
                      onClick={() => {
                        const currentIds = Array.isArray(casesConfig.attorneyFilter) ? casesConfig.attorneyFilter : [];
                        const newIds = currentIds.includes(attorney.id)
                          ? currentIds.filter((id: number) => id !== attorney.id)
                          : [...currentIds, attorney.id];
                        onConfigChange({ attorneyFilter: (newIds.length === 0 ? 'all' : newIds) as CaseAttorneyFilter });
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-all ${
                        isChecked
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-text-secondary hover:bg-bg-hover/50'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-medium ${getUserColorClass(attorney.id)}`}
                      >
                        {attorney.initials}
                      </span>
                      <span className="flex-1 text-left">{attorney.firstName} {attorney.lastName}</span>
                      {isChecked && (
                        <span className="w-3.5 h-3.5 rounded border border-primary-500 bg-primary-500 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        </span>
                      )}
                      {!isChecked && (
                        <span className="w-3.5 h-3.5 rounded border border-border" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (config.type === 'persons') {
      const personsConfig = config as PersonsWidgetConfig;
      return (
        <div className="space-y-4">
          {/* Group By */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Group by
            </label>
            <div className="flex gap-1">
              {PERSONS_GROUP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onConfigChange({ groupBy: option.value })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    personsConfig.groupBy === option.value
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cases filter */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Cases
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ showUnassigned: false })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !personsConfig.showUnassigned
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onConfigChange({ showUnassigned: true })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  personsConfig.showUnassigned
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                No Cases
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (config.type === 'clients') {
      const clientsConfig = config as ClientsWidgetConfig;
      return (
        <div className="space-y-4">
          {/* Cases filter */}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Cases
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'all' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  clientsConfig.caseOwnerFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All Cases
              </button>
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'mine' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  clientsConfig.caseOwnerFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Cases
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (config.type === 'chart') {
      const chartConfig = config as ChartWidgetConfig;
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
              Cases
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'all' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartConfig.caseOwnerFilter === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                All Cases
              </button>
              <button
                onClick={() => onConfigChange({ caseOwnerFilter: 'mine' as CaseOwnerFilter })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartConfig.caseOwnerFilter === 'mine'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                }`}
              >
                {currentUser && (
                  <span
                    className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-medium ${getUserColorClass(currentUser.id)}`}
                  >
                    {currentUser.initials}
                  </span>
                )}
                My Cases
              </button>
            </div>
          </div>
        </div>
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
      case 'cases':
        return <CasesWidget config={config as CasesWidgetConfig} onConfigChange={onConfigChange} />;
      case 'persons':
        return <PersonsWidget config={config as PersonsWidgetConfig} onConfigChange={onConfigChange} />;
      case 'clients':
        return <ClientsWidget config={config as ClientsWidgetConfig} onConfigChange={onConfigChange} />;
      case 'chart':
        return <ChartWidget config={config as ChartWidgetConfig} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-bg-surface rounded-lg border border-border overflow-hidden">
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
            {/* Inline Search (hidden for chart widget) */}
            {config.type !== 'chart' && (
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
            )}

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
