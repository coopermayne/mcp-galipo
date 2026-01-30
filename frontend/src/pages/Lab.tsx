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
import { TaskFeed, useTaskActions } from '../components/lab';
import { getTasks } from '../api';
import type { Task } from '../types';
import { FlaskConical, GripVertical, List, Calendar, Briefcase, LayoutList } from 'lucide-react';

type GroupMode = 'none' | 'date' | 'case';

export function Lab() {
  const [sortable, setSortable] = useState(true);
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
    console.log('Task clicked:', task);
  };

  const handleEditClick = (task: Task) => {
    setSelectedTask(task);
    console.log('Edit clicked:', task);
  };

  const handleAddTask = (dueDate?: string) => {
    console.log('Add task for date:', dueDate);
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
        icon={<FlaskConical className="w-6 h-6" />}
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

          <button
            onClick={() => setSortable(!sortable)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortable
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {sortable ? <GripVertical className="w-4 h-4" /> : <List className="w-4 h-4" />}
            {sortable ? 'Drag' : 'Static'}
          </button>

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
            sortable={sortable}
            groupBy={groupBy}
            emptyMessage="No active tasks"
            onDelete={deleteTask}
            onMarkDone={markDone}
            onTaskClick={handleTaskClick}
            onEditClick={handleEditClick}
            onReorder={handleReorder}
            onAddTask={handleAddTask}
          />
        </div>

        {/* Selected task debug */}
        {selectedTask && (
          <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg max-w-2xl">
            <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Selected Task</h4>
            <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-auto">
              {JSON.stringify(selectedTask, null, 2)}
            </pre>
            <button
              onClick={() => setSelectedTask(null)}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              Clear selection
            </button>
          </div>
        )}
      </PageContent>
    </>
  );
}
