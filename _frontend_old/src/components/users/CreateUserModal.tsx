import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, Eye } from 'lucide-react';
import { createUser } from '../../api/users';
import type { CreateUserInput, UserPosition } from '../../types/user';

const FEATURE_OPTIONS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'cases', label: 'Cases' },
  { key: 'intakes', label: 'Intake' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'templates', label: 'Templates' },
  { key: 'courtlistener', label: 'CourtListener' },
  { key: 'people', label: 'People' },
  { key: 'chat', label: 'Chat' },
];

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POSITIONS: { value: UserPosition; label: string }[] = [
  { value: 'attorney', label: 'Attorney' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateUserInput>({
    email: '',
    firstName: '',
    lastName: '',
    initials: '',
    position: 'paralegal',
    barNumber: '',
    isAdmin: false,
    visibleFeatures: null,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        initials: '',
        position: 'paralegal',
        barNumber: '',
        isAdmin: false,
        visibleFeatures: null,
      });
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create user');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Auto-generate initials if empty
    const data = { ...formData };
    if (!data.initials && data.firstName && data.lastName) {
      data.initials = (data.firstName[0] + data.lastName[0]).toUpperCase();
    }

    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Add New User
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
                value={formData.firstName}
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
                value={formData.lastName}
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
              value={formData.email}
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
                value={formData.initials}
                onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                placeholder="Auto-generated"
                maxLength={4}
                className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Position *
              </label>
              <select
                value={formData.position}
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
              onChange={(e) => setFormData({ ...formData, barNumber: e.target.value })}
              placeholder="For attorneys"
              className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createIsAdmin"
              checked={formData.isAdmin}
              onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
              className="rounded border-border text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="createIsAdmin" className="text-sm text-text-secondary">
              Admin privileges (can manage users)
            </label>
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

          <div className="bg-bg-hover rounded-lg p-3 text-sm text-text-muted">
            Default password will be set to <code className="bg-bg-elevated px-1 rounded">changeme</code>.
            User will be required to change it on first login.
          </div>

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
              <UserPlus className="w-4 h-4" />
              {mutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
