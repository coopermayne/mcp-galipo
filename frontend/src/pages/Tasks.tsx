/**
 * Tasks - Todoist-style task list
 *
 * Route: /tasks
 *
 * Features:
 * - Date-based grouping (Overdue, Today, Tomorrow, etc.)
 * - Case-based grouping (alphabetical)
 * - Minimal task rows with hover actions
 * - Priority shown via checkbox color
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { TaskFeed, TaskDetailSheet, EventLinkPopover, useTaskActions } from '../components/tasks';
import type { SheetFocusMode } from '../components/tasks/TaskDetailSheet';
import { ToastContainer, useToast } from '../components/common';
import { getTasks, updateTask, createTask } from '../api';
import type { Task, TaskStatus } from '../types';
import { Calendar, Briefcase, LayoutList, Search, Eye, EyeOff, SlidersHorizontal, Check } from 'lucide-react';

type GroupMode = 'none' | 'date' | 'case';

export function Tasks() {
  const [groupBy, setGroupBy] = useState<GroupMode>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetFocusMode, setSheetFocusMode] = useState<SheetFocusMode>(null);
  const [eventLinkTask, setEventLinkTask] = useState<Task | null>(null);
  const [eventLinkAnchor, setEventLinkAnchor] = useState<HTMLElement | null>(null);
  const { toasts, showToast, dismissToast } = useToast();
  const queryClient = useQueryClient();

  // Track previous task states for undo (taskId -> previous status)
  const previousStates = useRef<Map<number, TaskStatus>>(new Map());

  // Fetch tasks - either done or active based on toggle
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', { showDone: showDoneTasks }],
    queryFn: () => showDoneTasks
      ? getTasks({ status: 'Done', limit: 100 })
      : getTasks({ exclude_status: 'Done', limit: 100 }),
  });

  // Use our unified hook for all task actions
  const {
    markDone,
    deleteTask,
    isDeleting,
  } = useTaskActions({
    invalidateKeys: [['tasks']],
  });

  const allTasks = tasksData?.tasks || [];

  // Filter tasks by search query
  const tasks = useMemo(() => {
    if (!searchQuery.trim()) return allTasks;
    const query = searchQuery.toLowerCase();
    return allTasks.filter(task =>
      task.description.toLowerCase().includes(query) ||
      task.case_name?.toLowerCase().includes(query) ||
      task.short_name?.toLowerCase().includes(query)
    );
  }, [allTasks, searchQuery]);

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

  // Open modal edit (when clicking the task row or other modal triggers)
  const handleEditClick = (task: Task) => {
    setSheetFocusMode('title');
    setSelectedTask(task);
  };

  // Handle inline edit save (when clicking the edit icon)
  const handleInlineEditSave = useCallback(async (
    taskId: number,
    updates: { description?: string; due_date?: string; urgency?: number }
  ) => {
    await updateTask(taskId, updates);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleDateChange = useCallback(async (taskId: number, date: string | null) => {
    await updateTask(taskId, { due_date: date ?? undefined });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handlePriorityChange = useCallback(async (taskId: number, priority: number) => {
    await updateTask(taskId, { urgency: priority });
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
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  const handleInlineCreateSave = useCallback(async (
    data: { case_id: number; description: string; due_date?: string; urgency?: number }
  ) => {
    await createTask(data);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['case', data.case_id] });
  }, [queryClient]);

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

  return (
    <>
      <Header
        title="Tasks"
        subtitle="Track your to-dos"
      />

      <PageContent>
        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-28 sm:w-48 pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Filter popover */}
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                isFilterOpen
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>View</span>
            </button>

            {isFilterOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsFilterOpen(false)}
                />
                {/* Dropdown */}
                <div className="absolute left-0 top-full mt-1 w-48 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Group by
                  </div>
                  <button
                    onClick={() => { setGroupBy('date'); setIsFilterOpen(false); }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Date
                    </span>
                    {groupBy === 'date' && <Check className="w-4 h-4 text-primary-500" />}
                  </button>
                  <button
                    onClick={() => { setGroupBy('case'); setIsFilterOpen(false); }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Case
                    </span>
                    {groupBy === 'case' && <Check className="w-4 h-4 text-primary-500" />}
                  </button>
                  <button
                    onClick={() => { setGroupBy('none'); setIsFilterOpen(false); }}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <LayoutList className="w-4 h-4" />
                      List
                    </span>
                    {groupBy === 'none' && <Check className="w-4 h-4 text-primary-500" />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Show Done toggle */}
          <button
            onClick={() => setShowDoneTasks(!showDoneTasks)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showDoneTasks
                ? 'border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {showDoneTasks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>Done</span>
          </button>
        </div>

        {/* The Todoist-style TaskFeed */}
        <div className="max-w-2xl">
          <TaskFeed
            tasks={tasks}
            isLoading={isLoading}
            showCase={true}
            sortable={false}
            groupBy={groupBy}
            emptyMessage={showDoneTasks ? "No completed tasks" : "No active tasks"}
            onDelete={async (taskId) => { await deleteTask(taskId); }}
            onMarkDone={handleMarkDone}
            onTaskClick={handleTaskClick}
            onEditClick={handleEditClick}
            onDateChange={handleDateChange}
            onCommentClick={handleCommentClick}
            onEventLinkClick={handleEventLinkClick}
            onPriorityChange={handlePriorityChange}
            enableInlineEdit={true}
            onInlineEditSave={handleInlineEditSave}
            enableInlineCreate={true}
            onInlineCreateSave={handleInlineCreateSave}
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
          onDelete={deleteTask}
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
