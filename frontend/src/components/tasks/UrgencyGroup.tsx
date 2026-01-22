import { useDroppable } from '@dnd-kit/core';
import type { UniqueIdentifier } from '@dnd-kit/core';
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
  activeId: UniqueIdentifier | null;
  dropTargetIndex: number | null; // Index where drop indicator should appear (null if not target)
  taskStatusOptions: { value: string; label: string }[];
  urgencyOptions: { value: string; label: string }[];
  onUpdate: (taskId: number, field: string, value: any) => Promise<void> | void;
  onDelete: (taskId: number, description: string) => void;
  recentlyDroppedId?: number | null;
}

export function UrgencyGroup({
  urgency,
  tasks,
  activeId,
  dropTargetIndex,
  taskStatusOptions,
  urgencyOptions,
  onUpdate,
  onDelete,
  recentlyDroppedId,
}: UrgencyGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `urgency-${urgency}`,
    data: { type: 'urgency', urgency },
  });

  const config = urgencyConfig[urgency] || urgencyConfig[3];
  // Filter out the active item from SortableContext to avoid conflicts
  const taskIds = tasks.filter((t) => t.id !== activeId).map((t) => t.id);

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
        {tasks.length === 0 && dropTargetIndex === null ? (
          <div className="flex items-center justify-center h-[60px] text-sm text-slate-400">
            Drop tasks here
          </div>
        ) : tasks.length === 0 && dropTargetIndex !== null ? (
          // Empty container but we're dropping here
          <div className="p-2">
            <div className="h-12 border-2 border-dashed border-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20" />
          </div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task, index) => {
              const isActiveItem = activeId !== null && task.id === activeId;
              // Count non-active items before this one to determine the visual index
              const visualIndex = tasks.slice(0, index).filter(t => t.id !== activeId).length;
              const showDropIndicatorBefore = dropTargetIndex !== null && visualIndex === dropTargetIndex && !isActiveItem;

              // Render a simple placeholder for the item being dragged (in its original position)
              if (isActiveItem) {
                return (
                  <div
                    key={task.id}
                    className="px-4 py-3 bg-slate-100 dark:bg-slate-700/50 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg opacity-40"
                  >
                    <div className="h-5" />
                  </div>
                );
              }

              return (
                <div key={task.id}>
                  {showDropIndicatorBefore && (
                    <div className="px-2 py-1">
                      <div className="h-12 border-2 border-dashed border-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20" />
                    </div>
                  )}
                  <SortableTaskRow
                    task={task}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    showUrgency={false}
                    isHighlighted={task.id === recentlyDroppedId}
                  />
                </div>
              );
            })}
            {/* Drop indicator at the end if dropping after all items */}
            {dropTargetIndex !== null && dropTargetIndex >= tasks.filter(t => t.id !== activeId).length && (
              <div className="px-2 py-1">
                <div className="h-12 border-2 border-dashed border-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20" />
              </div>
            )}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
