import { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INVOICE_CATEGORIES, type ExtractedInvoice } from "@/services/invoices"

interface InvoiceConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  extracted: ExtractedInvoice | null
  fileName: string
  onConfirm: (data: Record<string, unknown>) => Promise<void>
}

export function InvoiceConfirmDialog({
  open,
  onOpenChange,
  extracted,
  fileName,
  onConfirm,
}: InvoiceConfirmDialogProps) {
  const [vendor, setVendor] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [payableTo, setPayableTo] = useState("")
  const [paymentAddress, setPaymentAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (extracted) {
      setVendor(extracted.vendor ?? "")
      setAmount(extracted.amount != null ? String(extracted.amount) : "")
      setDate(extracted.date ?? "")
      setDueDate(extracted.due_date ?? "")
      setDescription(extracted.description ?? "")
      setCategory(extracted.category ?? "")
      setCheckNumber(extracted.check_number ?? "")
      setPayableTo(extracted.payable_to ?? "")
      setPaymentAddress(extracted.payment_address ?? "")
      setNotes(extracted.notes ?? "")
    }
  }, [extracted])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vendor.trim() || !amount) return

    setSaving(true)
    try {
      await onConfirm({
        vendor: vendor.trim(),
        amount: parseFloat(amount),
        date: date || undefined,
        due_date: dueDate || undefined,
        description: description.trim() || undefined,
        category: category || undefined,
        check_number: checkNumber.trim() || undefined,
        payable_to: payableTo.trim() || undefined,
        payment_address: paymentAddress.trim() || undefined,
        notes: notes.trim() || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Invoice Details</DialogTitle>
          {fileName && (
            <p className="text-sm text-muted-foreground truncate">{fileName}</p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Invoice Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="check_number">Check #</Label>
              <Input
                id="check_number"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="payable_to">Payable To</Label>
            <Input
              id="payable_to"
              value={payableTo}
              onChange={(e) => setPayableTo(e.target.value)}
              placeholder="Name to make check out to"
            />
          </div>
          <div>
            <Label htmlFor="payment_address">Payment Address</Label>
            <Textarea
              id="payment_address"
              value={paymentAddress}
              onChange={(e) => setPaymentAddress(e.target.value)}
              rows={3}
              placeholder="Address to mail payment to"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Special payment instructions"
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
            <Button type="submit" disabled={saving || !vendor.trim() || !amount}>
              {saving ? "Adding..." : "Add Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
