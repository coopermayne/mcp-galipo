/**
 * Lab - Experimental page for testing new unified task components
 *
 * Route: /lab
 *
 * This page is for iterating on a new task list/row component
 * that can eventually replace the 5 different implementations.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { TaskFeed, useTaskActions } from '../components/lab';
import { getTasks } from '../api';
import type { Task } from '../types';
import { Eye, EyeOff, FlaskConical, GripVertical, List } from 'lucide-react';

export function Lab() {
  const [showDone, setShowDone] = useState(false);
  const [sortable, setSortable] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['lab-tasks', { showDone }],
    queryFn: () => getTasks(showDone ? { status: 'Done', limit: 20 } : { exclude_status: 'Done', limit: 20 }),
  });

  // Use our unified hook for all task actions
  const {
    updateField,
    markDone,
    deleteTask,
    mutations,
    isUpdating,
    isDeleting,
  } = useTaskActions({
    invalidateKeys: [['lab-tasks']],
  });

  const tasks = tasksData?.tasks || [];

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // TODO: Open task detail modal
    console.log('Task clicked:', task);
  };

  const handleReorder = (taskId: number, newIndex: number, reorderedTasks: Task[]) => {
    // Calculate new sort_order based on neighbors
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
    console.log('Reorder:', { taskId, newIndex, newSortOrder });
  };

  return (
    <>
      <Header
        title="Lab"
        subtitle="Experimental unified task components"
        icon={<FlaskConical className="w-6 h-6" />}
      />

      <PageContent>
        {/* Controls */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setShowDone(!showDone)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showDone
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {showDone ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showDone ? 'Showing Done' : 'Showing Active'}
          </button>

          <button
            onClick={() => setSortable(!sortable)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortable
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {sortable ? <GripVertical className="w-4 h-4" /> : <List className="w-4 h-4" />}
            {sortable ? 'Sortable' : 'Static'}
          </button>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            {tasks.length} tasks
            {(isUpdating || isDeleting) && ' (saving...)'}
          </div>
        </div>

        {/* Info panel */}
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Experimental Components</h3>
          <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
            <li>- <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">TaskFeed</code>: Unified list with DndContext</li>
            <li>- <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">TaskItem</code>: Unified row with useSortable</li>
            <li>- <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">useTaskActions</code>: Unified mutations hook</li>
            <li>- Toggle "Sortable" to enable/disable drag-and-drop</li>
            <li>- Click status badge to cycle through statuses</li>
            <li>- Drag handle appears when sortable is enabled</li>
          </ul>
        </div>

        {/* The experimental TaskFeed */}
        <TaskFeed
          tasks={tasks}
          isLoading={isLoading}
          showCase={true}
          showUrgency={true}
          showDelete={true}
          showQuickDone={true}
          sortable={sortable}
          emptyMessage={showDone ? 'No completed tasks' : 'No active tasks'}
          onUpdate={updateField}
          onDelete={deleteTask}
          onMarkDone={markDone}
          onTaskClick={handleTaskClick}
          onReorder={handleReorder}
        />

        {/* Selected task debug */}
        {selectedTask && (
          <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Selected Task (debug)</h4>
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
