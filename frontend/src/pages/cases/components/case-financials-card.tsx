import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import type { CounselFee } from "@/types/financial"
import {
  getFinancialByCase,
  createFinancial,
  updateFinancial,
  deleteFinancial,
  createCounselFee,
  updateCounselFee,
  deleteCounselFee,
} from "@/services/financials"
import { InlineEditField } from "@/components/common/inline-edit-field"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const RESOLUTION_TYPES = [
  { value: "settlement", label: "Settlement" },
  { value: "verdict", label: "Verdict" },
  { value: "judgment", label: "Judgment" },
  { value: "arbitration_award", label: "Arbitration Award" },
]

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function parseCurrency(str: string): number | undefined {
  const cleaned = str.replace(/[^0-9.-]/g, "")
  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}

interface CaseFinancialsCardProps {
  caseId: number
}

export function CaseFinancialsCard({ caseId }: CaseFinancialsCardProps) {
  const queryClient = useQueryClient()
  const queryKey = ["financial", "case", caseId]

  const { data: financial, isLoading } = useQuery({
    queryKey,
    queryFn: () => getFinancialByCase(caseId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ["financials"] })
    queryClient.invalidateQueries({ queryKey: ["financial-counts"] })
  }

  const createMutation = useMutation({
    mutationFn: () => createFinancial({ case_id: caseId }),
    onSuccess: () => {
      invalidate()
      toast.success("Financial record created")
    },
    onError: (e) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateFinancial>[1]) =>
      updateFinancial(financial!.id, data),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res.financial)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteFinancial(financial!.id),
    onSuccess: () => {
      invalidate()
      toast.success("Financial record deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const addFeeMutation = useMutation({
    mutationFn: (data: Parameters<typeof createCounselFee>[1]) =>
      createCounselFee(financial!.id, data),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res.financial)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const updateFeeMutation = useMutation({
    mutationFn: ({ feeId, data }: { feeId: number; data: Parameters<typeof updateCounselFee>[1] }) =>
      updateCounselFee(feeId, data),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res.financial)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteFeeMutation = useMutation({
    mutationFn: (feeId: number) => deleteCounselFee(feeId),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res.financial)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return null

  // Empty state
  if (!financial) {
    return (
      <Card size="sm">
        <CardHeader className="border-b bg-muted/40">
          <CardTitle>Financials</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-xs text-muted-foreground mb-3">
            No financial data for this case yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            Add Financial Data
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card size="sm">
      <CardHeader className="border-b bg-muted/40">
        <CardTitle>
          Financials
          {financial.is_finalized && (
            <span className="ml-1.5 text-xs font-normal text-success">Final</span>
          )}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-6", financial.is_finalized && "text-success")}
            onClick={() => updateMutation.mutate({ is_finalized: !financial.is_finalized })}
            title={financial.is_finalized ? "Mark as not finalized" : "Mark as finalized"}
          >
            <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Resolution type + date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Type</span>
            <Select
              value={financial.resolution_type ?? ""}
              onValueChange={(v) => updateMutation.mutate({ resolution_type: v as string })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1">Date</span>
            <InlineEditField
              value={financial.resolution_date ?? ""}
              onSave={(v) => updateMutation.mutate({ resolution_date: v })}
              type="date"
              displayClassName="text-xs"
            />
          </div>
        </div>

        {/* Money fields */}
        <div className="border-t pt-3 space-y-1.5">
          <MoneyRow
            label="Gross Recovery"
            value={financial.gross_recovery}
            onSave={(v) => updateMutation.mutate({ gross_recovery: v })}
          />
          <MoneyRow
            label="Costs Advanced"
            value={financial.costs_advanced}
            onSave={(v) => updateMutation.mutate({ costs_advanced: v })}
          />
          <MoneyRow
            label="Liens"
            value={financial.liens_total}
            onSave={(v) => updateMutation.mutate({ liens_total: v })}
          />
          {/* Computed net */}
          {financial.gross_recovery != null && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed">
              <span className="text-xs font-medium">Net Recovery</span>
              <span className="text-xs font-medium tabular-nums">
                {formatCurrency(
                  (financial.gross_recovery ?? 0) - (financial.liens_total ?? 0)
                )}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="border-t pt-3">
          <span className="text-xs text-muted-foreground block mb-1">Notes</span>
          <InlineEditField
            value={financial.notes ?? ""}
            onSave={(v) => updateMutation.mutate({ notes: v })}
            type="textarea"
            placeholder="Add notes..."
            displayClassName="text-xs whitespace-pre-wrap"
          />
        </div>

        {/* Counsel Fees */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Counsel Fees</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              onClick={() => addFeeMutation.mutate({
                counsel_name: "New Counsel",
                fee_type: "percentage",
                sort_order: financial.counsel_fees.length,
              })}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3" />
            </Button>
          </div>
          {financial.counsel_fees.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No counsel fees added.
            </p>
          ) : (
            <div className="space-y-2">
              {financial.counsel_fees.map((fee) => (
                <CounselFeeRow
                  key={fee.id}
                  fee={fee}
                  grossRecovery={financial.gross_recovery}
                  onUpdate={(data) => updateFeeMutation.mutate({ feeId: fee.id, data })}
                  onDelete={() => deleteFeeMutation.mutate(fee.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete financial */}
        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive w-full"
            onClick={() => {
              if (confirm("Delete all financial data for this case?")) {
                deleteMutation.mutate()
              }
            }}
          >
            Remove Financial Data
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MoneyRow({
  label,
  value,
  onSave,
}: {
  label: string
  value: number | null
  onSave: (v: number | undefined) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <InlineEditField
        value={value != null ? formatCurrency(value) : ""}
        onSave={(v) => onSave(parseCurrency(v))}
        placeholder="—"
        displayClassName="text-xs tabular-nums justify-end"
      />
    </div>
  )
}

function CounselFeeRow({
  fee,
  grossRecovery,
  onUpdate,
  onDelete,
}: {
  fee: CounselFee
  grossRecovery: number | null
  onUpdate: (data: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const computedFee = fee.fee_type === "percentage" && fee.fee_percentage != null && grossRecovery != null
    ? grossRecovery * fee.fee_percentage / 100
    : fee.fee_flat_amount

  return (
    <div className="ring-1 ring-border p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-left min-w-0 hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {fee.is_our_firm && (
            <span className="size-1.5 bg-success shrink-0" />
          )}
          <span className="truncate">{fee.counsel_name || "Unnamed"}</span>
        </button>
        <span className="text-xs tabular-nums shrink-0">
          {fee.fee_type === "percentage"
            ? `${fee.fee_percentage ?? 0}%`
            : formatCurrency(fee.fee_flat_amount)}
          {computedFee != null && fee.fee_type === "percentage" && (
            <span className="text-muted-foreground ml-1">
              ({formatCurrency(computedFee)})
            </span>
          )}
        </span>
      </div>
      {expanded && (
        <div className="space-y-1.5 pt-1 border-t border-dashed">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Name</span>
            <InlineEditField
              value={fee.counsel_name ?? ""}
              onSave={(v) => onUpdate({ counsel_name: v })}
              displayClassName="text-xs justify-end"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Our Firm</span>
            <button
              className={cn(
                "text-xs px-1.5 py-0.5 border transition-colors",
                fee.is_our_firm
                  ? "bg-success/10 text-success border-success/30"
                  : "text-muted-foreground"
              )}
              onClick={() => onUpdate({ is_our_firm: !fee.is_our_firm })}
            >
              {fee.is_our_firm ? "Yes" : "No"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Fee Type</span>
            <Select
              value={fee.fee_type ?? "percentage"}
              onValueChange={(v) => onUpdate({ fee_type: v })}
            >
              <SelectTrigger className="h-6 text-xs w-auto min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="flat">Flat Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fee.fee_type === "percentage" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Percentage</span>
              <InlineEditField
                value={fee.fee_percentage != null ? `${fee.fee_percentage}%` : ""}
                onSave={(v) => {
                  const n = parseFloat(v.replace("%", ""))
                  if (!isNaN(n)) onUpdate({ fee_percentage: n })
                }}
                placeholder="0%"
                displayClassName="text-xs tabular-nums justify-end"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Flat Amount</span>
              <InlineEditField
                value={fee.fee_flat_amount != null ? formatCurrency(fee.fee_flat_amount) : ""}
                onSave={(v) => {
                  const n = parseCurrency(v)
                  if (n != null) onUpdate({ fee_flat_amount: n })
                }}
                placeholder="—"
                displayClassName="text-xs tabular-nums justify-end"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive w-full h-6"
            onClick={onDelete}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3 mr-1" />
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}
