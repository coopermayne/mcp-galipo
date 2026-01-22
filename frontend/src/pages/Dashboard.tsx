import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import {
  StatusBadge,
  UrgencyBadge,
  EditableText,
  EditableSelect,
  EditableDate,
  ListPanel,
  ConfirmModal,
} from '../components/common';
import { getStats, getTasks, getDeadlines, getConstants, updateTask, deleteTask, updateDeadline, deleteDeadline } from '../api/client';
import type { Task, Deadline } from '../types';
import {
  Briefcase,
  CheckSquare,
  Clock,
  ChevronRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import { parseISO, isValid } from 'date-fns';

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

export function Dashboard() {
  const queryClient = useQueryClient();
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<number | null>(null);
  const [deleteDeadlineTarget, setDeleteDeadlineTarget] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => getTasks({ limit: 10 }),
  });

  const { data: deadlinesData, isLoading: deadlinesLoading } = useQuery({
    queryKey: ['dashboard-deadlines'],
    queryFn: () => getDeadlines({ limit: 10 }),
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deadline> }) => updateDeadline(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteDeadlineMutation = useMutation({
    mutationFn: (id: number) => deleteDeadline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleUpdateTask = useCallback(
    async (taskId: number, field: string, value: any) => {
      await updateTaskMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateTaskMutation]
  );

  const handleDeleteTask = useCallback(
    (taskId: number) => {
      setDeleteTaskTarget(taskId);
    },
    []
  );

  const confirmDeleteTask = useCallback(() => {
    if (deleteTaskTarget) {
      deleteTaskMutation.mutate(deleteTaskTarget);
      setDeleteTaskTarget(null);
    }
  }, [deleteTaskTarget, deleteTaskMutation]);

  const handleUpdateDeadline = useCallback(
    async (deadlineId: number, field: string, value: any) => {
      await updateDeadlineMutation.mutateAsync({ id: deadlineId, data: { [field]: value } });
    },
    [updateDeadlineMutation]
  );

  const handleDeleteDeadline = useCallback(
    (deadlineId: number) => {
      setDeleteDeadlineTarget(deadlineId);
    },
    []
  );

  const confirmDeleteDeadline = useCallback(() => {
    if (deleteDeadlineTarget) {
      deleteDeadlineMutation.mutate(deleteDeadlineTarget);
      setDeleteDeadlineTarget(null);
    }
  }, [deleteDeadlineTarget, deleteDeadlineMutation]);

  const taskStatusOptions = (constants?.task_statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  const urgencyOptions = [
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2' },
    { value: '3', label: '3 - Medium' },
    { value: '4', label: '4' },
    { value: '5', label: '5 - Critical' },
  ];

  // Filter to only show non-completed tasks
  const pendingTasks = tasksData?.tasks.filter(t => t.status !== 'Done') || [];

  // Filter to only show upcoming deadlines (not overdue)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingDeadlines = deadlinesData?.deadlines.filter(d => {
    const deadlineDate = parseISO(d.date);
    return isValid(deadlineDate) && deadlineDate >= today;
  }) || [];

  return (
    <>
      <Header title="Overview" subtitle="Your cases at a glance" />

      <PageContent variant="full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Cases"
            value={stats?.total_cases ?? '-'}
            icon={Briefcase}
            loading={statsLoading}
            href="/cases"
          />
          <StatCard
            title="Active Cases"
            value={stats?.active_cases ?? '-'}
            icon={Briefcase}
            loading={statsLoading}
            href="/cases"
            variant="primary"
          />
          <StatCard
            title="Pending Tasks"
            value={stats?.pending_tasks ?? '-'}
            icon={CheckSquare}
            loading={statsLoading}
            href="/tasks"
            variant="warning"
          />
          <StatCard
            title="Upcoming Deadlines"
            value={stats?.upcoming_deadlines ?? '-'}
            icon={Clock}
            loading={statsLoading}
            href="/deadlines"
            variant="danger"
          />
        </div>

        {/* Date Format Test Section */}
        <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Date Format Test (remove after testing)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {/* Current year date */}
            <div className="space-y-2">
              <p className="font-medium text-slate-600 dark:text-slate-400">Current Year (2026-02-16):</p>
              <div className="space-y-1 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">Default:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} disabled />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">numeric:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} disabled numeric />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">showDayOfWeek=false:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} disabled showDayOfWeek={false} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">alwaysShowYear:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} disabled alwaysShowYear />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">numeric + no day:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} disabled numeric showDayOfWeek={false} />
                </div>
              </div>
            </div>
            {/* Different year date */}
            <div className="space-y-2">
              <p className="font-medium text-slate-600 dark:text-slate-400">Different Year (2025-03-15):</p>
              <div className="space-y-1 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">Default:</span>
                  <EditableDate value="2025-03-15" onSave={async () => {}} disabled />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">numeric:</span>
                  <EditableDate value="2025-03-15" onSave={async () => {}} disabled numeric />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">showDayOfWeek=false:</span>
                  <EditableDate value="2025-03-15" onSave={async () => {}} disabled showDayOfWeek={false} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">numeric + no day:</span>
                  <EditableDate value="2025-03-15" onSave={async () => {}} disabled numeric showDayOfWeek={false} />
                </div>
              </div>
            </div>
            {/* Interactive / Disabled comparison */}
            <div className="space-y-2">
              <p className="font-medium text-slate-600 dark:text-slate-400">Enabled vs Disabled:</p>
              <div className="space-y-1 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">Enabled (click me):</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">Disabled:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} disabled />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">Enabled + clearable:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} clearable />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">Enabled no clear:</span>
                  <EditableDate value="2026-02-16" onSave={async () => {}} clearable={false} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-40">No value:</span>
                  <EditableDate value={null} onSave={async () => {}} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
              <Link
                to="/tasks"
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <ListPanel>
              {tasksLoading ? (
                <ListPanel.Loading />
              ) : pendingTasks.length === 0 ? (
                <ListPanel.Empty message="No pending tasks" />
              ) : (
                <ListPanel.Body>
                  {pendingTasks.slice(0, 8).map((task) => (
                    <ListPanel.Row key={task.id}>
                      <Link
                        to={`/cases/${task.case_id}`}
                        className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-20 truncate text-center ${getCaseColorClass(task.case_id)}`}
                        title={task.short_name || task.case_name || `Case #${task.case_id}`}
                      >
                        {task.short_name || task.case_name || `Case #${task.case_id}`}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <EditableText
                          value={task.description}
                          onSave={(value) => handleUpdateTask(task.id, 'description', value)}
                          className="text-sm"
                        />
                      </div>
                      <EditableDate
                        value={task.due_date || null}
                        onSave={(value) => handleUpdateTask(task.id, 'due_date', value)}
                        placeholder="Due"
                      />
                      <EditableSelect
                        value={task.status}
                        options={taskStatusOptions}
                        onSave={(value) => handleUpdateTask(task.id, 'status', value)}
                        renderValue={(value) => <StatusBadge status={value} />}
                      />
                      <EditableSelect
                        value={String(task.urgency)}
                        options={urgencyOptions}
                        onSave={(value) => handleUpdateTask(task.id, 'urgency', parseInt(value))}
                        renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
                      />
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </ListPanel.Row>
                  ))}
                </ListPanel.Body>
              )}
            </ListPanel>
          </div>

          {/* Upcoming Deadlines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Deadlines</h2>
              <Link
                to="/deadlines"
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <ListPanel>
              {deadlinesLoading ? (
                <ListPanel.Loading />
              ) : upcomingDeadlines.length === 0 ? (
                <ListPanel.Empty message="No upcoming deadlines" />
              ) : (
                <ListPanel.Body>
                  {upcomingDeadlines.slice(0, 8).map((deadline) => (
                    <ListPanel.Row key={deadline.id}>
                      <Link
                        to={`/cases/${deadline.case_id}`}
                        className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-20 truncate text-center ${getCaseColorClass(deadline.case_id)}`}
                        title={deadline.short_name || deadline.case_name || `Case #${deadline.case_id}`}
                      >
                        {deadline.short_name || deadline.case_name || `Case #${deadline.case_id}`}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <EditableText
                          value={deadline.description}
                          onSave={(value) => handleUpdateDeadline(deadline.id, 'description', value)}
                          className="text-sm"
                        />
                      </div>
                      <EditableDate
                        value={deadline.date}
                        onSave={(value) => handleUpdateDeadline(deadline.id, 'date', value)}
                      />
                      <button
                        onClick={() => handleDeleteDeadline(deadline.id)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </ListPanel.Row>
                  ))}
                </ListPanel.Body>
              )}
            </ListPanel>
          </div>
        </div>
      </PageContent>

      <ConfirmModal
        isOpen={!!deleteTaskTarget}
        onClose={() => setDeleteTaskTarget(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmText="Delete Task"
        variant="danger"
        isLoading={deleteTaskMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!deleteDeadlineTarget}
        onClose={() => setDeleteDeadlineTarget(null)}
        onConfirm={confirmDeleteDeadline}
        title="Delete Deadline"
        message="Are you sure you want to delete this deadline?"
        confirmText="Delete Deadline"
        variant="danger"
        isLoading={deleteDeadlineMutation.isPending}
      />
    </>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  href?: string;
  variant?: 'default' | 'primary' | 'warning' | 'danger';
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  href,
  variant = 'default',
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    primary: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
    warning: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    danger: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  };

  const content = (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}
          </p>
        </div>
        <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }

  return content;
}
