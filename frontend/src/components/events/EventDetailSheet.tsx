/**
 * EventDetailSheet - Mobile-first full-screen event editor
 *
 * Slides up from bottom on mobile, shows as a sheet/modal.
 * Matches TaskDetailSheet pattern for consistency.
 */
import { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import {
  X,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Calendar,
  Star,
  Briefcase,
  AlignLeft,
  MapPin,
  Trash2,
  ListTodo,
} from 'lucide-react';
import { TimePicker, CaseChip } from '../common';
import type { Event } from '../../types';
import 'react-datepicker/dist/react-datepicker.css';

export type SheetFocusMode = 'title' | 'date' | null;

interface EventDetailSheetProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleStar?: (event: Event) => void;
  onUpdate?: (eventId: number, updates: Partial<Event>) => Promise<void>;
  onDelete?: (eventId: number) => void;
  onCreateTask?: (event: Event) => void;
  onPrevEvent?: () => void;
  onNextEvent?: () => void;
  hasPrevEvent?: boolean;
  hasNextEvent?: boolean;
  /** What to focus when sheet opens */
  initialFocus?: SheetFocusMode;
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr: string | undefined): { text: string; color: string } {
  if (!dateStr) {
    return { text: 'No date', color: 'text-text-muted' };
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
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

export function EventDetailSheet({
  event,
  isOpen,
  onClose,
  onToggleStar,
  onUpdate,
  onDelete,
  onCreateTask,
  onPrevEvent,
  onNextEvent,
  hasPrevEvent = false,
  hasNextEvent = false,
  initialFocus = null,
}: EventDetailSheetProps) {
  const [editedDescription, setEditedDescription] = useState(event?.description || '');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Sync description when event changes
  useEffect(() => {
    setEditedDescription(event?.description || '');
  }, [event?.description]);

  // Handle initial focus
  useEffect(() => {
    if (isOpen && event && initialFocus) {
      const timer = setTimeout(() => {
        switch (initialFocus) {
          case 'title':
            if (descriptionInputRef.current) {
              descriptionInputRef.current.focus();
              descriptionInputRef.current.select();
            }
            break;
          case 'date':
            if (dateButtonRef.current) {
              dateButtonRef.current.click();
            }
            break;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, event, initialFocus]);

  // Reset state when event changes
  useEffect(() => {
    setShowMoreMenu(false);
  }, [event?.id]);

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
        if (showMoreMenu) {
          setShowMoreMenu(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showMoreMenu]);

  if (!isOpen || !event) return null;

  const dateDisplay = formatDateDisplay(event.date);

  // Parse date for DatePicker
  const selectedDate = (() => {
    const parsed = parse(event.date, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : null;
  })();

  const handleStarClick = () => {
    if (onToggleStar) {
      onToggleStar(event);
    }
  };

  const handleDescriptionBlur = async () => {
    if (editedDescription !== event.description && onUpdate) {
      await onUpdate(event.id, { description: editedDescription });
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      descriptionInputRef.current?.blur();
    }
  };

  const handleDateChange = async (date: Date | null) => {
    if (onUpdate && date) {
      const newDateStr = format(date, 'yyyy-MM-dd');
      await onUpdate(event.id, { date: newDateStr });
    }
  };

  const handleTimeChange = async (time: string | null) => {
    if (onUpdate) {
      await onUpdate(event.id, { time: time ?? undefined });
    }
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
            caseId={event.case_id}
            caseName={event.case_name}
            shortName={event.short_name}
            color={event.case_color}
          />

          {/* Nav + actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevEvent}
              disabled={!hasPrevEvent}
              className="p-2 text-text-muted hover:text-text-secondary disabled:opacity-30"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={onNextEvent}
              disabled={!hasNextEvent}
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
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[160px] z-50"
                  >
                    {onCreateTask && (
                      <button
                        onClick={() => {
                          onCreateTask(event);
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-text-secondary hover:bg-bg-hover"
                      >
                        <ListTodo className="w-4 h-4" />
                        <span className="text-sm">Create task</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => {
                          onDelete(event.id);
                          onClose();
                          setShowMoreMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">Delete event</span>
                      </button>
                    )}
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
          {/* Event description section */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              {/* Star toggle */}
              <button
                onClick={handleStarClick}
                className={`
                  w-6 h-6 mt-0.5 flex-shrink-0 flex items-center justify-center
                  transition-all duration-150 rounded-full
                  ${event.starred
                    ? 'text-amber-500'
                    : 'text-text-muted hover:text-amber-400'
                  }
                `}
              >
                <Star className={`w-5 h-5 ${event.starred ? 'fill-amber-500' : ''}`} />
              </button>

              {/* Description input */}
              <div className="flex-1">
                <input
                  ref={descriptionInputRef}
                  type="text"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={handleDescriptionKeyDown}
                  className="w-full text-lg font-medium bg-transparent border-none outline-none text-text"
                  placeholder="Event description"
                />

                {/* Notes placeholder */}
                <div className="flex items-center gap-2 mt-2 text-text-muted">
                  <AlignLeft className="w-4 h-4" />
                  <span className="text-sm">Notes</span>
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
                caseId={event.case_id}
                caseName={event.case_name}
                shortName={event.short_name}
                color={event.case_color}
              />
            </div>

            {/* Date + Time */}
            <div className="flex items-center border-b border-border">
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
                    className="flex items-center gap-4 px-4 py-3 text-left hover:bg-bg-hover"
                  >
                    <Calendar className={`w-5 h-5 ${dateDisplay.color}`} />
                    <span className={`text-sm ${dateDisplay.color}`}>
                      {dateDisplay.text}
                    </span>
                  </button>
                }
              />
              <div className="border-l border-border px-4 py-3">
                <TimePicker
                  value={event.time || null}
                  onChange={handleTimeChange}
                  placeholder="Add time"
                />
              </div>
            </div>

            {/* Star/Key Date toggle */}
            <button
              onClick={handleStarClick}
              className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-bg-hover border-b border-border"
            >
              <Star className={`w-5 h-5 ${event.starred ? 'text-amber-500 fill-amber-500' : 'text-text-muted'}`} />
              <span className={`text-sm ${event.starred ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`}>
                {event.starred ? 'Key Date' : 'Mark as Key Date'}
              </span>
            </button>

            {/* Location (if present) */}
            {event.location && (
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
                <MapPin className="w-5 h-5 text-text-muted" />
                <span className="text-sm text-text-secondary">
                  {event.location}
                </span>
              </div>
            )}

            {/* Task count */}
            {event.task_count != null && event.task_count > 0 && (
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
                <ListTodo className="w-5 h-5 text-text-muted" />
                <span className="text-sm text-text-secondary">
                  {event.task_count} linked task{event.task_count > 1 ? 's' : ''}
                </span>
              </div>
            )}
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
