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
import { useAuth } from "@/hooks/use-auth"
import { getEvents } from "@/services/events"
import { getColumns } from "@/pages/events/columns"
import {
  EventToolbar,
  type EventScope,
} from "@/pages/events/components/event-toolbar"
import { EventListView } from "@/pages/events/components/event-list-view"
import type { EventGroupBy } from "@/pages/events/group-events"

export default function EventsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-persisted state
  const scope = (searchParams.get("scope") as EventScope) || "mine"
  const groupBy = (searchParams.get("group") as EventGroupBy) || "date"
  const showPast = searchParams.get("past") === "true"

  const setScope = useCallback(
    (s: EventScope) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("scope", s)
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  const setGroupBy = useCallback(
    (g: EventGroupBy) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("group", g)
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  const setShowPast = useCallback(
    (show: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (show) {
          next.set("past", "true")
        } else {
          next.delete("past")
        }
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  // Table state (used for filtering/sorting)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // Build query params based on scope
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { limit: 500 }
    if (!user) return params
    if (scope === "mine") {
      params.user_id = user.id
    } else {
      params.attendee_id = user.id
    }
    if (showPast) {
      params.include_past = true
      params.past_days = 365
    }
    return params
  }, [scope, user, showPast])

  const { data, isLoading } = useQuery({
    queryKey: ["events", scope, user?.id, showPast],
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

  const filteredEvents = table
    .getRowModel()
    .rows.map((row) => row.original)
    .filter((event) => event.case_id != null)

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
      />

      <EventListView
        events={filteredEvents}
        isLoading={isLoading}
        groupBy={groupBy}
        showPast={showPast}
      />
    </div>
  )
}
