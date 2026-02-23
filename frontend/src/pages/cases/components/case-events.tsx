import { useMemo } from "react"
import type { CaseEvent } from "@/types/case"

interface CaseEventsProps {
  events: CaseEvent[]
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatEventDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CaseEvents({ events }: CaseEventsProps) {
  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return events
      .filter((e) => parseLocalDate(e.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [events])

  const past = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return events
      .filter((e) => parseLocalDate(e.date) < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [events])

  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Events
        {events.length > 0 && (
          <span className="ml-1 text-xs font-normal opacity-60">
            ({upcoming.length} upcoming)
          </span>
        )}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events.</p>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              {upcoming.map((e) => (
                <div key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="text-muted-foreground tabular-nums shrink-0 w-[90px]">
                    {formatEventDate(e.date)}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium">{e.description}</span>
                    {e.location && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        @ {e.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground mb-1.5">Recent past</p>
              {past.map((e) => (
                <div key={e.id} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="tabular-nums shrink-0 w-[90px]">
                    {formatEventDate(e.date)}
                  </span>
                  <span className="line-through">{e.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
