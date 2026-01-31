/**
 * EventsComponent - Self-contained, modular event list component
 *
 * Fully autonomous - fetches and manages its own data.
 * Matches TasksComponent pattern for consistency.
 *
 * Usage:
 *   <EventsComponent showAllEvents showControls />
 *   <EventsComponent caseId={123} compact />
 */
import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock } from 'lucide-react';
import { EventsControls, type GroupMode } from './EventsControls';
import { EventFeed } from './EventFeed';
import { EventDetailSheet } from './EventDetailSheet';
import { useEventActions } from './useEventActions';
import { CreateTaskFromEventModal } from '../common';
import { getEvents } from '../../api';
import type { Event } from '../../types';

interface EventsComponentProps {
  // Data source (one of these):
  /** Fetch events for a specific case */
  caseId?: number;
  /** Fetch all events */
  showAllEvents?: boolean;
  /** Pass events directly instead of fetching */
  events?: Event[];

  // Header options
  /** Optional title to display in header */
  title?: string;
  /** Optional "View all" link URL */
  viewAllLink?: string;

  // Feature flags
  /** Show search, view dropdown, and past/future toggle */
  showControls?: boolean;
  /** Hide search when showControls is true */
  hideSearch?: boolean;
  /** Hide group by dropdown when showControls is true */
  hideGroupBy?: boolean;
  /** Hide past/future toggle when showControls is true */
  hidePastToggle?: boolean;
  /** Show case link on each event row */
  showCase?: boolean;

  // Display options
  /** Initial grouping mode */
  defaultGroupBy?: GroupMode;
  /** Maximum number of events to display */
  maxItems?: number;
  /** Compact mode - tighter spacing */
  compact?: boolean;
  /** Initial state for past/future toggle */
  defaultShowPast?: boolean;
  /** Past days to fetch when showing past events */
  pastDays?: number;
  /** Group events by date category (overdue, today, etc.) - overrides groupBy */
  groupByDate?: boolean;

  // Callbacks
  onEventUpdated?: (event: Event) => void;
  onEventDeleted?: (eventId: number) => void;
}

