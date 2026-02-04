/**
 * EventsWidget - Thin wrapper for EventsComponent in panel layout
 *
 * Renders EventsComponent with config from the panel.
 */
import { EventsComponent } from '../events/EventsComponent';
import { useAuth } from '../../context/AuthContext';
import type { EventsWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface EventsWidgetProps {
  config: EventsWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function EventsWidget({ config, onConfigChange }: EventsWidgetProps) {
  const { user } = useAuth();
  // When showing past events, force no grouping (flat list sorted by date)
  const effectiveGroupBy = config.showPast ? 'none' : config.groupBy;
  // When caseOwnerFilter is 'mine', pass the current user's ID to filter by case ownership
  const userId = config.caseOwnerFilter === 'mine' && user ? user.id : undefined;
  // When attendeeFilter is 'mine', pass the current user's ID to filter by attendee
  const attendeeId = config.attendeeFilter === 'mine' && user ? user.id : undefined;

  return (
    <EventsComponent
      caseId={config.caseId}
      showAllEvents={!config.caseId}
      showControls={false}
      groupBy={effectiveGroupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy })}
      showPast={config.showPast}
      onShowPastChange={(showPast) => onConfigChange({ showPast })}
      showCase
      searchQuery={config.searchQuery}
      userId={userId}
      attendeeId={attendeeId}
    />
  );
}
