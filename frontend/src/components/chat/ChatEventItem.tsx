/**
 * ChatEventItem - Interactive event display for chat context
 *
 * Fetches event data from the API by ID, confirming it was saved to the database.
 * Shows event details with interactive star, date, and time controls.
 * Mutations are handled via API calls with React Query invalidation.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse, isValid } from 'date-fns';
import DatePicker from 'react-datepicker';
import {
  Star,
  Calendar,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { TimePicker, CaseChip } from '../common';
import { getEvent, updateEvent } from '../../api/events';
import type { Event } from '../../types';
import 'react-datepicker/dist/react-datepicker.css';

export interface ChatEventItemProps {
  /** Event ID to fetch from the database */
  eventId: number;
  /** Whether this was just created (shows success indicator) */
  isNew?: boolean;
}

/**
 * Format a date relative to today
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;

  if (diffDays === 0) {
    return { text: 'Today', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isOverdue: false };
  } else if (diffDays === -1) {
    return { text: 'Yesterday', isOverdue: true };
  } else {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
    };
  }
}

export function ChatEventItem({ eventId, isNew = true }: ChatEventItemProps) {
  const queryClient = useQueryClient();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Fetch event from database by ID
  const { data: eventData, isLoading, isError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const res = await getEvent(eventId);
      return res.event;
    },
    staleTime: 30_000,
  });

  // Local state for optimistic updates
  const [localEvent, setLocalEvent] = useState<Event | null>(null);
  const event = localEvent ?? eventData;

  // Mutation for updating the event
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Event>) => updateEvent(eventId, data),
    onSuccess: (response) => {
      setLocalEvent(response.event);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['case'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-bg-surface p-3 flex items-center gap-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Loading event...</span>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-xs text-red-600 dark:text-red-400">Failed to load event #{eventId}</span>
      </div>
    );
  }

  const dateInfo = formatRelativeDate(event.date);

  // Parse the date for DatePicker
  const selectedDate = (() => {
    const parsed = parse(event.date, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : null;
  })();

  const handleStarToggle = () => {
    updateMutation.mutate({ starred: !event.starred });
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      const newDateStr = format(date, 'yyyy-MM-dd');
      updateMutation.mutate({ date: newDateStr });
    }
    setIsDatePickerOpen(false);
  };

  const handleTimeChange = (newTime: string | null) => {
    updateMutation.mutate({ time: newTime ?? undefined });
  };

  return (
    <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
      {/* Success header for newly created events */}
      {isNew && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            Event created
          </span>
        </div>
      )}

      {/* Event content */}
      <div className="p-3">
        {/* Row 1: Star + Description */}
        <div className="flex items-start gap-2">
          <button
            onClick={handleStarToggle}
            disabled={updateMutation.isPending}
            className={`
              w-5 h-5 flex-shrink-0 flex items-center justify-center
              transition-all duration-200 rounded-full
              disabled:opacity-50
              ${event.starred
                ? 'text-amber-500'
                : 'text-text-muted hover:text-amber-400'
              }
            `}
            title={event.starred ? 'Remove from Key Dates' : 'Add to Key Dates'}
          >
            <Star className={`w-4 h-4 ${event.starred ? 'fill-amber-500' : ''}`} />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text leading-snug">
              {event.description}
            </p>
          </div>
        </div>

        {/* Row 2: Metadata - case chip, date, time, location */}
        <div className="flex items-center mt-2 gap-3 flex-wrap ml-7">
          {/* Case chip (if we have case info) */}
          {event.case_name && (
            <CaseChip
              caseId={event.case_id}
              caseName={event.case_name}
              shortName={event.short_name}
              color={event.case_color}
            />
          )}

          {/* Date picker */}
          <div onClick={(e) => e.stopPropagation()}>
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              open={isDatePickerOpen}
              onClickOutside={() => setIsDatePickerOpen(false)}
              onInputClick={() => setIsDatePickerOpen(true)}
              dateFormat="yyyy-MM-dd"
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
              portalId="datepicker-portal"
              customInput={
                <button
                  className={`flex items-center gap-1 text-xs hover:underline ${
                    dateInfo.isOverdue
                      ? 'text-red-500'
                      : 'text-text-secondary'
                  }`}
                  disabled={updateMutation.isPending}
                >
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>{dateInfo.text}</span>
                </button>
              }
            />
          </div>

          {/* Time picker */}
          <div onClick={(e) => e.stopPropagation()}>
            <TimePicker
              value={event.time || null}
              onChange={handleTimeChange}
              placeholder="Add time"
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Location (if set) */}
          {event.location && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{event.location}</span>
            </span>
          )}

          {/* Document link (if set) */}
          {event.document_link && (
            <a
              href={event.document_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span>Document</span>
            </a>
          )}
        </div>

        {/* Calculation note (if set) */}
        {event.calculation_note && (
          <p className="mt-2 ml-7 text-xs text-text-secondary italic">
            {event.calculation_note}
          </p>
        )}
      </div>
    </div>
  );
}
