/**
 * TaskItem - Todoist-style task row component
 *
 * Minimal two-line layout with hover actions.
 * Line 1: checkbox + title
 * Line 2: date (with icon) + case/project on right
 */
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import {
  Calendar,
  GripVertical,
  Pencil,
  MessageSquare,
  MoreHorizontal,
  Inbox,
} from 'lucide-react';
import type { Task } from '../../types';

// Priority colors for checkbox border (Todoist style)
// 4 = urgent (red), 3 = high (orange), 2 = medium (blue), 1 = low (gray)
const PRIORITY_COLORS = {
  4: 'border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
  3: 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
  2: 'border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  1: 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50',
} as const;

export interface TaskItemProps {
  task: Task;
  /** Show the case/project on the right */
  showCase?: boolean;
  /** Show drag handle on hover */
  showDragHandle?: boolean;
  /** Disable drag even if showDragHandle is true */
  disableDrag?: boolean;
  /** Highlight this row (e.g., after drop) */
  isHighlighted?: boolean;
  /** Callback when checkbox is clicked (mark done) */
  onMarkDone?: (taskId: number) => void;
  /** Callback when task row is clicked (for inline edit) */
  onClick?: (task: Task) => void;
  /** Callback when edit action is clicked */
  onEdit?: (task: Task) => void;
  /** Callback when delete is clicked */
  onDelete?: (taskId: number) => void;
}

/**
 * Format a date relative to today (Todoist style)
 */
function formatRelativeDate(dateStr: string): { text: string; isOverdue: boolean } {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;

  if (diffDays === 0) {
    return { text: 'Today', isOverdue: false };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isOverdue: false };
  } else if (diffDays === -1) {
    return { text: 'Yesterday', isOverdue: true };
  } else if (isOverdue) {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: true
    };
  } else {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: false
    };
  }
}

export function TaskItem({
  task,
  showCase = true,
  showDragHandle = false,
  disableDrag = false,
  isHighlighted = false,
  onMarkDone,
  onClick,
  onEdit,
  onDelete,
}: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  // dnd-kit sortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !showDragHandle || disableDrag,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const priorityColor = PRIORITY_COLORS[task.urgency as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[1];
  const dateInfo = task.due_date ? formatRelativeDate(task.due_date) : null;
  const isDone = task.status === 'Done';

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkDone) {
      onMarkDone(task.id);
    }
  };

  const handleRowClick = () => {
    if (onClick) {
      onClick(task);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(task);
    }
  };

  // On mobile, attach drag listeners to the row; on desktop, use the handle
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(showDragHandle && isTouchDevice ? { ...attributes, ...listeners } : {})}
      className={`
        group relative flex items-start gap-2 px-3 py-2.5 md:px-2 md:py-2
        border-b border-slate-100 dark:border-slate-800
        transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${isDragging ? 'shadow-lg rounded-lg bg-white dark:bg-slate-800 border border-primary-500' : ''}
        ${isHighlighted ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
        ${showDragHandle && isTouchDevice ? 'touch-none' : ''}
      `}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle - appears on hover, desktop only */}
      <div className={`hidden md:flex w-6 flex-shrink-0 items-center justify-center pt-0.5 transition-opacity ${isHovered && showDragHandle ? 'opacity-100' : 'opacity-0'}`}>
        {showDragHandle && (
          <button
            {...attributes}
            {...listeners}
            className={`p-0.5 text-slate-400 ${disableDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:text-slate-600 dark:hover:text-slate-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Checkbox */}
      <button
        onClick={handleCheckboxClick}
        className={`
          w-5 h-5 mt-0.5 flex-shrink-0 rounded-full border-2
          transition-all duration-150
          ${isDone
            ? 'bg-slate-400 border-slate-400'
            : priorityColor
          }
        `}
        title={isDone ? 'Completed' : 'Mark as done'}
      >
        {isDone && (
          <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Title - single line, truncate */}
        <div className={`text-sm leading-snug truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
          {task.description}
        </div>

        {/* Metadata row: date on left, case on right */}
        <div className="flex items-center justify-between mt-0.5">
          {/* Due date */}
          {dateInfo ? (
            <div className={`flex items-center gap-1 text-xs ${dateInfo.isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{dateInfo.text}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Case/Project link */}
          {showCase && (
            <Link
              to={`/cases/${task.case_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              title={task.case_name || `Case #${task.case_id}`}
            >
              <span className="max-w-[100px] truncate">{task.short_name || task.case_name || `#${task.case_id}`}</span>
              <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* Hover actions - hidden on mobile */}
      <div className={`hidden md:flex items-start gap-0.5 pt-0.5 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={handleEditClick}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="Set due date"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="Comments"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onDelete) onDelete(task.id);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * TaskItemOverlay - Used inside DragOverlay for the dragged preview
 */
export function TaskItemOverlay({ task }: { task: Task }) {
  const priorityColor = PRIORITY_COLORS[task.urgency as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[1];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-primary-500">
      <GripVertical className="w-4 h-4 text-slate-400" />
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${priorityColor.split(' ')[0]}`} />
      <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
        {task.description}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
        {task.short_name || task.case_name}
      </span>
    </div>
  );
}
