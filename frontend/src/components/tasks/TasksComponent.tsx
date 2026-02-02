/**
 * TasksComponent - Self-contained, modular task list component
 *
 * Fully autonomous - fetches and manages its own data. Handles:
 * - Data fetching (by caseId or all tasks)
 * - Filtering, search, and grouping
 * - Task detail sheet
 * - Inline creation and editing
 * - Mark done with undo toast
 *
 * Usage:
 *   <TasksComponent showAllTasks showControls showDetailSheet />
 *   <TasksComponent caseId={123} showControls showDetailSheet />
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, CheckSquare } from 'lucide-react';
import { TasksControls, type GroupMode } from './TasksControls';
import { TaskFeed } from './TaskFeed';
import { TaskDetailSheet, type SheetFocusMode } from './TaskDetailSheet';
import { EventLinkPopover } from './EventLinkPopover';
import { useTaskActions } from './useTaskActions';
import { ToastContainer, useToast } from '../common';
import { DEFAULT_STATUS_FILTER } from './statusConfig';
import { getTasks, updateTask, createTask } from '../../api';
import type { Task, TaskStatus } from '../../types';

interface TasksComponentProps {
  // Data source (one of these):
  /** Fetch tasks for a specific case */
  caseId?: number;
  /** Fetch all tasks */
  showAllTasks?: boolean;

  // Header options
  /** Optional title to display in header */
  title?: string;
  /** Optional "View all" link URL */
  viewAllLink?: string;

  // Feature flags
  /** Show search, View dropdown, Done toggle */
  showControls?: boolean;
  /** Hide group by dropdown when showControls is true */
  hideGroupBy?: boolean;
  /** Click task opens detail sheet */
  showDetailSheet?: boolean;
  /** Enable inline task creation */
  enableInlineCreate?: boolean;
  /** Enable drag-and-drop reordering */
  enableDragDrop?: boolean;

  // Display options
  /** Initial grouping mode (uncontrolled) */
  defaultGroupBy?: GroupMode;
  /** Controlled grouping mode (external control) */
  groupBy?: GroupMode;
  /** Callback when group by changes (for controlled mode) */
  onGroupByChange?: (groupBy: GroupMode) => void;
  /** Show case name on each task row */
  showCase?: boolean;
  /** Maximum number of tasks to display (for preview/compact views) */
  maxItems?: number;
  /** Compact mode - tighter spacing, smaller empty state */
  compact?: boolean;
  /** Controlled status filter (external control) */
  statusFilter?: TaskStatus[];
  /** Callback when status filter changes (for controlled mode) */
  onStatusFilterChange?: (statuses: TaskStatus[]) => void;

  // Callbacks (for parent notification, optional)
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: number) => void;
}

