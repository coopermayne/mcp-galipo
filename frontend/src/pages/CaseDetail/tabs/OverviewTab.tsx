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
  PersonAutocomplete,
  AddPersonDropdown,
  CreateTaskButton,
  CreateTaskFromEventModal,
  DraggablePersonChip,
  UnnestDropZone,
} from '../../../components/common';
import { TaskItem, TaskItemOverlay } from '../../../components/tasks';
import { useEntityModal } from '../../../components/modals';
import { useDragContext } from '../../../context/DragContext';
import {
  createPerson,
  assignPersonToCase,
  updateCaseAssignment,
  updateTask,
  updateEvent,
} from '../../../api';
import type { Case, Constants, Task, Event, CasePerson, Person } from '../../../types';
import { ProceedingsSection } from '../components';
import { getPrimaryPhone, getPrimaryEmail, parseLocalDate } from '../utils';
import { inferSideFromRole, inferPersonTypeFromRole } from '../../../utils';

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

export function OverviewTab({ caseData, caseId, onUpdateField }: OverviewTabProps) {
  const queryClient = useQueryClient();
  const { openPersonModal } = useEntityModal();
  const { startDrag, endDrag } = useDragContext();

  // UI State
  const [showAddDefendant, setShowAddDefendant] = useState(false);
  const [showAddMediator, setShowAddMediator] = useState(false);
  const [taskView, setTaskView] = useState<'urgency' | 'date'>('urgency');
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskFromEvent, setTaskFromEvent] = useState<Event | null>(null);
  const [activePerson, setActivePerson] = useState<CasePerson | null>(null);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Filter persons by role
  const clients = useMemo(() =>
    (caseData.persons || []).filter(p =>
      p.role === 'Client' || p.role === 'Guardian Ad Litem' || p.role === 'Plaintiff Contact' || p.role === 'Decedent'
    ), [caseData.persons]);

  // Group clients by parent (for GAL -> Kids nesting)
  const groupedClients = useMemo(() => {
    const roots = clients.filter(c => !c.grouped_under_id);
    const nestedByParent = new Map<number, CasePerson[]>();
    clients.filter(c => c.grouped_under_id).forEach(c => {
      const parentId = c.grouped_under_id!;
      if (!nestedByParent.has(parentId)) {
        nestedByParent.set(parentId, []);
      }
      nestedByParent.get(parentId)!.push(c);
    });
    return { roots, nestedByParent };
  }, [clients]);

  const defendants = useMemo(() =>
    (caseData.persons || []).filter(p => p.role === 'Defendant'),
    [caseData.persons]);

  // Group defendants by parent (for Org -> Employee nesting)
  const groupedDefendants = useMemo(() => {
    const roots = defendants.filter(d => !d.grouped_under_id);
    const nestedByParent = new Map<number, CasePerson[]>();
    defendants.filter(d => d.grouped_under_id).forEach(d => {
      const parentId = d.grouped_under_id!;
      if (!nestedByParent.has(parentId)) {
        nestedByParent.set(parentId, []);
      }
      nestedByParent.get(parentId)!.push(d);
    });
    return { roots, nestedByParent };
  }, [defendants]);

  const judges = useMemo(() =>
    (caseData.persons || []).filter(p => p.role === 'Judge' || p.role === 'Magistrate Judge'),
    [caseData.persons]);

  const counsel = useMemo(() => {
    const counselOrder = ['Opposing Counsel', 'Co-Counsel', 'Referring Attorney'];
    return (caseData.persons || [])
      .filter(p => counselOrder.includes(p.role || ''))
      .sort((a, b) => counselOrder.indexOf(a.role || '') - counselOrder.indexOf(b.role || ''));
  }, [caseData.persons]);

  // Group counsel by parent (for Lead Attorney -> Associates nesting)
  const groupedCounsel = useMemo(() => {
    const roots = counsel.filter(c => !c.grouped_under_id);
    const nestedByParent = new Map<number, CasePerson[]>();
    counsel.filter(c => c.grouped_under_id).forEach(c => {
      const parentId = c.grouped_under_id!;
      if (!nestedByParent.has(parentId)) {
        nestedByParent.set(parentId, []);
      }
      nestedByParent.get(parentId)!.push(c);
    });
    return { roots, nestedByParent };
  }, [counsel]);

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

  // "Other" roles not covered by specific sections
  const coveredRoles = [
    'Client', 'Guardian Ad Litem', 'Plaintiff Contact', 'Decedent',
    'Defendant',
    'Judge', 'Magistrate Judge',
    'Opposing Counsel', 'Co-Counsel', 'Referring Attorney',
    'Mediator'
  ];
  const others = useMemo(() =>
    (caseData.persons || []).filter(p => {
      if (!p.role) return false;
      // Exclude roles already shown in other sections
      if (coveredRoles.includes(p.role)) return false;
      // Exclude experts (shown in Experts section)
      if (p.role.toLowerCase().includes('expert')) return false;
      return true;
    }),
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
  const clientRoleOptions = ['Client', 'Guardian Ad Litem', 'Plaintiff Contact', 'Decedent'];
  const counselRoleOptions = ['Opposing Counsel', 'Co-Counsel', 'Referring Attorney'];
  const expertRoleOptions = ['Expert - Plaintiff', 'Expert - Defendant'];
  const otherRoleOptions = ['Witness', 'Interpreter', 'Insurance Adjuster', 'Lien Holder'];

  // Color variants for counsel and experts
  const getCounselVariant = (role: string): 'danger' | 'success' | 'warning' => {
    if (role === 'Opposing Counsel') return 'danger';
    if (role === 'Co-Counsel') return 'success';
    return 'warning'; // Referring Attorney
  };

  const getExpertVariant = (role: string): 'primary' | 'danger' => {
    return role?.includes('Plaintiff') ? 'primary' : 'danger';
  };

  const getOtherVariant = (role: string): 'muted' | 'warning' | 'success' | 'primary' | 'danger' => {
    switch (role) {
      case 'Insurance Adjuster': return 'warning';
      case 'Lien Holder': return 'danger';
      case 'Interpreter': return 'success';
      case 'Witness': return 'primary';
      default: return 'muted';
    }
  };

  // Get list of person IDs already assigned to this case
  const assignedPersonIds = useMemo(() =>
    (caseData.persons || []).map(p => p.id),
    [caseData.persons]);

  // Mutations for Clients section
  const assignClientMutation = useMutation({
    mutationFn: async ({ person, role }: { person: Person; role: string }) => {
      return assignPersonToCase(caseId, { person_id: person.id, role, side: 'plaintiff' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      // GALs are typically attorneys, others are clients
      const personType = role === 'Guardian Ad Litem' ? 'attorney' : 'client';
      const personResult = await createPerson({ person_type: personType, name });
      await assignPersonToCase(caseId, { person_id: personResult.person.id, role, side: 'plaintiff' });
      return personResult.person.id;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      openPersonModal(personId, { caseId });
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
      await assignPersonToCase(caseId, { person_id: personResult.person.id, role: 'Defendant', side: 'defendant' });
      return personResult.person.id;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddDefendant(false);
      openPersonModal(personId, { caseId });
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
    },
  });

  const createCounselMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const side = inferSideFromRole(role);
      const personResult = await createPerson({ person_type: 'attorney', name });
      await assignPersonToCase(caseId, { person_id: personResult.person.id, role, side });
      return personResult.person.id;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      openPersonModal(personId, { caseId });
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
    },
  });

  const createExpertMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const side = inferSideFromRole(role);
      const personResult = await createPerson({ person_type: 'expert', name });
      await assignPersonToCase(caseId, { person_id: personResult.person.id, role, side });
      return personResult.person.id;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      openPersonModal(personId, { caseId });
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
      await assignPersonToCase(caseId, { person_id: personResult.person.id, role: 'Mediator', side: 'neutral' });
      return personResult.person.id;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddMediator(false);
      openPersonModal(personId, { caseId });
    },
  });

  // Mutations for Other section (Witness, Interpreter, Insurance Adjuster, Lien Holder)
  const assignOtherMutation = useMutation({
    mutationFn: async ({ person, role }: { person: Person; role: string }) => {
      const side = inferSideFromRole(role);
      return assignPersonToCase(caseId, { person_id: person.id, role, side });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const createOtherMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const personType = inferPersonTypeFromRole(role);
      const side = inferSideFromRole(role);
      const personResult = await createPerson({ person_type: personType, name });
      await assignPersonToCase(caseId, { person_id: personResult.person.id, role, side });
      return personResult.person.id;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      openPersonModal(personId, { caseId });
    },
  });

  // Mutation for updating person nesting (grouped_under_id)
  const updateNestingMutation = useMutation({
    mutationFn: ({ personId, role, grouped_under_id }: { personId: number; role: string; grouped_under_id: number | null }) =>
      updateCaseAssignment(caseId, personId, { role, grouped_under_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) => updateEvent(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const displayedTasks = showDoneTasks ? doneTasks : sortedActiveTasks;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id.toString();

    // Check if this is a person drag
    if (activeId.startsWith('person-')) {
      const personData = event.active.data.current?.person as CasePerson | undefined;
      if (personData) {
        setActivePerson(personData);
      }
      return;
    }

    // Otherwise it's a task drag
    const task = displayedTasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      startDrag(task, 'case-overview');
    }
  }, [displayedTasks, startDrag]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id.toString();

    // Handle person drag end
    if (activeId.startsWith('person-')) {
      setActivePerson(null);
      if (!over) return;

      const draggedPerson = active.data.current?.person as CasePerson | undefined;
      if (!draggedPerson) return;

      const overId = over.id.toString();

      // Dropped on unnest zone - remove nesting
      if (overId.startsWith('unnest-')) {
        if (draggedPerson.grouped_under_id) {
          updateNestingMutation.mutate({
            personId: draggedPerson.id,
            role: draggedPerson.role || '',
            grouped_under_id: null,
          });
        }
        return;
      }

      // Dropped on another person - nest under them
      if (overId.startsWith('drop-person-')) {
        const targetPerson = over.data.current?.person as CasePerson | undefined;
        const draggedHasChildren = active.data.current?.hasChildren as boolean | undefined;

        // Don't allow nesting if:
        // - Dropped on self
        // - Target is already nested under dragged person
        // - Dragged person has children (only one level of nesting allowed)
        if (targetPerson &&
            targetPerson.id !== draggedPerson.id &&
            targetPerson.grouped_under_id !== draggedPerson.id &&
            !draggedHasChildren) {
          updateNestingMutation.mutate({
            personId: draggedPerson.id,
            role: draggedPerson.role || '',
            grouped_under_id: targetPerson.id,
          });
        }
      }
      return;
    }

    // Handle task drag end
    setActiveTask(null);
    endDrag();

    if (!over) return;

    const task = displayedTasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = over.id.toString();
    if (overId === 'drop-done') {
      updateTaskMutation.mutate({ id: task.id, data: { status: 'Done' } });
    }
  }, [displayedTasks, updateTaskMutation, endDrag, updateNestingMutation]);

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
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 w-16 shrink-0 pt-1">Counsel:</span>
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {groupedCounsel.roots.map(c => {
                      const children = groupedCounsel.nestedByParent.get(c.id) || [];
                      return (
                        <div key={c.assignment_id} className="flex flex-col gap-1">
                          <DraggablePersonChip
                            person={c}
                            onOpenDetail={() => openPersonModal(c.id, { caseId })}
                            variant={getCounselVariant(c.role || '')}
                            canBeDropTarget={true}
                            hasChildren={children.length > 0}
                          />
                          {/* Nested persons under this parent */}
                          {children.map((nested, idx) => (
                            <DraggablePersonChip
                              key={nested.assignment_id}
                              person={nested}
                              onOpenDetail={() => openPersonModal(nested.id, { caseId })}
                              variant={getCounselVariant(nested.role || '')}
                              isNested={true}
                              isLastChild={idx === children.length - 1}
                              canBeDropTarget={false}
                            />
                          ))}
                        </div>
                      );
                    })}
                    {counsel.length === 0 && (
                      <span className="text-xs text-slate-400 italic pt-1">None</span>
                    )}
                  </div>
                  <UnnestDropZone isVisible={activePerson !== null && !!activePerson.grouped_under_id && counsel.some(c => c.id === activePerson.id)} sectionId="counsel" />
                </DndContext>
                <div className="pt-1 shrink-0">
                  <AddPersonDropdown
                    roleOptions={counselRoleOptions}
                    onAssign={(person, role) => assignCounselMutation.mutate({ person, role })}
                    onCreate={(name, role) => createCounselMutation.mutate({ name, role })}
                    excludePersonIds={assignedPersonIds}
                    getPersonTypes={() => ['attorney']}
                    getPlaceholder={() => 'Search attorneys...'}
                  />
                </div>
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

      {/* Row 3: Parties (Clients, Defendants, Experts, Other) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clients */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader
            icon={Users}
            title="Clients"
            count={clients.length}
            action={
              <AddPersonDropdown
                roleOptions={clientRoleOptions}
                onAssign={(person, role) => assignClientMutation.mutate({ person, role })}
                onCreate={(name, role) => createClientMutation.mutate({ name, role })}
                excludePersonIds={assignedPersonIds}
                getPersonTypes={(role) => role === 'Guardian Ad Litem' ? ['client', 'attorney'] : ['client']}
                getPlaceholder={(role) => role === 'Guardian Ad Litem' ? 'Search clients/attorneys...' : 'Search clients or create new...'}
              />
            }
          />
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-wrap gap-1">
              {groupedClients.roots.map(client => {
                const children = groupedClients.nestedByParent.get(client.id) || [];
                return (
                  <div key={client.assignment_id} className="flex flex-col gap-1">
                    <DraggablePersonChip
                      person={client}
                      onOpenDetail={() => openPersonModal(client.id, { caseId })}
                      showStar
                      variant="primary"
                      canBeDropTarget={true}
                      hasChildren={children.length > 0}
                    />
                    {/* Nested persons under this parent */}
                    {children.map((nested, idx) => (
                      <DraggablePersonChip
                        key={nested.assignment_id}
                        person={nested}
                        onOpenDetail={() => openPersonModal(nested.id, { caseId })}
                        showStar
                        variant="primary"
                        isNested={true}
                        isLastChild={idx === children.length - 1}
                        canBeDropTarget={false}
                      />
                    ))}
                  </div>
                );
              })}
              {clients.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
            </div>
            <UnnestDropZone isVisible={activePerson !== null && !!activePerson.grouped_under_id && clients.some(c => c.id === activePerson.id)} sectionId="clients" />
          </DndContext>
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
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-wrap gap-1">
              {groupedDefendants.roots.map(def => {
                const children = groupedDefendants.nestedByParent.get(def.id) || [];
                return (
                  <div key={def.assignment_id} className="flex flex-col gap-1">
                    <DraggablePersonChip
                      person={def}
                      onOpenDetail={() => openPersonModal(def.id, { caseId })}
                      canBeDropTarget={true}
                      hasChildren={children.length > 0}
                    />
                    {/* Nested persons under this parent */}
                    {children.map((nested, idx) => (
                      <DraggablePersonChip
                        key={nested.assignment_id}
                        person={nested}
                        onOpenDetail={() => openPersonModal(nested.id, { caseId })}
                        isNested={true}
                        isLastChild={idx === children.length - 1}
                        canBeDropTarget={false}
                      />
                    ))}
                  </div>
                );
              })}
              {defendants.length === 0 && !showAddDefendant && <p className="text-xs text-slate-400 italic">None</p>}
            </div>
            <UnnestDropZone isVisible={activePerson !== null && !!activePerson.grouped_under_id && defendants.some(d => d.id === activePerson.id)} sectionId="defendants" />
          </DndContext>
        </div>

        {/* Experts */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader
            icon={Users}
            title="Experts"
            count={experts.length}
            action={
              <AddPersonDropdown
                roleOptions={expertRoleOptions}
                onAssign={(person, role) => assignExpertMutation.mutate({ person, role })}
                onCreate={(name, role) => createExpertMutation.mutate({ name, role })}
                excludePersonIds={assignedPersonIds}
                getPersonTypes={() => ['expert']}
                getPlaceholder={() => 'Search experts or create new...'}
              />
            }
          />
          <div className="flex flex-wrap gap-1">
            {experts.map(e => (
              <PersonChip key={e.assignment_id} person={e} onOpenDetail={() => openPersonModal(e.id, { caseId })} variant={getExpertVariant(e.role || '')} />
            ))}
            {experts.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
          </div>
        </div>

        {/* Other */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <SectionHeader
            icon={Users}
            title="Other"
            count={others.length}
            action={
              <AddPersonDropdown
                roleOptions={otherRoleOptions}
                onAssign={(person, role) => assignOtherMutation.mutate({ person, role })}
                onCreate={(name, role) => createOtherMutation.mutate({ name, role })}
                excludePersonIds={assignedPersonIds}
                getPersonTypes={() => undefined}
                getPlaceholder={() => 'Search or create new...'}
              />
            }
          />
          <div className="flex flex-wrap gap-1">
            {others.map(o => (
              <PersonChip key={o.assignment_id} person={o} onOpenDetail={() => openPersonModal(o.id, { caseId })} variant={getOtherVariant(o.role || '')} />
            ))}
            {others.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
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
                <TaskItem
                  key={task.id}
                  task={task}
                  showCase={false}
                  onMarkDone={(taskId) => updateTaskMutation.mutate({ id: taskId, data: { status: 'Done' } })}
                  onDateChange={(taskId, date) => updateTaskMutation.mutate({ id: taskId, data: { due_date: date || undefined } })}
                  onPriorityChange={(taskId, priority) => updateTaskMutation.mutate({ id: taskId, data: { urgency: priority } })}
                />
              ))}
              {displayedTasks.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  {showDoneTasks ? 'No completed tasks' : 'No active tasks'}
                </p>
              )}
            </div>

            {/* Drag overlay */}
            <DragOverlay dropAnimation={null}>
              {activeTask && <TaskItemOverlay task={activeTask} />}
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
                <CreateTaskButton event={event} onClick={() => setTaskFromEvent(event)} />
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

      <CreateTaskFromEventModal
        isOpen={!!taskFromEvent}
        onClose={() => setTaskFromEvent(null)}
        event={taskFromEvent}
        caseId={caseId}
      />
    </div>
  );
}
