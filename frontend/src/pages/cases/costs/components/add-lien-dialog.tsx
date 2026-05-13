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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createLien } from "@/services/liens"
import { PayeeSearch } from "@/pages/cases/costs/components/payee-search"

interface AddLienDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  onSuccess: () => void
}

export function AddLienDialog({
  open,
  onOpenChange,
  caseId,
  onSuccess,
}: AddLienDialogProps) {
  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [claimedAmount, setClaimedAmount] = useState("")
  const [negotiatedAmount, setNegotiatedAmount] = useState("")
  const [status, setStatus] = useState("pending")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const isValid = !!payeeId && !!claimedAmount

  function reset() {
    setPayeeId(null)
    setClaimedAmount("")
    setNegotiatedAmount("")
    setStatus("pending")
    setDate("")
    setDescription("")
    setNotes("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setSaving(true)
    try {
      await createLien({
        case_id: caseId,
        claimed_amount: parseFloat(claimedAmount),
        negotiated_amount: negotiatedAmount
          ? parseFloat(negotiatedAmount)
          : undefined,
        payee_id: payeeId ?? undefined,
        status: status as "pending" | "negotiated" | "paid",
        date: date || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Lien added")
      reset()
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to add lien")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Lien</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PayeeSearch value={payeeId} onChange={setPayeeId} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lien-claimed">Claimed Amount</Label>
              <Input
                id="lien-claimed"
                type="number"
                step="0.01"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="lien-negotiated">Negotiated Amount</Label>
              <Input
                id="lien-negotiated"
                type="number"
                step="0.01"
                value={negotiatedAmount}
                onChange={(e) => setNegotiatedAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="lien-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="lien-status">
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
              <Label htmlFor="lien-date">Date Received</Label>
              <Input
                id="lien-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lien-description">Description</Label>
            <Textarea
              id="lien-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this lien for?"
            />
          </div>
          <div>
            <Label htmlFor="lien-notes">Notes</Label>
            <Textarea
              id="lien-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Negotiation details..."
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
              {saving ? "Adding..." : "Add Lien"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
