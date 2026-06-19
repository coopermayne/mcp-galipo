import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { updateCase, confirmTrialDate } from "@/services/cases"
import { getLikelihoodColor, formatTrialDate } from "@/components/common/trial-edit-popover"
import { DatePicker } from "@/components/ui/date-picker"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Aligned label-left field row used across the trial editor. */
function Field({
  label,
  align = "center",
  children,
}: {
  label: string
  align?: "center" | "start"
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex gap-3", align === "start" ? "items-start" : "items-center")}>
      <span
        className={cn(
          "w-20 shrink-0 whitespace-nowrap text-xs text-muted-foreground",
          align === "start" && "pt-1.5"
        )}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

/** Default likelihood applied when a trial date is first set. */
const DEFAULT_LIKELIHOOD = 100

interface CaseTrialFieldsProps {
  caseId: number
  trialDate: string | null
  likelihood: number | null
  likelihoodNote: string | null
  estimatedDays: number | null
  /** Hold dates offered to the court (proposed_trial_dates). */
  proposedDates?: string[] | null
}

/**
 * Inline trial editor for the Key Dates panel. Each field commits on its own
 * (date picker on change, days/reason on blur, likelihood on slider commit) —
 * no bundled edit popover. Holds are hidden until needed (a "holds" link
 * reveals the entry area) but show automatically when any exist. Once a trial
 * date is set, est. days, likelihood (default 100%) and reason all appear.
 */
export function CaseTrialFields({
  caseId,
  trialDate,
  likelihood,
  likelihoodNote,
  estimatedDays,
  proposedDates,
}: CaseTrialFieldsProps) {
  const queryClient = useQueryClient()
  const holds = proposedDates ?? []

  const [daysDraft, setDaysDraft] = useState(estimatedDays ?? 7)
  const [likeDraft, setLikeDraft] = useState(likelihood ?? DEFAULT_LIKELIHOOD)
  const [noteDraft, setNoteDraft] = useState(likelihoodNote ?? "")
  const [holdsOpen, setHoldsOpen] = useState(false)

  const showHolds = holds.length > 0 || holdsOpen

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cases"] })
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
    queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
  }

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCase(caseId, data),
    onSuccess: () => {
      invalidate()
      toast.success("Trial info updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (date: string) => confirmTrialDate(caseId, date),
    onSuccess: () => {
      invalidate()
      toast.success("Trial date confirmed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleTrialDateChange(d: string | null) {
    if (!d) {
      // Clearing the trial date also clears likelihood + reason.
      mutation.mutate({ trial_date: null, trial_likelihood: null, trial_likelihood_note: null })
      return
    }
    // Setting a trial date establishes the default likelihood if none yet.
    if (likelihood == null) {
      mutation.mutate({ trial_date: d, trial_likelihood: DEFAULT_LIKELIHOOD })
    } else {
      mutation.mutate({ trial_date: d })
    }
  }

  function addHold(date: string | null) {
    if (!date || holds.includes(date)) return
    mutation.mutate({ proposed_trial_dates: [...holds, date].sort() })
  }

  function removeHold(date: string) {
    const next = holds.filter((d) => d !== date)
    mutation.mutate({ proposed_trial_dates: next.length ? next : null })
  }

  function commitDays() {
    if (daysDraft !== (estimatedDays ?? 7)) {
      mutation.mutate({ trial_estimated_days: daysDraft })
    }
  }

  function commitNote() {
    const v = noteDraft.trim()
    if (v !== (likelihoodNote ?? "")) {
      mutation.mutate({ trial_likelihood_note: v || null })
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Trial date · days · holds */}
      <Field label="Trial date">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          <div className="min-w-[150px] flex-1">
            <DatePicker value={trialDate || null} onChange={handleTrialDateChange} />
          </div>
          {trialDate && (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                value={daysDraft}
                onChange={(e) => setDaysDraft(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={commitDays}
                min={1}
                max={365}
                className="w-12 bg-transparent border border-input px-1.5 py-1 text-sm text-center outline-none focus:ring-1 focus:ring-ring tabular-nums"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}
          {holds.length === 0 && (
            <button
              type="button"
              onClick={() => setHoldsOpen((v) => !v)}
              className="shrink-0 flex items-center gap-0.5 text-xs text-info hover:text-info/80 border border-info/40 hover:border-info/70 hover:bg-info/10 px-1.5 py-1 transition-colors"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className={cn("size-3 transition-transform", holdsOpen && "rotate-90")}
              />
              Holds
            </button>
          )}
        </div>
      </Field>

      {/* Holds — shown when any exist, or toggled open via the link */}
      {showHolds && (
        <Field label="Holds" align="start">
          <div className="flex-1 min-w-0 space-y-1">
            {holds.map((d) => (
              <div
                key={d}
                className="flex items-center gap-1 border border-input px-2 py-1"
              >
                <span className="text-xs flex-1 tabular-nums">
                  {formatTrialDate(d)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(d)}
                >
                  Confirm
                </Button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeHold(d)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </button>
              </div>
            ))}
            <DatePicker value={null} onChange={addHold} placeholder="+ Add hold date" />
            {holds.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Confirming a hold sets it as the trial date and releases the rest.
              </p>
            )}
          </div>
        </Field>
      )}

      {trialDate && (
        <>
          {/* Likelihood — always shown once a trial date is set (default 100%) */}
          <Field label="Likelihood">
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <Slider
                className="flex-1"
                value={[likeDraft]}
                onValueChange={([v]) => setLikeDraft(v)}
                onValueCommit={([v]) => mutation.mutate({ trial_likelihood: v })}
                min={0}
                max={100}
                step={10}
              />
              <span className={cn("w-9 text-right text-sm font-medium tabular-nums", getLikelihoodColor(likeDraft))}>
                {likeDraft}%
              </span>
            </div>
          </Field>

          {/* Reason — always shown once a trial date is set */}
          <Field label="Reason" align="start">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={commitNote}
              rows={2}
              placeholder="e.g., likely to file MSJ, case will settle..."
              className="flex-1 min-w-0 bg-transparent border border-input px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </Field>
        </>
      )}
    </div>
  )
}
