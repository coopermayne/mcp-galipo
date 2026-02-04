/**
 * Persons - Contact management page
 *
 * Route: /persons
 *
 * Features:
 * - PersonsWidget for browsing/filtering persons
 * - Customizable layout (1, 1:1, etc.)
 * - Quick person creation
 * - Manage person types
 *
 * Uses the universal panel layout system with allowedWidgets=['persons'].
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings, X, Trash2, Loader2 } from 'lucide-react';
import { Header } from '../components/layout';
import { LayoutSelector, PanelContainer } from '../components/panels';
import { PanelLayoutProvider, usePanelLayout } from '../context/PanelLayoutContext';
import {
  getPersons,
  getPersonTypes,
  createPersonType,
  deletePersonType,
} from '../api';
import type { PanelLayoutConfig, WidgetType } from '../types/panel-layout';
import {
  createDefaultPersonsWidget,
  LAYOUT_CONTAINER_CLASSES,
  getPanelClasses,
} from '../types/panel-layout';
import type { PersonTypeRecord } from '../types';

const STORAGE_KEY = 'persons-layout';
const ALLOWED_WIDGETS: WidgetType[] = ['persons'];

const DEFAULT_CONFIG: PanelLayoutConfig = {
  layout: '1:1',
  panels: [
    { ...createDefaultPersonsWidget('panel-0'), groupBy: 'alpha' },
    { ...createDefaultPersonsWidget('panel-1'), groupBy: 'type' },
  ],
};

// Manage Types Modal
function ManageTypesModal({
  isOpen,
  onClose,
  personTypes,
  typeCounts,
}: {
  isOpen: boolean;
  onClose: () => void;
  personTypes: PersonTypeRecord[];
  typeCounts: Record<string, number>;
}) {
  const queryClient = useQueryClient();
  const [newTypeName, setNewTypeName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (name: string) => createPersonType(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-types'] });
      setNewTypeName('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePersonType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-types'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTypeName.trim()) {
      createMutation.mutate(newTypeName.trim().toLowerCase());
    }
  };

  const handleDelete = (pt: PersonTypeRecord) => {
    const count = typeCounts[pt.name] || 0;
    if (count > 0) {
      setError(`Cannot delete "${pt.name}": ${count} person(s) use this type`);
      return;
    }
    deleteMutation.mutate(pt.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Manage Person Types
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-3 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Add new type */}
          <form onSubmit={handleCreate} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="New type name..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !newTypeName.trim()}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium inline-flex items-center gap-1"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </form>

          {/* Types list */}
          <div className="space-y-1">
            {personTypes.map((pt) => {
              const count = typeCounts[pt.name] || 0;

              return (
                <div
                  key={pt.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-hover group"
                >
                  <span className="flex-1 text-sm text-text capitalize">
                    {pt.name}
                  </span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {count} {count === 1 ? 'person' : 'persons'}
                  </span>
                  <button
                    onClick={() => handleDelete(pt)}
                    disabled={deleteMutation.isPending || count > 0}
                    className={`p-1 transition-opacity ${
                      count > 0
                        ? 'text-text-muted cursor-not-allowed'
                        : 'text-text-muted hover:text-red-600 opacity-0 group-hover:opacity-100'
                    }`}
                    title={count > 0 ? `Cannot delete: ${count} person(s) use this type` : 'Delete type'}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-text-secondary bg-bg-hover rounded-lg hover:bg-bg-elevated transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonsContent() {
  const { config, setLayout, updatePanel, setPanelType, allowedWidgets, resetToDefault } = usePanelLayout();

  const [showManageTypes, setShowManageTypes] = useState(false);

  // Fetch all persons to get type counts
  const { data: allPersonsData } = useQuery({
    queryKey: ['persons', { all: true }],
    queryFn: () => getPersons({ limit: 10000 }),
  });

  const { data: personTypesData } = useQuery({
    queryKey: ['person-types'],
    queryFn: getPersonTypes,
  });

  // Calculate type counts from all persons
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const allPersons = allPersonsData?.persons;
    if (allPersons) {
      for (const p of allPersons) {
        counts[p.person_type] = (counts[p.person_type] || 0) + 1;
      }
    }
    return counts;
  }, [allPersonsData?.persons]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header
        title="Persons"
        subtitle="Clients, attorneys, judges, experts, and other contacts"
        actions={
          <div className="flex items-center gap-2">
            <LayoutSelector value={config.layout} onChange={setLayout} onReset={resetToDefault} />
            <button
              onClick={() => setShowManageTypes(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
              title="Manage person types"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Types</span>
            </button>
          </div>
        }
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

      {/* Manage Types Modal */}
      <ManageTypesModal
        isOpen={showManageTypes}
        onClose={() => setShowManageTypes(false)}
        personTypes={personTypesData?.person_types || []}
        typeCounts={typeCounts}
      />
    </div>
  );
}

export function Persons() {
  return (
    <PanelLayoutProvider
      storageKey={STORAGE_KEY}
      allowedWidgets={ALLOWED_WIDGETS}
      defaultConfig={DEFAULT_CONFIG}
    >
      <PersonsContent />
    </PanelLayoutProvider>
  );
}
