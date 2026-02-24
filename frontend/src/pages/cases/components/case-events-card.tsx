import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
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
import { EventListView } from "@/pages/events/components/event-list-view"

interface CaseEventsCardProps {
  caseId: number
  onAdd: () => void
}

export function CaseEventsCard({ caseId, onAdd }: CaseEventsCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["events", "case", caseId],
    queryFn: () => getEvents({ case_id: caseId, limit: 500 }),
  })

  const events = data?.events ?? []
  const upcomingCount = events.length

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>
          Events
          {upcomingCount > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({upcomingCount} upcoming)
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
      <CardContent className="p-0">
        <EventListView
          events={events}
          isLoading={isLoading}
          groupBy="date"
          hideCaseBadge
          noBorder
          invalidateKeys={[["events", "case", String(caseId)], ["events"], ["case", String(caseId)]]}
        />
      </CardContent>
    </Card>
  )
}
