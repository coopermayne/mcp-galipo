import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, Calendar03Icon, StarIcon } from "@hugeicons/core-free-icons"
import { todayInLA } from "@/lib/datetime"
import type { CaseDetail, CaseStatus } from "@/types/case"
import { updateCase } from "@/services/cases"
import { getEvents } from "@/services/events"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { TrialEditCell } from "@/components/common/trial-edit-popover"
import { cn } from "@/lib/utils"

interface CaseKeyDatesProps {
  caseData: CaseDetail
}

type CaseStage = "pre-claim" | "pre-filing" | "filed" | "resolved"

const PRE_CLAIM_STATUSES: CaseStatus[] = ["Signing Up", "Pre-Claim"]
const PRE_FILING_STATUSES: CaseStatus[] = ["Pre-Filing"]
const FILED_STATUSES: CaseStatus[] = [
  "Pleadings", "Discovery", "Expert Discovery", "Pre-trial", "Trial", "Post-Trial", "Appeal",
]
const RESOLVED_STATUSES: CaseStatus[] = ["Settl. Pend.", "Stayed", "Closed"]

function getCaseStage(status: CaseStatus): CaseStage {
  if (PRE_CLAIM_STATUSES.includes(status)) return "pre-claim"
  if (PRE_FILING_STATUSES.includes(status)) return "pre-filing"
  if (FILED_STATUSES.includes(status)) return "filed"
  if (RESOLVED_STATUSES.includes(status)) return "resolved"
  return "filed"
}

type DateUrgency = "overdue" | "imminent" | "approaching" | "normal" | "none"

function getDateUrgency(dateStr: string | null): DateUrgency {
  if (!dateStr) return "none"
  const today = todayInLA()
  const target = new Date(`${dateStr}T00:00:00`)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "overdue"
  if (diffDays <= 14) return "imminent"
  if (diffDays <= 60) return "approaching"
  return "normal"
}

function getDaysLabel(dateStr: string): string {
  const today = todayInLA()
  const target = new Date(`${dateStr}T00:00:00`)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays)
    return absDays === 1 ? "1 day overdue" : `${absDays} days overdue`
  }
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "tomorrow"
  return `${diffDays} days`
}

const URGENCY_STYLES: Record<DateUrgency, { text: string; bg: string; indicator: boolean }> = {
  overdue: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    indicator: true,
  },
  imminent: {
    text: "text-warning-foreground",
    bg: "bg-warning/10",
    indicator: true,
  },
  approaching: {
    text: "text-info",
    bg: "bg-info/10",
    indicator: false,
  },
  normal: {
    text: "text-muted-foreground",
    bg: "",
    indicator: false,
  },
  none: {
    text: "text-muted-foreground",
    bg: "",
    indicator: false,
  },
}

interface DateRowProps {
  label: string
  dateStr: string | null
  onSave: (v: string) => void
  showUrgency?: boolean
}

function DateRow({ label, dateStr, onSave, showUrgency = false }: DateRowProps) {
  const urgency = showUrgency ? getDateUrgency(dateStr) : "normal"
  const styles = URGENCY_STYLES[urgency]

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 px-2.5 py-1.5 min-h-[32px]",
      styles.bg,
    )}>
      <div className="flex items-center gap-2 shrink-0">
        {styles.indicator && (
          <HugeiconsIcon icon={AlertCircleIcon} className={cn("size-3.5", styles.text)} />
        )}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <InlineEditField
          value={dateStr ?? ""}
          onSave={onSave}
          type="date"
          displayClassName={cn("text-xs justify-end", urgency !== "normal" && urgency !== "none" && styles.text)}
        />
        {dateStr && showUrgency && urgency !== "none" && urgency !== "normal" && (
          <span className={cn("text-[10px] tabular-nums shrink-0", styles.text)}>
            {getDaysLabel(dateStr)}
          </span>
        )}
      </div>
    </div>
  )
}

const PACIFIC_TZ = "America/Los_Angeles"

function formatEventDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: PACIFIC_TZ,
  })
}

export function CaseKeyDates({ caseData }: CaseKeyDatesProps) {
  const queryClient = useQueryClient()
  const stage = useMemo(() => getCaseStage(caseData.status), [caseData.status])

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{
      date_of_injury: string
      claim_deadline: string | null
      complaint_deadline: string | null
      trial_date: string
      trial_estimated_days: number | null
    }>) => updateCase(caseData.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseData.id], data.case)
      queryClient.invalidateQueries({ queryKey: ["case", caseData.id] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: upcomingData } = useQuery({
    queryKey: ["events", "case", caseData.id, false],
    queryFn: () => getEvents({ case_id: caseData.id, limit: 500 }),
  })

  const { data: pastData } = useQuery({
    queryKey: ["events", "case", caseData.id, true],
    queryFn: () => getEvents({ case_id: caseData.id, limit: 500, include_past: true, past_days: 365 }),
  })

  const starredEvents = useMemo(() => {
    const upcoming = (upcomingData?.events ?? []).filter((e) => e.starred)
    const pastStarred = (pastData?.events ?? []).filter((e) => e.starred)
    const ids = new Set(upcoming.map((e) => e.id))
    return [...pastStarred.filter((e) => !ids.has(e.id)), ...upcoming]
  }, [upcomingData, pastData])

  const showClaimDeadline = stage === "pre-claim"
  const showFilingDeadline = stage === "pre-claim" || stage === "pre-filing"
  const showTrialInfo = stage === "filed" || stage === "resolved"

  return (
    <div className="border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Key Dates</span>
        <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-wider">
          {stage === "pre-claim" && "Pre-Claim"}
          {stage === "pre-filing" && "Pre-Filing"}
          {stage === "filed" && "Filed"}
          {stage === "resolved" && "Resolved"}
        </span>
      </div>

      {/* Date rows */}
      <div className="divide-y divide-border/50">
        <DateRow
          label="DOI"
          dateStr={caseData.date_of_injury}
          onSave={(v) => updateMutation.mutate({ date_of_injury: v })}
        />

        {showClaimDeadline && (
          <DateRow
            label="Claim DL"
            dateStr={caseData.claim_deadline}
            onSave={(v) => updateMutation.mutate({ claim_deadline: v || null })}
            showUrgency
          />
        )}

        {showFilingDeadline && (
          <DateRow
            label="Complaint DL"
            dateStr={caseData.complaint_deadline}
            onSave={(v) => updateMutation.mutate({ complaint_deadline: v || null })}
            showUrgency
          />
        )}

        {showTrialInfo && (
          <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 min-h-[32px]">
            <span className="text-xs text-muted-foreground shrink-0">Trial</span>
            <TrialEditCell
              caseId={caseData.id}
              trialDate={caseData.trial_date}
              likelihood={caseData.trial_likelihood}
              likelihoodNote={caseData.trial_likelihood_note}
              estimatedDays={caseData.trial_estimated_days}
            />
          </div>
        )}
      </div>

      {/* Starred events */}
      {starredEvents.length > 0 && (
        <>
          <div className="border-t" />
          <div className="divide-y divide-border/50">
            {starredEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 min-h-[32px]">
                <span className="flex items-center gap-1.5 text-xs truncate min-w-0">
                  <HugeiconsIcon icon={StarIcon} className="size-3 text-warning shrink-0" />
                  <span className="truncate">{e.description}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatEventDate(e.date)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
