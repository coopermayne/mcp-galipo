/**
 * EventFeed - Todoist-style event list with date grouping
 *
 * Groups events by date category (Overdue, Today, This Week, etc.)
 * Matches TaskFeed pattern for consistency.
 */
import { useState, useMemo, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { EventItem } from './EventItem';
import { EventInlineEdit } from './EventInlineEdit';
import { EventInlineCreate } from './EventInlineCreate';
import { ConfirmModal } from '../common';
import type { Event } from '../../types';

export type DateGroup = 'overdue' | 'today' | 'thisWeek' | 'thisMonth' | 'later';

interface EventGroup {
  key: string;
  label: string;
  date: Date | null;
  events: Event[];
  isOverdue?: boolean;
  isCollapsible?: boolean;
  caseId?: number;
}

/**
 * Format section header (matching TaskFeed style)
 */
function formatSectionHeader(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `${dateStr} · Today · ${dayName}`;
  } else if (diffDays === 1) {
    return `${dateStr} · Tomorrow · ${dayName}`;
  } else {
    return `${dateStr} · ${dayName}`;
  }
}

/**
 * Group events by date category
 */
function groupEventsByDate(events: Event[]): EventGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(today);
  monthEnd.setDate(monthEnd.getDate() + 30);

  const groups: Map<string, EventGroup> = new Map();
  const overdueEvents: Event[] = [];

  for (const event of events) {
    const [year, month, day] = event.date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      overdueEvents.push(event);
    } else {
      const key = event.date;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: formatSectionHeader(eventDate),
          date: eventDate,
          events: [],
        });
      }
      groups.get(key)!.events.push(event);
    }
  }

  const result: EventGroup[] = [];

  // Add overdue section first
  if (overdueEvents.length > 0) {
    result.push({
      key: 'overdue',
      label: 'Overdue',
      date: null,
      events: overdueEvents.sort((a, b) => a.date.localeCompare(b.date)),
      isOverdue: true,
      isCollapsible: true,
    });
  }

  // Add date groups sorted by date
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return a.date.getTime() - b.date.getTime();
  });
  result.push(...sortedGroups);

  return result;
}

/**
 * Group events by case
 */
function groupEventsByCase(events: Event[]): EventGroup[] {
  const groups: Map<number, EventGroup> = new Map();

  for (const event of events) {
    const caseId = event.case_id;
    if (!groups.has(caseId)) {
      const caseName = event.case_name || event.short_name || `Case #${caseId}`;
      groups.set(caseId, {
        key: `case-${caseId}`,
        label: caseName,
        date: null,
        events: [],
        caseId,
      });
    }
    groups.get(caseId)!.events.push(event);
  }

  // Sort groups alphabetically by case name, events within by date
  return Array.from(groups.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      events: group.events.sort((a, b) => a.date.localeCompare(b.date)),
    }));
}

/**
 * Section header component (Todoist style)
 */
function SectionHeader({
  group,
  isCollapsed,
  onToggleCollapse,
}: {
  group: EventGroup;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-2">
      <div className="flex items-center gap-2">
        {group.isCollapsible && (
          <button
            onClick={onToggleCollapse}
            className="p-0.5 text-text-muted hover:text-text-secondary"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
        <h3
          className={`text-sm font-semibold ${
            group.isOverdue
              ? 'text-red-600 dark:text-red-400'
              : 'text-text'
          }`}
        >
          {group.label}
        </h3>
        <span className="text-xs text-text-muted">({group.events.length})</span>
      </div>
    </div>
  );
}

/**
 * Add event button (Todoist style)
 */
function AddEventButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-2 w-full text-left text-sm text-primary-500 hover:text-primary-600 group"
    >
      <Plus className="w-4 h-4" />
      <span>Add event</span>
    </button>
  );
}

