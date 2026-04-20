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
import { AddTaskDialog } from "@/pages/tasks/components/add-task-dialog"
import { TaskChatDialog } from "@/pages/tasks/components/task-chat-dialog"
import type { TaskGroupBy } from "@/pages/tasks/group-tasks"

export default function TasksPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-persisted state
  const scope = (searchParams.get("scope") as TaskScope) || "mine"
  const groupBy = (searchParams.get("group") as TaskGroupBy) || "date"
  const showDone = searchParams.get("done") === "true"

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

  const setShowDone = useCallback(
    (show: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (show) {
          next.set("done", "true")
        } else {
          next.delete("done")
        }
        return next
      }, { replace: true })
    },
    [setSearchParams]
  )

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [chatDialogOpen, setChatDialogOpen] = useState(false)

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
    if (showDone) {
      params.status = "Done"
    } else {
      params.exclude_status = "Done"
    }
    return params
  }, [scope, user, showDone])

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", scope, user?.id, showDone],
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
        showDone={showDone}
        onShowDoneChange={setShowDone}
        onAddManual={() => setAddDialogOpen(true)}
        onAddAI={() => setChatDialogOpen(true)}
      />

      <TaskListView
        tasks={filteredTasks}
        isLoading={isLoading}
        groupBy={groupBy}
        showDone={showDone}
      />

      <AddTaskDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <TaskChatDialog open={chatDialogOpen} onOpenChange={setChatDialogOpen} />
    </div>
  )
}
