/**
 * TaskFeed - Unified task list component with dnd-kit support
 *
 * Displays a list of tasks with consistent behavior everywhere.
 * Handles loading states, empty states, delete confirmation, and drag-and-drop.
 */
import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Loader2 } from 'lucide-react';
import { TaskItem, TaskItemOverlay } from './TaskItem';
import { ConfirmModal } from '../common';
import type { Task } from '../../types';

interface TaskFeedProps {
  tasks: Task[];
  isLoading?: boolean;
  /** Show case badge on each row */
  showCase?: boolean;
  /** Show urgency badge on each row */
  showUrgency?: boolean;
  /** Show delete button on each row */
  showDelete?: boolean;
  /** Show quick done button on each row */
  showQuickDone?: boolean;
  /** Enable drag-and-drop reordering */
  sortable?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Callback when any task field is updated */
  onUpdate?: (taskId: number, field: keyof Task, value: unknown) => Promise<void>;
  /** Callback when task is deleted (after confirmation) */
  onDelete?: (taskId: number) => Promise<void>;
  /** Callback when task is marked done */
  onMarkDone?: (taskId: number) => Promise<void>;
  /** Callback when task row is clicked */
  onTaskClick?: (task: Task) => void;
  /** Callback when tasks are reordered via drag-and-drop */
  onReorder?: (taskId: number, newIndex: number, tasks: Task[]) => void;
}

export function TaskFeed({
  tasks,
  isLoading = false,
  showCase = true,
  showUrgency = true,
  showDelete = true,
  showQuickDone = false,
  sortable = false,
  emptyMessage = 'No tasks',
  onUpdate,
  onDelete,
  onMarkDone,
  onTaskClick,
  onReorder,
}: TaskFeedProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [recentlyDroppedId, setRecentlyDroppedId] = useState<number | null>(null);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  const handleDeleteClick = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setDeleteTarget({ id: taskId, description: task.description });
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget && onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(deleteTarget.id);
      } finally {
        setIsDeleting(false);
        setDeleteTarget(null);
      }
    }
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
      // Highlight the dropped task
      setRecentlyDroppedId(active.id as number);
      setTimeout(() => setRecentlyDroppedId(null), 1500);

      // Call the reorder callback with the task ID and new position
      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
      onReorder(active.id as number, newIndex, reorderedTasks);
    }
  }, [tasks, onReorder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  const taskIds = tasks.map((t) => t.id);

  const content = (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {sortable ? (
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              showCase={showCase}
              showUrgency={showUrgency}
              showDelete={showDelete}
              showQuickDone={showQuickDone}
              showDragHandle={true}
              isHighlighted={task.id === recentlyDroppedId}
              onUpdate={onUpdate}
              onDelete={handleDeleteClick}
              onMarkDone={onMarkDone ? () => onMarkDone(task.id) : undefined}
              onClick={onTaskClick}
            />
          ))}
        </SortableContext>
      ) : (
        tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            showCase={showCase}
            showUrgency={showUrgency}
            showDelete={showDelete}
            showQuickDone={showQuickDone}
            showDragHandle={false}
            onUpdate={onUpdate}
            onDelete={handleDeleteClick}
            onMarkDone={onMarkDone ? () => onMarkDone(task.id) : undefined}
            onClick={onTaskClick}
          />
        ))
      )}
    </div>
  );

  return (
    <>
      {sortable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {content}
          <DragOverlay dropAnimation={null}>
            {activeTask && <TaskItemOverlay task={activeTask} />}
          </DragOverlay>
        </DndContext>
      ) : (
        content
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.description}"?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}
