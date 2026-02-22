/**
 * CreateTaskModal - Mobile-first task creation sheet
 *
 * Matches TaskDetailSheet UX: slides up from bottom, action rows for metadata.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import { format, getYear } from 'date-fns';
import {
  X,
  Calendar,
  Flag,
  Briefcase,
  Check,
  Inbox,
} from 'lucide-react';
import { createTask, getCases } from '../../api';
import { parseDateFromText, removeDateFromText, type ParsedDate } from '../../utils';
import { INPUT_HIGHLIGHT } from '../../config/colors';
import 'react-datepicker/dist/react-datepicker.css';

// Priority config matching TaskDetailSheet
const PRIORITY_OPTIONS = [
  { value: 'Urgent', label: 'Priority 1', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  { value: 'High', label: 'Priority 2', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { value: 'Medium', label: 'Priority 3', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { value: 'Low', label: 'Priority 4', color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
] as const;

const getPriorityConfig = (urgency: string) =>
  PRIORITY_OPTIONS.find(p => p.value === urgency) || PRIORITY_OPTIONS[2];

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selected case ID (if provided, case selector is hidden) */
  caseId?: number;
  /** Pre-filled due date */
  dueDate?: string;
  /** Additional query keys to invalidate on success */
  invalidateKeys?: string[][];
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

