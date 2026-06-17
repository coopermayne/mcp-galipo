import { useMemo } from "react"
import { format } from "date-fns"
import { useCasePreview } from "@/hooks/use-case-preview"
import type { TrialItem, BlockingEvent } from "@/services/trial-calendar"
import type { StaffMember } from "@/services/staff"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { getEventTypeLabel, getEventTypeColor } from "@/lib/event-types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { STALE_STATUSES } from "./trial-columns"

type Row =
  | { kind: "trial"; date: string; trial: TrialItem }
  | { kind: "event"; date: string; event: BlockingEvent }

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function TrialListMobile({
  trials,
  blockingEvents,
  staffMap,
  onEditEvent,
}: {
  trials: TrialItem[]
  blockingEvents: BlockingEvent[]
  staffMap: Map<number, StaffMember>
  onEditEvent?: (event: BlockingEvent) => void
}) {
  const { openCasePreview } = useCasePreview()

  const rows = useMemo<Row[]>(() => {
    const trialRows: Row[] = trials.map((t) => ({ kind: "trial", date: t.trial_date, trial: t }))
    const eventRows: Row[] = blockingEvents.map((e) => ({ kind: "event", date: e.date, event: e }))
    return [...trialRows, ...eventRows].sort((a, b) => a.date.localeCompare(b.date))
  }, [trials, blockingEvents])

  if (!rows.length) {
    return (
      <div className="border p-6 text-center text-sm text-muted-foreground">
        No upcoming items.
      </div>
    )
  }

  return (
    <div className="border divide-y">
      {rows.map((row) => {
        if (row.kind === "trial") {
          const t = row.trial
          const isStale = STALE_STATUSES.has(t.status)
          return (
            <button
              key={`trial-${t.case_id}`}
              type="button"
              className="flex w-full items-center gap-3 p-3 text-left active:bg-muted/50"
              onClick={() => openCasePreview(t.case_id)}
            >
              {t.attorney_ids.length > 0 && (
                <div className="flex shrink-0 gap-1">
                  {t.attorney_ids.map((id) => {
                    const s = staffMap.get(id)
                    if (!s) return null
                    return (
                      <span
                        key={id}
                        className="inline-flex size-5 shrink-0 items-center justify-center text-[9px] font-medium"
                        style={getAvatarStyleById(id)}
                        title={`${s.firstName} ${s.lastName}`}
                      >
                        {s.initials}
                      </span>
                    )
                  })}
                </div>
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  isStale && "line-through text-muted-foreground",
                )}
              >
                {t.short_name ?? t.case_name}
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                {format(parseDate(t.trial_date), "MMM d, yyyy")}
              </span>
            </button>
          )
        }

        const evt = row.event
        return (
          <button
            key={`event-${evt.id}`}
            type="button"
            className="flex w-full items-center gap-3 p-3 text-left active:bg-muted/50"
            onClick={() => onEditEvent?.(evt)}
          >
            <Badge
              variant="outline"
              className="shrink-0 border-transparent px-1.5 py-0 text-[10px] font-normal text-white"
              style={{ backgroundColor: getEventTypeColor(evt.event_type) }}
            >
              {getEventTypeLabel(evt.event_type)}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{evt.description}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {format(parseDate(evt.date), "MMM d")}
              {evt.end_date && ` – ${format(parseDate(evt.end_date), "MMM d")}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
