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
import { ChevronRight } from 'lucide-react';
import { TasksControls, type GroupMode } from './TasksControls';
import { TaskFeed } from './TaskFeed';
import { TaskDetailSheet, type SheetFocusMode } from './TaskDetailSheet';
import { EventLinkPopover } from './EventLinkPopover';
import { useTaskActions } from './useTaskActions';
import { ToastContainer, useToast } from '../common';
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
  /** Hide search when showControls is true */
  hideSearch?: boolean;
  /** Hide group by dropdown when showControls is true */
  hideGroupBy?: boolean;
  /** Click task opens detail sheet */
  showDetailSheet?: boolean;
  /** Enable inline task creation */
  enableInlineCreate?: boolean;
  /** Enable drag-and-drop reordering */
  enableDragDrop?: boolean;

  // Display options
  /** Initial grouping mode */
  defaultGroupBy?: GroupMode;
  /** Show case name on each task row */
  showCase?: boolean;
  /** Maximum number of tasks to display (for preview/compact views) */
  maxItems?: number;
  /** Compact mode - tighter spacing, smaller empty state */
  compact?: boolean;
  /** Controlled show done state (external control) */
  showDone?: boolean;
  /** Callback when show done changes (for controlled mode) */
  onShowDoneChange?: (showDone: boolean) => void;

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
  hideSearch = false,
  hideGroupBy = false,
  showDetailSheet = true,
  enableInlineCreate = false,
  enableDragDrop = false,

  // Display
  defaultGroupBy = 'date',
  showCase = true,
  maxItems,
  compact = false,
  showDone: controlledShowDone,
  onShowDoneChange,

  // Callbacks
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
}: TasksComponentProps) {
  // Local UI state
  const [groupBy, setGroupBy] = useState<GroupMode>(defaultGroupBy);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalShowDone, setInternalShowDone] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Support both controlled and uncontrolled modes for showDone
  const isControlled = controlledShowDone !== undefined;
  const showDoneTasks = isControlled ? controlledShowDone : internalShowDone;
  const setShowDoneTasks = isControlled
    ? (value: boolean) => onShowDoneChange?.(value)
    : setInternalShowDone;
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

  // Fetch tasks based on props
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: caseId
      ? ['tasks', { case_id: caseId, showDone: showDoneTasks }]
      : ['tasks', { showDone: showDoneTasks }],
    queryFn: () => {
      const params: Parameters<typeof getTasks>[0] = { limit: 100 };
      if (caseId) {
        params.case_id = caseId;
      }
      if (showDoneTasks) {
        params.status = 'Done';
      } else {
        params.exclude_status = 'Done';
      }
      return getTasks(params);
    },
    enabled: showAllTasks || !!caseId,
  });

  // Use our unified hook for all task actions
  const { markDone, deleteTask } = useTaskActions({
    invalidateKeys,
  });

  const allTasks = fetchedData?.tasks || [];

  // Filter tasks by search query
  const tasks = useMemo(() => {
    if (!searchQuery.trim()) return allTasks;
    const query = searchQuery.toLowerCase();
    return allTasks.filter(
      (task) =>
        task.description.toLowerCase().includes(query) ||
        task.case_name?.toLowerCase().includes(query) ||
        task.short_name?.toLowerCase().includes(query)
    );
  }, [allTasks, searchQuery]);

  // Handle marking done with toast and undo support
  const handleMarkDone = useCallback(
    async (taskId: number) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Store previous state for undo
      previousStates.current.set(taskId, task.status);

      // Mark as done
      await markDone(taskId);

      // Notify parent
      onTaskUpdated?.({ ...task, status: 'Done' });

      // Show toast with undo
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
    },
    [tasks, markDone, showToast, queryClient, caseId, onTaskUpdated]
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
      const result = await updateTask(taskId, { due_date: date ?? undefined });
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
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
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
          showDone={showDoneTasks}
          onShowDoneChange={setShowDoneTasks}
          hideSearch={hideSearch}
          hideGroupBy={hideGroupBy}
        />
      )}

      {/* Task Feed */}
      <TaskFeed
          tasks={tasks}
          isLoading={isLoading}
          showCase={showCase}
          sortable={enableDragDrop}
          groupBy={groupBy}
          maxItems={maxItems}
          compact={compact}
          emptyMessage={showDoneTasks ? 'No completed tasks' : 'No active tasks'}
          onDelete={handleDeleteTask}
          onMarkDone={handleMarkDone}
          onTaskClick={handleTaskClick}
          onEditClick={handleEditClick}
          onDateChange={handleDateChange}
          onCommentClick={handleCommentClick}
          onEventLinkClick={handleEventLinkClick}
          onPriorityChange={handlePriorityChange}
          enableInlineEdit={!compact}
          onInlineEditSave={handleInlineEditSave}
          enableInlineCreate={enableInlineCreate && !compact}
          onInlineCreateSave={handleInlineCreateSave}
        />

      {/* Task Detail Sheet */}
      {showDetailSheet && (
        <TaskDetailSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={handleCloseDetail}
          onMarkDone={handleMarkDone}
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
