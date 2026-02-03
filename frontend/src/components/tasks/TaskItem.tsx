/**
 * TaskItem - Todoist-style task row component
 *
 * Minimal two-line layout with hover actions.
 * Line 1: checkbox + title
 * Line 2: date (with icon) + case/project on right
 */
import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import {
  Calendar,
  Flag,
  GripVertical,
  Pencil,
  MessageSquare,
  MoreHorizontal,
  Link2,
} from 'lucide-react';
import type { Task, TaskStatus } from '../../types';
import { StatusIndicator } from './StatusIndicator';
import { AssigneeBadge } from './AssigneeBadge';
import { CaseChip } from '../common';
import 'react-datepicker/dist/react-datepicker.css';

// Priority colors for checkbox border (Todoist style)
// 4 = urgent (red), 3 = high (orange), 2 = medium (blue), 1 = low (gray)
const PRIORITY_COLORS = {
  4: 'border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
  3: 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
  2: 'border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  1: 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50',
} as const;

// Priority options for the picker
const PRIORITY_OPTIONS = [
  { value: 4, label: 'Urgent', color: 'text-red-500' },
  { value: 3, label: 'High', color: 'text-orange-500' },
  { value: 2, label: 'Medium', color: 'text-blue-500' },
  { value: 1, label: 'Low', color: 'text-slate-400' },
] as const;

export interface TaskItemProps {
  task: Task;
  /** Show the case/project on the right */
  showCase?: boolean;
  /** Show drag handle on hover */
  showDragHandle?: boolean;
  /** Disable drag even if showDragHandle is true */
  disableDrag?: boolean;
  /** Highlight this row (e.g., after drop) */
  isHighlighted?: boolean;
  /** Whether this task is animating out (being marked done) */
  isCompleting?: boolean;
  /** Align to left edge (no left padding) - for flat lists without headers */
  flush?: boolean;
  /** Callback when status is changed */
  onStatusChange?: (taskId: number, status: TaskStatus) => void;
  /** Callback when task row is clicked (for inline edit) */
  onClick?: (task: Task) => void;
  /** Callback when edit action is clicked */
  onEdit?: (task: Task) => void;
  /** Callback when date changes (inline date picker) */
  onDateChange?: (taskId: number, date: string | null) => void;
  /** Callback when comment button is clicked */
  onCommentClick?: (task: Task) => void;
  /** Callback when event link button is clicked */
  onEventLinkClick?: (task: Task, event: React.MouseEvent) => void;
  /** Callback when priority changes */
  onPriorityChange?: (taskId: number, priority: number) => void;
  /** Callback when delete is clicked */
  onDelete?: (taskId: number) => void;
}

