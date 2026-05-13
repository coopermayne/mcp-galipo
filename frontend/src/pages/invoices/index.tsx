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
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import {
  listInvoices,
  type Invoice,
} from "@/services/invoices"
import {
  getColumns,
  invoiceGlobalFilterFn,
  getSearchRank,
  getRowKind,
  ROW_KIND_BORDER,
} from "@/pages/invoices/columns"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTablePagination } from "@/components/common/data-table-pagination"

export default function InvoicesPage() {
  const queryClient = useQueryClient()
  const [globalFilter, setGlobalFilter] = useState("")
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const { data: unpaidData, isLoading: unpaidLoading } = useQuery({
    queryKey: ["invoices", "all", "unpaid"],
    queryFn: () =>
      listInvoices({
        status: "unpaid",
        sort_by: "due_date",
        sort_dir: "asc",
        limit: 2000,
      }),
  })

  const { data: paidData, isLoading: paidLoading } = useQuery({
    queryKey: ["invoices", "all", "paid"],
    queryFn: () =>
      listInvoices({
        status: "paid",
        sort_by: "paid_date",
        sort_dir: "desc",
        limit: 2000,
      }),
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

  const isOutgoing = (inv: Invoice) =>
    !inv.is_transfer || inv.transfer_to_person_id != null

  const unpaidInvoices = useMemo(() => {
    const invoices = (unpaidData?.invoices ?? []).filter(isOutgoing)
    if (!globalFilter) return invoices
    return [...invoices]
      .filter((inv) => getSearchRank(inv, globalFilter) > 0)
      .sort((a, b) => getSearchRank(b, globalFilter) - getSearchRank(a, globalFilter))
  }, [unpaidData, globalFilter])

  const paidInvoices = useMemo(() => {
    const invoices = (paidData?.invoices ?? []).filter(isOutgoing)
    if (!globalFilter) return invoices
    return [...invoices]
      .filter((inv) => getSearchRank(inv, globalFilter) > 0)
      .sort((a, b) => getSearchRank(b, globalFilter) - getSearchRank(a, globalFilter))
  }, [paidData, globalFilter])

  const sumAmount = (list: Invoice[]) =>
    list.reduce((s, inv) => s + Number(inv.case_amount ?? inv.amount), 0)

  const hasUnpaid = unpaidInvoices.length > 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm">
          {unpaidInvoices.length} unpaid ({formatTotal(String(sumAmount(unpaidInvoices)))})
          {" · "}
          {paidInvoices.length} paid ({formatTotal(String(sumAmount(paidInvoices)))})
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative min-w-0 max-w-sm flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            placeholder="Search invoices..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-[var(--foreground)]" />
            Invoice
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-[var(--warning)]" />
            Advance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-[var(--purple)]" />
            Transfer
          </span>
        </div>
      </div>

      {(hasUnpaid || unpaidLoading) && (
        <UnpaidSection
          invoices={unpaidInvoices}
          isLoading={unpaidLoading}
          globalFilter={globalFilter}
          onEdit={setEditingInvoice}
          onMarkPaid={setPayingInvoice}
        />
      )}

      <PaidSection
        invoices={paidInvoices}
        isLoading={paidLoading}
        globalFilter={globalFilter}
        onEdit={setEditingInvoice}
      />

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

const UNPAID_HIDDEN: VisibilityState = {
  paid_date: false,
  check_number: false,
  paid_by_name: false,
}

function UnpaidSection({
  invoices,
  isLoading,
  globalFilter,
  onEdit,
  onMarkPaid,
}: {
  invoices: Invoice[]
  isLoading: boolean
  globalFilter: string
  onEdit: (inv: Invoice) => void
  onMarkPaid: (inv: Invoice) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(
    () =>
      getColumns({
        showCase: true,
        onMarkPaid: (inv) => onMarkPaid(inv),
      }),
    [onMarkPaid]
  )

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, columnVisibility: UNPAID_HIDDEN, globalFilter },
    onSortingChange: setSorting,
    globalFilterFn: invoiceGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Unpaid ({invoices.length})
      </h2>
      <InvoiceTable table={table} isLoading={isLoading} onEdit={onEdit} emptyMessage="No unpaid invoices." />
    </div>
  )
}

const PAID_HIDDEN: VisibilityState = {
  due_date: false,
}

function PaidSection({
  invoices,
  isLoading,
  globalFilter,
  onEdit,
}: {
  invoices: Invoice[]
  isLoading: boolean
  globalFilter: string
  onEdit: (inv: Invoice) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const columns = useMemo(
    () => getColumns({ showCase: true }),
    []
  )

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, columnVisibility: PAID_HIDDEN, globalFilter, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: invoiceGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Paid ({invoices.length})
      </h2>
      <InvoiceTable table={table} isLoading={isLoading} onEdit={onEdit} emptyMessage="No paid invoices found." />
      <div className="mt-2">
        <DataTablePagination table={table} pageSizes={[20, 50, 100]} />
      </div>
    </div>
  )
}

function InvoiceTable({
  table,
  isLoading,
  onEdit,
  emptyMessage,
}: {
  table: ReturnType<typeof useReactTable<Invoice>>
  isLoading: boolean
  onEdit: (inv: Invoice) => void
  emptyMessage: string
}) {
  const columns = table.getAllColumns()

  return (
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
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-[80px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const kind = getRowKind(row.original)
              return (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer ${ROW_KIND_BORDER[kind]}`}
                  onClick={() => onEdit(row.original)}
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
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-16 text-center"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
