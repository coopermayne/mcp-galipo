/**
 * TaskFeed - Todoist-style task list with date grouping
 *
 * Groups tasks by due date (Overdue, Today, Tomorrow, future dates).
 * Supports drag-and-drop reordering within and between sections.
 */
import { useState, useCallback, useMemo } from 'react';
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
import { Loader2, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { TaskItem, TaskItemOverlay } from './TaskItem';
import { ConfirmModal } from '../common';
import type { Task } from '../../types';

type GroupMode = 'none' | 'date' | 'case';

interface TaskFeedProps {
  tasks: Task[];
  isLoading?: boolean;
  /** Show case/project on each row (auto-hidden when grouping by case) */
  showCase?: boolean;
  /** Enable drag-and-drop reordering */
  sortable?: boolean;
  /** How to group tasks: 'none' | 'date' | 'case' */
  groupBy?: GroupMode;
  /** Empty state message */
  emptyMessage?: string;
  /** Callback when task is deleted (after confirmation) */
  onDelete?: (taskId: number) => Promise<void>;
  /** Callback when task is marked done */
  onMarkDone?: (taskId: number) => Promise<void>;
  /** Callback when task row is clicked */
  onTaskClick?: (task: Task) => void;
  /** Callback when edit button is clicked */
  onEditClick?: (task: Task) => void;
  /** Callback when tasks are reordered via drag-and-drop */
  onReorder?: (taskId: number, newIndex: number, tasks: Task[]) => void;
  /** Callback when "Add task" is clicked for a section */
  onAddTask?: (dueDate?: string) => void;
}

interface DateGroup {
  key: string;
  label: string;
  sublabel?: string;
  date: Date | null;
  tasks: Task[];
  isOverdue?: boolean;
  isCollapsible?: boolean;
  caseId?: number;
}

/**
 * Format a date as "Jan 30 · Today · Friday"
 */
function formatSectionHeader(date: Date): { label: string; sublabel: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: `${dateStr} · Today · ${dayName}`, sublabel: '' };
  } else if (diffDays === 1) {
    return { label: `${dateStr} · Tomorrow · ${dayName}`, sublabel: '' };
  } else {
    return { label: `${dateStr} · ${dayName}`, sublabel: '' };
  }
}

/**
 * Group tasks by due date
 */
function groupTasksByDate(tasks: Task[]): DateGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups: Map<string, DateGroup> = new Map();
  const overdueTasks: Task[] = [];
  const noDateTasks: Task[] = [];

  for (const task of tasks) {
    if (!task.due_date) {
      noDateTasks.push(task);
      continue;
    }

    const dueDate = new Date(task.due_date + 'T00:00:00');
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      overdueTasks.push(task);
    } else {
      const key = task.due_date;
      if (!groups.has(key)) {
        const header = formatSectionHeader(dueDate);
        groups.set(key, {
          key,
          label: header.label,
          sublabel: header.sublabel,
          date: dueDate,
          tasks: [],
        });
      }
      groups.get(key)!.tasks.push(task);
    }
  }

  const result: DateGroup[] = [];

  // Add overdue section first
  if (overdueTasks.length > 0) {
    result.push({
      key: 'overdue',
      label: 'Overdue',
      date: null,
      tasks: overdueTasks,
      isOverdue: true,
      isCollapsible: true,
    });
  }

  // Add date groups sorted by date
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return a.date.getTime() - b.date.getTime();
  });
  result.push(...sortedGroups);

  // Add no-date section at the end
  if (noDateTasks.length > 0) {
    result.push({
      key: 'no-date',
      label: 'No due date',
      date: null,
      tasks: noDateTasks,
    });
  }

  return result;
}

/**
 * Group tasks by case (alphabetically)
 */
