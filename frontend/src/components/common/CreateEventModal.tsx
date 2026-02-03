/**
 * CreateEventModal - Mobile-first event creation sheet
 *
 * Matches EventDetailSheet UX: slides up from bottom, action rows for metadata.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import { format, getYear } from 'date-fns';
import {
  X,
  Calendar,
  Star,
  Briefcase,
  Check,
  Inbox,
  Clock,
} from 'lucide-react';
import { createEvent, getCases } from '../../api';
import { TimePicker } from './TimePicker';
import { parseDateFromText, removeDateFromText, type ParsedDate } from '../../utils';
import { INPUT_HIGHLIGHT } from '../../config/colors';
import 'react-datepicker/dist/react-datepicker.css';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selected case ID (if provided, case selector is hidden) */
  caseId?: number;
  /** Pre-filled date */
  date?: string;
  /** Additional query keys to invalidate on success */
  invalidateKeys?: string[][];
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr: string | undefined): { text: string; color: string } {
  if (!dateStr) {
    return { text: 'No date', color: 'text-orange-500' };
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

export function CreateEventModal({
  isOpen,
  onClose,
  caseId: preselectedCaseId,
  date: prefilledDate,
  invalidateKeys = [],
}: CreateEventModalProps) {
  const queryClient = useQueryClient();
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(preselectedCaseId || null);
  const [eventDate, setEventDate] = useState<Date | null>(() => {
    if (!prefilledDate) return null;
    const parsed = new Date(prefilledDate + 'T00:00:00');
    return isNaN(parsed.getTime()) ? null : parsed;
  });
  const [eventTime, setEventTime] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [dateManuallySet, setDateManuallySet] = useState(!!prefilledDate);

  // Real-time date detection from description text
  const detectedDateInfo = useMemo((): ParsedDate | null => {
    if (dateManuallySet) return null;
    return parseDateFromText(description);
  }, [description, dateManuallySet]);

  // Display date: manually set date takes precedence, then auto-detected
  const displayDate = eventDate || detectedDateInfo?.date || null;

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
      setDescription('');
      setEventDate(() => {
        if (!prefilledDate) return null;
        const parsed = new Date(prefilledDate + 'T00:00:00');
        return isNaN(parsed.getTime()) ? null : parsed;
      });
      setEventTime(null);
      setStarred(false);
      setSelectedCaseId(preselectedCaseId || null);
      setShowCasePicker(false);
      setCaseSearch('');
      setDateManuallySet(!!prefilledDate);
      // Focus description input after render
      setTimeout(() => descriptionInputRef.current?.focus(), 100);
    }
  }, [isOpen, prefilledDate, preselectedCaseId]);

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
        if (showCasePicker) {
          setShowCasePicker(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showCasePicker]);

  const createMutation = useMutation({
    mutationFn: () => {
      const caseIdToUse = preselectedCaseId || selectedCaseId;
      if (!caseIdToUse) throw new Error('Case is required');

      // Use auto-detected date if not manually set
      let finalDescription = description.trim();
      let finalDate = displayDate;

      if (!dateManuallySet && detectedDateInfo) {
        finalDate = detectedDateInfo.date;
        finalDescription = removeDateFromText(description, detectedDateInfo);
      }

      if (!finalDate) throw new Error('Date is required');

      return createEvent({
        case_id: caseIdToUse,
        description: finalDescription,
        date: format(finalDate, 'yyyy-MM-dd'),
        time: eventTime || undefined,
        starred,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
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
    if (description.trim() && caseIdToUse && displayDate) {
      createMutation.mutate();
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const dateDisplay = formatDateDisplay(displayDate ? format(displayDate, 'yyyy-MM-dd') : undefined);
  const caseIdToUse = preselectedCaseId || selectedCaseId;
  const canSubmit = description.trim() && caseIdToUse && displayDate;

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
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            New Event
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Event description section */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              {/* Star toggle */}
              <button
                onClick={() => setStarred(!starred)}
                className={`
                  w-6 h-6 mt-0.5 flex-shrink-0 flex items-center justify-center
                  transition-all duration-150 rounded-full
                  ${starred
                    ? 'text-amber-500'
                    : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                  }
                `}
              >
                <Star className={`w-5 h-5 ${starred ? 'fill-amber-500' : ''}`} />
              </button>

              {/* Description input with date highlighting */}
              <div className="flex-1 relative">
                {/* Highlight overlay */}
                {detectedDateInfo && (
                  <div
                    className="absolute inset-0 pointer-events-none text-lg font-medium whitespace-pre text-transparent"
                    aria-hidden="true"
                  >
                    <span>{description.substring(0, detectedDateInfo.startIndex)}</span>
                    <span className={`${INPUT_HIGHLIGHT.date} text-transparent rounded px-0.5`}>
                      {description.substring(detectedDateInfo.startIndex, detectedDateInfo.endIndex)}
                    </span>
                    <span>{description.substring(detectedDateInfo.endIndex)}</span>
                  </div>
                )}
                <input
                  ref={descriptionInputRef}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleDescriptionKeyDown}
                  className="w-full text-lg font-medium bg-transparent border-none outline-none text-slate-900 dark:text-slate-100"
                  placeholder="Event description"
                />
              </div>
            </div>
          </div>

          {/* Action rows */}
          <div className="border-t border-slate-100 dark:border-slate-800">
            {/* Case/Project - only show if no preselected case */}
            {!preselectedCaseId && (
              <div className="relative border-b border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setShowCasePicker(!showCasePicker)}
                  className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Briefcase className={`w-5 h-5 ${selectedCaseId ? 'text-slate-600 dark:text-slate-400' : 'text-orange-500'}`} />
                  <span className={`text-sm ${selectedCaseId ? 'text-slate-700 dark:text-slate-300' : 'text-orange-500'}`}>
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
                    <div className="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-[300px] overflow-hidden">
                      {/* Search */}
                      <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                          <Inbox className="w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={caseSearch}
                            onChange={(e) => setCaseSearch(e.target.value)}
                            placeholder="Search cases..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400"
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
                            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${
                              c.id === selectedCaseId ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <Inbox className="w-4 h-4 text-slate-400" />
                            <span className="text-sm flex-1 text-slate-700 dark:text-slate-200 truncate">
                              {c.short_name || c.case_name}
                            </span>
                            {c.id === selectedCaseId && (
                              <Check className="w-4 h-4 text-primary-500" />
                            )}
                          </button>
                        ))}
                        {filteredCases.length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-400 text-center">
                            {caseSearch ? 'No matching cases' : 'No active cases'}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Date + Time */}
            <div className="flex items-center border-b border-slate-100 dark:border-slate-800">
              <DatePicker
                selected={displayDate}
                onChange={(date: Date | null) => {
                  setEventDate(date);
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
                  <button className="flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Calendar className={`w-5 h-5 ${dateDisplay.color}`} />
                    <span className={`text-sm ${dateDisplay.color}`}>
                      {dateDisplay.text}
                    </span>
                  </button>
                }
              >
                {/* Clear date button */}
                {displayDate && (
                  <div className="px-2 pb-2 pt-1 border-t border-slate-200 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        setEventDate(null);
                        setDateManuallySet(false);
                      }}
                      className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      Clear date
                    </button>
                  </div>
                )}
              </DatePicker>

              <div className="border-l border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Clock className="w-5 h-5 text-slate-400" />
                <TimePicker
                  value={eventTime}
                  onChange={setEventTime}
                  placeholder="Add time"
                />
              </div>
            </div>

            {/* Star/Key Date toggle */}
            <button
              onClick={() => setStarred(!starred)}
              className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800"
            >
              <Star className={`w-5 h-5 ${starred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
              <span className={`text-sm ${starred ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {starred ? 'Key Date' : 'Mark as Key Date'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer with action buttons */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !canSubmit}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-slate-900"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Event'}
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
