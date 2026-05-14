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
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INVOICE_CATEGORIES, type ExtractedInvoice } from "@/services/invoices"
import { PayeeSearch } from "@/pages/cases/costs/components/payee-search"

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
  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [isPartial, setIsPartial] = useState(false)
  const [caseAmount, setCaseAmount] = useState("")
  const [date, setDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const isValid = !!payeeId && !!amount && !!category && !!date

  useEffect(() => {
    if (extracted) {
      setPayeeId(null)
      setAmount(extracted.amount != null ? String(extracted.amount) : "")
      setIsPartial(false)
      setCaseAmount("")
      setDate(extracted.date ?? "")
      setDueDate(extracted.due_date ?? "")
      setDescription(extracted.description ?? "")
      setCategory(extracted.category ?? "")
      setNotes(extracted.notes ?? "")
    }
  }, [extracted])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setSaving(true)
    try {
      await onConfirm({
        payee_id: payeeId ?? undefined,
        amount: parseFloat(amount),
        case_amount: isPartial && caseAmount ? parseFloat(caseAmount) : undefined,
        date: date || undefined,
        due_date: dueDate || undefined,
        description: description.trim() || undefined,
        category: category || undefined,
        notes: notes.trim() || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Invoice Details</DialogTitle>
          {fileName && (
            <p className="text-sm text-muted-foreground break-all">{fileName}</p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PayeeSearch
            value={payeeId}
            onChange={setPayeeId}
            extractedName={extracted?.vendor || extracted?.payable_to}
            extractedAddress={extracted?.payment_address}
          />
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Invoice Date</Label>
              <DatePicker
                value={date || null}
                onChange={(d) => setDate(d ?? "")}
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <DatePicker
                value={dueDate || null}
                onChange={(d) => setDueDate(d ?? "")}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-partial"
              checked={isPartial}
              onCheckedChange={(checked) => {
                setIsPartial(!!checked)
                if (!checked) setCaseAmount("")
              }}
            />
            <Label htmlFor="confirm-partial" className="text-sm font-normal cursor-pointer">
              Only a partial amount applies to this case
            </Label>
          </div>
          {isPartial && (
            <div>
              <Label htmlFor="case_amount">Amount for this case</Label>
              <Input
                id="case_amount"
                type="number"
                step="0.01"
                value={caseAmount}
                onChange={(e) => setCaseAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
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
            <Button type="submit" disabled={saving || !isValid}>
              {saving ? "Adding..." : "Add Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
