import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, Calendar03Icon } from "@hugeicons/core-free-icons"
import { todayInLA } from "@/lib/datetime"
import type { CaseDetail, CaseStatus } from "@/types/case"
import { updateCase } from "@/services/cases"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { CaseTrialFields } from "@/pages/cases/components/case-trial-fields"
import { TrialEventsEditor } from "@/components/common/trial-events-editor"
import { SectionPanel } from "@/components/common/section-panel"
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
      "flex items-center justify-between gap-3 px-3 py-2 min-h-[34px]",
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

function NoteRow({
  label,
  value,
  onSave,
}: {
  label: string
  value: string | null
  onSave: (v: string) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 min-h-[34px]">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 text-right">
        <InlineEditField
          value={value ?? ""}
          onSave={onSave}
          placeholder="Add note..."
          displayClassName="text-xs text-muted-foreground justify-end"
        />
      </div>
    </div>
  )
}

function SectionCaption({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {label}
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
      complaint_deadline_note: string | null
      claim_filed_date: string | null
      claim_rejection_date: string | null
      complaint_filed_date: string | null
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

  // Which dates surface depends on the case phase (values are kept in the DB
  // even when hidden — moving the status back shows them again):
  //  • pre-claim     → Claim DL
  //  • pre-complaint → Claim filed, Claim rejected, Complaint DL + note
  //  • filed onward  → Complaint filed
  const showClaimDeadline = stage === "pre-claim"
  const showPreComplaint = stage === "pre-filing"
  const showComplaintFiled = stage === "filed" || stage === "resolved"
  const showTrialInfo = stage === "filed" || stage === "resolved"

  const stageLabel =
    stage === "pre-claim" ? "Pre-Claim"
    : stage === "pre-filing" ? "Pre-Filing"
    : stage === "filed" ? "Filed"
    : "Resolved"

  return (
    <SectionPanel
      icon={Calendar03Icon}
      title="Key Dates"
      accessory={
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {stageLabel}
        </span>
      }
    >
      {/* Dates — phase-dependent */}
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

        {showPreComplaint && (
          <>
            <DateRow
              label="Claim Filed"
              dateStr={caseData.claim_filed_date}
              onSave={(v) => updateMutation.mutate({ claim_filed_date: v || null })}
            />
            <DateRow
              label="Claim Rejected"
              dateStr={caseData.claim_rejection_date}
              onSave={(v) => updateMutation.mutate({ claim_rejection_date: v || null })}
            />
            <DateRow
              label="Complaint DL"
              dateStr={caseData.complaint_deadline}
              onSave={(v) => updateMutation.mutate({ complaint_deadline: v || null })}
              showUrgency
            />
            <NoteRow
              label="DL Note"
              value={caseData.complaint_deadline_note}
              onSave={(v) => updateMutation.mutate({ complaint_deadline_note: v || null })}
            />
          </>
        )}

        {showComplaintFiled && (
          <DateRow
            label="Complaint Filed"
            dateStr={caseData.complaint_filed_date}
            onSave={(v) => updateMutation.mutate({ complaint_filed_date: v || null })}
          />
        )}
      </div>

      {/* Trial — grouped + tinted to set it apart from the dates above */}
      {showTrialInfo && (
        <div className="border-t bg-muted/20">
          <SectionCaption label="Trial" />
          <div className="px-3 pb-3">
            <CaseTrialFields
              key={caseData.id}
              caseId={caseData.id}
              trialDate={caseData.trial_date}
              likelihood={caseData.trial_likelihood}
              likelihoodNote={caseData.trial_likelihood_note}
              estimatedDays={caseData.trial_estimated_days}
              proposedDates={caseData.proposed_trial_dates}
            />
          </div>

          {/* Trial calendar events (FPTC, PTC, TRC, MIL…) — independent of the
              trial date, since an FPTC often precedes (or sets) the trial date. */}
          <div className="border-t border-border/40 px-3 py-2.5">
            <TrialEventsEditor caseId={caseData.id} />
          </div>
        </div>
      )}
    </SectionPanel>
  )
}
