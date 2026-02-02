import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { TasksComponent } from '../components/tasks';
import { EventsComponent } from '../components/events';
import { getStats } from '../api';
import {
  Briefcase,
  CheckSquare,
  Clock,
  Loader2,
} from 'lucide-react';

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  return (
    <>
      <Header title="Overview" subtitle="Your cases at a glance" />

      <PageContent variant="full">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6">
          <StatCard
            title="Total"
            fullTitle="Total Cases"
            value={stats?.total_cases ?? '-'}
            icon={Briefcase}
            loading={statsLoading}
            href="/cases"
          />
          <StatCard
            title="Active"
            fullTitle="Active Cases"
            value={stats?.active_cases ?? '-'}
            icon={Briefcase}
            loading={statsLoading}
            href="/cases"
            variant="primary"
          />
          <StatCard
            title="Tasks"
            fullTitle="Pending Tasks"
            value={stats?.pending_tasks ?? '-'}
            icon={CheckSquare}
            loading={statsLoading}
            href="/tasks"
            variant="warning"
          />
          <StatCard
            title="Events"
            fullTitle="Upcoming Events"
            value={stats?.upcoming_events ?? '-'}
            icon={Clock}
            loading={statsLoading}
            href="/calendar"
            variant="danger"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <TasksComponent
              showAllTasks
              title="Tasks"
              viewAllLink="/tasks"
              showControls={false}
              showDetailSheet={false}
              maxItems={8}
              compact
              defaultGroupBy="urgency"
              enableInlineCreate
            />
          </div>

          {/* Events */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <EventsComponent
              showAllEvents
              title="Events"
              viewAllLink="/calendar"
              showControls={false}
              maxItems={8}
              compact
            />
          </div>
        </div>
      </PageContent>
    </>
  );
}

interface StatCardProps {
  title: string;
  fullTitle?: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  href?: string;
  variant?: 'default' | 'primary' | 'warning' | 'danger';
}

function StatCard({
  title,
  fullTitle,
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
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-2 sm:p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span className="sm:hidden">{title}</span>
            <span className="hidden sm:inline">{fullTitle || title}</span>
          </p>
          <p className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:mt-1">
            {loading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto sm:mx-0" /> : value}
          </p>
        </div>
        <div className={`hidden sm:block p-2 rounded-lg ${variantStyles[variant]}`}>
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
