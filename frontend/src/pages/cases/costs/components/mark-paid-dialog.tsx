import { useState } from "react"
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
import { type Invoice, markInvoicePaid } from "@/services/invoices"

interface MarkPaidDialogProps {
  invoice: Invoice | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MarkPaidDialog({
  invoice,
  onOpenChange,
  onSuccess,
}: MarkPaidDialogProps) {
  const [saving, setSaving] = useState(false)
  const [checkNumber, setCheckNumber] = useState("")
  const [paidDate, setPaidDate] = useState(
    () => new Date().toISOString().split("T")[0]
  )

  function handleOpenChange(open: boolean) {
    if (!open) {
      setCheckNumber("")
      setPaidDate(new Date().toISOString().split("T")[0])
    }
    onOpenChange(open)
  }

  async function handleConfirm() {
    if (!invoice) return

    setSaving(true)
    try {
      await markInvoicePaid(invoice.id, {
        check_number: checkNumber || undefined,
        paid_date: paidDate || undefined,
      })
      toast.success("Marked as paid")
      handleOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to mark as paid")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
          {invoice && (
            <p className="text-sm text-muted-foreground">
              {invoice.payee_name ?? "No payee"} &middot;{" "}
              {Number(invoice.amount).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
          )}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="check-number">Payment Reference</Label>
            <Input
              id="check-number"
              placeholder='Check #, last 4 of card, or "CASH"'
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="paid-date">Date Paid</Label>
            <Input
              id="paid-date"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Saving..." : "Mark Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
