import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import { MarkdownContent } from '../components/chat/MarkdownContent';
import { getIntakes, getIntakeCounts, getIntake, updateIntake, syncIntakes, /* analyzeIntakes, */ analyzeIntake, getIntakeActivity, getIntakeComments, addIntakeComment, markIntakeRead, getIntakeUnreadCounts } from '../api';
import { INTAKE_STATUS_COLORS, type IntakeStatusKey, getBadgeColorById } from '../config/colors';
import { INTAKE_STATUSES } from '../types';
import type { Intake, IntakeStatus, IntakeComment, IntakeActivity } from '../types';
import { useIntakeSSE } from '../hooks';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Calendar,
  X,
  Archive,
  Activity,
  Sparkles,
  Star,
  Send,
  MessageSquare,
  Pencil,
  Search,
  ClipboardList,
  Tag,
} from 'lucide-react';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateCompact(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function formatSubmitted(dateStr: string | null): { date: string; time: string; ago: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const ago = days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`;
  return { date, time, ago };
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntilDeadline(incidentDate: string | null, months: number): number | null {
  if (!incidentDate) return null;
  const d = new Date(incidentDate);
  const deadline = new Date(d);
  deadline.setMonth(deadline.getMonth() + months);
  return Math.ceil((deadline.getTime() - Date.now()) / 86400000);
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
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
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
            <ChevronRight className="w-4 h-4 text-text-muted/30 flex-shrink-0 -mx-0.5" />
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
            <span className="text-[10px] uppercase tracking-wider text-red-400/70 dark:text-red-500/50 font-semibold mr-0.5 flex-shrink-0">
              reject
            </span>
            <PipelineTrack statuses={REJECT_STATUSES} value={value} counts={counts} onChange={onChange} />
          </div>

          {/* Retain track */}
          <div className="flex items-center gap-0">
            <div className="w-4 h-px bg-border/60 flex-shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-green-500/70 dark:text-green-500/50 font-semibold mr-0.5 flex-shrink-0">
              retain
            </span>
            <PipelineTrack statuses={RETAIN_STATUSES} value={value} counts={counts} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

function StarRating({ rating, reasoning }: { rating: number | null; reasoning: string | null }) {
  if (rating === null) {
    return <span className="text-xs text-text-muted/40">{'\u2014'}</span>;
  }
  const shortReasoning = reasoning ? truncateWords(reasoning, 50) : null;
  return (
    <div className="relative group">
      <div className="flex items-center gap-px cursor-default">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i <= rating
                ? 'text-amber-400 fill-amber-400'
                : 'text-text-muted/20'
            }`}
          />
        ))}
      </div>
      {shortReasoning && (
        <div className="absolute z-30 top-full left-0 mt-1.5 hidden group-hover:block w-72">
          <div className="w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45 ml-3 -mb-1 relative z-10" />
          <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-lg leading-relaxed relative z-20">
            {shortReasoning}
          </div>
        </div>
      )}
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
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
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

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function CommentsPanel({
  intakeId,
  autoFocus = false,
}: {
  intakeId: number;
  autoFocus?: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(0);

  const { data: comments = [] } = useQuery({
    queryKey: ['intake-comments', intakeId],
    queryFn: () => getIntakeComments(intakeId),
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => addIntakeComment(intakeId, content),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['intake-comments', intakeId] });
      queryClient.invalidateQueries({ queryKey: ['intake-unread-counts'] });
    },
  });

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (comments.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = comments.length;
  }, [comments.length]);

  // Auto-focus comment input when requested
  useEffect(() => {
    if (autoFocus && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    addMutation.mutate(content);
  };

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider mb-2 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Comments
        {comments.length > 0 && (
          <span className="text-text-muted/50 font-normal">({comments.length})</span>
        )}
      </h4>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 min-h-0 mb-3 pr-1"
      >
        {comments.length === 0 ? (
          <p className="text-xs text-text-muted/50 text-center py-6">No comments yet</p>
        ) : (
          comments.map((comment: IntakeComment) => {
            if (comment.is_system) {
              return (
                <div key={comment.id} className="text-center py-1">
                  <span className="text-[11px] text-text-muted/60 italic">
                    {comment.content}
                  </span>
                  <span className="text-[10px] text-text-muted/40 ml-1.5">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                </div>
              );
            }

            const avatarColor = comment.user_id ? getBadgeColorById(comment.user_id) : getBadgeColorById(0);

            return (
              <div key={comment.id} className="group flex gap-2">
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColor.bg} ${avatarColor.text}`}
                >
                  {comment.user_initials || '??'}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-text">
                      {comment.user_first_name || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-text-muted/50">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 pt-2 border-t border-border">
        <textarea
          ref={commentInputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 text-sm px-3 py-2 border border-border rounded-lg bg-bg-surface text-text resize-none placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || addMutation.isPending}
          className="p-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Send (Cmd+Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DetailModal({
  intake,
  onClose,
  onSaveNotes,
  onStatusChange,
  autoFocusComments = false,
}: {
  intake: Intake;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  onStatusChange: (status: IntakeStatus) => void;
  autoFocusComments?: boolean;
}) {
  const queryClient = useQueryClient();
  const [notesDraft, setNotesDraft] = useState(intake.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const hasChangedNotes = notesDraft !== (intake.notes || '');

  // Set contentEditable text and place cursor at end when entering edit mode
  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.textContent = notesDraft;
      notesRef.current.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(notesRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark as read when modal opens
  useEffect(() => {
    markIntakeRead(intake.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['intake-unread-counts'] });
    });
  }, [intake.id, queryClient]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-bg-surface rounded-xl border border-border shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-text">{intake.name || 'Unknown'}</h3>
                <StatusBadge status={intake.status} onChange={onStatusChange} />
              </div>
              {(() => {
                const s = formatSubmitted(intake.submitted_on);
                return s ? <div className="text-xs text-text-muted mt-0.5">Submitted {s.date} ({s.ago})</div> : null;
              })()}
            </div>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left: details + notes */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto border-r border-border">
              {/* Contact */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Contact</h4>
                <div className="pl-5 space-y-2">
                  {intake.email && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Mail className="w-4 h-4 text-text-muted" />
                      <a href={`mailto:${intake.email}`} className="text-primary-600 hover:underline">{intake.email}</a>
                    </div>
                  )}
                  {intake.phone && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Phone className="w-4 h-4 text-text-muted" />
                      <a href={`tel:${intake.phone}`} className="text-primary-600 hover:underline">{formatPhone(intake.phone)}</a>
                    </div>
                  )}
                </div>
              </div>

              {/* Incident Details */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">Incident</h4>
                <div className="pl-5 space-y-2">
                  {intake.case_type && (
                    <div className="flex items-center gap-2 text-sm">
                      <Tag className="w-4 h-4 text-text-muted" />
                      <span className="text-text">{intake.case_type}</span>
                    </div>
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
              </div>

              {/* Notes — inline, click to edit */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">
                  Notes
                </h4>
                <div className="pl-5">
                  {editingNotes ? (
                    <>
                      <div
                        ref={notesRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setNotesDraft(e.currentTarget.textContent || '')}
                        className="text-sm text-text whitespace-pre-wrap outline-none border-l-2 border-primary-400 pl-3 py-1 min-h-[2em] focus:border-primary-500"
                        data-placeholder="Start typing notes..."
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        {hasChangedNotes ? (
                          <>
                            <button
                              onClick={() => { setNotesDraft(intake.notes || ''); setEditingNotes(false); }}
                              className="px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text transition-colors"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => { onSaveNotes(notesDraft); setEditingNotes(false); }}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
                            >
                              Save
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingNotes(false)}
                            className="px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text transition-colors"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div
                      onClick={() => setEditingNotes(true)}
                      className="text-sm text-text-secondary whitespace-pre-wrap cursor-pointer rounded-lg px-3 py-2 border border-dashed border-border hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors"
                    >
                      {notesDraft || <span className="text-text-muted/50 italic">Click to add notes...</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Analysis */}
              {(intake.ai_summary || intake.ai_rating) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">
                    AI Summary
                  </h4>
                  <div className="ml-1 pl-4 border-l-2 border-border">
                    {intake.ai_rating && (
                      <div className="flex items-center gap-2 mb-2">
                        <StarRating rating={intake.ai_rating} reasoning={intake.ai_rating_reasoning} />
                        <span className="text-xs text-text-muted">{intake.ai_rating}/5</span>
                      </div>
                    )}
                    {intake.ai_summary && (
                      <div className="text-sm text-text-secondary">
                        <MarkdownContent content={intake.ai_summary} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Client-submitted descriptions */}
              {intake.incident_description && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">
                    PC Incident Description
                  </h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap ml-1 pl-4 border-l-2 border-border">{intake.incident_description}</p>
                </div>
              )}
              {intake.injury_description && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold uppercase text-text-muted tracking-wider">
                    PC Injury Description
                  </h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap ml-1 pl-4 border-l-2 border-border">{intake.injury_description}</p>
                </div>
              )}

              {intake.disclaimer_accepted && (
                <div className="text-xs text-green-600">Disclaimer accepted</div>
              )}
            </div>

            {/* Right: comments */}
            <div className="w-96 p-4 overflow-y-auto flex flex-col">
              <CommentsPanel intakeId={intake.id} autoFocus={autoFocusComments} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusChip({ status, onClick }: { status: string; onClick?: () => void }) {
  const color = INTAKE_STATUS_COLORS[status as IntakeStatusKey] || INTAKE_STATUS_COLORS.New;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium leading-none ${color.bg} ${color.text} hover:opacity-80 transition-opacity`}
    >
      {status}
    </button>
  );
}

function ActivityContent({ content, onStatusClick }: { content: string; onStatusClick: (status: string) => void }) {
  // Parse "Name changed status from OldStatus to NewStatus"
  const match = content.match(/^(.+?) changed status from (.+?) to (.+)$/);
  if (!match) return <>{content}</>;
  const [, name, fromStatus, toStatus] = match;
  return (
    <>
      {name} changed status <StatusChip status={fromStatus} onClick={() => onStatusClick(fromStatus)} /> &rarr; <StatusChip status={toStatus} onClick={() => onStatusClick(toStatus)} />
    </>
  );
}

function ActivityModal({
  onClose,
  onSelectIntake,
  onStatusClick,
}: {
  onClose: () => void;
  onSelectIntake: (intakeId: number) => void;
  onStatusClick: (status: string) => void;
}) {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['intake-activity'],
    queryFn: () => getIntakeActivity(),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-bg-surface rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-text-muted" />
              <h3 className="font-semibold text-text">Recent Activity</h3>
            </div>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
            {isLoading ? (
              <p className="text-sm text-text-muted text-center py-8">Loading...</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No recent activity</p>
            ) : (
              activity.map((item: IntakeActivity) => {
                const avatarColor = item.user_id ? getBadgeColorById(item.user_id) : getBadgeColorById(0);
                return (
                  <div key={item.id} className="flex gap-2.5 py-2 group">
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColor.bg} ${avatarColor.text}`}
                    >
                      {item.user_initials || '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text leading-snug flex items-center flex-wrap gap-1">
                        <ActivityContent content={item.content} onStatusClick={onStatusClick} />
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <button
                          onClick={() => {
                            onClose();
                            onSelectIntake(item.intake_id);
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 hover:underline truncate max-w-[200px]"
                        >
                          {item.intake_name || `Intake #${item.intake_id}`}
                        </button>
                        <span className="text-[10px] text-text-muted/50">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function Intakes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('New');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [autoFocusComments, setAutoFocusComments] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  useIntakeSSE();

  const { data, isLoading } = useQuery({
    queryKey: ['intakes', statusFilter],
    queryFn: () => getIntakes({ status: statusFilter || undefined, limit: 200 }),
  });

  const { data: counts } = useQuery({
    queryKey: ['intakes', 'counts'],
    queryFn: getIntakeCounts,
  });

  const allIntakes: Intake[] = data?.intakes || [];

  const { data: selectedIntake } = useQuery({
    queryKey: ['intake', selectedIntakeId],
    queryFn: () => getIntake(selectedIntakeId!),
    enabled: selectedIntakeId != null,
  });

  const intakes = searchQuery
    ? allIntakes.filter((i) => {
        const q = searchQuery.toLowerCase();
        const qDigits = searchQuery.replace(/\D/g, '');
        return (
          i.name?.toLowerCase().includes(q) ||
          i.email?.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && i.phone?.replace(/\D/g, '').includes(qDigits)) ||
          i.incident_description?.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q)
        );
      })
    : allIntakes;
  const intakeIds = intakes.map((i) => i.id);

  const { data: unreadCounts } = useQuery({
    queryKey: ['intake-unread-counts', intakeIds.join(',')],
    queryFn: () => getIntakeUnreadCounts(intakeIds),
    enabled: intakeIds.length > 0,
  });

  const syncMutation = useMutation({
    mutationFn: syncIntakes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
    },
  });

  // const analyzeMutation = useMutation({
  //   mutationFn: () => analyzeIntakes(20),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['intakes'] });
  //   },
  // });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: IntakeStatus; notes?: string }) =>
      updateIntake(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
      queryClient.invalidateQueries({ queryKey: ['intake', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['intake-unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['intake-comments'] });
      queryClient.invalidateQueries({ queryKey: ['intake-activity'] });
    },
  });

  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const analyzeSingleMutation = useMutation({
    mutationFn: (intakeId: number) => analyzeIntake(intakeId),
    onMutate: (intakeId) => setAnalyzingId(intakeId),
    onSettled: () => setAnalyzingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
    },
  });

  const total = data?.total || 0;

  return (
    <>
      <Header
        title="Intake"
        subtitle={`${total} lead${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowActivity(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text bg-bg-hover hover:bg-bg-surface border border-border rounded-lg transition-colors"
              title="View recent activity"
            >
              <Activity className="w-4 h-4" />
              Activity
            </button>
            <Link
              to="/intakes/archived"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text bg-bg-hover hover:bg-bg-surface border border-border rounded-lg transition-colors"
              title="View archived leads"
            >
              <Archive className="w-4 h-4" />
              Archive
            </Link>
            {/* <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text bg-bg-hover hover:bg-bg-surface border border-border rounded-lg transition-colors disabled:opacity-50"
              title="Run AI analysis on unanalyzed leads"
            >
              <Sparkles className={`w-4 h-4 ${analyzeMutation.isPending ? 'animate-pulse' : ''}`} />
              {analyzeMutation.isPending ? 'Analyzing...' : 'AI Analyze'}
            </button> */}
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync'}
            </button>
          </div>
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

        {/* {analyzeMutation.isSuccess && analyzeMutation.data && (
          <div className="mb-4 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm text-purple-700 dark:text-purple-300 flex items-center justify-between">
            <span>
              Analyzed {analyzeMutation.data.analyzed} lead{analyzeMutation.data.analyzed !== 1 ? 's' : ''}.
              {analyzeMutation.data.errors > 0 && ` ${analyzeMutation.data.errors} failed.`}
            </span>
            <button onClick={() => analyzeMutation.reset()} className="text-purple-500 hover:text-purple-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {analyzeMutation.isError && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
            <span>Analysis failed: {(analyzeMutation.error as Error)?.message || 'Unknown error'}</span>
            <button onClick={() => analyzeMutation.reset()} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )} */}

        {/* Pipeline filter */}
        <StatusPipeline value={statusFilter} onChange={(s) => { setStatusFilter(s); setSearchQuery(''); }} counts={counts} />

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, description, notes..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-bg-surface text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted/50 hover:text-text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
                <tr className="bg-bg-hover/50">
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[90px]">Submitted</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[140px]">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[120px]">Case Type</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[80px]">DOI</th>
                  <th className="text-center px-2 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[90px]">6mo/2yr</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider">AI Summary</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[110px]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-text-muted text-xs uppercase tracking-wider w-[100px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {intakes.map((intake, idx) => {
                  const unread = unreadCounts?.[String(intake.id)] ?? 0;
                  return (
                    <tr
                      key={intake.id}
                      onClick={() => { setAutoFocusComments(false); setSelectedIntakeId(intake.id); }}
                      className={`hover:bg-bg-hover transition-colors cursor-pointer ${idx > 0 ? 'border-t border-border' : ''}`}
                    >
                      <td className="px-4 py-3 text-text text-xs whitespace-nowrap">
                        {(() => {
                          const s = formatSubmitted(intake.submitted_on);
                          if (!s) return '—';
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span>{s.date} ({s.ago})</span>
                              <span className="text-text-muted">{s.time}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-text text-xs">
                            {intake.name || '\u2014'}
                          </span>
                          <UnreadBadge count={unread} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text text-xs">
                        {intake.case_type || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-text text-xs whitespace-nowrap">
                        {formatDateCompact(intake.incident_date)}
                      </td>
                      {(() => {
                        const days6 = daysUntilDeadline(intake.incident_date, 6);
                        const days24 = daysUntilDeadline(intake.incident_date, 24)!;
                        return (
                          <>
                            <td className="px-2 py-3 text-center whitespace-nowrap">
                              {days6 === null ? (
                                <span className="text-xs text-text-muted/40">{'\u2014'}</span>
                              ) : (
                                <>
                                  <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded ${
                                    days6 < 0 ? 'bg-red-500/20 text-red-400' : days6 <= 30 ? 'bg-yellow-500/20 text-yellow-400' : 'text-text'
                                  }`}>
                                    {days6}
                                  </span>
                                  <span className="text-text mx-0.5">/</span>
                                  <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded ${
                                    days24 < 0 ? 'bg-red-500/20 text-red-400' : days24 <= 30 ? 'bg-yellow-500/20 text-yellow-400' : 'text-text'
                                  }`}>
                                    {days24}
                                  </span>
                                </>
                              )}
                            </td>
                          </>
                        );
                      })()}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          {analyzingId === intake.id ? (
                            <span className="text-xs text-purple-500 italic flex items-center gap-1.5 flex-1">
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              Analyzing...
                            </span>
                          ) : (
                            <span
                              className="text-xs text-text line-clamp-3 flex-1"
                              title={intake.ai_summary || ''}
                            >
                              {intake.ai_summary || '\u2014'}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); analyzeSingleMutation.mutate(intake.id); }}
                            disabled={analyzingId === intake.id}
                            className="flex-shrink-0 p-1 text-text-muted/40 hover:text-purple-500 transition-colors disabled:opacity-50"
                            title={intake.ai_summary ? 'Regenerate AI analysis' : 'Generate AI analysis'}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${analyzingId === intake.id ? 'animate-pulse text-purple-500' : ''}`} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge
                          status={intake.status}
                          onChange={(s) => {
                            updateMutation.mutate({ id: intake.id, status: s });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text truncate max-w-[200px] block">
                          {intake.notes || '\u2014'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageContent>

      {/* Detail Modal */}
      {selectedIntake && (
        <DetailModal
          intake={selectedIntake}
          onClose={() => { setSelectedIntakeId(null); setAutoFocusComments(false); }}
          onSaveNotes={(notes) => updateMutation.mutate({ id: selectedIntake.id, notes })}
          onStatusChange={(s) => updateMutation.mutate({ id: selectedIntake.id, status: s })}
          autoFocusComments={autoFocusComments}
        />
      )}

      {/* Activity Modal */}
      {showActivity && (
        <ActivityModal
          onClose={() => setShowActivity(false)}
          onSelectIntake={(id) => { setAutoFocusComments(false); setSelectedIntakeId(id); }}
          onStatusClick={(s) => { setStatusFilter(s); setShowActivity(false); }}
        />
      )}
    </>
  );
}
