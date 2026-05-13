import { useState } from "react"
import { Link, useLocation } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import type { CounselFee } from "@/types/financial"
import type { CasePerson } from "@/types/case"
import { getInvoiceStats } from "@/services/invoices"
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
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const FEE_ELIGIBLE_ROLES = ["co_counsel", "referring_attorney"]

interface CaseFinancialsCardProps {
  caseId: number
  casePersons: CasePerson[]
}

export function CaseFinancialsCard({ caseId, casePersons }: CaseFinancialsCardProps) {
  const location = useLocation()
  const queryClient = useQueryClient()
  const queryKey = ["financial", "case", caseId]

  const { data: financial, isLoading } = useQuery({
    queryKey,
    queryFn: () => getFinancialByCase(caseId),
  })

  const { data: invoiceStats } = useQuery({
    queryKey: ["invoices", "stats", caseId],
    queryFn: () => getInvoiceStats(caseId),
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
        <div className="border-t px-3 py-2">
          <Link
            to={`/cases/${caseId}/costs`}
            state={location.state}
            className="flex items-center justify-between group"
          >
            <div>
              <span className="text-xs font-medium">Costs & Invoices</span>
              {invoiceStats && invoiceStats.unpaid_count > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {invoiceStats.unpaid_count} unpaid &middot; $
                  {Number(invoiceStats.unpaid_total).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No unpaid invoices</p>
              )}
            </div>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors"
            />
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card size="sm">
      <CardHeader className="border-b bg-muted/40">
        <CardTitle>Financials</CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Resolution type + date + finalized */}
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
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={financial.is_finalized ?? false}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ is_finalized: !!checked })
                }
              />
              <span className="text-xs">Finalized</span>
            </label>
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

        {/* Our Fee */}
        {(() => {
          const ourFee = financial.counsel_fees.find((f) => f.is_our_firm)
          if (!ourFee) return null
          return (
            <div className="border-t pt-3">
              <span className="text-xs text-muted-foreground block mb-1.5">Our Fee</span>
              <CounselFeeRow
                fee={ourFee}
                grossRecovery={financial.gross_recovery}
                onUpdate={(data) => updateFeeMutation.mutate({ feeId: ourFee.id, data })}
                canDelete={false}
              />
            </div>
          )
        })()}

        {/* Co-Counsel Fees */}
        <div className="border-t pt-3">
          {(() => {
            const existingPersonRoleIds = new Set(
              financial.counsel_fees
                .filter((f) => f.person_role_id != null)
                .map((f) => f.person_role_id)
            )
            const eligiblePersons = casePersons.filter(
              (p) =>
                FEE_ELIGIBLE_ROLES.includes(p.role.name) &&
                !existingPersonRoleIds.has(p.assignment_id)
            )
            return (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Co-Counsel</span>
                {eligiblePersons.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-5">
                        <HugeiconsIcon icon={Add01Icon} className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {eligiblePersons.map((p) => (
                        <DropdownMenuItem
                          key={p.assignment_id}
                          onClick={() =>
                            addFeeMutation.mutate({
                              counsel_name: p.name,
                              fee_type: "percentage",
                              is_our_firm: false,
                              person_role_id: p.assignment_id,
                              sort_order: financial.counsel_fees.length,
                            })
                          }
                        >
                          <span className="text-xs">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {p.role.name.replace(/_/g, " ")}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })()}
          {(() => {
            const coCounsel = financial.counsel_fees.filter((f) => !f.is_our_firm)
            return coCounsel.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No co-counsel added.
              </p>
            ) : (
              <div className="space-y-2">
                {coCounsel.map((fee) => (
                  <CounselFeeRow
                    key={fee.id}
                    fee={fee}
                    grossRecovery={financial.gross_recovery}
                    onUpdate={(data) => updateFeeMutation.mutate({ feeId: fee.id, data })}
                    onDelete={() => deleteFeeMutation.mutate(fee.id)}
                    canDelete
                  />
                ))}
              </div>
            )
          })()}
        </div>

        {/* Costs / Invoices link */}
        <div className="border-t pt-3">
          <Link
            to={`/cases/${caseId}/costs`}
            state={location.state}
            className="flex items-center justify-between group hover:bg-muted/50 -mx-3 px-3 py-2 transition-colors"
          >
            <div>
              <span className="text-xs font-medium">Costs & Invoices</span>
              {invoiceStats && invoiceStats.unpaid_count > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {invoiceStats.unpaid_count} unpaid &middot; $
                  {Number(invoiceStats.unpaid_total).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No unpaid invoices</p>
              )}
            </div>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors"
            />
          </Link>
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
  canDelete = true,
}: {
  fee: CounselFee
  grossRecovery: number | null
  onUpdate: (data: Record<string, unknown>) => void
  onDelete?: () => void
  canDelete?: boolean
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
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive w-full h-6"
              onClick={onDelete}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3 mr-1" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
