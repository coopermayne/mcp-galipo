/**
 * PersonsWidget - Thin wrapper for PersonsComponent in panel layout
 *
 * Renders PersonsComponent with config from the panel.
 */
import { PersonsComponent } from './PersonsComponent';
import type { PersonsWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface PersonsWidgetProps {
  config: PersonsWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function PersonsWidget({ config, onConfigChange }: PersonsWidgetProps) {
  return (
    <PersonsComponent
      groupBy={config.groupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy })}
      typeFilter={config.typeFilter}
      searchQuery={config.searchQuery}
      showUnassigned={config.showUnassigned}
    />
  );
}
