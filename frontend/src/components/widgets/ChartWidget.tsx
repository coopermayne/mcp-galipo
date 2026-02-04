/**
 * ChartWidget - Bar chart of cases by status in pipeline order
 *
 * Fetches dashboard stats (with optional attorney filter) and renders a StatusBarChart.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getStats } from '../../api/stats';
import { CASE_STATUS_HEX_COLORS } from '../../config/colors';
import { StatusBarChart } from './StatusBarChart';
import type { ChartWidgetConfig } from '../../types/panel-layout';

interface ChartWidgetProps {
  config: ChartWidgetConfig;
}

export function ChartWidget({ config }: ChartWidgetProps) {
  const { user } = useAuth();
  const attorneyIds = config.caseOwnerFilter === 'mine' && user ? [user.id] : undefined;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', attorneyIds],
    queryFn: () => getStats(attorneyIds),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Loading...
      </div>
    );
  }

  const casesByStatus = stats?.cases_by_status ?? {};

  return <StatusBarChart data={casesByStatus} colors={CASE_STATUS_HEX_COLORS} />;
}