interface EventFeedProps {
  events: Event[];
  isLoading?: boolean;
  /** Pre-selected case ID for inline creation */
  caseId?: number;
  /** Show case link on each row (auto-hidden when grouping by case) */
  showCase?: boolean;
  /** How to group events: 'none' | 'date' | 'case' */
  groupBy?: 'none' | 'date' | 'case';
  /** When true, sorts in descending order (most recent first) for past events view */
  showPast?: boolean;
  /** Maximum number of events to display */
  maxItems?: number;
  /** Compact mode - tighter spacing */
  compact?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Callback when star is toggled */
  onToggleStar?: (event: Event) => void;
  /** Callback when date changes */
  onDateChange?: (event: Event, newDate: string) => void;
  /** Callback when time changes (null to clear) */
  onTimeChange?: (event: Event, newTime: string | null) => void;
  /** Callback when event row is clicked */
  onClick?: (event: Event) => void;
  /** Callback when edit action is clicked (opens modal) - if not set, uses inline edit */
  onEdit?: (event: Event) => void;
  /** Callback when create task action is clicked */
  onCreateTask?: (event: Event) => void;
  /** Callback when delete is requested */
  onDelete?: (event: Event) => void;
  /** Callback when add event is clicked */
  onAddEvent?: () => void;
  /** Callback when event is updated via inline edit */
  onInlineEditSave?: (eventId: number, updates: { description?: string; date?: string; time?: string | null }) => Promise<void>;
  /** Enable inline editing when edit button is clicked (instead of using onEdit) */
  enableInlineEdit?: boolean;
  /** Callback when a new event is created via inline form */
  onInlineCreateSave?: (data: { case_id: number; description: string; date: string; time?: string }) => Promise<void>;
  /** Enable inline event creation (instead of calling onAddEvent) */
  enableInlineCreate?: boolean;
}

