import { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
  type PaginationState,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { getCase } from "@/services/cases"
import {
  listInvoices,
  getInvoiceStats,
  getCostSummary,
  type Invoice,
  type InvoiceStatus,
} from "@/services/invoices"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "@/components/common/data-table-pagination"
import { FeatureGate } from "@/components/common/feature-gate"
import { InvoiceDropzone } from "./components/invoice-dropzone"
import { AddInvoiceDialog } from "./components/add-invoice-dialog"
import { EditInvoiceDialog } from "./components/edit-invoice-dialog"
import { MarkPaidDialog } from "./components/mark-paid-dialog"
import { TransferDialog } from "./components/equalization-dialog"
import { CostSharingBar } from "./components/cost-sharing-bar"
import { getCaseCostColumns } from "./columns"

export default function CaseCostsPage() {
  return (
    <FeatureGate feature="invoices" redirectTo="/cases">
      <CaseCostsContent />
    </FeatureGate>
  )
}

function CaseCostsContent() {
  const { id } = useParams<{ id: string }>()
  const caseId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>("unpaid")
  const [addOpen, setAddOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [costSharingEditing, setCostSharingEditing] = useState(false)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: !isNaN(caseId),
  })

  const { data: stats } = useQuery({
    queryKey: ["invoices", "stats", caseId],
    queryFn: () => getInvoiceStats(caseId),
    enabled: !isNaN(caseId),
  })

  const { data: costSummary } = useQuery({
    queryKey: ["cost-summary", caseId],
    queryFn: () => getCostSummary(caseId),
    enabled: !isNaN(caseId),
  })

  const { data, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", "case", caseId, statusFilter],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: statusFilter,
        sort_by: statusFilter === "unpaid" ? "due_date" : "paid_date",
        sort_dir: statusFilter === "unpaid" ? "asc" : "desc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  const columns = useMemo(
    () =>
      getCaseCostColumns({
        onMarkPaid: (inv) => setPayingInvoice(inv),
        onEdit: (inv) => setEditingInvoice(inv),
      }),
    []
  )

  const visibleColumns = useMemo(() => {
    const hidden: VisibilityState = { ...columnVisibility }
    if (statusFilter === "paid") {
      hidden.due_date = false
    }
    return hidden
  }, [statusFilter, columnVisibility])

  const table = useReactTable({
    data: data?.invoices ?? [],
    columns,
    state: {
      sorting,
      columnVisibility: visibleColumns,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["case-comments", caseId] })
    queryClient.invalidateQueries({ queryKey: ["equalization"] })
    queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
  }

  function formatTotal(amount: string) {
    return Number(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })
  }

  if (caseLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  const unpaidCount = stats?.unpaid_count ?? 0
  const paidCount = stats?.paid_count ?? 0

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Back nav */}
      <button
        onClick={() => navigate(`/cases/${caseId}`)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back to case
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{caseData?.case_name}</h1>
          <p className="text-sm text-muted-foreground">Costs</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-3.5" />
          Add Invoice
        </Button>
      </div>

      {/* Cost sharing config */}
      <CostSharingBar
        caseId={caseId}
        editing={costSharingEditing}
        onEditingChange={setCostSharingEditing}
      />

      {/* Net cost summary */}
      {costSummary && (
        <div className="flex items-center gap-6 border p-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total costs:</span>
            <span className="font-semibold tabular-nums">
              {formatTotal(String(costSummary.total_costs))}
            </span>
          </div>
          {costSummary.counsel_name ? (
            <>
              <div className="h-4 border-l" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Our Firm net:</span>
                <span className="font-semibold tabular-nums">
                  {formatTotal(String(costSummary.our_net))}
                </span>
              </div>
              <div className="h-4 border-l" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  {costSummary.counsel_name} net:
                </span>
                <span className="font-semibold tabular-nums">
                  {formatTotal(String(costSummary.counsel_net))}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => setTransferOpen(true)}
              >
                Transfer
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={() => setCostSharingEditing(true)}
            >
              Set up split
            </Button>
          )}
        </div>
      )}

      {/* Dropzone */}
      <InvoiceDropzone caseId={caseId} onSuccess={invalidateAll} />

      {/* Status tabs + stats */}
      <div className="flex items-center gap-2">
        <Button
          variant={statusFilter === "unpaid" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setStatusFilter("unpaid")
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
        >
          Unpaid
          {stats && (
            <span className="ml-1.5 text-xs opacity-70">
              {unpaidCount} &middot; {formatTotal(stats.unpaid_total)}
            </span>
          )}
        </Button>
        <Button
          variant={statusFilter === "paid" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setStatusFilter("paid")
            setPagination((p) => ({ ...p, pageIndex: 0 }))
          }}
        >
          Paid
          {stats && (
            <span className="ml-1.5 text-xs opacity-70">
              {paidCount} &middot; {formatTotal(stats.paid_total)}
            </span>
          )}
        </Button>
      </div>

      {/* Table */}
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
            {invoicesLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
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
                  className={`cursor-pointer ${
                    row.original.is_transfer
                      ? "bg-purple/5 hover:bg-purple/10"
                      : ""
                  }`}
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
                  No {statusFilter} invoices.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(data?.total ?? 0) > 20 && (
        <DataTablePagination table={table} pageSizes={[20, 50, 100]} />
      )}

      {/* Dialogs */}
      <AddInvoiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        caseId={caseId}
        onSuccess={invalidateAll}
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
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        caseId={caseId}
        onSuccess={invalidateAll}
      />
    </div>
  )
}
