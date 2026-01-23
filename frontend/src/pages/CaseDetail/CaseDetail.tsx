import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, FileText, CheckSquare, Clock, StickyNote, Settings } from 'lucide-react';
import { PageContent } from '../../components/layout';
import { ConfirmModal } from '../../components/common';
import { getCase, getConstants, updateCase, deleteCase } from '../../api';
import type { Case } from '../../types';
import { OverviewTab, TasksTab, EventsTab, NotesTab, SettingsTab } from './tabs';
import { CaseHeader } from './components';

type TabType = 'overview' | 'tasks' | 'events' | 'notes' | 'settings';

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const caseId = parseInt(id || '0', 10);

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateCaseMutation = useMutation({
    mutationFn: (data: Partial<Case>) => updateCase(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      navigate('/cases');
    },
  });

  const handleUpdateField = useCallback(
    async (field: string, value: string | number | null) => {
      await updateCaseMutation.mutateAsync({ [field]: value });
    },
    [updateCaseMutation]
  );

  const handleDelete = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(() => {
    deleteCaseMutation.mutate();
    setShowDeleteModal(false);
  }, [deleteCaseMutation]);

  const statusOptions = useMemo(
    () =>
      (constants?.case_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400">Case not found</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: FileText },
    { id: 'tasks' as TabType, label: 'Tasks', icon: CheckSquare, count: caseData.tasks?.length },
    { id: 'events' as TabType, label: 'Events', icon: Clock, count: caseData.events?.length },
    { id: 'notes' as TabType, label: 'Notes', icon: StickyNote, count: caseData.notes?.length },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <CaseHeader
        caseData={caseData}
        statusOptions={statusOptions}
        onUpdateField={handleUpdateField}
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 px-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <PageContent variant="full">
          <OverviewTab
            caseData={caseData}
            caseId={caseId}
            constants={constants}
            onUpdateField={handleUpdateField}
          />
        </PageContent>
      )}
      {activeTab === 'tasks' && (
        <PageContent>
          <TasksTab caseId={caseId} tasks={caseData.tasks || []} constants={constants} />
        </PageContent>
      )}
      {activeTab === 'events' && (
        <PageContent>
          <EventsTab caseId={caseId} events={caseData.events || []} />
        </PageContent>
      )}
      {activeTab === 'notes' && (
        <PageContent>
          <NotesTab caseId={caseId} notes={caseData.notes || []} />
        </PageContent>
      )}
      {activeTab === 'settings' && (
        <PageContent>
          <SettingsTab
            caseId={caseId}
            caseName={caseData.case_name}
            activities={caseData.activities || []}
            onDelete={handleDelete}
          />
        </PageContent>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Case"
        message={`Are you sure you want to delete "${caseData.case_name}"? This will permanently remove the case and all associated tasks, events, and notes. This action cannot be undone.`}
        confirmText="Delete Case"
        variant="danger"
        isLoading={deleteCaseMutation.isPending}
      />
    </>
  );
}
