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
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type Invoice,
  updateInvoice,
  getCostSharing,
} from "@/services/invoices"

interface EditTransferDialogProps {
  invoice: Invoice | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditTransferDialog({
  invoice,
  onOpenChange,
  onSuccess,
}: EditTransferDialogProps) {
  const [direction, setDirection] = useState<"counsel_pays_us" | "we_pay_counsel">("counsel_pays_us")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: costSharing } = useQuery({
    queryKey: ["cost-sharing", invoice?.case_id],
    queryFn: () => getCostSharing(invoice!.case_id),
    enabled: !!invoice?.case_id,
  })

  const partnerName = costSharing?.partner?.name ?? "Co-counsel"
  const counselId = costSharing?.partner?.person_id ?? null

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.amount))
      setDate(invoice.date ?? "")
      setDescription(invoice.description ?? "")

      if (invoice.transfer_to_person_id) {
        setDirection("we_pay_counsel")
      } else {
        setDirection("counsel_pays_us")
      }
    }
  }, [invoice])

  const isValid = parseFloat(amount) > 0 && !!date

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice || !isValid) return

    setSaving(true)
    try {
      const isWePayThem = direction === "we_pay_counsel"
      await updateInvoice(invoice.id, {
        amount: parseFloat(amount),
        date: date || undefined,
        description: description.trim() || `Transfer ${isWePayThem ? "to" : "from"} ${partnerName}`,
        paid_by_person_id: isWePayThem ? null : counselId,
        transfer_to_person_id: isWePayThem ? counselId : null,
      })
      toast.success("Transfer updated")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to update transfer")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
                  required
                />
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <DatePicker
                value={date || null}
                onChange={(d) => setDate(d ?? "")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="transfer-description">Description</Label>
            <Textarea
              id="transfer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !isValid}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
