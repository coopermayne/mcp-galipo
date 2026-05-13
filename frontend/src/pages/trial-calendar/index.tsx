import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTrialCalendar } from "@/services/trial-calendar"
import { createEvent, type CreateEventData } from "@/services/events"
import { TrialTimeline } from "@/pages/trial-calendar/components/trial-timeline"
import { AddVacationDialog } from "@/pages/trial-calendar/components/add-vacation-dialog"
import { AddBlockingEventDialog } from "@/pages/trial-calendar/components/add-blocking-event-dialog"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type RangeOption = "3" | "6" | "12"

export default function TrialCalendarPage() {
  const [monthsAhead, setMonthsAhead] = useState<RangeOption>("6")
  const [vacationOpen, setVacationOpen] = useState(false)
  const [blockingOpen, setBlockingOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["trial-calendar", monthsAhead],
    queryFn: () => getTrialCalendar(Number(monthsAhead), 1),
  })

  const createEventMutation = useMutation({
    mutationFn: (eventData: CreateEventData) => createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
    },
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trial Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Upcoming trials, vacations, and blocking events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={monthsAhead}
            onValueChange={(v) => v && setMonthsAhead(v as RangeOption)}
            className="border"
          >
            <ToggleGroupItem value="3" className="px-3 text-xs">
              3mo
            </ToggleGroupItem>
            <ToggleGroupItem value="6" className="px-3 text-xs">
              6mo
            </ToggleGroupItem>
            <ToggleGroupItem value="12" className="px-3 text-xs">
              12mo
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={() => setVacationOpen(true)}>
            Add Vacation
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBlockingOpen(true)}>
            Add Event
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">Loading trial calendar...</div>
      ) : data ? (
        <TrialTimeline data={data} />
      ) : null}

      <AddVacationDialog
        open={vacationOpen}
        onOpenChange={setVacationOpen}
        onSubmit={(eventData) => {
          createEventMutation.mutate(eventData)
          setVacationOpen(false)
        }}
      />
      <AddBlockingEventDialog
        open={blockingOpen}
        onOpenChange={setBlockingOpen}
        onSubmit={(eventData) => {
          createEventMutation.mutate(eventData)
          setBlockingOpen(false)
        }}
      />
    </div>
  )
}

export const Component = TrialCalendarPage
