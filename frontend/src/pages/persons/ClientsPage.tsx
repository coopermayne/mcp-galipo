import { useState } from 'react';
import { Header } from '../../components/layout';
import { PanelContainer } from '../../components/panels';
import { createDefaultClientsWidget } from '../../types/panel-layout';
import type { WidgetConfig, WidgetType, ClientsWidgetConfig } from '../../types/panel-layout';

export function ClientsPage() {
  const [config, setConfig] = useState<ClientsWidgetConfig>(() => createDefaultClientsWidget('main'));

  const handleConfigChange = (updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates } as ClientsWidgetConfig));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="People" subtitle="Clients" />
      <div className="flex-1 overflow-hidden p-4 max-w-4xl mx-auto w-full">
        <PanelContainer
          config={config}
          allowedWidgets={['clients'] as WidgetType[]}
          onConfigChange={handleConfigChange}
          onTypeChange={() => {}}
        />
      </div>
    </div>
  );
}
