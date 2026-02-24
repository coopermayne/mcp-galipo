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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { getTasks, updateTask, deleteTask } from "@/services/tasks"
import type { TaskListItem as TaskListItemType } from "@/types/task"
import { getColumns } from "@/pages/tasks/columns"
import {
  TaskToolbar,
  type TaskScope,
} from "@/pages/tasks/components/task-toolbar"
import { TaskDetailDialog } from "@/pages/tasks/components/task-detail-dialog"
import { TaskListItem } from "@/pages/tasks/components/task-list-item"

export default function TasksPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-persisted state
  const scope = (searchParams.get("scope") as TaskScope) || "mine"
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

  // Table state (still used for filtering/sorting)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [selectedTask, setSelectedTask] = useState<TaskListItemType | null>(null)

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

  // Mutations
  const markDoneMutation = useMutation({
    mutationFn: (task: TaskListItemType) => updateTask(task.id, { status: "Done" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task marked as done")
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (task: TaskListItemType) => deleteTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const updateFieldMutation = useMutation({
    mutationFn: ({ taskId, field, value }: { taskId: number; field: string; value: unknown }) =>
      updateTask(taskId, { [field]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
    onError: (e) => toast.error(e.message),
  })

  // TanStack Table for filtering/sorting (we render list items, not a <Table>)
  const columns = useMemo(
    () =>
      getColumns({
        onTaskClick: setSelectedTask,
        onMarkDone: (task) => markDoneMutation.mutate(task),
        onDelete: (task) => deleteMutation.mutate(task),
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

      <TaskToolbar table={table} scope={scope} onScopeChange={setScope} />

      {/* Task list */}
      <TooltipProvider delayDuration={300}>
        <div className="border border-border">
          {isLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                  <Skeleton className="size-5 shrink-0 mt-0.5" />
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
          ) : filteredTasks.length ? (
            filteredTasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                onTaskClick={setSelectedTask}
                onMarkDone={(t) => markDoneMutation.mutate(t)}
                onDelete={(t) => deleteMutation.mutate(t)}
                onUpdateTask={(taskId, field, value) =>
                  updateFieldMutation.mutate({ taskId, field, value })
                }
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No tasks found.
            </div>
          )}
        </div>
      </TooltipProvider>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
      />
    </div>
  )
}
