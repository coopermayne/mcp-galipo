/**
 * CalendarWidget - Thin wrapper for CalendarView in panel layout
 */
import { CalendarView } from '../calendar/CalendarView';
import type { CalendarWidgetConfig, CalendarViewMode, WidgetConfig } from '../../types/panel-layout';

interface CalendarWidgetProps {
  config: CalendarWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function CalendarWidget({ config, onConfigChange }: CalendarWidgetProps) {
  return (
    <CalendarView
      calendarView={config.calendarView}
      onViewChange={(calendarView: CalendarViewMode) => onConfigChange({ calendarView })}
    />
  );
}
