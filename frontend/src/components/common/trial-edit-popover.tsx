import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, InformationCircleIcon, Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { todayInLA } from "@/lib/datetime"
import { updateCase, confirmTrialDate } from "@/services/cases"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

export function getLikelihoodColor(value: number): string {
  if (value <= 30) return "text-success"
  if (value <= 60) return "text-warning-foreground"
  return "text-destructive"
}

export function formatTrialDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T00:00:00")
  const now = todayInLA()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

interface TrialEditCellProps {
  caseId: number
  trialDate: string | null
  likelihood: number | null
  likelihoodNote: string | null
  estimatedDays: number | null
  /** Hold dates offered to the court (proposed_trial_dates). */
  proposedDates?: string[] | null
}

export function TrialEditCell({
  caseId,
  trialDate,
  likelihood,
  likelihoodNote,
  estimatedDays,
  proposedDates,
}: TrialEditCellProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draftDate, setDraftDate] = useState(trialDate ?? "")
  const [draftLikelihood, setDraftLikelihood] = useState(likelihood ?? 50)
  const [draftNote, setDraftNote] = useState(likelihoodNote ?? "")
  const [draftDays, setDraftDays] = useState(estimatedDays ?? 7)
  const [hasLikelihood, setHasLikelihood] = useState(likelihood != null)

  const holds = proposedDates ?? []

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
    onError: (e) => toast.error(e.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (date: string) => confirmTrialDate(caseId, date),
    onSuccess: () => {
      invalidate()
      toast.success("Trial date confirmed")
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function addHold(date: string | null) {
    if (!date || holds.includes(date)) return
    mutation.mutate({ proposed_trial_dates: [...holds, date].sort() })
  }

  function removeHold(date: string) {
    const next = holds.filter((d) => d !== date)
    mutation.mutate({ proposed_trial_dates: next.length ? next : null })
  }

  function handleOpen(openState: boolean) {
    if (openState) {
      setDraftDate(trialDate ?? "")
      setDraftLikelihood(likelihood ?? 50)
      setDraftNote(likelihoodNote ?? "")
      setDraftDays(estimatedDays ?? 7)
      setHasLikelihood(likelihood != null)
    }
    setOpen(openState)
  }

  function handleSave() {
    mutation.mutate({
      trial_date: draftDate || null,
      trial_likelihood: hasLikelihood ? draftLikelihood : null,
      trial_likelihood_note: hasLikelihood && draftNote.trim() ? draftNote.trim() : null,
      trial_estimated_days: draftDays,
    })
    setOpen(false)
  }

  const days = daysUntil(trialDate)
  const isPast = days != null && days < 0

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/trial flex flex-col gap-0.5 text-left w-full -my-1 py-1 hover:bg-muted/50 transition-colors px-1 -mx-1"
          onClick={(e) => e.stopPropagation()}
        >
          {trialDate ? (
            <>
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    isPast ? "text-destructive font-medium text-sm" : "text-sm"
                  }
                >
                  {formatTrialDate(trialDate)}
                </span>
                <HugeiconsIcon
                  icon={PencilEdit01Icon}
                  className="size-3 shrink-0 opacity-0 group-hover/trial:opacity-50 transition-opacity"
                />
              </div>
              <div className="flex items-center gap-1.5">
                {likelihood != null ? (
                  <span className={`text-xs tabular-nums font-medium ${getLikelihoodColor(likelihood)}`}>
                    {likelihood}%
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
                {likelihoodNote && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground hover:text-foreground">
                        <HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {likelihoodNote}
                    </TooltipContent>
                  </Tooltip>
                )}
                <span className="text-muted-foreground text-[10px]">·</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {estimatedDays ?? 7}d
                </span>
              </div>
            </>
          ) : holds.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold leading-none px-1 py-px bg-warning text-warning-foreground whitespace-nowrap">
                HOLD
              </span>
              <span className="text-sm">
                {holds.length} hold{holds.length !== 1 ? "s" : ""}
              </span>
              <HugeiconsIcon
                icon={PencilEdit01Icon}
                className="size-3 shrink-0 opacity-0 group-hover/trial:opacity-50 transition-opacity"
              />
            </div>
          ) : (
            <span className="text-muted-foreground group-hover/trial:text-foreground transition-colors">
              <HugeiconsIcon
                icon={Add01Icon}
                className="size-3.5 shrink-0"
              />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Trial Date</label>
            <DatePicker
              value={draftDate || null}
              onChange={(d) => setDraftDate(d ?? "")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Holds (dates offered to court)
            </label>
            {holds.length > 0 && (
              <div className="space-y-1">
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
              </div>
            )}
            <DatePicker
              value={null}
              onChange={addHold}
              placeholder="+ Add hold date"
            />
            {holds.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Confirming a hold sets it as the trial date and releases the rest.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Est. Days</label>
            <input
              type="number"
              value={draftDays}
              onChange={(e) => setDraftDays(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={365}
              className="w-full bg-transparent border border-input px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Likelihood</label>
              {hasLikelihood ? (
                <span className={`text-sm font-medium tabular-nums ${getLikelihoodColor(draftLikelihood)}`}>
                  {draftLikelihood}%
                </span>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setHasLikelihood(true)}
                >
                  + Add
                </button>
              )}
            </div>
            {hasLikelihood && (
              <>
                <Slider
                  value={[draftLikelihood]}
                  onValueChange={([v]) => setDraftLikelihood(v)}
                  min={0}
                  max={100}
                  step={10}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </>
            )}
          </div>

          {hasLikelihood && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Note</label>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={2}
                placeholder="e.g., likely to file MSJ, case will settle..."
                className="w-full bg-transparent border border-input px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              {draftDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    mutation.mutate({
                      trial_date: null,
                      trial_likelihood: null,
                      trial_likelihood_note: null,
                    })
                    setOpen(false)
                  }}
                >
                  Clear trial
                </Button>
              )}
              {hasLikelihood && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-muted-foreground"
                  onClick={() => setHasLikelihood(false)}
                >
                  Clear likelihood
                </Button>
              )}
            </div>
            <Button size="sm" className="text-xs h-7 px-3" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
