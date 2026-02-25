import { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Search01Icon,
  ArrowTurnBackwardIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"
import { getEvents } from "@/services/events"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EventListView } from "@/pages/events/components/event-list-view"
import { cn } from "@/lib/utils"

interface CaseEventsCardProps {
  caseId: number
  onAdd: () => void
  onAiAdd?: () => void
}

export function CaseEventsCard({ caseId, onAdd, onAiAdd }: CaseEventsCardProps) {
  const [search, setSearch] = useState("")
  const [showPast, setShowPast] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["events", "case", caseId, showPast],
    queryFn: () =>
      getEvents({
        case_id: caseId,
        limit: 500,
        ...(showPast && { include_past: true, past_days: 365 }),
      }),
  })

  const events = data?.events ?? []

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events
    const q = search.toLowerCase()
    return events.filter((e) =>
      e.description.toLowerCase().includes(q) ||
      (e.short_name ?? e.case_name ?? "").toLowerCase().includes(q)
    )
  }, [events, search])

  const countLabel = showPast
    ? `${events.length} total`
    : `${events.length} upcoming`

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Events
          {events.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({countLabel})
            </span>
          )}
        </CardTitle>
        <CardAction>
          {onAiAdd && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onAiAdd}
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
            </Button>
          )}
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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Filter events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPast(!showPast)}
          className={cn(
            "h-8 px-2.5 border shrink-0",
            showPast
              ? "bg-foreground text-background hover:bg-foreground hover:text-background"
              : "text-muted-foreground"
          )}
        >
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5 mr-1" />
          Past
        </Button>
      </div>
      <CardContent className="p-0">
        <EventListView
          events={filteredEvents}
          isLoading={isLoading}
          groupBy="date"
          showPast={showPast}
          hideCaseBadge
          noBorder
          invalidateKeys={[
            ["events", "case", String(caseId), showPast],
            ["events", "case", String(caseId), !showPast],
            ["events"],
            ["case", String(caseId)],
          ]}
        />
      </CardContent>
    </Card>
  )
}
