import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Pencil, Trash2, RotateCcw, Shield, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { getUsers, deleteUser, resetUserPassword } from '../../api/users';
import type { User } from '../../types/user';

const columnHelper = createColumnHelper<User>();

interface UserListProps {
  onEdit: (user: User) => void;
}

export function UserList({ onEdit }: UserListProps) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showInactive, setShowInactive] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', showInactive],
    queryFn: () => getUsers(showInactive),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: number) => resetUserPassword(id),
    onSuccess: (defaultPassword) => {
      alert(`Password reset to: ${defaultPassword}`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to deactivate ${user.firstName} ${user.lastName}?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleResetPassword = (user: User) => {
    if (confirm(`Reset password for ${user.firstName} ${user.lastName}? They will need to change it on next login.`)) {
      resetPasswordMutation.mutate(user.id);
    }
  };

  const columns = [
    columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
      id: 'name',
      header: 'Name',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-sm font-medium text-primary-700 dark:text-primary-300">
            {info.row.original.initials}
          </div>
          <div>
            <div className="font-medium text-text">
              {info.getValue()}
            </div>
            <div className="text-sm text-text-muted">
              {info.row.original.email}
            </div>
          </div>
        </div>
      ),
    }),
    columnHelper.accessor('position', {
      header: 'Position',
      cell: (info) => (
        <span className="capitalize">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('barNumber', {
      header: 'Bar #',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('isAdmin', {
      header: 'Admin',
      cell: (info) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
          info.getValue()
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
            : 'bg-bg-hover text-text-secondary'
        }`}>
          {info.getValue() ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
          {info.getValue() ? 'Yes' : 'No'}
        </span>
      ),
    }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: (info) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
          info.getValue()
            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        }`}>
          {info.getValue() ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
          {info.getValue() ? 'Active' : 'Inactive'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleResetPassword(info.row.original)}
            className="p-1.5 text-text-muted hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-bg-hover"
            title="Reset Password"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(info.row.original)}
            className="p-1.5 text-text-muted hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-bg-hover"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(info.row.original)}
            className="p-1.5 text-text-muted hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-bg-hover"
            title="Deactivate"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-border text-primary-600 focus:ring-primary-500"
          />
          Show inactive users
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full">
          <thead className="bg-bg-elevated border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-bg-surface">
            {table.getRowModel().rows.map((row, index) => (
              <tr key={row.id} className={`hover:bg-bg-hover ${index > 0 ? 'border-t border-border' : ''}`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-text-secondary">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            No users found
          </div>
        )}
      </div>
    </div>
  );
}
