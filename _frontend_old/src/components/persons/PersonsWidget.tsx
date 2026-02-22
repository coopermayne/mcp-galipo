/**
 * PersonsWidget - Thin wrapper for PersonsComponent in panel layout
 *
 * Renders PersonsComponent with config from the panel.
 */
import { PersonsComponent } from './PersonsComponent';
import type { PersonsWidgetConfig, PersonsGroupMode } from '../../types/panel-layout';
import type { RoleCategory } from '../../types';

interface PersonsWidgetProps {
  config: PersonsWidgetConfig;
  onConfigChange: (updates: Partial<PersonsWidgetConfig>) => void;
}

export function PersonsWidget({ config, onConfigChange }: PersonsWidgetProps) {
  return (
    <PersonsComponent
      groupBy={config.groupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy: groupBy as PersonsGroupMode })}
      searchQuery={config.searchQuery}
      showUnassigned={config.showUnassigned}
      categoryFilter={config.categoryFilter as RoleCategory | undefined}
    />
  );
}
