import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Pencil,
  Check,
} from 'lucide-react';
import { EditableText, EditableContactList, ConfirmModal } from '../common';
import { getPerson, updatePerson, removePersonFromCase, changePersonRole, getRoles } from '../../api';
import { ROLE_CATEGORY_COLORS } from '../../config/colors';
import type {
  PersonRole,
  UpdatePersonInput,
  ExpertAttributes,
  AttorneyAttributes,
  MediatorAttributes,
  ClientAttributes,
  Role,
} from '../../types';

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
        <span className="text-text-muted w-24 shrink-0">{label}:</span>
        <span className="text-text-secondary">
          {prefix}{value}{suffix}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-text-muted w-24 shrink-0">{label}:</span>
      <div className="flex-1 flex items-center gap-1">
        {prefix && <span className="text-text-secondary">{prefix}</span>}
        <EditableText
          value={value}
          onSave={onSave}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          className="flex-1"
        />
        {suffix && value && <span className="text-text-secondary">{suffix}</span>}
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
        <span className="text-text-muted w-24 shrink-0">Specialties:</span>
        <div className="flex flex-wrap gap-1">
          {expertises.map((exp, i) => (
            <span key={i} className="px-2 py-0.5 bg-bg-hover rounded text-xs">
              {exp}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-text-muted w-24 shrink-0 pt-1">Specialties:</span>
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
              <span key={i} className="px-2 py-0.5 bg-bg-hover rounded text-xs">
                {exp}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Role-specific attribute display based on role name
function RoleAttributesSection({
  role,
  attributes,
  readOnly,
  onUpdateAttribute,
}: {
  role: PersonRole;
  attributes: Record<string, unknown>;
  readOnly: boolean;
  onUpdateAttribute: (key: string, value: unknown) => Promise<unknown>;
}) {
  const roleName = role.role.name.toLowerCase();

  const handleStringAttr = (key: string) => async (value: string) => {
    await onUpdateAttribute(key, value || undefined);
  };

  const handleNumberAttr = (key: string) => async (value: string) => {
    const num = value ? parseFloat(value) : undefined;
    await onUpdateAttribute(key, num);
  };

  // Expert roles (Plaintiff Expert, Defense Expert, etc.)
  if (roleName.includes('expert')) {
    const expertAttrs = attributes as ExpertAttributes;
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

  // Attorney roles (Lead Attorney, Co-Counsel, Defense Counsel, etc.)
  if (roleName.includes('attorney') || roleName.includes('counsel')) {
    const attorneyAttrs = attributes as AttorneyAttributes;
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

  // Mediator
  if (roleName.includes('mediator')) {
    const mediatorAttrs = attributes as MediatorAttributes;
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

  // Client
  if (roleName === 'client') {
    const clientAttrs = attributes as ClientAttributes;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const readOnly = context?.readOnly ?? false;
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [selectedNewRoleId, setSelectedNewRoleId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['person', entityId],
    queryFn: () => getPerson(entityId),
    retry: false,
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => getRoles(),
  });

  const updateMutation = useMutation({
    mutationFn: (update: UpdatePersonInput) => updatePerson(entityId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', entityId] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (roleId?: number) => removePersonFromCase(context!.caseId!, entityId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', context?.caseId] });
      setShowRemoveConfirm(false);
      onClose();
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ oldRoleId, newRoleId }: { oldRoleId: number; newRoleId: number }) =>
      changePersonRole(context!.caseId!, entityId, { old_role_id: oldRoleId, new_role_id: newRoleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', entityId] });
      queryClient.invalidateQueries({ queryKey: ['case', context?.caseId] });
      setEditingRoleId(null);
      setSelectedNewRoleId(null);
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

  // Find the assignment for the current case
  const caseRole = data?.person?.roles?.find(r => r.case_id === context?.caseId);

  const handleRemoveFromCase = () => {
    removeMutation.mutate(caseRole?.role_id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !data?.person) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>This person may have been deleted</p>
        <button
          onClick={onClose}
          className="mt-3 px-4 py-1.5 text-sm text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  const person = data.person;
  const allRoles = rolesData?.roles || [];

  // Get roles that have case assignments
  const caseRoles = person.roles?.filter(r => r.case_id) || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <User className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          {readOnly ? (
            <h2 className="text-xl font-semibold text-text">
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
          {/* Show role badges */}
          {person.roles && person.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Array.from(new Set(person.roles.map(r => r.role.name))).map(roleName => {
                const role = person.roles!.find(r => r.role.name === roleName)!;
                const colors = ROLE_CATEGORY_COLORS[role.role.category];
                return (
                  <span
                    key={roleName}
                    className={`inline-block px-2 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text}`}
                  >
                    {roleName}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contact Info */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Phone className="w-4 h-4 text-text-muted" />
          Contact Information
        </h3>
        <div className="space-y-4 pl-6">
          {/* Phones */}
          <div>
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
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
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
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
            <Building className="w-4 h-4 text-text-muted shrink-0" />
            {readOnly ? (
              <span className={person.organization ? 'text-text-secondary' : 'text-text-muted italic'}>
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
            <MapPin className="w-4 h-4 text-text-muted shrink-0" />
            {readOnly ? (
              <span className={person.address ? 'text-text-secondary' : 'text-text-muted italic'}>
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

      {/* Notes */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-text-muted" />
          Notes
        </h3>
        {readOnly ? (
          <p className={`text-sm pl-6 ${person.notes ? 'text-text-secondary' : 'text-text-muted italic'}`}>
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
      {caseRoles.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-text-muted" />
            Case Assignments ({caseRoles.length})
          </h3>
          <div className="space-y-2 pl-6">
            {caseRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-2 bg-bg-hover rounded text-sm"
              >
                <div className="min-w-0">
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/cases/${role.case_id}`);
                    }}
                    className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline truncate block text-left"
                  >
                    {role.short_name || role.case_name || `Case #${role.case_id}`}
                  </button>
                  <span className="text-xs text-text-secondary">{role.role.name}</span>
                </div>
                {role.is_primary && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role on this case + Remove - only show when viewing from a case context */}
      {context?.caseId && !readOnly && caseRole && (() => {
        const currentRoleId = caseRole.role_id;
        const currentRoleName = caseRole.role.name;
        const availableRoles = allRoles.filter((r: Role) => r.id !== currentRoleId);

        return (
          <div className="mt-6 pt-6 border-t border-border space-y-3">
            {/* Role display / edit */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-sm text-text-muted">Role:</span>
              {editingRoleId === currentRoleId ? (
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={selectedNewRoleId || ''}
                    onChange={(e) => setSelectedNewRoleId(e.target.value ? Number(e.target.value) : null)}
                    className="text-sm bg-bg border border-border rounded px-2 py-1 text-text flex-1"
                    autoFocus
                  >
                    <option value="">Select new role...</option>
                    {availableRoles.map((role: Role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (selectedNewRoleId) {
                        changeRoleMutation.mutate({ oldRoleId: currentRoleId, newRoleId: selectedNewRoleId });
                      }
                    }}
                    disabled={!selectedNewRoleId || changeRoleMutation.isPending}
                    className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-40"
                  >
                    {changeRoleMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => { setEditingRoleId(null); setSelectedNewRoleId(null); }}
                    className="p-1 text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-text">{currentRoleName}</span>
                  <button
                    onClick={() => setEditingRoleId(currentRoleId)}
                    className="p-1 text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded transition-colors"
                    title="Change role"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Role-specific attributes */}
            {caseRole && (
              <div className="px-3">
                <RoleAttributesSection
                  role={caseRole}
                  attributes={(caseRole.attributes || {}) as Record<string, unknown>}
                  readOnly={readOnly}
                  onUpdateAttribute={async () => {
                    // TODO: Implement attribute updates via updateCaseAssignment
                    // For now, attributes are read-only
                  }}
                />
              </div>
            )}

            {changeRoleMutation.isError && (
              <p className="text-xs text-red-500 px-3">
                {(changeRoleMutation.error as Error)?.message || 'Failed to change role'}
              </p>
            )}
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              Remove from case
            </button>
          </div>
        );
      })()}

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
