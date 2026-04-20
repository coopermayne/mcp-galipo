import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
  type RowSelectionState,
  flexRender,
} from "@tanstack/react-table"
import { useNavigate, useSearchParams } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getIntakes, getIntakeCounts, getUnreadCounts, syncIntakes, createIntake, bulkArchiveByStatus, exportIntakesBatch, type CreateIntakeData } from "@/services/intakes"
import { getColumns, intakeGlobalFilterFn, getSearchRank } from "@/pages/intakes/columns"
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
import { DataTablePagination } from "@/components/common/data-table-pagination"
import type { ListNavState } from "@/components/common/list-nav"

export default function IntakesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const selectedStatus = searchParams.get("status")
  const setSelectedStatus = useCallback(
    (status: string | null) => {
      setSearchParams(status ? { status } : {}, { replace: true })
    },
    [setSearchParams]
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isPrintingBatch, setIsPrintingBatch] = useState(false)

  const { data: intakesData, isLoading } = useQuery({
    queryKey: ["intakes", selectedStatus],
    queryFn: () =>
      getIntakes({
        status: selectedStatus ?? undefined,
        limit: 2000,
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

  const bulkArchiveMutation = useMutation({
    mutationFn: () => bulkArchiveByStatus("Rejection Letter Sent"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      queryClient.invalidateQueries({ queryKey: ["intake-counts"] })
      queryClient.invalidateQueries({ queryKey: ["unread-counts"] })
      if (data.count > 0) {
        toast.success(`Archived ${data.count} rejected intake${data.count === 1 ? "" : "s"}`)
      } else {
        toast.info("No rejected intakes to archive")
      }
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

  const columns = useMemo(
    () =>
      getColumns({
        unreadCounts: unreadCounts ?? {},
        selectionMode,
      }),
    [unreadCounts, selectionMode]
  )

  const sortedData = useMemo(() => {
    const intakes = intakesData?.intakes ?? []
    if (!globalFilter) return intakes
    return [...intakes].sort(
      (a, b) => getSearchRank(b, globalFilter) - getSearchRank(a, globalFilter)
    )
  }, [intakesData, globalFilter])

  const table = useReactTable({
    data: sortedData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectionMode,
    globalFilterFn: intakeGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setRowSelection({})
      return !prev
    })
  }, [])

  const handlePrintSelected = useCallback(async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const ids = selectedRows.map((r) => r.original.id)
    if (ids.length === 0) return
    setIsPrintingBatch(true)
    try {
      await exportIntakesBatch(ids)
      toast.success(`Generated PDF for ${ids.length} intake${ids.length === 1 ? '' : 's'}`)
    } catch {
      toast.error("Failed to generate batch PDF")
    } finally {
      setIsPrintingBatch(false)
    }
  }, [table])

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
        onBulkArchiveRejected={() => bulkArchiveMutation.mutate()}
        isBulkArchiving={bulkArchiveMutation.isPending}
        selectedStatus={selectedStatus}
        selectionMode={selectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
        onPrintSelected={handlePrintSelected}
        isPrintingBatch={isPrintingBatch}
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    if (selectionMode) {
                      row.toggleSelected(!row.getIsSelected())
                      return
                    }
                    const rows = table.getRowModel().rows
                    const listIds = rows.map((r) => r.original.id)
                    const listIndex = rows.findIndex((r) => r.id === row.id)
                    navigate(`/intakes/${row.original.id}`, {
                      state: { listIds, listIndex, listPath: `/intakes${window.location.search}` } satisfies ListNavState,
                    })
                  }}
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
                  No intakes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} pageSizes={[20, 50, 100]} />
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
