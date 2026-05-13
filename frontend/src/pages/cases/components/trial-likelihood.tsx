import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon, PencilEdit01Icon } from "@hugeicons/core-free-icons"
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

interface TrialLikelihoodProps {
  caseId: number
  likelihood: number | null
  note: string | null
  compact?: boolean
}

export function TrialLikelihood({
  caseId,
  likelihood,
  note,
  compact,
}: TrialLikelihoodProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(likelihood ?? 50)
  const [draftNote, setDraftNote] = useState(note ?? "")

  const mutation = useMutation({
    mutationFn: (data: { trial_likelihood: number | null; trial_likelihood_note: string | null }) =>
      updateCase(caseId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["case", caseId], data.case)
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Trial likelihood updated")
    },
    onError: (e) => toast.error(e.message),
  })

  function handleOpen(openState: boolean) {
    if (openState) {
      setDraft(likelihood ?? 50)
      setDraftNote(note ?? "")
    }
    setOpen(openState)
  }

  function handleSave() {
    mutation.mutate({
      trial_likelihood: draft,
      trial_likelihood_note: draftNote.trim() || null,
    })
    setOpen(false)
  }

  function handleClear() {
    mutation.mutate({
      trial_likelihood: null,
      trial_likelihood_note: null,
    })
    setOpen(false)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {likelihood != null ? (
          <>
            <span className={`text-xs tabular-nums font-medium ${getLikelihoodColor(likelihood)}`}>
              {likelihood}%
            </span>
            {note && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                    <HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {note}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/edit flex items-center gap-1 text-xs hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {likelihood != null ? (
            <span className={`tabular-nums font-medium ${getLikelihoodColor(likelihood)}`}>
              {likelihood}%
            </span>
          ) : (
            <span className="text-muted-foreground">Set %</span>
          )}
          {note && !open && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground hover:text-foreground">
                  <HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {note}
              </TooltipContent>
            </Tooltip>
          )}
          <HugeiconsIcon
            icon={PencilEdit01Icon}
            className="size-3 shrink-0 opacity-0 group-hover/edit:opacity-50 transition-opacity"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Trial Likelihood</span>
              <span className={`text-sm font-medium tabular-nums ${getLikelihoodColor(draft)}`}>
                {draft}%
              </span>
            </div>
            <Slider
              value={[draft]}
              onValueChange={([v]) => setDraft(v)}
              min={0}
              max={100}
              step={10}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Note</span>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              rows={2}
              placeholder="e.g., likely to file MSJ, case will settle..."
              className="w-full bg-transparent border border-input px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" className="text-xs h-7 px-3" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
