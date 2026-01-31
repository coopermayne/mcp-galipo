/**
 * TimePicker - Type-to-filter time selector
 *
 * Shows time options in 30-minute increments with search filtering.
 * Typing "9" shows 9:00 AM, 9:30 AM, 9:00 PM, 9:30 PM, etc.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, X } from 'lucide-react';

interface TimePickerProps {
  /** Current time value in HH:MM format (24-hour) */
  value: string | null;
  /** Callback when time changes */
  onChange: (time: string | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Show clear button when value is set */
  showClear?: boolean;
  /** Additional class names for the container */
  className?: string;
}

interface TimeOption {
  value: string; // 24-hour format: "09:00", "21:30"
  label: string; // 12-hour format: "9:00 AM", "9:30 PM"
  searchTerms: string[]; // For filtering - each checked independently
}

/**
 * Generate all time options in 30-minute increments
 */
function generateTimeOptions(): TimeOption[] {
  const options: TimeOption[] = [];

  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const hour24 = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const value = `${hour24}:${minuteStr}`;

      const hour12 = hour % 12 || 12;
      const period = hour < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${minuteStr} ${period}`;

      // Search terms - each checked independently to avoid false matches
      // e.g., "11 23" joining to "1123" which falsely matches "12"
      const searchTerms = [
        label.toLowerCase().replace(/[:\s]/g, ''), // "1100pm"
        `${hour12}${minuteStr}`,  // "1100"
        `${hour12}`,              // "11"
        `${hour}${minuteStr}`,    // "2300"
        `${hour}`,                // "23"
        period.toLowerCase(),     // "pm"
      ];

      options.push({ value, label, searchTerms });
    }
  }

  return options;
}

const ALL_TIME_OPTIONS = generateTimeOptions();

/**
 * Format 24-hour time to 12-hour display
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Add time',
  showClear = true,
  className = '',
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter options based on input
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return ALL_TIME_OPTIONS;

    const query = inputValue.toLowerCase().replace(/[:\s]/g, '');
    return ALL_TIME_OPTIONS.filter((option) => {
      // Check if any search term starts with or contains the query
      return option.searchTerms.some((term) => term.startsWith(query));
    });
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setHighlightedIndex(0); // Reset highlight when input changes
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputValue('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (option: TimeOption) => {
    onChange(option.value);
    setIsOpen(false);
    setInputValue('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setInputValue('');
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button / display */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={`flex items-center gap-1 text-xs hover:underline ${
            value
              ? 'text-slate-500 dark:text-slate-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{value ? formatTime(value) : placeholder}</span>
          {value && showClear && (
            <span
              onClick={handleClear}
              className="ml-0.5 text-slate-400 hover:text-red-500 cursor-pointer"
              title="Clear time"
            >
              ×
            </span>
          )}
        </button>
      )}

      {/* Open state: input + dropdown */}
      {isOpen && (
        <div className="absolute z-[100] left-0 top-0">
          {/* Input */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded shadow-lg">
            <Clock className="w-3 h-3 ml-2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type to filter..."
              className="w-28 px-1 py-1 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
            />
            {value && (
              <button
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-red-500"
                title="Clear time"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Dropdown */}
          <div
            ref={listRef}
            className="absolute left-0 top-full mt-1 w-32 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-lg z-[100]"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-slate-400">No matches</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className={`w-full px-2 py-1.5 text-left text-xs ${
                    index === highlightedIndex
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600'
                  } ${option.value === value ? 'font-medium' : ''}`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
