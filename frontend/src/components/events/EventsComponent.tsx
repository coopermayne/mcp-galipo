/**
 * EventsComponent - Self-contained, modular event list component
 *
 * Fully autonomous - fetches and manages its own data. Handles:
 * - Data fetching (by caseId or all events)
 * - Filtering by past/upcoming
 * - Search
 * - Grouping by date category
 * - Inline editing
 * - Delete confirmation
 * - Create task from event
 *
 * Usage:
 *   <EventsComponent showAllEvents showControls />
 *   <EventsComponent caseId={123} compact />
 */
import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock } from 'lucide-react';
import { EventsControls } from './EventsControls';
import { EventFeed } from './EventFeed';
import { useEventActions } from './useEventActions';
import { DeleteEventModal, CreateTaskFromEventModal } from '../common';
import { getEvents } from '../../api';
import type { Event } from '../../types';

interface EventsComponentProps {
  // Data source (one of these):
  /** Fetch events for a specific case */
  caseId?: number;
  /** Fetch all events */
  showAllEvents?: boolean;
  /** Pass events directly instead of fetching (for case detail where we have the data) */
  events?: Event[];

  // Header options
  /** Optional title to display in header */
  title?: string;
  /** Optional "View all" link URL */
  viewAllLink?: string;

  // Feature flags
  /** Show search and past/future toggle */
  showControls?: boolean;
  /** Hide search when showControls is true */
  hideSearch?: boolean;
  /** Hide past/future toggle when showControls is true */
  hidePastToggle?: boolean;
  /** Show case badge on each event */
  showCase?: boolean;
  /** Show star toggle button */
  showStar?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Show create task button */
  showCreateTask?: boolean;
  /** Enable inline editing */
  enableEdit?: boolean;

  // Display options
  /** Group events by date category (overdue, today, this week, etc.) */
  groupByDate?: boolean;
  /** Maximum number of events to display (for preview/compact views) */
  maxItems?: number;
  /** Compact mode - tighter spacing, smaller elements */
  compact?: boolean;
  /** Initial state for past/future toggle */
  defaultShowPast?: boolean;
  /** Past days to fetch when showing past events */
  pastDays?: number;

  // Callbacks (for parent notification, optional)
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
  hidePastToggle = false,
  showCase = true,
  showStar = true,
  showDelete = true,
  showCreateTask = true,
  enableEdit = true,

  // Display
  groupByDate = false,
  maxItems,
  compact = false,
  defaultShowPast = false,
  pastDays = 14,

  // Callbacks
  onEventUpdated,
  onEventDeleted,
}: EventsComponentProps) {
  // Local UI state
  const [showPast, setShowPast] = useState(defaultShowPast);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [taskFromEvent, setTaskFromEvent] = useState<Event | null>(null);

  // Build invalidation keys based on context
  const invalidateKeys: string[][] = [];
  if (caseId) {
    invalidateKeys.push(['case', String(caseId)]);
  }

  // Event actions hook
  const { update, delete: deleteEvent, isDeleting } = useEventActions({ invalidateKeys });

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
    // Get events from props or fetch
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
        .sort((a, b) => {
          const [aY, aM, aD] = a.date.split('-').map(Number);
          const [bY, bM, bD] = b.date.split('-').map(Number);
          return new Date(bY, bM - 1, bD).getTime() - new Date(aY, aM - 1, aD).getTime();
        });
    }

    return rawEvents
      .filter((e) => {
        const [year, month, day] = e.date.split('-').map(Number);
        return new Date(year, month - 1, day) >= now;
      })
      .sort((a, b) => {
        const [aY, aM, aD] = a.date.split('-').map(Number);
        const [bY, bM, bD] = b.date.split('-').map(Number);
        return new Date(aY, aM - 1, aD).getTime() - new Date(bY, bM - 1, bD).getTime();
      });
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

  // Handle event update
  const handleUpdate = useCallback(
    async (eventId: number, field: string, value: string | boolean | null) => {
      const result = await update(eventId, { [field]: value });
      if (result?.event) {
        onEventUpdated?.(result.event);
      }
    },
    [update, onEventUpdated]
  );

  // Handle delete request (opens modal)
  const handleDeleteRequest = useCallback((event: Event) => {
    setDeleteTarget({ id: event.id, description: event.description });
  }, []);

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteEvent(deleteTarget.id);
      onEventDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteEvent, onEventDeleted]);

  // Handle create task from event
  const handleCreateTask = useCallback((event: Event) => {
    setTaskFromEvent(event);
  }, []);

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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showPast={showPast}
          onShowPastChange={setShowPast}
          hideSearch={hideSearch}
          hidePastToggle={hidePastToggle}
          compact={compact}
        />
      )}

      {/* Event Feed */}
      <EventFeed
        events={events}
        isLoading={isLoading}
        onUpdate={handleUpdate}
        onDelete={handleDeleteRequest}
        onCreateTask={showCreateTask ? handleCreateTask : undefined}
        showCase={showCase}
        showStar={showStar}
        showDelete={showDelete}
        showCreateTask={showCreateTask}
        enableEdit={enableEdit}
        groupByDate={groupByDate}
        maxItems={maxItems}
        compact={compact}
        emptyMessage={showPast ? 'No past events' : 'No upcoming events'}
      />

      {/* Delete confirmation modal */}
      <DeleteEventModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        eventId={deleteTarget?.id ?? null}
        eventDescription={deleteTarget?.description ?? ''}
        isLoading={isDeleting}
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
