import { forwardRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { format, parse, isValid, getYear } from 'date-fns';
import { useAutoSave } from '../../hooks/useAutoSave';
import { formatSmartDate, type DateFormatOptions } from '../../utils/dateFormat';
import { Check, AlertCircle, Loader2, Calendar, X } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface EditableDateProps extends DateFormatOptions {
  /** Date value in YYYY-MM-DD format */
  value: string | null;
  /** Callback when date changes */
  onSave: (value: string | null) => Promise<unknown>;
  /** Placeholder text when no date selected */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable editing (read-only display) */
  disabled?: boolean;
  /** Show clear button */
  clearable?: boolean;
}

interface CustomInputProps {
  value?: string;
  displayValue: string;
  onClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  clearable?: boolean;
  hasDate: boolean;
  onClear: () => void;
}

const CustomInput = forwardRef<HTMLDivElement, CustomInputProps>(
  (
    {
      displayValue,
      onClick,
      placeholder,
      disabled,
      status,
      clearable,
      hasDate,
      onClear,
    },
    ref
  ) => {
    const statusIcon = () => {
      switch (status) {
        case 'saving':
          return <Loader2 className="w-3 h-3 animate-spin text-slate-400" />;
        case 'saved':
          return <Check className="w-3 h-3 text-green-500" />;
        case 'error':
          return <AlertCircle className="w-3 h-3 text-red-500" />;
        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm text-slate-900 dark:text-slate-100
          ${!hasDate ? 'text-slate-400 dark:text-slate-500 italic' : ''}
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`
            inline-flex items-center gap-1.5 rounded
            ${disabled ? 'cursor-default' : 'cursor-pointer hover:text-slate-600 dark:hover:text-slate-300'}
          `}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{displayValue || placeholder}</span>
        </button>
        {clearable && hasDate && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            title="Clear date"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {statusIcon()}
      </div>
    );
  }
);

CustomInput.displayName = 'CustomInput';

export function EditableDate({
  value,
  onSave,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  clearable = true,
  showDayOfWeek = true,
  hideCurrentYear = true,
  numeric = true,
}: EditableDateProps) {
  // Auto-save for date
  const { save: saveDate, status } = useAutoSave({
    onSave: async (newValue: string | null) => {
      await onSave(newValue);
    },
    debounceMs: 0,
  });

  // Parse the date value
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    if (!isValid(parsed)) return null;
    return parsed;
  }, [value]);

  // Format the display value using our smart formatter
  const displayValue = useMemo(() => {
    if (!selectedDate) return '';
    return formatSmartDate(selectedDate, { showDayOfWeek, hideCurrentYear, numeric });
  }, [selectedDate, showDayOfWeek, hideCurrentYear, numeric]);

  // Handle date change from picker
  const handleChange = (date: Date | null) => {
    if (!date) {
      if (value !== null) {
        saveDate(null);
      }
      return;
    }

    const newDateStr = format(date, 'yyyy-MM-dd');
    if (newDateStr !== value) {
      saveDate(newDateStr);
    }
  };

  // Clear the date
  const handleClear = () => {
    saveDate(null);
  };

  // Generate year range for dropdown
  const currentYear = getYear(new Date());
  const years = Array.from({ length: 26 }, (_, i) => currentYear - 10 + i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (disabled) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 text-sm text-slate-900 dark:text-slate-100 opacity-60 ${className}`}>
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        <span className={!value ? 'text-slate-400 dark:text-slate-500 italic' : ''}>
          {displayValue || placeholder}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <DatePicker
        selected={selectedDate}
        onChange={handleChange}
        dateFormat="yyyy-MM-dd"
        showYearDropdown
        showMonthDropdown
        scrollableYearDropdown
        yearDropdownItemNumber={15}
        dropdownMode="select"
        customInput={
          <CustomInput
            displayValue={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            status={status}
            clearable={clearable}
            hasDate={!!value}
            onClear={handleClear}
          />
        }
        renderCustomHeader={({
          date,
          changeYear,
          changeMonth,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
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
        )}
        popperClassName="react-datepicker-popper-custom"
        calendarClassName="react-datepicker-calendar-custom"
        wrapperClassName="react-datepicker-wrapper-custom"
        portalId="datepicker-portal"
      />
    </div>
  );
}
