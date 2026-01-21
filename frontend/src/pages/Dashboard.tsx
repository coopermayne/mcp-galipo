import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { StatusBadge, UrgencyBadge } from '../components/common';
import { getStats, getTasks, getDeadlines } from '../api/client';
import {
  Briefcase,
  CheckSquare,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', { status: 'Pending', limit: 5 }],
    queryFn: () => getTasks({ status: 'Pending', limit: 5 }),
  });

  const { data: deadlinesData, isLoading: deadlinesLoading } = useQuery({
    queryKey: ['deadlines', { status: 'Pending', limit: 5 }],
    queryFn: () => getDeadlines({ status: 'Pending', limit: 5 }),
  });

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'No date';
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy') : dateStr;
  };

  return (
    <>
      <Header title="Dashboard" subtitle="Overview of your legal cases" />

      <PageContent variant="full">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="font-semibold text-slate-100">Pending Tasks</h2>
              <Link
                to="/tasks"
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-700">
              {tasksLoading ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : tasksData?.tasks.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  No pending tasks
                </div>
              ) : (
                tasksData?.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="px-4 py-3 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">
                          {task.description}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {task.case_name || `Case #${task.case_id}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.due_date && (
                          <span className="text-xs text-slate-400">
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        <UrgencyBadge urgency={task.urgency} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h2 className="font-semibold text-slate-100">Upcoming Deadlines</h2>
              <Link
                to="/deadlines"
                className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-700">
              {deadlinesLoading ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : deadlinesData?.deadlines.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  No upcoming deadlines
                </div>
              ) : (
                deadlinesData?.deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className="px-4 py-3 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">
                          {deadline.description}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {deadline.case_name || `Case #${deadline.case_id}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-slate-300">
                          {formatDate(deadline.date)}
                        </span>
                        <UrgencyBadge urgency={deadline.urgency} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cases by Status */}
        {stats?.cases_by_status && Object.keys(stats.cases_by_status).length > 0 && (
          <div className="mt-6 bg-slate-800 rounded-lg border border-slate-700 shadow-sm p-4">
            <h2 className="font-semibold text-slate-100 mb-4">Cases by Status</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.cases_by_status).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg"
                >
                  <StatusBadge status={status} />
                  <span className="text-sm font-medium text-slate-300">{count as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
    default: 'bg-slate-700 text-slate-300',
    primary: 'bg-primary-900/50 text-primary-400',
    warning: 'bg-amber-900/50 text-amber-400',
    danger: 'bg-red-900/50 text-red-400',
  };

  const content = (
    <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-sm p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-2xl font-semibold text-slate-100 mt-1">
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
