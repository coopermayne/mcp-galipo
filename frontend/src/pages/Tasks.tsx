import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Header, PageContent } from '../components/layout';
import { ListPanel, ConfirmModal } from '../components/common';
import { UrgencyGroup, CaseGroup, SortableTaskRow } from '../components/tasks';
import { getTasks, getConstants, updateTask, deleteTask, reorderTask } from '../api/client';
import type { Task } from '../types';
import { Filter, Search, LayoutGrid, List } from 'lucide-react';

type ViewMode = 'by-urgency' | 'by-case';

export function Tasks() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [view, setView] = useState<ViewMode>('by-urgency');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', { status: statusFilter || undefined }],
    queryFn: () =>
      getTasks({
        status: statusFilter || undefined,
      }),
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, sortOrder, urgency }: { taskId: number; sortOrder: number; urgency?: number }) =>
      reorderTask(taskId, sortOrder, urgency),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const taskStatusOptions = useMemo(
    () =>
      (constants?.task_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  const urgencyOptions = [
    { value: '1', label: '1 - Lowest' },
    { value: '2', label: '2 - Low' },
    { value: '3', label: '3 - Medium' },
    { value: '4', label: '4 - High' },
    { value: '5', label: '5 - Critical' },
  ];

  const handleUpdate = useCallback(
    async (taskId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (taskId: number, description: string) => {
      setDeleteTarget({ id: taskId, description });
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!tasksData?.tasks) return [];

    if (!searchQuery) return tasksData.tasks;

    const query = searchQuery.toLowerCase();
    return tasksData.tasks.filter((task) =>
      task.description.toLowerCase().includes(query) ||
      (task.case_name && task.case_name.toLowerCase().includes(query)) ||
      (task.short_name && task.short_name.toLowerCase().includes(query))
    );
  }, [tasksData?.tasks, searchQuery]);

  // Group tasks by urgency (for "by urgency" view)
  const tasksByUrgency = useMemo(() => {
    const groups: Record<number, Task[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] };
    filteredTasks.forEach((task) => {
      if (groups[task.urgency]) {
        groups[task.urgency].push(task);
      } else {
        groups[3].push(task); // Default to medium if invalid urgency
      }
    });
    return groups;
  }, [filteredTasks]);

  // Group tasks by case (for "by case" view)
  const tasksByCase = useMemo(() => {
    const groups: Record<number, { caseName: string; shortName?: string; tasks: Task[] }> = {};
    filteredTasks.forEach((task) => {
      if (!groups[task.case_id]) {
        groups[task.case_id] = {
          caseName: task.case_name || `Case #${task.case_id}`,
          shortName: task.short_name,
          tasks: [],
        };
      }
      groups[task.case_id].tasks.push(task);
    });
    return groups;
  }, [filteredTasks]);

  // Calculate new sort_order for insertion between two tasks
  const calculateNewSortOrder = useCallback((tasks: Task[], oldIndex: number, newIndex: number): number => {
    if (tasks.length === 0) return 1000;

    // If moving to the beginning
    if (newIndex === 0) {
      return (tasks[0]?.sort_order || 1000) - 500;
    }

    // If moving to the end
    if (newIndex >= tasks.length) {
      return (tasks[tasks.length - 1]?.sort_order || 0) + 1000;
    }

    // Moving between two items
    const prevTask = tasks[newIndex - 1];
    const nextTask = tasks[newIndex];

    // Handle case where we're moving down (need to look at next item instead)
    if (oldIndex < newIndex) {
      return Math.floor(((nextTask?.sort_order || 0) + (tasks[newIndex + 1]?.sort_order || (nextTask?.sort_order || 0) + 1000)) / 2);
    }

    // Moving up - insert between prev and current position
    return Math.floor(((prevTask?.sort_order || 0) + (nextTask?.sort_order || (prevTask?.sort_order || 0) + 1000)) / 2);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = filteredTasks.find((t) => t.id === active.id);
    setActiveTask(task || null);
  }, [filteredTasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTask = filteredTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id;

    // Check if dropped on an urgency group
    if (typeof overId === 'string' && overId.startsWith('urgency-')) {
      const newUrgency = parseInt(overId.replace('urgency-', ''), 10);
      if (newUrgency !== activeTask.urgency) {
        // Get tasks in the target urgency group
        const targetTasks = tasksByUrgency[newUrgency] || [];
        // Place at the beginning of the new group
        const newSortOrder = targetTasks.length > 0
          ? (targetTasks[0]?.sort_order || 1000) - 500
          : 1000;

        reorderMutation.mutate({
          taskId: activeTask.id,
          sortOrder: newSortOrder,
          urgency: newUrgency,
        });
      }
      return;
    }

    // Check if dropped on another task (reordering within group)
    if (typeof overId === 'number') {
      const overTask = filteredTasks.find((t) => t.id === overId);
      if (!overTask) return;

      // Determine which group we're in
      if (view === 'by-urgency') {
        const groupTasks = tasksByUrgency[activeTask.urgency];
        const oldIndex = groupTasks.findIndex((t) => t.id === activeTask.id);
        const newIndex = groupTasks.findIndex((t) => t.id === overTask.id);

        if (oldIndex !== newIndex) {
          const reorderedTasks = arrayMove(groupTasks, oldIndex, newIndex);
          const newSortOrder = calculateNewSortOrder(reorderedTasks, oldIndex, newIndex);

          reorderMutation.mutate({
            taskId: activeTask.id,
            sortOrder: newSortOrder,
          });
        }
      } else {
        const groupTasks = tasksByCase[activeTask.case_id]?.tasks || [];
        const oldIndex = groupTasks.findIndex((t) => t.id === activeTask.id);
        const newIndex = groupTasks.findIndex((t) => t.id === overTask.id);

        if (oldIndex !== newIndex) {
          const reorderedTasks = arrayMove(groupTasks, oldIndex, newIndex);
          const newSortOrder = calculateNewSortOrder(reorderedTasks, oldIndex, newIndex);

          reorderMutation.mutate({
            taskId: activeTask.id,
            sortOrder: newSortOrder,
          });
        }
      }
    }
  }, [filteredTasks, view, tasksByUrgency, tasksByCase, calculateNewSortOrder, reorderMutation]);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback is handled by the UrgencyGroup component
  }, []);

  return (
    <>
      <Header
        title="Tasks"
        subtitle="Track your to-dos"
      />

      <PageContent>
        {/* Filters and View Toggle */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks or cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />

            {/* Status Filter */}
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 dark:text-slate-400">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="">All</option>
                {constants?.task_statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setView('by-urgency')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${view === 'by-urgency'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }
                `}
              >
                <LayoutGrid className="w-4 h-4" />
                By Urgency
              </button>
              <button
                onClick={() => setView('by-case')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${view === 'by-case'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }
                `}
              >
                <List className="w-4 h-4" />
                By Case
              </button>
            </div>
          </div>
        </ListPanel>

        {/* Task List */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : filteredTasks.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No tasks found" />
          </ListPanel>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            {view === 'by-urgency' ? (
              // Urgency View - groups from Critical (5) to Lowest (1)
              <div>
                {[5, 4, 3, 2, 1].map((urgency) => (
                  <UrgencyGroup
                    key={urgency}
                    urgency={urgency}
                    tasks={tasksByUrgency[urgency]}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              // Case View - grouped by case
              <div>
                {Object.entries(tasksByCase).map(([caseId, group]) => (
                  <CaseGroup
                    key={caseId}
                    caseId={parseInt(caseId)}
                    caseName={group.caseName}
                    shortName={group.shortName}
                    tasks={group.tasks}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Drag Overlay */}
            <DragOverlay>
              {activeTask && (
                <div className="shadow-xl rounded-lg overflow-hidden">
                  <SortableTaskRow
                    task={activeTask}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    showCaseBadge={view === 'by-urgency'}
                    showUrgency={view === 'by-case'}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </PageContent>

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
