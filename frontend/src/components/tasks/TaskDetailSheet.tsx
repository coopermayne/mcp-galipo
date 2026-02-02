/**
 * TaskDetailSheet - Mobile-first full-screen task editor
 *
 * Slides up from bottom on mobile, shows as a sheet/modal.
 * Matches Todoist mobile task editing UX.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import {
  X,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Calendar,
  Flag,
  Briefcase,
  AlignLeft,
  Paperclip,
  Check,
  Link2,
  Trash2,
} from 'lucide-react';
import type { Task } from '../../types';
import { EventLinkPopover } from './EventLinkPopover';
import 'react-datepicker/dist/react-datepicker.css';

// Priority config matching TaskItem
const PRIORITY_OPTIONS = [
  { value: 4, label: 'Priority 1', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  { value: 3, label: 'Priority 2', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { value: 2, label: 'Priority 3', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { value: 1, label: 'Priority 4', color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
] as const;

const getPriorityConfig = (urgency: number) =>
  PRIORITY_OPTIONS.find(p => p.value === urgency) || PRIORITY_OPTIONS[3];

export type SheetFocusMode = 'title' | 'comment' | 'date' | null;

interface TaskDetailSheetProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkDone?: (taskId: number) => void;
  onUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  onLinkEvent?: (taskId: number, eventId: number | null) => void;
  onDelete?: (taskId: number) => void;
  onPrevTask?: () => void;
  onNextTask?: () => void;
  hasPrevTask?: boolean;
  hasNextTask?: boolean;
  /** What to focus when sheet opens */
  initialFocus?: SheetFocusMode;
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr: string | undefined): { text: string; color: string } {
  if (!dateStr) {
    return { text: 'No due date', color: 'text-slate-400' };
  }

  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: 'text-red-500',
    };
  } else if (diffDays === 0) {
    return { text: 'Today', color: 'text-green-600' };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', color: 'text-orange-500' };
  } else {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: 'text-slate-700 dark:text-slate-300',
    };
  }
}

