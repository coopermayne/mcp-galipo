import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import {
  EditableText,
  EditableDate,
  EditableTime,
  ListPanel,
  ConfirmModal,
} from '../components/common';
import { getEvents, updateEvent, deleteEvent } from '../api/client';
import type { Event } from '../types';
import { Trash2, Search, Star } from 'lucide-react';

// Deterministic color mapping for case badges
const caseColorClasses = [
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
];

const getCaseColorClass = (caseId: number) => caseColorClasses[caseId % caseColorClasses.length];

export function Calendar() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => getEvents(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) =>
      updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleUpdate = useCallback(
    async (eventId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: eventId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (eventId: number) => {
      setDeleteTarget(eventId);
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // Filter and group events by date
  const groupedEvents = useMemo(() => {
    if (!eventsData?.events) return {};

    // Filter by search query (description, case name, or short name)
    const filteredEvents = searchQuery
      ? eventsData.events.filter((event) => {
          const query = searchQuery.toLowerCase();
          return (
            event.description.toLowerCase().includes(query) ||
            (event.case_name && event.case_name.toLowerCase().includes(query)) ||
            (event.short_name && event.short_name.toLowerCase().includes(query))
          );
        })
      : eventsData.events;

    const groups: Record<string, Event[]> = {
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

    filteredEvents.forEach((event) => {
      const dueDate = new Date(event.date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        groups.overdue.push(event);
      } else if (dueDate.getTime() === today.getTime()) {
        groups.today.push(event);
      } else if (dueDate < weekEnd) {
        groups.thisWeek.push(event);
      } else if (dueDate < monthEnd) {
        groups.thisMonth.push(event);
      } else {
        groups.later.push(event);
      }
    });

    return groups;
  }, [eventsData?.events, searchQuery]);

  const groupLabels: Record<string, string> = {
    overdue: 'Overdue',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    later: 'Later',
  };

  const groupColors: Record<string, string> = {
    overdue: 'text-red-600',
    today: 'text-amber-600',
    thisWeek: 'text-blue-600',
    thisMonth: 'text-slate-600',
    later: 'text-slate-500',
  };

  return (
    <>
      <Header
        title="Calendar"
        subtitle="Hearings, depositions, and important dates"
      />

      <PageContent>
        {/* Search */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search events or cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        </ListPanel>

        {/* Event List */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : eventsData?.events.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No events found" />
          </ListPanel>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(
              ([group, events]) =>
                events.length > 0 && (
                  <div key={group}>
                    <h2 className={`text-sm font-semibold mb-2 ${groupColors[group]}`}>
                      {groupLabels[group]} ({events.length})
                    </h2>
                    <ListPanel>
                      <ListPanel.Body>
                        {events.map((event) => (
                          <ListPanel.Row key={event.id} highlight={group === 'overdue'}>
                            <button
                              onClick={() => handleUpdate(event.id, 'starred', !event.starred)}
                              className={`p-1 ${event.starred ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                              title={event.starred ? 'Unstar' : 'Star'}
                            >
                              <Star className={`w-4 h-4 ${event.starred ? 'fill-amber-500' : ''}`} />
                            </button>
                            <Link
                              to={`/cases/${event.case_id}`}
                              className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-20 truncate text-center ${getCaseColorClass(event.case_id)}`}
                              title={event.short_name || event.case_name || `Case #${event.case_id}`}
                            >
                              {event.short_name || event.case_name || `Case #${event.case_id}`}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <EditableText
                                value={event.description}
                                onSave={(value) => handleUpdate(event.id, 'description', value)}
                                className="text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-0">
                              <EditableDate
                                value={event.date}
                                onSave={(value) => handleUpdate(event.id, 'date', value)}
                                clearable={false}
                              />
                              <EditableTime
                                value={event.time || null}
                                onSave={(value) => handleUpdate(event.id, 'time', value)}
                              />
                            </div>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="p-1 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </ListPanel.Row>
                        ))}
                      </ListPanel.Body>
                    </ListPanel>
                  </div>
                )
            )}
          </div>
        )}
      </PageContent>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event?"
        confirmText="Delete Event"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
