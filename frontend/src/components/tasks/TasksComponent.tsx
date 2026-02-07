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
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
import { type AssigneeFilterValue } from './AssigneeFilterDropdown';
import { getTasks, updateTask, createTask, getCaseUsers, getUsers, rescheduleOverdueTasks } from '../../api';
import { useAuth } from '../../context/AuthContext';
import type { Task, TaskStatus, CaseStaffUser } from '../../types';

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
  /** Controlled search query (external control) */
  searchQuery?: string;
  /** Controlled assignee filter (external control) */
  assigneeFilter?: AssigneeFilterValue;
  /** Callback when assignee filter changes (for controlled mode) */
  onAssigneeFilterChange?: (value: AssigneeFilterValue) => void;
  /** Filter to tasks in cases assigned to this user ID */
  userId?: number;

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
  searchQuery: controlledSearchQuery,
  assigneeFilter: controlledAssigneeFilter,
  onAssigneeFilterChange,
  userId,

  // Callbacks
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
}: TasksComponentProps) {
  const { user: currentUser } = useAuth();

  // Local UI state
  const [internalGroupBy, setInternalGroupBy] = useState<GroupMode>(defaultGroupBy);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalStatusFilter, setInternalStatusFilter] = useState<TaskStatus[]>(DEFAULT_STATUS_FILTER);
  const [internalAssigneeFilter, setInternalAssigneeFilter] = useState<AssigneeFilterValue>(controlledAssigneeFilter ?? 'all');

  // Support both controlled and uncontrolled modes for searchQuery
  const searchQuery = controlledSearchQuery ?? internalSearchQuery;
  const setSearchQuery = controlledSearchQuery !== undefined ? () => {} : setInternalSearchQuery;
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

  // Support both controlled and uncontrolled modes for assignee filter
  const isAssigneeFilterControlled = controlledAssigneeFilter !== undefined;
  const assigneeFilter = isAssigneeFilterControlled ? controlledAssigneeFilter : internalAssigneeFilter;
  const setAssigneeFilter = isAssigneeFilterControlled
    ? (value: AssigneeFilterValue) => onAssigneeFilterChange?.(value)
    : setInternalAssigneeFilter;
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

  // Fetch all tasks (status/assignee filtering is done client-side)
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: caseId
      ? ['tasks', { case_id: caseId }]
      : ['tasks', { userId }],
    queryFn: () => {
      const params: Parameters<typeof getTasks>[0] = { limit: 100 };
      if (caseId) {
        params.case_id = caseId;
      }
      if (userId) {
        params.user_id = userId;
      }
      return getTasks(params);
    },
    enabled: showAllTasks || !!caseId,
  });

  // Fetch eligible assignees (case staff if caseId, otherwise all users)
  const { data: eligibleAssignees = [] } = useQuery({
    queryKey: caseId
      ? ['case-users', caseId]
      : ['users'],
    queryFn: async (): Promise<CaseStaffUser[]> => {
      if (caseId) {
        const caseUsers = await getCaseUsers(caseId);
        // Combine attorneys and paralegals into a single list
        return [...caseUsers.attorneys, ...caseUsers.paralegals];
      } else {
        // For the all-tasks view, fetch all active users
        const users = await getUsers();
        return users.map(u => ({
          id: u.id,
          email: u.email,
          first_name: u.firstName,
          last_name: u.lastName,
          initials: u.initials,
          position: u.position,
          paralegal_id: u.paralegalId ?? undefined,
        }));
      }
    },
    enabled: showAllTasks || !!caseId,
  });

  // Get paralegals for filter dropdown (attorneys see their paralegals)
  const paralegals = useMemo(() => {
    if (!currentUser) return [];
    // If current user is an attorney, show their assigned paralegal(s)
    // For now, just show all paralegals from eligible assignees
    return eligibleAssignees.filter(u => u.position === 'paralegal');
  }, [eligibleAssignees, currentUser]);

  // Use our unified hook for all task actions
  const { markDone, deleteTask } = useTaskActions({
    invalidateKeys,
  });

  const allTasks = fetchedData?.tasks || [];

  // Sync selectedTask with latest data after query refetch
  useEffect(() => {
    if (selectedTask) {
      const updated = allTasks.find((t) => t.id === selectedTask.id);
      if (updated) {
        setSelectedTask(updated);
      }
    }
  }, [allTasks]);

  // Filter tasks by status, search query, and assignee
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

    // Filter by assignee
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'mine') {
        filtered = filtered.filter((task) => task.assignee_id === currentUser?.id);
      } else if (assigneeFilter === 'unassigned') {
        filtered = filtered.filter((task) => task.assignee_id === null || task.assignee_id === undefined);
      } else if (typeof assigneeFilter === 'number') {
        filtered = filtered.filter((task) => task.assignee_id === assigneeFilter);
      }
    }

    return filtered;
  }, [allTasks, statusFilter, searchQuery, assigneeFilter, currentUser?.id]);

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
      updates: { description?: string; due_date?: string; urgency?: string }
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
    async (taskId: number, priority: string) => {
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
      urgency?: string;
      status?: TaskStatus;
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

  const handleRescheduleOverdue = useCallback(async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Capture overdue tasks before rescheduling (for undo)
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const overdueTasks = allTasks.filter((task) => {
      if (!task.due_date || task.status === 'Done') return false;
      const dueDate = new Date(task.due_date + 'T00:00:00');
      return dueDate < todayDate;
    });
    const previousDates = new Map(overdueTasks.map((t) => [t.id, t.due_date]));

    const result = await rescheduleOverdueTasks(today);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    if (caseId) {
      queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
    }
    if (result.updated > 0) {
      showToast({
        message: `${result.updated} task${result.updated === 1 ? '' : 's'} rescheduled to today`,
        onUndo: async () => {
          // Restore original due dates
          for (const [taskId, originalDate] of previousDates) {
            await updateTask(taskId, { due_date: originalDate });
          }
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          if (caseId) {
            queryClient.invalidateQueries({ queryKey: ['case', String(caseId)] });
          }
        },
      });
    }
  }, [queryClient, caseId, showToast, allTasks]);

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
            <h2 className="flex items-center gap-2 text-text">
              <CheckSquare className="w-4 h-4 text-text-muted" />
              <span className="font-semibold">{title}</span>
              <span className="font-normal text-text-muted">({tasks.length})</span>
            </h2>
          )}
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
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
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          paralegals={paralegals}
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
          showDone={statusFilter.includes('Done')}
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
          defaultCreateStatus={statusFilter.length === 1 && statusFilter[0] === 'Done' ? 'Done' : undefined}
          onRescheduleOverdue={handleRescheduleOverdue}
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
          eligibleAssignees={eligibleAssignees}
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
