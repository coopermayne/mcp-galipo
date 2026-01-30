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
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { TaskFeed, TaskDetailSheet, useTaskActions } from '../components/lab';
import { getTasks } from '../api';
import type { Task } from '../types';
import { Calendar, Briefcase, LayoutList } from 'lucide-react';

type GroupMode = 'none' | 'date' | 'case';

export function Lab() {
  const [groupBy, setGroupBy] = useState<GroupMode>('date');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleEditClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
  };

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
            sortable={true}
            groupBy={groupBy}
            emptyMessage="No active tasks"
            onDelete={async (taskId) => { await deleteTask(taskId); }}
            onMarkDone={async (taskId) => { await markDone(taskId); }}
            onTaskClick={handleTaskClick}
            onEditClick={handleEditClick}
            onReorder={handleReorder}
            onAddTask={handleAddTask}
          />
        </div>

        {/* Task Detail Sheet (mobile-first) */}
        <TaskDetailSheet
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={handleCloseDetail}
          onMarkDone={(taskId) => { markDone(taskId); }}
          onPrevTask={handlePrevTask}
          onNextTask={handleNextTask}
          hasPrevTask={hasPrevTask}
          hasNextTask={hasNextTask}
        />
      </PageContent>
    </>
  );
}
