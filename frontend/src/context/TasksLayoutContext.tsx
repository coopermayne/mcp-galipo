/**
 * TasksLayoutContext - Manages multi-panel layout state with localStorage persistence
 *
 * Stores:
 * - Current layout preset (1, 1:1, 1:2, 2:1, 2:2)
 * - Panel configurations (filters for each panel)
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
  LayoutPreset,
  TasksPanelConfig,
  TasksLayoutConfig,
} from '../types';
import {
  createDefaultLayoutConfig,
  adjustPanelsForLayout,
} from '../types';

const STORAGE_KEY = 'tasks-layout';

interface TasksLayoutContextType {
  config: TasksLayoutConfig;
  setLayout: (layout: LayoutPreset) => void;
  updatePanel: (panelId: string, updates: Partial<TasksPanelConfig>) => void;
}

const TasksLayoutContext = createContext<TasksLayoutContextType | null>(null);

function loadConfig(): TasksLayoutConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure
      if (parsed.layout && Array.isArray(parsed.panels)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return createDefaultLayoutConfig();
}

function saveConfig(config: TasksLayoutConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function TasksLayoutProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TasksLayoutConfig>(loadConfig);

  // Persist to localStorage on change
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const setLayout = useCallback((layout: LayoutPreset) => {
    setConfig((prev) => ({
      layout,
      panels: adjustPanelsForLayout(prev.panels, layout),
    }));
  }, []);

  const updatePanel = useCallback(
    (panelId: string, updates: Partial<TasksPanelConfig>) => {
      setConfig((prev) => ({
        ...prev,
        panels: prev.panels.map((panel) =>
          panel.id === panelId ? { ...panel, ...updates } : panel
        ),
      }));
    },
    []
  );

  return (
    <TasksLayoutContext.Provider value={{ config, setLayout, updatePanel }}>
      {children}
    </TasksLayoutContext.Provider>
  );
}

export function useTasksLayout() {
  const context = useContext(TasksLayoutContext);
  if (!context) {
    throw new Error('useTasksLayout must be used within a TasksLayoutProvider');
  }
  return context;
}
