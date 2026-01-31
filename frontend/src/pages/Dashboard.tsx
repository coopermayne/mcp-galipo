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
            title="Upcoming Events"
            value={stats?.upcoming_events ?? '-'}
            icon={Clock}
            loading={statsLoading}
            href="/calendar"
            variant="danger"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks */}
          <div>
            <TasksComponent
              showAllTasks
              title="Tasks"
              viewAllLink="/tasks"
              showControls={false}
              showDetailSheet={false}
              maxItems={8}
              compact
              defaultGroupBy="urgency"
            />
          </div>

          {/* Events */}
          <div>
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
