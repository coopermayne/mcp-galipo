/**
 * EventItem - Todoist-style event row component
 *
 * Minimal two-line layout with hover actions (matching TaskItem pattern).
 * Line 1: star toggle + description
 * Line 2: case link + date/time
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  Calendar,
  Clock,
  Inbox,
  Pencil,
  Trash2,
  ListTodo,
  MoreHorizontal,
} from 'lucide-react';
import type { Event } from '../../types';

export interface EventItemProps {
  event: Event;
  /** Show the case/project link */
  showCase?: boolean;
  /** Callback when star is toggled */
  onToggleStar?: (event: Event) => void;
  /** Callback when event row is clicked */
  onClick?: (event: Event) => void;
  /** Callback when edit action is clicked */
  onEdit?: (event: Event) => void;
  /** Callback when create task action is clicked */
  onCreateTask?: (event: Event) => void;
  /** Callback when delete action is clicked */
  onDelete?: (event: Event) => void;
  /** Highlight this row (e.g., for overdue) */
  isHighlighted?: boolean;
  /** Align to left edge (no left padding) - for flat lists */
  flush?: boolean;
}

/**
 * Format a date relative to today (Todoist style)
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;

  if (diffDays === 0) {
    return { text: 'Today', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isOverdue: false };
  } else if (diffDays === -1) {
    return { text: 'Yesterday', isOverdue: true };
  } else {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue,
    };
  }
}

/**
 * Format time for display (12-hour format)
 */
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function EventItem({
  event,
  showCase = true,
  onToggleStar,
  onClick,
  onEdit,
  onCreateTask,
  onDelete,
  isHighlighted = false,
  flush = false,
}: EventItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const dateInfo = formatRelativeDate(event.date);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStar) {
      onToggleStar(event);
    }
  };

  const handleRowClick = () => {
    if (onClick) {
      onClick(event);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(event);
    }
  };

  const handleCreateTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCreateTask) {
      onCreateTask(event);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(event);
    }
  };

  return (
    <div
      className={`
        group relative flex items-start gap-2 py-2.5 md:py-2
        ${flush ? 'px-0' : 'px-3 md:px-2'}
        border-b border-slate-100 dark:border-slate-800
        transition-colors duration-150
        ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
        ${isHighlighted ? 'bg-red-50 dark:bg-red-900/20' : ''}
      `}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Star toggle (like checkbox for tasks) */}
      <button
        onClick={handleStarClick}
        className={`
          w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center
          transition-all duration-200 rounded-full
          ${event.starred
            ? 'text-amber-500'
            : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
          }
        `}
        title={event.starred ? 'Remove from Key Dates' : 'Add to Key Dates'}
      >
        <Star className={`w-4 h-4 ${event.starred ? 'fill-amber-500' : ''}`} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Title - single line, truncate */}
        <div className="text-sm leading-snug truncate text-slate-900 dark:text-slate-100">
          {event.description}
        </div>

        {/* Metadata row: case, date, time - all inline */}
        <div className="flex items-center mt-0.5 gap-3 flex-wrap">
          {/* Case/Project link */}
          {showCase && (
            <Link
              to={`/cases/${event.case_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              title={event.case_name || `Case #${event.case_id}`}
            >
              <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="max-w-[100px] truncate">
                {event.short_name || event.case_name || `#${event.case_id}`}
              </span>
            </Link>
          )}

          {/* Date */}
          <span
            className={`flex items-center gap-1 text-xs ${
              dateInfo.isOverdue
                ? 'text-red-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{dateInfo.text}</span>
          </span>

          {/* Time (if set) */}
          {event.time && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{formatTime(event.time)}</span>
            </span>
          )}

          {/* Task count (if any) */}
          {event.task_count && event.task_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <ListTodo className="w-3 h-3 flex-shrink-0" />
              <span>{event.task_count} task{event.task_count > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>

      {/* Hover actions - hidden on mobile */}
      <div
        className={`hidden md:flex items-start gap-0.5 pt-0.5 transition-opacity ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {onEdit && (
          <button
            onClick={handleEditClick}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {onCreateTask && (
          <button
            onClick={handleCreateTaskClick}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Create task from event"
          >
            <ListTodo className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile: show actions as a dropdown trigger */}
      <div className="md:hidden flex items-start pt-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // On mobile, show all actions - for now just delete
            if (onDelete) onDelete(event);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
