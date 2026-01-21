import { useState, useRef, useEffect, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Check, AlertCircle, Loader2, Calendar, X } from 'lucide-react';
import 'react-day-picker/style.css';

interface EditableDateProps {
  value: string | null;
  onSave: (value: string | null) => Promise<unknown>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function EditableDate({
  value,
  onSave,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  clearable = true,
}: EditableDateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { save, status } = useAutoSave({
    onSave: async (newValue: string | null) => {
      await onSave(newValue);
    },
    debounceMs: 0,
  });

  // Parse the value to a Date object
  const dateValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const isValidDate = dateValue && isValid(dateValue);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      const newValue = date ? format(date, 'yyyy-MM-dd') : null;
      if (newValue !== value) {
        save(newValue);
      }
      setIsOpen(false);
    },
    [value, save]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (value) {
        save(null);
      }
    },
    [value, save]
  );

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  }, [disabled, isOpen]);

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

  const displayValue = isValidDate
    ? format(dateValue!, 'MMM d, yyyy')
    : placeholder;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded
          hover:bg-slate-700 transition-colors text-sm text-slate-100
          ${!isValidDate ? 'text-slate-500 italic' : ''}
          ${disabled ? 'cursor-default hover:bg-transparent opacity-60' : 'cursor-pointer'}
        `}
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{displayValue}</span>
        {clearable && value && !disabled && (
          <X
            className="w-3 h-3 text-slate-500 hover:text-slate-300"
            onClick={handleClear}
          />
        )}
        {statusIcon()}
      </button>

      {isOpen && (
        <div
          className="
            absolute z-50 mt-1
            bg-slate-700 border border-slate-600 rounded-lg shadow-lg
            p-2
          "
        >
          <DayPicker
            mode="single"
            selected={isValidDate ? dateValue : undefined}
            onSelect={handleSelect}
            className="text-sm text-slate-100"
            classNames={{
              day: 'w-8 h-8 rounded hover:bg-slate-600 text-slate-100',
              selected: 'bg-primary-500 text-white hover:bg-primary-600',
              today: 'font-bold text-primary-400',
            }}
          />
        </div>
      )}
    </div>
  );
}
