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
  ConfirmModal,
} from '../components/common';
import { getTasks, getConstants, updateTask, deleteTask } from '../api/client';
import type { Task } from '../types';
import { Trash2, Filter, Search } from 'lucide-react';

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

export function Tasks() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', { status: statusFilter || undefined, urgency: urgencyFilter ? parseInt(urgencyFilter) : undefined }],
    queryFn: () =>
      getTasks({
        status: statusFilter || undefined,
        urgency: urgencyFilter ? parseInt(urgencyFilter) : undefined,
      }),
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const taskStatusOptions = useMemo(
    () =>
      (constants?.task_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  const urgencyOptions = [
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2' },
    { value: '3', label: '3 - Medium' },
    { value: '4', label: '4' },
    { value: '5', label: '5 - Critical' },
  ];

  const handleUpdate = useCallback(
    async (taskId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (taskId: number, description: string) => {
      setDeleteTarget({ id: taskId, description });
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  // Filter and group tasks by date
  const groupedTasks = useMemo(() => {
    if (!tasksData?.tasks) return {};

    // Filter by search query (description, case name, or short name)
    const filteredTasks = searchQuery
      ? tasksData.tasks.filter((task) => {
          const query = searchQuery.toLowerCase();
          return (
            task.description.toLowerCase().includes(query) ||
            (task.case_name && task.case_name.toLowerCase().includes(query)) ||
            (task.short_name && task.short_name.toLowerCase().includes(query))
          );
        })
      : tasksData.tasks;

    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    filteredTasks.forEach((task) => {
      if (!task.due_date) {
        groups.noDueDate.push(task);
        return;
      }

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        groups.overdue.push(task);
      } else if (dueDate.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(task);
      } else if (dueDate < weekEnd) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  }, [tasksData?.tasks, searchQuery]);

  const groupLabels: Record<string, string> = {
    overdue: 'Overdue',
    today: 'Today',
    tomorrow: 'Tomorrow',
    thisWeek: 'This Week',
    later: 'Later',
    noDueDate: 'No Due Date',
  };

  const groupColors: Record<string, string> = {
    overdue: 'text-red-600',
    today: 'text-amber-600',
    tomorrow: 'text-blue-600',
    thisWeek: 'text-slate-600',
    later: 'text-slate-500',
    noDueDate: 'text-slate-400',
  };

  return (
    <>
      <Header
        title="Tasks"
        subtitle="Track your to-dos"
      />

      <PageContent>
        {/* Filters */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks or cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 dark:text-slate-400">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="">All</option>
                {constants?.task_statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 dark:text-slate-400">Min Urgency:</label>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
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

        {/* Task List */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : tasksData?.tasks.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No tasks found" />
          </ListPanel>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(
              ([group, tasks]) =>
                tasks.length > 0 && (
                  <div key={group}>
                    <h2 className={`text-sm font-semibold mb-2 ${groupColors[group]}`}>
                      {groupLabels[group]} ({tasks.length})
                    </h2>
                    <ListPanel>
                      <ListPanel.Body>
                        {tasks.map((task) => (
                          <ListPanel.Row key={task.id}>
                            <Link
                              to={`/cases/${task.case_id}`}
                              className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap hover:opacity-80 ${getCaseColorClass(task.case_id)}`}
                            >
                              {task.short_name || task.case_name || `Case #${task.case_id}`}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <EditableText
                                value={task.description}
                                onSave={(value) => handleUpdate(task.id, 'description', value)}
                                className="text-sm"
                              />
                            </div>
                            <EditableDate
                              value={task.due_date || null}
                              onSave={(value) => handleUpdate(task.id, 'due_date', value)}
                              placeholder="Due date"
                            />
                            <EditableSelect
                              value={task.status}
                              options={taskStatusOptions}
                              onSave={(value) => handleUpdate(task.id, 'status', value)}
                              renderValue={(value) => <StatusBadge status={value} />}
                            />
                            <EditableSelect
                              value={String(task.urgency)}
                              options={urgencyOptions}
                              onSave={(value) => handleUpdate(task.id, 'urgency', parseInt(value))}
                              renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
                            />
                            <button
                              onClick={() => handleDelete(task.id, task.description)}
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
        title="Delete Task"
        message={`Are you sure you want to delete this task?`}
        confirmText="Delete Task"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
