import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import { getWebhooks } from '../api';
import { Webhook, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

const EVENT_TYPE_NAMES: Record<number, string> = {
  1: 'Docket Alert',
  2: 'Search Alert',
  3: 'RECAP Fetch',
  4: 'Old Docket Alert',
  5: 'Pray and Pay',
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'processing':
      return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-slate-400" />;
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function Webhooks() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => getWebhooks({ limit: 100 }),
  });

  const webhooks = data?.webhooks || [];

  return (
    <>
      <Header
        title="CourtListener Webhooks"
        subtitle="Incoming webhook events from CourtListener"
      />

      <PageContent>
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : webhooks.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No webhooks received yet" />
          </ListPanel>
        ) : (
          <ListPanel>
            <ListPanel.Body>
              {webhooks.map((webhook) => {
                const webhookMeta = webhook.payload?.webhook as Record<string, unknown> | undefined;
                const eventType = webhookMeta?.event_type;
                const eventTypeName = eventType ? EVENT_TYPE_NAMES[eventType as number] || `Type ${eventType}` : 'Unknown';

                return (
                  <ListPanel.Row key={webhook.id}>
                    <button
                      onClick={() => navigate(`/courtlistener/${webhook.id}`)}
                      className="flex-1 text-left min-w-0 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Webhook className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {eventTypeName}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(webhook.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={webhook.processing_status} />
                      <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {webhook.processing_status}
                      </span>
                    </div>
                  </ListPanel.Row>
                );
              })}
            </ListPanel.Body>
          </ListPanel>
        )}
      </PageContent>
    </>
  );
}
