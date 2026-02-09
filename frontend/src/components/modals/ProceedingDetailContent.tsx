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
import { EditableText, EditableSelect, ConfirmModal, AddJudgeDropdown } from '../common';
import { useEntityModal } from '.';
import {
  getProceeding,
  updateProceeding,
  deleteProceeding,
  addProceedingJudge,
  removeProceedingJudge,
  updateProceedingJudge,
  getConstants,
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

  const { data: proceedingData, isLoading, error } = useQuery({
    queryKey: ['proceeding', entityId],
    queryFn: () => getProceeding(entityId),
  });

  const { data: constantsData } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
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
  const jurisdictions = constantsData?.jurisdictions || [];
  const jurisdictionOptions = [
    { value: '', label: 'No court selected' },
    ...jurisdictions.map((j: Jurisdiction) => ({ value: String(j.id), label: j.name })),
  ];

  const formatJudgeRole = (role: string) => {
    return ` (${role})`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-bg-hover flex items-center justify-center">
          <Scale className="w-6 h-6 text-text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          {readOnly ? (
            <h2 className="text-xl font-mono font-semibold text-text">
              {proceeding.case_number}
            </h2>
          ) : (
            <EditableText
              value={proceeding.case_number}
              onSave={(value) => handleUpdateField('case_number', value)}
              className="text-xl font-mono font-semibold"
              inputClassName="text-xl font-mono font-semibold"
            />
          )}
          {proceeding.is_primary && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
              <Star className="w-3 h-3 fill-amber-500" />
              Primary Proceeding
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
        ) : (
          <div className="flex items-center gap-2">
            <EditableSelect
              value={proceeding.jurisdiction_id ? String(proceeding.jurisdiction_id) : ''}
              options={jurisdictionOptions}
              onSave={async (value) => {
                await handleUpdateField('jurisdiction_id', value ? parseInt(value, 10) : null);
              }}
            />
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
                    onClick={() => openJudgeModal(judge.judge_id, { readOnly: true })}
                    className="hover:underline hover:text-text cursor-pointer"
                  >
                    {judge.name}
                  </button>
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
                      {['Judge', 'Presiding', 'Magistrate', 'Panel', 'Other'].map(r => (
                        <option key={r} value={r}>{r}</option>
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

      {/* Primary Toggle */}
      {!readOnly && (
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={proceeding.is_primary}
              onChange={(e) => handleUpdateField('is_primary', e.target.checked)}
              className="rounded border-border bg-bg-surface text-primary-600 focus:ring-primary-500"
            />
            <span className="text-text-secondary">Primary Proceeding</span>
          </label>
        </div>
      )}

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
