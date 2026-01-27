import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { StatusBadge, EditableSelect, ListPanel } from '../components/common';
import { getCases, getConstants, createCase, updateCase } from '../api';
import type { CaseStatus } from '../types';
import { Plus, Loader2, Search, Filter } from 'lucide-react';

export function Cases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
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

  const statusOptions = useMemo(
    () =>
      (constants?.case_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  // Filter cases by search query
  const filteredCases = useMemo(() => {
    if (!casesData?.cases) return [];
    if (!searchQuery) return casesData.cases;

    const query = searchQuery.toLowerCase();
    return casesData.cases.filter((c) =>
      c.case_name.toLowerCase().includes(query) ||
      (c.short_name && c.short_name.toLowerCase().includes(query))
    );
  }, [casesData?.cases, searchQuery]);

  return (
    <>
      <Header
        title="Case Files"
        subtitle="All your active and archived matters"
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
        {/* Search and Filters */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />

            {/* Status Filter */}
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 dark:text-slate-400">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="">All</option>
                {constants?.case_statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </ListPanel>

        {/* Quick Add Form */}
        {isCreating && (
          <div className="mb-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm transition-colors">
            <form onSubmit={handleCreateCase} className="flex items-center gap-3">
              <input
                type="text"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                placeholder="Enter case name (e.g., Martinez v. City of LA)"
                className="
                  flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  outline-none text-sm transition-colors
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
                  px-4 py-2 text-slate-600 dark:text-slate-300 rounded-lg
                  hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors
                  text-sm font-medium
                "
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Cases List */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : filteredCases.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No cases found" />
          </ListPanel>
        ) : (
          <ListPanel>
            <ListPanel.Body>
              {filteredCases.map((caseItem) => (
                <ListPanel.Row key={caseItem.id}>
                  <button
                    onClick={() => navigate(`/cases/${caseItem.id}`)}
                    className="flex-1 text-left min-w-0 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <span className="block font-medium text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 truncate">
                      {caseItem.short_name || caseItem.case_name}
                    </span>
                    {caseItem.short_name && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {caseItem.case_name}
                      </span>
                    )}
                  </button>
                  <EditableSelect
                    value={caseItem.status}
                    options={statusOptions}
                    onSave={(value) => handleStatusChange(caseItem.id, value)}
                    renderValue={(value) => <StatusBadge status={value} />}
                  />
                </ListPanel.Row>
              ))}
            </ListPanel.Body>
          </ListPanel>
        )}
      </PageContent>
    </>
  );
}
