import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hash, Plus, Star, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../../components/common';
import { updateCase } from '../../../api';
import type { CaseNumber } from '../../../types';

interface CaseNumbersSectionProps {
  caseId: number;
  caseNumbers: CaseNumber[];
}

export function CaseNumbersSection({ caseId, caseNumbers }: CaseNumbersSectionProps) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newNumber, setNewNumber] = useState({ number: '', label: '', primary: false });
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; number: string } | null>(null);

  const updateMutation = useMutation({
    mutationFn: (numbers: CaseNumber[]) => updateCase(caseId, { case_numbers: numbers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setDeleteTarget(null);
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNumber.number.trim()) {
      const updated = [
        ...caseNumbers.map((n) => (newNumber.primary ? { ...n, primary: false } : n)),
        {
          number: newNumber.number.trim(),
          label: newNumber.label.trim() || 'Case No.',
          primary: newNumber.primary,
        },
      ];
      updateMutation.mutate(updated);
      setNewNumber({ number: '', label: '', primary: false });
      setShowAdd(false);
    }
  };

  const handleRemove = useCallback((index: number, caseNumber: string) => {
    setDeleteTarget({ index, number: caseNumber });
  }, []);

  const confirmRemove = useCallback(() => {
    if (deleteTarget !== null) {
      const updated = caseNumbers.filter((_, i) => i !== deleteTarget.index);
      updateMutation.mutate(updated);
    }
  }, [deleteTarget, caseNumbers, updateMutation]);

  const handleSetPrimary = (index: number) => {
    const updated = caseNumbers.map((n, i) => ({ ...n, primary: i === index }));
    updateMutation.mutate(updated);
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Case Numbers
          </span>
        </div>
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
          className="mb-3 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg space-y-2"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newNumber.number}
              onChange={(e) => setNewNumber({ ...newNumber, number: e.target.value })}
              placeholder="Case number *"
              className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
            />
            <input
              type="text"
              value={newNumber.label}
              onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })}
              placeholder="Label (e.g., State)"
              className="w-28 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newNumber.primary}
                onChange={(e) => setNewNumber({ ...newNumber, primary: e.target.checked })}
                className="rounded border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700"
              />
              Primary
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
                disabled={updateMutation.isPending || !newNumber.number.trim()}
                className="px-2 py-1 bg-primary-600 text-white rounded text-xs disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {caseNumbers.length === 0 && !showAdd ? (
        <p className="text-xs text-slate-500">No case numbers</p>
      ) : (
        <div className="space-y-1">
          {caseNumbers.map((cn, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-slate-700 rounded group text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-700 dark:text-slate-200">{cn.number}</span>
                {cn.label && <span className="text-xs text-slate-500">({cn.label})</span>}
                {cn.primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!cn.primary && (
                  <button
                    onClick={() => handleSetPrimary(index)}
                    title="Set as primary"
                    className="p-0.5 text-slate-500 hover:text-amber-500"
                  >
                    <Star className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleRemove(index, cn.number)}
                  className="p-0.5 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmRemove}
        title="Remove Case Number"
        message={`Are you sure you want to remove case number "${deleteTarget?.number}"?`}
        confirmText="Remove"
        variant="danger"
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}
