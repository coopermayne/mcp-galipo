/**
 * TaskDetailSheet - Mobile-first full-screen task editor
 *
 * Slides up from bottom on mobile, shows as a sheet/modal.
 * Matches Todoist mobile task editing UX.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  User,
} from 'lucide-react';
import type { Task, TaskStatus, CaseStaffUser } from '../../types';
import { EventLinkPopover } from './EventLinkPopover';
import { STATUS_CONFIG, getStatusConfig } from './statusConfig';
import { ActiveStatusIcon } from './ActiveStatusIcon';
import { AssigneePicker } from './AssigneePicker';
import { CaseChip } from '../common';
import { useAuth } from '../../context/AuthContext';
import { PRIORITY_COLORS, getPriorityColor } from '../../config/colors';
import 'react-datepicker/dist/react-datepicker.css';

// Ordering for sorting urgency descending
const URGENCY_SORT_ORDER: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

// Priority options for picker UI
const PRIORITY_OPTIONS = Object.entries(PRIORITY_COLORS)
  .sort(([a], [b]) => (URGENCY_SORT_ORDER[b] || 0) - (URGENCY_SORT_ORDER[a] || 0))
  .map(([value, config]) => ({
    value,
    label: config.label,
    color: config.textClass,
    bg: config.bgClass,
  }));

// Priority-based colors for status icons
const URGENCY_TEXT_COLORS: Record<string, string> = {
  Urgent: PRIORITY_COLORS.Urgent.textClass,
  High: PRIORITY_COLORS.High.textClass,
  Medium: PRIORITY_COLORS.Medium.textClass,
  Low: PRIORITY_COLORS.Low.textClass,
};

export type SheetFocusMode = 'title' | 'comment' | 'date' | null;

interface TaskDetailSheetProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: number, status: TaskStatus) => void;
  onUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  onLinkEvent?: (taskId: number, eventId: number | null) => void;
  onDelete?: (taskId: number) => void;
  onPrevTask?: () => void;
  onNextTask?: () => void;
  hasPrevTask?: boolean;
  hasNextTask?: boolean;
  /** What to focus when sheet opens */
  initialFocus?: SheetFocusMode;
  /** List of users who can be assigned to this task */
  eligibleAssignees?: CaseStaffUser[];
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr: string | undefined): { text: string; color: string } {
  if (!dateStr) {
    return { text: 'No due date', color: 'text-text-muted' };
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
      color: 'text-text-secondary',
    };
  }
}

