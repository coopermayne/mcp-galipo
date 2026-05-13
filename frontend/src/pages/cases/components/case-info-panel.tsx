import { useMemo, useState, useRef, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons"
import type { CaseDetail } from "@/types/case"
import { updateCase } from "@/services/cases"
import { getEvents } from "@/services/events"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { TrialLikelihood } from "@/pages/cases/components/trial-likelihood"

interface CaseInfoPanelProps {
  caseData: CaseDetail
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatEventDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const base = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const dow = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${base} (${dow})`
}

const DEFAULT_TRIAL_DAYS = 7

function TrialLengthEditor({ days, onSave }: { days: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(days ?? DEFAULT_TRIAL_DAYS))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    const n = parseInt(draft, 10)
    const value = isNaN(n) || n < 1 ? null : n
    if (value !== days) onSave(value)
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">Trial Length</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") {
                setEditing(false)
                setDraft(String(days ?? DEFAULT_TRIAL_DAYS))
              }
            }}
            className="w-12 bg-transparent border border-input px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-ring tabular-nums"
          />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(days ?? DEFAULT_TRIAL_DAYS))
            setEditing(true)
          }}
          className="group/edit flex items-center gap-1 text-xs hover:text-foreground transition-colors"
        >
          <span className={`tabular-nums ${days != null ? "" : "text-muted-foreground"}`}>
            {days ?? DEFAULT_TRIAL_DAYS} days
          </span>
          <HugeiconsIcon
            icon={PencilEdit01Icon}
            className="size-3 shrink-0 opacity-0 group-hover/edit:opacity-50 transition-opacity"
          />
        </button>
      )}
    </div>
  )
}

export function CaseInfoPanel({ caseData }: CaseInfoPanelProps) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ case_summary: string; date_of_injury: string; trial_date: string; trial_estimated_days: number | null }>) =>
      updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: eventsData } = useQuery({
    queryKey: ["events", "case", caseData.id],
    queryFn: () => getEvents({ case_id: caseData.id, limit: 500 }),
  })

  const starredEvents = useMemo(
    () => (eventsData?.events ?? []).filter((e) => e.starred),
    [eventsData]
  )

  const createdDate = useMemo(
    () =>
      caseData.created_at
        ? new Date(caseData.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
    [caseData.created_at]
  )

  return (
    <div className="border p-3 space-y-3">
      {/* Summary */}
      <div>
        <span className="text-xs text-muted-foreground block mb-1">Summary</span>
        <InlineEditField
          value={caseData.case_summary ?? ""}
          onSave={(v) => updateMutation.mutate({ case_summary: v })}
          type="textarea"
          placeholder="Add a summary..."
          displayClassName="text-xs whitespace-pre-wrap"
        />
      </div>

      {/* Key Dates */}
      <div className="border-t pt-3 space-y-1.5">
        <span className="text-xs text-muted-foreground block">Key Dates</span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Date of Injury</span>
          <InlineEditField
            value={caseData.date_of_injury ?? ""}
            onSave={(v) => updateMutation.mutate({ date_of_injury: v })}
            type="date"
            displayClassName="text-xs justify-end"
          />
        </div>
        {/* Trial info group */}
        <div className="border border-dashed border-muted-foreground/25 p-1.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Trial Date</span>
            <InlineEditField
              value={caseData.trial_date ?? ""}
              onSave={(v) => updateMutation.mutate({ trial_date: v })}
              type="date"
              displayClassName="text-xs justify-end"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Likelihood</span>
            <TrialLikelihood
              caseId={caseData.id}
              likelihood={caseData.trial_likelihood}
              note={caseData.trial_likelihood_note}
            />
          </div>
          <TrialLengthEditor
            days={caseData.trial_estimated_days}
            onSave={(v) => updateMutation.mutate({ trial_estimated_days: v })}
          />
        </div>
        {createdDate && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Case Opened</span>
            <span className="text-xs">{createdDate}</span>
          </div>
        )}
      </div>

      {/* Important Dates (starred events) */}
      {starredEvents.length > 0 && (
        <div className="border-t pt-3 space-y-1.5">
          <span className="text-xs text-muted-foreground block">Important Dates</span>
          {starredEvents.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs truncate min-w-0">
                <HugeiconsIcon icon={StarIcon} className="size-3 text-warning shrink-0" />
                <span className="truncate">{e.description}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {formatEventDate(e.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
