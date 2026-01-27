import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
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
  Eye,
  EyeOff,
  Zap,
  MapPin,
  LayoutGrid,
} from 'lucide-react';
import {
  EditableText,
  EditableDate,
  EditableTime,
  EditableSelect,
  StatusBadge,
  UrgencyBadge,
  PersonAutocomplete,
} from '../../../components/common';
import { DraggableTaskRow } from '../../../components/tasks';
import { TaskDropZones } from '../../../components/docket';
import { useEntityModal } from '../../../components/modals';
import { useDragContext } from '../../../context/DragContext';
import {
  createPerson,
  assignPersonToCase,
  updateTask,
  updateEvent,
  updateDocket,
} from '../../../api';
import type { Case, Constants, Task, Event, CasePerson, Person } from '../../../types';
import { ProceedingsSection } from '../components';
import { getPrimaryPhone, getPrimaryEmail, parseLocalDate } from '../utils';
import { inferSideFromRole } from '../../../utils';

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
  variant?: 'default' | 'primary' | 'muted' | 'danger' | 'success' | 'warning';
}) {
  const [copiedField, setCopiedField] = useState<'phone' | 'email' | 'address' | null>(null);
  const phone = getPrimaryPhone(person.phones);
  const email = getPrimaryEmail(person.emails);

  // Build letter-ready address (multiline: name, org, address)
  const letterAddress = [
    person.name,
    person.organization,
    person.address,
  ].filter(Boolean).join('\n');
  const hasAddress = !!person.address;

  const copyToClipboard = async (text: string, field: 'phone' | 'email' | 'address') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleIconClick = (e: React.MouseEvent, text: string, field: 'phone' | 'email' | 'address') => {
    e.stopPropagation();
    copyToClipboard(text, field);
  };

  const variantClasses: Record<string, string> = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200',
    muted: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    default: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
  };
  const baseClass = variantClasses[variant] || variantClasses.default;

  const copiedLabels = { phone: 'Phone copied!', email: 'Email copied!', address: 'Address copied!' };

  return (
    <div className="relative">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer hover:opacity-80 transition-opacity ${baseClass}`}
        onClick={onOpenDetail}
      >
        {showStar && person.is_primary && (
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        )}
        <span className="font-medium">
          {person.name}
        </span>
        {person.role && !['Client', 'Defendant'].includes(person.role) && (
          <span className="text-xs opacity-70">({person.role})</span>
        )}
        {/* Contact icons - copy to clipboard on click */}
        {(phone || email || hasAddress) && (
          <span className="flex items-center gap-0.5 ml-1">
            {phone && (
              <Phone
                className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => handleIconClick(e, phone, 'phone')}
              />
            )}
            {email && (
              <Mail
                className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => handleIconClick(e, email, 'email')}
              />
            )}
            {hasAddress && (
              <MapPin
                className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => handleIconClick(e, letterAddress, 'address')}
              />
            )}
          </span>
        )}
      </div>
      {/* Copy confirmation tooltip */}
      {copiedField && (
        <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded shadow-lg whitespace-nowrap">
          {copiedLabels[copiedField]}
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
  const { startDrag, endDrag } = useDragContext();

  // UI State
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddDefendant, setShowAddDefendant] = useState(false);
  const [showAddCounsel, setShowAddCounsel] = useState(false);
  const [showAddExpert, setShowAddExpert] = useState(false);
  const [showAddMediator, setShowAddMediator] = useState(false);
  const [taskView, setTaskView] = useState<'urgency' | 'date'>('urgency');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Form state
  const [newCounselRole, setNewCounselRole] = useState('Opposing Counsel');
  const [newExpertRole, setNewExpertRole] = useState('Expert - Plaintiff');

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

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

  const counsel = useMemo(() => {
    const counselOrder = ['Opposing Counsel', 'Co-Counsel', 'Referring Attorney'];
    return (caseData.persons || [])
      .filter(p => counselOrder.includes(p.role || ''))
      .sort((a, b) => counselOrder.indexOf(a.role || '') - counselOrder.indexOf(b.role || ''));
  }, [caseData.persons]);

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
  now.setHours(0, 0, 0, 0); // Compare at midnight local time
  const futureEvents = useMemo(() =>
    events.filter(e => parseLocalDate(e.date) >= now)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()),
    [events, now]);
  const pastEvents = useMemo(() =>
    events.filter(e => parseLocalDate(e.date) < now)
      .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
    [events, now]);

  const starredEvents = useMemo(() =>
    events.filter(e => e.starred),
    [events]);

  // Role options
  const counselRoleOptions = ['Opposing Counsel', 'Co-Counsel', 'Referring Attorney'];
  const expertRoleOptions = ['Expert - Plaintiff', 'Expert - Defendant'];

  // Color variants for counsel and experts
  const getCounselVariant = (role: string): 'danger' | 'success' | 'warning' => {
    if (role === 'Opposing Counsel') return 'danger';
    if (role === 'Co-Counsel') return 'success';
    return 'warning'; // Referring Attorney
  };

  const getExpertVariant = (role: string): 'primary' | 'danger' => {
    return role?.includes('Plaintiff') ? 'primary' : 'danger';
  };

  // Get list of person IDs already assigned to this case
  const assignedPersonIds = useMemo(() =>
    (caseData.persons || []).map(p => p.id),
    [caseData.persons]);

  // Mutations for Clients section
  const assignClientMutation = useMutation({
    mutationFn: async (person: Person) => {
      return assignPersonToCase(caseId, { person_id: person.id, role: 'Client', side: 'plaintiff' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddClient(false);
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (name: string) => {
      const personResult = await createPerson({ person_type: 'client', name });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role: 'Client', side: 'plaintiff' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddClient(false);
    },
  });

  // Mutations for Defendants section
  const assignDefendantMutation = useMutation({
    mutationFn: async (person: Person) => {
      return assignPersonToCase(caseId, { person_id: person.id, role: 'Defendant', side: 'defendant' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddDefendant(false);
    },
  });

  const createDefendantMutation = useMutation({
    mutationFn: async (name: string) => {
      const personResult = await createPerson({ person_type: 'defendant', name });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role: 'Defendant', side: 'defendant' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddDefendant(false);
    },
  });

  // Mutations for Counsel (in Case Info section)
  const assignCounselMutation = useMutation({
    mutationFn: async ({ person, role }: { person: Person; role: string }) => {
      const side = inferSideFromRole(role);
      return assignPersonToCase(caseId, { person_id: person.id, role, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddCounsel(false);
    },
  });

  const createCounselMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const side = inferSideFromRole(role);
      const personResult = await createPerson({ person_type: 'attorney', name });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddCounsel(false);
    },
  });

  // Mutations for Experts (in Case Info section)
  const assignExpertMutation = useMutation({
    mutationFn: async ({ person, role }: { person: Person; role: string }) => {
      const side = inferSideFromRole(role);
      return assignPersonToCase(caseId, { person_id: person.id, role, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddExpert(false);
    },
  });

  const createExpertMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const side = inferSideFromRole(role);
      const personResult = await createPerson({ person_type: 'expert', name });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddExpert(false);
    },
  });

  // Mutations for Mediator (in Case Info section)
  const assignMediatorMutation = useMutation({
    mutationFn: async (person: Person) => {
      return assignPersonToCase(caseId, { person_id: person.id, role: 'Mediator', side: 'neutral' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddMediator(false);
    },
  });

  const createMediatorMutation = useMutation({
    mutationFn: async (name: string) => {
      const personResult = await createPerson({ person_type: 'mediator', name });
      return assignPersonToCase(caseId, { person_id: personResult.person.id, role: 'Mediator', side: 'neutral' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddMediator(false);
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

  const docketMutation = useMutation({
    mutationFn: ({ taskId, category }: { taskId: number; category: 'today' | 'tomorrow' | 'backburner' }) =>
      updateDocket(taskId, { docket_category: category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });
    },
  });

  const displayedTasks = showDoneTasks ? doneTasks : sortedActiveTasks;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = displayedTasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      startDrag(task, 'case-overview');
    }
  }, [displayedTasks, startDrag]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    endDrag();

    if (!over) return;

    const task = displayedTasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = over.id.toString();
    if (overId === 'drop-done') {
      updateTaskMutation.mutate({ id: task.id, data: { status: 'Done' } });
    } else if (overId === 'drop-today') {
      docketMutation.mutate({ taskId: task.id, category: 'today' });
    } else if (overId === 'drop-tomorrow') {
      docketMutation.mutate({ taskId: task.id, category: 'tomorrow' });
    } else if (overId === 'drop-backburner') {
      docketMutation.mutate({ taskId: task.id, category: 'backburner' });
    }
  }, [displayedTasks, updateTaskMutation, docketMutation, endDrag]);

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
              />
            </div>
            {/* Key People: Judge, Counsel, Experts, Mediator */}
            <div className="space-y-2">
              {/* Judge - read only, added via Proceedings */}
              {judges.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400 w-16 shrink-0 pt-1">Judge:</span>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {judges.map(j => (
                      <PersonChip key={j.assignment_id} person={j} onOpenDetail={() => openPersonModal(j.id, { caseId })} variant="muted" />
                    ))}
                  </div>
                </div>
              )}

              {/* Counsel - always show with add button */}
              <div className="space-y-1">
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400 w-16 shrink-0 pt-1">Counsel:</span>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {counsel.map(c => (
                      <PersonChip key={c.assignment_id} person={c} onOpenDetail={() => openPersonModal(c.id, { caseId })} variant={getCounselVariant(c.role || '')} />
                    ))}
                    {counsel.length === 0 && !showAddCounsel && (
                      <span className="text-xs text-slate-400 italic pt-1">None</span>
                    )}
                  </div>
                  <button onClick={() => setShowAddCounsel(!showAddCounsel)} className="text-primary-600 hover:text-primary-700 pt-1 shrink-0">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {showAddCounsel && (
                  <div className="ml-[72px] space-y-1">
                    <select
                      value={newCounselRole}
                      onChange={(e) => setNewCounselRole(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      {counselRoleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <PersonAutocomplete
                      personTypes={['attorney']}
                      excludePersonIds={assignedPersonIds}
                      onSelectPerson={(person) => assignCounselMutation.mutate({ person, role: newCounselRole })}
                      onCreateNew={(name) => createCounselMutation.mutate({ name, role: newCounselRole })}
                      onCancel={() => setShowAddCounsel(false)}
                      placeholder="Search attorneys..."
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Mediator - always show with add button */}
              <div className="space-y-1">
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400 w-16 shrink-0 pt-1">Mediator:</span>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {mediators.map(m => (
                      <PersonChip key={m.assignment_id} person={m} onOpenDetail={() => openPersonModal(m.id, { caseId })} variant="muted" />
                    ))}
                    {mediators.length === 0 && !showAddMediator && (
                      <span className="text-xs text-slate-400 italic pt-1">None</span>
                    )}
                  </div>
                  <button onClick={() => setShowAddMediator(!showAddMediator)} className="text-primary-600 hover:text-primary-700 pt-1 shrink-0">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                {showAddMediator && (
                  <div className="ml-[72px]">
                    <PersonAutocomplete
                      personTypes={['mediator']}
                      excludePersonIds={assignedPersonIds}
                      onSelectPerson={(person) => assignMediatorMutation.mutate(person)}
                      onCreateNew={(name) => createMediatorMutation.mutate(name)}
                      onCancel={() => setShowAddMediator(false)}
                      placeholder="Search mediators..."
                      autoFocus
                    />
                  </div>
                )}
              </div>
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
                clearable={false}
              />
            </div>
            {/* Starred events - read only */}
            {starredEvents.map(event => (
              <div key={event.id} className="flex items-center gap-2 text-sm">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 truncate">{event.description}</span>
                <span className="text-xs text-slate-500 shrink-0">
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
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

      {/* Row 3: Parties (Clients, Defendants, Experts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="mb-2">
              <PersonAutocomplete
                personTypes={['client']}
                excludePersonIds={assignedPersonIds}
                onSelectPerson={(person) => assignClientMutation.mutate(person)}
                onCreateNew={(name) => createClientMutation.mutate(name)}
                onCancel={() => setShowAddClient(false)}
                placeholder="Search clients or create new..."
                autoFocus
              />
            </div>
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
            <div className="mb-2">
              <PersonAutocomplete
                personTypes={['defendant']}
                excludePersonIds={assignedPersonIds}
                onSelectPerson={(person) => assignDefendantMutation.mutate(person)}
                onCreateNew={(name) => createDefendantMutation.mutate(name)}
                onCancel={() => setShowAddDefendant(false)}
                placeholder="Search defendants or create new..."
                autoFocus
              />
            </div>
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
          <SectionHeader
            icon={Users}
            title="Experts"
            count={experts.length}
            action={
              <button onClick={() => setShowAddExpert(!showAddExpert)} className="text-xs text-primary-600 hover:text-primary-700">
                <Plus className="w-3 h-3" />
              </button>
            }
          />
          {showAddExpert && (
            <div className="mb-2 space-y-1">
              <select
                value={newExpertRole}
                onChange={(e) => setNewExpertRole(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {expertRoleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <PersonAutocomplete
                personTypes={['expert']}
                excludePersonIds={assignedPersonIds}
                onSelectPerson={(person) => assignExpertMutation.mutate({ person, role: newExpertRole })}
                onCreateNew={(name) => createExpertMutation.mutate({ name, role: newExpertRole })}
                onCancel={() => setShowAddExpert(false)}
                placeholder="Search experts or create new..."
                autoFocus
              />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {experts.map(e => (
              <PersonChip key={e.assignment_id} person={e} onOpenDetail={() => openPersonModal(e.id, { caseId })} variant={getExpertVariant(e.role || '')} />
            ))}
            {experts.length === 0 && !showAddExpert && <p className="text-xs text-slate-400 italic">None</p>}
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
              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 rounded-md p-0.5">
                <button
                  onClick={() => setTaskView('urgency')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    taskView === 'urgency'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  Urgency
                </button>
                <button
                  onClick={() => setTaskView('date')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    taskView === 'date'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  Date
                </button>
              </div>
              <button
                onClick={() => setShowDoneTasks(!showDoneTasks)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${showDoneTasks ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {showDoneTasks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Done
              </button>
            </div>
          </div>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-1">
              {displayedTasks.map(task => (
                <DraggableTaskRow key={task.id} task={task} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm group">
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
                </DraggableTaskRow>
              ))}
              {displayedTasks.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  {showDoneTasks ? 'No completed tasks' : 'No active tasks'}
                </p>
              )}
            </div>

            {/* Drop zones for docket */}
            <TaskDropZones isVisible={activeTask !== null} />

            {/* Drag overlay */}
            <DragOverlay dropAnimation={null}>
              {activeTask && (
                <div className="p-2 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-primary-500 flex items-center gap-2 text-sm">
                  <StatusBadge status={activeTask.status} />
                  <span className="text-slate-700 dark:text-slate-300 truncate">
                    {activeTask.description}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
          <div className="space-y-1">
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
