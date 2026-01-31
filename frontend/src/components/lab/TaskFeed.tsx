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
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Loader2, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { TaskItem, TaskItemOverlay } from './TaskItem';
import { TaskInlineEdit } from './TaskInlineEdit';
import { TaskInlineCreate } from './TaskInlineCreate';
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
  /** Callback when edit button is clicked (opens modal) - if not set, uses inline edit */
  onEditClick?: (task: Task) => void;
  /** Callback when date changes (inline date picker) */
  onDateChange?: (taskId: number, date: string | null) => void;
  /** Callback when comment button is clicked */
  onCommentClick?: (task: Task) => void;
  /** Callback when event link button is clicked */
  onEventLinkClick?: (task: Task, event: React.MouseEvent) => void;
  /** Callback when priority changes */
  onPriorityChange?: (taskId: number, priority: number) => void;
  /** Callback when tasks are reordered via drag-and-drop */
  onReorder?: (taskId: number, newIndex: number, tasks: Task[]) => void;
  /** Callback when "Add task" is clicked for a section */
  onAddTask?: (dueDate?: string, caseId?: number) => void;
  /** Callback when task is updated via inline edit */
  onInlineEditSave?: (taskId: number, updates: { description?: string; due_date?: string; urgency?: number }) => Promise<void>;
  /** Enable inline editing when edit button is clicked (instead of using onEditClick) */
  enableInlineEdit?: boolean;
  /** Callback when a new task is created via inline form */
  onInlineCreateSave?: (data: { case_id: number; description: string; due_date?: string; urgency?: number }) => Promise<void>;
  /** Enable inline task creation (instead of calling onAddTask) */
  enableInlineCreate?: boolean;
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
 * Group tasks by due date, sorting within each group by urgency
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

  // Add overdue section first (sorted by urgency, then by date oldest first)
  if (overdueTasks.length > 0) {
    result.push({
      key: 'overdue',
      label: 'Overdue',
      date: null,
      tasks: sortTasksByUrgencyAndDate(overdueTasks),
      isOverdue: true,
      isCollapsible: true,
    });
  }

  // Add date groups sorted by date, tasks within sorted by urgency
  const sortedGroups = Array.from(groups.values())
    .sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return a.date.getTime() - b.date.getTime();
    })
    .map(group => ({
      ...group,
      tasks: sortTasksByUrgency(group.tasks),
    }));
  result.push(...sortedGroups);

  // Add no-date section at the end (sorted by urgency)
  if (noDateTasks.length > 0) {
    result.push({
      key: 'no-date',
      label: 'No due date',
      date: null,
      tasks: sortTasksByUrgency(noDateTasks),
    });
  }

  return result;
}

/**
 * Group tasks by case (alphabetically), sorting within each group by urgency then date
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

  // Sort groups alphabetically by case name, tasks within by urgency then date
  return Array.from(groups.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(group => ({
      ...group,
      tasks: sortTasksByUrgencyAndDate(group.tasks),
    }));
}

/**
 * Sort tasks by urgency only (high to low)
 */
function sortTasksByUrgency(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.urgency - a.urgency);
}

/**
 * Sort tasks by urgency (high to low), then by date (earliest first)
 */
function sortTasksByUrgencyAndDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // First sort by urgency (descending - higher urgency first)
    if (b.urgency !== a.urgency) {
      return b.urgency - a.urgency;
    }
    // Then by due date (ascending - earlier dates first, no date last)
    if (a.due_date && b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return 0;
  });
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
  onDateChange,
  onCommentClick,
  onEventLinkClick,
  onPriorityChange,
  onReorder,
  onAddTask,
  onInlineEditSave,
  enableInlineEdit = false,
  onInlineCreateSave,
  enableInlineCreate = false,
}: TaskFeedProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [recentlyDroppedId, setRecentlyDroppedId] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<number>>(new Set());
  const [inlineEditTaskId, setInlineEditTaskId] = useState<number | null>(null);
  const [inlineCreateContext, setInlineCreateContext] = useState<{ groupKey: string; dueDate?: string; caseId?: number } | null>(null);

  // Handle marking a task as done with animation
  const handleMarkDone = useCallback((taskId: number) => {
    // Start animation immediately
    setCompletingTaskIds(prev => new Set(prev).add(taskId));

    // After animation completes, trigger the actual callback
    setTimeout(() => {
      if (onMarkDone) {
        onMarkDone(taskId);
      }
      // Clean up (the task will be removed from list after refetch anyway)
      setCompletingTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, 400); // Match the CSS animation duration
  }, [onMarkDone]);

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
          tasks: sortTasksByUrgencyAndDate(tasks),
        }];
    }
  }, [tasks, groupBy]);

  // Hide case column when grouping by case (redundant info)
  const effectiveShowCase = showCase && groupBy !== 'case';

  // dnd-kit sensors - PointerSensor for mouse, TouchSensor for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
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

  // Handle edit button click - either start inline edit or call external handler
  const handleEditClick = useCallback((task: Task) => {
    if (enableInlineEdit) {
      setInlineEditTaskId(task.id);
    } else if (onEditClick) {
      onEditClick(task);
    }
  }, [enableInlineEdit, onEditClick]);

  // Handle inline edit save
  const handleInlineEditSave = useCallback(async (
    taskId: number,
    updates: { description?: string; due_date?: string; urgency?: number }
  ) => {
    if (onInlineEditSave) {
      await onInlineEditSave(taskId, updates);
    }
    setInlineEditTaskId(null);
  }, [onInlineEditSave]);

  // Handle inline edit cancel
  const handleInlineEditCancel = useCallback(() => {
    setInlineEditTaskId(null);
  }, []);

  // Handle add task button click - show inline form or call external handler
  const handleAddTaskClick = useCallback((groupKey: string, dueDate?: string, caseId?: number) => {
    if (enableInlineCreate) {
      setInlineCreateContext({ groupKey, dueDate, caseId });
    } else if (onAddTask) {
      onAddTask(dueDate, caseId);
    }
  }, [enableInlineCreate, onAddTask]);

  // Handle inline create save
  const handleInlineCreateSave = useCallback(async (
    data: { case_id: number; description: string; due_date?: string; urgency?: number }
  ) => {
    if (onInlineCreateSave) {
      await onInlineCreateSave(data);
    }
    setInlineCreateContext(null);
  }, [onInlineCreateSave]);

  // Handle inline create cancel
  const handleInlineCreateCancel = useCallback(() => {
    setInlineCreateContext(null);
  }, []);

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
        {inlineCreateContext?.groupKey === 'empty' ? (
          <TaskInlineCreate
            onSave={handleInlineCreateSave}
            onCancel={handleInlineCreateCancel}
          />
        ) : (onAddTask || enableInlineCreate) && (
          <AddTaskButton onClick={() => handleAddTaskClick('empty')} />
        )}
      </div>
    );
  }

  const allTaskIds = tasks.map((t) => t.id);

  const renderTaskList = (groupTasks: Task[], showDragHandle: boolean) => (
    <>
      {groupTasks.map((task) => {
        // Render inline edit form if this task is being edited
        if (inlineEditTaskId === task.id) {
          return (
            <TaskInlineEdit
              key={task.id}
              task={task}
              showCase={effectiveShowCase}
              onSave={handleInlineEditSave}
              onCancel={handleInlineEditCancel}
              onEventLinkClick={onEventLinkClick}
            />
          );
        }

        return (
          <TaskItem
            key={task.id}
            task={task}
            showCase={effectiveShowCase}
            showDragHandle={showDragHandle}
            isHighlighted={task.id === recentlyDroppedId}
            isCompleting={completingTaskIds.has(task.id)}
            onDelete={handleDeleteClick}
            onMarkDone={onMarkDone ? () => handleMarkDone(task.id) : undefined}
            onClick={onTaskClick}
            onEdit={handleEditClick}
            onDateChange={onDateChange}
            onCommentClick={onCommentClick}
            onEventLinkClick={onEventLinkClick}
            onPriorityChange={onPriorityChange}
          />
        );
      })}
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

                {/* Inline create form or Add task button */}
                {inlineCreateContext?.groupKey === group.key ? (
                  <TaskInlineCreate
                    caseId={inlineCreateContext.caseId}
                    dueDate={inlineCreateContext.dueDate}
                    onSave={handleInlineCreateSave}
                    onCancel={handleInlineCreateCancel}
                  />
                ) : (onAddTask || enableInlineCreate) && (
                  <AddTaskButton onClick={() => handleAddTaskClick(group.key, group.date?.toISOString().split('T')[0], group.caseId)} />
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
