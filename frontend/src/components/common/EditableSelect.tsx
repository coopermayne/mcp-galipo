import { useState, useRef, useEffect, useCallback } from 'react';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface EditableSelectProps {
  value: string;
  options: Option[];
  onSave: (value: string) => Promise<unknown>;
  className?: string;
  disabled?: boolean;
  renderValue?: (value: string) => React.ReactNode;
}

export function EditableSelect({
  value,
  options,
  onSave,
  className = '',
  disabled = false,
  renderValue,
}: EditableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { save, status } = useAutoSave({
    onSave: async (newValue: string) => {
      await onSave(newValue);
    },
    debounceMs: 0, // No debounce for select - save immediately
  });

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
    (newValue: string) => {
      if (newValue !== value) {
        save(newValue);
      }
      setIsOpen(false);
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

  const displayValue = renderValue
    ? renderValue(value)
    : options.find((o) => o.value === value)?.label || value;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded
          hover:bg-slate-700 transition-colors text-sm text-slate-100
          ${disabled ? 'cursor-default hover:bg-transparent opacity-60' : 'cursor-pointer'}
        `}
      >
        {displayValue}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {statusIcon()}
      </button>

      {isOpen && (
        <div
          className="
            absolute z-50 mt-1 min-w-[160px] max-h-[240px] overflow-auto
            bg-slate-700 border border-slate-600 rounded-lg shadow-lg
            py-1
          "
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`
                w-full text-left px-3 py-1.5 text-sm text-slate-100
                hover:bg-slate-600 transition-colors
                ${option.value === value ? 'bg-primary-900/50 text-primary-300' : ''}
              `}
            >
              {renderValue ? renderValue(option.value) : option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
