/**
 * PanelLayoutContext - Universal multi-panel layout state management
 *
 * Generic provider that can be used across multiple pages.
 * Each page specifies:
 * - storageKey: localStorage namespace
 * - allowedWidgets: which widget types can be selected
 * - defaultConfig: initial layout configuration
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type {
  LayoutPreset,
  WidgetType,
  WidgetConfig,
  PanelLayoutConfig,
} from '../types/panel-layout';
import {
  adjustPanelsForLayout,
  createDefaultWidget,
  createDefaultTasksWidget,
  createDefaultEventsWidget,
  createDefaultClientsWidget,
  createDefaultChartWidget,
} from '../types/panel-layout';

interface PanelLayoutContextType {
  config: PanelLayoutConfig;
  allowedWidgets: WidgetType[];
  setLayout: (layout: LayoutPreset) => void;
  updatePanel: (panelId: string, updates: Partial<WidgetConfig>) => void;
  setPanelType: (panelId: string, type: WidgetType) => void;
  resetToDefault: () => void;
}

const PanelLayoutContext = createContext<PanelLayoutContextType | null>(null);

function loadConfig(
  storageKey: string,
  defaultConfig: PanelLayoutConfig,
  defaultWidgetType: WidgetType
): PanelLayoutConfig {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the structure
      if (parsed.layout && Array.isArray(parsed.panels)) {
        // Migrate old panel configs: add missing fields with defaults
        const migratedPanels = parsed.panels.map((panel: Record<string, unknown>, index: number) => {
          if (!panel.type) {
            // Old format - migrate to new format with default widget type
            return createDefaultWidget(
              (panel.id as string) || `panel-${index}`,
              defaultWidgetType
            );
          }
          // Fill in missing fields from defaults for each widget type
          if (panel.type === 'tasks') {
            const defaults = createDefaultTasksWidget(panel.id as string);
            return { ...defaults, ...panel };
          }
          if (panel.type === 'events') {
            const defaults = createDefaultEventsWidget(panel.id as string);
            return { ...defaults, ...panel };
          }
          if (panel.type === 'clients') {
            const defaults = createDefaultClientsWidget(panel.id as string);
            return { ...defaults, ...panel };
          }
          if (panel.type === 'chart') {
            const defaults = createDefaultChartWidget(panel.id as string);
            return { ...defaults, ...panel };
          }
          return panel;
        });
        return { ...parsed, panels: migratedPanels };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return defaultConfig;
}

function saveConfig(storageKey: string, config: PanelLayoutConfig): void {
  localStorage.setItem(storageKey, JSON.stringify(config));
}

interface PanelLayoutProviderProps {
  children: ReactNode;
  /** localStorage key for persistence */
  storageKey: string;
  /** Widget types that can be selected in this context */
  allowedWidgets: WidgetType[];
  /** Initial configuration */
  defaultConfig: PanelLayoutConfig;
}

export function PanelLayoutProvider({
  children,
  storageKey,
  allowedWidgets,
  defaultConfig,
}: PanelLayoutProviderProps) {
  const [config, setConfig] = useState<PanelLayoutConfig>(() =>
    loadConfig(storageKey, defaultConfig, allowedWidgets[0])
  );

  // Persist to localStorage on change
  useEffect(() => {
    saveConfig(storageKey, config);
  }, [storageKey, config]);

  const setLayout = useCallback(
    (layout: LayoutPreset) => {
      setConfig((prev) => ({
        layout,
        panels: adjustPanelsForLayout(prev.panels, layout, allowedWidgets[0]),
      }));
    },
    [allowedWidgets]
  );

  const updatePanel = useCallback((panelId: string, updates: Partial<WidgetConfig>) => {
    setConfig((prev) => ({
      ...prev,
      panels: prev.panels.map((panel) =>
        panel.id === panelId ? { ...panel, ...updates } as WidgetConfig : panel
      ),
    }));
  }, []);

  const setPanelType = useCallback((panelId: string, type: WidgetType) => {
    setConfig((prev) => ({
      ...prev,
      panels: prev.panels.map((panel) =>
        panel.id === panelId ? createDefaultWidget(panel.id, type) : panel
      ),
    }));
  }, []);

  const resetToDefault = useCallback(() => {
    setConfig(defaultConfig);
  }, [defaultConfig]);

  const value = useMemo(
    () => ({
      config,
      allowedWidgets,
      setLayout,
      updatePanel,
      setPanelType,
      resetToDefault,
    }),
    [config, allowedWidgets, setLayout, updatePanel, setPanelType, resetToDefault]
  );

  return (
    <PanelLayoutContext.Provider value={value}>
      {children}
    </PanelLayoutContext.Provider>
  );
}

export function usePanelLayout() {
  const context = useContext(PanelLayoutContext);
  if (!context) {
    throw new Error('usePanelLayout must be used within a PanelLayoutProvider');
  }
  return context;
}
