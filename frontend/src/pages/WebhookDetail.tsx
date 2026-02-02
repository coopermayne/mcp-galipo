import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { getWebhook, deleteWebhook, getWebhooks } from '../api';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, XCircle, Trash2, FileText, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';

const COURTLISTENER_BASE = 'https://www.courtlistener.com';

const EVENT_TYPE_NAMES: Record<number, string> = {
  1: 'Docket Alert',
  2: 'Search Alert',
  3: 'RECAP Fetch',
  4: 'Old Docket Alert',
  5: 'Pray and Pay',
};

interface RecapDocument {
  id: number;
  description: string;
  absolute_url: string;
  is_available: boolean;
  document_number: string;
  attachment_number?: number | null;
  page_count?: number;
  filepath_local?: string;
}

interface DocketEntry {
  id: number;
  docket: number;
  entry_number: number | null;
  date_filed: string;
  description: string;
  recap_documents: RecapDocument[];
}

function extractCaseSlug(url: string): string | null {
  const parts = url.split('/').filter(Boolean);
  if (parts.length >= 4) {
    return parts[3];
  }
  return null;
}

function extractCaseName(url: string): string {
  const slug = extractCaseSlug(url);
  if (slug) {
    return slug
      .replace(/-/g, ' ')
      .replace(/\bv\b/g, 'v.')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return 'Unknown Case';
}

function extractPacerCaseId(filepath: string | undefined): string | null {
  if (!filepath) return null;
  const match = filepath.match(/gov\.uscourts\.[a-z]+\.\d+/);
  return match ? match[0] : null;
}

function buildDocketUrl(docketId: number, caseSlug: string | null): string {
  if (caseSlug) {
    return `${COURTLISTENER_BASE}/docket/${docketId}/${caseSlug}/`;
  }
  return `${COURTLISTENER_BASE}/docket/${docketId}/`;
}

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
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['webhook', id],
    queryFn: () => getWebhook(Number(id)),
    enabled: !!id,
  });

  // Fetch all webhooks for j/k navigation
  const { data: webhooksData } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => getWebhooks({ limit: 100 }),
  });

  const webhookIds = webhooksData?.webhooks?.map((w: { id: number }) => w.id) || [];
  const currentIndex = webhookIds.indexOf(Number(id));

  const goToNext = useCallback(() => {
    if (currentIndex < webhookIds.length - 1) {
      navigate(`/courtlistener/${webhookIds[currentIndex + 1]}`);
    }
  }, [currentIndex, webhookIds, navigate]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      navigate(`/courtlistener/${webhookIds[currentIndex - 1]}`);
    }
  }, [currentIndex, webhookIds, navigate]);

  // j/k keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'j') {
        goToNext();
      } else if (e.key === 'k') {
        goToPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteWebhook(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      navigate('/courtlistener');
    },
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

  // Extract docket entry data
  const results = (webhook.payload?.payload as { results?: DocketEntry[] })?.results || [];
  const entry = results[0];
  const firstDoc = entry?.recap_documents?.[0];
  const caseSlug = firstDoc?.absolute_url ? extractCaseSlug(firstDoc.absolute_url) : null;
  const caseName = firstDoc?.absolute_url ? extractCaseName(firstDoc.absolute_url) : null;
  const pacerCaseId = extractPacerCaseId(firstDoc?.filepath_local);
  const docketUrl = entry ? buildDocketUrl(entry.docket, caseSlug) : null;

  return (
    <>
      <Header
        title={eventTypeName}
        subtitle={`Received ${formatDate(webhook.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            {/* Navigation buttons */}
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={goToPrevious}
                disabled={currentIndex <= 0}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous (k)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400 border-x border-slate-200 dark:border-slate-700">
                {currentIndex >= 0 ? `${currentIndex + 1}/${webhookIds.length}` : '—'}
              </span>
              <button
                onClick={goToNext}
                disabled={currentIndex >= webhookIds.length - 1}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next (j)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => navigate('/courtlistener')}
              className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
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
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</span>
                <p className="mt-1 text-sm font-mono text-slate-900 dark:text-slate-100">#{webhook.id}</p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Delete webhook"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                Are you sure you want to delete this webhook? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

        {/* Docket Entry Details */}
        {entry && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
            {/* Entry Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
                  {pacerCaseId && (
                    <span className="font-mono">{pacerCaseId}</span>
                  )}
                  {pacerCaseId && <span>·</span>}
                  <span>Dkt #{entry.entry_number || '—'}</span>
                  <span>·</span>
                  <span>{entry.date_filed}</span>
                </div>
                {caseName && (
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    {caseName}
                  </h3>
                )}
              </div>
              {docketUrl && (
                <a
                  href={docketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg text-sm hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                >
                  View Full Docket
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Description */}
            <div className="mb-4">
              <h4 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Description
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {entry.description}
              </p>
            </div>

            {/* Documents */}
            {entry.recap_documents && entry.recap_documents.length > 0 && (
              <div>
                <h4 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Documents ({entry.recap_documents.length})
                </h4>
                <div className="space-y-2">
                  {entry.recap_documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {doc.attachment_number
                              ? `Attachment ${doc.attachment_number}: ${doc.description}`
                              : doc.description || `Document ${doc.document_number}`}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {doc.page_count && `${doc.page_count} pages`}
                            {doc.page_count && !doc.is_available && ' · '}
                            {!doc.is_available && <span className="text-amber-600">Not available</span>}
                          </p>
                        </div>
                      </div>
                      {doc.is_available && (
                        <a
                          href={`${COURTLISTENER_BASE}${doc.absolute_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded text-sm text-slate-700 dark:text-slate-200 transition-colors flex-shrink-0"
                        >
                          <span>View PDF</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* Keyboard hint */}
        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">j</kbd> for next, <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">k</kbd> for previous
        </div>
      </PageContent>
    </>
  );
}
