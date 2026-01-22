import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskRow } from './SortableTaskRow';
import type { Task } from '../../types';

// Urgency labels and colors
const urgencyConfig: Record<number, { label: string; color: string; bgColor: string }> = {
  5: { label: 'Critical', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  4: { label: 'High', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
  3: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
  2: { label: 'Low', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  1: { label: 'Lowest', color: 'text-slate-500 dark:text-slate-400', bgColor: 'bg-slate-50 dark:bg-slate-800/50' },
};

interface UrgencyGroupProps {
  urgency: number;
  tasks: Task[];
  taskStatusOptions: { value: string; label: string }[];
  urgencyOptions: { value: string; label: string }[];
  onUpdate: (taskId: number, field: string, value: any) => void;
  onDelete: (taskId: number, description: string) => void;
}

export function UrgencyGroup({
  urgency,
  tasks,
  taskStatusOptions,
  urgencyOptions,
  onUpdate,
  onDelete,
}: UrgencyGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `urgency-${urgency}`,
    data: { type: 'urgency', urgency },
  });

  const config = urgencyConfig[urgency] || urgencyConfig[3];
  const taskIds = tasks.map((t) => t.id);

  return (
    <div className="mb-6">
      {/* Group Header */}
      <div className={`flex items-center gap-2 mb-2 px-2 py-1 rounded ${config.bgColor}`}>
        <span className={`text-sm font-semibold ${config.color}`}>
          {urgency} - {config.label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          ({tasks.length})
        </span>
      </div>

      {/* Droppable Container */}
      <div
        ref={setNodeRef}
        className={`
          rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden
          ${isOver ? 'ring-2 ring-primary-500 ring-opacity-50' : ''}
          ${tasks.length === 0 ? 'min-h-[60px] bg-slate-50 dark:bg-slate-800/50' : ''}
        `}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-[60px] text-sm text-slate-400">
            Drop tasks here
          </div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                taskStatusOptions={taskStatusOptions}
                urgencyOptions={urgencyOptions}
                onUpdate={onUpdate}
                onDelete={onDelete}
                showUrgency={false}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
