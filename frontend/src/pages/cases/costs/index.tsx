import { useState } from "react"
import { useParams, useNavigate } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { getCase } from "@/services/cases"
import { listInvoices, getInvoiceStats } from "@/services/invoices"
import type { Invoice } from "@/services/invoices"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FeatureGate } from "@/components/common/feature-gate"
import { InvoiceDropzone } from "./components/invoice-dropzone"
import { InvoiceCard } from "./components/invoice-card"
import { AddInvoiceDialog } from "./components/add-invoice-dialog"
import { EditInvoiceDialog } from "./components/edit-invoice-dialog"
import { MarkPaidDialog } from "./components/mark-paid-dialog"

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
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
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
        limit: 200,
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
        limit: 200,
      }),
    enabled: !isNaN(caseId),
  })

  const { data: stats } = useQuery({
    queryKey: ["invoices", "stats", caseId],
    queryFn: () => getInvoiceStats(caseId),
    enabled: !isNaN(caseId),
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["case-comments", caseId] })
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

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
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

      {/* Dropzone */}
      <InvoiceDropzone caseId={caseId} onSuccess={invalidateAll} />

      {/* Unpaid Section */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Unpaid
          </h2>
          {stats && (
            <span className="text-sm font-medium">
              {stats.unpaid_count} invoice{stats.unpaid_count !== 1 ? "s" : ""}{" "}
              &middot; ${Number(stats.unpaid_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {unpaidLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : unpaidInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed">
            No unpaid invoices
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {unpaidInvoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                onClick={() => setEditingInvoice(inv)}
                onMarkPaid={() => setPayingInvoice(inv)}
                onChanged={invalidateAll}
              />
            ))}
          </div>
        )}
      </section>

      {/* Paid Section */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Paid
          </h2>
          {stats && (
            <span className="text-sm font-medium">
              {stats.paid_count} invoice{stats.paid_count !== 1 ? "s" : ""}{" "}
              &middot; ${Number(stats.paid_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {paidLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
          </div>
        ) : paidInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed">
            No paid invoices yet
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {paidInvoices.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                onClick={() => setEditingInvoice(inv)}
                onChanged={invalidateAll}
              />
            ))}
          </div>
        )}
      </section>

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
    </div>
  )
}
