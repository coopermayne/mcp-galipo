/**
 * EventInlineEdit - Inline event editor matching EventItem layout
 *
 * Replaces the event row with an editable form when user clicks the edit icon.
 * Layout mirrors EventItem: description input, then case/date/time row below.
 */
import { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import { Calendar, Inbox } from 'lucide-react';
import { TimePicker } from '../common';
import type { Event } from '../../types';
import 'react-datepicker/dist/react-datepicker.css';

export interface EventInlineEditProps {
  event: Event;
  /** Show case in metadata row */
  showCase?: boolean;
  /** Called when user saves changes */
  onSave: (eventId: number, updates: { description?: string; date?: string; time?: string | null }) => Promise<void>;
  /** Called when user cancels editing */
  onCancel: () => void;
}

/**
 * Format a date relative to today (matching EventItem)
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;

  if (diffDays === 0) return { text: 'Today', isOverdue: false };
  if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false };
  if (diffDays === -1) return { text: 'Yesterday', isOverdue: true };

  return {
    text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isOverdue
  };
}

export function EventInlineEdit({
  event,
  showCase = true,
  onSave,
  onCancel,
}: EventInlineEditProps) {
  const [description, setDescription] = useState(event.description || '');
  const [eventDate, setEventDate] = useState<Date | null>(() => {
    const parsed = parse(event.date, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : null;
  });
  const [eventTime, setEventTime] = useState<string | null>(event.time || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const descriptionRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus description input on mount
  useEffect(() => {
    descriptionRef.current?.focus();
    descriptionRef.current?.select();
  }, []);

  // Handle click outside to cancel
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Check if click is on a date picker portal
        const datePickerPortal = document.getElementById('datepicker-portal');
        if (datePickerPortal?.contains(e.target as Node)) {
          return;
        }
        onCancel();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSave = async () => {
    if (!description.trim() || !eventDate) return;

    setIsSaving(true);
    try {
      await onSave(event.id, {
        description: description.trim(),
        date: format(eventDate, 'yyyy-MM-dd'),
        time: eventTime,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Custom header for the date picker
  const renderDatePickerHeader = ({
    date,
    changeYear,
    changeMonth,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
  }: {
    date: Date;
    changeYear: (year: number) => void;
    changeMonth: (month: number) => void;
    decreaseMonth: () => void;
    increaseMonth: () => void;
    prevMonthButtonDisabled: boolean;
    nextMonthButtonDisabled: boolean;
  }) => {
    const currentYear = getYear(new Date());
    const years = Array.from({ length: 26 }, (_, i) => currentYear - 10 + i);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return (
      <div className="flex items-center justify-between px-2 py-2 bg-white dark:bg-slate-700">
        <button
          type="button"
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-30 text-slate-700 dark:text-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          <select
            value={months[date.getMonth()]}
            onChange={(e) => changeMonth(months.indexOf(e.target.value))}
            className="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={date.getFullYear()}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={increaseMonth}
          disabled={nextMonthButtonDisabled}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-30 text-slate-700 dark:text-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  };

  const dateInfo = eventDate ? formatRelativeDate(format(eventDate, 'yyyy-MM-dd')) : null;

  return (
    <div
      ref={containerRef}
      className="px-3 py-2.5 md:px-2 md:py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm"
    >
      {/* Description input - matches EventItem title styling */}
      <input
        ref={descriptionRef}
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Event description"
        className="w-full text-sm leading-snug text-slate-900 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400"
      />

      {/* Metadata row - case, date, time */}
      <div className="flex items-center mt-1 gap-3">
        {/* Case/Project (read-only, non-clickable during edit) */}
        {showCase && (
          <span
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"
            title={event.case_name || `Case #${event.case_id}`}
          >
            <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="max-w-[100px] truncate">{event.short_name || event.case_name || `#${event.case_id}`}</span>
          </span>
        )}

        {/* Date picker */}
        <DatePicker
          selected={eventDate}
          onChange={(date: Date | null) => {
            setEventDate(date);
            setIsDatePickerOpen(false);
          }}
          open={isDatePickerOpen}
          onClickOutside={() => setIsDatePickerOpen(false)}
          onInputClick={() => setIsDatePickerOpen(true)}
          dateFormat="yyyy-MM-dd"
          showYearDropdown
          showMonthDropdown
          scrollableYearDropdown
          yearDropdownItemNumber={15}
          dropdownMode="select"
          portalId="datepicker-portal"
          renderCustomHeader={renderDatePickerHeader}
          customInput={
            dateInfo ? (
              <button
                type="button"
                className={`flex items-center gap-1 text-xs hover:underline ${dateInfo.isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>{dateInfo.text}</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>Add date</span>
              </button>
            )
          }
        />

        {/* Time picker */}
        <TimePicker
          value={eventTime}
          onChange={(time) => setEventTime(time)}
          placeholder="Add time"
        />
      </div>

      {/* Actions row: save/cancel */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!description.trim() || !eventDate || isSaving}
          className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
