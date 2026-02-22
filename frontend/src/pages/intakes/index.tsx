import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
} from "@tanstack/react-table"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getIntakes, getIntakeCounts, syncIntakes } from "@/services/intakes"
import { getColumns } from "@/pages/intakes/columns"
import { IntakeToolbar } from "@/pages/intakes/components/intake-toolbar"
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

export default function IntakesPage() {
  const queryClient = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const { data: intakesData, isLoading } = useQuery({
    queryKey: ["intakes", selectedStatus],
    queryFn: () =>
      getIntakes({
        status: selectedStatus ?? undefined,
        limit: 200,
      }),
  })

  const { data: counts } = useQuery({
    queryKey: ["intake-counts"],
    queryFn: getIntakeCounts,
  })

  const syncMutation = useMutation({
    mutationFn: syncIntakes,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      queryClient.invalidateQueries({ queryKey: ["intake-counts"] })
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
        onView: (intake) => {
          // TODO: open detail sheet/modal
          console.log("View intake", intake.id)
        },
        onDelete: (intake) => {
          // TODO: confirm dialog + delete mutation
          console.log("Delete intake", intake.id)
        },
      }),
    []
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
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intakes</h1>
        <p className="text-muted-foreground text-sm">
          Review and manage incoming case intakes.
        </p>
      </div>

      <IntakeToolbar
        table={table}
        counts={counts}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onSync={() => syncMutation.mutate()}
        isSyncing={syncMutation.isPending}
      />

      <div className="rounded-md border">
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

      <DataTablePagination table={table} />
    </div>
  )
}
