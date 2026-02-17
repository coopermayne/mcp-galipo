import { useState } from 'react';
import { Header } from '../../components/layout';
import { PanelContainer } from '../../components/panels';
import { createDefaultJudgesWidget } from '../../types/panel-layout';
import type { WidgetConfig, WidgetType, JudgesWidgetConfig } from '../../types/panel-layout';

export function JudgesPage() {
  const [config, setConfig] = useState<JudgesWidgetConfig>(() => createDefaultJudgesWidget('main'));

  const handleConfigChange = (updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates } as JudgesWidgetConfig));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="People" subtitle="Judges" />
      <div className="flex-1 overflow-hidden p-4 max-w-4xl mx-auto w-full">
        <PanelContainer
          config={config}
          allowedWidgets={['judges'] as WidgetType[]}
          onConfigChange={handleConfigChange}
          onTypeChange={() => {}}
        />
      </div>
    </div>
  );
}
