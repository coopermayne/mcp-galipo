import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { updateCase } from "@/services/cases"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

function getLikelihoodColor(value: number): string {
  if (value <= 30) return "text-success"
  if (value <= 60) return "text-warning-foreground"
  return "text-destructive"
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr + "T00:00:00")
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

interface TrialEditCellProps {
  caseId: number
  trialDate: string | null
  likelihood: number | null
  likelihoodNote: string | null
  estimatedDays: number | null
}

export function TrialEditCell({
  caseId,
  trialDate,
  likelihood,
  likelihoodNote,
  estimatedDays,
}: TrialEditCellProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draftDate, setDraftDate] = useState(trialDate ?? "")
  const [draftLikelihood, setDraftLikelihood] = useState(likelihood ?? 50)
  const [draftNote, setDraftNote] = useState(likelihoodNote ?? "")
  const [draftDays, setDraftDays] = useState(estimatedDays ?? 7)
  const [hasLikelihood, setHasLikelihood] = useState(likelihood != null)

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCase(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Trial info updated")
    },
    onError: (e) => toast.error(e.message),
  })

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
  const isUrgent = days != null && days >= 0 && days <= 90

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
                    isPast
                      ? "text-destructive font-medium text-sm"
                      : isUrgent
                        ? "text-warning-foreground font-medium text-sm"
                        : "text-sm"
                  }
                >
                  {formatDate(trialDate)}
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
          ) : (
            <span className="text-muted-foreground group-hover/trial:text-foreground transition-colors text-sm flex items-center gap-1">
              Set trial
              <HugeiconsIcon
                icon={PencilEdit01Icon}
                className="size-3 shrink-0 opacity-0 group-hover/trial:opacity-50 transition-opacity"
              />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Trial Date</label>
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="w-full bg-transparent border border-input px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
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
            <div className="ml-auto">
              <Button size="sm" className="text-xs h-7 px-3" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
