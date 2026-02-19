import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import { getIntakes } from '../api';
import type { Intake } from '../types';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MapPin,
  X,
} from 'lucide-react';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function DetailModal({ intake, onClose }: { intake: Intake; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-text">{intake.name || 'Unknown'}</h3>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Contact</h4>
              {intake.email && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <a href={`mailto:${intake.email}`} className="text-primary-600 hover:underline">{intake.email}</a>
                </div>
              )}
              {intake.phone && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Phone className="w-4 h-4 text-text-muted" />
                  <a href={`tel:${intake.phone}`} className="text-primary-600 hover:underline">{intake.phone}</a>
                </div>
              )}
            </div>
            {intake.case_type && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Incident</h4>
                <div className="text-sm"><span className="text-text-muted">Type:</span> <span className="text-text">{intake.case_type}</span></div>
                {intake.incident_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-text-muted" />
                    <span className="text-text">{formatDate(intake.incident_date)}</span>
                  </div>
                )}
                {intake.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-text-muted" />
                    <span className="text-text">{intake.location}</span>
                  </div>
                )}
              </div>
            )}
            {intake.incident_description && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Incident Description</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{intake.incident_description}</p>
              </div>
            )}
            {intake.notes && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Notes</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{intake.notes}</p>
              </div>
            )}
            <div className="pt-2 border-t border-border text-xs text-text-muted space-y-1">
              <div>Submitted: {formatDateTime(intake.submitted_on)}</div>
              <div>Imported: {formatDateTime(intake.created_at)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ArchivedIntakes() {
  const [selectedIntake, setSelectedIntake] = useState<Intake | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['intakes', 'Archived'],
    queryFn: () => getIntakes({ status: 'Archived', limit: 2000 }),
  });

  const intakes = data?.intakes || [];
  const total = data?.total || 0;

  return (
    <>
      <Header
        title="Archived Leads"
        subtitle={`${total} archived`}
        actions={
          <Link
            to="/intakes"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text bg-bg-hover hover:bg-bg-surface border border-border rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Intake
          </Link>
        }
      />

      <PageContent>
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : intakes.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No archived leads" />
          </ListPanel>
        ) : (
          <div className="bg-bg-surface rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-hover/50">
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Case Type</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Incident Date</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {intakes.map((intake) => (
                  <tr
                    key={intake.id}
                    className="hover:bg-bg-hover/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedIntake(intake)}
                        className="font-medium text-text hover:text-primary-600 text-left"
                      >
                        {intake.name || '—'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {intake.email && (
                          <span className="text-xs text-text-muted truncate max-w-[160px]" title={intake.email}>
                            {intake.email}
                          </span>
                        )}
                        {intake.phone && (
                          <span className="text-xs text-text-muted">{intake.phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {intake.case_type || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {formatDate(intake.incident_date)}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                      {formatDate(intake.submitted_on)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>

      {selectedIntake && (
        <DetailModal
          intake={selectedIntake}
          onClose={() => setSelectedIntake(null)}
        />
      )}
    </>
  );
}
