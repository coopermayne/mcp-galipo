import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Header, PageContent } from '../components/layout';
import { DataTable, StatusBadge, EditableSelect } from '../components/common';
import { getCases, getConstants, createCase, updateCase, deleteCase } from '../api/client';
import type { CaseSummary, CaseStatus } from '../types';
import { Plus, Trash2, Loader2 } from 'lucide-react';

export function Cases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCaseName, setNewCaseName] = useState('');

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', { status: statusFilter || undefined }],
    queryFn: () => getCases({ status: statusFilter || undefined }),
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: CaseStatus } }) =>
      updateCase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createCase({ case_name: name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setIsCreating(false);
      setNewCaseName('');
      // Navigate to the new case
      navigate(`/cases/${data.case.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleStatusChange = useCallback(
    async (caseId: number, newStatus: string) => {
      await updateMutation.mutateAsync({ id: caseId, data: { status: newStatus as CaseStatus } });
    },
    [updateMutation]
  );

  const handleCreateCase = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (newCaseName.trim()) {
        createMutation.mutate(newCaseName.trim());
      }
    },
    [newCaseName, createMutation]
  );

  const handleDeleteCase = useCallback(
    (e: React.MouseEvent, caseId: number) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
        deleteMutation.mutate(caseId);
      }
    },
    [deleteMutation]
  );

  const statusOptions = useMemo(
    () =>
      (constants?.case_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  const columns: ColumnDef<CaseSummary>[] = useMemo(
    () => [
      {
        accessorKey: 'case_name',
        header: 'Case Name',
        cell: ({ row }) => (
          <span className="font-medium text-slate-100">{row.original.case_name}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <EditableSelect
            value={row.original.status}
            options={statusOptions}
            onSave={(value) => handleStatusChange(row.original.id, value)}
            renderValue={(value) => <StatusBadge status={value} />}
          />
        ),
      },
      {
        accessorKey: 'court',
        header: 'Court',
        cell: ({ row }) => (
          <span className="text-slate-300">{row.original.court || '-'}</span>
        ),
      },
      {
        accessorKey: 'print_code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-400">
            {row.original.print_code || '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            onClick={(e) => handleDeleteCase(e, row.original.id)}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
            title="Delete case"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ),
      },
    ],
    [statusOptions, handleStatusChange, handleDeleteCase]
  );

  const handleRowClick = useCallback(
    (caseItem: CaseSummary) => {
      navigate(`/cases/${caseItem.id}`);
    },
    [navigate]
  );

  return (
    <>
      <Header
        title="Cases"
        subtitle={`${casesData?.total ?? 0} cases`}
        actions={
          <button
            onClick={() => setIsCreating(true)}
            className="
              inline-flex items-center gap-2 px-4 py-2
              bg-primary-600 text-white rounded-lg
              hover:bg-primary-700 transition-colors
              text-sm font-medium
            "
          >
            <Plus className="w-4 h-4" />
            New Case
          </button>
        }
      />

      <PageContent>
        {/* Status Filter */}
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm text-slate-400">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="
              px-3 py-1.5 rounded-lg border border-slate-600
              text-sm bg-slate-700 text-slate-100
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500
              outline-none
            "
          >
            <option value="">All Statuses</option>
            {constants?.case_statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Add Form */}
        {isCreating && (
          <div className="mb-4 bg-slate-800 rounded-lg border border-slate-700 p-4">
            <form onSubmit={handleCreateCase} className="flex items-center gap-3">
              <input
                type="text"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                placeholder="Enter case name (e.g., Martinez v. City of LA)"
                className="
                  flex-1 px-3 py-2 rounded-lg border border-slate-600
                  bg-slate-700 text-slate-100 placeholder-slate-400
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  outline-none text-sm
                "
                autoFocus
              />
              <button
                type="submit"
                disabled={createMutation.isPending || !newCaseName.trim()}
                className="
                  px-4 py-2 bg-primary-600 text-white rounded-lg
                  hover:bg-primary-700 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-sm font-medium inline-flex items-center gap-2
                "
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewCaseName('');
                }}
                className="
                  px-4 py-2 text-slate-300 rounded-lg
                  hover:bg-slate-700 transition-colors
                  text-sm font-medium
                "
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Cases Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <DataTable
            data={casesData?.cases || []}
            columns={columns}
            onRowClick={handleRowClick}
            searchColumn="case_name"
            searchPlaceholder="Search cases..."
            emptyMessage="No cases found"
          />
        )}
      </PageContent>
    </>
  );
}
