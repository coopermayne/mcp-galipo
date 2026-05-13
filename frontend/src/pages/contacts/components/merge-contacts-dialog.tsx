import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building06Icon,
  NoteIcon,
  CheckmarkCircle01Icon,
  Alert02Icon,
  ArrowLeftRightIcon,
  UserIcon,
  SmartPhone01Icon,
  Mail01Icon,
  Briefcase01Icon,
  ArrowLeft01Icon,
  GitMergeIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  findDuplicates,
  previewMerge,
  mergePersons,
  dismissDuplicate,
  type DuplicateGroup,
} from "@/services/persons"
import { cn } from "@/lib/utils"

type Step = "list" | "resolve"

interface MergeContactsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MergeContactsDialog({ open, onOpenChange }: MergeContactsDialogProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("list")
  const [selectedPair, setSelectedPair] = useState<{ primaryId: number; secondaryId: number } | null>(null)
  const [fieldResolutions, setFieldResolutions] = useState<Record<string, string>>({})
  const [mergeResult, setMergeResult] = useState<{ merged: number; failed: number } | null>(null)

  const { data: duplicatesData, isLoading: duplicatesLoading, refetch } = useQuery({
    queryKey: ["persons", "duplicates"],
    queryFn: findDuplicates,
    enabled: open,
  })

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["persons", "merge-preview", selectedPair?.primaryId, selectedPair?.secondaryId],
    queryFn: () => previewMerge(selectedPair!.primaryId, selectedPair!.secondaryId),
    enabled: !!selectedPair && step === "resolve",
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["persons"] })
    queryClient.invalidateQueries({ queryKey: ["contacts"] })
    refetch()
  }

  const mergeMutation = useMutation({
    mutationFn: ({ primaryId, secondaryId, resolutions }: {
      primaryId: number
      secondaryId: number
      resolutions: Record<string, string>
    }) => mergePersons(primaryId, secondaryId, resolutions),
    onSuccess: () => {
      toast.success("Contacts merged")
      invalidateAll()
      setStep("list")
      setSelectedPair(null)
      setFieldResolutions({})
    },
    onError: (err) => toast.error(`Merge failed: ${err.message}`),
  })

  const mergeGroupMutation = useMutation({
    mutationFn: async (persons: DuplicateGroup["persons"]) => {
      const primaryId = persons[0].id
      for (let i = 1; i < persons.length; i++) {
        await mergePersons(primaryId, persons[i].id, {})
      }
    },
    onSuccess: () => {
      toast.success("Group merged")
      invalidateAll()
    },
    onError: (err) => toast.error(`Merge failed: ${err.message}`),
  })

  const dismissMutation = useMutation({
    mutationFn: (personIds: number[]) => dismissDuplicate(personIds),
    onSuccess: () => {
      toast.success("Dismissed — won't appear again")
      invalidateAll()
    },
    onError: (err) => toast.error(`Dismiss failed: ${err.message}`),
  })

  const batchMergeMutation = useMutation({
    mutationFn: async (groups: DuplicateGroup[]) => {
      let merged = 0
      let failed = 0
      for (const group of groups) {
        if (group.has_conflicts || group.persons.length < 2) continue
        try {
          const primaryId = group.persons[0].id
          for (let i = 1; i < group.persons.length; i++) {
            await mergePersons(primaryId, group.persons[i].id, {})
          }
          merged++
        } catch {
          failed++
        }
      }
      return { merged, failed }
    },
    onSuccess: (result) => {
      setMergeResult(result)
      invalidateAll()
    },
  })

  function handleSelectPair(primaryId: number, secondaryId: number) {
    setSelectedPair({ primaryId, secondaryId })
    setFieldResolutions({})
    setStep("resolve")
  }

  function handleMergeGroup(group: DuplicateGroup) {
    if (group.has_conflicts) {
      handleSelectPair(group.persons[0].id, group.persons[1].id)
    } else {
      mergeGroupMutation.mutate(group.persons)
    }
  }

  function handleSwap() {
    if (selectedPair) {
      setSelectedPair({ primaryId: selectedPair.secondaryId, secondaryId: selectedPair.primaryId })
      setFieldResolutions({})
    }
  }

  function handleMerge() {
    if (!selectedPair) return
    mergeMutation.mutate({
      primaryId: selectedPair.primaryId,
      secondaryId: selectedPair.secondaryId,
      resolutions: fieldResolutions,
    })
  }

  function handleBack() {
    setStep("list")
    setSelectedPair(null)
    setFieldResolutions({})
  }

  function handleClose() {
    setStep("list")
    setSelectedPair(null)
    setFieldResolutions({})
    setMergeResult(null)
    onOpenChange(false)
  }

  const allConflictsResolved = useMemo(() => {
    if (!previewData?.conflicts) return true
    return previewData.conflicts.field_conflicts.every((c) => fieldResolutions[c.field])
  }, [previewData, fieldResolutions])

  const groups = duplicatesData?.groups ?? []
  const autoMergeableCount = groups.filter((g) => !g.has_conflicts && g.persons.length >= 2).length

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step === "resolve" && (
              <Button variant="ghost" size="icon-sm" onClick={handleBack}>
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              </Button>
            )}
            <div>
              <DialogTitle>
                {step === "list" ? "Merge Duplicates" : "Resolve Merge"}
              </DialogTitle>
              <DialogDescription>
                {step === "list"
                  ? "Review and merge duplicate contacts."
                  : "Resolve conflicts before merging."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {step === "list" ? (
            <DuplicatesList
              groups={groups}
              isLoading={duplicatesLoading}
              onMergeGroup={handleMergeGroup}
              isMergingGroup={mergeGroupMutation.isPending}
              onDismissGroup={(group) => dismissMutation.mutate(group.persons.map((p) => p.id))}
              isDismissing={dismissMutation.isPending}
              onAutoMergeAll={() => batchMergeMutation.mutate(groups)}
              autoMergeableCount={autoMergeableCount}
              isBatchMerging={batchMergeMutation.isPending}
              mergeResult={mergeResult}
            />
          ) : (
            <MergeResolution
              preview={previewData ?? null}
              isLoading={previewLoading}
              fieldResolutions={fieldResolutions}
              onFieldResolution={(field, choice) =>
                setFieldResolutions((prev) => ({ ...prev, [field]: choice }))
              }
              onSwap={handleSwap}
            />
          )}
        </div>

        {step === "resolve" && previewData && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Person #{selectedPair?.secondaryId} will be deleted after merge
            </p>
            <Button
              size="sm"
              onClick={handleMerge}
              disabled={!allConflictsResolved || mergeMutation.isPending}
            >
              {mergeMutation.isPending ? (
                <>
                  <HugeiconsIcon icon={Loading03Icon} className="size-3.5 mr-1.5 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={GitMergeIcon} className="size-3.5 mr-1.5" />
                  Merge Persons
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DuplicatesList({
  groups,
  isLoading,
  onMergeGroup,
  isMergingGroup,
  onDismissGroup,
  isDismissing,
  onAutoMergeAll,
  autoMergeableCount,
  isBatchMerging,
  mergeResult,
}: {
  groups: DuplicateGroup[]
  isLoading: boolean
  onMergeGroup: (group: DuplicateGroup) => void
  isMergingGroup: boolean
  onDismissGroup: (group: DuplicateGroup) => void
  isDismissing: boolean
  onAutoMergeAll: () => void
  autoMergeableCount: number
  isBatchMerging: boolean
  mergeResult: { merged: number; failed: number } | null
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-8 mb-2 text-success" />
        <p className="text-sm font-medium">No duplicates found</p>
        <p className="text-xs mt-1">All contacts appear to be unique.</p>
      </div>
    )
  }

  return (
    <div className="py-2">
      {mergeResult && (
        <div className="mb-3 p-2.5 border border-success/30 bg-success/5 text-success text-xs flex items-center gap-2">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 shrink-0" />
          Auto-merged {mergeResult.merged} group{mergeResult.merged !== 1 ? "s" : ""}.
          {mergeResult.failed > 0 && ` ${mergeResult.failed} failed.`}
        </div>
      )}

      {autoMergeableCount > 0 && (
        <div className="mb-3 flex items-center justify-between p-3 border border-border bg-muted/30">
          <div>
            <p className="text-sm font-medium">
              {autoMergeableCount} group{autoMergeableCount !== 1 ? "s" : ""} can be auto-merged
            </p>
            <p className="text-xs text-muted-foreground">No conflicts — safe to merge automatically</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onAutoMergeAll}
            disabled={isBatchMerging}
          >
            {isBatchMerging ? (
              <HugeiconsIcon icon={Loading03Icon} className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <HugeiconsIcon icon={GitMergeIcon} className="size-3.5 mr-1.5" />
            )}
            Auto-merge all
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-2">
        {groups.length} duplicate group{groups.length !== 1 ? "s" : ""}
      </p>

      <div className="space-y-2">
        {groups.map((group, idx) => (
          <DuplicateGroupCard
            key={idx}
            group={group}
            onMerge={() => onMergeGroup(group)}
            isMerging={isMergingGroup}
            onDismiss={() => onDismissGroup(group)}
            isDismissing={isDismissing}
          />
        ))}
      </div>
    </div>
  )
}

function DuplicateGroupCard({
  group,
  onMerge,
  isMerging,
  onDismiss,
  isDismissing,
}: {
  group: DuplicateGroup
  onMerge: () => void
  isMerging: boolean
  onDismiss: () => void
  isDismissing: boolean
}) {
  const persons = group.persons
  if (persons.length < 2) return null

  return (
    <div className="border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          {group.has_conflicts ? (
            <HugeiconsIcon icon={Alert02Icon} className="size-4 text-warning shrink-0" />
          ) : (
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-success shrink-0" />
          )}
          <span className="text-sm font-medium">{persons.length} contacts</span>
          <span className="text-xs text-muted-foreground">
            {group.match_reasons.map((r) => r.replace(/_/g, " ")).join(", ")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            disabled={isDismissing}
            className="text-xs h-7 text-muted-foreground"
          >
            Not a duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMerge}
            disabled={isMerging}
            className="text-xs h-7"
          >
            {isMerging ? (
              <HugeiconsIcon icon={Loading03Icon} className="size-3.5 mr-1 animate-spin" />
            ) : (
              <HugeiconsIcon icon={GitMergeIcon} className="size-3.5 mr-1" />
            )}
            Merge
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {persons.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
      </div>
    </div>
  )
}

function PersonRow({ person }: { person: DuplicateGroup["persons"][0] }) {
  const primaryPhone = person.phones?.[0]?.value
  const primaryEmail = person.emails?.[0]?.value

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-7 h-7 bg-muted flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={UserIcon} className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{person.name}</span>
          <span className="text-xs text-muted-foreground font-mono">#{person.id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {person.organization && <span className="truncate max-w-[150px]">{person.organization}</span>}
          {primaryPhone && <span>{primaryPhone}</span>}
          {primaryEmail && <span className="truncate">{primaryEmail}</span>}
        </div>
      </div>
    </div>
  )
}

function MergeResolution({
  preview,
  isLoading,
  fieldResolutions,
  onFieldResolution,
  onSwap,
}: {
  preview: Awaited<ReturnType<typeof previewMerge>> | null
  isLoading: boolean
  fieldResolutions: Record<string, string>
  onFieldResolution: (field: string, choice: string) => void
  onSwap: () => void
}) {
  if (isLoading || !preview) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        <HugeiconsIcon icon={Loading03Icon} className="size-5 mr-2 animate-spin" />
        Loading preview...
      </div>
    )
  }

  const { primary, secondary, conflicts } = preview
  const { field_conflicts, assignment_conflicts } = conflicts

  return (
    <div className="py-2 space-y-4">
      {/* Keep / Remove headers */}
      <div className="flex items-center gap-3">
        <div className="flex-1 p-3 border border-success/30 bg-success/5">
          <p className="text-[10px] font-semibold text-success uppercase tracking-wider">Keep (Primary)</p>
          <p className="text-sm font-medium mt-0.5">
            {primary.name} <span className="text-muted-foreground">#{primary.id}</span>
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onSwap} title="Swap primary/secondary">
          <HugeiconsIcon icon={ArrowLeftRightIcon} className="size-4" />
        </Button>
        <div className="flex-1 p-3 border border-destructive/30 bg-destructive/5">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Remove (Secondary)</p>
          <p className="text-sm font-medium mt-0.5">
            {secondary.name} <span className="text-muted-foreground">#{secondary.id}</span>
          </p>
        </div>
      </div>

      {/* Field conflicts */}
      {field_conflicts.length > 0 && (
        <div>
          <h3 className="text-xs font-medium flex items-center gap-2 mb-2">
            <HugeiconsIcon icon={Alert02Icon} className="size-4 text-warning" />
            Fields with different values — pick one
          </h3>
          <div className="space-y-2">
            {field_conflicts.map((conflict) => (
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

      {/* Auto-resolved */}
      <div>
        <h3 className="text-xs font-medium flex items-center gap-2 mb-2">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-success" />
          Auto-resolved
        </h3>
        <div className="space-y-1">
          <AutoField icon={SmartPhone01Icon} label="Phones" description="Union of all phone numbers" />
          <AutoField icon={Mail01Icon} label="Emails" description="Union of all email addresses" />
          <AutoField icon={Briefcase01Icon} label="Case assignments" description="Combined (conflicts resolved to primary)" />
        </div>
      </div>

      {/* Assignment conflicts */}
      {assignment_conflicts.length > 0 && (
        <div>
          <h3 className="text-xs font-medium flex items-center gap-2 mb-2">
            <HugeiconsIcon icon={Briefcase01Icon} className="size-4 text-warning" />
            Overlapping role assignments ({assignment_conflicts.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Both persons have the same role on these cases. Primary&apos;s assignment will be kept.
          </p>
          <div className="space-y-1">
            {assignment_conflicts.map((ac) => (
              <div
                key={`${ac.case_id}-${ac.role_id}`}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 text-xs"
              >
                <HugeiconsIcon icon={Briefcase01Icon} className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{ac.short_name || ac.case_name}</span>
                <span className="text-muted-foreground">as {ac.role_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AutoField({ icon, label, description }: { icon: typeof SmartPhone01Icon; label: string; description: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 text-xs">
      <HugeiconsIcon icon={icon} className="size-3.5 text-muted-foreground" />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{description}</span>
    </div>
  )
}

const FIELD_ICONS: Record<string, typeof Building06Icon> = {
  name: UserIcon,
  organization: Building06Icon,
  address: Building06Icon,
  notes: NoteIcon,
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  organization: "Organization",
  address: "Address",
  notes: "Notes",
}

function FieldConflictRow({
  conflict,
  resolution,
  onResolve,
}: {
  conflict: { field: string; primary_value: string | null; secondary_value: string | null }
  resolution: string | undefined
  onResolve: (choice: string) => void
}) {
  const isNotes = conflict.field === "notes"
  const icon = FIELD_ICONS[conflict.field]

  return (
    <div className="border border-warning/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/5">
        {icon && <HugeiconsIcon icon={icon} className="size-3.5 text-warning" />}
        <span className="text-xs font-medium">{FIELD_LABELS[conflict.field] || conflict.field}</span>
      </div>
      <div className="flex divide-x divide-border">
        <button
          onClick={() => onResolve("primary")}
          className={cn(
            "flex-1 px-3 py-2 text-left text-xs transition-colors",
            resolution === "primary"
              ? "bg-success/5 ring-2 ring-inset ring-success"
              : "hover:bg-muted/50"
          )}
        >
          <p className={cn(
            isNotes ? "line-clamp-2" : "truncate",
            resolution === "primary" ? "font-medium" : "text-muted-foreground"
          )}>
            {conflict.primary_value || <em className="text-muted-foreground">empty</em>}
          </p>
        </button>
        <button
          onClick={() => onResolve("secondary")}
          className={cn(
            "flex-1 px-3 py-2 text-left text-xs transition-colors",
            resolution === "secondary"
              ? "bg-success/5 ring-2 ring-inset ring-success"
              : "hover:bg-muted/50"
          )}
        >
          <p className={cn(
            isNotes ? "line-clamp-2" : "truncate",
            resolution === "secondary" ? "font-medium" : "text-muted-foreground"
          )}>
            {conflict.secondary_value || <em className="text-muted-foreground">empty</em>}
          </p>
        </button>
      </div>
      {isNotes && (
        <button
          onClick={() => onResolve("concatenate")}
          className={cn(
            "w-full px-3 py-1.5 text-left text-xs border-t border-border transition-colors",
            resolution === "concatenate"
              ? "bg-success/5 ring-2 ring-inset ring-success font-medium"
              : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          Concatenate both notes
        </button>
      )}
    </div>
  )
}
