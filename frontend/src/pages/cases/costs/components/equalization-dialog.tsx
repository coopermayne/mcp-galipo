import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  calculateEqualization,
  createInvoice,
  getCostSharing,
} from "@/services/invoices"

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  onSuccess: () => void
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

export function TransferDialog({
  open,
  onOpenChange,
  caseId,
  onSuccess,
}: TransferDialogProps) {
  const [direction, setDirection] = useState<"counsel_pays_us" | "we_pay_counsel">("counsel_pays_us")
  const [amount, setAmount] = useState("")
  const [creating, setCreating] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const { data: costSharing, isLoading: sharingLoading } = useQuery({
    queryKey: ["cost-sharing", caseId],
    queryFn: () => getCostSharing(caseId),
    enabled: open,
  })

  const ourPct = costSharing?.our_pct ?? null
  const partnerName = costSharing?.partner?.name ?? "Co-counsel"

  const { data: eqData } = useQuery({
    queryKey: ["equalization", caseId, ourPct],
    queryFn: () => calculateEqualization(caseId, ourPct!),
    enabled: open && ourPct != null,
  })

  useEffect(() => {
    if (eqData && !initialized) {
      if (eqData.direction !== "even" && eqData.transfer_amount > 0) {
        setDirection(eqData.direction as "counsel_pays_us" | "we_pay_counsel")
        setAmount(String(eqData.transfer_amount))
      }
      setInitialized(true)
    }
  }, [eqData, initialized])

  useEffect(() => {
    if (!open) {
      setInitialized(false)
      setAmount("")
    }
  }, [open])

  const parsedAmount = parseFloat(amount) || 0

  async function handleCreate() {
    if (parsedAmount <= 0) return

    setCreating(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      const isWePayThem = direction === "we_pay_counsel"
      const counselId = eqData?.counsel_id ?? costSharing?.partner?.person_id ?? undefined

      await createInvoice({
        case_id: caseId,
        amount: parsedAmount,
        date: today,
        description: isWePayThem
          ? `Transfer to ${partnerName}`
          : `Transfer from ${partnerName}`,
        category: "Miscellaneous",
        paid_by_person_id: isWePayThem ? undefined : counselId,
        transfer_to_person_id: isWePayThem ? counselId : undefined,
        is_transfer: true,
      })
      toast.success("Transfer created")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to create transfer")
    } finally {
      setCreating(false)
    }
  }

  const noCostSharing = !sharingLoading && ourPct == null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Transfer</DialogTitle>
        </DialogHeader>

        {noCostSharing ? (
          <p className="text-sm text-muted-foreground py-2">
            Set up a cost-sharing partner first to record transfers.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Equalization hint */}
            {eqData && eqData.direction !== "even" && eqData.transfer_amount > 0 && (
              <div className="flex flex-col gap-2 border border-dashed p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    To equalize ({ourPct}/{ourPct != null ? 100 - ourPct : 0} split):
                  </span>
                  <span className="font-semibold tabular-nums text-purple">
                    {formatCurrency(eqData.transfer_amount)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {eqData.direction === "counsel_pays_us"
                    ? `${eqData.counsel_name ?? "Co-counsel"} owes Our Firm`
                    : `Our Firm owes ${eqData.counsel_name ?? "co-counsel"}`}
                  {eqData.already_transferred > 0 && (
                    <span> (already transferred: {formatCurrency(eqData.already_transferred)})</span>
                  )}
                </div>
              </div>
            )}

            {/* Direction */}
            <div>
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "counsel_pays_us" | "we_pay_counsel")}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="counsel_pays_us">
                    {partnerName} → Our Firm
                  </SelectItem>
                  <SelectItem value="we_pay_counsel">
                    Our Firm → {partnerName}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="transfer-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="transfer-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!noCostSharing && (
            <Button
              onClick={handleCreate}
              disabled={creating || parsedAmount <= 0}
            >
              {creating ? "Creating..." : "Create Transfer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
