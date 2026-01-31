/**
 * EventItem - Todoist-style event row component
 *
 * Minimal two-line layout with hover actions (matching TaskItem pattern).
 * Line 1: star toggle + description
 * Line 2: case link + date/time (clickable date picker)
 */
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import {
  Star,
  Calendar,
  Inbox,
  Pencil,
  ListTodo,
} from 'lucide-react';
import { TimePicker } from '../common';
import type { Event } from '../../types';
import 'react-datepicker/dist/react-datepicker.css';

export interface EventItemProps {
  event: Event;
  /** Show the case/project link */
  showCase?: boolean;
  /** Callback when star is toggled */
  onToggleStar?: (event: Event) => void;
  /** Callback when date changes */
  onDateChange?: (event: Event, newDate: string) => void;
  /** Callback when time changes (null to clear) */
  onTimeChange?: (event: Event, newTime: string | null) => void;
  /** Callback when event row is clicked */
  onClick?: (event: Event) => void;
  /** Callback when edit action is clicked */
  onEdit?: (event: Event) => void;
  /** Callback when create task action is clicked */
  onCreateTask?: (event: Event) => void;
  /** Callback when delete action is clicked */
  onDelete?: (event: Event) => void;
  /** Highlight this row (e.g., for overdue) */
  isHighlighted?: boolean;
  /** Align to left edge (no left padding) - for flat lists */
  flush?: boolean;
}

/**
 * Format a date relative to today (Todoist style)
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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

export function EventItem({
  event,
  showCase = true,
  onToggleStar,
  onDateChange,
  onTimeChange,
  onClick,
  onEdit,
  onCreateTask,
  isHighlighted = false,
  flush = false,
}: EventItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  const dateInfo = formatRelativeDate(event.date);

  // Parse the date for DatePicker
  const selectedDate = (() => {
    const parsed = parse(event.date, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : null;
  })();

  const handleDateChange = (date: Date | null) => {
    if (date && onDateChange) {
      const newDateStr = format(date, 'yyyy-MM-dd');
      onDateChange(event, newDateStr);
    }
    setIsDatePickerOpen(false);
  };

  const handleTimeChange = (newTime: string | null) => {
    if (onTimeChange) {
      onTimeChange(event, newTime);
    }
  };

  // Custom header for the date picker (matching TaskItem)
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

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStar) {
      onToggleStar(event);
    }
  };

  const handleRowClick = () => {
    if (onClick) {
      onClick(event);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(event);
    }
  };

  const handleCreateTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateTask) {
      onCreateTask(event);
    }
  };

  return (
    <div
      className={`
        group relative flex items-start gap-2 py-2.5 md:py-2
        ${flush ? 'px-0' : 'px-3 md:px-2'}
        border-b border-slate-100 dark:border-slate-800
        transition-colors duration-150
        ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
        ${isHighlighted ? 'bg-red-50 dark:bg-red-900/20' : ''}
      `}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Spacer for indentation when grouped (matches TaskItem drag handle area) */}
      {!flush && (
        <div className="hidden md:flex w-6 flex-shrink-0" />
      )}

      {/* Star toggle (like checkbox for tasks) */}
      <button
        onClick={handleStarClick}
        className={`
          w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center
          transition-all duration-200 rounded-full
          ${event.starred
            ? 'text-amber-500'
            : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
          }
        `}
        title={event.starred ? 'Remove from Key Dates' : 'Add to Key Dates'}
      >
        <Star className={`w-4 h-4 ${event.starred ? 'fill-amber-500' : ''}`} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Title - single line, truncate */}
        <div className="text-sm leading-snug truncate text-slate-900 dark:text-slate-100">
          {event.description}
        </div>

        {/* Metadata row: case, date, time - all inline */}
        <div className="flex items-center mt-0.5 gap-3 flex-wrap">
          {/* Case/Project link */}
          {showCase && (
            <Link
              to={`/cases/${event.case_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              title={event.case_name || `Case #${event.case_id}`}
            >
              <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="max-w-[100px] truncate">
                {event.short_name || event.case_name || `#${event.case_id}`}
              </span>
            </Link>
          )}

          {/* Date with inline picker */}
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
              scrollableYearDropdown
              yearDropdownItemNumber={15}
              dropdownMode="select"
              portalId="datepicker-portal"
              renderCustomHeader={renderDatePickerHeader}
              customInput={
                <button
                  ref={dateButtonRef}
                  className={`flex items-center gap-1 text-xs hover:underline ${
                    dateInfo.isOverdue
                      ? 'text-red-500'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>{dateInfo.text}</span>
                </button>
              }
            />
          </div>

          {/* Time (editable with type-to-filter picker) */}
          {onTimeChange && (
            <div onClick={(e) => e.stopPropagation()}>
              <TimePicker
                value={event.time || null}
                onChange={handleTimeChange}
                placeholder="Add time"
              />
            </div>
          )}

          {/* Task count (if any) */}
          {event.task_count != null && event.task_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <ListTodo className="w-3 h-3 flex-shrink-0" />
              <span>{event.task_count} task{event.task_count > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>

      {/* Hover actions - hidden on mobile */}
      <div
        className={`hidden md:flex items-start gap-0.5 pt-0.5 transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {onEdit && (
          <button
            onClick={handleEditClick}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {onCreateTask && (
          <button
            onClick={handleCreateTaskClick}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Create task from event"
          >
            <ListTodo className="w-4 h-4" />
          </button>
        )}
      </div>

    </div>
  );
}
