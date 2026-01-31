/**
 * EventFeed - Display events with optional grouping
 *
 * Groups events by date category (overdue, today, this week, etc.)
 * or displays a flat list.
 */
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { EventItem } from './EventItem';
import type { Event } from '../../types';

export type DateGroup = 'overdue' | 'today' | 'thisWeek' | 'thisMonth' | 'later';

const groupLabels: Record<DateGroup, string> = {
  overdue: 'Overdue',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  later: 'Later',
};

const groupColors: Record<DateGroup, string> = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  thisWeek: 'text-blue-600 dark:text-blue-400',
  thisMonth: 'text-slate-600 dark:text-slate-400',
  later: 'text-slate-500 dark:text-slate-500',
};

interface EventFeedProps {
  events: Event[];
  isLoading?: boolean;
  onUpdate: (eventId: number, field: string, value: string | boolean | null) => Promise<void>;
  onDelete: (event: Event) => void;
  onCreateTask?: (event: Event) => void;
  /** Show case badge on each event */
  showCase?: boolean;
  /** Show star toggle */
  showStar?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Show create task button */
  showCreateTask?: boolean;
  /** Enable inline editing */
  enableEdit?: boolean;
  /** Group by date category */
  groupByDate?: boolean;
  /** Maximum items to display */
  maxItems?: number;
  /** Compact mode */
  compact?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

export function EventFeed({
  events,
  isLoading = false,
  onUpdate,
  onDelete,
  onCreateTask,
  showCase = true,
  showStar = true,
  showDelete = true,
  showCreateTask = true,
  enableEdit = true,
  groupByDate = false,
  maxItems,
  compact = false,
  emptyMessage = 'No events',
}: EventFeedProps) {
  // Apply maxItems limit
  const displayEvents = maxItems ? events.slice(0, maxItems) : events;

  // Group events by date category
  const groupedEvents = useMemo(() => {
    if (!groupByDate) return null;

    const groups: Record<DateGroup, Event[]> = {
      overdue: [],
      today: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setDate(monthEnd.getDate() + 30);

    displayEvents.forEach((event) => {
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);

      if (eventDate < today) {
        groups.overdue.push(event);
      } else if (eventDate.getTime() === today.getTime()) {
        groups.today.push(event);
      } else if (eventDate < weekEnd) {
        groups.thisWeek.push(event);
      } else if (eventDate < monthEnd) {
        groups.thisMonth.push(event);
      } else {
        groups.later.push(event);
      }
    });

    return groups;
  }, [displayEvents, groupByDate]);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 ${compact ? 'py-4' : 'py-8'}`}>
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (displayEvents.length === 0) {
    return (
      <div className={`text-center text-slate-400 ${compact ? 'py-4 text-xs' : 'py-8 text-sm'}`}>
        {emptyMessage}
      </div>
    );
  }

  // Grouped display
  if (groupedEvents) {
    return (
      <div className={compact ? 'space-y-3' : 'space-y-6'}>
        {(Object.entries(groupedEvents) as [DateGroup, Event[]][]).map(
          ([group, groupEvents]) =>
            groupEvents.length > 0 && (
              <div key={group}>
                <h3 className={`font-semibold mb-2 ${groupColors[group]} ${compact ? 'text-xs' : 'text-sm'}`}>
                  {groupLabels[group]} ({groupEvents.length})
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                  {groupEvents.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      onCreateTask={onCreateTask}
                      showCase={showCase}
                      showStar={showStar}
                      showDelete={showDelete}
                      showCreateTask={showCreateTask}
                      enableEdit={enableEdit}
                      highlight={group === 'overdue'}
                      compact={compact}
                    />
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    );
  }

  // Flat display
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
      {displayEvents.map((event) => (
        <EventItem
          key={event.id}
          event={event}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCreateTask={onCreateTask}
          showCase={showCase}
          showStar={showStar}
          showDelete={showDelete}
          showCreateTask={showCreateTask}
          enableEdit={enableEdit}
          compact={compact}
        />
      ))}
    </div>
  );
}
