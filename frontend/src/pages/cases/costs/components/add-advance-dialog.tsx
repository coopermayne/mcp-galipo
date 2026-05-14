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
import { createInvoice } from "@/services/invoices"

import { PayeeSearch } from "@/pages/cases/costs/components/payee-search"
import { apiFetch } from "@/lib/api"

interface AddAdvanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  onSuccess: () => void
}

export function AddAdvanceDialog({
  open,
  onOpenChange,
  caseId,
  onSuccess,
}: AddAdvanceDialogProps) {
  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [advancedToPersonId, setAdvancedToPersonId] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: casePersons } = useQuery({
    queryKey: ["case-persons", caseId],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cases/${caseId}/persons`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.persons ?? []) as { id: number; name: string }[]
    },
    enabled: open,
  })

  const isValid = !!payeeId && !!amount && !!date

  function reset() {
    setPayeeId(null)
    setAmount("")
    setDate("")
    setCheckNumber("")
    setAdvancedToPersonId("")
    setDescription("")
    setNotes("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setSaving(true)
    try {
      await createInvoice({
        case_id: caseId,
        type: "advance",
        amount: parseFloat(amount),
        date: date || undefined,
        check_number: checkNumber.trim() || undefined,
        payee_id: payeeId ?? undefined,
        advanced_to_person_id: advancedToPersonId
          ? parseInt(advancedToPersonId)
          : undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success("Advance added")
      reset()
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to add advance")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Advance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PayeeSearch value={payeeId} onChange={setPayeeId} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="adv-amount">Amount</Label>
              <Input
                id="adv-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="adv-date">Agreement Date</Label>
              <Input
                id="adv-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="adv-check">Check Number</Label>
              <Input
                id="adv-check"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Check #"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="adv-recipient">Advanced To</Label>
            <Select
              value={advancedToPersonId}
              onValueChange={setAdvancedToPersonId}
            >
              <SelectTrigger id="adv-recipient">
                <SelectValue placeholder="Select person..." />
              </SelectTrigger>
              <SelectContent>
                {(casePersons ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="adv-description">Description</Label>
            <Textarea
              id="adv-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this advance for?"
            />
          </div>
          <div>
            <Label htmlFor="adv-notes">Notes</Label>
            <Textarea
              id="adv-notes"
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
              {saving ? "Adding..." : "Add Advance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
