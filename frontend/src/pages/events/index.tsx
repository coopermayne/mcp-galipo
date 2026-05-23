import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { getEvents } from "@/services/events"
import { exportEventsIcs } from "@/services/events-export"
import { getColumns } from "@/pages/events/columns"
import {
  EventToolbar,
  type EventScope,
  type EventView,
} from "@/pages/events/components/event-toolbar"
import { EventListView } from "@/pages/events/components/event-list-view"
import { CalendarView } from "@/pages/events/components/calendar-view"
import { EventDetailDialog } from "@/pages/events/components/event-detail-dialog"
import { AddEventFromCalendarDialog } from "@/pages/events/components/add-event-from-calendar-dialog"
import type { EventListItem } from "@/types/event"
import type { EventGroupBy } from "@/pages/events/group-events"

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function EventsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-persisted state
  const scope = (searchParams.get("scope") as EventScope) || "mine"
  const groupBy = (searchParams.get("group") as EventGroupBy) || "date"
  const showPast = searchParams.get("past") === "true"
  const view = (searchParams.get("view") as EventView) || "list"

  const setScope = useCallback(
    (s: EventScope) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set("scope", s)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setGroupBy = useCallback(
    (g: EventGroupBy) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set("group", g)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setShowPast = useCallback(
    (show: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (show) next.set("past", "true")
          else next.delete("past")
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setView = useCallback(
    (v: EventView) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === "list") next.delete("view")
          else next.set("view", v)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Calendar cursor (not URL-persisted; ephemeral)
  const [cursor, setCursor] = useState<Date>(new Date())

  // Event detail / create dialog state
  const [selectedEvent, setSelectedEvent] = useState<EventListItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<string | null>(null)

  // Table state (used for filtering/sorting in list mode)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // For calendar views we want a wider window of events than the list default.
  const isCalendar = view !== "list"
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { limit: 1000 }
    if (!user) return params
    if (scope === "mine") {
      params.user_id = user.id
    } else {
      params.attendee_id = user.id
    }
    if (showPast || isCalendar) {
      params.include_past = true
      params.past_days = isCalendar ? 365 : 365
    }
    return params
  }, [scope, user, showPast, isCalendar])

  const { data, isLoading } = useQuery({
    queryKey: ["events", scope, user?.id, showPast || isCalendar],
    queryFn: () => getEvents(queryParams as Parameters<typeof getEvents>[0]),
    enabled: !!user,
  })

  const columns = useMemo(() => getColumns(), [])

  const table = useReactTable({
    data: data?.events ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const filteredEvents = table.getRowModel().rows.map((row) => row.original)
  // Calendar always shows the full set (filtering is via case/date paging)
  const calendarEvents = data?.events ?? []

  const handleExport = useCallback(async () => {
    try {
      const events = isCalendar ? calendarEvents : filteredEvents
      const ids = events.map((e) => e.id)
      if (!ids.length) {
        toast.error("No events to export")
        return
      }
      await exportEventsIcs(ids)
      toast.success(`Exported ${ids.length} event${ids.length === 1 ? "" : "s"}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    }
  }, [filteredEvents, calendarEvents, isCalendar])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground text-sm">
          {scope === "mine"
            ? "Events and deadlines on your cases."
            : "Events and deadlines you're attending."}
        </p>
      </div>

      <EventToolbar
        table={table}
        scope={scope}
        onScopeChange={setScope}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showPast={showPast}
        onShowPastChange={setShowPast}
        view={view}
        onViewChange={setView}
        onExport={handleExport}
        onAddEvent={() => {
          setCreateDate(formatLocalDate(new Date()))
          setCreateOpen(true)
        }}
      />

      {view === "list" ? (
        <EventListView
          events={filteredEvents}
          isLoading={isLoading}
          groupBy={groupBy}
          showPast={showPast}
        />
      ) : (
        <CalendarView
          events={calendarEvents}
          mode={view}
          cursor={cursor}
          onCursorChange={setCursor}
          onEventClick={setSelectedEvent}
          onDateClick={(d) => {
            setCreateDate(formatLocalDate(d))
            setCreateOpen(true)
          }}
        />
      )}

      <EventDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
      />

      <AddEventFromCalendarDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDate={createDate}
      />
    </div>
  )
}
