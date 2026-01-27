import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Building2,
  Plus,
  Phone,
  Mail,
  Calendar,
  Star,
  ChevronDown,
  CheckSquare,
  Clock,
  Building,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import {
  EditableText,
  EditableDate,
  EditableTime,
  EditableSelect,
  StatusBadge,
  UrgencyBadge,
} from '../../../components/common';
import { useEntityModal } from '../../../components/modals';
import {
  createPerson,
  assignPersonToCase,
  updateTask,
  updateEvent,
} from '../../../api';
import type { Case, Constants, Task, Event, CasePerson } from '../../../types';
import { ProceedingsSection } from '../components';
import { getPrimaryPhone, getPrimaryEmail } from '../utils';

interface OverviewTabProps {
  caseData: Case;
  caseId: number;
  constants: Constants | undefined;
  onUpdateField: (field: string, value: string | number | null) => Promise<void>;
}

// Compact person chip with contact icons
function PersonChip({
  person,
  onOpenDetail,
  showStar = false,
  variant = 'default'
}: {
  person: CasePerson;
  onOpenDetail: () => void;
  showStar?: boolean;
  variant?: 'default' | 'primary' | 'muted';
}) {
  const [expanded, setExpanded] = useState(false);
  const phone = getPrimaryPhone(person.phones);
  const email = getPrimaryEmail(person.emails);
  const hasOrg = !!person.organization;
  const hasContact = phone || email || hasOrg;

  const baseClass = variant === 'primary'
    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200'
    : variant === 'muted'
    ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200';

  return (
    <div className="relative">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${baseClass}`}>
        {showStar && person.is_primary && (
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        )}
        <span
          className="font-medium cursor-pointer hover:underline"
          onClick={onOpenDetail}
        >
          {person.name}
        </span>
        {person.role && !['Client', 'Defendant'].includes(person.role) && (
          <span className="text-xs opacity-70">({person.role})</span>
        )}
        {/* Contact icons - expand on click */}
        {hasContact && (
          <span
            className="flex items-center gap-0.5 ml-1 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {phone && <Phone className="w-3 h-3 opacity-50" />}
            {email && <Mail className="w-3 h-3 opacity-50" />}
            {hasOrg && <Building className="w-3 h-3 opacity-50" />}
          </span>
        )}
      </div>
      {/* Expanded contact details */}
      {expanded && hasContact && (
        <div className="absolute z-10 top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg text-xs space-y-1 min-w-48">
          {hasOrg && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Building className="w-3 h-3" />
              {person.organization}
            </div>
          )}
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary-600">
              <Phone className="w-3 h-3" />
              {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary-600">
              <Mail className="w-3 h-3" />
              {email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Compact section header
function SectionHeader({
  icon: Icon,
  title,
  count,
  action
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h4>
        {count !== undefined && count > 0 && (
          <span className="text-xs text-slate-400">({count})</span>
        )}
      </div>
      {action}
    </div>
  );
}

export function OverviewTab({ caseData, caseId, constants, onUpdateField }: OverviewTabProps) {
  const queryClient = useQueryClient();
  const { openPersonModal } = useEntityModal();

  // UI State
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddDefendant, setShowAddDefendant] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [taskView, setTaskView] = useState<'urgency' | 'date'>('urgency');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Form state
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', is_primary: false });
  const [newDefendantName, setNewDefendantName] = useState('');
  const [newContact, setNewContact] = useState({ name: '', role: 'Opposing Counsel', organization: '', phone: '', email: '' });

  // Filter persons by role
  const clients = useMemo(() =>
    (caseData.persons || []).filter(p =>
      p.role === 'Client' || p.role === 'Guardian Ad Litem' || p.role === 'Plaintiff Contact'
    ), [caseData.persons]);

  const defendants = useMemo(() =>
    (caseData.persons || []).filter(p => p.role === 'Defendant'),
    [caseData.persons]);

  const judges = useMemo(() =>
    (caseData.persons || []).filter(p => p.role === 'Judge' || p.role === 'Magistrate Judge'),
    [caseData.persons]);

  const counsel = useMemo(() =>
    (caseData.persons || []).filter(p =>
      ['Opposing Counsel', 'Co-Counsel', 'Referring Attorney'].includes(p.role || '')
    ), [caseData.persons]);

  const experts = useMemo(() => {
    const all = (caseData.persons || []).filter(p =>
      p.role?.includes('Expert') || p.role?.includes('expert')
    );
    return all.sort((a, b) => {
      const aIsPlaintiff = a.role?.includes('Plaintiff') ? 0 : 1;
      const bIsPlaintiff = b.role?.includes('Plaintiff') ? 0 : 1;
      return aIsPlaintiff - bIsPlaintiff;
    });
  }, [caseData.persons]);

  const mediators = useMemo(() =>
    (caseData.persons || []).filter(p => p.role === 'Mediator'),
    [caseData.persons]);

  const otherContacts = useMemo(() =>
    (caseData.persons || []).filter(p =>
      !['Client', 'Defendant', 'Judge', 'Magistrate Judge', 'Opposing Counsel', 'Co-Counsel',
        'Referring Attorney', 'Guardian Ad Litem', 'Plaintiff Contact', 'Mediator'].includes(p.role || '') &&
      !p.role?.includes('Expert')
    ), [caseData.persons]);

  // Tasks filtering
  const tasks = caseData.tasks || [];
  const activeTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'Done'), [tasks]);
  const doneTasks = useMemo(() =>
    tasks.filter(t => t.status === 'Done')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tasks]);

  const sortedActiveTasks = useMemo(() => {
    if (taskView === 'urgency') {
      return [...activeTasks].sort((a, b) => b.urgency - a.urgency);
    }
    return [...activeTasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [activeTasks, taskView]);

  // Events filtering
  const events = caseData.events || [];
  const now = new Date();
  const futureEvents = useMemo(() =>
    events.filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events, now]);
  const pastEvents = useMemo(() =>
    events.filter(e => new Date(e.date) < now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events, now]);

  const starredEvents = useMemo(() =>
    events.filter(e => e.starred),
    [events]);

  // Contact role options
  const contactRoleOptions = [
    'Opposing Counsel', 'Co-Counsel', 'Referring Attorney', 'Mediator',
    'Expert - Plaintiff', 'Expert - Defendant',
    'Witness', 'Guardian Ad Litem', 'Plaintiff Contact', 'Insurance Adjuster', 'Lien Holder',
  ];

  // Mutations
  const addClientMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string; is_primary?: boolean }) => {
      const personResult = await createPerson({
        person_type: 'client',
        name: data.name,
        phones: data.phone ? [{ value: data.phone, primary: true }] : [],
        emails: data.email ? [{ value: data.email, primary: true }] : [],
      });
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

  const addDefendantMutation = useMutation({
    mutationFn: async (name: string) => {
      const personResult = await createPerson({ person_type: 'defendant', name });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role: 'Defendant', side: 'defendant' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewDefendantName('');
      setShowAddDefendant(false);
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: { name: string; role: string; organization?: string; phone?: string; email?: string }) => {
      let personType = 'attorney';
      let side: 'plaintiff' | 'defendant' | 'neutral' = 'neutral';

      if (data.role.includes('Judge') || data.role === 'Mediator') {
        personType = data.role.includes('Judge') ? 'judge' : 'mediator';
      } else if (data.role.includes('Expert')) {
        personType = 'expert';
        side = data.role.includes('Plaintiff') ? 'plaintiff' : 'defendant';
      } else if (data.role === 'Opposing Counsel') {
        side = 'defendant';
      } else if (['Co-Counsel', 'Referring Attorney'].includes(data.role)) {
        side = 'plaintiff';
      }

      const personResult = await createPerson({
        person_type: personType,
        name: data.name,
        organization: data.organization || undefined,
        phones: data.phone ? [{ value: data.phone, primary: true }] : [],
        emails: data.email ? [{ value: data.email, primary: true }] : [],
      });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role: data.role, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewContact({ name: '', role: 'Opposing Counsel', organization: '', phone: '', email: '' });
      setShowAddContact(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) => updateEvent(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const taskStatusOptions = (constants?.task_statuses || []).map(s => ({ value: s, label: s }));

  return (
    <div className="space-y-4">
      {/* Row 1: Case Info + Key Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Case Details & Court */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Court Proceedings */}
            <div>
              <ProceedingsSection
                caseId={caseId}
                proceedings={caseData.proceedings || []}
                jurisdictions={constants?.jurisdictions}
                judges={caseData.persons || []}
              />
            </div>
            {/* Key People: Judge, Counsel, Mediator */}
            <div className="space-y-2">
              {judges.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 w-16">Judge:</span>
                  <div className="flex flex-wrap gap-1">
                    {judges.map(j => (
                      <PersonChip key={j.assignment_id} person={j} onOpenDetail={() => openPersonModal(j.id, { caseId })} variant="muted" />
                    ))}
                  </div>
                </div>
              )}
              {counsel.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 w-16">Counsel:</span>
                  <div className="flex flex-wrap gap-1">
                    {counsel.map(c => (
                      <PersonChip key={c.assignment_id} person={c} onOpenDetail={() => openPersonModal(c.id, { caseId })} variant="muted" />
                    ))}
                  </div>
                </div>
              )}
              {mediators.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400 w-16">Mediator:</span>
                  <div className="flex flex-wrap gap-1">
                    {mediators.map(m => (
                      <PersonChip key={m.assignment_id} person={m} onOpenDetail={() => openPersonModal(m.id, { caseId })} variant="muted" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Dates */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader icon={Calendar} title="Key Dates" count={starredEvents.length + (caseData.date_of_injury ? 1 : 0)} />
          <div className="space-y-1">
            {/* Date of Injury - always show first */}
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-3 h-3 text-red-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300 truncate">Date of Injury</span>
              <EditableDate
                value={caseData.date_of_injury || null}
                onSave={(value) => onUpdateField('date_of_injury', value)}
                placeholder="Set date"
                className="text-xs shrink-0"
              />
            </div>
            {/* Starred events */}
            {starredEvents.map(event => (
              <div key={event.id} className="flex items-center gap-2 text-sm">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 truncate">{event.description}</span>
                <EditableDate
                  value={event.date}
                  onSave={async (value) => { if (value) await updateEventMutation.mutateAsync({ id: event.id, data: { date: value } }); }}
                  className="text-xs shrink-0"
                />
              </div>
            ))}
            {starredEvents.length === 0 && !caseData.date_of_injury && (
              <p className="text-xs text-slate-400 italic">Star events to pin them here</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Case Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Summary</h4>
        <EditableText
          value={caseData.case_summary || ''}
          onSave={(value) => onUpdateField('case_summary', value || null)}
          placeholder="Enter case summary..."
          multiline
          className="text-sm"
          inputClassName="w-full min-h-[60px]"
        />
      </div>

      {/* Row 3: People */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clients */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader
            icon={Users}
            title="Clients"
            count={clients.length}
            action={
              <button onClick={() => setShowAddClient(!showAddClient)} className="text-xs text-primary-600 hover:text-primary-700">
                <Plus className="w-3 h-3" />
              </button>
            }
          />
          {showAddClient && (
            <form onSubmit={(e) => { e.preventDefault(); if (newClient.name.trim()) addClientMutation.mutate(newClient); }} className="mb-2 space-y-1">
              <input type="text" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Name *" className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              <div className="flex gap-1">
                <input type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="Phone" className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="Email" className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" checked={newClient.is_primary} onChange={(e) => setNewClient({ ...newClient, is_primary: e.target.checked })} className="rounded" />
                  Primary
                </label>
                <button type="submit" disabled={!newClient.name.trim()} className="px-2 py-1 text-xs bg-primary-600 text-white rounded disabled:opacity-50">Add</button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-1">
            {clients.map(client => (
              <PersonChip key={client.assignment_id} person={client} onOpenDetail={() => openPersonModal(client.id, { caseId })} showStar variant="primary" />
            ))}
            {clients.length === 0 && !showAddClient && <p className="text-xs text-slate-400 italic">None</p>}
          </div>
        </div>

        {/* Defendants */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader
            icon={Building2}
            title="Defendants"
            count={defendants.length}
            action={
              <button onClick={() => setShowAddDefendant(!showAddDefendant)} className="text-xs text-primary-600 hover:text-primary-700">
                <Plus className="w-3 h-3" />
              </button>
            }
          />
          {showAddDefendant && (
            <form onSubmit={(e) => { e.preventDefault(); if (newDefendantName.trim()) addDefendantMutation.mutate(newDefendantName.trim()); }} className="mb-2 flex gap-1">
              <input type="text" value={newDefendantName} onChange={(e) => setNewDefendantName(e.target.value)} placeholder="Defendant name" className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              <button type="submit" disabled={!newDefendantName.trim()} className="px-2 py-1 text-xs bg-primary-600 text-white rounded disabled:opacity-50">Add</button>
            </form>
          )}
          <div className="flex flex-wrap gap-1">
            {defendants.map(def => (
              <PersonChip key={def.assignment_id} person={def} onOpenDetail={() => openPersonModal(def.id, { caseId })} />
            ))}
            {defendants.length === 0 && !showAddDefendant && <p className="text-xs text-slate-400 italic">None</p>}
          </div>
        </div>

        {/* Experts */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader icon={Users} title="Experts" count={experts.length} />
          <div className="flex flex-wrap gap-1">
            {experts.map(expert => (
              <PersonChip key={expert.assignment_id} person={expert} onOpenDetail={() => openPersonModal(expert.id, { caseId })} />
            ))}
            {experts.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
          </div>
        </div>

        {/* Other Contacts */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader
            icon={Users}
            title="Other"
            count={otherContacts.length}
            action={
              <button onClick={() => setShowAddContact(!showAddContact)} className="text-xs text-primary-600 hover:text-primary-700">
                <Plus className="w-3 h-3" />
              </button>
            }
          />
          {showAddContact && (
            <form onSubmit={(e) => { e.preventDefault(); if (newContact.name.trim()) addContactMutation.mutate(newContact); }} className="mb-2 space-y-1">
              <input type="text" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Name *" className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              <select value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                {contactRoleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <button type="submit" disabled={!newContact.name.trim()} className="w-full px-2 py-1 text-xs bg-primary-600 text-white rounded disabled:opacity-50">Add</button>
            </form>
          )}
          <div className="flex flex-wrap gap-1">
            {otherContacts.map(contact => (
              <PersonChip key={contact.assignment_id} person={contact} onOpenDetail={() => openPersonModal(contact.id, { caseId })} />
            ))}
            {otherContacts.length === 0 && !showAddContact && <p className="text-xs text-slate-400 italic">None</p>}
          </div>
        </div>
      </div>

      {/* Row 4: Tasks & Events side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={CheckSquare} title="Tasks" count={showDoneTasks ? doneTasks.length : activeTasks.length} />
            <div className="flex items-center gap-2">
              <select
                value={taskView}
                onChange={(e) => setTaskView(e.target.value as 'urgency' | 'date')}
                className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                <option value="urgency">By Urgency</option>
                <option value="date">By Date</option>
              </select>
              <button
                onClick={() => setShowDoneTasks(!showDoneTasks)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${showDoneTasks ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {showDoneTasks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Done
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(showDoneTasks ? doneTasks : sortedActiveTasks).map(task => (
              <div key={task.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm group">
                <EditableSelect
                  value={task.status}
                  options={taskStatusOptions}
                  onSave={async (value) => { await updateTaskMutation.mutateAsync({ id: task.id, data: { status: value as Task['status'] } }); }}
                  renderValue={(value) => <StatusBadge status={value} />}
                />
                <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{task.description}</span>
                <UrgencyBadge urgency={task.urgency} />
                {task.due_date && (
                  <EditableDate
                    value={task.due_date}
                    onSave={async (value) => { await updateTaskMutation.mutateAsync({ id: task.id, data: { due_date: value || undefined } }); }}
                    className="text-xs"
                  />
                )}
              </div>
            ))}
            {(showDoneTasks ? doneTasks : sortedActiveTasks).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">
                {showDoneTasks ? 'No completed tasks' : 'No active tasks'}
              </p>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={Clock} title="Events" count={showPastEvents ? pastEvents.length : futureEvents.length} />
            <button
              onClick={() => setShowPastEvents(!showPastEvents)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${showPastEvents ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {showPastEvents ? 'Past' : 'Upcoming'}
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(showPastEvents ? pastEvents : futureEvents).map(event => (
              <div key={event.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm group">
                <button
                  onClick={() => updateEventMutation.mutate({ id: event.id, data: { starred: !event.starred } })}
                  className="shrink-0"
                >
                  <Star className={`w-3 h-3 ${event.starred ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-600'}`} />
                </button>
                <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{event.description}</span>
                <EditableDate
                  value={event.date}
                  onSave={async (value) => { if (value) await updateEventMutation.mutateAsync({ id: event.id, data: { date: value } }); }}
                  className="text-xs shrink-0"
                />
                {event.time && (
                  <EditableTime
                    value={event.time}
                    onSave={async (value) => { await updateEventMutation.mutateAsync({ id: event.id, data: { time: value || undefined } }); }}
                    className="text-xs shrink-0"
                  />
                )}
              </div>
            ))}
            {(showPastEvents ? pastEvents : futureEvents).length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">
                {showPastEvents ? 'No past events' : 'No upcoming events'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