export function EventFeed({
  events,
  isLoading = false,
  caseId,
  showCase = true,
  groupBy = 'none',
  showPast = false,
  maxItems,
  compact = false,
  emptyMessage = 'No events',
  onToggleStar,
  onDateChange,
  onTimeChange,
  onClick,
  onEdit,
  onCreateTask,
  onDelete,
  onAddEvent,
  onInlineEditSave,
  enableInlineEdit = false,
  onInlineCreateSave,
  enableInlineCreate = false,
}: EventFeedProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inlineEditEventId, setInlineEditEventId] = useState<number | null>(null);
  const [inlineCreateContext, setInlineCreateContext] = useState<{ groupKey: string; date?: string; caseId?: number } | null>(null);

  // Apply maxItems limit
  const limitedEvents = useMemo(() => {
    if (maxItems && events.length > maxItems) {
      return events.slice(0, maxItems);
    }
    return events;
  }, [events, maxItems]);

  // Group events based on groupBy mode
  const groups = useMemo(() => {
    switch (groupBy) {
      case 'date':
        return groupEventsByDate(limitedEvents);
      case 'case':
        return groupEventsByCase(limitedEvents);
      case 'none':
      default:
        // Flat list sorted by date
        // For past events: most recent first (descending)
        // For upcoming events: soonest first (ascending)
        return [
          {
            key: 'all',
            label: '',
            date: null,
            events: [...limitedEvents].sort((a, b) =>
              showPast
                ? b.date.localeCompare(a.date)  // descending for past
                : a.date.localeCompare(b.date)  // ascending for upcoming
            ),
          },
        ];
    }
  }, [limitedEvents, groupBy, showPast]);

  // Hide case column when grouping by case (redundant info)
  const effectiveShowCase = showCase && groupBy !== 'case';

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDeleteClick = (event: Event) => {
    setDeleteTarget(event);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget && onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(deleteTarget);
      } finally {
        setIsDeleting(false);
        setDeleteTarget(null);
      }
    }
  };

  // Handle edit button click - either start inline edit or call external handler
  const handleEditClick = useCallback((event: Event) => {
    if (enableInlineEdit) {
      setInlineEditEventId(event.id);
    } else if (onEdit) {
      onEdit(event);
    }
  }, [enableInlineEdit, onEdit]);

  // Handle inline edit save
  const handleInlineEditSave = useCallback(async (
    eventId: number,
    updates: { description?: string; date?: string; time?: string | null }
  ) => {
    if (onInlineEditSave) {
      await onInlineEditSave(eventId, updates);
    }
    setInlineEditEventId(null);
  }, [onInlineEditSave]);

  // Handle inline edit cancel
  const handleInlineEditCancel = useCallback(() => {
    setInlineEditEventId(null);
  }, []);

  // Handle add event button click - show inline form or call external handler
  const handleAddEventClick = useCallback((groupKey: string, date?: string, caseId?: number) => {
    if (enableInlineCreate) {
      setInlineCreateContext({ groupKey, date, caseId });
    } else if (onAddEvent) {
      onAddEvent();
    }
  }, [enableInlineCreate, onAddEvent]);

  // Handle inline create save
  const handleInlineCreateSave = useCallback(async (
    data: { case_id: number; description: string; date: string; time?: string }
  ) => {
    if (onInlineCreateSave) {
      await onInlineCreateSave(data);
    }
    setInlineCreateContext(null);
  }, [onInlineCreateSave]);

  // Handle inline create cancel
  const handleInlineCreateCancel = useCallback(() => {
    setInlineCreateContext(null);
  }, []);

  // Flush mode (no left padding) when not grouping
  const isFlush = groupBy === 'none';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={compact ? 'py-2' : 'py-8'}>
        <div
          className={`text-center text-text-secondary ${
            compact ? 'py-2 text-xs' : 'py-8'
          }`}
        >
          {emptyMessage}
        </div>
        {!compact && (inlineCreateContext?.groupKey === 'empty' ? (
          <EventInlineCreate
            caseId={caseId}
            onSave={handleInlineCreateSave}
            onCancel={handleInlineCreateCancel}
          />
        ) : (onAddEvent || enableInlineCreate) && (
          <AddEventButton onClick={() => handleAddEventClick('empty', undefined, caseId)} />
        ))}
      </div>
    );
  }

  const renderEventList = (groupEvents: Event[]) => (
    <>
      {groupEvents.map((event) => {
        // Render inline edit form if this event is being edited
        if (inlineEditEventId === event.id) {
          return (
            <EventInlineEdit
              key={event.id}
              event={event}
              showCase={effectiveShowCase}
              onSave={handleInlineEditSave}
              onCancel={handleInlineEditCancel}
            />
          );
        }

        return (
          <EventItem
            key={event.id}
            event={event}
            showCase={effectiveShowCase}
            onToggleStar={onToggleStar}
            onDateChange={onDateChange}
            onTimeChange={onTimeChange}
            onClick={onClick}
            onEdit={handleEditClick}
            onCreateTask={onCreateTask}
            onDelete={onDelete ? () => handleDeleteClick(event) : undefined}
            isHighlighted={
              groupBy === 'date' &&
              groups.find((g) => g.events.includes(event))?.isOverdue
            }
            flush={isFlush}
          />
        );
      })}
    </>
  );

  return (
    <>
      <div>
        {groups.map((group) => {
          const isCollapsed = collapsedSections.has(group.key);

          return (
            <div key={group.key} className="mb-4">
              {/* Section header */}
              {group.label && (
                <>
                  <SectionHeader
                    group={group}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={
                      group.isCollapsible ? () => toggleSection(group.key) : undefined
                    }
                  />
                  <div className="border-b border-border mx-2" />
                </>
              )}

              {/* Event list */}
              {!isCollapsed && (
                <>
                  {renderEventList(group.events)}

                  {/* Inline create form or Add event button */}
                  {inlineCreateContext?.groupKey === group.key ? (
                    <EventInlineCreate
                      caseId={inlineCreateContext.caseId || caseId}
                      date={inlineCreateContext.date}
                      onSave={handleInlineCreateSave}
                      onCancel={handleInlineCreateCancel}
                    />
                  ) : (onAddEvent || enableInlineCreate) && (
                    <AddEventButton onClick={() => handleAddEventClick(
                      group.key,
                      group.date?.toISOString().split('T')[0],
                      group.caseId || caseId
                    )} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteTarget?.description}"? Any linked tasks will also be deleted.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}
