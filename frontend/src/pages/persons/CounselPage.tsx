import { useState } from 'react';
import { Header } from '../../components/layout';
import { PanelContainer } from '../../components/panels';
import { createDefaultPersonsWidget } from '../../types/panel-layout';
import type { WidgetConfig, WidgetType, PersonsWidgetConfig } from '../../types/panel-layout';

export function CounselPage() {
  const [config, setConfig] = useState<PersonsWidgetConfig>(() => ({
    ...createDefaultPersonsWidget('main'),
    categoryFilter: 'counsel',
    groupBy: 'alpha',
  }));

  const handleConfigChange = (updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates } as PersonsWidgetConfig));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="People" subtitle="Counsel" />
      <div className="flex-1 overflow-hidden p-4 max-w-4xl mx-auto w-full">
        <PanelContainer
          config={config}
          allowedWidgets={['persons'] as WidgetType[]}
          onConfigChange={handleConfigChange}
          onTypeChange={() => {}}
        />
      </div>
    </div>
  );
}
