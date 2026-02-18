import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Scale,
  FileText,
  Star,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { EditableText, ConfirmModal, AddJudgeDropdown, JurisdictionAutocomplete, JUDGE_ROLES, getJudgeRoleIcon } from '../common';
import { useEntityModal } from '.';
import {
  getProceeding,
  updateProceeding,
  deleteProceeding,
  addProceedingJudge,
  removeProceedingJudge,
  updateProceedingJudge,
  createJudge,
  createJurisdiction,
} from '../../api';
import type { Proceeding, ProceedingJudge, Jurisdiction } from '../../types';

interface ProceedingDetailContentProps {
  entityId: number;
  context?: {
    caseId?: number;
    readOnly?: boolean;
  };
  onClose: () => void;
}

export function ProceedingDetailContent({ entityId, context, onClose }: ProceedingDetailContentProps) {
  const queryClient = useQueryClient();
  const { openJudgeModal } = useEntityModal();
  const readOnly = context?.readOnly ?? false;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingJurisdiction, setEditingJurisdiction] = useState(false);

  const { data: proceedingData, isLoading, error } = useQuery({
    queryKey: ['proceeding', entityId],
    queryFn: () => getProceeding(entityId),
  });

  const updateMutation = useMutation({
    mutationFn: (update: Partial<Proceeding>) => updateProceeding(entityId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proceeding', entityId] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const addJudgeMutation = useMutation({
    mutationFn: (data: { judge_id: number; role: string }) =>
      addProceedingJudge(entityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proceeding', entityId] });
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const removeJudgeMutation = useMutation({
    mutationFn: (judgeId: number) => removeProceedingJudge(entityId, judgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proceeding', entityId] });
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const updateJudgeRoleMutation = useMutation({
    mutationFn: ({ judgeId, role }: { judgeId: number; role: string }) =>
      updateProceedingJudge(entityId, judgeId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proceeding', entityId] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const createAndAssignJudgeMutation = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: string }) => {
      const { judge } = await createJudge({ name });
      return addProceedingJudge(entityId, { judge_id: judge.id, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proceeding', entityId] });
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProceeding(entityId),
    onSuccess: () => {
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
      setShowDeleteConfirm(false);
      onClose();
    },
  });

  const createJurisdictionMutation = useMutation({
    mutationFn: (name: string) => createJurisdiction({ name }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictions'] });
      queryClient.invalidateQueries({ queryKey: ['constants'] });
      await updateMutation.mutateAsync({ jurisdiction_id: data.jurisdiction.id });
      setEditingJurisdiction(false);
    },
  });

  const handleUpdateField = async (field: string, value: string | number | boolean | null) => {
    await updateMutation.mutateAsync({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !proceedingData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Failed to load proceeding details</p>
      </div>
    );
  }

  const proceeding = proceedingData as Proceeding;

  const formatJudgeRole = (role: string) => {
    return ` (${role})`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 text-text-muted" />
          <h2 className="text-lg font-semibold text-text">Proceeding</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Case Number */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium text-text-secondary">
            Case Number
          </h3>
          <button
            onClick={() => !readOnly && handleUpdateField('is_primary', !proceeding.is_primary)}
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              readOnly ? 'cursor-default' : 'cursor-pointer'
            } ${
              proceeding.is_primary
                ? 'text-amber-500'
                : readOnly ? 'hidden' : 'text-text-muted hover:text-amber-400'
            }`}
            title={proceeding.is_primary ? 'Primary proceeding' : 'Mark as primary'}
            disabled={readOnly}
          >
            <Star className={`w-3.5 h-3.5 ${proceeding.is_primary ? 'fill-amber-500' : ''}`} />
            {proceeding.is_primary && <span>Primary</span>}
          </button>
        </div>
        {readOnly ? (
          <span className="text-sm font-mono text-text">
            {proceeding.case_number}
          </span>
        ) : (
          <EditableText
            value={proceeding.case_number}
            onSave={(value) => handleUpdateField('case_number', value)}
            placeholder="e.g., 25STCV35294"
            className="text-sm font-mono"
            inputClassName="text-sm font-mono"
          />
        )}
      </div>

      {/* Jurisdiction */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-2">
          Jurisdiction
        </h3>
        {readOnly ? (
          <div className="flex items-center gap-2">
            <span className={proceeding.jurisdiction_name ? 'text-text-secondary' : 'text-text-muted italic'}>
              {proceeding.jurisdiction_name || 'No court selected'}
            </span>
            {proceeding.local_rules_link && (
              <a
                href={proceeding.local_rules_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600"
                title="View local rules"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        ) : editingJurisdiction ? (
          <div className="max-w-[300px]">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingJurisdiction(true)}
              className="text-sm text-text-secondary hover:text-text hover:underline cursor-pointer"
            >
              {proceeding.jurisdiction_name || <span className="text-text-muted italic">No court selected</span>}
            </button>
            {proceeding.jurisdiction_id && (
              <button
                onClick={() => handleUpdateField('jurisdiction_id', null)}
                className="text-text-muted hover:text-red-400"
                title="Clear jurisdiction"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {proceeding.local_rules_link && (
              <a
                href={proceeding.local_rules_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600"
                title="View local rules"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Judges */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">
            Assigned Judges
          </h3>
          {!readOnly && (
            <AddJudgeDropdown
              excludeJudgeIds={proceeding.judges?.map(j => j.judge_id) || []}
              onAssign={(judge, role) =>
                addJudgeMutation.mutate({ judge_id: judge.id, role })
              }
              onCreateNew={(name, role) =>
                createAndAssignJudgeMutation.mutate({ name, role })
              }
              label="Add Judge"
            />
          )}
        </div>

        {/* Judges list */}
        {proceeding.judges && proceeding.judges.length > 0 ? (
          <div className="space-y-2">
            {proceeding.judges.map((judge: ProceedingJudge) => (
              <div
                key={`${judge.judge_id}-${judge.role}`}
                className="flex items-center justify-between p-2 bg-bg-hover rounded text-sm group"
              >
                <span className="text-text-secondary flex items-center gap-1">
                  <button
                    onClick={() => openJudgeModal(judge.judge_id)}
                    className="hover:underline hover:text-text cursor-pointer"
                  >
                    {judge.name}
                  </button>
                  {(() => { const RoleIcon = getJudgeRoleIcon(judge.role); return <RoleIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />; })()}
                  {readOnly ? (
                    <span className="text-text-muted">{formatJudgeRole(judge.role)}</span>
                  ) : (
                    <select
                      value={judge.role}
                      onChange={(e) => updateJudgeRoleMutation.mutate({
                        judgeId: judge.judge_id,
                        role: e.target.value,
                      })}
                      className="text-text-muted text-sm bg-transparent border-none outline-none cursor-pointer hover:text-text-secondary appearance-none pr-0"
                      title="Change role"
                    >
                      {JUDGE_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => removeJudgeMutation.mutate(judge.judge_id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-400 transition-opacity"
                    title="Remove judge"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">No judges assigned</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-text-muted" />
          Notes
        </h3>
        {readOnly ? (
          <p className={`text-sm ${proceeding.notes ? 'text-text-secondary' : 'text-text-muted italic'}`}>
            {proceeding.notes || 'No notes'}
          </p>
        ) : (
          <EditableText
            value={proceeding.notes || ''}
            onSave={(value) => handleUpdateField('notes', value || null)}
            placeholder="Add notes..."
            multiline
            className="w-full"
            inputClassName="w-full min-h-[80px]"
          />
        )}
      </div>

      {/* CourtListener Integration */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-3">
          <ExternalLink className="w-4 h-4 text-text-muted" />
          CourtListener Integration
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wider">
              Docket ID
            </label>
            {readOnly ? (
              <p className={`text-sm mt-1 ${proceeding.courtlistener_docket_id ? 'font-mono text-text-secondary' : 'text-text-muted italic'}`}>
                {proceeding.courtlistener_docket_id || 'Not linked'}
              </p>
            ) : (
              <EditableText
                value={proceeding.courtlistener_docket_id?.toString() || ''}
                onSave={(value) => handleUpdateField('courtlistener_docket_id', value ? parseInt(value, 10) : null)}
                placeholder="e.g., 70905406"
                className="text-sm font-mono"
                inputClassName="text-sm font-mono"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-text-secondary uppercase tracking-wider">
              PACER Case ID
            </label>
            {readOnly ? (
              <p className={`text-sm mt-1 ${proceeding.pacer_case_id ? 'font-mono text-text-secondary' : 'text-text-muted italic'}`}>
                {proceeding.pacer_case_id || 'Not set'}
              </p>
            ) : (
              <EditableText
                value={proceeding.pacer_case_id || ''}
                onSave={(value) => handleUpdateField('pacer_case_id', value || null)}
                placeholder="e.g., gov.uscourts.cacd.980378"
                className="text-sm font-mono"
                inputClassName="text-sm font-mono"
              />
            )}
          </div>
          {proceeding.courtlistener_docket_id && (
            <a
              href={`https://www.courtlistener.com/docket/${proceeding.courtlistener_docket_id}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              View on CourtListener
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Delete Proceeding button */}
      {!readOnly && (
        <div className="mt-6 pt-6 border-t border-border">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete proceeding
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete proceeding"
        message={`Are you sure you want to delete proceeding "${proceeding.case_number}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
