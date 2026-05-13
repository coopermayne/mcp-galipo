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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type Lien, updateLien } from "@/services/liens"
import { PayeeSearch } from "@/pages/cases/costs/components/payee-search"

interface EditLienDialogProps {
  lien: Lien | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditLienDialog({
  lien,
  onOpenChange,
  onSuccess,
}: EditLienDialogProps) {
  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [claimedAmount, setClaimedAmount] = useState("")
  const [negotiatedAmount, setNegotiatedAmount] = useState("")
  const [status, setStatus] = useState("pending")
  const [date, setDate] = useState("")
  const [paidDate, setPaidDate] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (lien) {
      setPayeeId(lien.payee_id)
      setClaimedAmount(lien.claimed_amount)
      setNegotiatedAmount(lien.negotiated_amount ?? "")
      setStatus(lien.status)
      setDate(lien.date ?? "")
      setPaidDate(lien.paid_date ?? "")
      setCheckNumber(lien.check_number ?? "")
      setDescription(lien.description ?? "")
      setNotes(lien.notes ?? "")
    }
  }, [lien])

  const isValid = !!claimedAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lien || !isValid) return

    setSaving(true)
    try {
      await updateLien(lien.id, {
        payee_id: payeeId,
        claimed_amount: parseFloat(claimedAmount),
        negotiated_amount: negotiatedAmount
          ? parseFloat(negotiatedAmount)
          : null,
        status: status as "pending" | "negotiated" | "paid",
        date: date || undefined,
        paid_date: paidDate || null,
        check_number: checkNumber.trim() || null,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Lien updated")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to update lien")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!lien} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lien</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PayeeSearch value={payeeId} onChange={setPayeeId} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-lien-claimed">Claimed Amount</Label>
              <Input
                id="edit-lien-claimed"
                type="number"
                step="0.01"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-lien-negotiated">Negotiated Amount</Label>
              <Input
                id="edit-lien-negotiated"
                type="number"
                step="0.01"
                value={negotiatedAmount}
                onChange={(e) => setNegotiatedAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="edit-lien-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-lien-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="negotiated">Negotiated</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-lien-date">Date Received</Label>
              <Input
                id="edit-lien-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          {status === "paid" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-lien-check">Check Number</Label>
                <Input
                  id="edit-lien-check"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="Check #"
                />
              </div>
              <div>
                <Label htmlFor="edit-lien-paid-date">Paid Date</Label>
                <Input
                  id="edit-lien-paid-date"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="edit-lien-description">Description</Label>
            <Textarea
              id="edit-lien-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="edit-lien-notes">Notes</Label>
            <Textarea
              id="edit-lien-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
