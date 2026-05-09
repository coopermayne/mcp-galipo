import { useState } from "react"
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
import { createInvoice, INVOICE_CATEGORIES, getCaseCounsel } from "@/services/invoices"
import { PayeeSearch } from "@/pages/cases/costs/components/payee-search"

interface AddInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  onSuccess: () => void
}

export function AddInvoiceDialog({
  open,
  onOpenChange,
  caseId,
  onSuccess,
}: AddInvoiceDialogProps) {
  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [caseAmount, setCaseAmount] = useState("")
  const [date, setDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [paidByPersonId, setPaidByPersonId] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: counsel } = useQuery({
    queryKey: ["case-counsel", caseId],
    queryFn: () => getCaseCounsel(caseId),
    enabled: open,
  })

  function reset() {
    setPayeeId(null)
    setAmount("")
    setCaseAmount("")
    setDate("")
    setDueDate("")
    setDescription("")
    setCategory("")
    setPaidByPersonId("")
    setNotes("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount) return

    setSaving(true)
    try {
      await createInvoice({
        case_id: caseId,
        amount: parseFloat(amount),
        case_amount: caseAmount ? parseFloat(caseAmount) : undefined,
        date: date || undefined,
        due_date: dueDate || undefined,
        description: description.trim() || undefined,
        category: category || undefined,
        paid_by_person_id: paidByPersonId && paidByPersonId !== "__clear" ? parseInt(paidByPersonId) : undefined,
        payee_id: payeeId ?? undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Invoice added")
      reset()
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to add invoice")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Invoice</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PayeeSearch
            value={payeeId}
            onChange={setPayeeId}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="add-amount">Total Amount</Label>
              <Input
                id="add-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="add-case-amount">Case Amount</Label>
              <Input
                id="add-case-amount"
                type="number"
                step="0.01"
                value={caseAmount}
                onChange={(e) => setCaseAmount(e.target.value)}
                placeholder="Full amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank if full amount applies
              </p>
            </div>
            <div>
              <Label htmlFor="add-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="add-category">
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
              <Label htmlFor="add-paid-by">Paid By</Label>
              <Select value={paidByPersonId} onValueChange={setPaidByPersonId}>
                <SelectTrigger id="add-paid-by">
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
              <Label htmlFor="add-date">Invoice Date</Label>
              <Input
                id="add-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-due-date">Due Date</Label>
              <Input
                id="add-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="add-description">Description</Label>
            <Textarea
              id="add-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this cost for?"
            />
          </div>
          <div>
            <Label htmlFor="add-notes">Notes</Label>
            <Textarea
              id="add-notes"
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
            <Button type="submit" disabled={saving || !amount}>
              {saving ? "Adding..." : "Add Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
