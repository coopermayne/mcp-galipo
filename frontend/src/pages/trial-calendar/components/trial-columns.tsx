import { format } from "date-fns"
import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { NoteIcon } from "@hugeicons/core-free-icons"
import type { TrialItem, BlockingEvent } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { getEventTypeLabel, getEventTypeColor } from "@/lib/event-types"
import { TrialEditCell } from "@/components/common/trial-edit-popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

export type CalendarTableRow =
  | { kind: "trial"; date: string; trial: TrialItem }
  | { kind: "event"; date: string; event: BlockingEvent }

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const STALE_STATUSES = new Set(["Settl. Pend.", "Closed"])

export function getTrialColumns(options: {
  staffMap: Map<number, StaffMember>
  isMobile?: boolean
}): ColumnDef<CalendarTableRow>[] {
  return [
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
    {
      id: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        if (row.original.kind === "trial") {
          const { case_name, short_name, status } = row.original.trial
          const isStale = STALE_STATUSES.has(status)
          const displayName = options.isMobile && short_name ? short_name : case_name
          const truncated = displayName.length > 35 ? `${displayName.slice(0, 35)}…` : displayName
          return (
            <div className="flex items-center gap-2">
              {displayName.length > 35 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium">{truncated}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-md text-xs">
                    {case_name}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="font-medium">{displayName}</span>
              )}
              {isStale && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 bg-warning/15 text-warning-foreground border border-warning/30">
                      {status}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Case is {status.toLowerCase()} — consider updating trial likelihood or removing trial date
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        }
        const evt = row.original.event
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-normal border-transparent text-white"
              style={{ backgroundColor: getEventTypeColor(evt.event_type) }}
            >
              {getEventTypeLabel(evt.event_type)}
            </Badge>
            <span className="text-muted-foreground">{evt.description}</span>
            {evt.notes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <HugeiconsIcon icon={NoteIcon} className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap text-xs">
                  {evt.notes}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      id: "trial",
      accessorFn: (row) => row.date,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trial" />
      ),
      cell: ({ row }) => {
        if (row.original.kind === "trial") {
          const t = row.original.trial
          return (
            <TrialEditCell
              caseId={t.case_id}
              trialDate={t.trial_date}
              likelihood={t.trial_likelihood}
              likelihoodNote={t.trial_likelihood_note}
              estimatedDays={t.trial_estimated_days}
            />
          )
        }
        const evt = row.original.event
        const dateStr = row.original.date
        if (evt.end_date) {
          return (
            <span>
              {format(parseDate(dateStr), "MMM d, yyyy")}
              {" – "}
              {format(parseDate(evt.end_date), "MMM d, yyyy")}
            </span>
          )
        }
        return <span>{format(parseDate(dateStr), "MMM d, yyyy")}</span>
      },
      sortingFn: (a, b) => a.original.date.localeCompare(b.original.date),
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
  ]
}
