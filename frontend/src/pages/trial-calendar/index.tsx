import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { addMonths, startOfMonth, format } from "date-fns"
import { ArrowLeftIcon, ArrowRightIcon, PrinterIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { getTrialCalendar, downloadTrialCalendarPdf } from "@/services/trial-calendar"
import type { BlockingEvent } from "@/services/trial-calendar"
import { createEvent, type CreateEventData } from "@/services/events"
import { downloadBlob } from "@/lib/download"
import { getStaff, type StaffMember } from "@/services/staff"
import { MonthCalendarGrid } from "@/pages/trial-calendar/components/trial-timeline"
import { AddVacationDialog } from "@/pages/trial-calendar/components/add-vacation-dialog"
import { AddBlockingEventDialog } from "@/pages/trial-calendar/components/add-blocking-event-dialog"
import { EventDetailDialog } from "@/pages/events/components/event-detail-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { EventListItem } from "@/types/event"

type ViewCount = "1" | "3" | "6" | "12"

function blockingToEventListItem(evt: BlockingEvent): EventListItem {
  return {
    id: evt.id,
    case_id: evt.case_id,
    date: evt.date,
    end_date: evt.end_date,
    event_type: evt.event_type,
    description: evt.description,
    time: null,
    location: null,
    document_link: null,
    calculation_note: null,
    starred: null,
    created_at: null,
    case_name: null,
    short_name: null,
    case_color: null,
    task_count: 0,
    attendee_ids: [],
  }
}

export default function TrialCalendarPage() {
  const [viewCount, setViewCount] = useState<ViewCount>("6")
  const [offset, setOffset] = useState(0)
  const [vacationOpen, setVacationOpen] = useState(false)
  const [blockingOpen, setBlockingOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<EventListItem | null>(null)
  const [printing, setPrinting] = useState(false)
  const queryClient = useQueryClient()

  const count = Number(viewCount)

  const months = useMemo(() => {
    const today = new Date()
    return Array.from({ length: count }, (_, i) =>
      startOfMonth(addMonths(today, 1 + offset + i)),
    )
  }, [count, offset])

  const monthsAhead = Math.max(offset + count + 1, 1)
  const monthsBehind = Math.max(-offset + 1, 1)

  const { data, isLoading } = useQuery({
    queryKey: ["trial-calendar", monthsAhead, monthsBehind],
    queryFn: () => getTrialCalendar(monthsAhead, monthsBehind),
  })

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: getStaff,
    staleTime: 5 * 60 * 1000,
  })

  const staffMap = useMemo(() => {
    const map = new Map<number, StaffMember>()
    for (const s of staffData?.data ?? []) map.set(s.id, s)
    return map
  }, [staffData])

  const createEventMutation = useMutation({
    mutationFn: (eventData: CreateEventData) => createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-calendar"] })
    },
  })

  const handlePrint = useCallback(async (style: "list" | "visual") => {
    setPrinting(true)
    try {
      const blob = await downloadTrialCalendarPdf(monthsAhead, monthsBehind, style)
      downloadBlob(blob, `trial-calendar-${style}.pdf`)
    } finally {
      setPrinting(false)
    }
  }, [monthsAhead, monthsBehind])

  const handleEditEvent = useCallback(
    (eventId: number) => {
      const evt = data?.blocking_events.find((e) => e.id === eventId)
      if (evt) setEditEvent(blockingToEventListItem(evt))
    },
    [data],
  )

  const rangeLabel =
    months.length === 1
      ? format(months[0], "MMMM yyyy")
      : `${format(months[0], "MMM yyyy")} – ${format(months[months.length - 1], "MMM yyyy")}`

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trial Calendar</h1>
          <p className="text-muted-foreground text-sm">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o - count)}>
              <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOffset(0)}>
              Reset
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o + count)}>
              <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="size-4" />
            </Button>
          </div>
          <ToggleGroup
            type="single"
            value={viewCount}
            onValueChange={(v) => {
              if (v) {
                setViewCount(v as ViewCount)
                setOffset(0)
              }
            }}
            className="border"
          >
            <ToggleGroupItem value="1" className="px-3 text-xs">1mo</ToggleGroupItem>
            <ToggleGroupItem value="3" className="px-3 text-xs">3mo</ToggleGroupItem>
            <ToggleGroupItem value="6" className="px-3 text-xs">6mo</ToggleGroupItem>
            <ToggleGroupItem value="12" className="px-3 text-xs">12mo</ToggleGroupItem>
          </ToggleGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={printing}>
                <HugeiconsIcon icon={PrinterIcon} className="size-3.5" />
                {printing ? "Generating..." : "Print"}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrint("list")}>
                Print List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("visual")}>
                Print Visual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setVacationOpen(true)}>
            Add Vacation
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBlockingOpen(true)}>
            Add Event
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">Loading...</div>
      ) : data ? (
        <MonthCalendarGrid data={data} months={months} staffMap={staffMap} onEditEvent={handleEditEvent} />
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
      <EventDetailDialog
        event={editEvent}
        open={!!editEvent}
        onOpenChange={(open) => { if (!open) setEditEvent(null) }}
        invalidateKeys={[["trial-calendar"]]}
      />
    </div>
  )
}

export const Component = TrialCalendarPage
