/**
 * EventLinkPopover - Search and link events to a task
 *
 * Shows a searchable list of events from the same case.
 * Loads all events upfront and filters locally.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Link2, Loader2 } from 'lucide-react';
import { searchEvents } from '../../api';
import type { Task, Event } from '../../types';

interface EventLinkPopoverProps {
  task: Task;
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onLinkEvent: (taskId: number, eventId: number | null) => void;
}

/**
 * Format date for display
 */
function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function EventLinkPopover({
  task,
  isOpen,
  anchorEl,
  onClose,
  onLinkEvent,
}: EventLinkPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch ALL events for the task's case (no search param - filter locally)
  const { data, isLoading } = useQuery({
    queryKey: ['case-events', task.case_id],
    queryFn: () => searchEvents({ caseId: task.case_id }),
    enabled: isOpen && !!task.case_id,
    staleTime: 30000, // Cache for 30 seconds
  });

  const allEvents = data?.events || [];

  // Filter events locally based on search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return allEvents;
    const query = searchQuery.toLowerCase();
    return allEvents.filter(event =>
      event.description.toLowerCase().includes(query) ||
      formatEventDate(event.date).toLowerCase().includes(query)
    );
  }, [allEvents, searchQuery]);

  // Calculate position based on anchor element
  useEffect(() => {
    if (isOpen && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const popoverWidth = 340;
      const popoverHeight = 320;

      // Position below the anchor, but adjust if it would go off-screen
      let top = rect.bottom + 4;
      let left = rect.left;

      // Adjust horizontal position if it would go off-screen
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      // Adjust vertical position if it would go off-screen
      if (top + popoverHeight > window.innerHeight - 16) {
        top = rect.top - popoverHeight - 4;
      }

      setPosition({ top, left });
    }
  }, [isOpen, anchorEl]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset search when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      // Delay to prevent immediate close from the same click that opened it
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectEvent = (event: Event) => {
    onLinkEvent(task.id, event.id);
    onClose();
  };

  const handleUnlink = () => {
    onLinkEvent(task.id, null);
    onClose();
  };

  const portalRoot = document.getElementById('datepicker-portal') || document.body;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-[9999]"
      style={{ top: position.top, left: position.left, width: 340 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search header */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter events..."
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Currently linked event */}
      {task.event_id && (
        <div className="px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <Link2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 truncate">
                {task.event_description}
              </span>
            </div>
            <button
              onClick={handleUnlink}
              className="text-xs text-red-500 hover:text-red-600 hover:underline flex-shrink-0"
            >
              Unlink
            </button>
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="max-h-[260px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">
            {searchQuery ? 'No matching events' : 'No events in this case'}
          </div>
        ) : (
          <div className="py-1">
            {filteredEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => handleSelectEvent(event)}
                className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 ${
                  event.id === task.event_id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <div className="flex-shrink-0 w-16 text-xs text-slate-500 dark:text-slate-400">
                  {formatEventDate(event.date)}
                </div>
                <div className="flex-1 min-w-0 text-sm text-slate-900 dark:text-slate-100 truncate">
                  {event.description}
                </div>
                {event.id === task.event_id && (
                  <Link2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    portalRoot
  );
}
