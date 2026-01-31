import { useState, useCallback, useMemo } from 'react';
import { Eye, EyeOff, LayoutGrid, Calendar } from 'lucide-react';
import { TaskFeed, TaskDetailSheet, useTaskActions } from '../../../components/tasks';
import type { SheetFocusMode } from '../../../components/tasks/TaskDetailSheet';
import type { Task, Constants } from '../../../types';

type TaskViewMode = 'by-urgency' | 'by-date';

interface TasksTabProps {
  caseId: number;
  tasks: Task[];
  constants: Constants | undefined;
}

export function TasksTab({ caseId, tasks }: TasksTabProps) {
  const [view, setView] = useState<TaskViewMode>('by-date');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetFocusMode, setSheetFocusMode] = useState<SheetFocusMode>(null);

  const { markDone, deleteTask, updateField, mutations } = useTaskActions({
    invalidateKeys: [['case', String(caseId)]],
  });

  // Wrapper for deleteTask to match expected signature
  const handleDelete = useCallback(async (taskId: number) => {
    await deleteTask(taskId);
  }, [deleteTask]);

  // Filter tasks based on done toggle
  const filteredTasks = useMemo(() => {
    if (showDoneTasks) {
      return tasks.filter((t) => t.status === 'Done');
    }
    return tasks.filter((t) => t.status !== 'Done');
  }, [tasks, showDoneTasks]);

  // Map view to groupBy - TaskFeed uses 'date' for date grouping, 'none' for urgency (flat list sorted by urgency)
  const groupBy = view === 'by-date' ? 'date' : 'none';

  // Handle task click - open detail sheet
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setSheetFocusMode(null);
  }, []);

  // Handle edit click - open sheet with title focused
  const handleEditClick = useCallback((task: Task) => {
    setSelectedTask(task);
    setSheetFocusMode('title');
  }, []);

  // Handle date change from inline picker
  const handleDateChange = useCallback(
    (taskId: number, date: string | null) => {
      updateField(taskId, 'due_date', date || undefined);
    },
    [updateField]
  );

  // Handle priority change
  const handlePriorityChange = useCallback(
    (taskId: number, priority: number) => {
      updateField(taskId, 'urgency', priority);
    },
    [updateField]
  );

  // Handle inline edit save
  const handleInlineEditSave = useCallback(
    async (
      taskId: number,
      updates: { description?: string; due_date?: string; urgency?: number }
    ) => {
      await mutations.update.mutateAsync({ id: taskId, data: updates });
    },
    [mutations.update]
  );

  // Handle inline create
  const handleInlineCreateSave = useCallback(
    async (data: {
      case_id: number;
      description: string;
      due_date?: string;
      urgency?: number;
    }) => {
      // Force the case_id to be this case
      await mutations.create.mutateAsync({ ...data, case_id: caseId });
    },
    [mutations.create, caseId]
  );

  // Handle sheet close
  const handleSheetClose = useCallback(() => {
    setSelectedTask(null);
    setSheetFocusMode(null);
  }, []);

  // Handle sheet update
  const handleSheetUpdate = useCallback(
    async (taskId: number, updates: Partial<Task>) => {
      await mutations.update.mutateAsync({ id: taskId, data: updates });
    },
    [mutations.update]
  );

  // Handle event link from sheet
  const handleLinkEvent = useCallback(
    (taskId: number, eventId: number | null) => {
      updateField(taskId, 'event_id', eventId);
    },
    [updateField]
  );

  // Navigation in sheet
  const selectedTaskIndex = selectedTask
    ? filteredTasks.findIndex((t) => t.id === selectedTask.id)
    : -1;

  const handlePrevTask = useCallback(() => {
    if (selectedTaskIndex > 0) {
      setSelectedTask(filteredTasks[selectedTaskIndex - 1]);
      setSheetFocusMode(null);
    }
  }, [filteredTasks, selectedTaskIndex]);

  const handleNextTask = useCallback(() => {
    if (selectedTaskIndex < filteredTasks.length - 1) {
      setSelectedTask(filteredTasks[selectedTaskIndex + 1]);
      setSheetFocusMode(null);
    }
  }, [filteredTasks, selectedTaskIndex]);

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

      {/* Task Feed */}
      <TaskFeed
        tasks={filteredTasks}
        showCase={false}
        groupBy={groupBy}
        emptyMessage={showDoneTasks ? 'No completed tasks' : 'No tasks yet'}
        onDelete={deleteTask}
        onMarkDone={markDone}
        onTaskClick={handleTaskClick}
        onEditClick={handleEditClick}
        onDateChange={handleDateChange}
        onPriorityChange={handlePriorityChange}
        onInlineEditSave={handleInlineEditSave}
        enableInlineEdit
        onInlineCreateSave={handleInlineCreateSave}
        enableInlineCreate
      />

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={handleSheetClose}
        onMarkDone={markDone}
        onUpdate={handleSheetUpdate}
        onLinkEvent={handleLinkEvent}
        onDelete={deleteTask}
        onPrevTask={handlePrevTask}
        onNextTask={handleNextTask}
        hasPrevTask={selectedTaskIndex > 0}
        hasNextTask={selectedTaskIndex < filteredTasks.length - 1}
        initialFocus={sheetFocusMode}
      />
    </>
  );
}
