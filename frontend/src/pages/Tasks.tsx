import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  rectIntersection,
  pointerWithin,
  getFirstCollision,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent, CollisionDetection, UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Header, PageContent } from '../components/layout';
import { ListPanel, ConfirmModal, StatusBadge, UrgencyBadge, EditableDate } from '../components/common';
import { UrgencyGroup, CaseGroup } from '../components/tasks';
import { formatSmartDate } from '../utils/dateFormat';
import { getTasks, getConstants, updateTask, deleteTask, reorderTask } from '../api';
import type { Task } from '../types';
import { Filter, Search, LayoutGrid, List, GripVertical } from 'lucide-react';

type ViewMode = 'by-urgency' | 'by-case';

export function Tasks() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [view, setView] = useState<ViewMode>('by-urgency');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Track the current drag state for cross-container preview
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overContainer, setOverContainer] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number>(0);
  const [recentlyDroppedId, setRecentlyDroppedId] = useState<number | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);

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
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2 - Medium' },
    { value: '3', label: '3 - High' },
    { value: '4', label: '4 - Urgent' },
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
    const groups: Record<number, Task[]> = { 4: [], 3: [], 2: [], 1: [] };
    filteredTasks.forEach((task) => {
      if (groups[task.urgency]) {
        groups[task.urgency].push(task);
      } else {
        groups[2].push(task); // Default to medium if invalid urgency
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

  // Calculate new sort_order for insertion at a specific index
  const calculateSortOrderAtIndex = useCallback((tasks: Task[], insertIndex: number): number => {
    if (tasks.length === 0) return 1000;

    // If inserting at the beginning
    if (insertIndex === 0) {
      return (tasks[0]?.sort_order || 1000) - 500;
    }

    // If inserting at the end
    if (insertIndex >= tasks.length) {
      return (tasks[tasks.length - 1]?.sort_order || 0) + 1000;
    }

    // Inserting between two items
    const prevTask = tasks[insertIndex - 1];
    const nextTask = tasks[insertIndex];
    return Math.floor(((prevTask?.sort_order || 0) + (nextTask?.sort_order || (prevTask?.sort_order || 0) + 1000)) / 2);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = filteredTasks.find((t) => t.id === active.id);
    setActiveTask(task || null);
    setActiveId(active.id);

    // Initialize over container to the task's current urgency
    if (task) {
      setOverContainer(task.urgency);
      const currentIndex = tasksByUrgency[task.urgency].findIndex((t) => t.id === task.id);
      setOverIndex(currentIndex);
    }
  }, [filteredTasks, tasksByUrgency]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;

    if (!over || view !== 'by-urgency') return;

    const overId = over.id;
    const activeTaskItem = filteredTasks.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    // Determine the target container
    let targetContainer: number | null = null;
    let targetIndex = 0;

    if (typeof overId === 'string' && overId.startsWith('urgency-')) {
      // Hovering over a container directly (empty area)
      targetContainer = parseInt(overId.replace('urgency-', ''), 10);
      // Put at end of container
      targetIndex = tasksByUrgency[targetContainer].filter((t) => t.id !== active.id).length;
    } else {
      // Hovering over a task
      const overTask = filteredTasks.find((t) => t.id === overId);
      if (overTask) {
        targetContainer = overTask.urgency;
        // Find the index of the task we're hovering over
        const containerTasks = tasksByUrgency[targetContainer].filter((t) => t.id !== active.id);
        const overTaskIndex = containerTasks.findIndex((t) => t.id === overId);
        targetIndex = overTaskIndex >= 0 ? overTaskIndex : containerTasks.length;
      }
    }

    if (targetContainer !== null) {
      // Only update if something changed
      if (targetContainer !== overContainer || targetIndex !== overIndex) {
        setOverContainer(targetContainer);
        setOverIndex(targetIndex);
      }
    }
  }, [filteredTasks, tasksByUrgency, view, overContainer, overIndex]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    // Get the final position before resetting state
    const finalContainer = overContainer;
    const finalIndex = overIndex;

    // Reset drag state
    setActiveTask(null);
    setActiveId(null);
    setOverContainer(null);
    setOverIndex(0);

    if (!over || finalContainer === null) return;

    const activeTaskItem = filteredTasks.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    // Highlight the dropped task
    setRecentlyDroppedId(activeTaskItem.id);
    setTimeout(() => setRecentlyDroppedId(null), 1500);

    if (view === 'by-urgency') {
      // Get the tasks in the target container (excluding the active task)
      const targetTasks = tasksByUrgency[finalContainer].filter((t) => t.id !== active.id);

      // Calculate the new sort order based on the final position
      const newSortOrder = calculateSortOrderAtIndex(targetTasks, finalIndex);

      // Determine if urgency changed
      const urgencyChanged = finalContainer !== activeTaskItem.urgency;

      reorderMutation.mutate({
        taskId: activeTaskItem.id,
        sortOrder: newSortOrder,
        urgency: urgencyChanged ? finalContainer : undefined,
      });
    } else {
      // By case view - handle within-case reordering
      const overId = over.id;
      if (typeof overId === 'number') {
        const overTask = filteredTasks.find((t) => t.id === overId);
        if (overTask && overTask.case_id === activeTaskItem.case_id) {
          const groupTasks = tasksByCase[activeTaskItem.case_id]?.tasks || [];
          const oldIndex = groupTasks.findIndex((t) => t.id === activeTaskItem.id);
          const newIndex = groupTasks.findIndex((t) => t.id === overTask.id);

          if (oldIndex !== newIndex) {
            const reorderedTasks = arrayMove(groupTasks, oldIndex, newIndex);
            const targetTasks = reorderedTasks.filter((t) => t.id !== activeTaskItem.id);
            const insertIdx = reorderedTasks.findIndex((t) => t.id === activeTaskItem.id);
            const newSortOrder = calculateSortOrderAtIndex(targetTasks, insertIdx);

            reorderMutation.mutate({
              taskId: activeTaskItem.id,
              sortOrder: newSortOrder,
            });
          }
        }
      }
    }
  }, [filteredTasks, view, tasksByUrgency, tasksByCase, overContainer, overIndex, calculateSortOrderAtIndex, reorderMutation]);

  // Custom collision detection that prefers items over containers
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First, try to find collisions with droppable items (tasks)
    const pointerCollisions = pointerWithin(args);
    const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

    // Get the first collision
    let overId = getFirstCollision(collisions, 'id');

    if (overId !== null) {
      // If we're over a container, check if there are items we could be over instead
      if (typeof overId === 'string' && overId.startsWith('urgency-')) {
        const containerItems = collisions.filter(
          (collision) => typeof collision.id === 'number'
        );
        if (containerItems.length > 0) {
          overId = containerItems[0].id;
        }
      }

      lastOverId.current = overId;
    }

    return collisions;
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
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            {view === 'by-urgency' ? (
              // Urgency View - groups from Urgent (4) to Low (1)
              <div>
                {[4, 3, 2, 1].map((urgency) => (
                  <UrgencyGroup
                    key={urgency}
                    urgency={urgency}
                    tasks={tasksByUrgency[urgency]}
                    activeId={activeId}
                    dropTargetIndex={overContainer === urgency ? overIndex : null}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    recentlyDroppedId={recentlyDroppedId}
                  />
                ))}
              </div>
            ) : (
              // Case View - grouped by case (sorted alphabetically by short_name)
              <div>
                {Object.entries(tasksByCase)
                  .sort(([, a], [, b]) => (a.shortName || a.caseName).localeCompare(b.shortName || b.caseName))
                  .map(([caseId, group]) => (
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
                    recentlyDroppedId={recentlyDroppedId}
                  />
                ))}
              </div>
            )}

            {/* Drag Overlay - shows the item being dragged */}
            <DragOverlay dropAnimation={null}>
              {activeTask && (
                <div className="shadow-xl rounded-lg overflow-hidden bg-white dark:bg-slate-800 px-4 py-3 flex items-center gap-3 border border-primary-500">
                  <div className="p-1 text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  {view === 'by-urgency' && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 w-20 truncate text-center">
                      {activeTask.short_name || activeTask.case_name}
                    </span>
                  )}
                  <div className="flex-1 min-w-0 text-sm text-slate-900 dark:text-slate-100">
                    {activeTask.description}
                  </div>
                  {activeTask.due_date && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatSmartDate(new Date(activeTask.due_date))}
                    </span>
                  )}
                  <StatusBadge status={activeTask.status} />
                  {view === 'by-case' && <UrgencyBadge urgency={activeTask.urgency} />}
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
