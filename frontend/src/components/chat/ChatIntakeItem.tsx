/**
 * ChatIntakeItem - Interactive intake display for chat context
 *
 * Two modes:
 * - ChatIntakeItem: Green success card for created intakes (fetches from DB)
 * - ChatIntakePreview: Yellow/amber card showing gathered fields (no DB fetch)
 */
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Calendar,
  Tag,
  FileText,
  User,
  ExternalLink,
  Star,
  Sparkles,
} from 'lucide-react';
import { getIntake } from '../../api';
import type { Intake } from '../../types';

export interface ChatIntakeItemProps {
  intakeId: number;
  isNew?: boolean;
}

function StarRatingInline({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-px">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i <= rating
              ? 'text-amber-400 fill-amber-400'
              : 'text-text-muted/20'
          }`}
        />
      ))}
      <span className="text-xs text-text-muted ml-1">{rating}/5</span>
    </div>
  );
}

export function ChatIntakeItem({ intakeId, isNew = true }: ChatIntakeItemProps) {
  const { data: intake, isLoading, isError } = useQuery({
    queryKey: ['intake', intakeId],
    queryFn: () => getIntake(intakeId),
    staleTime: 30_000,
    refetchInterval: (query) => {
      // Poll while AI is analyzing, stop once done
      const data = query.state.data as Intake | undefined;
      return data?.ai_analyzing ? 3000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-bg-surface p-3 flex items-center gap-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Loading intake...</span>
      </div>
    );
  }

  if (isError || !intake) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-xs text-red-600 dark:text-red-400">Failed to load intake #{intakeId}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
      {/* Success header */}
      {isNew && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            Intake created
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Name */}
        <p className="text-sm font-medium text-text leading-snug">
          {intake.name || 'Unknown'}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-3 flex-wrap">
          {intake.case_type && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Tag className="w-3 h-3 flex-shrink-0" />
              {intake.case_type}
            </span>
          )}
          {intake.phone && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Phone className="w-3 h-3 flex-shrink-0" />
              {intake.phone}
            </span>
          )}
          {intake.incident_date && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              {new Date(intake.incident_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* AI analysis status */}
        {intake.ai_analyzing ? (
          <div className="flex items-center gap-1.5 text-xs text-purple-500">
            <Sparkles className="w-3 h-3 animate-spin" />
            <span>AI analyzing...</span>
          </div>
        ) : intake.ai_rating ? (
          <StarRatingInline rating={intake.ai_rating} />
        ) : null}

        {/* View link */}
        <a
          href={`/intakes?selected=${intakeId}`}
          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1"
        >
          <ExternalLink className="w-3 h-3" />
          View in Intakes
        </a>
      </div>
    </div>
  );
}

// ---- Preview card (yellow/amber) ----

export interface ChatIntakePreviewProps {
  fields: Record<string, unknown>;
}

const PREVIEW_FIELDS: { key: string; label: string; icon: typeof User }[] = [
  { key: 'name', label: 'Name', icon: User },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'case_type', label: 'Case Type', icon: Tag },
  { key: 'incident_date', label: 'Incident Date', icon: Calendar },
  { key: 'incident_description', label: 'Description', icon: FileText },
];

export function ChatIntakePreview({ fields }: ChatIntakePreviewProps) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-bg-surface overflow-hidden">
      {/* Amber header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Gathering intake info...
        </span>
      </div>

      {/* Fields */}
      <div className="p-3 space-y-1.5">
        {PREVIEW_FIELDS.map(({ key, label, icon: Icon }) => {
          const value = fields[key];
          const hasValue = value !== undefined && value !== null && value !== '';
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <Icon className={`w-3 h-3 flex-shrink-0 ${hasValue ? 'text-text-muted' : 'text-text-muted/30'}`} />
              <span className={hasValue ? 'text-text' : 'text-text-muted/30 italic'}>
                {hasValue ? String(value) : label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
