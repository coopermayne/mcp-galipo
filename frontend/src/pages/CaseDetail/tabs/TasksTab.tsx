import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent, UniqueIdentifier } from '@dnd-kit/core';
import { Plus, ChevronDown, ChevronUp, Eye, EyeOff, LayoutGrid, Calendar } from 'lucide-react';
import { ConfirmModal } from '../../../components/common';
import { SortableTaskRow } from '../../../components/tasks';
import { createTask, updateTask, deleteTask, reorderTask } from '../../../api';
import type { Task, Constants } from '../../../types';
import { DroppableTaskGroup } from '../components';
import { urgencyConfig, dateGroupConfig } from '../utils';

type TaskViewMode = 'by-urgency' | 'by-date';

interface TasksTabProps {
  caseId: number;
  tasks: Task[];
  constants: Constants | undefined;
}

export function TasksTab({ caseId, tasks, constants }: TasksTabProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<TaskViewMode>('by-urgency');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(
    null
  );
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overContainer, setOverContainer] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number>(0);
  const [recentlyDroppedId, setRecentlyDroppedId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const createMutation = useMutation({
    mutationFn: (data: { description: string; urgency?: number; due_date?: string }) =>
      createTask({ case_id: caseId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskText('');
      setAddingToGroup(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({
      taskId,
      sortOrder,
      urgency,
    }: {
      taskId: number;
      sortOrder: number;
      urgency?: number;
    }) => reorderTask(taskId, sortOrder, urgency),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const taskStatusOptions = useMemo(
    () => (constants?.task_statuses || []).map((s: string) => ({ value: s, label: s })),
    [constants]
  );

  const urgencyOptions = [
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2 - Medium' },
    { value: '3', label: '3 - High' },
    { value: '4', label: '4 - Urgent' },
  ];

  // Filter tasks based on done toggle
  const filteredTasks = useMemo(() => {
    if (showDoneTasks) {
      return tasks.filter(t => t.status === 'Done');
    }
    return tasks.filter(t => t.status !== 'Done');
  }, [tasks, showDoneTasks]);

  // Group tasks by urgency
  const tasksByUrgency = useMemo(() => {
    const groups: Record<number, Task[]> = { 4: [], 3: [], 2: [], 1: [] };
    filteredTasks.forEach((task) => {
      if (groups[task.urgency]) {
        groups[task.urgency].push(task);
      } else {
        groups[2].push(task);
      }
    });
    return groups;
  }, [filteredTasks]);

  // Group tasks by date (overdue, today, this week, next week, later, no date)
  const tasksByDate = useMemo(() => {
    const groups: Record<string, Task[]> = { overdue: [], today: [], thisWeek: [], nextWeek: [], later: [], noDate: [] };
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Calculate end of this week (Sunday)
    const endOfThisWeek = new Date(now);
    endOfThisWeek.setDate(now.getDate() + (7 - now.getDay()));
    const endOfThisWeekStr = endOfThisWeek.toISOString().split('T')[0];

    // Calculate end of next week
    const endOfNextWeek = new Date(endOfThisWeek);
    endOfNextWeek.setDate(endOfThisWeek.getDate() + 7);
    const endOfNextWeekStr = endOfNextWeek.toISOString().split('T')[0];

    filteredTasks.forEach((task) => {
      if (!task.due_date) {
        groups.noDate.push(task);
      } else if (task.due_date < todayStr) {
        groups.overdue.push(task);
      } else if (task.due_date === todayStr) {
        groups.today.push(task);
      } else if (task.due_date <= endOfThisWeekStr) {
        groups.thisWeek.push(task);
      } else if (task.due_date <= endOfNextWeekStr) {
        groups.nextWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    // Sort within each group by due_date (earliest first), with no-date tasks by urgency
    ['overdue', 'today', 'thisWeek', 'nextWeek', 'later'].forEach((key) => {
      groups[key].sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return 0;
      });
    });
    groups.noDate.sort((a, b) => b.urgency - a.urgency);

    return groups;
  }, [filteredTasks]);

  const toggleCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const handleUpdate = useCallback(
    async (taskId: number, field: string, value: unknown) => {
      await updateMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback((taskId: number, description: string) => {
    setDeleteTarget({ id: taskId, description });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  const handleAddToGroup = useCallback(
    (groupKey: string) => {
      if (!newTaskText.trim()) return;
      if (view === 'by-urgency') {
        createMutation.mutate({ description: newTaskText.trim(), urgency: parseInt(groupKey, 10) });
      } else {
        // By date view - set due_date based on group
        const today = new Date().toISOString().split('T')[0];
        let dueDate: string | undefined;
        if (groupKey === 'today') {
          dueDate = today;
        } else if (groupKey === 'later') {
          // Set to tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dueDate = tomorrow.toISOString().split('T')[0];
        }
        // overdue and noDate don't set a due date
        createMutation.mutate({ description: newTaskText.trim(), due_date: dueDate });
      }
    },
    [newTaskText, view, createMutation]
  );

  // Calculate new sort_order for insertion at a specific index
  const calculateSortOrderAtIndex = useCallback(
    (groupTasks: Task[], insertIndex: number): number => {
      if (groupTasks.length === 0) return 1000;
      if (insertIndex === 0) return (groupTasks[0]?.sort_order || 1000) - 500;
      if (insertIndex >= groupTasks.length)
        return (groupTasks[groupTasks.length - 1]?.sort_order || 0) + 1000;
      const prevTask = groupTasks[insertIndex - 1];
      const nextTask = groupTasks[insertIndex];
      return Math.floor(
        ((prevTask?.sort_order || 0) + (nextTask?.sort_order || (prevTask?.sort_order || 0) + 1000)) /
          2
      );
    },
    []
  );

  // Helper to get the date group key for a task
  const getDateGroupKey = useCallback((task: Task): string => {
    if (!task.due_date) return 'noDate';
    const todayStr = new Date().toISOString().split('T')[0];
    if (task.due_date < todayStr) return 'overdue';
    if (task.due_date === todayStr) return 'today';
    return 'later';
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const task = filteredTasks.find((t) => t.id === active.id);
      setActiveTask(task || null);
      setActiveId(active.id);
      if (task) {
        const container = view === 'by-urgency' ? String(task.urgency) : getDateGroupKey(task);
        setOverContainer(container);
        const groupTasks =
          view === 'by-urgency' ? tasksByUrgency[task.urgency] : tasksByDate[getDateGroupKey(task)];
        setOverIndex(groupTasks.findIndex((t) => t.id === task.id));
      }
    },
    [filteredTasks, view, tasksByUrgency, tasksByDate, getDateGroupKey]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const overId = over.id;
      const activeTaskItem = filteredTasks.find((t) => t.id === active.id);
      if (!activeTaskItem) return;

      let targetContainer: string | null = null;
      let targetIndex = 0;

      if (typeof overId === 'string' && overId.startsWith('group-')) {
        targetContainer = overId.replace('group-', '');
        const groupTasks =
          view === 'by-urgency'
            ? tasksByUrgency[parseInt(targetContainer, 10)] || []
            : tasksByDate[targetContainer] || [];
        targetIndex = groupTasks.filter((t) => t.id !== active.id).length;
      } else {
        const overTask = filteredTasks.find((t) => t.id === overId);
        if (overTask) {
          targetContainer = view === 'by-urgency' ? String(overTask.urgency) : getDateGroupKey(overTask);
          const groupTasks =
            view === 'by-urgency'
              ? tasksByUrgency[overTask.urgency] || []
              : tasksByDate[getDateGroupKey(overTask)] || [];
          const groupTasksFiltered = groupTasks.filter((t) => t.id !== active.id);
          const overTaskIndex = groupTasksFiltered.findIndex((t) => t.id === overId);
          targetIndex = overTaskIndex >= 0 ? overTaskIndex : groupTasksFiltered.length;
        }
      }

      if (
        targetContainer !== null &&
        (targetContainer !== overContainer || targetIndex !== overIndex)
      ) {
        setOverContainer(targetContainer);
        setOverIndex(targetIndex);
      }
    },
    [filteredTasks, view, tasksByUrgency, tasksByDate, getDateGroupKey, overContainer, overIndex]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active } = event;
      const finalContainer = overContainer;
      const finalIndex = overIndex;

      setActiveTask(null);
      setActiveId(null);
      setOverContainer(null);
      setOverIndex(0);

      if (!finalContainer) return;

      const activeTaskItem = filteredTasks.find((t) => t.id === active.id);
      if (!activeTaskItem) return;

      const targetTasks =
        view === 'by-urgency'
          ? (tasksByUrgency[parseInt(finalContainer, 10)] || []).filter((t) => t.id !== active.id)
          : (tasksByDate[finalContainer] || []).filter((t) => t.id !== active.id);

      const newSortOrder = calculateSortOrderAtIndex(targetTasks, finalIndex);

      // Highlight the dropped task
      setRecentlyDroppedId(activeTaskItem.id);
      setTimeout(() => setRecentlyDroppedId(null), 1500);

      if (view === 'by-urgency') {
        const newUrgency = parseInt(finalContainer, 10);
        const urgencyChanged = newUrgency !== activeTaskItem.urgency;
        reorderMutation.mutate({
          taskId: activeTaskItem.id,
          sortOrder: newSortOrder,
          urgency: urgencyChanged ? newUrgency : undefined,
        });
      } else {
        // By date view - only reorder within the group, don't change the date
        reorderMutation.mutate({
          taskId: activeTaskItem.id,
          sortOrder: newSortOrder,
        });
      }
    },
    [
      filteredTasks,
      view,
      tasksByUrgency,
      tasksByDate,
      overContainer,
      overIndex,
      calculateSortOrderAtIndex,
      reorderMutation,
    ]
  );

  const renderTaskGroup = (
    groupKey: string,
    groupTasks: Task[],
    config: { label?: string; color: string; bgColor: string }
  ) => {
    const isCollapsed = collapsedGroups.has(groupKey);
    const isAddingHere = addingToGroup === groupKey;
    const taskIds = groupTasks.filter((t) => t.id !== activeId).map((t) => t.id);
    const isDropTarget = overContainer === groupKey;

    return (
      <div key={groupKey} className="mb-4">
        {/* Group Header */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer select-none ${config.bgColor}`}
          onClick={() => toggleCollapse(groupKey)}
        >
          <button className="p-0.5">
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
          <span className={`text-sm font-semibold ${config.color}`}>
            {config.label || groupKey}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">({groupTasks.length})</span>
          <div className="flex-1" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddingToGroup(isAddingHere ? null : groupKey);
              setNewTaskText('');
            }}
            className="p-1 text-slate-500 hover:text-primary-500"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Add Form */}
        {isAddingHere && (
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border-x border-slate-200 dark:border-slate-700">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddToGroup(groupKey);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="New task description..."
                autoFocus
                className="flex-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
              />
              <button
                type="submit"
                disabled={createMutation.isPending || !newTaskText.trim()}
                className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAddingToGroup(null)}
                className="px-2 py-1.5 text-slate-500 text-sm"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Task List (collapsible) */}
        {!isCollapsed && (
          <DroppableTaskGroup
            groupKey={groupKey}
            tasks={groupTasks}
            taskIds={taskIds}
            activeId={activeId}
            dropTargetIndex={isDropTarget ? overIndex : null}
            taskStatusOptions={taskStatusOptions}
            urgencyOptions={urgencyOptions}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            showUrgency={view === 'by-date'}
            recentlyDroppedId={recentlyDroppedId}
          />
        )}
      </div>
    );
  };

  return (
    <>
      {/* View Toggle */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            onClick={() => setView('by-urgency')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'by-urgency'
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            By Urgency
          </button>
          <button
            onClick={() => setView('by-date')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === 'by-date'
                ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            By Date
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowDoneTasks(!showDoneTasks)}
          className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors ${
            showDoneTasks
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {showDoneTasks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          Done
        </button>
      </div>

      {/* Task Groups */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {view === 'by-urgency' ? (
          <div>
            {[4, 3, 2, 1].map((urgency) =>
              renderTaskGroup(String(urgency), tasksByUrgency[urgency], {
                label: `${urgency} - ${urgencyConfig[urgency].label}`,
                color: urgencyConfig[urgency].color,
                bgColor: urgencyConfig[urgency].bgColor,
              })
            )}
          </div>
        ) : (
          <div>
            {['overdue', 'today', 'thisWeek', 'nextWeek', 'later', 'noDate']
              .filter((dateKey) => dateKey !== 'overdue' || tasksByDate[dateKey]?.length > 0)
              .map((dateKey) =>
                renderTaskGroup(
                  dateKey,
                  tasksByDate[dateKey] || [],
                  dateGroupConfig[dateKey]
                )
              )}
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <div className="shadow-xl rounded-lg overflow-hidden bg-white dark:bg-slate-800 border border-primary-500">
              <SortableTaskRow
                task={activeTask}
                taskStatusOptions={taskStatusOptions}
                urgencyOptions={urgencyOptions}
                onUpdate={() => {}}
                onDelete={() => {}}
                showCaseBadge={false}
                showUrgency={view === 'by-date'}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete this task?`}
        confirmText="Delete Task"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
