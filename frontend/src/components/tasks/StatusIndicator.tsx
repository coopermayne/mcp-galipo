/**
 * StatusIndicator - Small clickable icon showing task status
 *
 * Displays the appropriate icon for the task status.
 * Color is based on priority/urgency (not status).
 * When clicked, opens the StatusPicker popover.
 */
import { useState, useRef } from 'react';
import { Circle, CheckCircle2, XCircle } from 'lucide-react';
import { StatusPicker } from './StatusPicker';
import { ActiveStatusIcon } from './ActiveStatusIcon';
import type { TaskStatus } from '../../types';

interface StatusIndicatorProps {
  status: TaskStatus;
  /** Priority determines the color (1=gray, 2=blue, 3=orange, 4=red) */
  priority?: number;
  /** Callback when status is changed */
  onStatusChange?: (newStatus: TaskStatus) => void;
  /** Disable interaction */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

// Priority-based colors (matches Todoist urgency colors)
const PRIORITY_COLORS = {
  4: 'text-red-500',
  3: 'text-orange-500',
  2: 'text-blue-500',
  1: 'text-text-muted',
} as const;

// Priority-based border colors for Pending (empty circle)
const PRIORITY_BORDER_COLORS = {
  4: 'border-red-500',
  3: 'border-orange-500',
  2: 'border-blue-500',
  1: 'border-border',
} as const;

// Status icons (symbol indicates status, color indicates priority)
// Note: Active uses a custom ActiveStatusIcon component, not from this map
const STATUS_ICONS = {
  Pending: Circle,
  Active: Circle, // Placeholder - we use ActiveStatusIcon instead
  Done: CheckCircle2,
  Blocked: XCircle,
  'Partially Done': CheckCircle2,
  'Awaiting Atty Review': Circle,
} as const;

export function StatusIndicator({
  status,
  priority = 1,
  onStatusChange,
  disabled = false,
  size = 'md',
}: StatusIndicatorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const Icon = STATUS_ICONS[status] || Circle;
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  // Color based on priority (Done always uses green for visual confirmation)
  const color = status === 'Done'
    ? 'text-green-500'
    : PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[1];

  const borderColor = PRIORITY_BORDER_COLORS[priority as keyof typeof PRIORITY_BORDER_COLORS] || PRIORITY_BORDER_COLORS[1];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onStatusChange) {
      setIsPickerOpen(true);
    }
  };

  const handleStatusSelect = (newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(newStatus);
    }
    setIsPickerOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        disabled={disabled}
        className={`
          ${sizeClasses} flex-shrink-0 rounded-full
          transition-all duration-200
          ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
          ${status === 'Pending' ? `border-2 ${borderColor}` : ''}
        `}
        title={`${status}${priority > 1 ? ` (Priority ${5 - priority})` : ''}`}
      >
        {status === 'Pending' ? (
          // Empty circle for Pending (like Todoist checkbox)
          <span className={`block w-full h-full rounded-full`} />
        ) : status === 'Active' ? (
          // Bouncing dot inside circle for Active status
          <span className={color}>
            <ActiveStatusIcon className="w-full h-full" />
          </span>
        ) : (
          <Icon className={`w-full h-full ${color}`} />
        )}
      </button>

      <StatusPicker
        isOpen={isPickerOpen}
        anchorEl={buttonRef.current}
        currentStatus={status}
        priority={priority}
        onSelect={handleStatusSelect}
        onClose={() => setIsPickerOpen(false)}
      />
    </>
  );
}