export function EventsComponent({
  // Data
  caseId,
  showAllEvents = false,
  events: passedEvents,

  // Header
  title,
  viewAllLink,

  // Features
  showControls = false,
  hideSearch = false,
  hideGroupBy = false,
  hidePastToggle = false,
  showCase = true,

  // Display
  defaultGroupBy = 'none',
  maxItems,
  compact = false,
  defaultShowPast = false,
  pastDays = 14,
  groupByDate = false,

  // Callbacks
  onEventUpdated,
  onEventDeleted,
}: EventsComponentProps) {
  // Local UI state
  const [groupBy, setGroupBy] = useState<GroupMode>(groupByDate ? 'date' : defaultGroupBy);
  const [showPast, setShowPast] = useState(defaultShowPast);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFromEvent, setTaskFromEvent] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Build invalidation keys based on context
  const invalidateKeys: string[][] = [];
  if (caseId) {
    invalidateKeys.push(['case', String(caseId)]);
  }

  // Event actions hook
  const { create, update, delete: deleteEvent, toggleStar } = useEventActions({ invalidateKeys });

  // Fetch events (only if not passed directly)
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: caseId
      ? ['events', { case_id: caseId, showPast }]
      : ['events', { showPast }],
    queryFn: () =>
      getEvents({
        limit: 100,
        includePast: showPast,
        pastDays: showPast ? pastDays : undefined,
      }),
    enabled: !passedEvents && (showAllEvents || !!caseId),
  });

  // Filter passed events by past/future if we got them directly
  const filteredByTime = useMemo(() => {
    const rawEvents = passedEvents || fetchedData?.events || [];

    if (!passedEvents) return rawEvents; // Already filtered by API

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (showPast) {
      return rawEvents
        .filter((e) => {
          const [year, month, day] = e.date.split('-').map(Number);
          return new Date(year, month - 1, day) < now;
        })
        .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
    }

    return rawEvents
      .filter((e) => {
        const [year, month, day] = e.date.split('-').map(Number);
        return new Date(year, month - 1, day) >= now;
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Earliest first
  }, [passedEvents, fetchedData?.events, showPast]);

  // Filter by search query
  const events = useMemo(() => {
    if (!searchQuery.trim()) return filteredByTime;
    const query = searchQuery.toLowerCase();
    return filteredByTime.filter(
      (event) =>
        event.description.toLowerCase().includes(query) ||
        event.case_name?.toLowerCase().includes(query) ||
        event.short_name?.toLowerCase().includes(query)
    );
  }, [filteredByTime, searchQuery]);

  // Handle star toggle
  const handleToggleStar = useCallback(
    async (event: Event) => {
      const result = await toggleStar(event);
      if (result?.event) {
        onEventUpdated?.(result.event);
      }
    },
    [toggleStar, onEventUpdated]
  );

  // Handle date change
  const handleDateChange = useCallback(
    async (event: Event, newDate: string) => {
      const result = await update(event.id, { date: newDate });
      if (result?.event) {
        onEventUpdated?.(result.event);
      }
    },
    [update, onEventUpdated]
  );

  // Handle time change
  const handleTimeChange = useCallback(
    async (event: Event, newTime: string | null) => {
      const result = await update(event.id, { time: newTime });
      if (result?.event) {
        onEventUpdated?.(result.event);
      }
    },
    [update, onEventUpdated]
  );

  // Handle create task from event
  const handleCreateTask = useCallback((event: Event) => {
    setTaskFromEvent(event);
  }, []);

  // Handle delete
  const handleDelete = useCallback(
    async (event: Event) => {
      await deleteEvent(event.id);
      onEventDeleted?.(event.id);
    },
    [deleteEvent, onEventDeleted]
  );

  // Handle inline edit save
  const handleInlineEditSave = useCallback(
    async (eventId: number, updates: { description?: string; date?: string; time?: string | null }) => {
      const result = await update(eventId, updates);
      if (result?.event) {
        onEventUpdated?.(result.event);
      }
    },
    [update, onEventUpdated]
  );

  // Handle inline create save
  const handleInlineCreateSave = useCallback(
    async (data: { case_id: number; description: string; date: string; time?: string }) => {
      const result = await create(data);
      if (result?.event) {
        onEventUpdated?.(result.event);
      }
    },
    [create, onEventUpdated]
  );

  // Handle event row click - open detail sheet
  const handleEventClick = useCallback((event: Event) => {
    setSelectedEvent(event);
  }, []);

  // Handle update from detail sheet
  const handleSheetUpdate = useCallback(
    async (eventId: number, updates: Partial<Event>) => {
      const result = await update(eventId, updates);
      if (result?.event) {
        setSelectedEvent(result.event);
        onEventUpdated?.(result.event);
      }
    },
    [update, onEventUpdated]
  );

  // Handle delete from detail sheet
  const handleSheetDelete = useCallback(
    async (eventId: number) => {
      await deleteEvent(eventId);
      setSelectedEvent(null);
      onEventDeleted?.(eventId);
    },
    [deleteEvent, onEventDeleted]
  );

  // Handle star toggle from detail sheet
  const handleSheetToggleStar = useCallback(
    async (event: Event) => {
      const result = await toggleStar(event);
      if (result?.event) {
        setSelectedEvent(result.event);
        onEventUpdated?.(result.event);
      }
    },
    [toggleStar, onEventUpdated]
  );

  // Navigate to previous event in the list
  const handlePrevEvent = useCallback(() => {
    if (!selectedEvent) return;
    const currentIndex = events.findIndex((e) => e.id === selectedEvent.id);
    if (currentIndex > 0) {
      setSelectedEvent(events[currentIndex - 1]);
    }
  }, [selectedEvent, events]);

  // Navigate to next event in the list
  const handleNextEvent = useCallback(() => {
    if (!selectedEvent) return;
    const currentIndex = events.findIndex((e) => e.id === selectedEvent.id);
    if (currentIndex >= 0 && currentIndex < events.length - 1) {
      setSelectedEvent(events[currentIndex + 1]);
    }
  }, [selectedEvent, events]);

  // Check if there are prev/next events
  const selectedEventIndex = selectedEvent
    ? events.findIndex((e) => e.id === selectedEvent.id)
    : -1;
  const hasPrevEvent = selectedEventIndex > 0;
  const hasNextEvent = selectedEventIndex >= 0 && selectedEventIndex < events.length - 1;

  return (
    <>
      {/* Header */}
      {(title || viewAllLink) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h2 className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="font-semibold">{title}</span>
              <span className="font-normal text-slate-400">({events.length})</span>
            </h2>
          )}
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <EventsControls
          groupBy={groupBy}
          onGroupByChange={hideGroupBy ? undefined : setGroupBy}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showPast={showPast}
          onShowPastChange={setShowPast}
          hideSearch={hideSearch}
          hideGroupBy={hideGroupBy}
          hidePastToggle={hidePastToggle}
        />
      )}

      {/* Event Feed */}
      <EventFeed
        events={events}
        isLoading={isLoading}
        showCase={showCase}
        groupBy={groupBy}
        maxItems={maxItems}
        compact={compact}
        emptyMessage={showPast ? 'No past events' : 'No upcoming events'}
        onToggleStar={handleToggleStar}
        onDateChange={handleDateChange}
        onTimeChange={handleTimeChange}
        onClick={handleEventClick}
        onCreateTask={handleCreateTask}
        onDelete={handleDelete}
        enableInlineEdit
        onInlineEditSave={handleInlineEditSave}
        enableInlineCreate
        onInlineCreateSave={handleInlineCreateSave}
      />

      {/* Event Detail Sheet */}
      <EventDetailSheet
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onToggleStar={handleSheetToggleStar}
        onUpdate={handleSheetUpdate}
        onDelete={handleSheetDelete}
        onCreateTask={handleCreateTask}
        onPrevEvent={handlePrevEvent}
        onNextEvent={handleNextEvent}
        hasPrevEvent={hasPrevEvent}
        hasNextEvent={hasNextEvent}
      />

      {/* Create task from event modal */}
      <CreateTaskFromEventModal
        isOpen={!!taskFromEvent}
        onClose={() => setTaskFromEvent(null)}
        event={taskFromEvent}
        caseId={taskFromEvent?.case_id ?? caseId ?? 0}
      />
    </>
  );
}
