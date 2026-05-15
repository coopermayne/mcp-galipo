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
import { Checkbox } from "@/components/ui/checkbox"
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
  getSettlement,
  type SettlementTransfer,
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
  const { data: costSharing, isLoading: sharingLoading } = useQuery({
    queryKey: ["cost-sharing", caseId],
    queryFn: () => getCostSharing(caseId),
    enabled: open,
  })

  if (sharingLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Transfer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        </DialogContent>
      </Dialog>
    )
  }

  const partyCount = costSharing?.parties_with_pct?.length ?? 0
  if (partyCount > 2) {
    return (
      <SettlementChecklistDialog
        open={open}
        onOpenChange={onOpenChange}
        caseId={caseId}
        onSuccess={onSuccess}
      />
    )
  }

  return (
    <SimpleTransferDialog
      open={open}
      onOpenChange={onOpenChange}
      caseId={caseId}
      onSuccess={onSuccess}
    />
  )
}

// ---------------------------------------------------------------------------
// Simple (legacy 2-party) — unchanged behavior
// ---------------------------------------------------------------------------

function SimpleTransferDialog({
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

  const parties = costSharing?.parties_with_pct ?? []
  const oursEntry = parties.find((p) => p.party_id === "ours")
  const partnerEntry = parties.find((p) => p.party_id !== "ours")
  const ourPct = oursEntry?.pct ?? null
  const partnerName = partnerEntry?.label ?? "Co-counsel"
  const partnerId = partnerEntry?.person_id ?? null

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
      const counselId = eqData?.counsel_id ?? partnerId ?? undefined

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

// ---------------------------------------------------------------------------
// Settlement checklist (N parties, advanced mode)
// ---------------------------------------------------------------------------

function SettlementChecklistDialog({
  open,
  onOpenChange,
  caseId,
  onSuccess,
}: TransferDialogProps) {
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["settlement", caseId],
    queryFn: () => getSettlement(caseId),
    enabled: open,
  })

  useEffect(() => {
    if (data) {
      const initial: Record<number, boolean> = {}
      data.transfers.forEach((_, i) => { initial[i] = true })
      setSelected(initial)
    }
  }, [data])

  useEffect(() => {
    if (!open) setSelected({})
  }, [open])

  async function handleCreate() {
    if (!data) return
    const toCreate = data.transfers.filter((_, i) => selected[i])
    if (toCreate.length === 0) return

    setCreating(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      // Create transfers serially so a partial failure doesn't leave us in an
      // ambiguous state (refresh shows what was actually created).
      for (const t of toCreate) {
        await createInvoice({
          case_id: caseId,
          amount: t.amount,
          date: today,
          description: `Transfer from ${t.from_label ?? t.from_party} to ${t.to_label ?? t.to_party}`,
          category: "Miscellaneous",
          paid_by_person_id: t.from_person_id ?? undefined,
          transfer_to_person_id: t.to_person_id ?? undefined,
          is_transfer: true,
        })
      }
      toast.success(`Recorded ${toCreate.length} transfer${toCreate.length > 1 ? "s" : ""}`)
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to record transfers")
    } finally {
      setCreating(false)
    }
  }

  const toggle = (i: number) => setSelected((s) => ({ ...s, [i]: !s[i] }))
  const checkedCount = Object.values(selected).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settle Costs</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : data.transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            All parties are already settled.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Suggested transfers to bring everyone to their target share:
            </p>
            <div className="border divide-y">
              {data.transfers.map((t, i) => (
                <SettlementRow
                  key={i}
                  transfer={t}
                  checked={!!selected[i]}
                  onToggle={() => toggle(i)}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {data && data.transfers.length > 0 && (
            <Button
              onClick={handleCreate}
              disabled={creating || checkedCount === 0}
            >
              {creating ? "Recording…" : `Record ${checkedCount} transfer${checkedCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettlementRow({
  transfer,
  checked,
  onToggle,
}: {
  transfer: SettlementTransfer
  checked: boolean
  onToggle: () => void
}) {
  const fromLabel = transfer.from_label ?? transfer.from_party
  const toLabel = transfer.to_label ?? transfer.to_party
  return (
    <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 text-sm">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="font-medium">{fromLabel}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium">{toLabel}</span>
      <span className="ml-auto font-semibold tabular-nums text-purple">
        {formatCurrency(transfer.amount)}
      </span>
    </label>
  )
}
