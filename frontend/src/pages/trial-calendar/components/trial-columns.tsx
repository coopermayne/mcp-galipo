import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import type { ColumnDef } from "@tanstack/react-table"
import type { TrialItem, BlockingEvent } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { getAvatarStyleById } from "@/lib/badge-colors"
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
import { Badge } from "@/components/ui/badge"

export type CalendarTableRow =
  | { kind: "trial"; date: string; trial: TrialItem }
  | { kind: "event"; date: string; event: BlockingEvent }

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function getLikelihoodColor(value: number): string {
  if (value <= 30) return "text-success"
  if (value <= 60) return "text-warning-foreground"
  return "text-destructive"
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  hearing: "Hearing",
  oral_argument: "Oral Argument",
  conference: "Conference",
  other: "Event",
}

function DurationEditCell({ caseId, days }: { caseId: number; days: number | null }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(days ?? 5)

  const mutation = useMutation({
    mutationFn: (val: number) => updateCase(caseId, { trial_estimated_days: val }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Duration updated")
    },
    onError: (e) => toast.error(e.message),
  })

  function handleOpen(state: boolean) {
    if (state) setDraft(days ?? 5)
    setOpen(state)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/edit flex items-center gap-1 text-left -my-1 py-1 px-1 -mx-1 hover:bg-muted/50 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {days ? (
            <span>{days}d</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <HugeiconsIcon
            icon={PencilEdit01Icon}
            className="size-3 shrink-0 opacity-0 group-hover/edit:opacity-50 transition-opacity"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Est. Days</label>
          <input
            type="number"
            value={draft}
            onChange={(e) => setDraft(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={60}
            className="w-full bg-transparent border border-input px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring tabular-nums"
          />
          <Button
            size="sm"
            className="w-full text-xs h-7"
            onClick={() => {
              mutation.mutate(draft)
              setOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function LikelihoodEditCell({
  caseId,
  likelihood,
  likelihoodNote,
}: {
  caseId: number
  likelihood: number | null
  likelihoodNote: string | null
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(likelihood ?? 50)
  const [draftNote, setDraftNote] = useState(likelihoodNote ?? "")

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCase(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      toast.success("Likelihood updated")
    },
    onError: (e) => toast.error(e.message),
  })

  function handleOpen(state: boolean) {
    if (state) {
      setDraft(likelihood ?? 50)
      setDraftNote(likelihoodNote ?? "")
    }
    setOpen(state)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/edit flex items-center gap-1.5 text-left -my-1 py-1 px-1 -mx-1 hover:bg-muted/50 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {likelihood != null ? (
            <>
              <div className="h-1.5 w-10 bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground/60"
                  style={{ width: `${likelihood}%` }}
                />
              </div>
              <span className={`text-xs tabular-nums font-medium ${getLikelihoodColor(likelihood)}`}>
                {likelihood}%
              </span>
              {likelihoodNote && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {likelihoodNote}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <HugeiconsIcon
            icon={PencilEdit01Icon}
            className="size-3 shrink-0 opacity-0 group-hover/edit:opacity-50 transition-opacity"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Likelihood</label>
            <span className={`text-sm font-medium tabular-nums ${getLikelihoodColor(draft)}`}>
              {draft}%
            </span>
          </div>
          <Slider
            value={[draft]}
            onValueChange={([v]) => setDraft(v)}
            min={0}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
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
          <Button
            size="sm"
            className="w-full text-xs h-7"
            onClick={() => {
              mutation.mutate({
                trial_likelihood: draft,
                trial_likelihood_note: draftNote.trim() || null,
              })
              setOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function getTrialColumns(options: {
  staffMap: Map<number, StaffMember>
}): ColumnDef<CalendarTableRow>[] {
  return [
    {
      id: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        if (row.original.kind === "trial") {
          const { color, case_name } = row.original.trial
          return (
            <div className="flex items-center gap-2">
              {color && (
                <span
                  className="inline-block size-2.5 shrink-0"
                  style={{ backgroundColor: `var(--palette-${color})` }}
                />
              )}
              <span className="font-medium">{case_name}</span>
            </div>
          )
        }
        const evt = row.original.event
        const typeLabel = EVENT_TYPE_LABELS[evt.event_type] ?? evt.event_type
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant={evt.event_type === "vacation" ? "secondary" : "outline"}
              className="text-[10px] px-1.5 py-0 font-normal"
            >
              {typeLabel}
            </Badge>
            <span className="text-muted-foreground">{evt.description}</span>
          </div>
        )
      },
    },
    {
      id: "date",
      accessorFn: (row) => row.date,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => {
        const dateStr = row.original.date
        if (row.original.kind === "event" && row.original.event.end_date) {
          return (
            <span>
              {format(parseDate(dateStr), "MMM d, yyyy")}
              {" – "}
              {format(parseDate(row.original.event.end_date), "MMM d, yyyy")}
            </span>
          )
        }
        return <span>{format(parseDate(dateStr), "MMM d, yyyy")}</span>
      },
      sortingFn: (a, b) => a.original.date.localeCompare(b.original.date),
    },
    {
      id: "duration",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Duration" />
      ),
      cell: ({ row }) => {
        if (row.original.kind !== "trial") {
          const evt = row.original.event
          if (evt.end_date) {
            const start = parseDate(evt.date)
            const end = parseDate(evt.end_date)
            const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
            return <span className="text-muted-foreground">{days}d</span>
          }
          return <span className="text-muted-foreground">1d</span>
        }
        return (
          <DurationEditCell
            caseId={row.original.trial.case_id}
            days={row.original.trial.trial_estimated_days}
          />
        )
      },
    },
    {
      id: "likelihood",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Likelihood" />
      ),
      cell: ({ row }) => {
        if (row.original.kind !== "trial") return null
        return (
          <LikelihoodEditCell
            caseId={row.original.trial.case_id}
            likelihood={row.original.trial.trial_likelihood}
            likelihoodNote={row.original.trial.trial_likelihood_note}
          />
        )
      },
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        if (row.original.kind !== "trial") return null
        const { case_number, jurisdiction_name, judge_names } = row.original.trial
        if (!case_number && !jurisdiction_name && !judge_names) {
          return <span className="text-muted-foreground">—</span>
        }
        const parts: string[] = []
        if (jurisdiction_name) parts.push(jurisdiction_name)
        if (judge_names) parts.push(`Judge ${judge_names}`)
        return (
          <div className="flex items-center gap-1.5 text-xs">
            {case_number && (
              <span className="font-mono">{case_number}</span>
            )}
            {parts.length > 0 && (
              <span className="text-muted-foreground">
                ({parts.join(", ")})
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: "team",
      header: "Team",
      cell: ({ row }) => {
        if (row.original.kind !== "trial") return null
        const ids = row.original.trial.attorney_ids
        if (!ids.length) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex gap-1">
            {ids.map((id) => {
              const s = options.staffMap.get(id)
              if (!s) return null
              return (
                <span
                  key={id}
                  className="inline-flex size-5 items-center justify-center text-[9px] font-medium shrink-0"
                  style={getAvatarStyleById(id)}
                  title={`${s.firstName} ${s.lastName}`}
                >
                  {s.initials}
                </span>
              )
            })}
          </div>
        )
      },
    },
  ]
}
