/**
 * TaskItem - Unified task row component
 *
 * A single task display that can be configured for different contexts.
 * Supports drag-and-drop via dnd-kit when used inside a DndContext.
 */
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { Check, Trash2, Calendar, ChevronRight, GripVertical } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';

// Deterministic color mapping for case badges
const CASE_COLORS = [
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
];

const URGENCY_CONFIG = {
  4: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  3: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  2: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  1: { label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
} as const;

const STATUS_CONFIG = {
  'To Do': { color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  'In Progress': { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  'Done': { color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
} as const;

export interface TaskItemProps {
  task: Task;
  /** Show the case name badge */
  showCase?: boolean;
  /** Show urgency badge */
  showUrgency?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Show quick "mark done" button */
  showQuickDone?: boolean;
  /** Show drag handle (requires DndContext parent) */
  showDragHandle?: boolean;
  /** Disable drag even if showDragHandle is true */
  disableDrag?: boolean;
  /** Highlight this row (e.g., after drop) */
  isHighlighted?: boolean;
  /** Callback when any field is updated */
  onUpdate?: (taskId: number, field: keyof Task, value: unknown) => Promise<void>;
  /** Callback when delete is clicked */
  onDelete?: (taskId: number) => void;
  /** Callback when task is marked done */
  onMarkDone?: (taskId: number) => void;
  /** Callback when task row is clicked (for modal opening) */
  onClick?: (task: Task) => void;
}

export function TaskItem({
  task,
  showCase = true,
  showUrgency = true,
  showDelete = true,
  showQuickDone = false,
  showDragHandle = false,
  disableDrag = false,
  isHighlighted = false,
  onUpdate,
  onDelete,
  onMarkDone,
  onClick,
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

  const caseColor = CASE_COLORS[task.case_id % CASE_COLORS.length];
  const urgencyConfig = URGENCY_CONFIG[task.urgency as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG[2];
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['To Do'];

  const handleRowClick = () => {
    if (onClick) {
      onClick(task);
    }
  };

  const handleStatusCycle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdate) return;

    const statusOrder: TaskStatus[] = ['To Do', 'In Progress', 'Done'];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    await onUpdate(task.id, 'status', nextStatus);
  };

  const handleQuickDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkDone) {
      onMarkDone(task.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(task.id);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 px-4 py-3
        bg-white dark:bg-slate-800
        border-b border-slate-200 dark:border-slate-700 last:border-b-0
        transition-colors
        ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : ''}
        ${isDragging ? 'shadow-lg rounded-lg border border-primary-500' : ''}
        ${isHighlighted ? 'ring-2 ring-primary-400 ring-opacity-75' : ''}
      `}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Docket indicator */}
      <div className="w-4 flex-shrink-0">
        {task.docket_category && (
          <ChevronRight className="w-4 h-4 text-amber-500" />
        )}
      </div>

      {/* Drag handle */}
      {showDragHandle && (
        <button
          {...attributes}
          {...listeners}
          className={`p-1 text-slate-400 ${disableDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      {/* Case badge */}
      {showCase && (
        <Link
          to={`/cases/${task.case_id}`}
          onClick={(e) => e.stopPropagation()}
          className={`px-2 py-0.5 rounded text-xs font-medium truncate max-w-[80px] text-center hover:opacity-80 ${caseColor}`}
          title={task.short_name || task.case_name || `Case #${task.case_id}`}
        >
          {task.short_name || task.case_name || `#${task.case_id}`}
        </Link>
      )}

      {/* Status badge (clickable to cycle) */}
      <button
        onClick={handleStatusCycle}
        className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color} hover:opacity-80`}
        title="Click to change status"
      >
        {task.status}
      </button>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-900 dark:text-slate-100 truncate block">
          {task.description}
        </span>
      </div>

      {/* Due date */}
      {task.due_date && (
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Calendar className="w-3 h-3" />
          {formatDate(task.due_date)}
        </div>
      )}

      {/* Urgency badge */}
      {showUrgency && (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyConfig.color}`}>
          {task.urgency}
        </span>
      )}

      {/* Actions (show on hover) */}
      <div className={`flex items-center gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        {showQuickDone && task.status !== 'Done' && (
          <button
            onClick={handleQuickDone}
            className="p-1 text-slate-400 hover:text-green-500 transition-colors"
            title="Mark as Done"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        {showDelete && (
          <button
            onClick={handleDelete}
            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * TaskItemOverlay - Used inside DragOverlay for the dragged preview
 */
export function TaskItemOverlay({ task }: { task: Task }) {
  const caseColor = CASE_COLORS[task.case_id % CASE_COLORS.length];
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['To Do'];

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-primary-500">
      <GripVertical className="w-4 h-4 text-slate-400" />
      <span className={`px-2 py-0.5 rounded text-xs font-medium truncate max-w-[80px] ${caseColor}`}>
        {task.short_name || task.case_name}
      </span>
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
        {task.status}
      </span>
      <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
        {task.description}
      </span>
    </div>
  );
}
