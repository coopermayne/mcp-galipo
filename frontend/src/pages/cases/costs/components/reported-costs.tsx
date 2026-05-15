import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getCostSharing,
  type Invoice,
} from "@/services/invoices"

interface ReportedCostsSectionProps {
  caseId: number
  onChanged: () => void
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function ReportedCostsSection({ caseId, onChanged }: ReportedCostsSectionProps) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)

  const { data: costSharing } = useQuery({
    queryKey: ["cost-sharing", caseId],
    queryFn: () => getCostSharing(caseId),
    enabled: true,
  })

  const { data } = useQuery({
    queryKey: ["invoices", "case", caseId, "reported"],
    queryFn: () =>
      listInvoices({
        case_id: caseId,
        type: "reported",
        sort_by: "date",
        sort_dir: "desc",
        limit: 500,
      }),
  })

  const reported = data?.invoices ?? []
  const parties = costSharing?.parties_with_pct?.filter((p) => p.person_id != null) ?? []

  if (!costSharing?.config || parties.length === 0) return null

  async function handleDelete(id: number) {
    try {
      await deleteInvoice(id)
      toast.success("Reported cost deleted")
      queryClient.invalidateQueries({ queryKey: ["invoices", "case", caseId, "reported"] })
      onChanged()
    } catch {
      toast.error("Failed to delete")
    }
  }

  const byParty = new Map<number, { label: string; total: number; items: Invoice[] }>()
  for (const p of parties) {
    if (p.person_id) byParty.set(p.person_id, { label: p.label, total: 0, items: [] })
  }
  for (const inv of reported) {
    const pid = inv.paid_by_person_id
    if (pid && byParty.has(pid)) {
      const entry = byParty.get(pid)!
      entry.total += parseFloat(inv.amount)
      entry.items.push(inv)
    }
  }

  return (
    <>
      <div className="border p-3 text-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Reported Co-Counsel Costs
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} className="mr-1 size-3" />
            Add
          </Button>
        </div>
        {reported.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No reported costs yet. Use this to record costs that co-counsel has declared without providing itemized invoices.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {Array.from(byParty.entries()).map(([personId, { label, total, items }]) => (
              <div key={personId}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{label}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
                </div>
                {items.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 pl-3 text-xs text-muted-foreground group"
                  >
                    <span className="tabular-nums">{inv.date ?? "—"}</span>
                    <span className="truncate flex-1">{inv.description || "Reported costs"}</span>
                    <span className="tabular-nums">{formatMoney(parseFloat(inv.amount))}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground"
                      onClick={() => setEditing(inv)}
                    >
                      <HugeiconsIcon icon={PencilEdit01Icon} className="size-3" />
                    </button>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                      onClick={() => handleDelete(inv.id)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <ReportedCostDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        caseId={caseId}
        parties={parties}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["invoices", "case", caseId, "reported"] })
          onChanged()
        }}
      />
      <ReportedCostDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        caseId={caseId}
        parties={parties}
        invoice={editing}
        onSuccess={() => {
          setEditing(null)
          queryClient.invalidateQueries({ queryKey: ["invoices", "case", caseId, "reported"] })
          onChanged()
        }}
      />
    </>
  )
}

function ReportedCostDialog({
  open,
  onOpenChange,
  caseId,
  parties,
  invoice,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  parties: { person_id: number | null; label: string }[]
  invoice?: Invoice | null
  onSuccess: () => void
}) {
  const isEdit = !!invoice
  const [partyId, setPartyId] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (invoice) {
        setPartyId(invoice.paid_by_person_id ? String(invoice.paid_by_person_id) : "")
        setAmount(String(invoice.amount))
        setDate(invoice.date ?? "")
        setDescription(invoice.description ?? "")
      } else {
        setPartyId(parties.length === 1 && parties[0].person_id ? String(parties[0].person_id) : "")
        setAmount("")
        setDate(new Date().toISOString().split("T")[0])
        setDescription("")
      }
    }
  }, [open, invoice, parties])

  const isValid = !!partyId && parseFloat(amount) > 0 && !!date

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setSaving(true)
    try {
      if (isEdit && invoice) {
        await updateInvoice(invoice.id, {
          amount: parseFloat(amount),
          date,
          description: description.trim() || "Reported costs",
          paid_by_person_id: parseInt(partyId),
        })
        toast.success("Reported cost updated")
      } else {
        await createInvoice({
          case_id: caseId,
          type: "reported",
          amount: parseFloat(amount),
          date,
          description: description.trim() || "Reported costs",
          paid_by_person_id: parseInt(partyId),
        })
        toast.success("Reported cost added")
      }
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Failed to save reported cost")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Reported Cost" : "Add Reported Cost"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Co-Counsel</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select party..." />
              </SelectTrigger>
              <SelectContent>
                {parties.map((p) =>
                  p.person_id ? (
                    <SelectItem key={p.person_id} value={String(p.person_id)}>
                      {p.label}
                    </SelectItem>
                  ) : null
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reported-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="reported-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <DatePicker
                value={date || null}
                onChange={(d) => setDate(d ?? "")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reported-description">Description</Label>
            <Textarea
              id="reported-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g., Expert fees through March 2026"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !isValid}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
