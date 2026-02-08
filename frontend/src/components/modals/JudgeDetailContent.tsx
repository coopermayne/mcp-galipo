import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Phone,
  Mail,
  Building,
  FileText,
  X,
  Loader2,
  AlertCircle,
  Gavel,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { EditableText, EditableContactList, JurisdictionAutocomplete } from '../common';
import { getJudge, updateJudge, createJurisdiction } from '../../api';
import type { UpdateJudgeInput, Jurisdiction } from '../../types';

interface JudgeDetailContentProps {
  entityId: number;
  context?: {
    readOnly?: boolean;
  };
  onClose: () => void;
}

const JUDGE_TITLES = ['Judge', 'Magistrate', 'Panel', 'Other'] as const;

export function JudgeDetailContent({ entityId, context, onClose }: JudgeDetailContentProps) {
  const queryClient = useQueryClient();
  const readOnly = context?.readOnly ?? false;
  const [editingJurisdiction, setEditingJurisdiction] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['judge', entityId],
    queryFn: () => getJudge(entityId),
  });

  const updateMutation = useMutation({
    mutationFn: (update: UpdateJudgeInput) => updateJudge(entityId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge', entityId] });
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    },
  });

  const createJurisdictionMutation = useMutation({
    mutationFn: (name: string) => createJurisdiction({ name }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictions'] });
      await updateMutation.mutateAsync({ jurisdiction_id: data.jurisdiction.id });
      setEditingJurisdiction(false);
    },
  });

  const handleUpdateField = async (field: keyof UpdateJudgeInput, value: string | number | null) => {
    await updateMutation.mutateAsync({ [field]: value ?? null } as UpdateJudgeInput);
  };

  const handleUpdatePhones = async (phones: Array<{ value: string; label?: string; primary?: boolean }>) => {
    await updateMutation.mutateAsync({ phones });
  };

  const handleUpdateEmails = async (emails: Array<{ value: string; label?: string; primary?: boolean }>) => {
    await updateMutation.mutateAsync({ emails });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !data?.judge) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Failed to load judge details</p>
      </div>
    );
  }

  const judge = data.judge;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Gavel className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          {readOnly ? (
            <h2 className="text-xl font-semibold text-text">
              {judge.name}
            </h2>
          ) : (
            <EditableText
              value={judge.name}
              onSave={(value) => handleUpdateField('name', value)}
              className="text-xl font-semibold"
              inputClassName="text-xl font-semibold"
            />
          )}
          {judge.status && judge.status !== 'Active' && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-bg-hover text-text-secondary">
              {judge.status}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Court Details */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Building className="w-4 h-4 text-text-muted" />
          Court Details
        </h3>
        <div className="space-y-3 pl-6">
          {/* Jurisdiction */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Jurisdiction:</span>
            {readOnly ? (
              <span className={judge.jurisdiction_name ? 'text-text-secondary' : 'text-text-muted italic'}>
                {judge.jurisdiction_name || 'Not specified'}
              </span>
            ) : editingJurisdiction ? (
              <div className="flex-1 max-w-[280px]">
                <JurisdictionAutocomplete
                  onSelectJurisdiction={(j: Jurisdiction) => {
                    handleUpdateField('jurisdiction_id', j.id);
                    setEditingJurisdiction(false);
                  }}
                  onCreateNew={(name) => createJurisdictionMutation.mutate(name)}
                  onCancel={() => setEditingJurisdiction(false)}
                  placeholder="Search jurisdictions..."
                  autoFocus
                />
              </div>
            ) : (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => setEditingJurisdiction(true)}
                  className="text-text-secondary hover:text-text hover:underline cursor-pointer"
                >
                  {judge.jurisdiction_name || <span className="text-text-muted italic">Not specified</span>}
                </button>
                {judge.jurisdiction_id && (
                  <button
                    onClick={() => handleUpdateField('jurisdiction_id', null)}
                    className="text-text-muted hover:text-red-400"
                    title="Clear jurisdiction"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            )}
          </div>

          {/* Title */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Title:</span>
            {readOnly ? (
              <span className={judge.title ? 'text-text-secondary' : 'text-text-muted italic'}>
                {judge.title || 'Not specified'}
              </span>
            ) : (
              <select
                value={judge.title || ''}
                onChange={(e) => handleUpdateField('title', e.target.value || null)}
                className="px-2 py-1 rounded border border-border bg-bg-surface text-text text-sm focus:border-primary-500 outline-none"
              >
                <option value="">Not specified</option>
                {JUDGE_TITLES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* Chambers */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Chambers:</span>
            {readOnly ? (
              <span className={judge.chambers ? 'text-text-secondary' : 'text-text-muted italic'}>
                {judge.chambers || 'Not specified'}
              </span>
            ) : (
              <EditableText
                value={judge.chambers || ''}
                onSave={(value) => handleUpdateField('chambers', value)}
                placeholder="e.g., 3rd Floor, Room 310"
                className="flex-1"
              />
            )}
          </div>

          {/* Courtroom */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Courtroom:</span>
            {readOnly ? (
              <span className={judge.courtroom_number ? 'text-text-secondary' : 'text-text-muted italic'}>
                {judge.courtroom_number || 'Not specified'}
              </span>
            ) : (
              <EditableText
                value={judge.courtroom_number || ''}
                onSave={(value) => handleUpdateField('courtroom_number', value)}
                placeholder="e.g., 302"
                className="flex-1"
              />
            )}
          </div>

          {/* Initials */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Initials:</span>
            {readOnly ? (
              <span className={judge.initials ? 'text-text-secondary' : 'text-text-muted italic'}>
                {judge.initials || 'Not specified'}
              </span>
            ) : (
              <EditableText
                value={judge.initials || ''}
                onSave={(value) => handleUpdateField('initials', value)}
                placeholder="e.g., JRS"
                className="flex-1"
              />
            )}
          </div>

          {/* Appointed By */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Appointed By:</span>
            {readOnly ? (
              <span className={judge.appointed_by ? 'text-text-secondary' : 'text-text-muted italic'}>
                {judge.appointed_by || 'Not specified'}
              </span>
            ) : (
              <EditableText
                value={judge.appointed_by || ''}
                onSave={(value) => handleUpdateField('appointed_by', value)}
                placeholder="e.g., President Biden"
                className="flex-1"
              />
            )}
          </div>
        </div>
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
              entries={judge.phones || []}
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
              entries={judge.emails || []}
              onSave={handleUpdateEmails}
              type="email"
              disabled={readOnly}
            />
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
          <p className={`text-sm pl-6 ${judge.notes ? 'text-text-secondary' : 'text-text-muted italic'}`}>
            {judge.notes || 'No notes'}
          </p>
        ) : (
          <div className="pl-6">
            <EditableText
              value={judge.notes || ''}
              onSave={(value) => handleUpdateField('notes', value)}
              placeholder="Add notes..."
              multiline
              className="w-full"
              inputClassName="w-full min-h-[80px]"
            />
          </div>
        )}
      </div>

      {/* Proceeding Assignments */}
      {judge.proceedings && judge.proceedings.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-text-muted" />
            Assigned to ({judge.proceedings.length} proceeding{judge.proceedings.length !== 1 ? 's' : ''})
          </h3>
          <div className="space-y-2 pl-6">
            {judge.proceedings.map((proceeding) => (
              <Link
                key={proceeding.proceeding_id}
                to={`/cases/${proceeding.case_id}`}
                onClick={onClose}
                className="flex items-center justify-between p-2 bg-bg-hover rounded text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
              >
                <div className="min-w-0">
                  <span className="font-medium text-blue-600 dark:text-blue-400 group-hover:underline truncate block">
                    {proceeding.case_name}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {proceeding.case_number} · {proceeding.role}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
