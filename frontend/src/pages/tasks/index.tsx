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
import { getTasks } from "@/services/tasks"
import { getColumns } from "@/pages/tasks/columns"
import {
  TaskToolbar,
  type TaskScope,
} from "@/pages/tasks/components/task-toolbar"
import { TaskListView } from "@/pages/tasks/components/task-list-view"
import type { TaskGroupBy } from "@/pages/tasks/group-tasks"

export default function TasksPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-persisted state
  const scope = (searchParams.get("scope") as TaskScope) || "mine"
  const groupBy = (searchParams.get("group") as TaskGroupBy) || "date"

  const setScope = useCallback(
    (s: TaskScope) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("scope", s)
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  const setGroupBy = useCallback(
    (g: TaskGroupBy) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("group", g)
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  // Table state (still used for filtering/sorting)
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
      params.assignee_id = user.id
    }
    return params
  }, [scope, user])

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", scope, user?.id],
    queryFn: () => getTasks(queryParams as Parameters<typeof getTasks>[0]),
    enabled: !!user,
  })

  // TanStack Table for filtering/sorting (we render list items, not a <Table>)
  const columns = useMemo(
    () =>
      getColumns({
        onTaskClick: () => {},
        onMarkDone: () => {},
        onDelete: () => {},
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const table = useReactTable({
    data: data?.tasks ?? [],
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

  const filteredTasks = table.getRowModel().rows.map((row) => row.original)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground text-sm">
          {scope === "mine"
            ? "Tasks on your cases."
            : "Tasks assigned to you."}
        </p>
      </div>

      <TaskToolbar
        table={table}
        scope={scope}
        onScopeChange={setScope}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      <TaskListView
        tasks={filteredTasks}
        isLoading={isLoading}
        groupBy={groupBy}
      />
    </div>
  )
}
