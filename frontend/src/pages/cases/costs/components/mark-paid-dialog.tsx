import { useState, useEffect } from "react"
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
  const [paymentRef, setPaymentRef] = useState("")
  const [paidDate, setPaidDate] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (invoice) {
      setPaymentRef("")
      setPaidDate(new Date().toISOString().slice(0, 10))
    }
  }, [invoice])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice || !paymentRef.trim()) return

    setSaving(true)
    try {
      await markInvoicePaid(invoice.id, {
        check_number: paymentRef.trim(),
        paid_date: paidDate || undefined,
      })
      toast.success("Invoice marked as paid")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to mark invoice as paid")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="payment-ref">Payment Reference</Label>
            <Input
              id="payment-ref"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder='Check #, last 4 of card, or "CASH"'
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter check number, last 4 digits of credit card, or CASH
            </p>
          </div>
          <div>
            <Label htmlFor="paid-date">Payment Date</Label>
            <Input
              id="paid-date"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
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
            <Button type="submit" disabled={saving || !paymentRef.trim()}>
              {saving ? "Saving..." : "Mark Paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
