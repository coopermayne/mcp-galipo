/**
 * MergeDuplicatesModal - Multi-step modal for finding and merging duplicate persons
 *
 * Step 1: List of duplicate groups detected by the backend
 * Step 2: Side-by-side merge resolution for a selected pair
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Merge,
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  FileText,
  Briefcase,
  ArrowRightLeft,
} from 'lucide-react';
import { getDuplicatePersons, getMergePreview, mergePersons } from '../../api';
import type { Person } from '../../types';
import type { DuplicateGroup } from '../../api';

interface MergeDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'list' | 'resolve';

export function MergeDuplicatesModal({ isOpen, onClose }: MergeDuplicatesModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('list');
  const [selectedPair, setSelectedPair] = useState<{ primaryId: number; secondaryId: number } | null>(null);
  const [fieldResolutions, setFieldResolutions] = useState<Record<string, string>>({});
  const [mergeResult, setMergeResult] = useState<{ merged: number; failed: number } | null>(null);

  const { data: duplicatesData, isLoading: loadingDuplicates, refetch: refetchDuplicates } = useQuery({
    queryKey: ['person-duplicates'],
    queryFn: getDuplicatePersons,
    enabled: isOpen,
  });

  const { data: previewData, isLoading: loadingPreview } = useQuery({
    queryKey: ['merge-preview', selectedPair?.primaryId, selectedPair?.secondaryId],
    queryFn: () => getMergePreview(selectedPair!.primaryId, selectedPair!.secondaryId),
    enabled: !!selectedPair && step === 'resolve',
  });

  const mergeMutation = useMutation({
    mutationFn: ({ primaryId, secondaryId, resolutions }: {
      primaryId: number;
      secondaryId: number;
      resolutions: Record<string, string>;
    }) => mergePersons(primaryId, secondaryId, resolutions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person-duplicates'] });
      refetchDuplicates();
      setStep('list');
      setSelectedPair(null);
      setFieldResolutions({});
    },
  });

  // Merge all persons in a single group into persons[0]
  const mergeGroupMutation = useMutation({
    mutationFn: async (persons: Person[]) => {
      const primaryId = persons[0].id;
      for (let i = 1; i < persons.length; i++) {
        await mergePersons(primaryId, persons[i].id, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person-duplicates'] });
      refetchDuplicates();
    },
  });

  const batchMergeMutation = useMutation({
    mutationFn: async (groups: DuplicateGroup[]) => {
      let merged = 0;
      let failed = 0;
      for (const group of groups) {
        if (group.has_conflicts || group.persons.length < 2) continue;
        try {
          const primaryId = group.persons[0].id;
          for (let i = 1; i < group.persons.length; i++) {
            await mergePersons(primaryId, group.persons[i].id, {});
          }
          merged++;
        } catch {
          failed++;
        }
      }
      return { merged, failed };
    },
    onSuccess: (result) => {
      setMergeResult(result);
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person-duplicates'] });
      refetchDuplicates();
    },
  });

  const handleSelectPair = (primaryId: number, secondaryId: number) => {
    setSelectedPair({ primaryId, secondaryId });
    setFieldResolutions({});
    setStep('resolve');
  };

  const handleSwapPrimary = () => {
    if (selectedPair) {
      setSelectedPair({ primaryId: selectedPair.secondaryId, secondaryId: selectedPair.primaryId });
      setFieldResolutions({});
    }
  };

  const handleMerge = () => {
    if (!selectedPair) return;
    mergeMutation.mutate({
      primaryId: selectedPair.primaryId,
      secondaryId: selectedPair.secondaryId,
      resolutions: fieldResolutions,
    });
  };

  const handleBack = () => {
    setStep('list');
    setSelectedPair(null);
    setFieldResolutions({});
  };

  const handleAutoMergeAll = () => {
    if (!duplicatesData?.groups) return;
    const autoMergeableGroups = duplicatesData.groups.filter(g => !g.has_conflicts && g.persons.length >= 2);
    if (autoMergeableGroups.length === 0) return;
    batchMergeMutation.mutate(autoMergeableGroups);
  };

  // Check if all conflicts are resolved
  const allConflictsResolved = useMemo(() => {
    if (!previewData?.conflicts) return true;
    const { field_conflicts } = previewData.conflicts;
    return field_conflicts.every(c => fieldResolutions[c.field]);
  }, [previewData, fieldResolutions]);

  const autoMergeableCount = duplicatesData?.groups?.filter(g => !g.has_conflicts && g.persons.length >= 2).length ?? 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            {step === 'resolve' && (
              <button onClick={handleBack} className="p-1 text-text-muted hover:text-text-secondary rounded">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-text">
                {step === 'list' ? 'Merge Duplicates' : 'Resolve Merge'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'list' ? (
            <DuplicatesList
              groups={duplicatesData?.groups || []}
              isLoading={loadingDuplicates}
              onSelectPair={handleSelectPair}
              onMergeGroup={(persons) => mergeGroupMutation.mutate(persons)}
              isMergingGroup={mergeGroupMutation.isPending}
              onAutoMergeAll={handleAutoMergeAll}
              autoMergeableCount={autoMergeableCount}
              isBatchMerging={batchMergeMutation.isPending}
              mergeResult={mergeResult}
            />
          ) : (
            <MergeResolution
              preview={previewData}
              isLoading={loadingPreview}
              fieldResolutions={fieldResolutions}
              onFieldResolution={(field, choice) =>
                setFieldResolutions(prev => ({ ...prev, [field]: choice }))
              }
              onSwapPrimary={handleSwapPrimary}
            />
          )}
        </div>

        {/* Footer */}
        {step === 'resolve' && previewData && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Person #{selectedPair?.secondaryId} will be deleted after merge
            </p>
            <button
              onClick={handleMerge}
              disabled={!allConflictsResolved || mergeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {mergeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Merge className="w-4 h-4" />
              )}
              Merge Persons
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Duplicate Groups List =====

function DuplicatesList({
  groups,
  isLoading,
  onSelectPair,
  onMergeGroup,
  isMergingGroup,
  onAutoMergeAll,
  autoMergeableCount,
  isBatchMerging,
  mergeResult,
}: {
  groups: DuplicateGroup[];
  isLoading: boolean;
  onSelectPair: (primaryId: number, secondaryId: number) => void;
  onMergeGroup: (persons: Person[]) => void;
  isMergingGroup: boolean;
  onAutoMergeAll: () => void;
  autoMergeableCount: number;
  isBatchMerging: boolean;
  mergeResult: { merged: number; failed: number } | null;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        <span className="ml-2 text-text-muted">Scanning for duplicates...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
        <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
        <p className="font-medium">No duplicates found</p>
        <p className="text-sm text-text-muted mt-1">All person records appear to be unique</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Batch merge result */}
      {mergeResult && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
          <CheckCircle2 className="w-4 h-4 inline mr-1" />
          Auto-merged {mergeResult.merged} group(s).
          {mergeResult.failed > 0 && ` ${mergeResult.failed} failed.`}
        </div>
      )}

      {/* Auto-merge button */}
      {autoMergeableCount > 0 && (
        <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <div>
            <p className="text-sm font-medium text-text">
              {autoMergeableCount} group(s) can be auto-merged
            </p>
            <p className="text-xs text-text-muted">No conflicts detected — safe to merge automatically</p>
          </div>
          <button
            onClick={onAutoMergeAll}
            disabled={isBatchMerging}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
          >
            {isBatchMerging ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Merge className="w-4 h-4" />
            )}
            Auto-merge all
          </button>
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-text-muted mb-3">
        Found {groups.length} potential duplicate group(s)
      </p>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map((group, idx) => (
          <DuplicateGroupCard
            key={idx}
            group={group}
            onMergeGroup={onMergeGroup}
            isMergingGroup={isMergingGroup}
            onSelectPair={onSelectPair}
          />
        ))}
      </div>
    </div>
  );
}

