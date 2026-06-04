import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import {
  getChecklist,
  setChecklistItem,
  addCustomChecklistItem,
  deleteChecklistItem,
  getChecklistComments,
  addChecklistComment,
} from "@/services/checklist"
import {
  CHECKLIST_STATUS_META,
  CHECKLIST_STATUS_ORDER,
  type ChecklistItem,
  type ChecklistStatus,
} from "@/types/checklist"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { timeAgo } from "@/lib/datetime"
import { cn } from "@/lib/utils"

interface CaseDocumentTrackerProps {
  caseId: number
}

const STATUS_BADGE: Record<ChecklistStatus, string> = {
  needed: "bg-muted text-muted-foreground",
  in_progress: "bg-info text-info-foreground",
  partial: "bg-warning text-warning-foreground",
  complete: "bg-success text-success-foreground",
  na: "bg-muted text-muted-foreground",
}

export function CaseDocumentTracker({ caseId }: CaseDocumentTrackerProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [showNa, setShowNa] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState("")
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["checklist", caseId],
    queryFn: () => getChecklist(caseId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["checklist", caseId] })
    // feature_data_counts on the case drives the section's toggle lock.
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
  }

  const addCustom = useMutation({
    mutationFn: (label: string) => addCustomChecklistItem(caseId, label),
    onSuccess: () => {
      setCustomLabel("")
      setAddingCustom(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const allItems = useMemo(() => {
    if (!data) return [] as ChecklistItem[]
    return [...data.groups.flatMap((g) => g.items), ...data.custom_items]
  }, [data])

  const summary = useMemo(() => {
    const visible = allItems.filter((i) => i.status !== "na")
    const complete = visible.filter((i) => i.status === "complete").length
    const active = visible.filter(
      (i) => i.status === "in_progress" || i.status === "partial"
    ).length
    const todo = visible.filter((i) => i.status === "needed").length
    return { total: visible.length, complete, active, todo }
  }, [allItems])

  const naCount = allItems.filter((i) => i.status === "na").length

  return (
    <Card size="sm">
      <CardHeader className="border-b bg-muted/40">
        <CardTitle>Document Tracking</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setAddingCustom((v) => !v)}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            Item
          </Button>
        </CardAction>
        {summary.total > 0 && (
          <div className="col-span-full mt-2 flex items-center gap-3">
            <div className="flex h-1.5 flex-1 overflow-hidden bg-muted">
              <span
                className="bg-success"
                style={{ width: `${(summary.complete / summary.total) * 100}%` }}
              />
              <span
                className="bg-warning"
                style={{ width: `${(summary.active / summary.total) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              <b className="font-semibold text-foreground">{summary.complete}</b> done
              {" · "}
              <b className="font-semibold text-foreground">{summary.active}</b> in progress
              {" · "}
              <b className="font-semibold text-foreground">{summary.todo}</b> to do
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <div>
            {addingCustom && (
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <Input
                  autoFocus
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customLabel.trim()) {
                      addCustom.mutate(customLabel.trim())
                    } else if (e.key === "Escape") {
                      setAddingCustom(false)
                      setCustomLabel("")
                    }
                  }}
                  placeholder="Custom item name…"
                  className="h-7"
                />
                <Button
                  size="sm"
                  disabled={!customLabel.trim() || addCustom.isPending}
                  onClick={() => addCustom.mutate(customLabel.trim())}
                >
                  Add
                </Button>
              </div>
            )}

            {data?.groups.map((group) => (
              <ChecklistGroupSection
                key={group.key}
                caseId={caseId}
                label={group.label}
                items={group.items}
                showNa={showNa}
                expandedKey={expandedKey}
                setExpandedKey={setExpandedKey}
                onChanged={invalidate}
              />
            ))}

            {data && data.custom_items.length > 0 && (
              <ChecklistGroupSection
                caseId={caseId}
                label="Other"
                items={data.custom_items}
                showNa={showNa}
                expandedKey={expandedKey}
                setExpandedKey={setExpandedKey}
                onChanged={invalidate}
              />
            )}

            {naCount > 0 && (
              <div className="border-t px-3 py-2">
                <button
                  type="button"
                  onClick={() => setShowNa((v) => !v)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {showNa ? "Hide" : "Show"} N/A ({naCount})
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface GroupSectionProps {
  caseId: number
  label: string
  items: ChecklistItem[]
  showNa: boolean
  expandedKey: string | null
  setExpandedKey: (k: string | null) => void
  onChanged: () => void
}

function ChecklistGroupSection({
  caseId,
  label,
  items,
  showNa,
  expandedKey,
  setExpandedKey,
  onChanged,
}: GroupSectionProps) {
  const visible = items.filter((i) => showNa || i.status !== "na")
  if (visible.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        <span className="bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
          {visible.length}
        </span>
      </div>
      {visible.map((item) => (
        <ChecklistRow
          key={item.key}
          caseId={caseId}
          item={item}
          expanded={expandedKey === item.key}
          onToggle={() =>
            setExpandedKey(expandedKey === item.key ? null : item.key)
          }
          onChanged={onChanged}
        />
      ))}
    </div>
  )
}

interface ChecklistRowProps {
  caseId: number
  item: ChecklistItem
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}

function ChecklistRow({ caseId, item, expanded, onToggle, onChanged }: ChecklistRowProps) {
  const meta = CHECKLIST_STATUS_META[item.status]
  const isComplete = item.status === "complete"
  const isPartial = item.status === "partial"

  return (
    <div
      className={cn(
        "border-t",
        expanded && "border-l-2 border-l-warning bg-muted/20"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/30"
      >
        <StatusDot status={item.status} />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-[13px] font-medium",
              isComplete && "font-normal text-muted-foreground"
            )}
          >
            {item.label}
          </div>
          {item.notes && (
            <div
              className={cn(
                "truncate text-[11px]",
                isPartial ? "text-warning" : "text-muted-foreground"
              )}
            >
              {item.notes}
            </div>
          )}
        </div>
        {item.comment_count > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {item.comment_count}↳
          </span>
        )}
        <span
          className={cn(
            "shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            STATUS_BADGE[item.status]
          )}
        >
          {meta.label}
        </span>
      </button>

      {expanded && (
        <ExpandedItem caseId={caseId} item={item} onChanged={onChanged} />
      )}
    </div>
  )
}

function StatusDot({ status }: { status: ChecklistStatus }) {
  if (status === "complete") {
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        className="size-4 shrink-0 text-success"
      />
    )
  }
  if (status === "needed") {
    return <span className="size-2.5 shrink-0 border border-muted-foreground/50" />
  }
  const tone =
    status === "partial"
      ? "bg-warning"
      : status === "in_progress"
      ? "bg-info"
      : "bg-muted-foreground/40"
  return <span className={cn("size-2.5 shrink-0", tone)} />
}

interface ExpandedItemProps {
  caseId: number
  item: ChecklistItem
  onChanged: () => void
}

function ExpandedItem({ caseId, item, onChanged }: ExpandedItemProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(item.notes ?? "")
  const [update, setUpdate] = useState("")

  const setItem = useMutation({
    mutationFn: (patch: { status?: ChecklistStatus; notes?: string | null }) =>
      setChecklistItem(caseId, item.key, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-comments", caseId, item.key] })
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeItem = useMutation({
    mutationFn: () => deleteChecklistItem(caseId, item.key),
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["checklist-comments", caseId, item.key],
    queryFn: () => getChecklistComments(caseId, item.key),
  })

  const addUpdate = useMutation({
    mutationFn: (content: string) => addChecklistComment(caseId, item.key, content),
    onSuccess: () => {
      setUpdate("")
      queryClient.invalidateQueries({ queryKey: ["checklist-comments", caseId, item.key] })
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const notesDirty = (notes.trim() || null) !== (item.notes || null)

  return (
    <div className="flex flex-col gap-4 px-3 pb-4 pt-1">
      {/* Status segmented control */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </div>
        <div className="flex flex-wrap gap-1">
          {CHECKLIST_STATUS_ORDER.map((s) => {
            const active = item.status === s
            return (
              <button
                key={s}
                type="button"
                disabled={setItem.isPending}
                onClick={() => !active && setItem.mutate({ status: s })}
                className={cn(
                  "border px-2.5 py-1 text-[11px] font-medium",
                  active
                    ? STATUS_BADGE[s] + " border-transparent"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {CHECKLIST_STATUS_META[s].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Current-status one-liner */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Current status
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notesDirty) setItem.mutate({ notes: notes.trim() || null })
          }}
          placeholder="Short summary of where this stands…"
          className="min-h-[38px] text-[12px]"
          rows={2}
        />
      </div>

      {/* Activity log */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </span>
          {item.custom && (
            <button
              type="button"
              onClick={() => removeItem.mutate()}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete01Icon} className="size-3" />
              Remove item
            </button>
          )}
        </div>

        {commentsLoading ? (
          <Skeleton className="h-10" />
        ) : comments && comments.length > 0 ? (
          <div className="flex flex-col">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5 border-t py-2 first:border-t-0">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center text-[9px] font-bold",
                    c.is_system
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {c.is_system ? "↻" : c.user_initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {[c.user_first_name, c.user_last_name].filter(Boolean).join(" ") ||
                        "System"}
                    </span>{" "}
                    · {timeAgo(c.created_at)}
                  </div>
                  <div
                    className={cn(
                      "text-[12px] leading-relaxed",
                      c.is_system && "italic text-muted-foreground"
                    )}
                  >
                    {c.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No updates yet.</p>
        )}

        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const t = update.trim()
            if (t) addUpdate.mutate(t)
          }}
        >
          <Input
            value={update}
            onChange={(e) => setUpdate(e.target.value)}
            placeholder="Add an update…"
            className="h-8 text-[12px]"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!update.trim() || addUpdate.isPending}
          >
            <HugeiconsIcon icon={SentIcon} className="size-3.5" />
          </Button>
        </form>
      </div>
    </div>
  )
}
