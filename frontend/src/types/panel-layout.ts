/**
 * Universal Panel Layout Types
 *
 * Generic layout system that can be used across multiple pages.
 * Each page specifies which widget types are allowed.
 */

/** Available layout presets */
export type LayoutPreset = '1' | '1:1' | '1:2' | '2:1' | '2:2';

/** Widget types - extend as needed */
export type WidgetType = 'tasks' | 'events' | 'cases';

/** Group modes for tasks widget */
export type TasksGroupMode = 'date' | 'case' | 'urgency';

/** Group modes for events widget */
export type EventsGroupMode = 'none' | 'date' | 'case';

/** Group modes for cases widget */
export type CasesGroupMode = 'alpha' | 'status';

/** Base config all widgets share */
interface BaseWidgetConfig {
  id: string;
  type: WidgetType;
}

/** Tasks widget configuration */
export interface TasksWidgetConfig extends BaseWidgetConfig {
  type: 'tasks';
  showDone: boolean;
  groupBy: TasksGroupMode;
  caseId?: number;
  searchQuery: string;
}

/** Events widget configuration */
export interface EventsWidgetConfig extends BaseWidgetConfig {
  type: 'events';
  showPast: boolean;
  groupBy: EventsGroupMode;
  caseId?: number;
  searchQuery: string;
}

/** Cases widget configuration */
export interface CasesWidgetConfig extends BaseWidgetConfig {
  type: 'cases';
  showClosed: boolean;
  groupBy: CasesGroupMode;
  searchQuery: string;
}

/** Discriminated union of all widget configs */
export type WidgetConfig = TasksWidgetConfig | EventsWidgetConfig | CasesWidgetConfig;

/** Full layout configuration (stored in localStorage) */
export interface PanelLayoutConfig {
  layout: LayoutPreset;
  panels: WidgetConfig[];
}

/** Number of panels for each layout preset */
export const LAYOUT_PANEL_COUNTS: Record<LayoutPreset, number> = {
  '1': 1,
  '1:1': 2,
  '1:2': 3,
  '2:1': 3,
  '2:2': 4,
};

/** CSS grid classes for each layout preset */
export const LAYOUT_CONTAINER_CLASSES: Record<LayoutPreset, string> = {
  '1': 'grid-cols-1',
  '1:1': 'grid-cols-1 lg:grid-cols-2',
  '1:2': 'grid-cols-1 lg:grid-cols-3 lg:grid-rows-2',
  '2:1': 'grid-cols-1 lg:grid-cols-3 lg:grid-rows-2',
  '2:2': 'grid-cols-1 md:grid-cols-2 lg:grid-rows-2',
};

/** Default config for tasks widget */
export function createDefaultTasksWidget(id: string): TasksWidgetConfig {
  return {
    id,
    type: 'tasks',
    showDone: false,
    groupBy: 'urgency',
    caseId: undefined,
    searchQuery: '',
  };
}

/** Default config for events widget */
export function createDefaultEventsWidget(id: string): EventsWidgetConfig {
  return {
    id,
    type: 'events',
    showPast: false,
    groupBy: 'date',
    caseId: undefined,
    searchQuery: '',
  };
}

/** Default config for cases widget */
export function createDefaultCasesWidget(id: string): CasesWidgetConfig {
  return {
    id,
    type: 'cases',
    showClosed: false,
    groupBy: 'alpha',
    searchQuery: '',
  };
}

/** Create a default widget of the specified type */
export function createDefaultWidget(id: string, type: WidgetType): WidgetConfig {
  switch (type) {
    case 'tasks':
      return createDefaultTasksWidget(id);
    case 'events':
      return createDefaultEventsWidget(id);
    case 'cases':
      return createDefaultCasesWidget(id);
  }
}

/** Get span classes for a panel based on layout and position */
export function getPanelClasses(layout: LayoutPreset, index: number): string {
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

/** Adjust panels array when layout changes */
export function adjustPanelsForLayout(
  currentPanels: WidgetConfig[],
  newLayout: LayoutPreset,
  defaultWidgetType: WidgetType = 'tasks'
): WidgetConfig[] {
  const targetCount = LAYOUT_PANEL_COUNTS[newLayout];
  const result = [...currentPanels];

  // Add panels if needed
  while (result.length < targetCount) {
    result.push(createDefaultWidget(`panel-${result.length}`, defaultWidgetType));
  }

  // Remove panels if needed (from the end)
  while (result.length > targetCount) {
    result.pop();
  }

  return result;
}

/** Widget display info for UI */
export const WIDGET_INFO: Record<WidgetType, { label: string; description: string }> = {
  tasks: { label: 'Tasks', description: 'Task list with filters' },
  events: { label: 'Events', description: 'Upcoming events and deadlines' },
  cases: { label: 'Cases', description: 'Case files and matters' },
};
