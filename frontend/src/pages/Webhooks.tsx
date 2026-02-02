import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import { getWebhooks } from '../api';
import { FileText, ExternalLink, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

const COURTLISTENER_BASE = 'https://www.courtlistener.com';

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
  const date = new Date(dateStr + 'T00:00:00'); // Treat as local date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function extractCaseSlug(url: string): string | null {
  // Extract case slug from URL like /docket/70905406/28/guadalupe-vargas-v-county-of-san-bernardino/
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
  // Extract PACER case ID from filepath like recap/gov.uscourts.cacd.980378/gov.uscourts.cacd.980378.28.0.pdf
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

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + '...';
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
        title="CourtListener Docket Entries"
        subtitle="Incoming filings from subscribed cases"
      />

      <PageContent>
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : webhooks.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No docket entries received yet" />
          </ListPanel>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => {
              // Extract docket entry from payload
              const results = (webhook.payload?.payload as { results?: DocketEntry[] })?.results || [];
              const entry = results[0];

              if (!entry) {
                return (
                  <div
                    key={webhook.id}
                    className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                  >
                    <span className="text-slate-400 text-sm">Invalid webhook data</span>
                  </div>
                );
              }

              const firstDoc = entry.recap_documents?.[0];
              const caseSlug = firstDoc?.absolute_url ? extractCaseSlug(firstDoc.absolute_url) : null;
              const caseName = firstDoc?.absolute_url ? extractCaseName(firstDoc.absolute_url) : 'Unknown Case';
              const pacerCaseId = extractPacerCaseId(firstDoc?.filepath_local);
              const docketUrl = buildDocketUrl(entry.docket, caseSlug);

              const availableDocs = entry.recap_documents?.filter(d => d.is_available) || [];

              return (
                <div
                  key={webhook.id}
                  className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {pacerCaseId && (
                        <>
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {pacerCaseId}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                        </>
                      )}
                      <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                        Dkt #{entry.entry_number || '—'}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {caseName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(entry.date_filed)}
                      </span>
                      <StatusIcon status={webhook.processing_status} />
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                    {truncate(entry.description, 200)}
                  </p>

                  {/* Documents */}
                  {availableDocs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {availableDocs.map((doc) => (
                        <a
                          key={doc.id}
                          href={`${COURTLISTENER_BASE}${doc.absolute_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-xs text-slate-700 dark:text-slate-300 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="w-3 h-3" />
                          {doc.attachment_number
                            ? `Attachment ${doc.attachment_number}`
                            : doc.description || `Doc ${doc.document_number}`}
                          {doc.page_count && (
                            <span className="text-slate-400">({doc.page_count}p)</span>
                          )}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Footer with detail link */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/courtlistener/${webhook.id}`)}
                      className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      View full payload →
                    </button>
                    <a
                      href={docketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Full docket
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContent>
    </>
  );
}
