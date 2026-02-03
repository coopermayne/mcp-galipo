/**
 * EventInlineCreate - Inline event creation matching EventInlineEdit layout
 *
 * Shows an inline form for creating a new event with the same styling
 * as the inline edit form.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import { format, getYear } from 'date-fns';
import { Calendar, Inbox, Sparkles } from 'lucide-react';
import { TimePicker } from '../common';
import { getCases } from '../../api';
import { parseDateFromText, removeDateFromText, type ParsedDate } from '../../utils/dateParser';
import 'react-datepicker/dist/react-datepicker.css';

export interface EventInlineCreateProps {
  /** Pre-selected case ID (if provided, case selector shows this case) */
  caseId?: number;
  /** Pre-filled date (YYYY-MM-DD format) */
  date?: string;
  /** Called when user saves the new event */
  onSave: (data: { case_id: number; description: string; date: string; time?: string }) => Promise<void>;
  /** Called when user cancels creation */
  onCancel: () => void;
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

  if (diffDays === 0) return { text: 'Today', isOverdue: false };
  if (diffDays === 1) return { text: 'Tomorrow', isOverdue: false };
  if (diffDays === -1) return { text: 'Yesterday', isOverdue: true };

  return {
    text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isOverdue
  };
}

export function EventInlineCreate({
  caseId: preselectedCaseId,
  date: prefilledDate,
  onSave,
  onCancel,
}: EventInlineCreateProps) {
  const [description, setDescription] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(preselectedCaseId || null);
  const [eventDate, setEventDate] = useState<Date | null>(() => {
    if (!prefilledDate) return null;
    const [year, month, day] = prefilledDate.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return isNaN(parsed.getTime()) ? null : parsed;
  });
  const [eventTime, setEventTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [highlightedCaseIndex, setHighlightedCaseIndex] = useState(0);
  const [dateManuallySet, setDateManuallySet] = useState(!!prefilledDate);

  // Real-time date detection from description text
  const detectedDateInfo = useMemo((): ParsedDate | null => {
    if (dateManuallySet) return null; // Don't detect if user manually set a date
    return parseDateFromText(description);
  }, [description, dateManuallySet]);

  const descriptionRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const caseSearchRef = useRef<HTMLInputElement>(null);

  // Fetch cases for dropdown (all non-closed cases)
  const { data: casesData } = useQuery({
    queryKey: ['cases-for-create'],
    queryFn: () => getCases({ limit: 100 }),
  });
  // Filter out closed cases client-side
  const allCases = (casesData?.cases || []).filter(c => c.status !== 'Closed');

  // Filter cases by search term
  const cases = caseSearch
    ? allCases.filter(c =>
        (c.short_name || c.case_name).toLowerCase().includes(caseSearch.toLowerCase())
      )
    : allCases;

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isCaseDropdownOpen && caseSearchRef.current) {
      caseSearchRef.current.focus();
    }
    if (!isCaseDropdownOpen) {
      setCaseSearch('');
      setHighlightedCaseIndex(0);
    }
  }, [isCaseDropdownOpen]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedCaseIndex(0);
  }, [caseSearch]);

  // Handle keyboard navigation in case dropdown
  const handleCaseSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedCaseIndex(prev => Math.min(prev + 1, cases.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedCaseIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cases.length > 0 && highlightedCaseIndex < cases.length) {
        setSelectedCaseId(cases[highlightedCaseIndex].id);
        setIsCaseDropdownOpen(false);
      }
    }
  };

  // Get selected case info
  const selectedCase = preselectedCaseId
    ? null // Will be passed from parent context
    : cases.find(c => c.id === selectedCaseId);

  // Focus description input on mount
  useEffect(() => {
    descriptionRef.current?.focus();
  }, []);

  // Handle click outside to cancel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Check if click is on a date picker portal
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
    const caseIdToUse = preselectedCaseId || selectedCaseId;

    // Use manually set date, or auto-detected date from description
    let finalDescription = description.trim();
    let finalDate = eventDate;

    if (!dateManuallySet && detectedDateInfo) {
      finalDate = detectedDateInfo.date;
      finalDescription = removeDateFromText(description, detectedDateInfo);
    }

    if (!finalDescription || !caseIdToUse || !finalDate) return;

    setIsSaving(true);
    try {
      await onSave({
        case_id: caseIdToUse,
        description: finalDescription,
        date: format(finalDate, 'yyyy-MM-dd'),
        time: eventTime || undefined,
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

  const caseIdToUse = preselectedCaseId || selectedCaseId;
  // Display date: manually set date takes precedence, then auto-detected
  const displayDate = eventDate || detectedDateInfo?.date || null;
  const dateInfo = displayDate ? formatRelativeDate(format(displayDate, 'yyyy-MM-dd')) : null;
  const isDateAutoDetected = !dateManuallySet && !!detectedDateInfo;

  const canSave = description.trim() && caseIdToUse && displayDate;

  return (
    <div
      ref={containerRef}
      className="px-3 py-2.5 md:px-2 md:py-2 border border-border rounded-lg bg-bg-surface shadow-sm"
    >
      {/* Description input with date highlighting */}
      <div className="relative">
        {/* Highlight overlay - shows behind the input */}
        {detectedDateInfo && (
          <div
            className="absolute inset-0 pointer-events-none text-sm leading-snug whitespace-pre text-transparent"
            aria-hidden="true"
          >
            <span>{description.substring(0, detectedDateInfo.startIndex)}</span>
            <span className="bg-blue-100 dark:bg-blue-900/50 text-transparent rounded px-0.5">
              {description.substring(detectedDateInfo.startIndex, detectedDateInfo.endIndex)}
            </span>
            <span>{description.substring(detectedDateInfo.endIndex)}</span>
          </div>
        )}
        <input
          ref={descriptionRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Event description"
          className="relative w-full text-sm leading-snug text-text bg-transparent outline-none placeholder:text-text-muted"
        />
      </div>

      {/* Metadata row - case, date, time */}
      <div className="flex items-center mt-1 gap-3">
        {/* Case/Project selector */}
        {!preselectedCaseId ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCaseDropdownOpen(!isCaseDropdownOpen)}
              className={`flex items-center gap-1 text-xs hover:underline ${
                selectedCaseId
                  ? 'text-text-secondary'
                  : 'text-orange-500'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="max-w-[100px] truncate">
                {selectedCase?.short_name || selectedCase?.case_name || 'Select case'}
              </span>
            </button>
            {isCaseDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-bg-surface border border-border rounded-lg shadow-lg z-50 min-w-[220px]">
                {/* Search input */}
                <div className="p-2 border-b border-border">
                  <input
                    ref={caseSearchRef}
                    type="text"
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    onKeyDown={handleCaseSearchKeyDown}
                    placeholder="Search..."
                    className="w-full px-2 py-1 text-xs bg-bg-hover border border-border rounded text-text placeholder:text-text-muted outline-none focus:border-primary-400"
                  />
                </div>
                {/* Case list */}
                <div className="max-h-[180px] overflow-y-auto py-1">
                  {cases.map((c, index) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCaseId(c.id);
                        setIsCaseDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left ${
                        index === highlightedCaseIndex
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      <Inbox className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{c.short_name || c.case_name}</span>
                      {c.id === selectedCaseId && (
                        <span className="ml-auto text-primary-500">✓</span>
                      )}
                    </button>
                  ))}
                  {cases.length === 0 && (
                    <div className="px-3 py-2 text-xs text-text-muted">
                      {caseSearch ? 'No matching cases' : 'No active cases'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Date picker */}
        <DatePicker
          selected={displayDate}
          onChange={(date: Date | null) => {
            setEventDate(date);
            setDateManuallySet(!!date);
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
                className={`flex items-center gap-1 text-xs hover:underline ${
                  isDateAutoDetected
                    ? 'text-blue-500 dark:text-blue-400'
                    : dateInfo.isOverdue
                      ? 'text-red-500'
                      : 'text-text-secondary'
                }`}
              >
                {isDateAutoDetected ? (
                  <Sparkles className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                )}
                <span>{dateInfo.text}</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-orange-500 hover:underline"
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
          disabled={!canSave || isSaving}
          className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
