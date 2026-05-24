import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, Calendar03Icon } from "@hugeicons/core-free-icons"
import type { CaseDetail, CaseStatus } from "@/types/case"
import { updateCase } from "@/services/cases"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { TrialLikelihood } from "@/pages/cases/components/trial-likelihood"
import { cn } from "@/lib/utils"

interface CaseKeyDatesProps {
  caseData: CaseDetail
}

type CaseStage = "pre-claim" | "pre-filing" | "filed" | "resolved"

const PRE_CLAIM_STATUSES: CaseStatus[] = ["Signing Up", "Prospective", "Pre-Claim"]
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

/**
 * Determine the urgency level of a deadline date.
 * - overdue: past due
 * - imminent: within 14 days
 * - approaching: within 60 days
 * - normal: more than 60 days away
 * - none: no date set
 */
function getDateUrgency(dateStr: string | null): DateUrgency {
  if (!dateStr) return "none"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "overdue"
  if (diffDays <= 14) return "imminent"
  if (diffDays <= 60) return "approaching"
  return "normal"
}

function getDaysLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
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

const DEFAULT_TRIAL_DAYS = 7

function TrialLengthInline({ days, onSave }: { days: number | null; onSave: (v: number | null) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        const input = prompt("Trial length (days):", String(days ?? DEFAULT_TRIAL_DAYS))
        if (input === null) return
        const n = parseInt(input, 10)
        const value = isNaN(n) || n < 1 ? null : n
        if (value !== days) onSave(value)
      }}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors tabular-nums"
    >
      {days ?? DEFAULT_TRIAL_DAYS}d trial
    </button>
  )
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

  // Determine which dates to show based on stage
  const showClaimDeadline = stage === "pre-claim"
  const showFilingDeadline = stage === "pre-claim" || stage === "pre-filing"
  const showTrialInfo = stage === "filed"

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
        {/* DOI — always shown */}
        <DateRow
          label="Date of Injury"
          dateStr={caseData.date_of_injury}
          onSave={(v) => updateMutation.mutate({ date_of_injury: v })}
        />

        {/* Pre-claim: claim deadline */}
        {showClaimDeadline && (
          <DateRow
            label="Claim Deadline"
            dateStr={caseData.claim_deadline}
            onSave={(v) => updateMutation.mutate({ claim_deadline: v || null })}
            showUrgency
          />
        )}

        {/* Pre-claim & pre-filing: filing deadline (complaint_deadline) */}
        {showFilingDeadline && (
          <DateRow
            label="Filing Deadline"
            dateStr={caseData.complaint_deadline}
            onSave={(v) => updateMutation.mutate({ complaint_deadline: v || null })}
            showUrgency
          />
        )}

        {/* Filed: trial date + likelihood + length */}
        {showTrialInfo && (
          <>
            <DateRow
              label="Trial Date"
              dateStr={caseData.trial_date}
              onSave={(v) => updateMutation.mutate({ trial_date: v })}
              showUrgency
            />
            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 min-h-[32px]">
              <span className="text-xs text-muted-foreground">Trial Likelihood</span>
              <TrialLikelihood
                caseId={caseData.id}
                likelihood={caseData.trial_likelihood}
                note={caseData.trial_likelihood_note}
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 min-h-[32px]">
              <span className="text-xs text-muted-foreground">Est. Length</span>
              <TrialLengthInline
                days={caseData.trial_estimated_days}
                onSave={(v) => updateMutation.mutate({ trial_estimated_days: v })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
