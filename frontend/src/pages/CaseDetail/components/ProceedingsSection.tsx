import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2, ExternalLink, UserPlus, X } from 'lucide-react';
import { ConfirmModal } from '../../../components/common';
import {
  createProceeding,
  updateProceeding,
  deleteProceeding,
  addProceedingJudge,
  removeProceedingJudge,
} from '../../../api';
import type { Proceeding, Jurisdiction, CasePerson, ProceedingJudge } from '../../../types';

interface ProceedingsSectionProps {
  caseId: number;
  proceedings: Proceeding[];
  jurisdictions?: Jurisdiction[];
  judges?: CasePerson[];
}

export function ProceedingsSection({
  caseId,
  proceedings,
  jurisdictions = [],
  judges = [],
}: ProceedingsSectionProps) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newProceeding, setNewProceeding] = useState({
    case_number: '',
    jurisdiction_id: '',
    is_primary: false,
    notes: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; case_number: string } | null>(
    null
  );
  // Track which proceeding is showing the add judge UI
  const [addingJudgeTo, setAddingJudgeTo] = useState<number | null>(null);
  const [newJudge, setNewJudge] = useState({ person_id: '', role: 'Judge' });

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
        jurisdiction_id: '',
        is_primary: false,
        notes: '',
      });
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateProceeding(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProceeding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setDeleteTarget(null);
    },
  });

  const addJudgeMutation = useMutation({
    mutationFn: ({ proceedingId, data }: { proceedingId: number; data: { person_id: number; role: string } }) =>
      addProceedingJudge(proceedingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setAddingJudgeTo(null);
      setNewJudge({ person_id: '', role: 'Judge' });
    },
  });

  const removeJudgeMutation = useMutation({
    mutationFn: ({ proceedingId, personId }: { proceedingId: number; personId: number }) =>
      removeProceedingJudge(proceedingId, personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProceeding.case_number.trim()) {
      createMutation.mutate({
        case_number: newProceeding.case_number.trim(),
        jurisdiction_id: newProceeding.jurisdiction_id
          ? parseInt(newProceeding.jurisdiction_id, 10)
          : undefined,
        is_primary: newProceeding.is_primary,
        notes: newProceeding.notes || undefined,
      });
    }
  };

  const handleAddJudge = (proceedingId: number) => {
    if (newJudge.person_id) {
      addJudgeMutation.mutate({
        proceedingId,
        data: {
          person_id: parseInt(newJudge.person_id, 10),
          role: newJudge.role,
        },
      });
    }
  };

  const handleRemoveJudge = (proceedingId: number, personId: number) => {
    removeJudgeMutation.mutate({ proceedingId, personId });
  };

  const handleRemove = useCallback((id: number, caseNumber: string) => {
    setDeleteTarget({ id, case_number: caseNumber });
  }, []);

  const confirmRemove = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleSetPrimary = (id: number) => {
    updateMutation.mutate({ id, data: { is_primary: true } });
  };

  // Get judges from persons assigned to the case
  const judgeOptions = useMemo(() => {
    return judges.filter((p) => p.role === 'Judge' || p.role === 'Magistrate Judge');
  }, [judges]);

  // Get available judges (not already on the proceeding)
  const getAvailableJudges = (proceeding: Proceeding) => {
    const assignedIds = new Set(proceeding.judges?.map((j) => j.person_id) || []);
    return judgeOptions.filter((j) => !assignedIds.has(j.id));
  };

  const formatJudgeRole = (role: string) => {
    if (role === 'Judge') return '';
    return ` (${role})`;
  };

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mb-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newProceeding.case_number}
              onChange={(e) => setNewProceeding({ ...newProceeding, case_number: e.target.value })}
              placeholder="Case number *"
              className="col-span-2 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
            />
            <select
              value={newProceeding.jurisdiction_id}
              onChange={(e) =>
                setNewProceeding({ ...newProceeding, jurisdiction_id: e.target.value })
              }
              className="col-span-2 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 outline-none"
            >
              <option value="">Select court...</option>
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={newProceeding.notes}
            onChange={(e) => setNewProceeding({ ...newProceeding, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newProceeding.is_primary}
                onChange={(e) =>
                  setNewProceeding({ ...newProceeding, is_primary: e.target.checked })
                }
                className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
              />
              Primary proceeding
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newProceeding.case_number.trim()}
                className="px-2 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {proceedings.length === 0 && !showAdd ? (
        <p className="text-xs text-slate-500">No proceedings</p>
      ) : (
        <div className="space-y-2">
          {proceedings.map((p) => (
            <div
              key={p.id}
              className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg group text-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-700 dark:text-slate-200 truncate">
                      {p.case_number}
                    </span>
                    {p.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  {p.jurisdiction_name && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-slate-500">{p.jurisdiction_name}</span>
                      {p.local_rules_link && (
                        <a
                          href={p.local_rules_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300"
                          title="View local rules"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Judges list */}
                  {p.judges && p.judges.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {p.judges.map((judge: ProceedingJudge) => (
                        <div
                          key={`${judge.person_id}-${judge.role}`}
                          className="flex items-center gap-1 text-xs text-slate-500 group/judge"
                        >
                          <span>
                            {judge.name}
                            {formatJudgeRole(judge.role)}
                          </span>
                          <button
                            onClick={() => handleRemoveJudge(p.id, judge.person_id)}
                            className="opacity-0 group-hover/judge:opacity-100 p-0.5 text-slate-400 hover:text-red-400 transition-opacity"
                            title="Remove judge"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add judge UI */}
                  {addingJudgeTo === p.id ? (
                    <div className="mt-2 flex items-center gap-1">
                      <select
                        value={newJudge.person_id}
                        onChange={(e) => setNewJudge({ ...newJudge, person_id: e.target.value })}
                        className="flex-1 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:border-primary-500 outline-none"
                      >
                        <option value="">Select judge...</option>
                        {getAvailableJudges(p).map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newJudge.role}
                        onChange={(e) => setNewJudge({ ...newJudge, role: e.target.value })}
                        className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:border-primary-500 outline-none"
                      >
                        <option value="Judge">Judge</option>
                        <option value="Presiding">Presiding</option>
                        <option value="Panel">Panel</option>
                        <option value="Magistrate Judge">Magistrate Judge</option>
                      </select>
                      <button
                        onClick={() => handleAddJudge(p.id)}
                        disabled={!newJudge.person_id || addJudgeMutation.isPending}
                        className="px-1.5 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingJudgeTo(null);
                          setNewJudge({ person_id: '', role: 'Judge' });
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingJudgeTo(p.id)}
                      className="mt-1 text-xs text-primary-500 hover:text-primary-400 inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <UserPlus className="w-3 h-3" />
                      Add judge
                    </button>
                  )}

                  {p.notes && (
                    <span className="text-xs text-slate-400 italic block mt-0.5">{p.notes}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                  {!p.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(p.id)}
                      title="Set as primary"
                      className="p-0.5 text-slate-500 hover:text-amber-500"
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(p.id, p.case_number)}
                    className="p-0.5 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmRemove}
        title="Remove Proceeding"
        message={`Are you sure you want to remove proceeding "${deleteTarget?.case_number}"?`}
        confirmText="Remove"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
