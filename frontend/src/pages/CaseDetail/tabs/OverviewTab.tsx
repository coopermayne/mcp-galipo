import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserCog,
  Building2,
  Plus,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Star,
  ExternalLink,
} from 'lucide-react';
import {
  EditableText,
  EditableSelect,
  EditableDate,
  ConfirmModal,
} from '../../../components/common';
import {
  createPerson,
  assignPersonToCase,
  removePersonFromCase,
} from '../../../api';
import type { Case, Constants, Jurisdiction } from '../../../types';
import { ContactCard, StarredEvents, ProceedingsSection } from '../components';
import { getPrimaryPhone, getPrimaryEmail } from '../utils';

interface OverviewTabProps {
  caseData: Case;
  caseId: number;
  constants: Constants | undefined;
  onUpdateField: (field: string, value: string | number | null) => Promise<void>;
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

export function OverviewTab({ caseData, caseId, constants, onUpdateField }: OverviewTabProps) {
  const queryClient = useQueryClient();
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddDefendant, setShowAddDefendant] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', is_primary: false });
  const [newDefendantName, setNewDefendantName] = useState('');
  const [newContact, setNewContact] = useState({
    name: '',
    role: 'Opposing Counsel',
    organization: '',
    phone: '',
    email: '',
  });
  const [clientDeleteTarget, setClientDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [defendantDeleteTarget, setDefendantDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [contactDeleteTarget, setContactDeleteTarget] = useState<{
    id: number;
    name: string;
    role: string;
  } | null>(null);

  // Filter persons by role
  const clients = useMemo(
    () =>
      (caseData.persons || []).filter(
        (p) =>
          p.role === 'Client' || p.role === 'Guardian Ad Litem' || p.role === 'Plaintiff Contact'
      ),
    [caseData.persons]
  );

  const defendants = useMemo(
    () => (caseData.persons || []).filter((p) => p.role === 'Defendant'),
    [caseData.persons]
  );

  // Group contacts by category
  const judges = useMemo(
    () =>
      (caseData.persons || []).filter((p) => p.role === 'Judge' || p.role === 'Magistrate Judge'),
    [caseData.persons]
  );

  const counsel = useMemo(
    () =>
      (caseData.persons || []).filter(
        (p) =>
          p.role === 'Opposing Counsel' || p.role === 'Co-Counsel' || p.role === 'Referring Attorney'
      ),
    [caseData.persons]
  );

  const experts = useMemo(() => {
    const all = (caseData.persons || []).filter(
      (p) =>
        p.role === 'Expert - Plaintiff' ||
        p.role === 'Plaintiff Expert' ||
        p.role === 'Expert - Defendant' ||
        p.role === 'Defendant Expert'
    );
    // Sort so plaintiff experts come first
    return all.sort((a, b) => {
      const aIsPlaintiff = a.role?.includes('Plaintiff') ? 0 : 1;
      const bIsPlaintiff = b.role?.includes('Plaintiff') ? 0 : 1;
      return aIsPlaintiff - bIsPlaintiff;
    });
  }, [caseData.persons]);

  const otherContacts = useMemo(
    () =>
      (caseData.persons || []).filter(
        (p) =>
          p.role !== 'Client' &&
          p.role !== 'Defendant' &&
          p.role !== 'Judge' &&
          p.role !== 'Magistrate Judge' &&
          p.role !== 'Opposing Counsel' &&
          p.role !== 'Co-Counsel' &&
          p.role !== 'Referring Attorney' &&
          p.role !== 'Expert - Plaintiff' &&
          p.role !== 'Plaintiff Expert' &&
          p.role !== 'Expert - Defendant' &&
          p.role !== 'Defendant Expert' &&
          p.role !== 'Guardian Ad Litem' &&
          p.role !== 'Plaintiff Contact'
      ),
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
    'Opposing Counsel',
    'Co-Counsel',
    'Referring Attorney',
    'Mediator',
    'Judge',
    'Magistrate Judge',
    'Expert - Plaintiff',
    'Expert - Defendant',
    'Witness',
    'Guardian Ad Litem',
    'Plaintiff Contact',
    'Insurance Adjuster',
    'Lien Holder',
  ];

  const addClientMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      phone?: string;
      email?: string;
      is_primary?: boolean;
    }) => {
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
      setClientDeleteTarget(null);
    },
  });

  const handleDeleteClient = useCallback((client: { id: number; name: string }) => {
    setClientDeleteTarget({ id: client.id, name: client.name });
  }, []);

  const confirmDeleteClient = useCallback(() => {
    if (clientDeleteTarget) {
      removeClientMutation.mutate(clientDeleteTarget.id);
    }
  }, [clientDeleteTarget, removeClientMutation]);

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
      setDefendantDeleteTarget(null);
    },
  });

  const handleDeleteDefendant = useCallback((defendant: { id: number; name: string }) => {
    setDefendantDeleteTarget({ id: defendant.id, name: defendant.name });
  }, []);

  const confirmDeleteDefendant = useCallback(() => {
    if (defendantDeleteTarget) {
      removeDefendantMutation.mutate(defendantDeleteTarget.id);
    }
  }, [defendantDeleteTarget, removeDefendantMutation]);

  const addContactMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      role: string;
      organization?: string;
      phone?: string;
      email?: string;
    }) => {
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
      setContactDeleteTarget(null);
    },
  });

  const handleDeleteContact = useCallback(
    (contact: { id: number; name: string; role?: string }) => {
      setContactDeleteTarget({ id: contact.id, name: contact.name, role: contact.role || '' });
    },
    []
  );

  const confirmDeleteContact = useCallback(() => {
    if (contactDeleteTarget) {
      removeContactMutation.mutate({
        personId: contactDeleteTarget.id,
        role: contactDeleteTarget.role,
      });
    }
  }, [contactDeleteTarget, removeContactMutation]);

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
          {caseData.status === 'Closed' && (
            <Field label="Result">
              <EditableText
                value={caseData.result || ''}
                onSave={(value) => onUpdateField('result', value || null)}
                placeholder="e.g., Settled, Verdict"
              />
            </Field>
          )}
        </div>

        {/* Court Proceedings */}
        <ProceedingsSection
          caseId={caseId}
          proceedings={caseData.proceedings || []}
          jurisdictions={constants?.jurisdictions}
          judges={caseData.persons || []}
        />
      </div>

      {/* Important Dates & Starred Events */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Key Dates</h3>
        </div>
        <div className="space-y-3">
          {/* Date of Injury - styled like starred events */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 w-32 shrink-0">Date of Injury</span>
            <EditableDate
              value={caseData.date_of_injury || null}
              onSave={(value) => onUpdateField('date_of_injury', value)}
              placeholder="Select date"
              className="text-sm"
            />
          </div>
          {/* Starred Events */}
          <StarredEvents events={caseData.events || []} />
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
                  onClick={() => handleDeleteClient(client)}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    {client.name}
                  </p>
                  {client.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
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
                  onClick={() => handleDeleteDefendant(defendant)}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Judges */}
      {judges.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCog className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Judges</h3>
          </div>
          <div className="space-y-2">
            {judges.map((judge) => (
              <ContactCard
                key={judge.assignment_id}
                contact={judge}
                onRemove={() => handleDeleteContact(judge)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Counsel */}
      {counsel.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCog className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Counsel</h3>
          </div>
          <div className="space-y-2">
            {counsel.map((person) => (
              <ContactCard
                key={person.assignment_id}
                contact={person}
                onRemove={() => handleDeleteContact(person)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Experts */}
      {experts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCog className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Experts</h3>
          </div>
          <div className="space-y-2">
            {experts.map((expert) => (
              <ContactCard
                key={expert.assignment_id}
                contact={expert}
                onRemove={() => handleDeleteContact(expert)}
                highlightSide
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Contacts */}
      {otherContacts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCog className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Other Contacts</h3>
          </div>
          <div className="space-y-2">
            {otherContacts.map((contact) => (
              <ContactCard
                key={contact.assignment_id}
                contact={contact}
                onRemove={() => handleDeleteContact(contact)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Contact */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Add Contact</h3>
          </div>
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {showAddContact ? 'Cancel' : 'Expand'}
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
            className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg"
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
            <div className="mt-3 flex justify-end">
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
      </div>

      {/* Delete Confirmation Modals */}
      <ConfirmModal
        isOpen={!!clientDeleteTarget}
        onClose={() => setClientDeleteTarget(null)}
        onConfirm={confirmDeleteClient}
        title="Remove Client"
        message={`Are you sure you want to remove "${clientDeleteTarget?.name}" from this case?`}
        confirmText="Remove Client"
        variant="danger"
        isLoading={removeClientMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!defendantDeleteTarget}
        onClose={() => setDefendantDeleteTarget(null)}
        onConfirm={confirmDeleteDefendant}
        title="Remove Defendant"
        message={`Are you sure you want to remove "${defendantDeleteTarget?.name}" from this case?`}
        confirmText="Remove Defendant"
        variant="danger"
        isLoading={removeDefendantMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!contactDeleteTarget}
        onClose={() => setContactDeleteTarget(null)}
        onConfirm={confirmDeleteContact}
        title="Remove Contact"
        message={`Are you sure you want to remove "${contactDeleteTarget?.name}"${contactDeleteTarget?.role ? ` (${contactDeleteTarget.role})` : ''} from this case?`}
        confirmText="Remove Contact"
        variant="danger"
        isLoading={removeContactMutation.isPending}
      />
    </div>
  );
}
