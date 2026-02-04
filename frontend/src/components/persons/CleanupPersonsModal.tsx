/**
 * CleanupPersonsModal - Delete persons not assigned to any case
 *
 * Lists all unassigned persons with individual delete and bulk "Delete All".
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  Trash2,
  CheckCircle2,
  User,
  AlertTriangle,
} from 'lucide-react';
import { getPersons, deletePerson } from '../../api';
import type { Person } from '../../types';

interface CleanupPersonsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CleanupPersonsModal({ isOpen, onClose }: CleanupPersonsModalProps) {
  const queryClient = useQueryClient();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; failed: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['persons', { unassigned: true }],
    queryFn: () => getPersons({ unassigned: true, limit: 10000 }),
    enabled: isOpen,
  });

  const persons = data?.persons ?? [];

  const deleteSingleMutation = useMutation({
    mutationFn: (personId: number) => deletePerson(personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (toDelete: Person[]) => {
      let deleted = 0;
      let failed = 0;
      for (const person of toDelete) {
        try {
          await deletePerson(person.id);
          deleted++;
        } catch {
          failed++;
        }
      }
      return { deleted, failed };
    },
    onSuccess: (result) => {
      setDeleteResult(result);
      setConfirmDeleteAll(false);
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });

  const handleClose = () => {
    setConfirmDeleteAll(false);
    setDeleteResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-text">Cleanup Unassigned Persons</h2>
          </div>
          <button onClick={handleClose} className="p-1 text-text-muted hover:text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
              <span className="ml-2 text-text-muted">Finding unassigned persons...</span>
            </div>
          ) : persons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
              <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
              <p className="font-medium">No unassigned persons</p>
              <p className="text-sm text-text-muted mt-1">All persons are assigned to at least one case</p>
            </div>
          ) : (
            <div className="p-4">
              {/* Delete result */}
              {deleteResult && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Deleted {deleteResult.deleted} person(s).
                  {deleteResult.failed > 0 && ` ${deleteResult.failed} failed.`}
                </div>
              )}

              {/* Delete All */}
              <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div>
                  <p className="text-sm font-medium text-text">
                    {persons.length} unassigned person(s)
                  </p>
                  <p className="text-xs text-text-muted">Not linked to any case or proceeding</p>
                </div>
                {confirmDeleteAll ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Permanently delete {persons.length}?
                    </span>
                    <button
                      onClick={() => deleteAllMutation.mutate(persons)}
                      disabled={deleteAllMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {deleteAllMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteAll(false)}
                      className="px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteAll(true)}
                    disabled={deleteAllMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </button>
                )}
              </div>

              {/* Persons list */}
              <div className="border border-border rounded-lg divide-y divide-border">
                {persons.map((person) => (
                  <PersonCleanupRow
                    key={person.id}
                    person={person}
                    onDelete={() => deleteSingleMutation.mutate(person.id)}
                    isDeleting={deleteSingleMutation.isPending && deleteSingleMutation.variables === person.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 text-sm font-medium text-text-secondary bg-bg-hover rounded-lg hover:bg-bg-elevated transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonCleanupRow({
  person,
  onDelete,
  isDeleting,
}: {
  person: Person;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const primaryPhone = person.phones?.find(p => p.primary)?.value || person.phones?.[0]?.value;
  const primaryEmail = person.emails?.find(e => e.primary)?.value || person.emails?.[0]?.value;

  return (
    <div className="flex items-center gap-3 px-3 py-2 group">
      <div className="w-7 h-7 rounded-full bg-bg-hover flex items-center justify-center flex-shrink-0">
        <User className="w-3.5 h-3.5 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{person.name}</span>
          <span className="text-xs text-text-muted">#{person.id}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-bg-hover text-text-secondary capitalize">
            {person.person_type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {person.organization && <span>{person.organization}</span>}
          {primaryPhone && <span>{primaryPhone}</span>}
          {primaryEmail && <span className="truncate">{primaryEmail}</span>}
          {person.created_at && (
            <span>Created {new Date(person.created_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="p-1.5 text-text-muted hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="Delete person"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
