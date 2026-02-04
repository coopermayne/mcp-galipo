/**
 * CalendarWidget - Thin wrapper for CalendarView in panel layout
 *
 * Follows the same pattern as EventsWidget.
 */
import { CalendarView } from '../calendar/CalendarView';
import { useAuth } from '../../context/AuthContext';
import type { CalendarWidgetConfig, CalendarViewMode, WidgetConfig } from '../../types/panel-layout';

interface CalendarWidgetProps {
  config: CalendarWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function CalendarWidget({ config, onConfigChange }: CalendarWidgetProps) {
  const { user } = useAuth();
  const userId = config.caseOwnerFilter === 'mine' && user ? user.id : undefined;

  return (
    <CalendarView
      showEvents={config.showEvents}
      showTasks={config.showTasks}
      userId={userId}
      calendarView={config.calendarView}
      onViewChange={(calendarView: CalendarViewMode) => onConfigChange({ calendarView })}
    />
  );
}