function groupTasksByCase(tasks: Task[]): DateGroup[] {
  const groups: Map<number, DateGroup> = new Map();

  for (const task of tasks) {
    const caseId = task.case_id;
    if (!groups.has(caseId)) {
      const caseName = task.case_name || task.short_name || `Case #${caseId}`;
      groups.set(caseId, {
        key: `case-${caseId}`,
        label: caseName,
        date: null,
        tasks: [],
        caseId,
      });
    }
    groups.get(caseId)!.tasks.push(task);
  }

  // Sort groups alphabetically by case name
  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

/**
 * Section header component (Todoist style)
 */
function SectionHeader({
  group,
  isCollapsed,
  onToggleCollapse,
  onReschedule,
}: {
  group: DateGroup;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onReschedule?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-2">
      <div className="flex items-center gap-2">
        {group.isCollapsible && (
          <button
            onClick={onToggleCollapse}
            className="p-0.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
        <h3 className={`text-sm font-semibold ${group.isOverdue ? 'text-slate-900 dark:text-slate-100' : 'text-slate-900 dark:text-slate-100'}`}>
          {group.label}
        </h3>
      </div>
      {group.isOverdue && onReschedule && (
        <button
          onClick={onReschedule}
          className="text-sm text-red-500 hover:text-red-600 font-medium"
        >
          Reschedule
        </button>
      )}
    </div>
  );
}

/**
 * Add task button (Todoist style)
 */
function AddTaskButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-2 w-full text-left text-sm text-red-500 hover:text-red-600 group"
    >
      <Plus className="w-4 h-4" />
      <span>Add task</span>
    </button>
  );
}

export function TaskFeed({
  tasks,
  isLoading = false,
  showCase = true,
  sortable = false,
  groupBy = 'date',
  emptyMessage = 'No tasks',
  onDelete,
  onMarkDone,
  onTaskClick,
  onEditClick,
  onReorder,
  onAddTask,
}: TaskFeedProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [recentlyDroppedId, setRecentlyDroppedId] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Group tasks based on groupBy mode
  const groups = useMemo(() => {
    switch (groupBy) {
      case 'date':
        return groupTasksByDate(tasks);
      case 'case':
        return groupTasksByCase(tasks);
      case 'none':
      default:
        return [{
          key: 'all',
          label: '',
          date: null,
          tasks,
        }];
    }
  }, [tasks, groupBy]);

  // Hide case column when grouping by case (redundant info)
  const effectiveShowCase = showCase && groupBy !== 'case';

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
      setRecentlyDroppedId(active.id as number);
      setTimeout(() => setRecentlyDroppedId(null), 1500);

      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
      onReorder(active.id as number, newIndex, reorderedTasks);
    }
  }, [tasks, onReorder]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8">
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          {emptyMessage}
        </div>
        {onAddTask && <AddTaskButton onClick={() => onAddTask()} />}
      </div>
    );
  }

  const allTaskIds = tasks.map((t) => t.id);

  const renderTaskList = (groupTasks: Task[], showDragHandle: boolean) => (
    <>
      {groupTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          showCase={effectiveShowCase}
          showDragHandle={showDragHandle}
          isHighlighted={task.id === recentlyDroppedId}
          onDelete={handleDeleteClick}
          onMarkDone={onMarkDone ? () => onMarkDone(task.id) : undefined}
          onClick={onTaskClick}
          onEdit={onEditClick}
        />
      ))}
    </>
  );

  const content = (
    <div>
      {groups.map((group) => {
        const isCollapsed = collapsedSections.has(group.key);

        return (
          <div key={group.key} className="mb-4">
            {/* Section header */}
            {group.label && (
              <>
                <SectionHeader
                  group={group}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={group.isCollapsible ? () => toggleSection(group.key) : undefined}
                />
                <div className="border-b border-slate-200 dark:border-slate-700 mx-2" />
              </>
            )}

            {/* Task list */}
            {!isCollapsed && (
              <>
                {sortable ? (
                  <SortableContext items={group.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {renderTaskList(group.tasks, true)}
                  </SortableContext>
                ) : (
                  renderTaskList(group.tasks, false)
                )}

                {/* Add task button per section */}
                {onAddTask && (
                  <AddTaskButton onClick={() => onAddTask(group.date?.toISOString().split('T')[0])} />
                )}
              </>
            )}
          </div>
        );
      })}
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
          <SortableContext items={allTaskIds} strategy={verticalListSortingStrategy}>
            {content}
          </SortableContext>
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
