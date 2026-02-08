/**
 * JudgesWidget - Thin wrapper for JudgesComponent in panel layout
 */
import { JudgesComponent } from './JudgesComponent';
import type { JudgesWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface JudgesWidgetProps {
  config: JudgesWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function JudgesWidget({ config }: JudgesWidgetProps) {
  return (
    <JudgesComponent
      searchQuery={config.searchQuery}
      jurisdictionId={config.jurisdictionId}
      titleFilter={config.titleFilter}
    />
  );
}
