import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Loader2 } from 'lucide-react';
import { formatRoleName } from '../../utils';
import { createRole, deleteRole } from '../../api';
import type { Role, RoleCategory } from '../../types';

const CATEGORY_LABELS: Record<RoleCategory, string> = {
  expert: 'Experts',
  counsel: 'Counsel',
  mediator: 'Mediator',
  client: 'Clients',
  defendant: 'Defendants',
  other: 'Other',
};

export function ManageRolesModal({
  isOpen,
  onClose,
  roles,
}: {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
}) {
  const queryClient = useQueryClient();
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCategory, setNewRoleCategory] = useState<RoleCategory>('other');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; category: RoleCategory }) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['constants'] });
      setNewRoleName('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['constants'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoleName.trim()) {
      createMutation.mutate({ name: newRoleName.trim(), category: newRoleCategory });
    }
  };

  const handleDelete = (role: Role) => {
    const count = role.person_count || 0;
    if (count > 0) {
      setError(`Cannot delete "${role.name}": ${count} assignment(s) use this role`);
      return;
    }
    deleteMutation.mutate(role.id);
  };

  // Group roles by category
  const rolesByCategory = useMemo(() => {
    const grouped: Record<string, Role[]> = {};
    for (const role of roles) {
      if (!grouped[role.category]) {
        grouped[role.category] = [];
      }
      grouped[role.category].push(role);
    }
    return grouped;
  }, [roles]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Manage Roles
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-3 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Add new role */}
          <form onSubmit={handleCreate} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="New role name..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <select
              value={newRoleCategory}
              onChange={(e) => setNewRoleCategory(e.target.value as RoleCategory)}
              className="px-3 py-1.5 rounded-lg border border-border bg-bg-surface text-text text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createMutation.isPending || !newRoleName.trim()}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium inline-flex items-center gap-1"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </form>

          {/* Roles grouped by category */}
          {Object.entries(CATEGORY_LABELS).map(([category, categoryLabel]) => {
            const categoryRoles = rolesByCategory[category] || [];
            if (categoryRoles.length === 0) return null;

            return (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">
                  {categoryLabel}
                </h3>
                <div className="space-y-1">
                  {categoryRoles.map((role) => {
                    const count = role.person_count || 0;

                    return (
                      <div
                        key={role.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-hover group"
                      >
                        <span className="flex-1 text-sm text-text">
                          {formatRoleName(role.name)}
                        </span>
                        <span className="text-xs text-text-muted tabular-nums">
                          {count} {count === 1 ? 'assignment' : 'assignments'}
                        </span>
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={deleteMutation.isPending || count > 0}
                          className={`p-1 transition-opacity ${
                            count > 0
                              ? 'text-text-muted cursor-not-allowed'
                              : 'text-text-muted hover:text-red-600 opacity-0 group-hover:opacity-100'
                          }`}
                          title={count > 0 ? `Cannot delete: ${count} assignment(s) use this role` : 'Delete role'}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-text-secondary bg-bg-hover rounded-lg hover:bg-bg-elevated transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
