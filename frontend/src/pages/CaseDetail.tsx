import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Header, PageContent } from '../components/layout';
import {
  EditableText,
  EditableSelect,
  EditableDate,
  StatusBadge,
  ConfirmModal,
} from '../components/common';
import { SortableTaskRow } from '../components/tasks';
import {
  getCase,
  getConstants,
  updateCase,
  deleteCase,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
  createDeadline,
  updateDeadline,
  deleteDeadline,
  createNote,
  deleteNote,
  createPerson,
  assignPersonToCase,
  removePersonFromCase,
} from '../api/client';
import type { Case, Task, Deadline, Note, Constants, CaseNumber, Jurisdiction } from '../types';
import {
  Loader2,
  Trash2,
  Plus,
  Users,
  UserCog,
  Building2,
  FileText,
  CheckSquare,
  Clock,
  StickyNote,
  Phone,
  Mail,
  Calendar,
  Star,
  Hash,
  Link,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Settings,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

type TabType = 'overview' | 'tasks' | 'deadlines' | 'notes' | 'settings';

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
    { id: 'deadlines' as TabType, label: 'Deadlines', icon: Clock, count: caseData.deadlines?.length },
    { id: 'notes' as TabType, label: 'Notes', icon: StickyNote, count: caseData.notes?.length },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <Header breadcrumbLabel={caseData.short_name || caseData.case_name} />

      {/* Case Title Section */}
      <div className="px-6 py-4">
        <div className="flex-1 min-w-0">
          <EditableText
            value={caseData.case_name}
            onSave={(value) => handleUpdateField('case_name', value)}
            className="text-2xl font-semibold"
          />
          <EditableText
            value={caseData.short_name || ''}
            onSave={(value) => handleUpdateField('short_name', value || null)}
            placeholder="Set short name..."
            maxLength={10}
            className="text-sm text-slate-500 dark:text-slate-400 mt-1"
          />
          <div className="flex items-center gap-3 mt-2">
            <EditableSelect
              value={caseData.status}
              options={statusOptions}
              onSave={(value) => handleUpdateField('status', value)}
              renderValue={(value) => <StatusBadge status={value} />}
            />
            {caseData.court && (
              <span className="text-slate-500 dark:text-slate-400 text-sm">{caseData.court}</span>
            )}
          </div>
        </div>
      </div>

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
      {activeTab === 'deadlines' && (
        <PageContent>
          <DeadlinesTab caseId={caseId} deadlines={caseData.deadlines || []} />
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
        message={`Are you sure you want to delete "${caseData.case_name}"? This will permanently remove the case and all associated tasks, deadlines, and notes. This action cannot be undone.`}
        confirmText="Delete Case"
        variant="danger"
        isLoading={deleteCaseMutation.isPending}
      />
    </>
  );
}

// Helper to get primary phone/email from arrays
function getPrimaryPhone(phones: Array<{ value: string; label?: string; primary?: boolean }> | undefined): string | null {
  if (!phones || phones.length === 0) return null;
  const primary = phones.find(p => p.primary);
  return primary?.value || phones[0]?.value || null;
}

function getPrimaryEmail(emails: Array<{ value: string; label?: string; primary?: boolean }> | undefined): string | null {
  if (!emails || emails.length === 0) return null;
  const primary = emails.find(e => e.primary);
  return primary?.value || emails[0]?.value || null;
}

// Overview Tab Component
function OverviewTab({
  caseData,
  caseId,
  constants,
  onUpdateField,
}: {
  caseData: Case;
  caseId: number;
  constants: Constants | undefined;
  onUpdateField: (field: string, value: string | number | null) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddDefendant, setShowAddDefendant] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', is_primary: false });
  const [newDefendantName, setNewDefendantName] = useState('');
  const [newContact, setNewContact] = useState({ name: '', role: 'Opposing Counsel', organization: '', phone: '', email: '' });

  // Filter persons by role
  const clients = useMemo(
    () => (caseData.persons || []).filter(p => p.role === 'Client'),
    [caseData.persons]
  );

  const defendants = useMemo(
    () => (caseData.persons || []).filter(p => p.role === 'Defendant'),
    [caseData.persons]
  );

  const contacts = useMemo(
    () => (caseData.persons || []).filter(p => p.role !== 'Client' && p.role !== 'Defendant'),
    [caseData.persons]
  );

  const jurisdictionOptions = useMemo(
    () =>
      (constants?.jurisdictions || []).map((j: Jurisdiction) => ({
        value: String(j.id),
        label: j.name,
      })),
    [constants]
  );

  const currentJurisdiction = useMemo(
    () => constants?.jurisdictions?.find((j: Jurisdiction) => j.id === caseData.court_id),
    [constants, caseData.court_id]
  );

  // Common contact roles
  const contactRoleOptions = [
    'Opposing Counsel', 'Co-Counsel', 'Referring Attorney', 'Mediator',
    'Judge', 'Magistrate Judge', 'Expert - Plaintiff', 'Expert - Defendant',
    'Witness', 'Guardian Ad Litem', 'Insurance Adjuster', 'Lien Holder'
  ];

  const addClientMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string; is_primary?: boolean }) => {
      // First create the person
      const personResult = await createPerson({
        person_type: 'client',
        name: data.name,
        phones: data.phone ? [{ value: data.phone, primary: true }] : [],
        emails: data.email ? [{ value: data.email, primary: true }] : [],
      });
      // Then assign to case
      return assignPersonToCase(caseId, {
        person_id: personResult.person.id,
        role: 'Client',
        side: 'plaintiff',
        is_primary: data.is_primary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewClient({ name: '', phone: '', email: '', is_primary: false });
      setShowAddClient(false);
    },
  });

  const removeClientMutation = useMutation({
    mutationFn: (personId: number) => removePersonFromCase(caseId, personId, 'Client'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const addDefendantMutation = useMutation({
    mutationFn: async (name: string) => {
      // Create person and assign to case
      const personResult = await createPerson({
        person_type: 'defendant',
        name: name,
      });
      return assignPersonToCase(caseId, {
        person_id: personResult.person.id,
        role: 'Defendant',
        side: 'defendant',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewDefendantName('');
      setShowAddDefendant(false);
    },
  });

  const removeDefendantMutation = useMutation({
    mutationFn: (personId: number) => removePersonFromCase(caseId, personId, 'Defendant'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: { name: string; role: string; organization?: string; phone?: string; email?: string }) => {
      // Determine person type and side based on role
      let personType = 'attorney';
      let side: 'plaintiff' | 'defendant' | 'neutral' = 'neutral';

      if (data.role.includes('Judge') || data.role === 'Mediator') {
        personType = data.role.includes('Judge') ? 'judge' : 'mediator';
        side = 'neutral';
      } else if (data.role.includes('Expert')) {
        personType = 'expert';
        side = data.role.includes('Plaintiff') ? 'plaintiff' : 'defendant';
      } else if (data.role === 'Opposing Counsel') {
        side = 'defendant';
      } else if (data.role === 'Co-Counsel' || data.role === 'Referring Attorney') {
        side = 'plaintiff';
      } else if (data.role === 'Guardian Ad Litem') {
        personType = 'guardian';
      } else if (data.role === 'Insurance Adjuster') {
        personType = 'insurance_adjuster';
      } else if (data.role === 'Lien Holder') {
        personType = 'lien_holder';
      } else if (data.role === 'Witness') {
        personType = 'witness';
      }

      const personResult = await createPerson({
        person_type: personType,
        name: data.name,
        organization: data.organization || undefined,
        phones: data.phone ? [{ value: data.phone, primary: true }] : [],
        emails: data.email ? [{ value: data.email, primary: true }] : [],
      });
      return assignPersonToCase(caseId, {
        person_id: personResult.person.id,
        role: data.role,
        side: side,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewContact({ name: '', role: 'Opposing Counsel', organization: '', phone: '', email: '' });
      setShowAddContact(false);
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: ({ personId, role }: { personId: number; role?: string }) =>
      removePersonFromCase(caseId, personId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Case Details */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Case Details</h3>
        <div className="space-y-3">
          <Field label="Court">
            <div className="flex items-center gap-2">
              <EditableSelect
                value={caseData.court_id ? String(caseData.court_id) : ''}
                options={jurisdictionOptions}
                onSave={(value) => onUpdateField('court_id', value ? parseInt(value, 10) : null)}
              />
              {currentJurisdiction?.local_rules_link && (
                <a
                  href={currentJurisdiction.local_rules_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300"
                  title="View local rules"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </Field>
          <Field label="Print Code">
            <EditableText
              value={caseData.print_code || ''}
              onSave={(value) => onUpdateField('print_code', value || null)}
              placeholder="Enter code"
              inputClassName="font-mono"
            />
          </Field>
          <Field label="Result">
            <EditableText
              value={caseData.result || ''}
              onSave={(value) => onUpdateField('result', value || null)}
              placeholder="e.g., Settled, Verdict"
            />
          </Field>
        </div>

        {/* Case Numbers */}
        <CaseNumbersSection
          caseId={caseId}
          caseNumbers={caseData.case_numbers}
        />
      </div>

      {/* Important Dates & Starred Deadlines */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Key Dates</h3>
        </div>
        <div className="space-y-3">
          <Field label="Date of Injury">
            <EditableDate
              value={caseData.date_of_injury || null}
              onSave={(value) => onUpdateField('date_of_injury', value)}
              placeholder="Select date"
            />
          </Field>
          {/* Starred Deadlines */}
          <StarredDeadlines deadlines={caseData.deadlines || []} />
        </div>
      </div>

      {/* Case Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 lg:col-span-2">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Case Summary</h3>
        <EditableText
          value={caseData.case_summary || ''}
          onSave={(value) => onUpdateField('case_summary', value || null)}
          placeholder="Enter case summary..."
          multiline
          className="w-full"
          inputClassName="w-full min-h-[100px]"
        />
      </div>

      {/* Clients/Plaintiffs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Clients/Plaintiffs</h3>
          </div>
          <button
            onClick={() => setShowAddClient(!showAddClient)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {showAddClient && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newClient.name.trim()) {
                addClientMutation.mutate({
                  name: newClient.name.trim(),
                  phone: newClient.phone || undefined,
                  email: newClient.email || undefined,
                  is_primary: newClient.is_primary,
                });
              }
            }}
            className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg space-y-2"
          >
            <input
              type="text"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              placeholder="Client name *"
              className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="tel"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder="Phone"
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
              <input
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="Email"
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newClient.is_primary}
                onChange={(e) => setNewClient({ ...newClient, is_primary: e.target.checked })}
                className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
              />
              Primary plaintiff
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClient(false)}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addClientMutation.isPending || !newClient.name.trim()}
                className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm disabled:opacity-50"
              >
                Add Client
              </button>
            </div>
          </form>
        )}
        {clients.length === 0 && !showAddClient ? (
          <p className="text-sm text-slate-400">No clients linked</p>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.assignment_id}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg group relative"
              >
                <button
                  onClick={() => removeClientMutation.mutate(client.id)}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{client.name}</p>
                  {client.is_primary && (
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {getPrimaryPhone(client.phones) && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {getPrimaryPhone(client.phones)}
                    </p>
                  )}
                  {getPrimaryEmail(client.emails) && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {getPrimaryEmail(client.emails)}
                    </p>
                  )}
                  {client.contact_via_name && (
                    <p className="text-xs text-slate-500 italic">
                      Contact via: {client.contact_via_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Defendants */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Defendants</h3>
          </div>
          <button
            onClick={() => setShowAddDefendant(!showAddDefendant)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {showAddDefendant && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newDefendantName.trim()) addDefendantMutation.mutate(newDefendantName.trim());
            }}
            className="mb-3 flex gap-2"
          >
            <input
              type="text"
              value={newDefendantName}
              onChange={(e) => setNewDefendantName(e.target.value)}
              placeholder="Defendant name"
              className="flex-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <button
              type="submit"
              disabled={addDefendantMutation.isPending}
              className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}
        {defendants.length === 0 && !showAddDefendant ? (
          <p className="text-sm text-slate-400">No defendants linked</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {defendants.map((defendant) => (
              <span
                key={defendant.assignment_id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-sm group"
              >
                {defendant.name}
                <button
                  onClick={() => removeDefendantMutation.mutate(defendant.id)}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Contacts</h3>
          </div>
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {showAddContact && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newContact.name.trim() && newContact.role) {
                addContactMutation.mutate({
                  name: newContact.name.trim(),
                  role: newContact.role,
                  organization: newContact.organization || undefined,
                  phone: newContact.phone || undefined,
                  email: newContact.email || undefined,
                });
              }
            }}
            className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Contact name *"
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
              <select
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              >
                {contactRoleOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newContact.organization}
                onChange={(e) => setNewContact({ ...newContact, organization: e.target.value })}
                placeholder="Firm / Organization"
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
              <input
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="Phone"
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
              <input
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="Email"
                className="md:col-span-2 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddContact(false)}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addContactMutation.isPending || !newContact.name.trim()}
                className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm disabled:opacity-50"
              >
                Add Contact
              </button>
            </div>
          </form>
        )}
        {contacts.length === 0 && !showAddContact ? (
          <p className="text-sm text-slate-400">No contacts linked</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((contact) => (
              <div
                key={contact.assignment_id}
                className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg group relative"
              >
                <button
                  onClick={() => removeContactMutation.mutate({ personId: contact.id, role: contact.role })}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{contact.name}</p>
                {contact.role && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded text-xs">
                    {contact.role}
                  </span>
                )}
                {contact.organization && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{contact.organization}</p>
                )}
                <div className="mt-1 space-y-0.5">
                  {getPrimaryPhone(contact.phones) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {getPrimaryPhone(contact.phones)}
                    </p>
                  )}
                  {getPrimaryEmail(contact.emails) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {getPrimaryEmail(contact.emails)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({
  caseId,
  tasks,
  constants,
}: {
  caseId: number;
  tasks: Task[];
  constants: Constants | undefined;
}) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const createMutation = useMutation({
    mutationFn: (description: string) =>
      createTask({ case_id: caseId, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTask('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ taskId, sortOrder }: { taskId: number; sortOrder: number }) =>
      reorderTask(taskId, sortOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const taskStatusOptions = useMemo(
    () =>
      (constants?.task_statuses || []).map((s: string) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  const urgencyOptions = [
    { value: '1', label: '1 - Lowest' },
    { value: '2', label: '2 - Low' },
    { value: '3', label: '3 - Medium' },
    { value: '4', label: '4 - High' },
    { value: '5', label: '5 - Critical' },
  ];

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      createMutation.mutate(newTask.trim());
    }
  };

  const handleUpdate = useCallback(
    async (taskId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (taskId: number, description: string) => {
      setDeleteTarget({ id: taskId, description });
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // Calculate new sort_order for insertion between two tasks
  const calculateNewSortOrder = useCallback((reorderedTasks: Task[], oldIndex: number, newIndex: number): number => {
    if (reorderedTasks.length === 0) return 1000;

    // If moving to the beginning
    if (newIndex === 0) {
      return (reorderedTasks[0]?.sort_order || 1000) - 500;
    }

    // If moving to the end
    if (newIndex >= reorderedTasks.length) {
      return (reorderedTasks[reorderedTasks.length - 1]?.sort_order || 0) + 1000;
    }

    // Moving between two items
    const prevTask = reorderedTasks[newIndex - 1];
    const nextTask = reorderedTasks[newIndex];

    // Handle case where we're moving down
    if (oldIndex < newIndex) {
      return Math.floor(((nextTask?.sort_order || 0) + (reorderedTasks[newIndex + 1]?.sort_order || (nextTask?.sort_order || 0) + 1000)) / 2);
    }

    // Moving up
    return Math.floor(((prevTask?.sort_order || 0) + (nextTask?.sort_order || (prevTask?.sort_order || 0) + 1000)) / 2);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;
    if (active.id === over.id) return;

    const activeTaskItem = tasks.find((t) => t.id === active.id);
    const overTask = tasks.find((t) => t.id === over.id);
    if (!activeTaskItem || !overTask) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== newIndex) {
      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
      const newSortOrder = calculateNewSortOrder(reorderedTasks, oldIndex, newIndex);

      reorderMutation.mutate({
        taskId: activeTaskItem.id,
        sortOrder: newSortOrder,
      });
    }
  }, [tasks, calculateNewSortOrder, reorderMutation]);

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {/* Quick Add */}
        <form onSubmit={handleCreate} className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a new task..."
              className="
                flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400
                focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                outline-none text-sm
              "
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !newTask.trim()}
              className="
                px-4 py-2 bg-primary-600 text-white rounded-lg
                hover:bg-primary-700 transition-colors
                disabled:opacity-50 text-sm font-medium
                inline-flex items-center gap-2
              "
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </form>

        {/* Task List with Drag and Drop */}
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No tasks</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    showCaseBadge={false}
                    showUrgency={true}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeTask && (
                <div className="shadow-xl rounded-lg overflow-hidden">
                  <SortableTaskRow
                    task={activeTask}
                    taskStatusOptions={taskStatusOptions}
                    urgencyOptions={urgencyOptions}
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    showCaseBadge={false}
                    showUrgency={true}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete this task?`}
        confirmText="Delete Task"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

// Deadlines Tab Component
function DeadlinesTab({
  caseId,
  deadlines,
}: {
  caseId: number;
  deadlines: Deadline[];
}) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newDeadline, setNewDeadline] = useState({ date: '', description: '', calculation_note: '', starred: false });

  const createMutation = useMutation({
    mutationFn: () =>
      createDeadline({
        case_id: caseId,
        date: newDeadline.date,
        description: newDeadline.description,
        calculation_note: newDeadline.calculation_note || undefined,
        starred: newDeadline.starred,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewDeadline({ date: '', description: '', calculation_note: '', starred: false });
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deadline> }) =>
      updateDeadline(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDeadline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDeadline.date && newDeadline.description.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Add Button or Form */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        {isAdding ? (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date *</label>
                <input
                  type="date"
                  value={newDeadline.date}
                  onChange={(e) => setNewDeadline({ ...newDeadline, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Description *</label>
                <input
                  type="text"
                  value={newDeadline.description}
                  onChange={(e) => setNewDeadline({ ...newDeadline, description: e.target.value })}
                  placeholder="e.g., Discovery cutoff"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Calculation Note</label>
              <input
                type="text"
                value={newDeadline.calculation_note}
                onChange={(e) => setNewDeadline({ ...newDeadline, calculation_note: e.target.value })}
                placeholder="e.g., 30 days from service date"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={newDeadline.starred}
                  onChange={(e) => setNewDeadline({ ...newDeadline, starred: e.target.checked })}
                  className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
                />
                <Star className="w-3 h-3 text-amber-500" />
                Show in Key Dates
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newDeadline.date || !newDeadline.description.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Add Deadline
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <Plus className="w-4 h-4" />
            Add Deadline
          </button>
        )}
      </div>

      {/* Deadline List */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {deadlines.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No deadlines</div>
        ) : (
          deadlines.map((deadline) => (
            <div key={deadline.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
              <div className="px-4 py-3 flex items-center gap-4">
                <button
                  onClick={() => setExpandedId(expandedId === deadline.id ? null : deadline.id)}
                  className="p-1 text-slate-500 hover:text-slate-300"
                >
                  {expandedId === deadline.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() =>
                    updateMutation.mutate({ id: deadline.id, data: { starred: !deadline.starred } })
                  }
                  className={`p-1 ${deadline.starred ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                  title={deadline.starred ? 'Remove from Key Dates' : 'Add to Key Dates'}
                >
                  <Star className={`w-4 h-4 ${deadline.starred ? 'fill-amber-500' : ''}`} />
                </button>
                <EditableDate
                  value={deadline.date}
                  onSave={(value) =>
                    updateMutation.mutateAsync({ id: deadline.id, data: { date: value || undefined } })
                  }
                />
                <div className="flex-1 min-w-0">
                  <EditableText
                    value={deadline.description}
                    onSave={(value) =>
                      updateMutation.mutateAsync({ id: deadline.id, data: { description: value } })
                    }
                    className="text-sm"
                  />
                </div>
                {deadline.document_link && (
                  <a
                    href={deadline.document_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-primary-400 hover:text-primary-300"
                    title="View document"
                  >
                    <Link className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => deleteMutation.mutate(deadline.id)}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Expanded Details */}
              {expandedId === deadline.id && (
                <div className="px-4 pb-3 pl-12 space-y-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Document Link</label>
                    <EditableText
                      value={deadline.document_link || ''}
                      onSave={(value) =>
                        updateMutation.mutateAsync({ id: deadline.id, data: { document_link: value || undefined } })
                      }
                      placeholder="Enter URL to related document"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Calculation Note</label>
                    <EditableText
                      value={deadline.calculation_note || ''}
                      onSave={(value) =>
                        updateMutation.mutateAsync({ id: deadline.id, data: { calculation_note: value || undefined } })
                      }
                      placeholder="e.g., 30 days from service date"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Notes Tab Component
function NotesTab({ caseId, notes }: { caseId: number; notes: Note[] }) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');

  const createMutation = useMutation({
    mutationFn: (content: string) => createNote(caseId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewNote('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      createMutation.mutate(newNote.trim());
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : dateStr;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Add Note */}
      <form onSubmit={handleCreate} className="p-4 border-b border-slate-200 dark:border-slate-700">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="
            w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400
            focus:border-primary-500 focus:ring-1 focus:ring-primary-500
            outline-none text-sm resize-none min-h-[80px]
          "
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={createMutation.isPending || !newNote.trim()}
            className="
              px-4 py-2 bg-primary-600 text-white rounded-lg
              hover:bg-primary-700 transition-colors
              disabled:opacity-50 text-sm font-medium
              inline-flex items-center gap-2
            "
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notes</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatDate(note.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({
  caseId: _caseId,
  caseName,
  activities,
  onDelete,
}: {
  caseId: number;
  caseName: string;
  activities: import('../types').Activity[];
  onDelete: () => void;
}) {
  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Activity Log */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Activity Log</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Recent activities and time entries for this case
          </p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No activities recorded
            </div>
          ) : (
            activities.slice(0, 20).map((activity) => (
              <div key={activity.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-slate-100">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(activity.date)}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        {activity.type}
                      </span>
                      {activity.minutes && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {activity.minutes} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-900/50">
        <div className="px-4 py-3 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded-t-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Delete this case</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Permanently delete "{caseName}" and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={onDelete}
              className="
                inline-flex items-center gap-2 px-4 py-2
                bg-red-600 text-white rounded-lg
                hover:bg-red-700 transition-colors
                text-sm font-medium
              "
            >
              <Trash2 className="w-4 h-4" />
              Delete Case
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Case Numbers Section Component
function CaseNumbersSection({
  caseId,
  caseNumbers,
}: {
  caseId: number;
  caseNumbers: CaseNumber[];
}) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newNumber, setNewNumber] = useState({ number: '', label: '', primary: false });

  const updateMutation = useMutation({
    mutationFn: (numbers: CaseNumber[]) => updateCase(caseId, { case_numbers: numbers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNumber.number.trim()) {
      const updated = [
        ...caseNumbers.map((n) => (newNumber.primary ? { ...n, primary: false } : n)),
        { number: newNumber.number.trim(), label: newNumber.label.trim() || 'Case No.', primary: newNumber.primary },
      ];
      updateMutation.mutate(updated);
      setNewNumber({ number: '', label: '', primary: false });
      setShowAdd(false);
    }
  };

  const handleRemove = (index: number) => {
    const updated = caseNumbers.filter((_, i) => i !== index);
    updateMutation.mutate(updated);
  };

  const handleSetPrimary = (index: number) => {
    const updated = caseNumbers.map((n, i) => ({ ...n, primary: i === index }));
    updateMutation.mutate(updated);
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Case Numbers</span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-3 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNumber.number}
              onChange={(e) => setNewNumber({ ...newNumber, number: e.target.value })}
              placeholder="Case number *"
              className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
            />
            <input
              type="text"
              value={newNumber.label}
              onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })}
              placeholder="Label (e.g., State)"
              className="w-28 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newNumber.primary}
                onChange={(e) => setNewNumber({ ...newNumber, primary: e.target.checked })}
                className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
              />
              Primary
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending || !newNumber.number.trim()}
                className="px-2 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {caseNumbers.length === 0 && !showAdd ? (
        <p className="text-xs text-slate-500">No case numbers</p>
      ) : (
        <div className="space-y-1">
          {caseNumbers.map((cn, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-slate-700 rounded group text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-700 dark:text-slate-200">{cn.number}</span>
                {cn.label && (
                  <span className="text-xs text-slate-500">({cn.label})</span>
                )}
                {cn.primary && (
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!cn.primary && (
                  <button
                    onClick={() => handleSetPrimary(index)}
                    title="Set as primary"
                    className="p-0.5 text-slate-500 hover:text-amber-500"
                  >
                    <Star className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleRemove(index)}
                  className="p-0.5 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Starred Deadlines Component - shows starred deadlines in the Key Dates section
function StarredDeadlines({
  deadlines,
}: {
  deadlines: Deadline[];
}) {
  const starredDeadlines = useMemo(
    () => deadlines.filter(d => d.starred),
    [deadlines]
  );

  if (starredDeadlines.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy') : dateStr;
  };

  return (
    <>
      {starredDeadlines.map((deadline) => (
        <div key={deadline.id} className="flex items-center gap-4">
          <span className="text-sm text-slate-400 w-32 shrink-0 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            {deadline.description.length > 20
              ? deadline.description.substring(0, 20) + '...'
              : deadline.description}
          </span>
          <span className="text-sm text-slate-900 dark:text-slate-100">
            {formatDate(deadline.date)}
          </span>
        </div>
      ))}
    </>
  );
}

// Field Component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-400 w-32 shrink-0">{label}</span>
      {children}
    </div>
  );
}
