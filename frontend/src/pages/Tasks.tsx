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
 *
 * Uses the universal panel layout system with allowedWidgets=['tasks'].
 */
import { Header } from '../components/layout';
import { LayoutSelector, PanelContainer } from '../components/panels';
import { PanelLayoutProvider, usePanelLayout } from '../context/PanelLayoutContext';
import type { PanelLayoutConfig, WidgetType } from '../types/panel-layout';
import {
  LAYOUT_CONTAINER_CLASSES,
  getPanelClasses,
  createDefaultTasksWidget,
} from '../types/panel-layout';

const STORAGE_KEY = 'tasks-layout';
const ALLOWED_WIDGETS: WidgetType[] = ['tasks'];

const DEFAULT_CONFIG: PanelLayoutConfig = {
  layout: '1:1',
  panels: [
    { ...createDefaultTasksWidget('panel-0'), groupBy: 'date', showDone: false },
    { ...createDefaultTasksWidget('panel-1'), groupBy: 'date', showDone: true },
  ],
};

function TasksContent() {
  const { config, setLayout, updatePanel, setPanelType, allowedWidgets, resetToDefault } = usePanelLayout();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Tasks"
        subtitle="Track your to-dos"
        actions={<LayoutSelector value={config.layout} onChange={setLayout} onReset={resetToDefault} />}
      />

      {/* Panels Grid */}
      <main
        className={`flex-1 grid gap-4 p-4 overflow-hidden ${LAYOUT_CONTAINER_CLASSES[config.layout]}`}
      >
        {config.panels.map((panel, index) => (
          <div
            key={panel.id}
            className={`min-h-0 ${getPanelClasses(config.layout, index)}`}
          >
            <PanelContainer
              config={panel}
              allowedWidgets={allowedWidgets}
              onConfigChange={(updates) => updatePanel(panel.id, updates)}
              onTypeChange={(type) => setPanelType(panel.id, type)}
            />
          </div>
        ))}
      </main>
    </div>
  );
}

export function Tasks() {
  return (
    <PanelLayoutProvider
      storageKey={STORAGE_KEY}
      allowedWidgets={ALLOWED_WIDGETS}
      defaultConfig={DEFAULT_CONFIG}
    >
      <TasksContent />
    </PanelLayoutProvider>
  );
}
