import { SortableTaskRow } from './SortableTaskRow';
import type { Task } from '../../types';

// Date group labels and colors
const dateGroupConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  overdue: { label: 'Overdue', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  today: { label: 'Today', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
  thisWeek: { label: 'This Week', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  nextWeek: { label: 'Next Week', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20' },
  later: { label: 'Later', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800/50' },
  noDate: { label: 'No Date', color: 'text-slate-500 dark:text-slate-400', bgColor: 'bg-slate-50 dark:bg-slate-800/50' },
};

interface DateGroupProps {
  dateKey: string;
  tasks: Task[];
  taskStatusOptions: { value: string; label: string }[];
  urgencyOptions: { value: string; label: string }[];
  onUpdate: (taskId: number, field: string, value: any) => Promise<void> | void;
  onDelete: (taskId: number, description: string) => void;
  recentlyDroppedId?: number | null;
}

export function DateGroup({
  dateKey,
  tasks,
  taskStatusOptions,
  urgencyOptions,
  onUpdate,
  onDelete,
  recentlyDroppedId,
}: DateGroupProps) {
  const config = dateGroupConfig[dateKey] || dateGroupConfig.noDate;

  return (
    <div className="mb-6">
      {/* Group Header */}
      <div className={`flex items-center gap-2 mb-2 px-2 py-1 rounded ${config.bgColor}`}>
        <span className={`text-sm font-semibold ${config.color}`}>
          {config.label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          ({tasks.length})
        </span>
      </div>

      {/* Task List (no drag-and-drop between date groups) */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-[60px] text-sm text-slate-400">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <SortableTaskRow
              key={task.id}
              task={task}
              taskStatusOptions={taskStatusOptions}
              urgencyOptions={urgencyOptions}
              onUpdate={onUpdate}
              onDelete={onDelete}
              showUrgency={true}
              isHighlighted={task.id === recentlyDroppedId}
              disableDrag
            />
          ))
        )}
      </div>
    </div>
  );
}
