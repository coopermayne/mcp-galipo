import { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, StarIcon } from "@hugeicons/core-free-icons"
import type { CaseEvent } from "@/types/case"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface CaseEventsCardProps {
  events: CaseEvent[]
  onAdd: () => void
}

export function CaseEventsCard({ events, onAdd }: CaseEventsCardProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => parseLocalDate(e.date) >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events, today]
  )

  const past = useMemo(
    () =>
      events
        .filter((e) => parseLocalDate(e.date) < today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [events, today]
  )

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Events
          {upcoming.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({upcoming.length} upcoming)
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onAdd}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No events.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.length > 0 && (
              <div className="space-y-1">
                {upcoming.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 py-1 text-xs">
                    <span className="text-muted-foreground tabular-nums shrink-0 w-[80px]">
                      {formatDate(e.date)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{e.description}</span>
                      {e.location && (
                        <span className="text-muted-foreground ml-1">
                          @ {e.location}
                        </span>
                      )}
                    </div>
                    {e.starred && (
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-3 text-warning shrink-0 mt-0.5"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="pt-1 border-t">
                <p className="text-xs text-muted-foreground mb-1">Recent past</p>
                {past.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-2 py-1 text-xs text-muted-foreground"
                  >
                    <span className="tabular-nums shrink-0 w-[80px]">
                      {formatDate(e.date)}
                    </span>
                    <span className="line-through">{e.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
