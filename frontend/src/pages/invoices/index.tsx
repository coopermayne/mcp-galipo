import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type VisibilityState,
  type PaginationState,
  flexRender,
} from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import {
  listInvoices,
  getInvoiceStats,
  type Invoice,
  type InvoiceStatus,
} from "@/services/invoices"
import {
  getColumns,
  invoiceGlobalFilterFn,
  getSearchRank,
} from "@/pages/invoices/columns"
import { InvoiceToolbar } from "@/pages/invoices/components/invoice-toolbar"
import { EditInvoiceDialog } from "@/pages/cases/costs/components/edit-invoice-dialog"
import { MarkPaidDialog } from "@/pages/cases/costs/components/mark-paid-dialog"
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
import { useQueryClient } from "@tanstack/react-query"

export default function InvoicesPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("unpaid")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const { data: stats } = useQuery({
    queryKey: ["invoices", "stats"],
    queryFn: () => getInvoiceStats(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", "all", statusFilter],
    queryFn: () =>
      listInvoices({
        status: statusFilter,
        sort_by: statusFilter === "unpaid" ? "due_date" : "paid_date",
        sort_dir: statusFilter === "unpaid" ? "asc" : "desc",
        limit: 2000,
      }),
  })

  const columns = useMemo(
    () =>
      getColumns({
        showCase: true,
        onMarkPaid: (inv) => setPayingInvoice(inv),
        onMarkUnpaid: () => {},
      }),
    []
  )

  const visibleColumns = useMemo(() => {
    const hidden: VisibilityState = { ...columnVisibility }
    if (statusFilter === "unpaid") {
      hidden.paid_date = false
      hidden.check_number = false
      hidden.paid_by_name = false
    } else {
      hidden.due_date = false
    }
    return hidden
  }, [statusFilter, columnVisibility])

  const sortedData = useMemo(() => {
    const invoices = data?.invoices ?? []
    if (!globalFilter) return invoices
    return [...invoices].sort(
      (a, b) => getSearchRank(b, globalFilter) - getSearchRank(a, globalFilter)
    )
  }, [data, globalFilter])

  const table = useReactTable({
    data: sortedData,
    columns,
    state: {
      sorting,
      columnVisibility: visibleColumns,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: invoiceGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
  }

  function formatTotal(amount: string) {
    return Number(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        {stats && (
          <p className="text-muted-foreground text-sm">
            Unpaid: {stats.unpaid_count} ({formatTotal(stats.unpaid_total)})
            {" · "}
            Paid: {stats.paid_count} ({formatTotal(stats.paid_total)})
          </p>
        )}
      </div>

      <InvoiceToolbar
        table={table}
        statusFilter={statusFilter}
        onStatusChange={(s) => {
          setStatusFilter(s)
          setPagination((p) => ({ ...p, pageIndex: 0 }))
        }}
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
                  {Array.from({ length: 7 }).map((_, j) => (
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
                  onClick={() => setEditingInvoice(row.original)}
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
                  No {statusFilter} invoices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} pageSizes={[20, 50, 100]} />

      <EditInvoiceDialog
        invoice={editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
        onSuccess={invalidateAll}
      />
      <MarkPaidDialog
        invoice={payingInvoice}
        onOpenChange={(open) => !open && setPayingInvoice(null)}
        onSuccess={invalidateAll}
      />
    </div>
  )
}
