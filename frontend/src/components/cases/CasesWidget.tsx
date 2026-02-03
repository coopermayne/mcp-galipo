/**
 * CasesWidget - Thin wrapper for CasesComponent in panel layout
 *
 * Renders CasesComponent with config from the panel.
 */
import { CasesComponent } from './CasesComponent';
import type { CasesWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface CasesWidgetProps {
  config: CasesWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function CasesWidget({ config, onConfigChange }: CasesWidgetProps) {
  return (
    <CasesComponent
      groupBy={config.groupBy}
      onGroupByChange={(groupBy) => onConfigChange({ groupBy })}
      showClosed={config.showClosed}
      onShowClosedChange={(showClosed) => onConfigChange({ showClosed })}
      searchQuery={config.searchQuery}
      attorneyFilter={config.attorneyFilter}
    />
  );
}
