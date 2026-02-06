/**
 * Universal Panel Layout Types
 *
 * Generic layout system that can be used across multiple pages.
 * Each page specifies which widget types are allowed.
 */

/** Available layout presets */
export type LayoutPreset = '1' | '1:1' | '1:2' | '2:1' | '2:2';

/** Widget types - extend as needed */
export type WidgetType = 'tasks' | 'events' | 'cases' | 'persons' | 'clients' | 'judges' | 'chart';

/** Group modes for tasks widget */
export type TasksGroupMode = 'date' | 'case' | 'urgency';

/** Group modes for events widget */
export type EventsGroupMode = 'none' | 'date' | 'case';

/** Group modes for cases widget */
export type CasesGroupMode = 'none' | 'alpha' | 'status';

/** Attorney filter for cases widget */
export type CaseAttorneyFilter = 'all' | 'mine' | 'unassigned' | number[];

/** Group modes for persons widget */
export type PersonsGroupMode = 'category' | 'alpha' | 'recent';

/** Base config all widgets share */
interface BaseWidgetConfig {
  id: string;
  type: WidgetType;
}

/** Assignee filter for tasks widget */
export type TaskAssigneeFilter = 'all' | 'mine' | 'unassigned' | number;

/** Tasks widget configuration */
export interface TasksWidgetConfig extends BaseWidgetConfig {
  type: 'tasks';
  showDone: boolean;
  groupBy: TasksGroupMode;
  caseId?: number;
  searchQuery: string;
  assigneeFilter: TaskAssigneeFilter;
  caseOwnerFilter: CaseOwnerFilter;
}

/** Case owner filter for events/tasks widgets */
export type CaseOwnerFilter = 'all' | 'mine';

/** Attendee filter for events widget */
export type EventAttendeeFilter = 'all' | 'mine';

/** Events widget configuration */
export interface EventsWidgetConfig extends BaseWidgetConfig {
  type: 'events';
  showPast: boolean;
  groupBy: EventsGroupMode;
  caseId?: number;
  searchQuery: string;
  caseOwnerFilter: CaseOwnerFilter;
  attendeeFilter: EventAttendeeFilter;
}

/** Cases widget configuration */
export interface CasesWidgetConfig extends BaseWidgetConfig {
  type: 'cases';
  showClosed: boolean;
  groupBy: CasesGroupMode;
  searchQuery: string;
  attorneyFilter: CaseAttorneyFilter;
}

/** Persons widget configuration */
export interface PersonsWidgetConfig extends BaseWidgetConfig {
  type: 'persons';
  showUnassigned: boolean;
  groupBy: PersonsGroupMode;
  typeFilter?: string;
  searchQuery: string;
}

/** Clients widget configuration */
export interface ClientsWidgetConfig extends BaseWidgetConfig {
  type: 'clients';
  searchQuery: string;
  caseOwnerFilter: CaseOwnerFilter;
}

/** Judges widget configuration */
export interface JudgesWidgetConfig extends BaseWidgetConfig {
  type: 'judges';
  searchQuery: string;
}

/** Chart widget configuration */
export interface ChartWidgetConfig extends BaseWidgetConfig {
  type: 'chart';
  caseOwnerFilter: CaseOwnerFilter;
}

/** Discriminated union of all widget configs */
export type WidgetConfig = TasksWidgetConfig | EventsWidgetConfig | CasesWidgetConfig | PersonsWidgetConfig | ClientsWidgetConfig | JudgesWidgetConfig | ChartWidgetConfig;

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
  '1:2': 'grid-cols-1 lg:grid-cols-2 lg:grid-rows-2',
  '2:1': 'grid-cols-1 lg:grid-cols-2 lg:grid-rows-2',
  '2:2': 'grid-cols-1 md:grid-cols-2 lg:grid-rows-2',
};

/** Max-width classes for each layout preset - constrains single panels, allows multi-panel to expand */
export const LAYOUT_MAX_WIDTH_CLASSES: Record<LayoutPreset, string> = {
  '1': 'max-w-4xl mx-auto',
  '1:1': '',
  '1:2': '',
  '2:1': '',
  '2:2': '',
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
    assigneeFilter: 'all',
    caseOwnerFilter: 'mine',
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
    caseOwnerFilter: 'mine',
    attendeeFilter: 'all',
  };
}

/** Default config for cases widget */
export function createDefaultCasesWidget(id: string): CasesWidgetConfig {
  return {
    id,
    type: 'cases',
    showClosed: false,
    groupBy: 'none',
    searchQuery: '',
    attorneyFilter: 'all',
  };
}

/** Default config for persons widget */
export function createDefaultPersonsWidget(id: string): PersonsWidgetConfig {
  return {
    id,
    type: 'persons',
    showUnassigned: false,
    groupBy: 'category',
    typeFilter: undefined,
    searchQuery: '',
  };
}

/** Default config for clients widget */
export function createDefaultClientsWidget(id: string): ClientsWidgetConfig {
  return {
    id,
    type: 'clients',
    searchQuery: '',
    caseOwnerFilter: 'all',
  };
}

/** Default config for judges widget */
export function createDefaultJudgesWidget(id: string): JudgesWidgetConfig {
  return {
    id,
    type: 'judges',
    searchQuery: '',
  };
}

/** Default config for chart widget */
export function createDefaultChartWidget(id: string): ChartWidgetConfig {
  return {
    id,
    type: 'chart',
    caseOwnerFilter: 'all',
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
    case 'persons':
      return createDefaultPersonsWidget(id);
    case 'clients':
      return createDefaultClientsWidget(id);
    case 'judges':
      return createDefaultJudgesWidget(id);
    case 'chart':
      return createDefaultChartWidget(id);
  }
}

/** Get span classes for a panel based on layout and position */
export function getPanelClasses(layout: LayoutPreset, index: number): string {
  switch (layout) {
    case '1:2':
      // Left panel spans full height, right panels stack
      if (index === 0) return 'lg:row-span-2';
      return '';

    case '2:1':
      // Left panels stack, right panel spans full height
      if (index === 2) return 'lg:row-span-2 lg:col-start-2 lg:row-start-1';
      return '';

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
  persons: { label: 'Persons', description: 'Contacts and people' },
  clients: { label: 'Clients', description: 'Client contacts with case info' },
  judges: { label: 'Judges', description: 'Judges and judicial officers' },
  chart: { label: 'Chart', description: 'Case pipeline by status' },
};
