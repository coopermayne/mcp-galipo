import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Scale,
  FileText,
  Star,
  UserPlus,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { EditableText, EditableSelect, ConfirmModal } from '../common';
import {
  getProceeding,
  updateProceeding,
  deleteProceeding,
  addProceedingJudge,
  removeProceedingJudge,
  getConstants,
} from '../../api';
import { getPersons } from '../../api/persons';
import type { Proceeding, ProceedingJudge, Jurisdiction, Person } from '../../types';

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
  const readOnly = context?.readOnly ?? false;
  const [showAddJudge, setShowAddJudge] = useState(false);
  const [newJudge, setNewJudge] = useState({ person_id: '', role: 'Judge' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: proceedingData, isLoading, error } = useQuery({
    queryKey: ['proceeding', entityId],
    queryFn: () => getProceeding(entityId),
  });

  const { data: constantsData } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  // Fetch judges for adding
  const { data: judgesData } = useQuery({
    queryKey: ['persons', 'judges'],
    queryFn: () => getPersons({ type: 'judge', limit: 100 }),
    enabled: showAddJudge,
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
    mutationFn: (data: { person_id: number; role: string }) =>
      addProceedingJudge(entityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proceeding', entityId] });
      if (context?.caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', context.caseId] });
      }
      setShowAddJudge(false);
      setNewJudge({ person_id: '', role: 'Judge' });
    },
  });

  const removeJudgeMutation = useMutation({
    mutationFn: (personId: number) => removeProceedingJudge(entityId, personId),
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

  const handleAddJudge = () => {
    if (newJudge.person_id) {
      addJudgeMutation.mutate({
        person_id: parseInt(newJudge.person_id, 10),
        role: newJudge.role,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !proceedingData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
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

  // Get available judges (not already assigned)
  const assignedJudgeIds = new Set(proceeding.judges?.map(j => j.person_id) || []);
  const availableJudges = (judgesData?.persons || []).filter(
    (p: Person) => !assignedJudgeIds.has(p.id)
  );

  const formatJudgeRole = (role: string) => {
    if (role === 'Judge') return '';
    return ` (${role})`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <Scale className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          {readOnly ? (
            <h2 className="text-xl font-mono font-semibold text-slate-900 dark:text-slate-100">
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
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Jurisdiction */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Jurisdiction
        </h3>
        {readOnly ? (
          <div className="flex items-center gap-2">
            <span className={proceeding.jurisdiction_name ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}>
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
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Assigned Judges
          </h3>
          {!readOnly && (
            <button
              onClick={() => setShowAddJudge(!showAddJudge)}
              className="text-xs text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
            >
              <UserPlus className="w-3 h-3" />
              Add Judge
            </button>
          )}
        </div>

        {/* Add judge form */}
        {showAddJudge && (
          <div className="mb-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center gap-2">
              <select
                value={newJudge.person_id}
                onChange={(e) => setNewJudge({ ...newJudge, person_id: e.target.value })}
                className="flex-1 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 outline-none"
              >
                <option value="">Select judge...</option>
                {availableJudges.map((j: Person) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <select
                value={newJudge.role}
                onChange={(e) => setNewJudge({ ...newJudge, role: e.target.value })}
                className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 outline-none"
              >
                <option value="Judge">Judge</option>
                <option value="Presiding">Presiding</option>
                <option value="Panel">Panel</option>
                <option value="Magistrate Judge">Magistrate Judge</option>
              </select>
              <button
                onClick={handleAddJudge}
                disabled={!newJudge.person_id || addJudgeMutation.isPending}
                className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddJudge(false);
                  setNewJudge({ person_id: '', role: 'Judge' });
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Judges list */}
        {proceeding.judges && proceeding.judges.length > 0 ? (
          <div className="space-y-2">
            {proceeding.judges.map((judge: ProceedingJudge) => (
              <div
                key={`${judge.person_id}-${judge.role}`}
                className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded text-sm group"
              >
                <span className="text-slate-700 dark:text-slate-300">
                  {judge.name}
                  <span className="text-slate-400">{formatJudgeRole(judge.role)}</span>
                </span>
                {!readOnly && (
                  <button
                    onClick={() => removeJudgeMutation.mutate(judge.person_id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-opacity"
                    title="Remove judge"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No judges assigned</p>
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
              className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-slate-700 dark:text-slate-300">Primary Proceeding</span>
          </label>
        </div>
      )}

      {/* Notes */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Notes
        </h3>
        {readOnly ? (
          <p className={`text-sm ${proceeding.notes ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic'}`}>
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

      {/* Delete Proceeding button */}
      {!readOnly && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
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
