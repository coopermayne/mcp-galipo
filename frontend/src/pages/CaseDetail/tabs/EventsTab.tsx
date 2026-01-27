import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Star, ChevronDown, ChevronUp, Link, Eye, EyeOff } from 'lucide-react';
import { EditableText, EditableDate, EditableTime, ConfirmModal } from '../../../components/common';
import { createEvent, updateEvent, deleteEvent } from '../../../api';
import type { Event } from '../../../types';

interface EventsTabProps {
  caseId: number;
  events: Event[];
}

export function EventsTab({ caseId, events }: EventsTabProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState({
    date: '',
    description: '',
    calculation_note: '',
    starred: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(
    null
  );

  // Helper to parse date string as local time (not UTC)
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Filter events based on past/future
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Compare at midnight local time
  const filteredEvents = useMemo(() => {
    if (showPastEvents) {
      return events
        .filter(e => parseLocalDate(e.date) < now)
        .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    }
    return events
      .filter(e => parseLocalDate(e.date) >= now)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [events, showPastEvents]);

  const createMutation = useMutation({
    mutationFn: () =>
      createEvent({
        case_id: caseId,
        date: newEvent.date,
        description: newEvent.description,
        calculation_note: newEvent.calculation_note || undefined,
        starred: newEvent.starred,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewEvent({ date: '', description: '', calculation_note: '', starred: false });
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) => updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setDeleteTarget(null);
    },
  });

  const handleDelete = useCallback((event: Event) => {
    setDeleteTarget({ id: event.id, description: event.description });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEvent.date && newEvent.description.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header with Add Button and Toggle */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        {isAdding ? (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="e.g., Discovery cutoff"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Calculation Note
              </label>
              <input
                type="text"
                value={newEvent.calculation_note}
                onChange={(e) => setNewEvent({ ...newEvent, calculation_note: e.target.value })}
                placeholder="e.g., 30 days from service date"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={newEvent.starred}
                  onChange={(e) => setNewEvent({ ...newEvent, starred: e.target.checked })}
                  className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
                />
                <Star className="w-3 h-3 text-amber-500" />
                Show in Key Dates
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newEvent.date || !newEvent.description.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Add Event
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                showPastEvents
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {showPastEvents ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showPastEvents ? 'Past' : 'Upcoming'}
            </button>
          </div>
        )}
      </div>

      {/* Event List */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {showPastEvents ? 'No past events' : 'No upcoming events'}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
              <div className="px-4 py-3 flex items-center gap-4">
                <button
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className="p-1 text-slate-500 hover:text-slate-300"
                >
                  {expandedId === event.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() =>
                    updateMutation.mutate({ id: event.id, data: { starred: !event.starred } })
                  }
                  className={`p-1 ${event.starred ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                  title={event.starred ? 'Remove from Key Dates' : 'Add to Key Dates'}
                >
                  <Star className={`w-4 h-4 ${event.starred ? 'fill-amber-500' : ''}`} />
                </button>
                <div className="flex items-center gap-0">
                  <EditableDate
                    value={event.date}
                    onSave={(value) =>
                      updateMutation.mutateAsync({ id: event.id, data: { date: value || undefined } })
                    }
                    clearable={false}
                  />
                  <EditableTime
                    value={event.time || null}
                    onSave={(value) =>
                      updateMutation.mutateAsync({ id: event.id, data: { time: value || undefined } })
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <EditableText
                    value={event.description}
                    onSave={(value) =>
                      updateMutation.mutateAsync({ id: event.id, data: { description: value } })
                    }
                    className="text-sm"
                  />
                </div>
                {event.document_link && (
                  <a
                    href={event.document_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-primary-400 hover:text-primary-300"
                    title="View document"
                  >
                    <Link className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(event)}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Expanded Details */}
              {expandedId === event.id && (
                <div className="px-4 pb-3 pl-12 space-y-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Document Link</label>
                    <EditableText
                      value={event.document_link || ''}
                      onSave={(value) =>
                        updateMutation.mutateAsync({
                          id: event.id,
                          data: { document_link: value || undefined },
                        })
                      }
                      placeholder="Enter URL to related document"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Calculation Note</label>
                    <EditableText
                      value={event.calculation_note || ''}
                      onSave={(value) =>
                        updateMutation.mutateAsync({
                          id: event.id,
                          data: { calculation_note: value || undefined },
                        })
                      }
                      placeholder="e.g., 30 days from service date"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteTarget?.description}"? This action cannot be undone.`}
        confirmText="Delete Event"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
