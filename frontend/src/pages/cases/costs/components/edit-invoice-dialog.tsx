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
import {
  type Invoice,
  type InvoiceStage,
  INVOICE_STAGES,
  updateInvoice,
  markInvoicePaid,
  INVOICE_CATEGORIES,
  openInvoiceFile,
  getCostSharing,
} from "@/services/invoices"
import { HugeiconsIcon } from "@hugeicons/react"
import { Attachment01Icon } from "@hugeicons/core-free-icons"
import { PayeeSearch } from "@/pages/cases/costs/components/payee-search"
import { InvoiceComments } from "@/pages/invoices/components/invoice-comments"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

const STAGE_ACTIVE_CLASS: Record<InvoiceStage, string> = {
  "Received": "bg-info text-info-foreground border-info",
  "In Review": "bg-warning text-warning-foreground border-warning",
  "Needs Payment": "bg-purple text-purple-foreground border-purple",
  "Paid": "bg-success text-success-foreground border-success",
}

interface EditInvoiceDialogProps {
  invoice: Invoice | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  /** Show the workflow stage control (main invoices page). */
  showStage?: boolean
  /** Show the per-invoice comment thread and clear the unread badge on open. */
  showComments?: boolean
}

export function EditInvoiceDialog({
  invoice,
  onOpenChange,
  onSuccess,
  showStage = false,
  showComments = false,
}: EditInvoiceDialogProps) {
  const isAdvance = invoice?.type === "advance"

  const [payeeId, setPayeeId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [isPartial, setIsPartial] = useState(false)
  const [caseAmount, setCaseAmount] = useState("")
  const [date, setDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [paidByPersonId, setPaidByPersonId] = useState("")
  const [advancedToPersonId, setAdvancedToPersonId] = useState("")
  const [notes, setNotes] = useState("")
  const [stage, setStage] = useState<InvoiceStage>("Received")
  const [checkNumber, setCheckNumber] = useState("")
  const [paidDate, setPaidDate] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: costSharing } = useQuery({
    queryKey: ["cost-sharing", invoice?.case_id],
    queryFn: () => getCostSharing(invoice!.case_id),
    enabled: !!invoice?.case_id,
  })
  const costShareCounsel = costSharing?.config
    ? costSharing.parties_with_pct
        .filter((p) => p.person_id != null)
        .map((p) => ({ person_id: p.person_id as number, name: p.label, organization: p.organization, cost_share_pct: p.pct }))
    : costSharing?.co_counsel.filter((c) => c.cost_share_pct != null) ?? []

  const { data: casePersons } = useQuery({
    queryKey: ["case-persons", invoice?.case_id],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/cases/${invoice!.case_id}/persons`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.persons ?? []) as { id: number; name: string }[]
    },
    enabled: !!invoice?.case_id && isAdvance,
  })

  const isValid = isAdvance
    ? !!payeeId && !!amount && !!date
    : !!payeeId && !!amount && !!category && !!date

  useEffect(() => {
    if (invoice) {
      setPayeeId(invoice.payee_id ?? null)
      setAmount(String(invoice.amount))
      const hasPartial = !!invoice.case_amount
      setIsPartial(hasPartial)
      setCaseAmount(invoice.case_amount ?? "")
      setDate(invoice.date ?? "")
      setDueDate(invoice.due_date ?? "")
      setDescription(invoice.description ?? "")
      setCategory(invoice.category ?? "")
      setPaidByPersonId(invoice.paid_by_person_id ? String(invoice.paid_by_person_id) : "")
      setAdvancedToPersonId(invoice.advanced_to_person_id ? String(invoice.advanced_to_person_id) : "")
      setNotes(invoice.notes ?? "")
      setStage(invoice.stage ?? "Received")
      setCheckNumber(invoice.check_number ?? "")
      setPaidDate(invoice.paid_date ?? "")
    }
  }, [invoice])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invoice || !isValid) return

    setSaving(true)
    try {
      const movingToPaid = showStage && stage === "Paid"
      await updateInvoice(invoice.id, {
        amount: parseFloat(amount),
        case_amount: !isAdvance && isPartial && caseAmount ? parseFloat(caseAmount) : null,
        date: date || undefined,
        due_date: !isAdvance ? (dueDate || undefined) : undefined,
        description: description.trim() || undefined,
        category: !isAdvance ? (category || undefined) : undefined,
        paid_by_person_id: paidByPersonId && paidByPersonId !== "__clear" ? parseInt(paidByPersonId) : null,
        advanced_to_person_id: isAdvance && advancedToPersonId ? parseInt(advancedToPersonId) : null,
        payee_id: payeeId,
        notes: notes.trim() || undefined,
        // Non-paid stage changes ride along with the update; the backend syncs
        // the financial status. "Paid" goes through the dedicated endpoint below
        // so it captures the check number and logs to the case timeline.
        ...(showStage && !movingToPaid ? { stage } : {}),
      })
      if (movingToPaid) {
        await markInvoicePaid(invoice.id, {
          check_number: checkNumber.trim() || undefined,
          paid_date: paidDate || undefined,
        })
      }
      toast.success(isAdvance ? "Advance updated" : "Invoice updated")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error(isAdvance ? "Failed to update advance" : "Failed to update invoice")
    } finally {
      setSaving(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {showStage && (
        <div className="flex flex-col gap-1.5">
          <Label>Stage</Label>
          <div className="flex flex-wrap gap-1">
            {INVOICE_STAGES.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStage(s)}
                className={cn(
                  "border px-2.5 py-1 text-xs font-medium transition-colors",
                  stage === s
                    ? STAGE_ACTIVE_CLASS[s]
                    : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {showStage && stage === "Paid" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="edit-check-number">Check / Ref #</Label>
            <Input
              id="edit-check-number"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Paid Date</Label>
            <DatePicker
              value={paidDate || null}
              onChange={(d) => setPaidDate(d ?? "")}
            />
          </div>
        </div>
      )}
      <PayeeSearch
        value={payeeId}
        valueName={invoice?.payee_name}
        valueAddress={invoice?.payee_address}
        onChange={setPayeeId}
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-amount">Amount</Label>
          <Input
            id="edit-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        {!isAdvance && (
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
        )}
        <div>
          <Label>{isAdvance ? "Agreement Date" : "Invoice Date"}</Label>
          <DatePicker
            value={date || null}
            onChange={(d) => setDate(d ?? "")}
          />
        </div>
        {!isAdvance && (
          <div>
            <Label>Due Date</Label>
            <DatePicker
              value={dueDate || null}
              onChange={(d) => setDueDate(d ?? "")}
            />
          </div>
        )}
        <div>
          <Label htmlFor="edit-paid-by">Paid By</Label>
          <Select value={paidByPersonId} onValueChange={setPaidByPersonId}>
            <SelectTrigger id="edit-paid-by">
              <SelectValue placeholder="Our Firm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear">Our Firm</SelectItem>
              {costShareCounsel.map((c) => (
                <SelectItem key={c.person_id} value={String(c.person_id)}>
                  {c.name}{c.organization ? ` (${c.organization})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isAdvance && (
        <div>
          <Label htmlFor="edit-advanced-to">Advanced To</Label>
          <Select value={advancedToPersonId} onValueChange={setAdvancedToPersonId}>
            <SelectTrigger id="edit-advanced-to">
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
      )}
      {!isAdvance && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-partial"
              checked={isPartial}
              onCheckedChange={(checked) => {
                setIsPartial(!!checked)
                if (!checked) setCaseAmount("")
              }}
            />
            <Label htmlFor="edit-partial" className="text-sm font-normal cursor-pointer">
              Only a partial amount applies to this case
            </Label>
          </div>
          {isPartial && (
            <div>
              <Label htmlFor="edit-case-amount">Amount for this case</Label>
              <Input
                id="edit-case-amount"
                type="number"
                step="0.01"
                value={caseAmount}
                onChange={(e) => setCaseAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
        </>
      )}
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
        <Label htmlFor="edit-notes">Notes</Label>
        <Textarea
          id="edit-notes"
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
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  )

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh]",
          showComments
            ? "sm:max-w-3xl overflow-hidden"
            : "sm:max-w-lg overflow-y-auto"
        )}
      >
        <DialogHeader>
          <DialogTitle>{isAdvance ? "Edit Advance" : "Edit Invoice"}</DialogTitle>
          {invoice?.file_path && (
            <button
              type="button"
              onClick={() => openInvoiceFile(invoice.id)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <HugeiconsIcon icon={Attachment01Icon} className="size-3.5" />
              {invoice.file_name ?? "View file"}
            </button>
          )}
        </DialogHeader>
        {showComments && invoice ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="max-h-[72vh] overflow-y-auto pr-1">{form}</div>
            <div className="h-[72vh]">
              <InvoiceComments invoiceId={invoice.id} />
            </div>
          </div>
        ) : (
          form
        )}
      </DialogContent>
    </Dialog>
  )
}
