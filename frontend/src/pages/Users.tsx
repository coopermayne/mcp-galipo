import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UserPlus, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserList, CreateUserModal, EditUserModal } from '../components/users';
import type { User } from '../types/user';

export function Users() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Redirect non-admins
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              User Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage team members and their permissions
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* User List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <UserList onEdit={setEditingUser} />
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
      />
    </div>
  );
}
