/**
 * EventsWidget - Thin wrapper for EventsComponent in panel layout
 *
 * Renders EventsComponent with config from the panel.
 */
import { EventsComponent } from '../events/EventsComponent';
import type { EventsWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface EventsWidgetProps {
  config: EventsWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function EventsWidget({ config, onConfigChange }: EventsWidgetProps) {
  return (
    <EventsComponent
      caseId={config.caseId}
      showAllEvents={!config.caseId}
      showControls={false}
      groupBy={config.groupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy })}
      showPast={config.showPast}
      onShowPastChange={(showPast) => onConfigChange({ showPast })}
      showCase
    />
  );
}