export function TaskDetailSheet({
  task,
  isOpen,
  onClose,
  onMarkDone,
  onUpdate,
  onLinkEvent,
  onDelete,
  onPrevTask,
  onNextTask,
  hasPrevTask = false,
  hasNextTask = false,
  initialFocus = null,
}: TaskDetailSheetProps) {
  const [editedTitle, setEditedTitle] = useState(task?.description || '');
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [priorityPickerPos, setPriorityPickerPos] = useState({ top: 0, left: 0 });
  const [showEventLinkPopover, setShowEventLinkPopover] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const priorityButtonRef = useRef<HTMLButtonElement>(null);
  const eventLinkButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Sync title when task changes
  useEffect(() => {
    setEditedTitle(task?.description || '');
  }, [task?.description]);

  // Handle initial focus - respond to initialFocus changes even when sheet is already open
  useEffect(() => {
    if (isOpen && task && initialFocus) {
      // Small delay to ensure the sheet is rendered
      const timer = setTimeout(() => {
        switch (initialFocus) {
          case 'title':
            if (titleInputRef.current) {
              titleInputRef.current.focus();
              titleInputRef.current.select();
            }
            break;
          case 'comment':
            if (commentInputRef.current) {
              commentInputRef.current.focus();
            }
            break;
          case 'date':
            // Click the date button to open the picker
            if (dateButtonRef.current) {
              dateButtonRef.current.click();
            }
            break;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, task?.id, initialFocus]);

  // Reset pickers when task changes
  useEffect(() => {
    setShowPriorityPicker(false);
    setShowEventLinkPopover(false);
    setShowMoreMenu(false);
  }, [task?.id]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showPriorityPicker) {
          setShowPriorityPicker(false);
        } else if (showEventLinkPopover) {
          setShowEventLinkPopover(false);
        } else if (showMoreMenu) {
          setShowMoreMenu(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showPriorityPicker, showEventLinkPopover, showMoreMenu]);

  if (!isOpen || !task) return null;

  const priorityConfig = getPriorityConfig(task.urgency);
  const dateDisplay = formatDateDisplay(task.due_date);
  const isDone = task.status === 'Done';

  // Parse date for DatePicker
  const selectedDate = task.due_date
    ? (() => {
        const parsed = parse(task.due_date, 'yyyy-MM-dd', new Date());
        return isValid(parsed) ? parsed : null;
      })()
    : null;

  const handleCheckboxClick = () => {
    if (onMarkDone) {
      onMarkDone(task.id);
    }
  };

  const handleTitleBlur = async () => {
    if (editedTitle !== task.description && onUpdate) {
      await onUpdate(task.id, { description: editedTitle });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleInputRef.current?.blur();
    }
  };

  const handleDateChange = async (date: Date | null) => {
    if (onUpdate) {
      const newDateStr = date ? format(date, 'yyyy-MM-dd') : null;
      await onUpdate(task.id, { due_date: newDateStr ?? undefined });
    }
  };

  const handlePriorityClick = () => {
    if (priorityButtonRef.current) {
      const rect = priorityButtonRef.current.getBoundingClientRect();
      setPriorityPickerPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setShowPriorityPicker(!showPriorityPicker);
  };

  const handlePriorityChange = async (urgency: number) => {
    if (onUpdate) {
      await onUpdate(task.id, { urgency });
    }
    setShowPriorityPicker(false);
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet - slides up from bottom on mobile, centered on desktop */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   bg-white dark:bg-slate-900
                   rounded-t-2xl sm:rounded-2xl
                   shadow-xl
                   max-h-[90vh] sm:max-h-[80vh] sm:w-full sm:max-w-lg
                   flex flex-col
                   animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          {/* Project/Case link */}
          <Link
            to={`/cases/${task.case_id}`}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            <Briefcase className="w-4 h-4" />
            <span>{task.case_name || task.short_name || `Case #${task.case_id}`}</span>
          </Link>

          {/* Nav + actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevTask}
              disabled={!hasPrevTask}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={onNextTask}
              disabled={!hasNextTask}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                ref={moreButtonRef}
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {/* More menu dropdown with backdrop */}
              {showMoreMenu && (
                <>
                  {/* Invisible backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[140px] z-50"
                  >
                    <button
                      onClick={() => {
                        if (onDelete && task) {
                          onDelete(task.id);
                          onClose();
                        }
                        setShowMoreMenu(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete task</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Task title section */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={handleCheckboxClick}
                className={`
                  w-6 h-6 mt-0.5 flex-shrink-0 rounded-full border-2
                  transition-all duration-150
                  ${isDone
                    ? 'bg-slate-400 border-slate-400'
                    : `border-${priorityConfig.color.replace('text-', '')} hover:bg-slate-50 dark:hover:bg-slate-800`
                  }
                `}
                style={{
                  borderColor: isDone ? undefined : priorityConfig.color.includes('red') ? '#ef4444' :
                    priorityConfig.color.includes('orange') ? '#f97316' :
                    priorityConfig.color.includes('blue') ? '#3b82f6' : '#94a3b8'
                }}
              >
                {isDone && (
                  <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Title input */}
              <div className="flex-1">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  className={`
                    w-full text-lg font-medium bg-transparent border-none outline-none
                    ${isDone ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}
                  `}
                  placeholder="Task name"
                />

                {/* Description placeholder */}
                <div className="flex items-center gap-2 mt-2 text-slate-400">
                  <AlignLeft className="w-4 h-4" />
                  <span className="text-sm">Description</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action rows */}
          <div className="border-t border-slate-100 dark:border-slate-800">
            {/* Case/Project */}
            <Link
              to={`/cases/${task.case_id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800"
            >
              <Briefcase className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {task.case_name || task.short_name || `Case #${task.case_id}`}
              </span>
            </Link>

            {/* Due date + Event Link */}
            <div className="relative border-b border-slate-100 dark:border-slate-800 flex items-center">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="yyyy-MM-dd"
                showYearDropdown
                showMonthDropdown
                scrollableYearDropdown
                yearDropdownItemNumber={15}
                dropdownMode="select"
                portalId="datepicker-portal"
                renderCustomHeader={({
                  date,
                  changeYear,
                  changeMonth,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
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
                }}
                customInput={
                  <button
                    ref={dateButtonRef}
                    className="flex items-center gap-4 px-4 py-3 flex-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Calendar className={`w-5 h-5 ${dateDisplay.color}`} />
                    <span className={`text-sm ${dateDisplay.color}`}>
                      {dateDisplay.text}
                    </span>
                  </button>
                }
              >
                {/* Clear date button - only shown when a date is set */}
                {selectedDate && (
                  <div className="px-2 pb-2 pt-1 border-t border-slate-200 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() => handleDateChange(null)}
                      className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      Clear date
                    </button>
                  </div>
                )}
              </DatePicker>
              {/* Event Link button - only show if case has events or already linked */}
              {(task.has_events || task.event_id) && (
                <button
                  ref={eventLinkButtonRef}
                  onClick={() => setShowEventLinkPopover(true)}
                  className="flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-l border-slate-100 dark:border-slate-800 min-w-0"
                >
                  <Link2 className={`w-5 h-5 flex-shrink-0 ${task.event_id ? 'text-primary-500' : 'text-slate-400'}`} />
                  {task.event_id && task.event_date ? (
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm ${formatDateDisplay(task.event_date).color}`}>
                        {formatDateDisplay(task.event_date).text}
                      </span>
                      {task.event_description && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {task.event_description}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Add event</span>
                  )}
                </button>
              )}
            </div>

            {/* Priority */}
            <div className="relative border-b border-slate-100 dark:border-slate-800">
              <button
                ref={priorityButtonRef}
                onClick={handlePriorityClick}
                className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Flag className={`w-5 h-5 ${priorityConfig.color}`} />
                <span className={`text-sm ${priorityConfig.color}`}>
                  {priorityConfig.label}
                </span>
              </button>
            </div>

            {/* Priority Picker Dropdown - rendered in portal */}
            {showPriorityPicker && createPortal(
              <div className="fixed inset-0 z-[9999]" onClick={() => setShowPriorityPicker(false)}>
                <div
                  className="absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]"
                  style={{ top: priorityPickerPos.top, left: priorityPickerPos.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handlePriorityChange(option.value)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${option.color}`}
                    >
                      <Flag className="w-4 h-4" />
                      <span className="text-sm flex-1">{option.label}</span>
                      {task.urgency === option.value && (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>
              </div>,
              document.getElementById('datepicker-portal') || document.body
            )}

            {/* Event Link Popover */}
            {showEventLinkPopover && (
              <EventLinkPopover
                task={task}
                isOpen={showEventLinkPopover}
                anchorEl={eventLinkButtonRef.current}
                onClose={() => setShowEventLinkPopover(false)}
                onLinkEvent={(taskId, eventId) => {
                  if (onLinkEvent) {
                    onLinkEvent(taskId, eventId);
                  }
                  setShowEventLinkPopover(false);
                }}
              />
            )}
          </div>
        </div>

        {/* Comment input at bottom */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-full">
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Comment"
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400"
              />
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <Paperclip className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
