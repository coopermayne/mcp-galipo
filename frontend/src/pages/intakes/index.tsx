import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
} from "@tanstack/react-table"
import { useNavigate } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getIntakes, getIntakeCounts, getUnreadCounts, syncIntakes, createIntake, type CreateIntakeData } from "@/services/intakes"
import { getColumns } from "@/pages/intakes/columns"
import { IntakePipelines } from "@/pages/intakes/components/intake-pipelines"
import { IntakeToolbar } from "@/pages/intakes/components/intake-toolbar"
import { IntakeFormDialog } from "@/pages/intakes/components/intake-form-dialog"
import { IntakeChatDialog } from "@/pages/intakes/components/intake-chat-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export default function IntakesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [formOpen, setFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const { data: intakesData, isLoading } = useQuery({
    queryKey: ["intakes", selectedStatus],
    queryFn: () =>
      getIntakes({
        status: selectedStatus ?? undefined,
        limit: 200,
        exclude_archived: selectedStatus === null,
      }),
  })

  const { data: counts } = useQuery({
    queryKey: ["intake-counts"],
    queryFn: getIntakeCounts,
  })

  const intakeIds = useMemo(
    () => intakesData?.intakes.map((i) => i.id) ?? [],
    [intakesData]
  )

  const { data: unreadCounts } = useQuery({
    queryKey: ["unread-counts", intakeIds],
    queryFn: () => getUnreadCounts(intakeIds),
    enabled: intakeIds.length > 0,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateIntakeData) => createIntake(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      queryClient.invalidateQueries({ queryKey: ["intake-counts"] })
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] })
      toast.success("Intake created")
      setFormOpen(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const syncMutation = useMutation({
    mutationFn: syncIntakes,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      queryClient.invalidateQueries({ queryKey: ["intake-counts"] })
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] })
      if (data.imported > 0) {
        toast.success(
          `Imported ${data.imported} new intake${data.imported === 1 ? "" : "s"}` +
            (data.skipped > 0 ? `, ${data.skipped} already existed` : "")
        )
      } else {
        toast.info("No new intakes to import — everything is up to date.")
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const onView = useCallback(
    (intake: { id: number }) => navigate(`/intakes/${intake.id}`),
    [navigate]
  )

  const columns = useMemo(
    () =>
      getColumns({
        onView,
        onDelete: (intake) => {
          // TODO: confirm dialog + delete mutation
          console.log("Delete intake", intake.id)
        },
        unreadCounts: unreadCounts ?? {},
      }),
    [onView, unreadCounts]
  )

  const table = useReactTable({
    data: intakesData?.intakes ?? [],
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
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intakes</h1>
        <p className="text-muted-foreground text-sm">
          Review and manage incoming case intakes.
        </p>
      </div>

      <IntakePipelines
        counts={counts}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />

      <IntakeToolbar
        table={table}
        onSync={() => syncMutation.mutate()}
        isSyncing={syncMutation.isPending}
        onNewIntake={() => setFormOpen(true)}
        onNewIntakeChat={() => setChatOpen(true)}
      />

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
                <TableRow key={row.id}>
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
                  No intakes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <IntakeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
      <IntakeChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  )
}
