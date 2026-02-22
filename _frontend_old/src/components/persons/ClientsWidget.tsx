/**
 * ClientsWidget - Thin wrapper for ClientsComponent in panel layout
 *
 * Uses useAuth() to get current user for "My Cases" filter.
 */
import { useAuth } from '../../context/AuthContext';
import { ClientsComponent } from './ClientsComponent';
import type { ClientsWidgetConfig, WidgetConfig } from '../../types/panel-layout';

interface ClientsWidgetProps {
  config: ClientsWidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
}

export function ClientsWidget({ config }: ClientsWidgetProps) {
  const { user } = useAuth();

  return (
    <ClientsComponent
      searchQuery={config.searchQuery}
      userId={config.caseOwnerFilter === 'mine' ? user?.id : undefined}
    />
  );
}