/**
 * Format a date relative to today (Todoist style) - for due dates
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;

  if (diffDays === 0) {
    return { text: 'Today', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isOverdue: false };
  } else if (diffDays === -1) {
    return { text: 'Yesterday', isOverdue: true };
  } else if (isOverdue) {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: true
    };
  } else {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: false
    };
  }
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "yesterday")
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function TaskItem({
  task,
  showCase = true,
  showDragHandle = false,
  disableDrag = false,
  isHighlighted = false,
  isCompleting = false,
  flush = false,
  onStatusChange,
  onClick,
  onEdit,
  onDateChange,
  onCommentClick,
  onEventLinkClick,
  onPriorityChange,
  onDelete,
}: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);

  // Parse the date for DatePicker
  const selectedDate = task.due_date
    ? (() => {
        const parsed = parse(task.due_date, 'yyyy-MM-dd', new Date());
        return isValid(parsed) ? parsed : null;
      })()
    : null;

  const handleDateChange = (date: Date | null) => {
    if (onDateChange) {
      const newDateStr = date ? format(date, 'yyyy-MM-dd') : null;
      onDateChange(task.id, newDateStr);
    }
    setIsDatePickerOpen(false);
  };

  // Custom header for the date picker (same as EditableDate)
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

  // dnd-kit sortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !showDragHandle || disableDrag,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const isDone = task.status === 'Done';
  // For active tasks, show due date info
  const dateInfo = task.due_date ? formatRelativeDate(task.due_date) : null;
  // For done tasks, show relative completion time
  const completionTimeText = isDone && task.completion_date ? formatRelativeTime(task.completion_date) : null;
  const showCompleted = isDone || isCompleting;

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(task.id, newStatus);
    }
  };

  const handleRowClick = () => {
    if (onClick) {
      onClick(task);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(task);
    }
  };

  // On mobile, attach drag listeners to the row; on desktop, use the handle
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(showDragHandle && isTouchDevice ? { ...attributes, ...listeners } : {})}
      className={`
        group relative flex items-start gap-2 py-2.5 md:py-2
        ${flush ? 'px-0' : 'px-3 md:px-2'}
        border-b border-slate-100 dark:border-slate-800
        transition-opacity duration-300 ease-out
        ${isDragging ? 'shadow-lg rounded-lg bg-white dark:bg-slate-800 border border-primary-500' : ''}
        ${isHighlighted ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
        ${showDragHandle && isTouchDevice ? 'touch-none active:bg-slate-100 dark:active:bg-slate-700 active:scale-[0.98]' : ''}
        ${isCompleting ? 'opacity-0' : 'opacity-100'}
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleRowClick}
    >
      {/* Drag handle - appears on hover, desktop only (hidden in flush mode) */}
      {!flush && (
        <div className={`hidden md:flex w-6 flex-shrink-0 items-center justify-center pt-0.5 transition-opacity ${isHovered && showDragHandle ? 'opacity-100' : 'opacity-0'}`}>
          {showDragHandle && (
            <button
              {...attributes}
              {...listeners}
              className={`p-0.5 text-slate-400 ${disableDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:text-slate-600 dark:hover:text-slate-300'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Status Indicator - stopPropagation so tapping circle opens status selector, not task detail */}
      <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
        <StatusIndicator
          status={showCompleted ? 'Done' : task.status}
          priority={task.urgency}
          onStatusChange={onStatusChange ? handleStatusChange : undefined}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Title - single line, truncate */}
        <div className={`text-sm leading-snug truncate transition-all duration-200 ${showCompleted ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
          {task.description}
        </div>

        {/* Metadata row: case, date, event link - all inline */}
        <div className="flex items-center mt-0.5 gap-3">
          {/* Case/Project chip */}
          {showCase && (
            <CaseChip
              caseId={task.case_id}
              caseName={task.case_name}
              shortName={task.short_name}
              color={task.case_color}
            />
          )}

          {/* Assignee badge */}
          {task.assignee && (
            <AssigneeBadge assignee={task.assignee} />
          )}

            {/* Date display - completion date for done tasks, due date picker for active */}
            {isDone ? (
              // Static completion time display for done tasks
              completionTimeText && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>Completed {completionTimeText}</span>
                </span>
              )
            ) : (
              // Due date - inline picker on desktop only, static display on mobile
              isTouchDevice ? (
                // Mobile: static display, tap opens task detail
                dateInfo ? (
                  <span className={`flex items-center gap-1 text-xs ${dateInfo.isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>{dateInfo.text}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>No date</span>
                  </span>
                )
              ) : (
                // Desktop: inline picker
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
                      dateInfo ? (
                        <button
                          ref={dateButtonRef}
                          className={`flex items-center gap-1 text-xs hover:underline ${dateInfo.isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>{dateInfo.text}</span>
                        </button>
                      ) : (
                        <button
                          ref={dateButtonRef}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>Add date</span>
                        </button>
                      )
                    }
                  >
                    {/* Clear date button - only shown when a date is set */}
                    {selectedDate && (
                      <div className="px-2 pb-2 pt-1 border-t border-slate-200 dark:border-slate-600">
                        <button
                          type="button"
                          onClick={() => handleDateChange(null)}
                          className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          Clear date
                        </button>
                      </div>
                    )}
                  </DatePicker>
                </div>
              )
            )}

            {/* Event link - visible when task has events or already linked (hidden for done tasks) */}
            {!isDone && (task.has_events || task.event_id) && (
              isTouchDevice ? (
                // Mobile: static display
                <span className={`flex items-center gap-1 text-xs ${
                  task.event_id ? 'text-primary-500' : 'text-slate-400'
                }`}>
                  <Link2 className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {task.event_id && task.event_date
                      ? formatRelativeDate(task.event_date).text
                      : 'Event'}
                  </span>
                </span>
              ) : (
                // Desktop: clickable with popover
                <div className="relative group/event">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEventLinkClick) onEventLinkClick(task, e);
                    }}
                    className={`flex items-center gap-1 text-xs hover:underline ${
                      task.event_id
                        ? 'text-primary-500 hover:text-primary-600'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <Link2 className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {task.event_id && task.event_date
                        ? formatRelativeDate(task.event_date).text
                        : 'Add event'}
                    </span>
                  </button>
                  {/* Tooltip showing full event title */}
                  {task.event_id && task.event_description && (
                    <div className="absolute left-0 bottom-full mb-1 px-2 py-1 text-xs bg-slate-800 dark:bg-slate-600 text-white rounded shadow-lg whitespace-nowrap z-50 opacity-0 group-hover/event:opacity-100 pointer-events-none transition-opacity">
                      {task.event_description}
                    </div>
                  )}
                </div>
              )
            )}

            {/* Priority - static on mobile, picker on desktop (hidden for done tasks) */}
            {!isDone && (
              isTouchDevice ? (
                // Mobile: static display
                <span className={`flex items-center gap-1 text-xs ${
                  PRIORITY_OPTIONS.find(p => p.value === task.urgency)?.color || 'text-slate-400'
                }`}>
                  <Flag className="w-3 h-3 flex-shrink-0" />
                  <span>{PRIORITY_OPTIONS.find(p => p.value === task.urgency)?.label || 'Low'}</span>
                </span>
              ) : (
                // Desktop: clickable picker
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setIsPriorityOpen(!isPriorityOpen)}
                    className={`flex items-center gap-1 text-xs hover:underline ${
                      PRIORITY_OPTIONS.find(p => p.value === task.urgency)?.color || 'text-slate-400'
                    }`}
                    title="Set priority"
                  >
                    <Flag className="w-3 h-3 flex-shrink-0" />
                    <span>{PRIORITY_OPTIONS.find(p => p.value === task.urgency)?.label || 'Low'}</span>
                  </button>
                  {isPriorityOpen && (
                    <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 min-w-[100px]">
                      {PRIORITY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (onPriorityChange) onPriorityChange(task.id, option.value);
                            setIsPriorityOpen(false);
                          }}
                          className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-600 ${option.color}`}
                        >
                          <Flag className="w-3 h-3" />
                          <span>{option.label}</span>
                          {option.value === task.urgency && (
                            <span className="ml-auto text-primary-500">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
        </div>
      </div>

      {/* Hover actions - hidden on mobile */}
      <div className={`hidden md:flex items-start gap-0.5 pt-0.5 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={handleEditClick}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onCommentClick) onCommentClick(task);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="Comments"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onDelete) onDelete(task.id);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * TaskItemOverlay - Used inside DragOverlay for the dragged preview
 */
export function TaskItemOverlay({ task }: { task: Task }) {
  const priorityColor = PRIORITY_COLORS[task.urgency as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[1];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-primary-500">
      <GripVertical className="w-4 h-4 text-slate-400" />
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${priorityColor.split(' ')[0]}`} />
      <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
        {task.description}
      </span>
      <span className="ml-auto">
        <CaseChip
          caseId={task.case_id}
          caseName={task.case_name}
          shortName={task.short_name}
          color={task.case_color}
          asSpan
        />
      </span>
    </div>
  );
}
