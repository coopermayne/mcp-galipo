/**
 * Cases - Case files management page
 *
 * Route: /cases
 *
 * Features:
 * - CasesWidget for browsing/filtering cases
 * - Customizable layout (1, 1:1, etc.)
 * - Quick case creation form
 *
 * Uses the universal panel layout system with allowedWidgets=['cases'].
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, FileText } from 'lucide-react';
import { Header } from '../components/layout';
import { LayoutSelector, PanelContainer } from '../components/panels';
import { PanelLayoutProvider, usePanelLayout } from '../context/PanelLayoutContext';
import { createCase, exportCaseListPdf } from '../api';
import type { PanelLayoutConfig, WidgetType } from '../types/panel-layout';
import {
  createDefaultCasesWidget,
  LAYOUT_CONTAINER_CLASSES,
  getPanelClasses,
} from '../types/panel-layout';

const STORAGE_KEY = 'cases-layout';
const ALLOWED_WIDGETS: WidgetType[] = ['cases'];

const DEFAULT_CONFIG: PanelLayoutConfig = {
  layout: '1:1',
  panels: [
    { ...createDefaultCasesWidget('panel-0'), showClosed: false },
    { ...createDefaultCasesWidget('panel-1'), showClosed: true },
  ],
};

function CasesContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, setLayout, updatePanel, setPanelType, allowedWidgets, resetToDefault } = usePanelLayout();

  const [isCreating, setIsCreating] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const createMutation = useMutation({
    mutationFn: (name: string) => createCase({ case_name: name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setIsCreating(false);
      setNewCaseName('');
      // Navigate to the new case
      navigate(`/cases/${data.case.id}`);
    },
  });

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportCaseListPdf();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleCreateCase = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (newCaseName.trim()) {
        createMutation.mutate(newCaseName.trim());
      }
    },
    [newCaseName, createMutation]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Case Files"
        subtitle="All your active and archived matters"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-hover border border-border rounded-lg transition-colors disabled:opacity-50"
              title="Export active cases as PDF"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
            <LayoutSelector value={config.layout} onChange={setLayout} onReset={resetToDefault} />
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add case</span>
            </button>
          </div>
        }
      />

      {/* Quick Add Form */}
      {isCreating && (
        <div className="mx-4 mt-4 bg-bg-surface rounded-lg border border-border p-4 shadow-sm transition-colors">
          <form onSubmit={handleCreateCase} className="flex items-center gap-3">
            <input
              type="text"
              value={newCaseName}
              onChange={(e) => setNewCaseName(e.target.value)}
              placeholder="Enter case name (e.g., Martinez v. City of LA)"
              className="
                flex-1 px-3 py-2 rounded-lg border border-border
                bg-bg-hover text-text placeholder-text-muted
                focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                outline-none text-sm transition-colors
              "
              autoFocus
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !newCaseName.trim()}
              className="
                px-4 py-2 bg-primary-600 text-white rounded-lg
                hover:bg-primary-700 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                text-sm font-medium inline-flex items-center gap-2
              "
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewCaseName('');
              }}
              className="
                px-4 py-2 text-text-secondary rounded-lg
                hover:bg-bg-hover transition-colors
                text-sm font-medium
              "
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Cases Panels Grid */}
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

export function Cases() {
  return (
    <PanelLayoutProvider
      storageKey={STORAGE_KEY}
      allowedWidgets={ALLOWED_WIDGETS}
      defaultConfig={DEFAULT_CONFIG}
    >
      <CasesContent />
    </PanelLayoutProvider>
  );
}
