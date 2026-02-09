import { useQuery } from '@tanstack/react-query';
import {
  Building,
  Phone,
  Mail,
  FileText,
  X,
  Loader2,
  AlertCircle,
  Gavel,
  ExternalLink,
  Scale,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getJudge } from '../../api';

interface JudgeDetailContentProps {
  entityId: number;
  context?: {
    readOnly?: boolean;
  };
  onClose: () => void;
}

export function JudgeDetailContent({ entityId, onClose }: JudgeDetailContentProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['judge', entityId],
    queryFn: () => getJudge(entityId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !data?.judge) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Failed to load judge details</p>
      </div>
    );
  }

  const judge = data.judge;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Gavel className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-text">
            {judge.name}
          </h2>
          {judge.status && judge.status !== 'Active' && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-bg-hover text-text-secondary">
              {judge.status}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Court Details */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Building className="w-4 h-4 text-text-muted" />
          Court Details
        </h3>
        <div className="space-y-3 pl-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Jurisdiction:</span>
            <span className={judge.jurisdiction_name ? 'text-text-secondary' : 'text-text-muted italic'}>
              {judge.jurisdiction_name || 'Not specified'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Title:</span>
            <span className={judge.title ? 'text-text-secondary' : 'text-text-muted italic'}>
              {judge.title || 'Not specified'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Chambers:</span>
            <span className={judge.chambers ? 'text-text-secondary' : 'text-text-muted italic'}>
              {judge.chambers || 'Not specified'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted w-24 shrink-0">Courtroom:</span>
            <span className={judge.courtroom_number ? 'text-text-secondary' : 'text-text-muted italic'}>
              {judge.courtroom_number || 'Not specified'}
            </span>
          </div>
          {judge.initials && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-muted w-24 shrink-0">Initials:</span>
              <span className="text-text-secondary">{judge.initials}</span>
            </div>
          )}
          {judge.appointed_by && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-muted w-24 shrink-0">Appointed By:</span>
              <span className="text-text-secondary">{judge.appointed_by}</span>
            </div>
          )}
        </div>
      </div>

      {/* Contact Info - only show if there's data */}
      {((judge.phones && judge.phones.length > 0) || (judge.emails && judge.emails.length > 0)) && (
        <div className="space-y-4 mb-6">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <Phone className="w-4 h-4 text-text-muted" />
            Contact Information
          </h3>
          <div className="space-y-3 pl-6">
            {judge.phones && judge.phones.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
                  <Phone className="w-3 h-3" />
                  Phone
                </div>
                {judge.phones.map((p: { value: string; label?: string }, i: number) => (
                  <div key={i} className="text-sm text-text-secondary">
                    {p.value}{p.label && <span className="text-text-muted ml-1">({p.label})</span>}
                  </div>
                ))}
              </div>
            )}
            {judge.emails && judge.emails.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
                {judge.emails.map((e: { value: string; label?: string }, i: number) => (
                  <div key={i} className="text-sm text-text-secondary">
                    {e.value}{e.label && <span className="text-text-muted ml-1">({e.label})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes - only show if there's data */}
      {judge.notes && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-text-muted" />
            Notes
          </h3>
          <p className="text-sm text-text-secondary pl-6 whitespace-pre-wrap">{judge.notes}</p>
        </div>
      )}

      {/* Proceeding Assignments */}
      {judge.proceedings && judge.proceedings.length > 0 && (
        <div className="pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-text-muted" />
            Assigned to ({judge.proceedings.length} proceeding{judge.proceedings.length !== 1 ? 's' : ''})
          </h3>
          <div className="space-y-2 pl-6">
            {judge.proceedings.map((proceeding) => (
              <Link
                key={proceeding.proceeding_id}
                to={`/cases/${proceeding.case_id}`}
                onClick={onClose}
                className="flex items-center justify-between p-2 bg-bg-hover rounded text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group"
              >
                <div className="min-w-0">
                  <span className="font-medium text-blue-600 dark:text-blue-400 group-hover:underline truncate block">
                    {proceeding.case_name}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {proceeding.case_number} · {proceeding.role}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Edit link */}
      <div className="mt-6 pt-6 border-t border-border">
        <Link
          to="/persons"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Edit judge details on Persons page
        </Link>
      </div>
    </div>
  );
}
