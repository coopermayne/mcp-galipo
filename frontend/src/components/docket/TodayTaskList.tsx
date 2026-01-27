import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { GripVertical, Check } from 'lucide-react';
import { StatusBadge } from '../common';
import type { Task } from '../../types';

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

interface DocketTaskRowProps {
  task: Task;
  onMarkDone: (taskId: number) => void;
}

function DocketTaskRow({ task, onMarkDone }: DocketTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        px-3 py-2 flex items-center gap-2
        bg-white dark:bg-slate-800
        border-b border-slate-200 dark:border-slate-700 last:border-b-0
        hover:bg-slate-50 dark:hover:bg-slate-700/50
        ${isDragging ? 'shadow-lg rounded-lg border border-primary-500' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-0.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Case Badge */}
      <Link
        to={`/cases/${task.case_id}`}
        className={`px-1.5 py-0.5 rounded text-xs font-medium hover:opacity-80 truncate max-w-[60px] ${getCaseColorClass(task.case_id)}`}
        title={task.short_name || task.case_name || `Case #${task.case_id}`}
      >
        {task.short_name || task.case_name || `#${task.case_id}`}
      </Link>

      {/* Description */}
      <div className="flex-1 min-w-0 text-sm text-slate-900 dark:text-slate-100 truncate">
        {task.description}
      </div>

      {/* Status */}
      <StatusBadge status={task.status} />

      {/* Quick Done Button */}
      <button
        onClick={() => onMarkDone(task.id)}
        className="p-1 text-slate-400 hover:text-green-500 transition-colors"
        title="Mark as Done"
      >
        <Check className="w-4 h-4" />
      </button>
    </div>
  );
}

interface TodayTaskListProps {
  tasks: Task[];
  sectionId: string;
  onMarkDone: (taskId: number) => void;
  emptyMessage?: string;
}

export function TodayTaskList({ tasks, sectionId, onMarkDone, emptyMessage = 'No tasks' }: TodayTaskListProps) {
  const taskIds = tasks.map((t) => t.id);

  if (tasks.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">
        {emptyMessage}
      </div>
    );
  }

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy} id={sectionId}>
      <div className="border-t border-slate-200 dark:border-slate-700">
        {tasks.map((task) => (
          <DocketTaskRow key={task.id} task={task} onMarkDone={onMarkDone} />
        ))}
      </div>
    </SortableContext>
  );
}
