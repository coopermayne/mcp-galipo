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
import { EditableText, ConfirmModal } from '../common';
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

// Type-specific attribute display
function AttributesSection({ person }: { person: Person }) {
  const type = person.person_type;
  const attrs = person.attributes || {};

  if (type === 'judge') {
    const judgeAttrs = attrs as { courtroom_number?: string; chambers?: string; initials?: string; jurisdiction?: string };
    return (
      <div className="space-y-2">
        {judgeAttrs.courtroom_number && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Courtroom:</span>
            <span className="text-slate-700 dark:text-slate-300">{judgeAttrs.courtroom_number}</span>
          </div>
        )}
        {judgeAttrs.chambers && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Chambers:</span>
            <span className="text-slate-700 dark:text-slate-300">{judgeAttrs.chambers}</span>
          </div>
        )}
        {judgeAttrs.initials && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Initials:</span>
            <span className="text-slate-700 dark:text-slate-300">{judgeAttrs.initials}</span>
          </div>
        )}
        {judgeAttrs.jurisdiction && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Jurisdiction:</span>
            <span className="text-slate-700 dark:text-slate-300">{judgeAttrs.jurisdiction}</span>
          </div>
        )}
      </div>
    );
  }

  if (type === 'expert') {
    const expertAttrs = attrs as { hourly_rate?: number; deposition_rate?: number; trial_rate?: number; expertises?: string[] };
    return (
      <div className="space-y-2">
        {expertAttrs.expertises && expertAttrs.expertises.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Specialties:</span>
            <div className="flex flex-wrap gap-1">
              {expertAttrs.expertises.map((exp, i) => (
                <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                  {exp}
                </span>
              ))}
            </div>
          </div>
        )}
        {expertAttrs.hourly_rate && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Hourly Rate:</span>
            <span className="text-slate-700 dark:text-slate-300">${expertAttrs.hourly_rate}/hr</span>
          </div>
        )}
        {expertAttrs.deposition_rate && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Deposition:</span>
            <span className="text-slate-700 dark:text-slate-300">${expertAttrs.deposition_rate}/hr</span>
          </div>
        )}
        {expertAttrs.trial_rate && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Trial Rate:</span>
            <span className="text-slate-700 dark:text-slate-300">${expertAttrs.trial_rate}/hr</span>
          </div>
        )}
      </div>
    );
  }

  if (type === 'attorney') {
    const attorneyAttrs = attrs as { bar_number?: string };
    return attorneyAttrs.bar_number ? (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 w-24 shrink-0">Bar Number:</span>
        <span className="text-slate-700 dark:text-slate-300">{attorneyAttrs.bar_number}</span>
      </div>
    ) : null;
  }

  if (type === 'mediator') {
    const mediatorAttrs = attrs as { half_day_rate?: number; full_day_rate?: number; style?: string };
    return (
      <div className="space-y-2">
        {mediatorAttrs.style && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Style:</span>
            <span className="text-slate-700 dark:text-slate-300">{mediatorAttrs.style}</span>
          </div>
        )}
        {mediatorAttrs.half_day_rate && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Half Day:</span>
            <span className="text-slate-700 dark:text-slate-300">${mediatorAttrs.half_day_rate}</span>
          </div>
        )}
        {mediatorAttrs.full_day_rate && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Full Day:</span>
            <span className="text-slate-700 dark:text-slate-300">${mediatorAttrs.full_day_rate}</span>
          </div>
        )}
      </div>
    );
  }

  if (type === 'client') {
    const clientAttrs = attrs as { date_of_birth?: string; preferred_language?: string; emergency_contact?: string };
    return (
      <div className="space-y-2">
        {clientAttrs.date_of_birth && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">DOB:</span>
            <span className="text-slate-700 dark:text-slate-300">{clientAttrs.date_of_birth}</span>
          </div>
        )}
        {clientAttrs.preferred_language && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Language:</span>
            <span className="text-slate-700 dark:text-slate-300">{clientAttrs.preferred_language}</span>
          </div>
        )}
        {clientAttrs.emergency_contact && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 w-24 shrink-0">Emergency:</span>
            <span className="text-slate-700 dark:text-slate-300">{clientAttrs.emergency_contact}</span>
          </div>
        )}
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
  const primaryPhone = person.phones?.find(p => p.primary)?.value || person.phones?.[0]?.value;
  const primaryEmail = person.emails?.find(e => e.primary)?.value || person.emails?.[0]?.value;

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
        <div className="space-y-3 pl-6">
          {/* Phone */}
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            {primaryPhone ? (
              <a href={`tel:${primaryPhone}`} className="text-slate-700 dark:text-slate-300 hover:text-primary-600">
                {primaryPhone}
              </a>
            ) : (
              <span className="text-slate-400 italic">No phone</span>
            )}
            {person.phones && person.phones.length > 1 && (
              <span className="text-xs text-slate-400">(+{person.phones.length - 1} more)</span>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            {primaryEmail ? (
              <a href={`mailto:${primaryEmail}`} className="text-slate-700 dark:text-slate-300 hover:text-primary-600">
                {primaryEmail}
              </a>
            ) : (
              <span className="text-slate-400 italic">No email</span>
            )}
            {person.emails && person.emails.length > 1 && (
              <span className="text-xs text-slate-400">(+{person.emails.length - 1} more)</span>
            )}
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
      <AttributesSection person={person} />

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
