import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Header, PageContent } from '../components/layout';
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
    <>
      <Header
        title="Users"
        subtitle="Manage team members and permissions"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        }
      />

      <PageContent>
        {/* User List */}
        <div className="bg-bg-surface rounded-lg border border-border p-4">
          <UserList onEdit={setEditingUser} />
        </div>
      </PageContent>

      {/* Modals */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      <EditUserModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
      />
    </>
  );
}
