import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import {
  EditableText,
  EditableSelect,
  EditableDate,
  StatusBadge,
  UrgencyBadge,
  ListPanel,
} from '../components/common';
import { getDeadlines, updateDeadline, deleteDeadline } from '../api/client';
import type { Deadline } from '../types';
import { Trash2, ExternalLink, Filter, AlertTriangle, Search } from 'lucide-react';
import { parseISO, differenceInDays, isValid } from 'date-fns';

export function Deadlines() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');

  const { data: deadlinesData, isLoading } = useQuery({
    queryKey: ['deadlines', { status: statusFilter || undefined, urgency: urgencyFilter ? parseInt(urgencyFilter) : undefined }],
    queryFn: () =>
      getDeadlines({
        status: statusFilter || undefined,
        urgency: urgencyFilter ? parseInt(urgencyFilter) : undefined,
      }),
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

  const statusOptions = [
    { value: 'Pending', label: 'Pending' },
    { value: 'Met', label: 'Met' },
    { value: 'Missed', label: 'Missed' },
    { value: 'Extended', label: 'Extended' },
  ];

  const urgencyOptions = [
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2' },
    { value: '3', label: '3 - Medium' },
    { value: '4', label: '4' },
    { value: '5', label: '5 - Critical' },
  ];

  const handleUpdate = useCallback(
    async (deadlineId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: deadlineId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (deadlineId: number) => {
      if (confirm('Are you sure you want to delete this deadline?')) {
        deleteMutation.mutate(deadlineId);
      }
    },
    [deleteMutation]
  );

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
    overdue: 'text-red-400 bg-red-900/30',
    today: 'text-amber-400 bg-amber-900/30',
    thisWeek: 'text-blue-400 bg-blue-900/30',
    thisMonth: 'text-slate-300 bg-slate-700',
    later: 'text-slate-400 bg-slate-700',
  };

  const getDaysUntil = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return null;
    const days = differenceInDays(date, new Date());
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  return (
    <>
      <Header
        title="Deadlines"
        subtitle={`${deadlinesData?.total ?? 0} deadlines`}
      />

      <PageContent>
        {/* Filters */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search deadlines or cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="h-6 w-px bg-slate-600" />
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm bg-slate-700 text-slate-100"
              >
                <option value="">All</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Min Urgency:</label>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-600 text-sm bg-slate-700 text-slate-100"
              >
                <option value="">All</option>
                {urgencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-2 ${groupColors[group]}`}>
                      {group === 'overdue' && <AlertTriangle className="w-4 h-4" />}
                      {groupLabels[group]} ({deadlines.length})
                    </div>
                    <ListPanel>
                      <ListPanel.Body>
                        {deadlines.map((deadline) => (
                          <ListPanel.Row key={deadline.id} highlight={group === 'overdue'}>
                            <div className="w-28 shrink-0">
                              <EditableDate
                                value={deadline.date}
                                onSave={(value) => handleUpdate(deadline.id, 'date', value)}
                              />
                              <p className={`text-xs mt-0.5 ${group === 'overdue' ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                                {getDaysUntil(deadline.date)}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <EditableText
                                value={deadline.description}
                                onSave={(value) => handleUpdate(deadline.id, 'description', value)}
                                className="text-sm"
                              />
                              <Link
                                to={`/cases/${deadline.case_id}`}
                                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-400 mt-1"
                              >
                                {deadline.short_name || deadline.case_name || `Case #${deadline.case_id}`}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                            <EditableSelect
                              value={deadline.status}
                              options={statusOptions}
                              onSave={(value) => handleUpdate(deadline.id, 'status', value)}
                              renderValue={(value) => <StatusBadge status={value} />}
                            />
                            <EditableSelect
                              value={String(deadline.urgency)}
                              options={urgencyOptions}
                              onSave={(value) => handleUpdate(deadline.id, 'urgency', parseInt(value))}
                              renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
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
    </>
  );
}
