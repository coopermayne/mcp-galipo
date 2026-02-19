import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import { getIntakes, getIntakeCounts, updateIntake, syncIntakes } from '../api';
import { INTAKE_STATUS_COLORS, type IntakeStatusKey } from '../config/colors';
import { INTAKE_STATUSES } from '../types';
import type { Intake, IntakeStatus } from '../types';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
  X,
  Check,
  ArrowRight,
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

const SCREENING_STATUSES: IntakeStatus[] = ['New', 'Screened', 'Needs Follow-Up', 'Atty Review'];
const REJECT_STATUSES: IntakeStatus[] = ['Rejected', 'Rejection Sent'];
const RETAIN_STATUSES: IntakeStatus[] = ['Send Retainer', 'Retainer Sent', 'Retained'];

function PipelineStep({
  status,
  isActive,
  count,
  onClick,
}: {
  status: IntakeStatus;
  isActive: boolean;
  count?: number;
  onClick: () => void;
}) {
  const color = INTAKE_STATUS_COLORS[status as IntakeStatusKey] || INTAKE_STATUS_COLORS.New;

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
        isActive
          ? `${color.bg} ${color.text}`
          : 'text-text-muted hover:text-text hover:bg-bg-hover'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
          isActive ? '' : 'opacity-50 group-hover:opacity-80'
        }`}
        style={{
          backgroundColor: isActive ? 'currentColor' : undefined,
          border: isActive ? undefined : '1.5px solid currentColor',
        }}
      />
      {status}
      {count !== undefined && (
        <span className={`tabular-nums ${isActive ? 'opacity-80' : 'opacity-50'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

function PipelineTrack({
  statuses,
  value,
  counts,
  onChange,
}: {
  statuses: IntakeStatus[];
  value: string;
  counts?: Record<string, number>;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex items-center">
      {statuses.map((s, i) => (
        <div key={s} className="flex items-center">
          {i > 0 && (
            <ChevronRight className="w-3 h-3 text-text-muted/30 flex-shrink-0 -mx-0.5" />
          )}
          <PipelineStep
            status={s}
            isActive={value === s}
            count={counts?.[s] ?? 0}
            onClick={() => onChange(s)}
          />
        </div>
      ))}
    </div>
  );
}

function StatusPipeline({ value, onChange, counts }: { value: string; onChange: (s: string) => void; counts?: Record<string, number> }) {
  return (
    <div className="mb-5">
      {/* Screening row */}
      <PipelineTrack statuses={SCREENING_STATUSES} value={value} counts={counts} onChange={onChange} />

      {/* Outcome tracks — two branches from Atty Review */}
      <div className="flex items-stretch gap-0 ml-6 mt-0.5">
        {/* Fork connector lines */}
        <div className="flex flex-col items-center w-3 flex-shrink-0">
          <div className="w-px flex-1 bg-border/60" />
        </div>

        <div className="flex flex-col gap-0">
          {/* Reject track */}
          <div className="flex items-center gap-0">
            <div className="w-4 h-px bg-border/60 flex-shrink-0" />
            <span className="text-[9px] uppercase tracking-wider text-red-400/70 dark:text-red-500/50 font-semibold mr-0.5 flex-shrink-0">
              reject
            </span>
            <PipelineTrack statuses={REJECT_STATUSES} value={value} counts={counts} onChange={onChange} />
          </div>

          {/* Retain track */}
          <div className="flex items-center gap-0">
            <div className="w-4 h-px bg-border/60 flex-shrink-0" />
            <span className="text-[9px] uppercase tracking-wider text-green-500/70 dark:text-green-500/50 font-semibold mr-0.5 flex-shrink-0">
              retain
            </span>
            <PipelineTrack statuses={RETAIN_STATUSES} value={value} counts={counts} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>
  );
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

function StatusChangeModal({
  intakeName,
  fromStatus,
  toStatus,
  currentNotes,
  onSave,
  onClose,
}: {
  intakeName: string | null;
  fromStatus: IntakeStatus;
  toStatus: IntakeStatus;
  currentNotes: string | null;
  onSave: (notes: string | undefined) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(currentNotes || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fromColor = INTAKE_STATUS_COLORS[fromStatus as IntakeStatusKey] || INTAKE_STATUS_COLORS.New;
  const toColor = INTAKE_STATUS_COLORS[toStatus as IntakeStatusKey] || INTAKE_STATUS_COLORS.New;

  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  const hasChangedNotes = draft !== (currentNotes || '');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-bg-surface rounded-xl border border-border shadow-xl w-full max-w-md">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-text text-sm">
              {intakeName || 'Unknown'}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fromColor.bg} ${fromColor.text}`}>
                {fromStatus}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${toColor.bg} ${toColor.text}`}>
                {toStatus}
              </span>
            </div>
          </div>
          <div className="p-4">
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Add a note about this change <span className="text-text-muted/60">(optional)</span>
            </label>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Spoke with client, needs more info about accident..."
              className="w-full text-sm px-3 py-2 border border-border rounded-lg bg-bg-surface text-text resize-none placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  e.preventDefault();
                  onSave(hasChangedNotes ? draft : undefined);
                }
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(undefined)}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text bg-bg-hover rounded-lg transition-colors"
            >
              Skip Note
            </button>
            <button
              onClick={() => onSave(draft)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
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
  const [pendingChange, setPendingChange] = useState<{
    intake: Intake;
    newStatus: IntakeStatus;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['intakes', statusFilter],
    queryFn: () => getIntakes({ status: statusFilter || undefined, limit: 200 }),
  });

  const { data: counts } = useQuery({
    queryKey: ['intakes', 'counts'],
    queryFn: getIntakeCounts,
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

        {/* Pipeline filter */}
        <StatusPipeline value={statusFilter} onChange={setStatusFilter} counts={counts} />

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
                        onChange={(s) => setPendingChange({ intake, newStatus: s })}
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

      {/* Status Change + Notes Modal */}
      {pendingChange && (
        <StatusChangeModal
          intakeName={pendingChange.intake.name}
          fromStatus={pendingChange.intake.status}
          toStatus={pendingChange.newStatus}
          currentNotes={pendingChange.intake.notes}
          onSave={(notes) => {
            const payload: { id: number; status: IntakeStatus; notes?: string } = {
              id: pendingChange.intake.id,
              status: pendingChange.newStatus,
            };
            if (notes !== undefined) payload.notes = notes;
            updateMutation.mutate(payload);
            setPendingChange(null);
          }}
          onClose={() => setPendingChange(null)}
        />
      )}
    </>
  );
}
