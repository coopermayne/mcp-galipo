/**
 * TasksWidget - Thin wrapper for TasksComponent in panel layout
 *
 * Renders TasksComponent with config from the panel.
 */
import { TasksComponent } from '../tasks/TasksComponent';
import type { TasksWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface TasksWidgetProps {
  config: TasksWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function TasksWidget({ config, onConfigChange }: TasksWidgetProps) {
  return (
    <TasksComponent
      caseId={config.caseId}
      showAllTasks={!config.caseId}
      showControls={false}
      showDetailSheet
      enableInlineCreate
      groupBy={config.groupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy })}
      statusFilter={config.showDone ? ['Pending', 'Active', 'Done'] : ['Pending', 'Active']}
      onStatusFilterChange={(statuses) => onConfigChange({ showDone: statuses.includes('Done') })}
    />
  );
}
