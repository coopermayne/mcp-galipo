import { useState, useCallback, useEffect, useMemo } from 'react';
import { List, FileText, FileDown, Loader2, Check } from 'lucide-react';
import { Header, PageContent } from '../../components/layout';
import { exportCaseListPdf, exportCaseListDocx, getCases, getAttorneys } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getStatusColor } from '../../config/colors';
import type { CaseSummary } from '../../types';
import type { AttorneyRef } from '../../api';

type CaseFilter = 'mine' | 'all';

export function CaseList() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | null>(null);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('mine');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [attorneys, setAttorneys] = useState<AttorneyRef[]>([]);

  // Fetch attorneys
  useEffect(() => {
    getAttorneys().then(setAttorneys).catch(() => {});
  }, []);

  // Fetch cases for preview
  useEffect(() => {
    setLoading(true);
    const params: { attorney_ids?: number[]; status?: string } = {};
    if (caseFilter === 'mine' && user?.id) {
      params.attorney_ids = [user.id];
    }
    getCases(params)
      .then((res) => setCases(res.cases))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [caseFilter, user?.id]);

  const filteredCases = useMemo(() => {
    if (includeClosed) return cases;
    return cases.filter((c) => c.status !== 'Closed');
  }, [cases, includeClosed]);

  // Group by status for the summary
  const statusGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const c of filteredCases) {
      groups[c.status] = (groups[c.status] || 0) + 1;
    }
    return Object.entries(groups).sort(([, a], [, b]) => b - a);
  }, [filteredCases]);

  const handleExport = useCallback(async (format: 'pdf' | 'docx') => {
    setIsExporting(true);
    setExportFormat(format);
    try {
      if (format === 'docx') {
        await exportCaseListDocx();
      } else {
        await exportCaseListPdf();
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, []);

  const currentAttorney = useMemo(
    () => attorneys.find((a) => a.id === user?.id),
    [attorneys, user?.id]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="Case List" subtitle="Export your caseload as PDF or DOCX" />

      <PageContent variant="full" className="space-y-4 scrollbar-hide">
        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Case filter */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setCaseFilter('mine')}
              className={`px-3 py-1.5 font-medium transition-colors ${
                caseFilter === 'mine'
                  ? 'bg-primary-600 text-white'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              }`}
            >
              My Cases
            </button>
            <button
              onClick={() => setCaseFilter('all')}
              className={`px-3 py-1.5 font-medium transition-colors ${
                caseFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              }`}
            >
              All Cases
            </button>
          </div>

          {/* Include closed toggle */}
          <button
            onClick={() => setIncludeClosed(!includeClosed)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-border rounded-lg bg-bg-surface text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <span className={`
              w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
              ${includeClosed
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-current'
              }
            `}>
              {includeClosed && <Check className="w-2.5 h-2.5" />}
            </span>
            Include Closed
          </button>

          <div className="flex-1" />

          {/* Export buttons */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={isExporting || filteredCases.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg bg-bg-surface text-text hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting && exportFormat === 'pdf' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-red-500" />
            )}
            Export PDF
          </button>
          <button
            onClick={() => handleExport('docx')}
            disabled={isExporting || filteredCases.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting && exportFormat === 'docx' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Export DOCX
          </button>
        </div>

        {/* Summary card */}
        <section className="bg-bg-surface rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-bg-hover/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <h2 className="text-sm font-semibold text-text">
                {loading ? 'Loading...' : `${filteredCases.length} cases`}
              </h2>
              {caseFilter === 'mine' && currentAttorney && (
                <span className="text-xs text-text-muted">
                  for {currentAttorney.firstName} {currentAttorney.lastName}
                </span>
              )}
            </div>
            {!includeClosed && cases.length !== filteredCases.length && (
              <span className="text-xs text-text-muted">
                {cases.length - filteredCases.length} closed hidden
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-text-muted">No cases found</p>
            </div>
          ) : (
            <>
              {/* Status breakdown chips */}
              <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-border">
                {statusGroups.map(([status, count]) => {
                  const color = getStatusColor(status);
                  return (
                    <span
                      key={status}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text}`}
                    >
                      {status}
                      <span className="opacity-70">{count}</span>
                    </span>
                  );
                })}
              </div>

              {/* Case table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                      <th className="px-4 py-2">Case Name</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Short Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((c) => {
                      const color = getStatusColor(c.status);
                      return (
                        <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-bg-hover/50 transition-colors">
                          <td className="px-4 py-2 font-medium text-text">{c.case_name}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-text-muted">{c.short_name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Info note */}
        <p className="text-xs text-text-muted px-1">
          The exported document includes full case details — parties, counsel, events, tasks, and notes — grouped by status phase.
          {caseFilter === 'mine' ? ' DOCX exports are filtered to your assigned cases.' : ''}
        </p>
      </PageContent>
    </div>
  );
}
