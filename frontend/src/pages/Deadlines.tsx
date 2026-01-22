import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import {
  EditableText,
  EditableDate,
  ListPanel,
  ConfirmModal,
} from '../components/common';
import { getDeadlines, updateDeadline, deleteDeadline } from '../api/client';
import type { Deadline } from '../types';
import { Trash2, Search, Star } from 'lucide-react';

// Deterministic color mapping for case badges
const caseColorClasses = [
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
];

const getCaseColorClass = (caseId: number) => caseColorClasses[caseId % caseColorClasses.length];

export function Deadlines() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: deadlinesData, isLoading } = useQuery({
    queryKey: ['deadlines'],
    queryFn: () => getDeadlines(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deadline> }) =>
      updateDeadline(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDeadline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleUpdate = useCallback(
    async (deadlineId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: deadlineId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (deadlineId: number) => {
      setDeleteTarget(deadlineId);
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // Filter and group deadlines by date
  const groupedDeadlines = useMemo(() => {
    if (!deadlinesData?.deadlines) return {};

    // Filter by search query (description, case name, or short name)
    const filteredDeadlines = searchQuery
      ? deadlinesData.deadlines.filter((deadline) => {
          const query = searchQuery.toLowerCase();
          return (
            deadline.description.toLowerCase().includes(query) ||
            (deadline.case_name && deadline.case_name.toLowerCase().includes(query)) ||
            (deadline.short_name && deadline.short_name.toLowerCase().includes(query))
          );
        })
      : deadlinesData.deadlines;

    const groups: Record<string, Deadline[]> = {
      overdue: [],
      today: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setDate(monthEnd.getDate() + 30);

    filteredDeadlines.forEach((deadline) => {
      const dueDate = new Date(deadline.date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        groups.overdue.push(deadline);
      } else if (dueDate.getTime() === today.getTime()) {
        groups.today.push(deadline);
      } else if (dueDate < weekEnd) {
        groups.thisWeek.push(deadline);
      } else if (dueDate < monthEnd) {
        groups.thisMonth.push(deadline);
      } else {
        groups.later.push(deadline);
      }
    });

    return groups;
  }, [deadlinesData?.deadlines, searchQuery]);

  const groupLabels: Record<string, string> = {
    overdue: 'Overdue',
    today: 'Today',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    later: 'Later',
  };

  const groupColors: Record<string, string> = {
    overdue: 'text-red-600',
    today: 'text-amber-600',
    thisWeek: 'text-blue-600',
    thisMonth: 'text-slate-600',
    later: 'text-slate-500',
  };

  return (
    <>
      <Header
        title="Deadlines & Events"
        subtitle="Important dates and court events"
      />

      <PageContent>
        {/* Search */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search deadlines or cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        </ListPanel>

        {/* Deadline List */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : deadlinesData?.deadlines.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No deadlines found" />
          </ListPanel>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedDeadlines).map(
              ([group, deadlines]) =>
                deadlines.length > 0 && (
                  <div key={group}>
                    <h2 className={`text-sm font-semibold mb-2 ${groupColors[group]}`}>
                      {groupLabels[group]} ({deadlines.length})
                    </h2>
                    <ListPanel>
                      <ListPanel.Body>
                        {deadlines.map((deadline) => (
                          <ListPanel.Row key={deadline.id} highlight={group === 'overdue'}>
                            <button
                              onClick={() => handleUpdate(deadline.id, 'starred', !deadline.starred)}
                              className={`p-1 ${deadline.starred ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                              title={deadline.starred ? 'Unstar' : 'Star'}
                            >
                              <Star className={`w-4 h-4 ${deadline.starred ? 'fill-amber-500' : ''}`} />
                            </button>
                            <Link
                              to={`/cases/${deadline.case_id}`}
                              className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-24 truncate text-center ${getCaseColorClass(deadline.case_id)}`}
                              title={deadline.short_name || deadline.case_name || `Case #${deadline.case_id}`}
                            >
                              {deadline.short_name || deadline.case_name || `Case #${deadline.case_id}`}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <EditableText
                                value={deadline.description}
                                onSave={(value) => handleUpdate(deadline.id, 'description', value)}
                                className="text-sm"
                              />
                            </div>
                            <EditableDate
                              value={deadline.date}
                              onSave={(value) => handleUpdate(deadline.id, 'date', value)}
                            />
                            <button
                              onClick={() => handleDelete(deadline.id)}
                              className="p-1 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </ListPanel.Row>
                        ))}
                      </ListPanel.Body>
                    </ListPanel>
                  </div>
                )
            )}
          </div>
        )}
      </PageContent>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Deadline"
        message="Are you sure you want to delete this deadline?"
        confirmText="Delete Deadline"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
