import { useCallback } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { parseISO, isValid, differenceInDays } from 'date-fns';

export function Dashboard() {
  const queryClient = useQueryClient();

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
      if (confirm('Delete this task?')) {
        deleteTaskMutation.mutate(taskId);
      }
    },
    [deleteTaskMutation]
  );

  const handleUpdateDeadline = useCallback(
    async (deadlineId: number, field: string, value: any) => {
      await updateDeadlineMutation.mutateAsync({ id: deadlineId, data: { [field]: value } });
    },
    [updateDeadlineMutation]
  );

  const handleDeleteDeadline = useCallback(
    (deadlineId: number) => {
      if (confirm('Delete this deadline?')) {
        deleteDeadlineMutation.mutate(deadlineId);
      }
    },
    [deleteDeadlineMutation]
  );

  const taskStatusOptions = (constants?.task_statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  const deadlineStatusOptions = [
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

  const getDaysUntil = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return null;
    const days = differenceInDays(date, new Date());
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  };

  // Filter to only show non-completed tasks
  const pendingTasks = tasksData?.tasks.filter(t => t.status !== 'Done') || [];

  // Filter to only show upcoming pending deadlines (not overdue)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pendingDeadlines = deadlinesData?.deadlines.filter(d => {
    if (d.status !== 'Pending') return false;
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
                      <div className="flex-1 min-w-0">
                        <EditableText
                          value={task.description}
                          onSave={(value) => handleUpdateTask(task.id, 'description', value)}
                          className="text-sm"
                        />
                        <Link
                          to={`/cases/${task.case_id}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-400 mt-0.5"
                        >
                          {task.short_name || task.case_name || `Case #${task.case_id}`}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
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
              ) : pendingDeadlines.length === 0 ? (
                <ListPanel.Empty message="No pending deadlines" />
              ) : (
                <ListPanel.Body>
                  {pendingDeadlines.slice(0, 8).map((deadline) => (
                    <ListPanel.Row key={deadline.id}>
                      <div className="w-28 shrink-0">
                        <EditableDate
                          value={deadline.date}
                          onSave={(value) => handleUpdateDeadline(deadline.id, 'date', value)}
                        />
                        <p className="text-xs text-slate-500 mt-0.5">
                          {getDaysUntil(deadline.date)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <EditableText
                          value={deadline.description}
                          onSave={(value) => handleUpdateDeadline(deadline.id, 'description', value)}
                          className="text-sm"
                        />
                        <Link
                          to={`/cases/${deadline.case_id}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-400 mt-0.5"
                        >
                          {deadline.short_name || deadline.case_name || `Case #${deadline.case_id}`}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <EditableSelect
                        value={deadline.status}
                        options={deadlineStatusOptions}
                        onSave={(value) => handleUpdateDeadline(deadline.id, 'status', value)}
                        renderValue={(value) => <StatusBadge status={value} />}
                      />
                      <EditableSelect
                        value={String(deadline.urgency)}
                        options={urgencyOptions}
                        onSave={(value) => handleUpdateDeadline(deadline.id, 'urgency', parseInt(value))}
                        renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
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
