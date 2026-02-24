/**
 * Types for the multi-panel Tasks page layout
 */

import type { GroupMode } from '../components/tasks/TasksControls';

/** Available layout presets */
export type LayoutPreset = '1' | '1:1' | '1:2' | '2:1' | '2:2';

/** Configuration for a single tasks panel */
export interface TasksPanelConfig {
  id: string;
  showDone: boolean;
  groupBy: GroupMode;
  caseId?: number;
  searchQuery: string;
}

/** Full layout configuration (stored in localStorage) */
export interface TasksLayoutConfig {
  layout: LayoutPreset;
  panels: TasksPanelConfig[];
}

/** Number of panels for each layout preset */
export const LAYOUT_PANEL_COUNTS: Record<LayoutPreset, number> = {
  '1': 1,
  '1:1': 2,
  '1:2': 3,
  '2:1': 3,
  '2:2': 4,
};

/** Create a default panel config */
export function createDefaultPanel(id: string): TasksPanelConfig {
  return {
    id,
    showDone: false,
    groupBy: 'date',
    caseId: undefined,
    searchQuery: '',
  };
}

/** Create default layout config */
export function createDefaultLayoutConfig(): TasksLayoutConfig {
  return {
    layout: '1',
    panels: [createDefaultPanel('panel-0')],
  };
}

/** Adjust panels array when layout changes */
export function adjustPanelsForLayout(
  currentPanels: TasksPanelConfig[],
  newLayout: LayoutPreset
): TasksPanelConfig[] {
  const targetCount = LAYOUT_PANEL_COUNTS[newLayout];
  const result = [...currentPanels];

  // Add panels if needed
  while (result.length < targetCount) {
    result.push(createDefaultPanel(`panel-${result.length}`));
  }

  // Remove panels if needed (from the end)
  while (result.length > targetCount) {
    result.pop();
  }

  return result;
}
