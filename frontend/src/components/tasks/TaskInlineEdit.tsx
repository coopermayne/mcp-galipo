/**
 * TaskInlineEdit - Inline task editor matching TaskItem layout
 *
 * Replaces the task row with an editable form when user clicks the edit icon.
 * Layout mirrors TaskItem: title input, then case/date/event row below.
 */
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import {
  Calendar,
  Flag,
  Inbox,
  Link2,
} from 'lucide-react';
import type { Task } from '../../types';
import 'react-datepicker/dist/react-datepicker.css';

export interface TaskInlineEditProps {
  task: Task;
  /** Show case in metadata row */
  showCase?: boolean;
  /** Called when user saves changes */
  onSave: (taskId: number, updates: { description?: string; due_date?: string; urgency?: number }) => Promise<void>;
  /** Called when user cancels editing */
  onCancel: () => void;
  /** Called when event link is clicked */
  onEventLinkClick?: (task: Task, event: React.MouseEvent) => void;
}

// Priority colors matching TaskItem
const PRIORITY_OPTIONS = [
  { value: 4, label: 'Urgent', color: 'text-red-500' },
  { value: 3, label: 'High', color: 'text-orange-500' },
  { value: 2, label: 'Medium', color: 'text-blue-500' },
  { value: 1, label: 'Low', color: 'text-text-muted' },
] as const;

/**
 * Format a date relative to today (matching TaskItem)
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const date = new Date(dateStr + 'T00:00:00');
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

export function TaskInlineEdit({
  task,
  showCase = true,
  onSave,
  onCancel,
  onEventLinkClick,
}: TaskInlineEditProps) {
  const [title, setTitle] = useState(task.description || '');
  const [dueDate, setDueDate] = useState<Date | null>(() => {
    if (!task.due_date) return null;
    const parsed = parse(task.due_date, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : null;
  });
  const [urgency, setUrgency] = useState(task.urgency || 1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus title input on mount
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  // Handle click outside to cancel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Check if click is on a date picker portal or priority dropdown
        const datePickerPortal = document.getElementById('datepicker-portal');
        if (datePickerPortal?.contains(event.target as Node)) {
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave(task.id, {
        description: title.trim(),
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        urgency,
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
      <div className="flex items-center justify-between px-2 py-2 bg-bg-surface">
        <button
          type="button"
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          className="p-1 hover:bg-bg-hover rounded disabled:opacity-30 text-text-secondary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          <select
            value={months[date.getMonth()]}
            onChange={(e) => changeMonth(months.indexOf(e.target.value))}
            className="px-2 py-1 text-sm bg-bg-surface border border-border rounded text-text cursor-pointer"
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
            className="px-2 py-1 text-sm bg-bg-surface border border-border rounded text-text cursor-pointer"
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
          className="p-1 hover:bg-bg-hover rounded disabled:opacity-30 text-text-secondary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  };

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === urgency) || PRIORITY_OPTIONS[3];
  const dateInfo = dueDate ? formatRelativeDate(format(dueDate, 'yyyy-MM-dd')) : null;

  return (
    <div
      ref={containerRef}
      className="px-3 py-2.5 md:px-2 md:py-2 border border-border rounded-lg bg-bg-surface shadow-sm"
    >
      {/* Title input - matches TaskItem title styling */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task name"
        className="w-full text-sm leading-snug text-text bg-transparent outline-none placeholder:text-text-muted"
      />

      {/* Metadata row - case, date, event, priority */}
      <div className="flex items-center mt-1 gap-3">
        {/* Case/Project link (read-only display) */}
        {showCase && (
          <Link
            to={`/cases/${task.case_id}`}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text"
            title={task.case_name || `Case #${task.case_id}`}
          >
            <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="max-w-[100px] truncate">{task.short_name || task.case_name || `#${task.case_id}`}</span>
          </Link>
        )}

        {/* Due date picker */}
        <DatePicker
          selected={dueDate}
          onChange={(date: Date | null) => {
            setDueDate(date);
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
                className={`flex items-center gap-1 text-xs hover:underline ${dateInfo.isOverdue ? 'text-red-500' : 'text-text-secondary'}`}
              >
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>{dateInfo.text}</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
              >
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>Add date</span>
              </button>
            )
          }
        />

        {/* Event link */}
        <div className="relative group/event">
          <button
            type="button"
            onClick={(e) => {
              if (onEventLinkClick) onEventLinkClick(task, e);
            }}
            className={`flex items-center gap-1 text-xs hover:underline ${
              task.event_id
                ? 'text-primary-500 hover:text-primary-600'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Link2 className="w-3 h-3 flex-shrink-0" />
            <span>
              {task.event_id && task.event_date
                ? formatRelativeDate(task.event_date).text
                : 'Link event'}
            </span>
          </button>
          {/* Tooltip showing full event title */}
          {task.event_id && task.event_description && (
            <div className="absolute left-0 bottom-full mb-1 px-2 py-1 text-xs bg-bg-surface text-white rounded shadow-lg whitespace-nowrap z-50 opacity-0 group-hover/event:opacity-100 pointer-events-none transition-opacity">
              {task.event_description}
            </div>
          )}
        </div>

        {/* Priority picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPriorityOpen(!isPriorityOpen)}
            className={`flex items-center gap-1 text-xs hover:underline ${currentPriority.color}`}
            title="Set priority"
          >
            <Flag className="w-3 h-3 flex-shrink-0" />
            <span>{currentPriority.label}</span>
          </button>
          {isPriorityOpen && (
            <div className="absolute top-full left-0 mt-1 py-1 bg-bg-surface border border-border rounded-lg shadow-lg z-50 min-w-[100px]">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setUrgency(option.value);
                    setIsPriorityOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-bg-hover ${option.color}`}
                >
                  <Flag className="w-3 h-3" />
                  <span>{option.label}</span>
                  {option.value === urgency && (
                    <span className="ml-auto text-primary-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions row: save/cancel */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-border gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover rounded"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
          className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
