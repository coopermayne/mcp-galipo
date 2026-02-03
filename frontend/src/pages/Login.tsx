import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { login, changePassword, mustChangePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(username, password);
    if (result.success) {
      if (result.mustChangePassword) {
        setShowChangePassword(true);
      } else {
        navigate('/');
      }
    } else {
      setError('Invalid email or password');
    }
    setIsSubmitting(false);
  };

  const handlePasswordChange = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const success = await changePassword(currentPassword, newPassword);
    if (success) {
      navigate('/');
    }
    return success;
  };

  // Show password change form if required
  if (showChangePassword || mustChangePassword) {
    return (
      <div className="min-h-screen bg-bg-hover flex items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-md">
          <div className="bg-bg-surface rounded-lg shadow-xl border border-border p-8 transition-colors">
            {/* Logo/Title */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <Scale className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-text">Change Password</h1>
            </div>

            <ChangePasswordForm
              onSubmit={handlePasswordChange}
              isFirstLogin={true}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-hover flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-bg-surface rounded-lg shadow-xl border border-border p-8 transition-colors">
          {/* Logo/Title */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Scale className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-text">Legal CMS</h1>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <input
                id="username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-bg-hover border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter email"
                required
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-bg-hover border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter password"
                required
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-bg-surface"
            >
              <LogIn className="w-5 h-5" />
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
