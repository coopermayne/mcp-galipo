import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  Users,
  Building2,
  Plus,
  Phone,
  Mail,
  Calendar,
  Star,
  Zap,
  MapPin,
  FileText,
  Briefcase,
  UserCheck,
  ChevronDown,
  X,
} from 'lucide-react';
import {
  EditableDate,
  EditableSelect,
  StatusBadge,
  UserSelect,
  PersonAutocomplete,
  AddPersonDropdown,
  DraggablePersonChip,
  UnnestDropZone,
  ConfirmModal,
} from '../../../components/common';
import { TasksComponent } from '../../../components/tasks';
import { EventsComponent } from '../../../components/events';
import { useEntityModal } from '../../../components/modals';
import {
  createPerson,
  assignPersonToCase,
  updateCaseAssignment,
  updateEvent,
  getUsers,
  assignAttorneyToCase,
  removeAttorneyFromCase,
  assignParalegalToCase,
  removeParalegalFromCase,
} from '../../../api';
import type { Case, Constants, CasePerson, Person } from '../../../types';
import { ProceedingsSection } from '../components';
import { getPrimaryPhone, getPrimaryEmail } from '../utils';
import { inferSideFromRole, inferPersonTypeFromRole, getUserColorClass } from '../../../utils';

interface OverviewTabProps {
  caseData: Case;
  caseId: number;
  constants: Constants | undefined;
  statusOptions: { value: string; label: string }[];
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
    muted: 'bg-bg-hover text-text-secondary',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    default: 'bg-bg-hover text-text',
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
        <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-bg-surface text-white text-xs rounded shadow-lg whitespace-nowrap">
          {copiedLabels[copiedField]}
        </div>
      )}
    </div>
  );
}

