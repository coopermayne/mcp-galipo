import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { updateEvent, addAttendee, removeAttendee } from "@/services/events"
import type { EventListItem as EventListItemType } from "@/types/event"
import { EventListItem } from "@/pages/events/components/event-list-item"
import { EventDetailDialog } from "@/pages/events/components/event-detail-dialog"
import { groupEvents, type EventGroupBy } from "@/pages/events/group-events"
import { getBadgeStyle } from "@/lib/badge-colors"

interface EventListViewProps {
  events: EventListItemType[]
  isLoading?: boolean
  groupBy?: EventGroupBy
  hideCaseBadge?: boolean
  showPast?: boolean
  noBorder?: boolean
  invalidateKeys?: unknown[][]
}

export function EventListView({
  events,
  isLoading,
  groupBy = "date",
  hideCaseBadge,
  showPast,
  noBorder,
  invalidateKeys = [["events"]],
}: EventListViewProps) {
  const queryClient = useQueryClient()
  const [selectedEvent, setSelectedEvent] = useState<EventListItemType | null>(null)

  const invalidateAll = () => {
    for (const key of invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const updateFieldMutation = useMutation({
    mutationFn: ({ eventId, field, value }: { eventId: number; field: string; value: unknown }) =>
      updateEvent(eventId, { [field]: value }),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  })

  const addAttendeeMutation = useMutation({
    mutationFn: ({ eventId, userId }: { eventId: number; userId: number }) =>
      addAttendee(eventId, userId),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  })

  const removeAttendeeMutation = useMutation({
    mutationFn: ({ eventId, userId }: { eventId: number; userId: number }) =>
      removeAttendee(eventId, userId),
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  })

  const groups = useMemo(
    () => groupEvents(events, groupBy, showPast),
    [events, groupBy, showPast]
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className={noBorder ? undefined : "border border-border"}>
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                <Skeleton className="size-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <Collapsible key={group.key} defaultOpen>
              <div className="flex w-full items-center bg-muted/50 border-b border-border/50">
                <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2 hover:bg-muted transition-colors cursor-pointer">
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-3.5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90"
                  />
                  {group.caseColor ? (
                    <Badge
                      className="text-[10px] px-1.5 py-0 h-4 leading-none"
                      style={getBadgeStyle(group.caseColor)}
                    >
                      {group.label}
                    </Badge>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {group.label}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {group.events.length}
                  </span>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                {group.events.map((event) => (
                  <EventListItem
                    key={event.id}
                    event={event}
                    onEventClick={setSelectedEvent}
                    onUpdateEvent={(eventId, field, value) =>
                      updateFieldMutation.mutate({ eventId, field, value })
                    }
                    onAddAttendee={(eventId, userId) =>
                      addAttendeeMutation.mutate({ eventId, userId })
                    }
                    onRemoveAttendee={(eventId, userId) =>
                      removeAttendeeMutation.mutate({ eventId, userId })
                    }
                    hideCaseBadge={hideCaseBadge || groupBy === "case"}
                    showPast={showPast}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))
        ) : (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No events found.
          </div>
        )}
      </div>

      <EventDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
        invalidateKeys={invalidateKeys}
      />
    </TooltipProvider>
  )
}
