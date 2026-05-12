import { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
  type PaginationState,
} from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Alert02Icon, PrinterIcon } from "@hugeicons/core-free-icons"
import { getCase } from "@/services/cases"
import {
  listInvoices,
  getCostSummary,
  getCostSharing,
  exportCostReport,
  type Invoice,
  type CostSummary,
} from "@/services/invoices"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { BulkInvoiceUpload } from "./components/bulk-invoice-upload"
import { AddInvoiceDialog } from "./components/add-invoice-dialog"
import { EditInvoiceDialog } from "./components/edit-invoice-dialog"
import { EditTransferDialog } from "./components/edit-transfer-dialog"
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

  const [addOpen, setAddOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [costSharingEditing, setCostSharingEditing] = useState(false)
  const [bulkFiles, setBulkFiles] = useState<File[] | null>(null)

  function handleEdit(inv: Invoice) {
    if (inv.is_transfer) {
      setEditingTransfer(inv)
    } else {
      setEditingInvoice(inv)
    }
  }

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: !isNaN(caseId),
  })

  const { data: costSummary } = useQuery({
    queryKey: ["cost-summary", caseId],
    queryFn: () => getCostSummary(caseId),
    enabled: !isNaN(caseId),
  })

  const { data: costSharing } = useQuery({
    queryKey: ["cost-sharing", caseId],
    queryFn: () => getCostSharing(caseId),
    enabled: !isNaN(caseId),
  })

  const { data: unpaidData, isLoading: unpaidLoading } = useQuery({
    queryKey: ["invoices", "case", caseId, "unpaid"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: "unpaid",
        sort_by: "due_date",
        sort_dir: "asc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  const { data: paidData, isLoading: paidLoading } = useQuery({
    queryKey: ["invoices", "case", caseId, "paid"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: "paid",
        sort_by: "paid_date",
        sort_dir: "desc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["case-comments", caseId] })
    queryClient.invalidateQueries({ queryKey: ["equalization"] })
    queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
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

  const unpaidInvoices = unpaidData?.invoices ?? []
  const paidInvoices = paidData?.invoices ?? []
  const hasUnpaid = unpaidInvoices.length > 0

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            title="Print cost report"
            onClick={() => exportCostReport(caseId)}
          >
            <HugeiconsIcon icon={PrinterIcon} className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-3.5" />
            Add Invoice
          </Button>
        </div>
      </div>

      {/* Cost sharing config */}
      <CostSharingBar
        caseId={caseId}
        editing={costSharingEditing}
        onEditingChange={setCostSharingEditing}
      />

      {/* Net cost summary */}
      {costSummary && (
        <CostSummaryBar
          costSummary={costSummary}
          ourPct={costSharing?.our_pct ?? null}
          counselPct={costSharing?.partner?.cost_share_pct ?? null}
          onTransfer={() => setTransferOpen(true)}
          onSetupSplit={() => setCostSharingEditing(true)}
        />
      )}

      {/* Dropzone */}
      <InvoiceDropzone caseId={caseId} onSuccess={invalidateAll} onBulkUpload={setBulkFiles} />

      {/* Unpaid section */}
      {(hasUnpaid || unpaidLoading) && (
        <UnpaidSection
          invoices={unpaidInvoices}
          isLoading={unpaidLoading}
          onEdit={handleEdit}
          onMarkPaid={setPayingInvoice}
        />
      )}

      {/* Paid section */}
      <PaidSection
        invoices={paidInvoices}
        isLoading={paidLoading}
        onEdit={handleEdit}
      />

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
      <EditTransferDialog
        invoice={editingTransfer}
        onOpenChange={(open) => !open && setEditingTransfer(null)}
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
      <BulkInvoiceUpload
        caseId={caseId}
        files={bulkFiles}
        onClose={() => setBulkFiles(null)}
        onSuccess={invalidateAll}
      />
    </div>
  )
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function CostSummaryBar({
  costSummary,
  ourPct,
  counselPct,
  onTransfer,
  onSetupSplit,
}: {
  costSummary: CostSummary
  ourPct: number | null
  counselPct: number | null
  onTransfer: () => void
  onSetupSplit: () => void
}) {
  const { counsel_name, total_costs, our_net, counsel_net } = costSummary

  const ourTarget = ourPct != null ? total_costs * (ourPct / 100) : null
  const counselTarget = counselPct != null ? total_costs * (counselPct / 100) : null

  // Positive = overpaid relative to their share
  const ourDiff = ourTarget != null ? our_net - ourTarget : null
  const counselDiff = counselTarget != null ? counsel_net - counselTarget : null

  const threshold = 0.01
  const isImbalanced = ourDiff != null && Math.abs(ourDiff) > threshold

  return (
    <div className="flex items-center gap-6 border p-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Total costs:</span>
        <span className="font-semibold tabular-nums">
          {formatMoney(total_costs)}
        </span>
      </div>
      {counsel_name ? (
        <>
          <div className="h-4 border-l" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Our Firm net:</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(our_net)}
            </span>
            {isImbalanced && ourDiff! > 0 && (
              <ImbalanceAlert
                who="Our Firm"
                target={ourTarget!}
                actual={our_net}
                diff={ourDiff!}
                pct={ourPct!}
                totalCosts={total_costs}
              />
            )}
          </div>
          <div className="h-4 border-l" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">
              {counsel_name} net:
            </span>
            <span className="font-semibold tabular-nums">
              {formatMoney(counsel_net)}
            </span>
            {isImbalanced && counselDiff! > 0 && (
              <ImbalanceAlert
                who={counsel_name}
                target={counselTarget!}
                actual={counsel_net}
                diff={counselDiff!}
                pct={counselPct!}
                totalCosts={total_costs}
              />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={onTransfer}
          >
            Transfer
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-7 text-xs"
          onClick={onSetupSplit}
        >
          Set up split
        </Button>
      )}
    </div>
  )
}

function ImbalanceAlert({
  who,
  target,
  actual,
  diff,
  pct,
  totalCosts,
}: {
  who: string
  target: number
  actual: number
  diff: number
  pct: number
  totalCosts: number
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-destructive hover:text-destructive/80 transition-colors"
        >
          <HugeiconsIcon icon={Alert02Icon} className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-xs space-y-2">
        <p className="font-semibold text-destructive">
          {who} has overpaid by {formatMoney(diff)}
        </p>
        <div className="space-y-1 text-muted-foreground">
          <p>Total costs: {formatMoney(totalCosts)}</p>
          <p>{who}'s share ({pct}%): {formatMoney(target)}</p>
          <p>{who}'s actual spend: {formatMoney(actual)}</p>
        </div>
        <p className="pt-1 border-t font-medium">
          Owes {who}: {formatMoney(diff)}
        </p>
      </PopoverContent>
    </Popover>
  )
}

const UNPAID_HIDDEN: VisibilityState = {
  paid_by_name: false,
}

function UnpaidSection({
  invoices,
  isLoading,
  onEdit,
  onMarkPaid,
}: {
  invoices: Invoice[]
  isLoading: boolean
  onEdit: (inv: Invoice) => void
  onMarkPaid: (inv: Invoice) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(
    () =>
      getCaseCostColumns({
        onMarkPaid: (inv) => onMarkPaid(inv),
        onEdit: (inv) => onEdit(inv),
      }),
    [onMarkPaid, onEdit]
  )

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, columnVisibility: UNPAID_HIDDEN },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Unpaid ({invoices.length})
      </h2>
      <CostTable table={table} isLoading={isLoading} onEdit={onEdit} emptyMessage="No unpaid invoices." />
    </div>
  )
}

const PAID_HIDDEN: VisibilityState = {
  due_date: false,
}

function PaidSection({
  invoices,
  isLoading,
  onEdit,
}: {
  invoices: Invoice[]
  isLoading: boolean
  onEdit: (inv: Invoice) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const columns = useMemo(
    () => getCaseCostColumns({ onEdit: (inv) => onEdit(inv) }),
    [onEdit]
  )

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, columnVisibility: PAID_HIDDEN, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Paid ({invoices.length})
      </h2>
      <CostTable table={table} isLoading={isLoading} onEdit={onEdit} emptyMessage="No paid invoices." />
      {invoices.length > 20 && (
        <div className="mt-2">
          <DataTablePagination table={table} pageSizes={[20, 50, 100]} />
        </div>
      )}
    </div>
  )
}

function CostTable({
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
            Array.from({ length: 4 }).map((_, i) => (
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
            ))
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
