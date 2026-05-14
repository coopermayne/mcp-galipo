import { useState, useMemo } from "react"
import { useParams, useNavigate, useLocation } from "react-router"
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
import { Add01Icon, Alert02Icon, PrinterIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { getCase } from "@/services/cases"
import {
  listInvoices,
  getCostSummary,
  getCostSharing,
  exportCostReport,
  getAdvanceStats,
  type Invoice,
  type CostSummary,
  type AdvanceStats,
} from "@/services/invoices"
import {
  listLiens,
  getLienStats,
  type Lien,
  type LienStats,
} from "@/services/liens"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import { AddAdvanceDialog } from "./components/add-advance-dialog"
import { AddLienDialog } from "./components/add-lien-dialog"
import { EditLienDialog } from "./components/edit-lien-dialog"
import { getCaseCostColumns } from "./columns"
import { getLienColumns } from "./lien-columns"

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
  const location = useLocation()
  const queryClient = useQueryClient()

  // Costs state
  const [addOpen, setAddOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [costSharingEditing, setCostSharingEditing] = useState(false)
  const [bulkFiles, setBulkFiles] = useState<File[] | null>(null)
  const [search, setSearch] = useState("")

  // Advances state
  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false)
  const [editingAdvance, setEditingAdvance] = useState<Invoice | null>(null)
  const [payingAdvance, setPayingAdvance] = useState<Invoice | null>(null)
  const [advanceSearch, setAdvanceSearch] = useState("")

  // Liens state
  const [addLienOpen, setAddLienOpen] = useState(false)
  const [editingLien, setEditingLien] = useState<Lien | null>(null)
  const [lienSearch, setLienSearch] = useState("")

  function handleEdit(inv: Invoice) {
    if (inv.is_transfer) {
      setEditingTransfer(inv)
    } else {
      setEditingInvoice(inv)
    }
  }

  function handleAdvanceEdit(inv: Invoice) {
    setEditingAdvance(inv)
  }

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: !isNaN(caseId),
  })

  // --- Costs queries ---
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
    queryKey: ["invoices", "case", caseId, "unpaid", "cost"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: "unpaid",
        type: "cost",
        sort_by: "due_date",
        sort_dir: "asc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  const { data: paidData, isLoading: paidLoading } = useQuery({
    queryKey: ["invoices", "case", caseId, "paid", "cost"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: "paid",
        type: "cost",
        sort_by: "paid_date",
        sort_dir: "desc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  // --- Advances queries ---
  const { data: advanceStats } = useQuery({
    queryKey: ["advance-stats", caseId],
    queryFn: () => getAdvanceStats(caseId),
    enabled: !isNaN(caseId),
  })

  const { data: advUnpaidData, isLoading: advUnpaidLoading } = useQuery({
    queryKey: ["invoices", "case", caseId, "unpaid", "advance"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: "unpaid",
        type: "advance",
        sort_by: "due_date",
        sort_dir: "asc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  const { data: advPaidData, isLoading: advPaidLoading } = useQuery({
    queryKey: ["invoices", "case", caseId, "paid", "advance"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        status: "paid",
        type: "advance",
        sort_by: "paid_date",
        sort_dir: "desc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  // --- Liens queries ---
  const { data: lienData, isLoading: liensLoading } = useQuery({
    queryKey: ["liens", caseId],
    queryFn: () =>
      listLiens({
        case_id: caseId,
        sort_by: "date",
        sort_dir: "desc",
        limit: 500,
      }),
    enabled: !isNaN(caseId),
  })

  const { data: lienStats } = useQuery({
    queryKey: ["lien-stats", caseId],
    queryFn: () => getLienStats(caseId),
    enabled: !isNaN(caseId),
  })

  // --- Costs filtering ---
  const allUnpaid = unpaidData?.invoices ?? []
  const allPaid = paidData?.invoices ?? []

  const filterInvoices = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return (invoices: Invoice[]) => invoices
    return (invoices: Invoice[]) =>
      invoices.filter((inv) => {
        const amount = parseFloat(inv.amount || "0").toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })
        return (
          inv.category?.toLowerCase().includes(q) ||
          inv.payee_name?.toLowerCase().includes(q) ||
          inv.description?.toLowerCase().includes(q) ||
          amount.includes(q) ||
          inv.amount?.includes(q)
        )
      })
  }, [search])

  const unpaidInvoices = filterInvoices(allUnpaid)
  const paidInvoices = filterInvoices(allPaid)
  const hasUnpaid = allUnpaid.length > 0

  // --- Advances filtering ---
  const allAdvUnpaid = advUnpaidData?.invoices ?? []
  const allAdvPaid = advPaidData?.invoices ?? []

  const filterAdvances = useMemo(() => {
    const q = advanceSearch.trim().toLowerCase()
    if (!q) return (invoices: Invoice[]) => invoices
    return (invoices: Invoice[]) =>
      invoices.filter((inv) =>
        inv.payee_name?.toLowerCase().includes(q) ||
        inv.description?.toLowerCase().includes(q) ||
        inv.advanced_to_name?.toLowerCase().includes(q) ||
        inv.amount?.includes(q)
      )
  }, [advanceSearch])

  const advUnpaid = filterAdvances(allAdvUnpaid)
  const advPaid = filterAdvances(allAdvPaid)

  // --- Liens filtering ---
  const allLiens = lienData?.liens ?? []

  const filteredLiens = useMemo(() => {
    const q = lienSearch.trim().toLowerCase()
    if (!q) return allLiens
    return allLiens.filter((l) =>
      l.payee_name?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.claimed_amount?.includes(q)
    )
  }, [lienSearch, allLiens])

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["case-comments", caseId] })
    queryClient.invalidateQueries({ queryKey: ["equalization"] })
    queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
    queryClient.invalidateQueries({ queryKey: ["advance-stats", caseId] })
    queryClient.invalidateQueries({ queryKey: ["liens"] })
    queryClient.invalidateQueries({ queryKey: ["lien-stats", caseId] })
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

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Back nav */}
      <button
        onClick={() => navigate(`/cases/${caseId}`, { state: location.state })}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back to case
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{caseData?.case_name}</h1>
          <p className="text-sm text-muted-foreground">Costs & Finances</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          title="Print cost report"
          onClick={() => exportCostReport(caseId)}
        >
          <HugeiconsIcon icon={PrinterIcon} className="size-3.5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="costs">
        <TabsList>
          <TabsTrigger value="costs">
            Costs
            {(allUnpaid.length > 0 || allPaid.length > 0) && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({allUnpaid.length + allPaid.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="advances" className="data-[state=active]:text-info">
            Advances
            {(allAdvUnpaid.length > 0 || allAdvPaid.length > 0) && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({allAdvUnpaid.length + allAdvPaid.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="liens" className="data-[state=active]:text-warning">
            Liens
            {allLiens.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({allLiens.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ====== COSTS TAB ====== */}
        <TabsContent value="costs" className="flex flex-col gap-4 mt-4">
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-3.5" />
              Add Invoice
            </Button>
          </div>

          <CostSharingBar
            caseId={caseId}
            editing={costSharingEditing}
            onEditingChange={setCostSharingEditing}
          />

          {costSummary && (
            <CostSummaryBar
              costSummary={costSummary}
              ourPct={costSharing?.our_pct ?? null}
              counselPct={costSharing?.partner?.cost_share_pct ?? null}
              onTransfer={() => setTransferOpen(true)}
              onSetupSplit={() => setCostSharingEditing(true)}
            />
          )}

          <InvoiceDropzone caseId={caseId} onSuccess={invalidateAll} onBulkUpload={setBulkFiles} />

          {(allUnpaid.length > 0 || allPaid.length > 0) && (
            <div className="relative max-w-xs">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by category, payee, amount..."
                className="pl-9 h-9"
              />
            </div>
          )}

          {(hasUnpaid || unpaidLoading) && (
            <UnpaidSection
              invoices={unpaidInvoices}
              isLoading={unpaidLoading}
              onEdit={handleEdit}
              onMarkPaid={setPayingInvoice}
              total={allUnpaid.length}
            />
          )}

          <PaidSection
            invoices={paidInvoices}
            isLoading={paidLoading}
            onEdit={handleEdit}
            total={allPaid.length}
          />
        </TabsContent>

        {/* ====== ADVANCES TAB ====== */}
        <TabsContent value="advances" className="flex flex-col gap-4 mt-4">
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddAdvanceOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-3.5" />
              Add Advance
            </Button>
          </div>

          {advanceStats && advanceStats.total_advances > 0 && (
            <AdvanceSummaryBar stats={advanceStats} />
          )}

          {(allAdvUnpaid.length > 0 || allAdvPaid.length > 0) && (
            <div className="relative max-w-xs">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              />
              <Input
                value={advanceSearch}
                onChange={(e) => setAdvanceSearch(e.target.value)}
                placeholder="Filter advances..."
                className="pl-9 h-9"
              />
            </div>
          )}

          {(allAdvUnpaid.length > 0 || advUnpaidLoading) && (
            <UnpaidSection
              invoices={advUnpaid}
              isLoading={advUnpaidLoading}
              onEdit={handleAdvanceEdit}
              onMarkPaid={setPayingAdvance}
              total={allAdvUnpaid.length}
              rowClassName="bg-info/5 hover:bg-info/10"
              label="Unpaid Advances"
              isAdvance
            />
          )}

          <PaidSection
            invoices={advPaid}
            isLoading={advPaidLoading}
            onEdit={handleAdvanceEdit}
            total={allAdvPaid.length}
            rowClassName="bg-info/5 hover:bg-info/10"
            label="Paid Advances"
            isAdvance
          />
        </TabsContent>

        {/* ====== LIENS TAB ====== */}
        <TabsContent value="liens" className="flex flex-col gap-4 mt-4">
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => setAddLienOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-3.5" />
              Add Lien
            </Button>
          </div>

          {lienStats && lienStats.count > 0 && (
            <LienSummaryBar stats={lienStats} />
          )}

          {allLiens.length > 0 && (
            <div className="relative max-w-xs">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              />
              <Input
                value={lienSearch}
                onChange={(e) => setLienSearch(e.target.value)}
                placeholder="Filter liens..."
                className="pl-9 h-9"
              />
            </div>
          )}

          <LiensSection
            liens={filteredLiens}
            isLoading={liensLoading}
            onEdit={setEditingLien}
            total={allLiens.length}
          />
        </TabsContent>
      </Tabs>

      {/* All dialogs */}
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
      <EditInvoiceDialog
        invoice={editingAdvance}
        onOpenChange={(open) => !open && setEditingAdvance(null)}
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
      <MarkPaidDialog
        invoice={payingAdvance}
        onOpenChange={(open) => !open && setPayingAdvance(null)}
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
      <AddAdvanceDialog
        open={addAdvanceOpen}
        onOpenChange={setAddAdvanceOpen}
        caseId={caseId}
        onSuccess={invalidateAll}
      />
      <AddLienDialog
        open={addLienOpen}
        onOpenChange={setAddLienOpen}
        caseId={caseId}
        onSuccess={invalidateAll}
      />
      <EditLienDialog
        lien={editingLien}
        onOpenChange={(open) => !open && setEditingLien(null)}
        onSuccess={invalidateAll}
      />
    </div>
  )
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

// --- Summary Bars ---

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

function AdvanceSummaryBar({ stats }: { stats: AdvanceStats }) {
  return (
    <div className="flex items-center gap-6 border border-info/30 bg-info/5 p-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Total advances:</span>
        <span className="font-semibold tabular-nums text-info">
          {formatMoney(stats.total_advances)}
        </span>
      </div>
      <div className="h-4 border-l" />
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Unpaid:</span>
        <span className="tabular-nums">{stats.unpaid_count}</span>
      </div>
      <div className="h-4 border-l" />
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Paid:</span>
        <span className="tabular-nums">{stats.paid_count}</span>
      </div>
      {stats.by_recipient.length > 0 && (
        <>
          <div className="h-4 border-l" />
          <div className="flex items-center gap-3 flex-wrap">
            {stats.by_recipient.map((r) => (
              <span key={r.person_id ?? "none"} className="text-xs">
                <span className="text-muted-foreground">{r.person_name}:</span>{" "}
                <span className="font-semibold tabular-nums">{formatMoney(r.total)}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LienSummaryBar({ stats }: { stats: LienStats }) {
  return (
    <div className="flex items-center gap-6 border border-warning/30 bg-warning/5 p-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Total claimed:</span>
        <span className="font-semibold tabular-nums text-warning">
          {formatMoney(stats.total_claimed)}
        </span>
      </div>
      {stats.total_negotiated > 0 && (
        <>
          <div className="h-4 border-l" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Negotiated:</span>
            <span className="font-semibold tabular-nums text-success">
              {formatMoney(stats.total_negotiated)}
            </span>
          </div>
          <div className="h-4 border-l" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Savings:</span>
            <span className="font-semibold tabular-nums text-success">
              {formatMoney(stats.savings)} ({stats.savings_pct}%)
            </span>
          </div>
        </>
      )}
      <div className="h-4 border-l" />
      <div className="flex items-center gap-3 text-xs">
        <span>
          <span className="text-muted-foreground">Pending:</span> {stats.pending_count}
        </span>
        <span>
          <span className="text-muted-foreground">Negotiated:</span> {stats.negotiated_count}
        </span>
        <span>
          <span className="text-muted-foreground">Paid:</span> {stats.paid_count}
        </span>
      </div>
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
          <p>{who}&apos;s share ({pct}%): {formatMoney(target)}</p>
          <p>{who}&apos;s actual spend: {formatMoney(actual)}</p>
        </div>
        <p className="pt-1 border-t font-medium">
          Owes {who}: {formatMoney(diff)}
        </p>
      </PopoverContent>
    </Popover>
  )
}

// --- Table Sections ---

const UNPAID_HIDDEN: VisibilityState = {
  paid_by_name: false,
}

function UnpaidSection({
  invoices,
  isLoading,
  onEdit,
  onMarkPaid,
  total,
  rowClassName,
  label,
  isAdvance,
}: {
  invoices: Invoice[]
  isLoading: boolean
  onEdit: (inv: Invoice) => void
  onMarkPaid: (inv: Invoice) => void
  total: number
  rowClassName?: string
  label?: string
  isAdvance?: boolean
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(
    () =>
      getCaseCostColumns({
        onMarkPaid: (inv) => onMarkPaid(inv),
        onEdit: (inv) => onEdit(inv),
        isAdvance,
      }),
    [onMarkPaid, onEdit, isAdvance]
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
        {label ?? "Unpaid"} ({invoices.length !== total ? `${invoices.length} of ${total}` : total})
      </h2>
      <InvoiceTable table={table} isLoading={isLoading} onEdit={onEdit} emptyMessage={`No ${label?.toLowerCase() ?? "unpaid invoices"}.`} rowClassName={rowClassName} />
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
  total,
  rowClassName,
  label,
  isAdvance,
}: {
  invoices: Invoice[]
  isLoading: boolean
  onEdit: (inv: Invoice) => void
  total: number
  rowClassName?: string
  label?: string
  isAdvance?: boolean
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const columns = useMemo(
    () => getCaseCostColumns({ onEdit: (inv) => onEdit(inv), isAdvance }),
    [onEdit, isAdvance]
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
        {label ?? "Paid"} ({invoices.length !== total ? `${invoices.length} of ${total}` : total})
      </h2>
      <InvoiceTable table={table} isLoading={isLoading} onEdit={onEdit} emptyMessage={`No ${label?.toLowerCase() ?? "paid invoices"}.`} rowClassName={rowClassName} />
      {invoices.length > 20 && (
        <div className="mt-2">
          <DataTablePagination table={table} pageSizes={[20, 50, 100]} />
        </div>
      )}
    </div>
  )
}

function LiensSection({
  liens,
  isLoading,
  onEdit,
  total,
}: {
  liens: Lien[]
  isLoading: boolean
  onEdit: (lien: Lien) => void
  total: number
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(
    () => getLienColumns({ onEdit }),
    [onEdit]
  )

  const table = useReactTable({
    data: liens,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const allCols = table.getAllColumns()

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Liens ({liens.length !== total ? `${liens.length} of ${total}` : total})
      </h2>
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
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
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
                  className="cursor-pointer bg-warning/5 hover:bg-warning/10"
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
                  colSpan={allCols.length}
                  className="h-16 text-center"
                >
                  No liens.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// --- Generic Invoice Table ---

function InvoiceTable({
  table,
  isLoading,
  onEdit,
  emptyMessage,
  rowClassName,
}: {
  table: ReturnType<typeof useReactTable<Invoice>>
  isLoading: boolean
  onEdit: (inv: Invoice) => void
  emptyMessage: string
  rowClassName?: string
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
                    : rowClassName ?? ""
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