export function TasksComponent({
  // Data
  caseId,
  showAllTasks = false,

  // Header
  title,
  viewAllLink,

  // Features
  showControls = true,
  hideGroupBy = false,
  showDetailSheet = true,
  enableInlineCreate = false,
  enableDragDrop = false,

  // Display
  defaultGroupBy = 'date',
  groupBy: controlledGroupBy,
  onGroupByChange,
  showCase = true,
  maxItems,
  compact = false,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,

  // Callbacks
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
}: TasksComponentProps) {
  // Local UI state
  const [internalGroupBy, setInternalGroupBy] = useState<GroupMode>(defaultGroupBy);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalStatusFilter, setInternalStatusFilter] = useState<TaskStatus[]>(DEFAULT_STATUS_FILTER);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Support both controlled and uncontrolled modes for groupBy
  const isGroupByControlled = controlledGroupBy !== undefined;
  const groupBy = isGroupByControlled ? controlledGroupBy : internalGroupBy;
  const setGroupBy = isGroupByControlled
    ? (value: GroupMode) => onGroupByChange?.(value)
    : setInternalGroupBy;

  // Support both controlled and uncontrolled modes for status filter
  const isStatusFilterControlled = controlledStatusFilter !== undefined;
  const statusFilter = isStatusFilterControlled ? controlledStatusFilter : internalStatusFilter;
  const setStatusFilter = isStatusFilterControlled
    ? (value: TaskStatus[]) => onStatusFilterChange?.(value)
    : setInternalStatusFilter;
  const [sheetFocusMode, setSheetFocusMode] = useState<SheetFocusMode>(null);
  const [eventLinkTask, setEventLinkTask] = useState<Task | null>(null);
  const [eventLinkAnchor, setEventLinkAnchor] = useState<HTMLElement | null>(null);

  const { toasts, showToast, dismissToast } = useToast();
  const queryClient = useQueryClient();

  // Track previous task states for undo (taskId -> previous status)
  const previousStates = useRef<Map<number, TaskStatus>>(new Map());

  // Build invalidation keys based on context
  const invalidateKeys: string[][] = [];
  if (caseId) {
    invalidateKeys.push(['case', String(caseId)]);
  }

  // Fetch all tasks (filtering is done client-side)
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: caseId
      ? ['tasks', { case_id: caseId }]
      : ['tasks'],
    queryFn: () => {
      const params: Parameters<typeof getTasks>[0] = { limit: 100 };
      if (caseId) {
        params.case_id = caseId;
      }
      // Fetch all statuses - filtering is done client-side
      return getTasks(params);
    },
    enabled: showAllTasks || !!caseId,
  });

  // Use our unified hook for all task actions
  const { markDone, deleteTask } = useTaskActions({
    invalidateKeys,
  });

  const allTasks = fetchedData?.tasks || [];

  // Filter tasks by status and search query
  const tasks = useMemo(() => {
    let filtered = allTasks;

    // Filter by status
    filtered = filtered.filter((task) => statusFilter.includes(task.status));

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.description.toLowerCase().includes(query) ||
          task.case_name?.toLowerCase().includes(query) ||
          task.short_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allTasks, statusFilter, searchQuery]);

  // Handle status change with toast and undo support for Done
  const handleStatusChange = useCallback(
    async (taskId: number, newStatus: TaskStatus) => {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      // Store previous state for undo
      previousStates.current.set(taskId, task.status);

      // Update status
      if (newStatus === 'Done') {
        await markDone(taskId);
      } else {
        await updateTask(taskId, { status: newStatus });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        if (caseId) {
          queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
        }
      }

      // Notify parent
      onTaskUpdated?.({ ...task, status: newStatus });

      // Show toast with undo only when marking as Done
      if (newStatus === 'Done') {
        showToast({
          message: '1 task completed',
          onUndo: async () => {
            const prevStatus = previousStates.current.get(taskId);
            if (prevStatus) {
              await updateTask(taskId, { status: prevStatus });
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              if (caseId) {
                queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
              }
              previousStates.current.delete(taskId);
            }
          },
        });
      }
    },
    [allTasks, markDone, showToast, queryClient, caseId, onTaskUpdated]
  );

  // Handle marking a done task back to pending
  const handleMarkPending = useCallback(
    async (taskId: number) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Set status back to Pending
      await updateTask(taskId, { status: 'Pending' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
      }

      // Notify parent
      onTaskUpdated?.({ ...task, status: 'Pending' });

      // Show toast
      showToast({
        message: 'Task restored',
      });
    },
    [tasks, showToast, queryClient, caseId, onTaskUpdated]
  );

  const handleTaskClick = (task: Task) => {
    if (showDetailSheet) {
      setSheetFocusMode(null);
      setSelectedTask(task);
    }
  };

  const handleEditClick = (task: Task) => {
    if (showDetailSheet) {
      setSheetFocusMode('title');
      setSelectedTask(task);
    }
  };

  const handleInlineEditSave = useCallback(
    async (
      taskId: number,
      updates: { description?: string; due_date?: string; urgency?: number }
    ) => {
      const result = await updateTask(taskId, updates);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
      }
      onTaskUpdated?.(result.task);
    },
    [queryClient, caseId, onTaskUpdated]
  );

  const handleDateChange = useCallback(
    async (taskId: number, date: string | null) => {
      const result = await updateTask(taskId, { due_date: date });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
      }
      onTaskUpdated?.(result.task);
    },
    [queryClient, caseId, onTaskUpdated]
  );

  const handlePriorityChange = useCallback(
    async (taskId: number, priority: number) => {
      const result = await updateTask(taskId, { urgency: priority });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
      }
      onTaskUpdated?.(result.task);
    },
    [queryClient, caseId, onTaskUpdated]
  );

  const handleCommentClick = (task: Task) => {
    if (showDetailSheet) {
      setSheetFocusMode('comment');
      setSelectedTask(task);
    }
  };

  const handleEventLinkClick = (task: Task, event?: React.MouseEvent) => {
    setEventLinkTask(task);
    setEventLinkAnchor((event?.currentTarget as HTMLElement) || null);
  };

  const handleLinkEvent = useCallback(
    async (taskId: number, eventId: number | null) => {
      const result = await updateTask(taskId, { event_id: eventId });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
      }
      onTaskUpdated?.(result.task);
    },
    [queryClient, caseId, onTaskUpdated]
  );

  const handleCloseEventLink = () => {
    setEventLinkTask(null);
    setEventLinkAnchor(null);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
    setSheetFocusMode(null);
  };

  const handleUpdateTask = useCallback(
    async (taskId: number, updates: Partial<Task>) => {
      const result = await updateTask(taskId, updates);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
      }
      onTaskUpdated?.(result.task);
    },
    [queryClient, caseId, onTaskUpdated]
  );

  const handleDeleteTask = useCallback(
    async (taskId: number) => {
      await deleteTask(taskId);
      onTaskDeleted?.(taskId);
    },
    [deleteTask, onTaskDeleted]
  );

  const handleInlineCreateSave = useCallback(
    async (data: {
      case_id: number;
      description: string;
      due_date?: string;
      urgency?: number;
      status?: string;
    }) => {
      // If we have a caseId prop and the data doesn't specify one, use the prop
      const createData = caseId && !data.case_id ? { ...data, case_id: caseId } : data;
      const result = await createTask(createData);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (createData.case_id) {
        queryClient.invalidateQueries({
          queryKey: ['case', String(createData.case_id)],
        });
      }
      onTaskCreated?.(result.task);
    },
    [queryClient, caseId, onTaskCreated]
  );

  // Navigation between tasks in the detail sheet
  const selectedTaskIndex = selectedTask
    ? tasks.findIndex((t) => t.id === selectedTask.id)
    : -1;
  const hasPrevTask = selectedTaskIndex > 0;
  const hasNextTask = selectedTaskIndex >= 0 && selectedTaskIndex < tasks.length - 1;

  const handlePrevTask = () => {
    if (hasPrevTask) {
      setSelectedTask(tasks[selectedTaskIndex - 1]);
    }
  };

  const handleNextTask = () => {
    if (hasNextTask) {
      setSelectedTask(tasks[selectedTaskIndex + 1]);
    }
  };

  return (
    <>
      {/* Header */}
      {(title || viewAllLink) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h2 className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <CheckSquare className="w-4 h-4 text-slate-400" />
              <span className="font-semibold">{title}</span>
              <span className="font-normal text-slate-400">({tasks.length})</span>
            </h2>
          )}
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <TasksControls
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          hideGroupBy={hideGroupBy}
          hideCaseGrouping={!!caseId}
        />
      )}

      {/* Task Feed */}
      <TaskFeed
          tasks={tasks}
          isLoading={isLoading}
          caseId={caseId}
          showCase={showCase}
          sortable={enableDragDrop}
          groupBy={groupBy}
          showDone={showDoneTasks}
          maxItems={maxItems}
          compact={compact}
          emptyMessage={statusFilter.length === 1 && statusFilter[0] === 'Done' ? 'No completed tasks' : 'No tasks match filters'}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onTaskClick={handleTaskClick}
          onEditClick={handleEditClick}
          onDateChange={handleDateChange}
          onCommentClick={handleCommentClick}
          onEventLinkClick={handleEventLinkClick}
          onPriorityChange={handlePriorityChange}
          enableInlineEdit
          onInlineEditSave={handleInlineEditSave}
          enableInlineCreate={enableInlineCreate}
          onInlineCreateSave={handleInlineCreateSave}
          defaultCreateStatus={showDoneTasks ? 'Done' : undefined}
        />

      {/* Task Detail Sheet */}
      {showDetailSheet && (
        <TaskDetailSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={handleCloseDetail}
          onStatusChange={handleStatusChange}
          onUpdate={handleUpdateTask}
          onLinkEvent={handleLinkEvent}
          onDelete={handleDeleteTask}
          onPrevTask={handlePrevTask}
          onNextTask={handleNextTask}
          hasPrevTask={hasPrevTask}
          hasNextTask={hasNextTask}
          initialFocus={sheetFocusMode}
        />
      )}

      {/* Event Link Popover */}
      {eventLinkTask && (
        <EventLinkPopover
          task={eventLinkTask}
          isOpen={!!eventLinkTask}
          anchorEl={eventLinkAnchor}
          onClose={handleCloseEventLink}
          onLinkEvent={handleLinkEvent}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