export function CreateTaskModal({
  isOpen,
  onClose,
  caseId: preselectedCaseId,
  dueDate: prefilledDueDate,
  invalidateKeys = [],
}: CreateTaskModalProps) {
  const queryClient = useQueryClient();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(preselectedCaseId || null);
  const [dueDate, setDueDate] = useState<Date | null>(() => {
    if (!prefilledDueDate) return null;
    const parsed = new Date(prefilledDueDate + 'T00:00:00');
    return isNaN(parsed.getTime()) ? null : parsed;
  });
  const [urgency, setUrgency] = useState('Medium');
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [dateManuallySet, setDateManuallySet] = useState(!!prefilledDueDate);

  // Real-time date detection from title text
  const detectedDateInfo = useMemo((): ParsedDate | null => {
    if (dateManuallySet) return null;
    return parseDateFromText(title);
  }, [title, dateManuallySet]);

  // Display date: manually set date takes precedence, then auto-detected
  const displayDate = dueDate || detectedDateInfo?.date || null;

  // Fetch cases for dropdown (only when no preselected case)
  const { data: casesData } = useQuery({
    queryKey: ['cases-for-create'],
    queryFn: () => getCases({ limit: 100 }),
    enabled: isOpen && !preselectedCaseId,
  });
  const allCases = (casesData?.cases || []).filter(c => c.status !== 'Closed');
  const filteredCases = caseSearch
    ? allCases.filter(c =>
        (c.short_name || c.case_name).toLowerCase().includes(caseSearch.toLowerCase())
      )
    : allCases;

  // Get selected case info
  const selectedCase = allCases.find(c => c.id === selectedCaseId);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDueDate(() => {
        if (!prefilledDueDate) return null;
        const parsed = new Date(prefilledDueDate + 'T00:00:00');
        return isNaN(parsed.getTime()) ? null : parsed;
      });
      setUrgency('Medium');
      setSelectedCaseId(preselectedCaseId || null);
      setShowPriorityPicker(false);
      setShowCasePicker(false);
      setCaseSearch('');
      setDateManuallySet(!!prefilledDueDate);
      // Focus title input after render
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen, prefilledDueDate, preselectedCaseId]);

  // Handle body scroll lock
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
        } else if (showCasePicker) {
          setShowCasePicker(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showPriorityPicker, showCasePicker]);

  const createMutation = useMutation({
    mutationFn: () => {
      const caseIdToUse = preselectedCaseId || selectedCaseId;
      if (!caseIdToUse) throw new Error('Case is required');

      // Use auto-detected date if not manually set
      let finalDescription = title.trim();
      let finalDate = dueDate;

      if (!dateManuallySet && detectedDateInfo) {
        finalDate = detectedDateInfo.date;
        finalDescription = removeDateFromText(title, detectedDateInfo);
      }

      return createTask({
        case_id: caseIdToUse,
        description: finalDescription,
        due_date: finalDate ? format(finalDate, 'yyyy-MM-dd') : undefined,
        urgency,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['lab-tasks'] });
      const caseIdToUse = preselectedCaseId || selectedCaseId;
      if (caseIdToUse) {
        queryClient.invalidateQueries({ queryKey: ['case', caseIdToUse] });
      }
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      onClose();
    },
  });

  const handleSubmit = () => {
    const caseIdToUse = preselectedCaseId || selectedCaseId;
    if (title.trim() && caseIdToUse) {
      createMutation.mutate();
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const priorityConfig = getPriorityConfig(urgency);
  const dateDisplay = formatDateDisplay(displayDate ? format(displayDate, 'yyyy-MM-dd') : undefined);
  const caseIdToUse = preselectedCaseId || selectedCaseId;
  const canSubmit = title.trim() && caseIdToUse;

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

  if (!isOpen) return null;

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
          <h2 className="text-base font-semibold text-text">
            New Task
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Task title section */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              {/* Empty checkbox placeholder for alignment */}
              <div
                className="w-6 h-6 mt-0.5 flex-shrink-0 rounded-full border-2"
                style={{
                  borderColor: priorityConfig.color.includes('red') ? '#ef4444' :
                    priorityConfig.color.includes('orange') ? '#f97316' :
                    priorityConfig.color.includes('blue') ? '#3b82f6' : '#94a3b8'
                }}
              />

              {/* Title input with date highlighting */}
              <div className="flex-1 relative">
                {/* Highlight overlay */}
                {detectedDateInfo && (
                  <div
                    className="absolute inset-0 pointer-events-none text-lg font-medium whitespace-pre text-transparent"
                    aria-hidden="true"
                  >
                    <span>{title.substring(0, detectedDateInfo.startIndex)}</span>
                    <span className={`${INPUT_HIGHLIGHT.date} text-transparent rounded px-0.5`}>
                      {title.substring(detectedDateInfo.startIndex, detectedDateInfo.endIndex)}
                    </span>
                    <span>{title.substring(detectedDateInfo.endIndex)}</span>
                  </div>
                )}
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="w-full text-lg font-medium bg-transparent border-none outline-none text-text"
                  placeholder="Task name"
                />
              </div>
            </div>
          </div>

          {/* Action rows */}
          <div className="border-t border-border">
            {/* Case/Project - only show if no preselected case */}
            {!preselectedCaseId && (
              <div className="relative border-b border-border">
                <button
                  onClick={() => setShowCasePicker(!showCasePicker)}
                  className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-bg-hover"
                >
                  <Briefcase className={`w-5 h-5 ${selectedCaseId ? 'text-text-secondary' : 'text-orange-500'}`} />
                  <span className={`text-sm ${selectedCaseId ? 'text-text' : 'text-orange-500'}`}>
                    {selectedCase?.short_name || selectedCase?.case_name || 'Select case'}
                  </span>
                </button>

                {/* Case picker dropdown */}
                {showCasePicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCasePicker(false)}
                    />
                    <div className="absolute left-4 right-4 top-full mt-1 bg-bg-surface border border-border rounded-lg shadow-xl z-50 max-h-[300px] overflow-hidden">
                      {/* Search */}
                      <div className="p-2 border-b border-border">
                        <div className="flex items-center gap-2 px-3 py-2 bg-bg-hover rounded-lg">
                          <Inbox className="w-4 h-4 text-text-muted" />
                          <input
                            type="text"
                            value={caseSearch}
                            onChange={(e) => setCaseSearch(e.target.value)}
                            placeholder="Search cases..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder-text-muted"
                            autoFocus
                          />
                        </div>
                      </div>
                      {/* Case list */}
                      <div className="max-h-[200px] overflow-y-auto py-1">
                        {filteredCases.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCaseId(c.id);
                              setShowCasePicker(false);
                              setCaseSearch('');
                            }}
                            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-bg-hover ${
                              c.id === selectedCaseId ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <Inbox className="w-4 h-4 text-text-muted" />
                            <span className="text-sm flex-1 text-text truncate">
                              {c.short_name || c.case_name}
                            </span>
                            {c.id === selectedCaseId && (
                              <Check className="w-4 h-4 text-primary-500" />
                            )}
                          </button>
                        ))}
                        {filteredCases.length === 0 && (
                          <div className="px-4 py-3 text-sm text-text-muted text-center">
                            {caseSearch ? 'No matching cases' : 'No active cases'}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Due date */}
            <div className="relative border-b border-border">
              <DatePicker
                selected={displayDate}
                onChange={(date: Date | null) => {
                  setDueDate(date);
                  setDateManuallySet(!!date);
                }}
                dateFormat="yyyy-MM-dd"
                showYearDropdown
                showMonthDropdown
                scrollableYearDropdown
                yearDropdownItemNumber={15}
                dropdownMode="select"
                portalId="datepicker-portal"
                renderCustomHeader={renderDatePickerHeader}
                customInput={
                  <button className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-bg-hover">
                    <Calendar className={`w-5 h-5 ${dateDisplay.color}`} />
                    <span className={`text-sm ${dateDisplay.color}`}>
                      {dateDisplay.text}
                    </span>
                  </button>
                }
              >
                {/* Clear date button */}
                {displayDate && (
                  <div className="px-2 pb-2 pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate(null);
                        setDateManuallySet(false);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      Clear date
                    </button>
                  </div>
                )}
              </DatePicker>
            </div>

            {/* Priority */}
            <div className="relative border-b border-border">
              <button
                onClick={() => setShowPriorityPicker(!showPriorityPicker)}
                className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-bg-hover"
              >
                <Flag className={`w-5 h-5 ${priorityConfig.color}`} />
                <span className={`text-sm ${priorityConfig.color}`}>
                  {priorityConfig.label}
                </span>
              </button>

              {/* Priority picker dropdown */}
              {showPriorityPicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPriorityPicker(false)}
                  />
                  <div className="absolute left-4 right-4 top-full mt-1 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-50">
                    {PRIORITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setUrgency(option.value);
                          setShowPriorityPicker(false);
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-bg-hover ${option.color}`}
                      >
                        <Flag className="w-4 h-4" />
                        <span className="text-sm flex-1">{option.label}</span>
                        {urgency === option.value && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="border-t border-border px-4 py-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-bg-hover hover:bg-bg-hover/80 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !canSubmit}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Task'}
          </button>
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
