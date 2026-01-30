/**
 * Lab - Todoist-style task list experiment
 *
 * Route: /lab
 *
 * Testing the new Todoist-inspired task components with:
 * - Date-based grouping (Overdue, Today, Tomorrow, etc.)
 * - Case-based grouping (alphabetical)
 * - Minimal task rows with hover actions
 * - Priority shown via checkbox color
 */
import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { TaskFeed, TaskDetailSheet, EventLinkPopover, useTaskActions } from '../components/lab';
import type { SheetFocusMode } from '../components/lab/TaskDetailSheet';
import { ToastContainer, useToast } from '../components/common';
import { getTasks, updateTask } from '../api';
import type { Task } from '../types';
import { Calendar, Briefcase, LayoutList } from 'lucide-react';

type GroupMode = 'none' | 'date' | 'case';

export function Lab() {
  const [groupBy, setGroupBy] = useState<GroupMode>('date');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetFocusMode, setSheetFocusMode] = useState<SheetFocusMode>(null);
  const [eventLinkTask, setEventLinkTask] = useState<Task | null>(null);
  const [eventLinkAnchor, setEventLinkAnchor] = useState<HTMLElement | null>(null);
  const { toasts, showToast, dismissToast } = useToast();
  const queryClient = useQueryClient();

  // Track previous task states for undo (taskId -> previous status)
  const previousStates = useRef<Map<number, string>>(new Map());

  // Fetch active tasks only
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['lab-tasks'],
    queryFn: () => getTasks({ exclude_status: 'Done', limit: 50 }),
  });

  // Use our unified hook for all task actions
  const {
    markDone,
    deleteTask,
    mutations,
    isDeleting,
  } = useTaskActions({
    invalidateKeys: [['lab-tasks']],
  });

  const tasks = tasksData?.tasks || [];

  // Handle marking done with toast and undo support
  const handleMarkDone = useCallback(async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Store previous state for undo
    previousStates.current.set(taskId, task.status);

    // Mark as done
    await markDone(taskId);

    // Show toast with undo
    showToast({
      message: '1 task completed',
      onUndo: async () => {
        const prevStatus = previousStates.current.get(taskId);
        if (prevStatus) {
          await updateTask(taskId, { status: prevStatus });
          queryClient.invalidateQueries({ queryKey: ['lab-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          previousStates.current.delete(taskId);
        }
      },
    });
  }, [tasks, markDone, showToast, queryClient]);

  const handleTaskClick = (task: Task) => {
    setSheetFocusMode(null);
    setSelectedTask(task);
  };

  const handleEditClick = (task: Task) => {
    setSheetFocusMode('title');
    setSelectedTask(task);
  };

  const handleDateChange = useCallback(async (taskId: number, date: string | null) => {
    await updateTask(taskId, { due_date: date ?? undefined });
    queryClient.invalidateQueries({ queryKey: ['lab-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleCommentClick = (task: Task) => {
    setSheetFocusMode('comment');
    setSelectedTask(task);
  };

  const handleEventLinkClick = (task: Task, event?: React.MouseEvent) => {
    setEventLinkTask(task);
    setEventLinkAnchor(event?.currentTarget as HTMLElement || null);
  };

  const handleLinkEvent = useCallback(async (taskId: number, eventId: number | null) => {
    await updateTask(taskId, { event_id: eventId });
    queryClient.invalidateQueries({ queryKey: ['lab-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleCloseEventLink = () => {
    setEventLinkTask(null);
    setEventLinkAnchor(null);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
    setSheetFocusMode(null);
  };

  const handleUpdateTask = useCallback(async (taskId: number, updates: Partial<Task>) => {
    await updateTask(taskId, updates);
    queryClient.invalidateQueries({ queryKey: ['lab-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleAddTask = (dueDate?: string) => {
    console.log('Add task for date:', dueDate);
  };

  // Navigation between tasks in the detail sheet
  const selectedTaskIndex = selectedTask ? tasks.findIndex(t => t.id === selectedTask.id) : -1;
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

  const handleReorder = (taskId: number, newIndex: number, reorderedTasks: Task[]) => {
    let newSortOrder: number;
    if (newIndex === 0) {
      newSortOrder = (reorderedTasks[0]?.sort_order || 1000) - 500;
    } else if (newIndex >= reorderedTasks.length - 1) {
      newSortOrder = (reorderedTasks[reorderedTasks.length - 1]?.sort_order || 0) + 1000;
    } else {
      const prev = reorderedTasks[newIndex - 1];
      const next = reorderedTasks[newIndex + 1];
      newSortOrder = Math.floor(((prev?.sort_order || 0) + (next?.sort_order || (prev?.sort_order || 0) + 1000)) / 2);
    }

    mutations.reorder.mutate({ taskId, sortOrder: newSortOrder });
  };

  return (
    <>
      <Header
        title="Lab"
        subtitle="Todoist-style task list"
      />

      <PageContent>
        {/* Controls */}
        <div className="mb-6 flex items-center gap-2">
          {/* Group by selector */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setGroupBy('none')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                groupBy === 'none'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span>List</span>
            </button>
            <button
              onClick={() => setGroupBy('date')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${
                groupBy === 'date'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Date</span>
            </button>
            <button
              onClick={() => setGroupBy('case')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${
                groupBy === 'case'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Case</span>
            </button>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400 ml-2">
            {tasks.length} tasks
            {isDeleting && ' (saving...)'}
          </div>
        </div>

        {/* The Todoist-style TaskFeed */}
        <div className="max-w-2xl">
          <TaskFeed
            tasks={tasks}
            isLoading={isLoading}
            showCase={true}
            sortable={false}
            groupBy={groupBy}
            emptyMessage="No active tasks"
            onDelete={async (taskId) => { await deleteTask(taskId); }}
            onMarkDone={handleMarkDone}
            onTaskClick={handleTaskClick}
            onEditClick={handleEditClick}
            onDateChange={handleDateChange}
            onCommentClick={handleCommentClick}
            onEventLinkClick={handleEventLinkClick}
            onAddTask={handleAddTask}
          />
        </div>

        {/* Task Detail Sheet (mobile-first) */}
        <TaskDetailSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={handleCloseDetail}
          onMarkDone={handleMarkDone}
          onUpdate={handleUpdateTask}
          onLinkEvent={handleLinkEvent}
          onPrevTask={handlePrevTask}
          onNextTask={handleNextTask}
          hasPrevTask={hasPrevTask}
          hasNextTask={hasNextTask}
          initialFocus={sheetFocusMode}
        />

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
      </PageContent>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