// Compact summary - one line with click to expand
function CompactSummary({
  value,
  onSave
}: {
  value: string;
  onSave: (value: string | null) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(editValue || null);
    setIsSaving(false);
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsExpanded(false);
  };

  if (isExpanded) {
    return (
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-text-muted" />
          <h4 className="text-sm font-medium text-text-secondary">Summary</h4>
        </div>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="Enter case summary..."
          className="w-full px-2 py-1.5 text-sm rounded border border-border bg-bg-surface text-text placeholder-text-muted focus:border-primary-500 outline-none min-h-[80px] resize-none"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-xs text-text-secondary hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50 hover:bg-primary-700"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pt-2 border-t border-border cursor-pointer group"
      onClick={() => setIsExpanded(true)}
    >
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-text-muted" />
        <span className="text-sm text-text-secondary line-clamp-2 flex-1">
          {value || <span className="italic text-text-muted">Add summary...</span>}
        </span>
        <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          Edit
        </span>
      </div>
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
        <Icon className="w-4 h-4 text-text-muted" />
        <h4 className="text-sm font-medium text-text-secondary">{title}</h4>
        {count !== undefined && count > 0 && (
          <span className="text-xs text-text-muted">({count})</span>
        )}
      </div>
      {action}
    </div>
  );
}

export function OverviewTab({ caseData, caseId, statusOptions, onUpdateField }: OverviewTabProps) {
  const queryClient = useQueryClient();
  const { openPersonModal } = useEntityModal();

  // UI State
  const [showAddDefendant, setShowAddDefendant] = useState(false);
  const [showAddMediator, setShowAddMediator] = useState(false);
  const [showAddKeyDate, setShowAddKeyDate] = useState(false);
  const [keyDateSearch, setKeyDateSearch] = useState('');
  const [keyDateSelectedIndex, setKeyDateSelectedIndex] = useState(0);
  const [eventToUnstar, setEventToUnstar] = useState<{ id: number; description: string } | null>(null);
  const [activePerson, setActivePerson] = useState<CasePerson | null>(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  // Close team dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setShowTeamDropdown(false);
      }
    }
    if (showTeamDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTeamDropdown]);

  // Fetch users for team assignment
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  const attorneys = useMemo(() => allUsers.filter(u => u.position === 'attorney'), [allUsers]);
  const paralegals = useMemo(() => allUsers.filter(u => u.position === 'paralegal'), [allUsers]);

  // Team assignment mutations
  const assignAttorneyMutation = useMutation({
    mutationFn: (userId: number) => assignAttorneyToCase(caseId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const removeAttorneyMutation = useMutation({
    mutationFn: (userId: number) => removeAttorneyFromCase(caseId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const assignParalegalMutation = useMutation({
    mutationFn: (userId: number) => assignParalegalToCase(caseId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  const removeParalegalMutation = useMutation({
    mutationFn: (userId: number) => removeParalegalFromCase(caseId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case', caseId] }),
  });

  // Combine attorneys and paralegals for display
  const teamMembers = [...(caseData.attorneys || []), ...(caseData.paralegals || [])];

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

  // Starred events for Key Dates section
  const starredEvents = useMemo(() =>
    (caseData.events || []).filter(e => e.starred),
    [caseData.events]);

  // Unstarred events (available to add as Key Dates)
  const unstarredEvents = useMemo(() =>
    (caseData.events || []).filter(e => !e.starred),
    [caseData.events]);

  // Filtered unstarred events for search
  const filteredUnstarredEvents = useMemo(() => {
    if (!keyDateSearch.trim()) return unstarredEvents;
    const query = keyDateSearch.toLowerCase();
    return unstarredEvents.filter(e =>
      e.description.toLowerCase().includes(query)
    );
  }, [unstarredEvents, keyDateSearch]);

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

  // Mutation for starring an event (adding to Key Dates)
  const starEventMutation = useMutation({
    mutationFn: (eventId: number) => updateEvent(eventId, { starred: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setShowAddKeyDate(false);
      setKeyDateSearch('');
      setKeyDateSelectedIndex(0);
    },
  });

  // Mutation for unstarring an event (removing from Key Dates)
  const unstarEventMutation = useMutation({
    mutationFn: (eventId: number) => updateEvent(eventId, { starred: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setEventToUnstar(null);
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id.toString();

    // Handle person drag
    if (activeId.startsWith('person-')) {
      const personData = event.active.data.current?.person as CasePerson | undefined;
      if (personData) {
        setActivePerson(personData);
      }
    }
  }, []);

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
    }
  }, [updateNestingMutation]);

  return (
    <div className="space-y-4">
      {/* Row 1: Proceedings, Counsel, Key Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Status + Team + Proceedings + Summary */}
        <div className="bg-bg-surface rounded-lg border border-border p-3 flex flex-col gap-3">
          {/* Status + Team row */}
          <div className="flex items-center gap-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text-secondary">Status</span>
              <EditableSelect
                value={caseData.status}
                options={statusOptions}
                onSave={(value) => onUpdateField('status', value)}
                renderValue={(value) => <StatusBadge status={value} />}
              />
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-border" />

            {/* Team */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text-secondary">Team</span>
              <div className="relative" ref={teamDropdownRef}>
              <button
                onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                className="group flex items-center gap-1.5 py-0.5 px-1 -ml-1 rounded-lg hover:bg-bg-hover/50 transition-all"
              >
                {teamMembers.length > 0 ? (
                  <div className="flex items-center">
                    {teamMembers.slice(0, 4).map((user, idx) => (
                      <span
                        key={user.id}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold shadow-sm ring-2 ring-bg-surface ${getUserColorClass(user.id)} ${idx > 0 ? '-ml-2' : ''}`}
                        style={{ zIndex: teamMembers.length - idx }}
                        title={`${user.first_name} ${user.last_name}`}
                      >
                        {user.initials}
                      </span>
                    ))}
                    {teamMembers.length > 4 && (
                      <span className="inline-flex items-center justify-center w-7 h-7 -ml-2 rounded-full text-[11px] font-semibold bg-bg-hover text-text-muted ring-2 ring-bg-surface">
                        +{teamMembers.length - 4}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-border/60 text-text-muted/60 hover:border-border hover:text-text-muted transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-text-muted/60 group-hover:text-text-muted transition-colors" />
              </button>

              {/* Team dropdown */}
              {showTeamDropdown && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* Attorneys section */}
                  <div className="p-4 border-b border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Attorneys</span>
                      <UserSelect
                        users={attorneys}
                        selectedIds={caseData.attorney_ids || []}
                        onSelect={(userId) => assignAttorneyMutation.mutate(userId)}
                        filterPosition="attorney"
                        placeholder="Add..."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {caseData.attorneys?.map(user => (
                        <div
                          key={user.id}
                          className="group/chip inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-bg-hover/70 hover:bg-bg-hover transition-colors"
                        >
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold shadow-sm ${getUserColorClass(user.id)}`}>
                            {user.initials}
                          </span>
                          <span className="text-sm text-text-secondary font-medium">{user.first_name}</span>
                          <button
                            onClick={() => removeAttorneyMutation.mutate(user.id)}
                            className="p-0.5 rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-bg-surface transition-all"
                          >
                            <X className="w-3 h-3 text-text-muted" />
                          </button>
                        </div>
                      ))}
                      {(!caseData.attorneys || caseData.attorneys.length === 0) && (
                        <span className="text-sm text-text-muted/60 italic">None assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Paralegals section */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Paralegals</span>
                      <UserSelect
                        users={paralegals}
                        selectedIds={caseData.paralegal_ids || []}
                        onSelect={(userId) => assignParalegalMutation.mutate(userId)}
                        filterPosition="paralegal"
                        placeholder="Add..."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {caseData.paralegals?.map(user => (
                        <div
                          key={user.id}
                          className="group/chip inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-bg-hover/70 hover:bg-bg-hover transition-colors"
                        >
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold shadow-sm ${getUserColorClass(user.id)}`}>
                            {user.initials}
                          </span>
                          <span className="text-sm text-text-secondary font-medium">{user.first_name}</span>
                          <button
                            onClick={() => removeParalegalMutation.mutate(user.id)}
                            className="p-0.5 rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-bg-surface transition-all"
                          >
                            <X className="w-3 h-3 text-text-muted" />
                          </button>
                        </div>
                      ))}
                      {(!caseData.paralegals || caseData.paralegals.length === 0) && (
                        <span className="text-sm text-text-muted/60 italic">None assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Horizontal divider */}
          <div className="border-t border-border" />

          <ProceedingsSection
            caseId={caseId}
            proceedings={caseData.proceedings || []}
          />

          {/* Compact Summary */}
          <CompactSummary
            value={caseData.case_summary || ''}
            onSave={(value) => onUpdateField('case_summary', value || null)}
          />
        </div>

        {/* Counsel & Mediator */}
        <div className="bg-bg-surface rounded-lg border border-border p-3 space-y-3">
          {/* Counsel */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-text-muted" />
                <h4 className="text-sm font-medium text-text-secondary">Counsel</h4>
                {counsel.length > 0 && (
                  <span className="text-xs text-text-muted">({counsel.length})</span>
                )}
              </div>
              <AddPersonDropdown
                roleOptions={counselRoleOptions}
                onAssign={(person, role) => assignCounselMutation.mutate({ person, role })}
                onCreate={(name, role) => createCounselMutation.mutate({ name, role })}
                excludePersonIds={assignedPersonIds}
                getPersonTypes={() => ['attorney']}
                getPlaceholder={() => 'Search attorneys...'}
              />
            </div>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex flex-wrap gap-1">
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
                  <span className="text-sm text-text-muted italic">None</span>
                )}
              </div>
              <UnnestDropZone isVisible={activePerson !== null && !!activePerson.grouped_under_id && counsel.some(c => c.id === activePerson.id)} sectionId="counsel" />
            </DndContext>
          </div>

          {/* Mediator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-text-muted" />
                <h4 className="text-sm font-medium text-text-secondary">Mediator</h4>
                {mediators.length > 0 && (
                  <span className="text-xs text-text-muted">({mediators.length})</span>
                )}
              </div>
              <button onClick={() => setShowAddMediator(!showAddMediator)} className="text-primary-600 hover:text-primary-700">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {showAddMediator && (
              <div className="mb-1">
                <PersonAutocomplete
                  personTypes={['mediator']}
                  excludePersonIds={assignedPersonIds}
                  onSelectPerson={(person) => assignMediatorMutation.mutate(person)}
                  onCreateNew={(name) => createMediatorMutation.mutate(name)}
                  onCancel={() => setShowAddMediator(false)}
                  placeholder="Search..."
                  autoFocus
                />
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {mediators.map(m => (
                <PersonChip key={m.assignment_id} person={m} onOpenDetail={() => openPersonModal(m.id, { caseId })} variant="muted" />
              ))}
              {mediators.length === 0 && !showAddMediator && (
                <span className="text-sm text-text-muted italic">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Key Dates */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <h4 className="text-sm font-medium text-text-secondary">Key Dates</h4>
              {(starredEvents.length > 0 || caseData.date_of_injury) && (
                <span className="text-xs text-text-muted">({starredEvents.length + (caseData.date_of_injury ? 1 : 0)})</span>
              )}
            </div>
            {unstarredEvents.length > 0 && (
              <button
                onClick={() => setShowAddKeyDate(!showAddKeyDate)}
                className="text-primary-600 hover:text-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add Key Date search */}
          {showAddKeyDate && (
            <div className="mb-2 relative">
              <input
                type="text"
                value={keyDateSearch}
                onChange={(e) => {
                  setKeyDateSearch(e.target.value);
                  setKeyDateSelectedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowAddKeyDate(false);
                    setKeyDateSearch('');
                    setKeyDateSelectedIndex(0);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setKeyDateSelectedIndex(i => Math.min(i + 1, filteredUnstarredEvents.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setKeyDateSelectedIndex(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredUnstarredEvents[keyDateSelectedIndex]) {
                      starEventMutation.mutate(filteredUnstarredEvents[keyDateSelectedIndex].id);
                    }
                  }
                }}
                placeholder="Search..."
                className="w-full px-2 py-1.5 text-sm rounded border border-border bg-bg-surface text-text placeholder-text-muted focus:border-primary-500 outline-none"
                autoFocus
              />
              {/* Results dropdown */}
              {filteredUnstarredEvents.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-bg-surface border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredUnstarredEvents.map((event, idx) => (
                    <button
                      key={event.id}
                      onClick={() => starEventMutation.mutate(event.id)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                        idx === keyDateSelectedIndex
                          ? 'bg-primary-50 dark:bg-primary-900/30'
                          : 'hover:bg-bg-hover'
                      }`}
                    >
                      <span className="text-text-secondary truncate">{event.description}</span>
                      <span className="text-xs text-text-muted shrink-0 ml-2">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {filteredUnstarredEvents.length === 0 && keyDateSearch && (
                <div className="absolute z-10 w-full mt-1 bg-bg-surface border border-border rounded-md shadow-lg p-3 text-sm text-text-muted italic">
                  No matching events
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            {/* Date of Injury - always show first */}
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-3 h-3 text-red-500 shrink-0" />
              <span className="text-text-secondary truncate">Date of Injury</span>
              <EditableDate
                value={caseData.date_of_injury || null}
                onSave={(value) => onUpdateField('date_of_injury', value)}
                placeholder="Set date"
                className="text-xs shrink-0"
                clearable={false}
              />
            </div>
            {/* Starred events - click star to remove */}
            {starredEvents.map(event => (
              <div key={event.id} className="flex items-center gap-2 text-sm group">
                <button
                  onClick={() => setEventToUnstar({ id: event.id, description: event.description })}
                  className="shrink-0 hover:scale-110 transition-transform"
                  title="Remove from Key Dates"
                >
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                </button>
                <span className="text-text-secondary truncate">{event.description}</span>
                <span className="text-xs text-text-muted shrink-0">
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            ))}
            {starredEvents.length === 0 && !caseData.date_of_injury && (
              <p className="text-xs text-text-muted italic">Star events to pin them here</p>
            )}
          </div>

          {/* Confirm unstar modal */}
          <ConfirmModal
            isOpen={!!eventToUnstar}
            onClose={() => setEventToUnstar(null)}
            onConfirm={() => eventToUnstar && unstarEventMutation.mutate(eventToUnstar.id)}
            title="Remove Key Date"
            message={`Remove "${eventToUnstar?.description}" from Key Dates? The event will still exist, just won't be pinned here.`}
            confirmText="Remove"
            variant="warning"
            isLoading={unstarEventMutation.isPending}
          />
        </div>
      </div>

      {/* Row 2: Parties (Clients, Defendants, Experts, Other) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clients */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
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
              {clients.length === 0 && <p className="text-xs text-text-muted italic">None</p>}
            </div>
            <UnnestDropZone isVisible={activePerson !== null && !!activePerson.grouped_under_id && clients.some(c => c.id === activePerson.id)} sectionId="clients" />
          </DndContext>
        </div>

        {/* Defendants */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
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
                placeholder="Search..."
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
              {defendants.length === 0 && !showAddDefendant && <p className="text-xs text-text-muted italic">None</p>}
            </div>
            <UnnestDropZone isVisible={activePerson !== null && !!activePerson.grouped_under_id && defendants.some(d => d.id === activePerson.id)} sectionId="defendants" />
          </DndContext>
        </div>

        {/* Experts */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
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
            {experts.length === 0 && <p className="text-xs text-text-muted italic">None</p>}
          </div>
        </div>

        {/* Other */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
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
            {others.length === 0 && <p className="text-xs text-text-muted italic">None</p>}
          </div>
        </div>
      </div>

      {/* Row 4: Tasks & Events side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
          <TasksComponent
            caseId={caseId}
            title="Tasks"
            showControls={false}
            showDetailSheet={false}
            maxItems={8}
            compact
            defaultGroupBy="urgency"
            showCase={false}
            enableInlineCreate
          />
        </div>

        {/* Events */}
        <div className="bg-bg-surface rounded-lg border border-border p-3">
          <EventsComponent
            caseId={caseId}
            title="Events"
            showControls={false}
            showCase={false}
            compact
          />
        </div>
      </div>
    </div>
  );
}
