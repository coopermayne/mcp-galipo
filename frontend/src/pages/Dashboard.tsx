/**
 * Dashboard - Customizable multi-panel dashboard
 *
 * Route: / (home)
 *
 * Features:
 * - Customizable layout presets (1, 1:1, 1:2, 2:1, 2:2)
 * - Each panel can be Tasks or Events widget
 * - Independent panel filters
 * - localStorage persistence for layout and configs
 *
 * Uses the universal panel layout system with allowedWidgets=['tasks', 'events'].
 */
import { Header } from '../components/layout';
import { LayoutSelector, PanelContainer } from '../components/panels';
import { PanelLayoutProvider, usePanelLayout } from '../context/PanelLayoutContext';
import type { PanelLayoutConfig, WidgetType } from '../types/panel-layout';
import {
  LAYOUT_CONTAINER_CLASSES,
  getPanelClasses,
  createDefaultTasksWidget,
  createDefaultEventsWidget,
} from '../types/panel-layout';

const STORAGE_KEY = 'dashboard-layout';
const ALLOWED_WIDGETS: WidgetType[] = ['tasks', 'events', 'chart'];

const DEFAULT_CONFIG: PanelLayoutConfig = {
  layout: '1:1',
  panels: [
    { ...createDefaultEventsWidget('panel-0'), groupBy: 'date', showPast: false, caseOwnerFilter: 'mine', attendeeFilter: 'all' },
    { ...createDefaultTasksWidget('panel-1'), groupBy: 'date', showDone: false, caseOwnerFilter: 'mine', assigneeFilter: 'all' },
  ],
};

function DashboardContent() {
  const { config, setLayout, updatePanel, setPanelType, allowedWidgets, resetToDefault } = usePanelLayout();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Dashboard"
        subtitle="Your cases at a glance"
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

export function Dashboard() {
  return (
    <PanelLayoutProvider
      storageKey={STORAGE_KEY}
      allowedWidgets={ALLOWED_WIDGETS}
      defaultConfig={DEFAULT_CONFIG}
    >
      <DashboardContent />
    </PanelLayoutProvider>
  );
}
