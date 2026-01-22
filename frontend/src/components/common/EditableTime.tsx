import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import { setHours, setMinutes } from 'date-fns';
import { useAutoSave } from '../../hooks/useAutoSave';
import { formatTime } from '../../utils/dateFormat';
import { Check, AlertCircle, Loader2, Clock, X } from 'lucide-react';

interface EditableTimeProps {
  /** Time value in HH:mm format (24-hour) */
  value: string | null;
  /** Callback when time changes */
  onSave: (value: string | null) => Promise<unknown>;
  /** Additional CSS classes */
  className?: string;
  /** Disable editing (read-only display) */
  disabled?: boolean;
}

interface CustomInputProps {
  onClick?: () => void;
  disabled?: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  hasTime: boolean;
  formattedTime: string | null;
  onClear: () => void;
}

const CustomInput = forwardRef<HTMLDivElement, CustomInputProps>(
  ({ onClick, disabled, status, hasTime, formattedTime, onClear }, ref) => {
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

    if (!hasTime) {
      // No time set - show just a clock icon
      return (
        <div ref={ref} className="inline-flex items-center">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`
              inline-flex items-center py-1 pr-1 rounded
              text-slate-400 dark:text-slate-500
              ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:text-slate-600 dark:hover:text-slate-300'}
            `}
            title="Set time"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {statusIcon()}
        </div>
      );
    }

    // Time is set - show formatted time with clear button
    return (
      <div
        ref={ref}
        className={`
          inline-flex items-center gap-1 py-1 pr-2 text-sm
          text-slate-600 dark:text-slate-300
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`
            inline-flex items-center gap-1 rounded
            ${disabled ? 'cursor-default' : 'cursor-pointer hover:text-slate-500 dark:hover:text-slate-200'}
          `}
        >
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{formattedTime}</span>
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            title="Clear time"
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

export function EditableTime({
  value,
  onSave,
  className = '',
  disabled = false,
}: EditableTimeProps) {
  const { save, status } = useAutoSave({
    onSave: async (newValue: string | null) => {
      await onSave(newValue);
    },
    debounceMs: 0,
  });

  // Parse time value into a Date object for the picker
  const selectedTime = (() => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    // Use today's date with the specified time
    return setMinutes(setHours(new Date(), hours), minutes);
  })();

  const formattedTime = value ? formatTime(value) : null;

  const handleChange = (date: Date | null) => {
    if (!date) {
      save(null);
      return;
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const newTimeStr = `${hours}:${minutes}`;

    if (newTimeStr !== value) {
      save(newTimeStr);
    }
  };

  const handleClear = () => {
    save(null);
  };

  if (disabled) {
    if (!value) return null;
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 text-sm text-slate-600 dark:text-slate-300 opacity-60 ${className}`}>
        <Clock className="w-3 h-3 text-slate-400" />
        <span>{formattedTime}</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <DatePicker
        selected={selectedTime}
        onChange={handleChange}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={30}
        timeCaption="Time"
        dateFormat="HH:mm"
        customInput={
          <CustomInput
            disabled={disabled}
            status={status}
            hasTime={!!value}
            formattedTime={formattedTime}
            onClear={handleClear}
          />
        }
        popperClassName="react-datepicker-popper-custom"
        calendarClassName="react-datepicker-calendar-custom react-datepicker-time-only"
        wrapperClassName="react-datepicker-wrapper-custom"
        portalId="datepicker-portal"
      />
    </div>
  );
}
