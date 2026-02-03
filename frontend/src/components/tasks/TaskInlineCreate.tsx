/**
 * TaskInlineCreate - Inline task creation matching TaskInlineEdit layout
 *
 * Shows an inline form for creating a new task with the same styling
 * as the inline edit form.
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import { format, getYear } from 'date-fns';
import {
  Calendar,
  Flag,
  Inbox,
} from 'lucide-react';
import { getCases } from '../../api';
import 'react-datepicker/dist/react-datepicker.css';

export interface TaskInlineCreateProps {
  /** Pre-selected case ID (if provided, case selector shows this case) */
  caseId?: number;
  /** Pre-filled due date (YYYY-MM-DD format) */
  dueDate?: string;
  /** Default status for new task (e.g., 'Done' when creating in done view) */
  defaultStatus?: string;
  /** Called when user saves the new task */
  onSave: (data: { case_id: number; description: string; due_date?: string; urgency?: number; status?: string }) => Promise<void>;
  /** Called when user cancels creation */
  onCancel: () => void;
}

// Priority colors matching TaskItem
const PRIORITY_OPTIONS = [
  { value: 4, label: 'Urgent', color: 'text-red-500' },
  { value: 3, label: 'High', color: 'text-orange-500' },
  { value: 2, label: 'Medium', color: 'text-blue-500' },
  { value: 1, label: 'Low', color: 'text-text-muted' },
] as const;

/**
 * Format a date relative to today
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

export function TaskInlineCreate({
  caseId: preselectedCaseId,
  dueDate: prefilledDueDate,
  defaultStatus,
  onSave,
  onCancel,
}: TaskInlineCreateProps) {
  const [title, setTitle] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(preselectedCaseId || null);
  const [dueDate, setDueDate] = useState<Date | null>(() => {
    if (!prefilledDueDate) return null;
    const parsed = new Date(prefilledDueDate + 'T00:00:00');
    return isNaN(parsed.getTime()) ? null : parsed;
  });
  const [urgency, setUrgency] = useState(2); // Default to Medium
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [highlightedCaseIndex, setHighlightedCaseIndex] = useState(0);

  const titleRef = useRef<HTMLInputElement>(null);
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

  // Focus title input on mount
  useEffect(() => {
    titleRef.current?.focus();
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
    if (!title.trim() || !caseIdToUse) return;

    setIsSaving(true);
    try {
      await onSave({
        case_id: caseIdToUse,
        description: title.trim(),
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        urgency,
        status: defaultStatus,
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

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === urgency) || PRIORITY_OPTIONS[2];
  const dateInfo = dueDate ? formatRelativeDate(format(dueDate, 'yyyy-MM-dd')) : null;
  const caseIdToUse = preselectedCaseId || selectedCaseId;
  const canSave = title.trim() && caseIdToUse;

  return (
    <div
      ref={containerRef}
      className="px-3 py-2.5 md:px-2 md:py-2 border border-border rounded-lg bg-bg-surface shadow-sm"
    >
      {/* Title input */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task name"
        className="w-full text-sm leading-snug text-text bg-transparent outline-none placeholder:text-text-muted"
      />

      {/* Metadata row - case, date, priority */}
      <div className="flex items-center mt-1 gap-3">
        {/* Case/Project selector */}
        {!preselectedCaseId ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCaseDropdownOpen(!isCaseDropdownOpen)}
              className={`flex items-center gap-1 text-xs hover:underline ${
                selectedCaseId
                  ? 'text-text-muted'
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
                className={`flex items-center gap-1 text-xs hover:underline ${dateInfo.isOverdue ? 'text-red-500' : 'text-text-muted'}`}
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
          disabled={!canSave || isSaving}
          className="px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
