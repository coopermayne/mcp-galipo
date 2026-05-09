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
  INVOICE_CATEGORIES,
  getInvoiceFileUrl,
  getCaseCounsel,
} from "@/services/invoices"
import { HugeiconsIcon } from "@hugeicons/react"
import { Attachment01Icon } from "@hugeicons/core-free-icons"

interface EditInvoiceDialogProps {
  invoice: Invoice | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditInvoiceDialog({
  invoice,
  onOpenChange,
  onSuccess,
}: EditInvoiceDialogProps) {
  const [vendor, setVendor] = useState("")
  const [amount, setAmount] = useState("")
  const [caseAmount, setCaseAmount] = useState("")
  const [date, setDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [paidByPersonId, setPaidByPersonId] = useState("")
  const [payableTo, setPayableTo] = useState("")
  const [paymentAddress, setPaymentAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: counsel } = useQuery({
    queryKey: ["case-counsel", invoice?.case_id],
    queryFn: () => getCaseCounsel(invoice!.case_id),
    enabled: !!invoice?.case_id,
  })

  useEffect(() => {
    if (invoice) {
      setVendor(invoice.vendor)
      setAmount(String(invoice.amount))
      setCaseAmount(invoice.case_amount ?? "")
      setDate(invoice.date ?? "")
      setDueDate(invoice.due_date ?? "")
      setDescription(invoice.description ?? "")
      setCategory(invoice.category ?? "")
      setPaidByPersonId(invoice.paid_by_person_id ? String(invoice.paid_by_person_id) : "")
      setPayableTo(invoice.payable_to ?? "")
      setPaymentAddress(invoice.payment_address ?? "")
      setNotes(invoice.notes ?? "")
    }
  }, [invoice])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice || !vendor.trim() || !amount) return

    setSaving(true)
    try {
      await updateInvoice(invoice.id, {
        vendor: vendor.trim(),
        amount: parseFloat(amount),
        case_amount: caseAmount ? parseFloat(caseAmount) : null,
        date: date || undefined,
        due_date: dueDate || undefined,
        description: description.trim() || undefined,
        category: category || undefined,
        paid_by_person_id: paidByPersonId && paidByPersonId !== "__clear" ? parseInt(paidByPersonId) : null,
        payable_to: payableTo.trim() || undefined,
        payment_address: paymentAddress.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Invoice updated")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to update invoice")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          {invoice?.file_path && (
            <a
              href={getInvoiceFileUrl(invoice.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <HugeiconsIcon icon={Attachment01Icon} className="size-3.5" />
              {invoice.file_name ?? "View file"}
            </a>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="edit-vendor">Vendor</Label>
              <Input
                id="edit-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-amount">Total Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-case-amount">Case Amount</Label>
              <Input
                id="edit-case-amount"
                type="number"
                step="0.01"
                value={caseAmount}
                onChange={(e) => setCaseAmount(e.target.value)}
                placeholder="Full amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank if full amount applies to this case
              </p>
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="edit-category">
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
              <Label htmlFor="edit-paid-by">Paid By</Label>
              <Select value={paidByPersonId} onValueChange={setPaidByPersonId}>
                <SelectTrigger id="edit-paid-by">
                  <SelectValue placeholder="Our Firm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear">Our Firm</SelectItem>
                  {counsel?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}{c.organization ? ` (${c.organization})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-date">Invoice Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="edit-payable-to">Payable To</Label>
            <Input
              id="edit-payable-to"
              value={payableTo}
              onChange={(e) => setPayableTo(e.target.value)}
              placeholder="Name to make check out to"
            />
          </div>
          <div>
            <Label htmlFor="edit-payment-address">Payment Address</Label>
            <Textarea
              id="edit-payment-address"
              value={paymentAddress}
              onChange={(e) => setPaymentAddress(e.target.value)}
              rows={3}
              placeholder="Address to mail payment to"
            />
          </div>
          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Special payment instructions"
            />
          </div>
          {invoice?.status === "paid" && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <Label className="text-muted-foreground">Payment Ref</Label>
                <p className="text-sm">{invoice.check_number || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Paid Date</Label>
                <p className="text-sm">{invoice.paid_date || "—"}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !vendor.trim() || !amount}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
