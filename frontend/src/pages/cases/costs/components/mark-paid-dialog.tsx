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

  async function handleConfirm() {
    if (!invoice) return

    setSaving(true)
    try {
      await markInvoicePaid(invoice.id, {})
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
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
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
