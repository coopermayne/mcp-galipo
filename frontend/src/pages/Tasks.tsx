/**
 * Tasks - Multi-panel task management page
 *
 * Route: /tasks
 *
 * Features:
 * - Customizable layout presets (1, 1:1, 1:2, 2:1, 2:2)
 * - Independent panel filters (showDone, groupBy, caseId, search)
 * - localStorage persistence for layout and filters
 * - Independent panel scrolling (no page scroll)
 */
import { TasksLayoutSelector, TasksPanel } from '../components/tasks';
import { TasksLayoutProvider, useTasksLayout } from '../context/TasksLayoutContext';
import type { LayoutPreset } from '../types';

/** CSS grid classes for each layout preset */
const LAYOUT_CONTAINER_CLASSES: Record<LayoutPreset, string> = {
  '1': 'grid-cols-1',
  '1:1': 'grid-cols-1 lg:grid-cols-2',
  '1:2': 'grid-cols-1 lg:grid-cols-3 lg:grid-rows-2',
  '2:1': 'grid-cols-1 lg:grid-cols-3 lg:grid-rows-2',
  '2:2': 'grid-cols-1 md:grid-cols-2 lg:grid-rows-2',
};

/** Get span classes for a panel based on layout and position */
function getPanelClasses(layout: LayoutPreset, index: number): string {
  switch (layout) {
    case '1:2':
      // Left panel spans full height, right panels stack
      if (index === 0) return 'lg:row-span-2';
      return 'lg:col-span-2';

    case '2:1':
      // Left panels stack, right panel spans full height
      if (index === 2) return 'lg:row-span-2 lg:col-start-3 lg:row-start-1';
      return 'lg:col-span-2';

    default:
      return '';
  }
}

function TasksContent() {
  const { config, setLayout, updatePanel } = useTasksLayout();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Tasks
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track your to-dos
            </p>
          </div>
          <TasksLayoutSelector value={config.layout} onChange={setLayout} />
        </div>
      </header>

      {/* Panels Grid */}
      <main
        className={`flex-1 grid gap-4 p-4 overflow-hidden ${LAYOUT_CONTAINER_CLASSES[config.layout]}`}
      >
        {config.panels.map((panel, index) => (
          <div
            key={panel.id}
            className={`min-h-0 ${getPanelClasses(config.layout, index)}`}
          >
            <TasksPanel
              config={panel}
              onConfigChange={(updates) => updatePanel(panel.id, updates)}
            />
          </div>
        ))}
      </main>
    </div>
  );
}

export function Tasks() {
  return (
    <TasksLayoutProvider>
      <TasksContent />
    </TasksLayoutProvider>
  );
}