// ===== Single Duplicate Group Card =====

function DuplicateGroupCard({
  group,
  onMergeGroup,
  isMergingGroup,
  onSelectPair,
}: {
  group: DuplicateGroup;
  onMergeGroup: (persons: Person[]) => void;
  isMergingGroup: boolean;
  onSelectPair: (primaryId: number, secondaryId: number) => void;
}) {
  const persons = group.persons;
  if (persons.length < 2) return null;

  const handleMerge = () => {
    if (group.has_conflicts) {
      // Has conflicts — go to resolve step for first pair
      onSelectPair(persons[0].id, persons[1].id);
    } else {
      // No conflicts — merge all into persons[0]
      onMergeGroup(persons);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-bg-hover/50">
        <div className="flex items-center gap-2">
          {group.has_conflicts ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
          <span className="text-sm font-medium text-text">
            {persons.length} persons
          </span>
          <span className="text-xs text-text-muted">
            Match: {group.match_reasons.map(r => r.replace('_', ' ')).join(', ')}
          </span>
        </div>
        <button
          onClick={handleMerge}
          disabled={isMergingGroup}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors disabled:opacity-50"
        >
          {isMergingGroup ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Merge className="w-3.5 h-3.5" />
          )}
          Merge
        </button>
      </div>
      <div className="divide-y divide-border">
        {persons.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
      </div>
    </div>
  );
}

function PersonRow({ person }: { person: Person }) {
  const primaryPhone = person.phones?.find(p => p.primary)?.value || person.phones?.[0]?.value;
  const primaryEmail = person.emails?.find(e => e.primary)?.value || person.emails?.[0]?.value;

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-7 h-7 rounded-full bg-bg-hover flex items-center justify-center flex-shrink-0">
        <User className="w-3.5 h-3.5 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">{person.name}</span>
          <span className="text-xs text-text-muted">#{person.id}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-bg-hover text-text-secondary capitalize">
            {person.person_type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {person.organization && <span>{person.organization}</span>}
          {primaryPhone && <span>{primaryPhone}</span>}
          {primaryEmail && <span className="truncate">{primaryEmail}</span>}
        </div>
      </div>
    </div>
  );
}

// ===== Merge Resolution View =====

function MergeResolution({
  preview,
  isLoading,
  fieldResolutions,
  onFieldResolution,
  onSwapPrimary,
}: {
  preview: Awaited<ReturnType<typeof getMergePreview>> | undefined;
  isLoading: boolean;
  fieldResolutions: Record<string, string>;
  onFieldResolution: (field: string, choice: string) => void;
  onSwapPrimary: () => void;
}) {
  if (isLoading || !preview) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const { primary, secondary, conflicts } = preview;

  return (
    <div className="p-4 space-y-4">
      {/* Column headers */}
      <div className="flex items-center gap-4">
        <div className="flex-1 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wider">Keep (Primary)</p>
              <p className="text-sm font-medium text-text mt-0.5">{primary.name} <span className="text-text-muted">#{primary.id}</span></p>
            </div>
          </div>
        </div>
        <button
          onClick={onSwapPrimary}
          className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
          title="Swap primary/secondary"
        >
          <ArrowRightLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider">Remove (Secondary)</p>
            <p className="text-sm font-medium text-text mt-0.5">{secondary.name} <span className="text-text-muted">#{secondary.id}</span></p>
          </div>
        </div>
      </div>

      {/* Field conflicts */}
      {conflicts.field_conflicts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Fields with different values — pick one
          </h3>
          <div className="space-y-2">
            {conflicts.field_conflicts.map((conflict) => (
              <FieldConflictRow
                key={conflict.field}
                conflict={conflict}
                resolution={fieldResolutions[conflict.field]}
                onResolve={(choice) => onFieldResolution(conflict.field, choice)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Auto-resolved fields */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Auto-resolved
        </h3>
        <div className="space-y-1 text-sm text-text-secondary">
          <AutoField icon={<Phone className="w-3.5 h-3.5" />} label="Phones" description="Union of all phone numbers" />
          <AutoField icon={<Mail className="w-3.5 h-3.5" />} label="Emails" description="Union of all email addresses" />
          <AutoField icon={<Briefcase className="w-3.5 h-3.5" />} label="Case assignments" description="Combined (conflicts auto-resolved to primary)" />
          <AutoField icon={<FileText className="w-3.5 h-3.5" />} label="Attributes" description="Merged (primary values win on conflict)" />
        </div>
      </div>

      {/* Assignment conflicts info */}
      {conflicts.assignment_conflicts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-500" />
            Overlapping case assignments ({conflicts.assignment_conflicts.length})
          </h3>
          <p className="text-xs text-text-muted mb-2">
            Both persons are assigned to the same case with the same role. Primary's assignment will be kept.
          </p>
          <div className="space-y-1">
            {conflicts.assignment_conflicts.map((ac, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-bg-hover rounded text-sm">
                <Briefcase className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-text">{ac.short_name || ac.case_name}</span>
                <span className="text-text-muted">as {ac.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Judge conflicts info */}
      {conflicts.judge_conflicts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-2">
            Overlapping judge assignments ({conflicts.judge_conflicts.length})
          </h3>
          <p className="text-xs text-text-muted mb-2">
            Both assigned as judge on the same proceeding. Primary's assignment will be kept.
          </p>
          <div className="space-y-1">
            {conflicts.judge_conflicts.map((jc, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-bg-hover rounded text-sm">
                <span className="text-text">{jc.proceeding_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AutoField({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-hover/50">
      <span className="text-text-muted">{icon}</span>
      <span className="font-medium text-text text-xs">{label}</span>
      <span className="text-xs text-text-muted">{description}</span>
    </div>
  );
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  name: <User className="w-3.5 h-3.5" />,
  person_type: <User className="w-3.5 h-3.5" />,
  organization: <Building className="w-3.5 h-3.5" />,
  address: <MapPin className="w-3.5 h-3.5" />,
  notes: <FileText className="w-3.5 h-3.5" />,
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  person_type: 'Type',
  organization: 'Organization',
  address: 'Address',
  notes: 'Notes',
};

function FieldConflictRow({
  conflict,
  resolution,
  onResolve,
}: {
  conflict: { field: string; primary_value: string; secondary_value: string };
  resolution: string | undefined;
  onResolve: (choice: string) => void;
}) {
  const isNotes = conflict.field === 'notes';

  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20">
        <span className="text-amber-600 dark:text-amber-400">{FIELD_ICONS[conflict.field]}</span>
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          {FIELD_LABELS[conflict.field] || conflict.field}
        </span>
      </div>
      <div className="flex divide-x divide-border">
        <button
          onClick={() => onResolve('primary')}
          className={`flex-1 px-3 py-2 text-left text-sm transition-colors ${
            resolution === 'primary'
              ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-500'
              : 'hover:bg-bg-hover'
          }`}
        >
          <p className={`${isNotes ? 'line-clamp-2' : 'truncate'} ${resolution === 'primary' ? 'text-text font-medium' : 'text-text-secondary'}`}>
            {conflict.primary_value || <em className="text-text-muted">empty</em>}
          </p>
        </button>
        <button
          onClick={() => onResolve('secondary')}
          className={`flex-1 px-3 py-2 text-left text-sm transition-colors ${
            resolution === 'secondary'
              ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-500'
              : 'hover:bg-bg-hover'
          }`}
        >
          <p className={`${isNotes ? 'line-clamp-2' : 'truncate'} ${resolution === 'secondary' ? 'text-text font-medium' : 'text-text-secondary'}`}>
            {conflict.secondary_value || <em className="text-text-muted">empty</em>}
          </p>
        </button>
      </div>
      {isNotes && (
        <button
          onClick={() => onResolve('concatenate')}
          className={`w-full px-3 py-1.5 text-left text-xs border-t border-border transition-colors ${
            resolution === 'concatenate'
              ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-500 font-medium text-text'
              : 'text-text-muted hover:bg-bg-hover'
          }`}
        >
          Concatenate both notes
        </button>
      )}
    </div>
  );
}
