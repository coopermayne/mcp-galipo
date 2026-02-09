import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, ExternalLink, X, Scale } from 'lucide-react';
import { useEntityModal } from '../../../components/modals';
import { JurisdictionAutocomplete, AddJudgeDropdown, JUDGE_ROLES, getJudgeRoleIcon } from '../../../components/common';
import {
  createProceeding,
  addProceedingJudge,
  removeProceedingJudge,
  updateProceedingJudge,
  createJurisdiction,
} from '../../../api';
import type { Proceeding, Jurisdiction, ProceedingJudge } from '../../../types';

interface ProceedingsSectionProps {
  caseId: number;
  proceedings: Proceeding[];
}

export function ProceedingsSection({
  caseId,
  proceedings,
}: ProceedingsSectionProps) {
  const queryClient = useQueryClient();
  const { openProceedingModal, openJudgeModal } = useEntityModal();
  const [showAdd, setShowAdd] = useState(false);
  const [newProceeding, setNewProceeding] = useState({
    case_number: '',
    jurisdiction_id: null as number | null,
    jurisdiction_name: '',
    is_primary: false,
    notes: '',
  });

  // Create proceeding with full form (for empty state)
  const createMutation = useMutation({
    mutationFn: (data: {
      case_number: string;
      jurisdiction_id?: number;
      is_primary?: boolean;
      notes?: string;
    }) => createProceeding(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewProceeding({
        case_number: '',
        jurisdiction_id: null,
        jurisdiction_name: '',
        is_primary: false,
        notes: '',
      });
      setShowAdd(false);
    },
  });

  // Create blank proceeding and open modal (for adding when proceedings exist)
  const createAndOpenMutation = useMutation({
    mutationFn: () => createProceeding(caseId, { case_number: 'New Proceeding' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      // Open the modal for the newly created proceeding
      if (data?.proceeding?.id) {
        openProceedingModal(data.proceeding.id, { caseId });
      }
    },
  });

  const createJurisdictionMutation = useMutation({
    mutationFn: (name: string) => createJurisdiction({ name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictions'] });
      setNewProceeding({
        ...newProceeding,
        jurisdiction_id: data.jurisdiction.id,
        jurisdiction_name: data.jurisdiction.name,
      });
    },
  });

  const addJudgeMutation = useMutation({
    mutationFn: async ({ proceedingId, judgeId, role }: { proceedingId: number; judgeId: number; role: string }) => {
      return addProceedingJudge(proceedingId, { judge_id: judgeId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const removeJudgeMutation = useMutation({
    mutationFn: ({ proceedingId, judgeId }: { proceedingId: number; judgeId: number }) =>
      removeProceedingJudge(proceedingId, judgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const updateJudgeRoleMutation = useMutation({
    mutationFn: ({ proceedingId, judgeId, role }: { proceedingId: number; judgeId: number; role: string }) =>
      updateProceedingJudge(proceedingId, judgeId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProceeding.case_number.trim()) {
      createMutation.mutate({
        case_number: newProceeding.case_number.trim(),
        jurisdiction_id: newProceeding.jurisdiction_id ?? undefined,
        is_primary: newProceeding.is_primary,
        notes: newProceeding.notes || undefined,
      });
    }
  };

  const handleSelectJurisdiction = (jurisdiction: Jurisdiction) => {
    setNewProceeding({
      ...newProceeding,
      jurisdiction_id: jurisdiction.id,
      jurisdiction_name: jurisdiction.name,
    });
  };

  const handleCreateJurisdiction = (name: string) => {
    createJurisdictionMutation.mutate(name);
  };

  const handleClearJurisdiction = () => {
    setNewProceeding({
      ...newProceeding,
      jurisdiction_id: null,
      jurisdiction_name: '',
    });
  };

  const handleRemoveJudge = (proceedingId: number, judgeId: number) => {
    removeJudgeMutation.mutate({ proceedingId, judgeId });
  };

  // Separate primary and other proceedings
  const primaryProceeding = proceedings.find((p) => p.is_primary);
  const otherProceedings = proceedings.filter((p) => !p.is_primary);

  const handleAddProceeding = () => {
    createAndOpenMutation.mutate();
  };

  const renderAddJudgeUI = (proceeding: Proceeding) => (
    <AddJudgeDropdown
      compact
      label="Judge"
      excludeJudgeIds={proceeding.judges?.map((j) => j.judge_id) || []}
      onAssign={(judge, role) =>
        addJudgeMutation.mutate({ proceedingId: proceeding.id, judgeId: judge.id, role })
      }
    />
  );

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-text-muted" />
        <h4 className="text-sm font-medium text-text-secondary">Proceedings</h4>
        {proceedings.length > 0 && (
          <span className="text-xs text-text-muted">({proceedings.length})</span>
        )}
      </div>

      {/* Primary proceeding - full display */}
      {primaryProceeding && (
        <div className="group">
          {/* Case number row */}
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
            <span
              className="font-mono text-sm font-medium text-text cursor-pointer hover:underline"
              onClick={() => openProceedingModal(primaryProceeding.id, { caseId })}
            >
              {primaryProceeding.case_number}
            </span>
            {primaryProceeding.jurisdiction_name && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-sm text-text-secondary">
                  {primaryProceeding.jurisdiction_name}
                </span>
                {primaryProceeding.local_rules_link && (
                  <a
                    href={primaryProceeding.local_rules_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600"
                    title="View local rules"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </>
            )}
          </div>

          {/* Judges list - indented under case number */}
          <div className="ml-5 mt-1.5 space-y-1">
            {primaryProceeding.judges && primaryProceeding.judges.length > 0 && (
              primaryProceeding.judges.map((judge: ProceedingJudge) => {
                const RoleIcon = getJudgeRoleIcon(judge.role);
                return (
                  <div
                    key={`${judge.judge_id}-${judge.role}`}
                    className="group/judge flex items-center gap-1.5 text-sm"
                  >
                    <RoleIcon className="w-3 h-3 text-text-muted shrink-0" />
                    <span
                      className="text-text-secondary cursor-pointer hover:underline hover:text-text"
                      onClick={() => openJudgeModal(judge.judge_id, { readOnly: true })}
                    >
                      {judge.name}
                    </span>
                    <select
                      value={judge.role}
                      onChange={(e) => updateJudgeRoleMutation.mutate({
                        proceedingId: primaryProceeding.id,
                        judgeId: judge.judge_id,
                        role: e.target.value,
                      })}
                      className="text-text-muted text-xs bg-transparent border-none outline-none cursor-pointer hover:text-text-secondary"
                      title="Change role"
                    >
                      {JUDGE_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveJudge(primaryProceeding.id, judge.judge_id)}
                      className="opacity-0 group-hover/judge:opacity-100 p-0.5 text-text-muted hover:text-red-400 transition-opacity"
                      title="Remove judge"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
            {renderAddJudgeUI(primaryProceeding)}
          </div>

          {/* Notes if any */}
          {primaryProceeding.notes && (
            <p className="ml-5 mt-1 text-sm text-text-muted italic">{primaryProceeding.notes}</p>
          )}
        </div>
      )}

      {/* Other proceedings - compact display with add button */}
      {otherProceedings.length > 0 && (
        <div className="pt-2 border-t border-border flex items-center gap-2 text-sm text-text-secondary">
          <span className="text-text-muted">Other:</span>
          {otherProceedings.map((p, idx) => (
            <span key={p.id} className="inline-flex items-center">
              {idx > 0 && <span className="text-text-muted mx-1">·</span>}
              <span
                className="font-mono cursor-pointer hover:underline hover:text-text-secondary"
                onClick={() => openProceedingModal(p.id, { caseId })}
              >
                {p.case_number}
              </span>
            </span>
          ))}
          <button
            onClick={handleAddProceeding}
            disabled={createAndOpenMutation.isPending}
            className="text-primary-600 hover:text-primary-700 disabled:opacity-50"
            title="Add proceeding"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add button when only primary exists (no others) */}
      {primaryProceeding && otherProceedings.length === 0 && (
        <div className="pt-2 border-t border-border flex items-center gap-2 text-sm">
          <span className="text-text-muted">Other:</span>
          <button
            onClick={handleAddProceeding}
            disabled={createAndOpenMutation.isPending}
            className="text-primary-600 hover:text-primary-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs">Add</span>
          </button>
        </div>
      )}

      {/* Empty state */}
      {proceedings.length === 0 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add proceeding
        </button>
      )}

      {/* Add proceeding form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="p-3 bg-bg-hover rounded-lg space-y-2 border border-border"
        >
          <div className="space-y-2">
            <input
              type="text"
              value={newProceeding.case_number}
              onChange={(e) => setNewProceeding({ ...newProceeding, case_number: e.target.value })}
              placeholder="Case number *"
              className="w-full px-2 py-1.5 rounded border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 outline-none"
              autoFocus
            />
            {newProceeding.jurisdiction_id ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-surface text-sm">
                <span className="text-text flex-1">
                  {newProceeding.jurisdiction_name}
                </span>
                <button
                  type="button"
                  onClick={handleClearJurisdiction}
                  className="p-0.5 text-text-muted hover:text-text-secondary"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <JurisdictionAutocomplete
                onSelectJurisdiction={handleSelectJurisdiction}
                onCreateNew={handleCreateJurisdiction}
                onCancel={() => setShowAdd(false)}
                placeholder="Search..."
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={newProceeding.is_primary}
                onChange={(e) =>
                  setNewProceeding({ ...newProceeding, is_primary: e.target.checked })
                }
                className="rounded border-border bg-bg-surface"
              />
              Primary
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-2 py-1 text-xs text-text-secondary hover:text-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newProceeding.case_number.trim()}
                className="px-3 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50 hover:bg-primary-700"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