export function TaskDetailSheet({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onUpdate,
  onLinkEvent,
  onDelete,
  onPrevTask,
  onNextTask,
  hasPrevTask = false,
  hasNextTask = false,
  initialFocus = null,
  eligibleAssignees = [],
}: TaskDetailSheetProps) {
  const { user: currentUser } = useAuth();
  const [editedTitle, setEditedTitle] = useState(task?.description || '');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusPickerPos, setStatusPickerPos] = useState({ top: 0, left: 0 });
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [priorityPickerPos, setPriorityPickerPos] = useState({ top: 0, left: 0 });
  const [showEventLinkPopover, setShowEventLinkPopover] = useState(false);
  const [eventLinkAnchor, setEventLinkAnchor] = useState<HTMLElement | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigneePickerAnchor, setAssigneePickerAnchor] = useState<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const priorityButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const assigneeButtonRef = useRef<HTMLButtonElement>(null);

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
    setShowStatusPicker(false);
    setShowPriorityPicker(false);
    setShowEventLinkPopover(false);
    setShowMoreMenu(false);
    setShowAssigneePicker(false);
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
        if (showStatusPicker) {
          setShowStatusPicker(false);
        } else if (showPriorityPicker) {
          setShowPriorityPicker(false);
        } else if (showEventLinkPopover) {
          setShowEventLinkPopover(false);
        } else if (showMoreMenu) {
          setShowMoreMenu(false);
        } else if (showAssigneePicker) {
          setShowAssigneePicker(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showStatusPicker, showPriorityPicker, showEventLinkPopover, showMoreMenu, showAssigneePicker]);

  if (!isOpen || !task) return null;

  const priorityConfig = getPriorityColor(task.urgency);
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
    // Toggle between Done and Pending on checkbox click
    if (onStatusChange) {
      const newStatus = task.status === 'Done' ? 'Pending' : 'Done';
      onStatusChange(task.id, newStatus);
    }
  };

  const handleStatusClick = () => {
    if (statusButtonRef.current) {
      const rect = statusButtonRef.current.getBoundingClientRect();
      setStatusPickerPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setShowStatusPicker(!showStatusPicker);
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(task.id, newStatus);
    }
    setShowStatusPicker(false);
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

  const handlePriorityChange = async (urgency: string) => {
    if (onUpdate) {
      await onUpdate(task.id, { urgency });
    }
    setShowPriorityPicker(false);
  };

  const handleAssigneeChange = async (assigneeId: number | null) => {
    if (onUpdate) {
      await onUpdate(task.id, { assignee_id: assigneeId });
    }
  };

  // Check if current user is a paralegal (they can't change assignee)
  const isParalegal = currentUser?.position === 'paralegal';

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
                   bg-bg-surface
                   rounded-t-2xl sm:rounded-2xl
                   shadow-xl
                   max-h-[90vh] sm:max-h-[80vh] sm:w-full sm:max-w-lg
                   flex flex-col
                   animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          {/* Project/Case chip */}
          <CaseChip
            caseId={task.case_id}
            caseName={task.case_name}
            shortName={task.short_name}
            color={task.case_color}
          />

          {/* Nav + actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevTask}
              disabled={!hasPrevTask}
              className="p-2 text-text-muted hover:text-text-secondary disabled:opacity-30"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={onNextTask}
              disabled={!hasNextTask}
              className="p-2 text-text-muted hover:text-text-secondary disabled:opacity-30"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                ref={moreButtonRef}
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 text-text-muted hover:text-text-secondary"
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
                    className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[140px] z-50"
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
              className="p-2 text-text-muted hover:text-text-secondary"
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
                    ? 'bg-text-muted border-text-muted'
                    : 'hover:bg-bg-hover'
                  }
                `}
                style={{
                  borderColor: isDone ? undefined : priorityConfig.hex
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
                    ${isDone ? 'text-text-muted line-through' : 'text-text'}
                  `}
                  placeholder="Task name"
                />

                {/* Description placeholder */}
                <div className="flex items-center gap-2 mt-2 text-text-muted">
                  <AlignLeft className="w-4 h-4" />
                  <span className="text-sm">Description</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action rows */}
          <div className="border-t border-border">
            {/* Case/Project */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
              <Briefcase className="w-5 h-5 text-text-muted" />
              <CaseChip
                caseId={task.case_id}
                caseName={task.case_name}
                shortName={task.short_name}
                color={task.case_color}
              />
            </div>

            {/* Due date + Event Link */}
            <div className="relative border-b border-border flex items-center">
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
                }}
                customInput={
                  <button
                    ref={dateButtonRef}
                    className="flex items-center gap-4 px-4 py-3 flex-1 text-left hover:bg-bg-hover"
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
                  <div className="px-2 pb-2 pt-1 border-t border-border">
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
                  onClick={(e) => {
                    setEventLinkAnchor(e.currentTarget);
                    setShowEventLinkPopover(true);
                  }}
                  className="flex items-center gap-2 px-4 py-3 text-left hover:bg-bg-hover border-l border-border min-w-0"
                >
                  <Link2 className={`w-5 h-5 flex-shrink-0 ${task.event_id ? 'text-primary-500' : 'text-text-muted'}`} />
                  {task.event_id && task.event_date ? (
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm ${formatDateDisplay(task.event_date).color}`}>
                        {formatDateDisplay(task.event_date).text}
                      </span>
                      {task.event_description && (
                        <span className="text-xs text-text-muted truncate">
                          {task.event_description}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-text-muted">Add event</span>
                  )}
                </button>
              )}
            </div>

            {/* Status */}
            <div className="relative border-b border-border">
              <button
                ref={statusButtonRef}
                onClick={handleStatusClick}
                className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-bg-hover"
              >
                {(() => {
                  const statusConfig = getStatusConfig(task.status);
                  const StatusIcon = statusConfig.icon;
                  const urgencyColor = URGENCY_TEXT_COLORS[task.urgency] || URGENCY_TEXT_COLORS.Low;
                  return (
                    <>
                      {task.status === 'Active' ? (
                        <span className={urgencyColor}>
                          <ActiveStatusIcon className="w-5 h-5" />
                        </span>
                      ) : (
                        <StatusIcon className={`w-5 h-5 ${urgencyColor}`} />
                      )}
                      <span className="text-sm text-text-secondary">
                        {statusConfig.label}
                      </span>
                    </>
                  );
                })()}
              </button>
            </div>

            {/* Status Picker Dropdown - rendered in portal */}
            {showStatusPicker && createPortal(
              <div className="fixed inset-0 z-[9999]" onClick={() => setShowStatusPicker(false)}>
                <div
                  className="absolute bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[200px]"
                  style={{ top: statusPickerPos.top, left: statusPickerPos.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const urgencyColor = URGENCY_TEXT_COLORS[task.urgency] || URGENCY_TEXT_COLORS.Low;
                    return STATUS_CONFIG.map((config) => {
                      const StatusIcon = config.icon;
                      const isSelected = task.status === config.value;
                      return (
                        <button
                          key={config.value}
                          onClick={() => handleStatusChange(config.value)}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-bg-hover ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                        >
                          {config.value === 'Active' ? (
                            <span className={urgencyColor}>
                              <ActiveStatusIcon className="w-4 h-4" />
                            </span>
                          ) : (
                            <StatusIcon className={`w-4 h-4 ${urgencyColor}`} />
                          )}
                          <span className="text-sm flex-1 text-text-secondary">{config.label}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-500" />
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>,
              document.getElementById('datepicker-portal') || document.body
            )}

            {/* Assignee */}
            <div className="relative border-b border-border">
              <button
                ref={assigneeButtonRef}
                onClick={(e) => {
                  if (!isParalegal) {
                    setAssigneePickerAnchor(e.currentTarget);
                    setShowAssigneePicker(true);
                  }
                }}
                disabled={isParalegal}
                className={`flex items-center gap-4 px-4 py-3 w-full text-left ${
                  isParalegal
                    ? 'cursor-default'
                    : 'hover:bg-bg-hover'
                }`}
              >
                <User className="w-5 h-5 text-text-muted" />
                {task.assignee ? (
                  <span className="text-sm text-text-secondary">
                    {task.assignee.first_name} {task.assignee.last_name}
                  </span>
                ) : (
                  <span className="text-sm text-text-muted">Unassigned</span>
                )}
              </button>
            </div>

            {/* Assignee Picker */}
            <AssigneePicker
              currentAssigneeId={task.assignee_id ?? null}
              eligibleAssignees={eligibleAssignees}
              onChange={handleAssigneeChange}
              isOpen={showAssigneePicker}
              onClose={() => setShowAssigneePicker(false)}
              anchorEl={assigneePickerAnchor}
            />

            {/* Priority */}
            <div className="relative border-b border-border">
              <button
                ref={priorityButtonRef}
                onClick={handlePriorityClick}
                className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-bg-hover"
              >
                <Flag className={`w-5 h-5 ${priorityConfig.textClass}`} />
                <span className={`text-sm ${priorityConfig.textClass}`}>
                  {priorityConfig.label}
                </span>
              </button>
            </div>

            {/* Priority Picker Dropdown - rendered in portal */}
            {showPriorityPicker && createPortal(
              <div className="fixed inset-0 z-[9999]" onClick={() => setShowPriorityPicker(false)}>
                <div
                  className="absolute bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[200px]"
                  style={{ top: priorityPickerPos.top, left: priorityPickerPos.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handlePriorityChange(option.value)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-bg-hover ${option.color}`}
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
                anchorEl={eventLinkAnchor}
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
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-bg-hover flex-shrink-0" />
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-bg-hover rounded-full">
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Comment"
                className="flex-1 bg-transparent border-none outline-none text-sm text-text-secondary placeholder-text-muted"
              />
              <button className="text-text-muted hover:text-text-secondary">
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
