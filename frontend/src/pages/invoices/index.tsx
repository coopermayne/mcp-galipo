import { useState, useMemo, useCallback } from "react"
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
import { useSearchParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Tick02Icon, Alert02Icon } from "@hugeicons/core-free-icons"
import {
  listInvoices,
  getInvoiceStageCounts,
  type Invoice,
} from "@/services/invoices"
import { getUnreadCounts } from "@/services/comments"
import {
  getColumns,
  invoiceGlobalFilterFn,
  getSearchRank,
  getRowKind,
  ROW_KIND_BORDER,
} from "@/pages/invoices/columns"
import { InvoicePipelines } from "@/pages/invoices/components/invoice-pipelines"
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

const ACTIVE_HIDDEN: VisibilityState = {
  paid_date: false,
  check_number: false,
  paid_by_name: false,
}

const PAID_HIDDEN: VisibilityState = {
  due_date: false,
}

export default function InvoicesPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedStage = searchParams.get("stage")
  const setSelectedStage = useCallback(
    (stage: string | null) => {
      setSearchParams(stage ? { stage } : {}, { replace: true })
    },
    [setSearchParams]
  )

  const isPaidView = selectedStage === "Paid"

  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ["invoices", "page", selectedStage],
    queryFn: () =>
      listInvoices({
        stage: (selectedStage as Invoice["stage"]) ?? undefined,
        exclude_paid: selectedStage === null,
        outgoing_only: true,
        sort_by: isPaidView ? "paid_date" : "due_date",
        sort_dir: isPaidView ? "desc" : "asc",
        limit: 2000,
      }),
  })

  const { data: stageCounts } = useQuery({
    queryKey: ["invoice-stage-counts"],
    queryFn: getInvoiceStageCounts,
  })

  const invoiceIds = useMemo(
    () => invoicesData?.invoices.map((i) => i.id) ?? [],
    [invoicesData]
  )

  const { data: unreadCounts } = useQuery({
    queryKey: ["invoice-unread-counts", invoiceIds],
    queryFn: () => getUnreadCounts("invoice", invoiceIds),
    enabled: invoiceIds.length > 0,
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["invoice-stage-counts"] })
    queryClient.invalidateQueries({ queryKey: ["invoice-unread-counts"] })
  }

  function formatTotal(amount: number) {
    return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
  }

  const columns = useMemo(
    () =>
      getColumns({
        showCase: true,
        onMarkPaid: (inv) => setPayingInvoice(inv),
        unreadCounts: unreadCounts ?? {},
      }),
    [unreadCounts]
  )

  const sortedData = useMemo(() => {
    const invoices = invoicesData?.invoices ?? []
    if (!globalFilter) return invoices
    return [...invoices].sort(
      (a, b) => getSearchRank(b, globalFilter) - getSearchRank(a, globalFilter)
    )
  }, [invoicesData, globalFilter])

  const table = useReactTable({
    data: sortedData,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
      columnVisibility: isPaidView ? PAID_HIDDEN : ACTIVE_HIDDEN,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: invoiceGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const viewTotal = useMemo(
    () =>
      (invoicesData?.invoices ?? []).reduce(
        (s, inv) => s + Number(inv.case_amount ?? inv.amount),
        0
      ),
    [invoicesData]
  )

  const perfectionSummary = useMemo(() => {
    if (selectedStage !== "Needs Payment" || !invoicesData) return null
    const invs = invoicesData.invoices
    const perfected = invs.filter((i) => i.is_perfected).length
    const imperfect = invs.length - perfected
    if (imperfect === 0) return null
    return { perfected, imperfect }
  }, [selectedStage, invoicesData])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm">
          Review, approve, and pay vendor invoices.
        </p>
      </div>

      <InvoicePipelines
        counts={stageCounts}
        selectedStage={selectedStage}
        onStageChange={setSelectedStage}
      />

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
        <div className="text-xs text-muted-foreground tabular-nums">
          {invoicesData?.invoices.length ?? 0} shown · {formatTotal(viewTotal)}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
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

      {perfectionSummary && (
        <div className="flex items-center gap-3 border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
          <span className="flex items-center gap-1 text-success font-medium">
            <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
            {perfectionSummary.perfected} ready for payment
          </span>
          <span className="h-3 border-l" />
          <span className="flex items-center gap-1 text-warning font-medium">
            <HugeiconsIcon icon={Alert02Icon} className="size-3.5" />
            {perfectionSummary.imperfect} need attention
          </span>
        </div>
      )}

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
                  {table.getVisibleFlatColumns().map((_, j) => (
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
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="h-24 text-center"
                >
                  No invoices found.
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
        showStage
        showComments
      />
      <MarkPaidDialog
        invoice={payingInvoice}
        onOpenChange={(open) => !open && setPayingInvoice(null)}
        onSuccess={invalidateAll}
      />
    </div>
  )
}
