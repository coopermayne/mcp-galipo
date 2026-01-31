/**
 * TaskInlineEdit - Todoist-style inline task editor
 *
 * Replaces the task row with an editable form when user clicks the edit icon.
 * Has title, description, date picker, and save/cancel buttons.
 */
import { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import {
  Calendar,
  Flag,
  Tag,
  X,
} from 'lucide-react';
import type { Task } from '../../types';
import 'react-datepicker/dist/react-datepicker.css';

export interface TaskInlineEditProps {
  task: Task;
  /** Called when user saves changes */
  onSave: (taskId: number, updates: { description?: string; due_date?: string; urgency?: number }) => Promise<void>;
  /** Called when user cancels editing */
  onCancel: () => void;
}

// Priority colors matching TaskItem
const PRIORITY_OPTIONS = [
  { value: 4, label: 'Priority 1', color: 'text-red-500' },
  { value: 3, label: 'Priority 2', color: 'text-orange-500' },
  { value: 2, label: 'Priority 3', color: 'text-blue-500' },
  { value: 1, label: 'Priority 4', color: 'text-slate-400' },
] as const;

export function TaskInlineEdit({ task, onSave, onCancel }: TaskInlineEditProps) {
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

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDueDate(null);
  };

  // Format date for display in chip
  const formatDateChip = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) return 'Today';
    if (compareDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return format(date, 'MMM d');
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

  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === urgency) || PRIORITY_OPTIONS[3];

  return (
    <div
      ref={containerRef}
      className="px-3 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm"
    >
      {/* Title input */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task name"
        className="w-full text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent border-b border-slate-200 dark:border-slate-700 pb-1 mb-2 outline-none focus:border-slate-400 dark:focus:border-slate-500"
      />


      {/* Actions row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* Date picker chip */}
          <div className="relative">
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => {
                setDueDate(date);
                setIsDatePickerOpen(false);
              }}
              open={isDatePickerOpen}
              onClickOutside={() => setIsDatePickerOpen(false)}
              dateFormat="yyyy-MM-dd"
              showYearDropdown
              showMonthDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={15}
              dropdownMode="select"
              portalId="datepicker-portal"
              renderCustomHeader={renderDatePickerHeader}
              customInput={
                dueDate ? (
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{formatDateChip(dueDate)}</span>
                    <button
                      type="button"
                      onClick={clearDate}
                      className="ml-0.5 p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="flex items-center gap-1 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                    title="Set due date"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                )
              }
            />
          </div>

          {/* Priority picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPriorityOpen(!isPriorityOpen)}
              className={`flex items-center gap-1 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded ${currentPriority.color}`}
              title="Set priority"
            >
              <Flag className="w-4 h-4" />
            </button>
            {isPriorityOpen && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setUrgency(option.value);
                      setIsPriorityOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-600 ${option.color}`}
                  >
                    <Flag className="w-4 h-4" />
                    <span>{option.label}</span>
                    {option.value === urgency && (
                      <span className="ml-auto text-primary-500">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Labels placeholder (for visual consistency with Todoist) */}
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Add labels"
          >
            <Tag className="w-4 h-4" />
          </button>
        </div>

        {/* Cancel / Save buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
