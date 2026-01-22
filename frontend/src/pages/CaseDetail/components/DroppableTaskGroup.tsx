import { useDroppable } from '@dnd-kit/core';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskRow } from '../../../components/tasks';
import type { Task } from '../../../types';

interface DroppableTaskGroupProps {
  groupKey: string;
  tasks: Task[];
  taskIds: number[];
  activeId: UniqueIdentifier | null;
  dropTargetIndex: number | null;
  taskStatusOptions: { value: string; label: string }[];
  urgencyOptions: { value: string; label: string }[];
  onUpdate: (taskId: number, field: string, value: unknown) => Promise<void> | void;
  onDelete: (taskId: number, description: string) => void;
  showUrgency: boolean;
  recentlyDroppedId: number | null;
}

export function DroppableTaskGroup({
  groupKey,
  tasks,
  taskIds,
  activeId,
  dropTargetIndex,
  taskStatusOptions,
  urgencyOptions,
  onUpdate,
  onDelete,
  showUrgency,
  recentlyDroppedId,
}: DroppableTaskGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${groupKey}`,
    data: { type: 'group', groupKey },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-b-lg border border-t-0 border-slate-200 dark:border-slate-700 overflow-hidden
        ${isOver ? 'ring-2 ring-primary-500 ring-opacity-50' : ''}
        ${tasks.length === 0 ? 'min-h-[48px] bg-slate-50 dark:bg-slate-800/50' : ''}
      `}
    >
      {tasks.length === 0 && dropTargetIndex === null ? (
        <div className="flex items-center justify-center h-[48px] text-sm text-slate-400">
          Drop tasks here
        </div>
      ) : tasks.length === 0 && dropTargetIndex !== null ? (
        <div className="p-2">
          <div className="h-10 border-2 border-dashed border-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20" />
        </div>
      ) : (
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {tasks.map((task, index) => {
              const isActiveItem = activeId !== null && task.id === activeId;
              const visualIndex = tasks.slice(0, index).filter((t) => t.id !== activeId).length;
              const showDropIndicatorBefore =
                dropTargetIndex !== null && visualIndex === dropTargetIndex && !isActiveItem;

              if (isActiveItem) {
                return (
                  <div
                    key={task.id}
                    className="px-4 py-3 bg-slate-100 dark:bg-slate-700/50 border-2 border-dashed border-slate-300 dark:border-slate-600 opacity-40"
                  >
                    <div className="h-5" />
                  </div>
                );
              }

              return (
                <div key={task.id}>
                  {showDropIndicatorBefore && (
                    <div className="px-2 py-1">
                      <div className="h-10 border-2 border-dashed border-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20" />
                    </div>
                  )}
                  <SortableTaskRow
                    task={task}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    showCaseBadge={false}
                    showUrgency={showUrgency}
                    isHighlighted={task.id === recentlyDroppedId}
                  />
                </div>
              );
            })}
            {dropTargetIndex !== null &&
              dropTargetIndex >= tasks.filter((t) => t.id !== activeId).length && (
                <div className="px-2 py-1">
                  <div className="h-10 border-2 border-dashed border-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20" />
                </div>
              )}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
