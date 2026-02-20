import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Eye } from 'lucide-react';
import { updateUser, getUsers } from '../../api/users';
import type { User, UpdateUserInput, UserPosition } from '../../types/user';

const FEATURE_OPTIONS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'cases', label: 'Cases' },
  { key: 'intakes', label: 'Intake' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'templates', label: 'Templates' },
  { key: 'courtlistener', label: 'CourtListener' },
  { key: 'people', label: 'People' },
];

interface EditUserModalProps {
  user: User | null;
  onClose: () => void;
}

const POSITIONS: { value: UserPosition; label: string }[] = [
  { value: 'attorney', label: 'Attorney' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

export function EditUserModal({ user, onClose }: EditUserModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<UpdateUserInput>({});
  const [error, setError] = useState('');

  // Fetch all users to get paralegals list
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  // Filter to only paralegals (exclude current user if they happen to be one)
  const paralegals = allUsers.filter(
    (u) => u.position === 'paralegal' && u.isActive && u.id !== user?.id
  );

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        initials: user.initials,
        position: user.position,
        barNumber: user.barNumber,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        paralegalId: user.paralegalId,
        visibleFeatures: user.visibleFeatures ?? null,
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: (data: UpdateUserInput) => updateUser(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update user');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate(formData);
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Edit User
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName || ''}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName || ''}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Initials
              </label>
              <input
                type="text"
                value={formData.initials || ''}
                onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                maxLength={4}
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Position *
              </label>
              <select
                value={formData.position || 'paralegal'}
                onChange={(e) => setFormData({ ...formData, position: e.target.value as UserPosition })}
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                {POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Bar Number
            </label>
            <input
              type="text"
              value={formData.barNumber || ''}
              onChange={(e) => setFormData({ ...formData, barNumber: e.target.value || null })}
              placeholder="For attorneys"
              className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Default Paralegal - only show for attorneys */}
          {formData.position === 'attorney' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Default Paralegal
              </label>
              <select
                value={formData.paralegalId ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  paralegalId: e.target.value ? Number(e.target.value) : null
                })}
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">None</option>
                {paralegals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.initials})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAdmin"
                checked={formData.isAdmin || false}
                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isAdmin" className="text-sm text-text-secondary">
                Admin privileges (can manage users)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive ?? true}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isActive" className="text-sm text-text-secondary">
                Active (can log in)
              </label>
            </div>
          </div>

          {/* Visible Features - only for non-admin users */}
          {!formData.isAdmin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                  <Eye className="w-4 h-4" />
                  Sidebar Visibility
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    visibleFeatures: formData.visibleFeatures ? null : Object.fromEntries(
                      FEATURE_OPTIONS.map(f => [f.key, true])
                    ),
                  })}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {formData.visibleFeatures ? 'Show All (reset)' : 'Customize'}
                </button>
              </div>
              {formData.visibleFeatures ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {FEATURE_OPTIONS.map((feature) => (
                    <label key={feature.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.visibleFeatures![feature.key] !== false}
                        onChange={(e) => setFormData({
                          ...formData,
                          visibleFeatures: {
                            ...formData.visibleFeatures!,
                            [feature.key]: e.target.checked,
                          },
                        })}
                        className="rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-text">{feature.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">All features visible (default)</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
