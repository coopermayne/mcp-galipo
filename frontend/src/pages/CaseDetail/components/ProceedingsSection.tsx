import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, ExternalLink, X } from 'lucide-react';
import { useEntityModal } from '../../../components/modals';
import { JurisdictionAutocomplete, AddPersonDropdown } from '../../../components/common';
import {
  createProceeding,
  updateProceeding,
  addProceedingJudge,
  removeProceedingJudge,
  createPerson,
  createJurisdiction,
} from '../../../api';
import type { Proceeding, Jurisdiction, ProceedingJudge, Person } from '../../../types';

interface ProceedingsSectionProps {
  caseId: number;
  proceedings: Proceeding[];
}

export function ProceedingsSection({
  caseId,
  proceedings,
}: ProceedingsSectionProps) {
  const queryClient = useQueryClient();
  const { openProceedingModal, openPersonModal } = useEntityModal();
  const [showAdd, setShowAdd] = useState(false);
  const [newProceeding, setNewProceeding] = useState({
    case_number: '',
    jurisdiction_id: null as number | null,
    jurisdiction_name: '',
    is_primary: false,
    notes: '',
  });

  const judgeRoleOptions = ['Judge', 'Magistrate Judge', 'Presiding', 'Panel'];

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updateProceeding(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const addJudgeMutation = useMutation({
    mutationFn: async ({ proceedingId, personId, role }: { proceedingId: number; personId: number; role: string }) => {
      return addProceedingJudge(proceedingId, { person_id: personId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const createAndAddJudgeMutation = useMutation({
    mutationFn: async ({ proceedingId, name, role }: { proceedingId: number; name: string; role: string }) => {
      const personResult = await createPerson({ person_type: 'judge', name });
      const personId = personResult.person.id;
      const judgeResult = await addProceedingJudge(proceedingId, { person_id: personId, role });
      return { personId, judgeResult };
    },
    onSuccess: ({ personId }) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      openPersonModal(personId, { caseId });
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

  const handleSelectJudge = (proceedingId: number, person: Person, role: string) => {
    addJudgeMutation.mutate({ proceedingId, personId: person.id, role });
  };

  const handleCreateJudge = (proceedingId: number, name: string, role: string) => {
    createAndAddJudgeMutation.mutate({ proceedingId, name, role });
  };

  const handleRemoveJudge = (proceedingId: number, personId: number) => {
    removeJudgeMutation.mutate({ proceedingId, personId });
  };

  const handleSetPrimary = (id: number) => {
    updateMutation.mutate({ id, data: { is_primary: true } });
  };

  // Sort proceedings with primary first
  const sortedProceedings = [...proceedings].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

  return (
    <div className="space-y-2">
      {/* Proceedings list */}
      {sortedProceedings.map((p) => (
        <div key={p.id} className="group">
          {/* Case number row */}
          <div className="flex items-center gap-2 text-sm">
            {p.is_primary ? (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            ) : (
              <button
                onClick={() => handleSetPrimary(p.id)}
                title="Set as primary"
                className="w-3.5 h-3.5 text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <span
              className="font-mono font-medium text-slate-800 dark:text-slate-200 cursor-pointer hover:underline"
              onClick={() => openProceedingModal(p.id, { caseId })}
            >
              {p.case_number}
            </span>
            {p.jurisdiction_name && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs">
                  {p.jurisdiction_name}
                </span>
                {p.local_rules_link && (
                  <a
                    href={p.local_rules_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600"
                    title="View local rules"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            )}
          </div>

          {/* Judges row - indented under case number */}
          {p.judges && p.judges.length > 0 && (
            <div className="ml-5 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {p.judges.map((judge: ProceedingJudge, idx: number) => (
                <span key={`${judge.person_id}-${judge.role}`} className="text-xs text-slate-500 dark:text-slate-400 group/judge inline-flex items-center gap-0.5">
                  {idx > 0 && <span className="text-slate-300 mr-1">·</span>}
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => openPersonModal(judge.person_id, { caseId })}
                  >
                    {judge.name}
                  </span>
                  <span className="text-slate-400">({judge.role})</span>
                  <button
                    onClick={() => handleRemoveJudge(p.id, judge.person_id)}
                    className="opacity-0 group-hover/judge:opacity-100 p-0.5 text-slate-400 hover:text-red-400 transition-opacity"
                    title="Remove judge"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {/* Add judge button - inline */}
              <AddPersonDropdown
                roleOptions={judgeRoleOptions}
                onAssign={(person, role) => handleSelectJudge(p.id, person, role)}
                onCreate={(name, role) => handleCreateJudge(p.id, name, role)}
                excludePersonIds={p.judges?.map((j) => j.person_id) || []}
                getPersonTypes={() => ['judge']}
                getPlaceholder={() => 'Search judges...'}
                compact
              />
            </div>
          )}

          {/* No judges yet - show add button */}
          {(!p.judges || p.judges.length === 0) && (
            <div className="ml-5 mt-0.5">
              <AddPersonDropdown
                roleOptions={judgeRoleOptions}
                onAssign={(person, role) => handleSelectJudge(p.id, person, role)}
                onCreate={(name, role) => handleCreateJudge(p.id, name, role)}
                excludePersonIds={[]}
                getPersonTypes={() => ['judge']}
                getPlaceholder={() => 'Search judges...'}
                compact
                label="Add judge"
              />
            </div>
          )}

          {/* Notes if any */}
          {p.notes && (
            <p className="ml-5 mt-0.5 text-xs text-slate-400 italic">{p.notes}</p>
          )}
        </div>
      ))}

      {/* Empty state or Add button */}
      {proceedings.length === 0 && !showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add proceeding
        </button>
      ) : proceedings.length > 0 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Plus className="w-3 h-3" />
          Add proceeding
        </button>
      )}

      {/* Add proceeding form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-2 border border-slate-200 dark:border-slate-600"
        >
          <div className="space-y-2">
            <input
              type="text"
              value={newProceeding.case_number}
              onChange={(e) => setNewProceeding({ ...newProceeding, case_number: e.target.value })}
              placeholder="Case number *"
              className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
              autoFocus
            />
            {newProceeding.jurisdiction_id ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                <span className="text-slate-900 dark:text-slate-100 flex-1">
                  {newProceeding.jurisdiction_name}
                </span>
                <button
                  type="button"
                  onClick={handleClearJurisdiction}
                  className="p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <JurisdictionAutocomplete
                onSelectJurisdiction={handleSelectJurisdiction}
                onCreateNew={handleCreateJurisdiction}
                onCancel={() => setShowAdd(false)}
                placeholder="Search courts..."
              />
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newProceeding.is_primary}
                onChange={(e) =>
                  setNewProceeding({ ...newProceeding, is_primary: e.target.checked })
                }
                className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
              />
              Primary
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700"
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
