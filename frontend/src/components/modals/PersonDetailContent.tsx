import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  FileText,
  Briefcase,
  X,
  Loader2,
  AlertCircle,
  UserMinus,
} from 'lucide-react';
import { EditableText, EditableContactList, ConfirmModal } from '../common';
import { getPerson, updatePerson, removePersonFromCase } from '../../api';
import type { Person, UpdatePersonInput } from '../../types';

interface PersonDetailContentProps {
  entityId: number;
  context?: {
    caseId?: number;
    readOnly?: boolean;
  };
  onClose: () => void;
}

// Editable attribute row component
function AttributeRow({
  label,
  value,
  onSave,
  readOnly,
  placeholder,
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
  readOnly: boolean;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (readOnly) {
    if (!value) return null;
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 w-24 shrink-0">{label}:</span>
        <span className="text-slate-700 dark:text-slate-300">
          {prefix}{value}{suffix}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400 w-24 shrink-0">{label}:</span>
      <div className="flex-1 flex items-center gap-1">
        {prefix && <span className="text-slate-500">{prefix}</span>}
        <EditableText
          value={value}
          onSave={onSave}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          className="flex-1"
        />
        {suffix && value && <span className="text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

// Editable expertises tag input
function EditableExpertises({
  expertises,
  onSave,
  readOnly,
}: {
  expertises: string[];
  onSave: (expertises: string[]) => Promise<unknown>;
  readOnly: boolean;
}) {
  const handleSave = async (value: string) => {
    const newExpertises = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await onSave(newExpertises);
  };

  if (readOnly) {
    if (!expertises || expertises.length === 0) return null;
    return (
      <div className="flex items-start gap-2 text-sm">
        <span className="text-slate-400 w-24 shrink-0">Specialties:</span>
        <div className="flex flex-wrap gap-1">
          {expertises.map((exp, i) => (
            <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
              {exp}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-400 w-24 shrink-0 pt-1">Specialties:</span>
      <div className="flex-1">
        <EditableText
          value={expertises?.join(', ') || ''}
          onSave={handleSave}
          placeholder="Enter specialties (comma-separated)..."
          className="flex-1"
        />
        {expertises && expertises.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {expertises.map((exp, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                {exp}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Type-specific attribute display
function AttributesSection({
  person,
  readOnly,
  onUpdateAttribute,
}: {
  person: Person;
  readOnly: boolean;
  onUpdateAttribute: (key: string, value: unknown) => Promise<unknown>;
}) {
  const type = person.person_type;
  const attrs = person.attributes || {};

  const handleStringAttr = (key: string) => async (value: string) => {
    await onUpdateAttribute(key, value || undefined);
  };

  const handleNumberAttr = (key: string) => async (value: string) => {
    const num = value ? parseFloat(value) : undefined;
    await onUpdateAttribute(key, num);
  };

  if (type === 'judge') {
    const judgeAttrs = attrs as { courtroom_number?: string; chambers?: string; initials?: string; jurisdiction?: string };
    return (
      <div className="space-y-2">
        <AttributeRow
          label="Courtroom"
          value={judgeAttrs.courtroom_number || ''}
          onSave={handleStringAttr('courtroom_number')}
          readOnly={readOnly}
          placeholder="e.g., 302"
        />
        <AttributeRow
          label="Chambers"
          value={judgeAttrs.chambers || ''}
          onSave={handleStringAttr('chambers')}
          readOnly={readOnly}
          placeholder="e.g., 3rd Floor, Room 310"
        />
        <AttributeRow
          label="Initials"
          value={judgeAttrs.initials || ''}
          onSave={handleStringAttr('initials')}
          readOnly={readOnly}
          placeholder="e.g., JRS"
        />
        <AttributeRow
          label="Jurisdiction"
          value={judgeAttrs.jurisdiction || ''}
          onSave={handleStringAttr('jurisdiction')}
          readOnly={readOnly}
          placeholder="e.g., Los Angeles Superior Court"
        />
      </div>
    );
  }

  if (type === 'expert') {
    const expertAttrs = attrs as { hourly_rate?: number; deposition_rate?: number; trial_rate?: number; expertises?: string[] };
    return (
      <div className="space-y-2">
        <EditableExpertises
          expertises={expertAttrs.expertises || []}
          onSave={(expertises) => onUpdateAttribute('expertises', expertises.length > 0 ? expertises : undefined)}
          readOnly={readOnly}
        />
        <AttributeRow
          label="Hourly Rate"
          value={expertAttrs.hourly_rate?.toString() || ''}
          onSave={handleNumberAttr('hourly_rate')}
          readOnly={readOnly}
          placeholder="e.g., 350"
          prefix="$"
          suffix="/hr"
        />
        <AttributeRow
          label="Deposition"
          value={expertAttrs.deposition_rate?.toString() || ''}
          onSave={handleNumberAttr('deposition_rate')}
          readOnly={readOnly}
          placeholder="e.g., 500"
          prefix="$"
          suffix="/hr"
        />
        <AttributeRow
          label="Trial Rate"
          value={expertAttrs.trial_rate?.toString() || ''}
          onSave={handleNumberAttr('trial_rate')}
          readOnly={readOnly}
          placeholder="e.g., 750"
          prefix="$"
          suffix="/hr"
        />
      </div>
    );
  }

  if (type === 'attorney') {
    const attorneyAttrs = attrs as { bar_number?: string };
    return (
      <div className="space-y-2">
        <AttributeRow
          label="Bar Number"
          value={attorneyAttrs.bar_number || ''}
          onSave={handleStringAttr('bar_number')}
          readOnly={readOnly}
          placeholder="e.g., CA123456"
        />
      </div>
    );
  }

  if (type === 'mediator') {
    const mediatorAttrs = attrs as { half_day_rate?: number; full_day_rate?: number; style?: string };
    return (
      <div className="space-y-2">
        <AttributeRow
          label="Style"
          value={mediatorAttrs.style || ''}
          onSave={handleStringAttr('style')}
          readOnly={readOnly}
          placeholder="e.g., Evaluative, Facilitative"
        />
        <AttributeRow
          label="Half Day"
          value={mediatorAttrs.half_day_rate?.toString() || ''}
          onSave={handleNumberAttr('half_day_rate')}
          readOnly={readOnly}
          placeholder="e.g., 1500"
          prefix="$"
        />
        <AttributeRow
          label="Full Day"
          value={mediatorAttrs.full_day_rate?.toString() || ''}
          onSave={handleNumberAttr('full_day_rate')}
          readOnly={readOnly}
          placeholder="e.g., 2500"
          prefix="$"
        />
      </div>
    );
  }

  if (type === 'client') {
    const clientAttrs = attrs as { date_of_birth?: string; preferred_language?: string; emergency_contact?: string };
    return (
      <div className="space-y-2">
        <AttributeRow
          label="DOB"
          value={clientAttrs.date_of_birth || ''}
          onSave={handleStringAttr('date_of_birth')}
          readOnly={readOnly}
          placeholder="e.g., 1985-03-15"
        />
        <AttributeRow
          label="Language"
          value={clientAttrs.preferred_language || ''}
          onSave={handleStringAttr('preferred_language')}
          readOnly={readOnly}
          placeholder="e.g., Spanish"
        />
        <AttributeRow
          label="Emergency"
          value={clientAttrs.emergency_contact || ''}
          onSave={handleStringAttr('emergency_contact')}
          readOnly={readOnly}
          placeholder="e.g., Jane Doe (555) 123-4567"
        />
      </div>
    );
  }

  return null;
}

export function PersonDetailContent({ entityId, context, onClose }: PersonDetailContentProps) {
  const queryClient = useQueryClient();
  const readOnly = context?.readOnly ?? false;
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['person', entityId],
    queryFn: () => getPerson(entityId),
  });

  const updateMutation = useMutation({
    mutationFn: (update: UpdatePersonInput) => updatePerson(entityId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', entityId] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (role?: string) => removePersonFromCase(context!.caseId!, entityId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', context?.caseId] });
      setShowRemoveConfirm(false);
      onClose();
    },
  });

  const handleUpdateField = async (field: keyof UpdatePersonInput, value: string | null) => {
    await updateMutation.mutateAsync({ [field]: value || undefined });
  };

  const handleUpdatePhones = async (phones: Array<{ value: string; label?: string; primary?: boolean }>) => {
    await updateMutation.mutateAsync({ phones });
  };

  const handleUpdateEmails = async (emails: Array<{ value: string; label?: string; primary?: boolean }>) => {
    await updateMutation.mutateAsync({ emails });
  };

  const handleUpdateAttribute = async (key: string, value: unknown) => {
    const newAttributes = { ...data?.person?.attributes, [key]: value };
    // Remove undefined values
    Object.keys(newAttributes).forEach((k) => {
      if (newAttributes[k] === undefined) delete newAttributes[k];
    });
    await updateMutation.mutateAsync({ attributes: newAttributes });
  };

  const handleRemoveFromCase = () => {
    // Find the assignment for the current case to get the role
    const assignment = data?.person?.case_assignments?.find(a => a.case_id === context?.caseId);
    removeMutation.mutate(assignment?.role);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data?.person) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Failed to load person details</p>
      </div>
    );
  }

  const person = data.person;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          {readOnly ? (
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {person.name}
            </h2>
          ) : (
            <EditableText
              value={person.name}
              onSave={(value) => handleUpdateField('name', value)}
              className="text-xl font-semibold"
              inputClassName="text-xl font-semibold"
            />
          )}
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 capitalize">
            {person.person_type}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contact Info */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Phone className="w-4 h-4 text-slate-400" />
          Contact Information
        </h3>
        <div className="space-y-4 pl-6">
          {/* Phones */}
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Phone className="w-3 h-3" />
              Phone Numbers
            </div>
            <EditableContactList
              entries={person.phones || []}
              onSave={handleUpdatePhones}
              type="phone"
              disabled={readOnly}
            />
          </div>

          {/* Emails */}
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Mail className="w-3 h-3" />
              Email Addresses
            </div>
            <EditableContactList
              entries={person.emails || []}
              onSave={handleUpdateEmails}
              type="email"
              disabled={readOnly}
            />
          </div>

          {/* Organization */}
          <div className="flex items-center gap-2 text-sm">
            <Building className="w-4 h-4 text-slate-400 shrink-0" />
            {readOnly ? (
              <span className={person.organization ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}>
                {person.organization || 'No organization'}
              </span>
            ) : (
              <EditableText
                value={person.organization || ''}
                onSave={(value) => handleUpdateField('organization', value)}
                placeholder="Add organization..."
                className="flex-1"
              />
            )}
          </div>

          {/* Address */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            {readOnly ? (
              <span className={person.address ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}>
                {person.address || 'No address'}
              </span>
            ) : (
              <EditableText
                value={person.address || ''}
                onSave={(value) => handleUpdateField('address', value)}
                placeholder="Add address..."
                className="flex-1"
              />
            )}
          </div>
        </div>
      </div>

      {/* Type-Specific Attributes */}
      {person.person_type && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-slate-400" />
            {person.person_type.charAt(0).toUpperCase() + person.person_type.slice(1)} Details
          </h3>
          <div className="pl-6">
            <AttributesSection
              person={person}
              readOnly={readOnly}
              onUpdateAttribute={handleUpdateAttribute}
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Notes
        </h3>
        {readOnly ? (
          <p className={`text-sm pl-6 ${person.notes ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}`}>
            {person.notes || 'No notes'}
          </p>
        ) : (
          <div className="pl-6">
            <EditableText
              value={person.notes || ''}
              onSave={(value) => handleUpdateField('notes', value)}
              placeholder="Add notes..."
              multiline
              className="w-full"
              inputClassName="w-full min-h-[80px]"
            />
          </div>
        )}
      </div>

      {/* Case Assignments */}
      {person.case_assignments && person.case_assignments.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-slate-400" />
            Case Assignments ({person.case_assignments.length})
          </h3>
          <div className="space-y-2 pl-6">
            {person.case_assignments.map((assignment) => (
              <div
                key={assignment.assignment_id}
                className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                    {assignment.short_name || assignment.case_name || `Case #${assignment.case_id}`}
                  </span>
                  <span className="text-xs text-slate-500">{assignment.role}</span>
                </div>
                {assignment.is_primary && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remove from Case button - only show when viewing from a case context */}
      {context?.caseId && !readOnly && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <UserMinus className="w-4 h-4" />
            Remove from case
          </button>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveFromCase}
        title="Remove from case"
        message={`Are you sure you want to remove "${person.name}" from this case? This will not delete the person record.`}
        confirmText="Remove"
        variant="danger"
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
