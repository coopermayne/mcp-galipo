/**
 * TasksWidget - Thin wrapper for TasksComponent in panel layout
 *
 * Renders TasksComponent with config from the panel.
 */
import { TasksComponent } from '../tasks/TasksComponent';
import { useAuth } from '../../context/AuthContext';
import type { TasksWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface TasksWidgetProps {
  config: TasksWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function TasksWidget({ config, onConfigChange }: TasksWidgetProps) {
  const { user } = useAuth();
  // When caseOwnerFilter is 'mine', pass the current user's ID to filter tasks to their cases
  const userId = config.caseOwnerFilter === 'mine' && user ? user.id : undefined;

  return (
    <TasksComponent
      caseId={config.caseId}
      showAllTasks={!config.caseId}
      showControls={false}
      showDetailSheet
      enableInlineCreate
      groupBy={config.groupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy })}
      statusFilter={config.showDone ? ['Done'] : ['Pending', 'Active', 'Blocked']}
      onStatusFilterChange={(statuses) => onConfigChange({ showDone: statuses.includes('Done') })}
      searchQuery={config.searchQuery}
      assigneeFilter={config.assigneeFilter}
      onAssigneeFilterChange={(assigneeFilter) => onConfigChange({ assigneeFilter })}
      userId={userId}
    />
  );
}
