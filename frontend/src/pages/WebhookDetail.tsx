import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { getWebhook } from '../api';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

const EVENT_TYPE_NAMES: Record<number, string> = {
  1: 'Docket Alert',
  2: 'Search Alert',
  3: 'RECAP Fetch',
  4: 'Old Docket Alert',
  5: 'Pray and Pay',
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    pending: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  };

  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="w-3.5 h-3.5" />,
    processing: <Clock className="w-3.5 h-3.5 animate-spin" />,
    failed: <XCircle className="w-3.5 h-3.5" />,
    pending: <AlertCircle className="w-3.5 h-3.5" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {icons[status]}
      {status}
    </span>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function WebhookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['webhook', id],
    queryFn: () => getWebhook(Number(id)),
    enabled: !!id,
  });

  const webhook = data?.webhook;

  if (isLoading) {
    return (
      <>
        <Header title="Loading..." />
        <PageContent>
          <div className="flex items-center justify-center h-64">
            <Clock className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        </PageContent>
      </>
    );
  }

  if (error || !webhook) {
    return (
      <>
        <Header title="Webhook Not Found" />
        <PageContent>
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">Could not load webhook</p>
            <button
              onClick={() => navigate('/courtlistener')}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              Back to list
            </button>
          </div>
        </PageContent>
      </>
    );
  }

  const webhookMeta = webhook.payload?.webhook as Record<string, unknown> | undefined;
  const eventType = webhookMeta?.event_type;
  const eventTypeName = eventType ? EVENT_TYPE_NAMES[eventType as number] || `Type ${eventType}` : 'Unknown';

  return (
    <>
      <Header
        title={eventTypeName}
        subtitle={`Received ${formatDate(webhook.created_at)}`}
        actions={
          <button
            onClick={() => navigate('/courtlistener')}
            className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        }
      />

      <PageContent>
        {/* Metadata */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</span>
              <div className="mt-1">
                <StatusBadge status={webhook.processing_status} />
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Source</span>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{webhook.source}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Event Type</span>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{eventTypeName}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</span>
              <p className="mt-1 text-sm font-mono text-slate-900 dark:text-slate-100">#{webhook.id}</p>
            </div>
          </div>

          {webhook.processing_error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <span className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider">Error</span>
              <p className="mt-1 text-sm text-red-800 dark:text-red-200">{webhook.processing_error}</p>
            </div>
          )}

          {webhook.idempotency_key && (
            <div className="mt-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Idempotency Key</span>
              <p className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-400 break-all">{webhook.idempotency_key}</p>
            </div>
          )}
        </div>

        {/* Full Payload */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Full Payload</h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
              {JSON.stringify(webhook.payload, null, 2)}
            </pre>
          </div>
        </div>

        {/* Headers */}
        {webhook.headers && Object.keys(webhook.headers).length > 0 && (
          <div className="mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Headers</h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                {JSON.stringify(webhook.headers, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </PageContent>
    </>
  );
}
