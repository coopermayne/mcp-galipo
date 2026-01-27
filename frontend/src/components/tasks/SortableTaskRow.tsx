import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { GripVertical, Trash2, ChevronRight } from 'lucide-react';
import {
  EditableText,
  EditableSelect,
  EditableDate,
  StatusBadge,
  UrgencyBadge,
} from '../common';
import type { Task, TaskStatus } from '../../types';

// Deterministic color mapping for case badges
const caseColorClasses = [
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
];

const getCaseColorClass = (caseId: number) => caseColorClasses[caseId % caseColorClasses.length];

interface SortableTaskRowProps {
  task: Task;
  taskStatusOptions: { value: string; label: string }[];
  urgencyOptions: { value: string; label: string }[];
  onUpdate: (taskId: number, field: string, value: any) => Promise<void> | void;
  onDelete: (taskId: number, description: string) => void;
  showCaseBadge?: boolean;
  showUrgency?: boolean;
  isPreview?: boolean;
  isHighlighted?: boolean;
  disableDrag?: boolean;
}

export function SortableTaskRow({
  task,
  taskStatusOptions,
  urgencyOptions,
  onUpdate,
  onDelete,
  showCaseBadge = true,
  showUrgency = true,
  isPreview = false,
  isHighlighted = false,
  disableDrag = false,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isPreview || disableDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    ...(isHighlighted ? {
      animation: 'highlightFade 1.5s ease-out',
    } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        px-4 py-3 flex items-center gap-3
        bg-white dark:bg-slate-800
        border-b border-slate-200 dark:border-slate-700 last:border-b-0
        hover:bg-slate-50 dark:hover:bg-slate-700/50
        ${isDragging ? 'shadow-lg rounded-lg border border-primary-500' : ''}
        ${isHighlighted ? 'ring-2 ring-primary-400 ring-opacity-75' : ''}
      `}
    >
      {/* Docket Indicator (fixed width) + Drag Handle */}
      <div className="w-3 flex-shrink-0">
        {task.docket_category && (
          <ChevronRight className="w-3 h-3 text-slate-400" />
        )}
      </div>
      <button
        {...(disableDrag ? {} : { ...attributes, ...listeners })}
        className={`p-1 text-slate-400 ${disableDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:text-slate-600 dark:hover:text-slate-300'}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Case Badge */}
      {showCaseBadge && (
        <Link
          to={`/cases/${task.case_id}`}
          className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-20 truncate text-center ${getCaseColorClass(task.case_id)}`}
          title={task.short_name || task.case_name || `Case #${task.case_id}`}
        >
          {task.short_name || task.case_name || `Case #${task.case_id}`}
        </Link>
      )}

      {/* Description */}
      <div className="flex-1 min-w-0">
        <EditableText
          value={task.description}
          onSave={async (value) => { await onUpdate(task.id, 'description', value); }}
          className="text-sm"
        />
      </div>

      {/* Due Date */}
      <EditableDate
        value={task.due_date || null}
        onSave={async (value) => { await onUpdate(task.id, 'due_date', value); }}
        placeholder="Due"
      />

      {/* Status */}
      <EditableSelect
        value={task.status}
        options={taskStatusOptions}
        onSave={async (value) => { await onUpdate(task.id, 'status', value as TaskStatus); }}
        renderValue={(value) => <StatusBadge status={value} />}
      />

      {/* Urgency */}
      {showUrgency && (
        <EditableSelect
          value={String(task.urgency)}
          options={urgencyOptions}
          onSave={async (value) => { await onUpdate(task.id, 'urgency', parseInt(value)); }}
          renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
        />
      )}

      {/* Delete Button */}
      <button
        onClick={() => onDelete(task.id, task.description)}
        className="p-1 text-slate-500 hover:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
