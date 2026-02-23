import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
} from "@tanstack/react-table"
import { useSearchParams } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { getTasks, updateTask, deleteTask } from "@/services/tasks"
import type { TaskListItem } from "@/types/task"
import { getColumns } from "@/pages/tasks/columns"
import {
  TaskToolbar,
  type TaskScope,
} from "@/pages/tasks/components/task-toolbar"
import { TaskDetailDialog } from "@/pages/tasks/components/task-detail-dialog"
import { DataTablePagination } from "@/components/common/data-table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

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

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null)

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
    mutationFn: (task: TaskListItem) => updateTask(task.id, { status: "Done" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task marked as done")
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (task: TaskListItem) => deleteTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      toast.success("Task deleted")
    },
    onError: (e) => toast.error(e.message),
  })

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
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

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

      <div className="border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedTask(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No tasks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />

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
