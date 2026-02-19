import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import { getIntakes, updateIntake, syncIntakes } from '../api';
import { INTAKE_STATUS_COLORS, type IntakeStatusKey } from '../config/colors';
import { INTAKE_STATUSES } from '../types';
import type { Intake, IntakeStatus } from '../types';
import {
  RefreshCw,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Calendar,
  X,
  Check,
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

function StatusBadge({ status, onChange }: { status: IntakeStatus; onChange: (s: IntakeStatus) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const color = INTAKE_STATUS_COLORS[status as IntakeStatusKey] || INTAKE_STATUS_COLORS.New;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text} hover:opacity-80 transition-opacity`}
      >
        {status}
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 bg-bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
            {INTAKE_STATUSES.map((s) => {
              const c = INTAKE_STATUS_COLORS[s as IntakeStatusKey];
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover flex items-center gap-2 ${
                    s === status ? 'font-semibold' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.bg}`} />
                  <span className={s === status ? c.text : 'text-text'}>{s}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function InlineNotes({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (notes: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  if (!isEditing) {
    return (
      <button
        onClick={() => { setDraft(value || ''); setIsEditing(true); }}
        className="text-xs text-left text-text-muted hover:text-text truncate max-w-[200px] block"
        title={value || 'Click to add notes'}
      >
        {value || '—'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-48 text-xs px-2 py-1 border border-border rounded bg-bg-surface text-text resize-none"
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave(draft);
            setIsEditing(false);
          }
          if (e.key === 'Escape') setIsEditing(false);
        }}
      />
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => { onSave(draft); setIsEditing(false); }}
          className="p-0.5 text-green-600 hover:text-green-700"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="p-0.5 text-text-muted hover:text-text"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
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
            {/* Contact */}
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

            {/* Incident Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Incident</h4>
              {intake.case_type && (
                <div className="text-sm"><span className="text-text-muted">Type:</span> <span className="text-text">{intake.case_type}</span></div>
              )}
              {intake.incident_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <span className="text-text">{formatDate(intake.incident_date)}</span>
                  {intake.incident_time && <span className="text-text-muted">at {intake.incident_time}</span>}
                </div>
              )}
              {intake.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-text-muted" />
                  <span className="text-text">{intake.location}</span>
                </div>
              )}
            </div>

            {/* Descriptions */}
            {intake.incident_description && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Incident Description</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{intake.incident_description}</p>
              </div>
            )}
            {intake.injury_description && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Injury Description</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{intake.injury_description}</p>
              </div>
            )}

            {/* Notes */}
            {intake.notes && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Notes</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{intake.notes}</p>
              </div>
            )}

            {/* Meta */}
            <div className="pt-2 border-t border-border text-xs text-text-muted space-y-1">
              <div>Submitted: {formatDateTime(intake.submitted_on)}</div>
              <div>Imported: {formatDateTime(intake.created_at)}</div>
              {intake.disclaimer_accepted && <div className="text-green-600">Disclaimer accepted</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Intakes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('New');
  const [selectedIntake, setSelectedIntake] = useState<Intake | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['intakes', statusFilter],
    queryFn: () => getIntakes({ status: statusFilter || undefined, limit: 200 }),
  });

  const syncMutation = useMutation({
    mutationFn: syncIntakes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: IntakeStatus; notes?: string }) =>
      updateIntake(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
    },
  });

  const intakes = data?.intakes || [];
  const total = data?.total || 0;

  return (
    <>
      <Header
        title="Intake"
        subtitle={`${total} lead${total !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync from Google Sheets'}
          </button>
        }
      />

      <PageContent>
        {/* Sync result toast */}
        {syncMutation.isSuccess && syncMutation.data && (
          <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300 flex items-center justify-between">
            <span>
              Imported {syncMutation.data.imported} new lead{syncMutation.data.imported !== 1 ? 's' : ''}.
              {syncMutation.data.skipped > 0 && ` ${syncMutation.data.skipped} already existed.`}
            </span>
            <button onClick={() => syncMutation.reset()} className="text-green-500 hover:text-green-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {syncMutation.isError && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
            <span>Sync failed: {(syncMutation.error as Error)?.message || 'Unknown error'}</span>
            <button onClick={() => syncMutation.reset()} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="mb-4 flex items-center gap-1 flex-wrap">
          {INTAKE_STATUSES.map((s) => {
            const c = INTAKE_STATUS_COLORS[s as IntakeStatusKey];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === s
                    ? `${c.bg} ${c.text}`
                    : 'bg-bg-hover text-text-secondary hover:text-text'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Table */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : intakes.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty
              message={`No leads with status "${statusFilter}"`}
            />
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
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">Notes</th>
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
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={intake.status}
                        onChange={(s) => updateMutation.mutate({ id: intake.id, status: s })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <InlineNotes
                        value={intake.notes}
                        onSave={(notes) => updateMutation.mutate({ id: intake.id, notes })}
                      />
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

      {/* Detail Modal */}
      {selectedIntake && (
        <DetailModal
          intake={selectedIntake}
          onClose={() => setSelectedIntake(null)}
        />
      )}
    </>
  );
}
