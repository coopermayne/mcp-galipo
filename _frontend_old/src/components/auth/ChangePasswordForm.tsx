import { useState } from 'react';
import type { FormEvent } from 'react';
import { Key, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordFormProps {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onCancel?: () => void;
  isFirstLogin?: boolean;
}

export function ChangePasswordForm({ onSubmit, onCancel, isFirstLogin = false }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password');
      return;
    }

    setIsSubmitting(true);
    const success = await onSubmit(currentPassword, newPassword);
    if (!success) {
      setError('Current password is incorrect');
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isFirstLogin && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/50 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-lg text-sm">
          Please change your password before continuing.
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-text-secondary mb-2">
          Current Password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2 pr-10 bg-bg-hover border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Enter current password"
            required
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-2">
          New Password
        </label>
        <div className="relative">
          <input
            id="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 pr-10 bg-bg-hover border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Enter new password"
            required
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Must be at least 8 characters
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-4 py-2 bg-bg-hover border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          placeholder="Confirm new password"
          required
          autoComplete="new-password"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex gap-3">
        {onCancel && !isFirstLogin && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-border text-text-secondary font-medium rounded-lg hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-bg-surface"
        >
          <Key className="w-5 h-5" />
          {isSubmitting ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}
