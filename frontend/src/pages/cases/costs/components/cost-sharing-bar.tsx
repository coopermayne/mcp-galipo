import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getCostSharing,
  setCostSharing,
} from "@/services/invoices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CostSharingBarProps {
  caseId: number
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}

export function CostSharingBar({ caseId, editing: editingProp, onEditingChange }: CostSharingBarProps) {
  const queryClient = useQueryClient()
  const [internalEditing, setInternalEditing] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState("")
  const [theirPct, setTheirPct] = useState("50")
  const [saving, setSaving] = useState(false)

  const editing = editingProp ?? internalEditing
  function setEditing(val: boolean) {
    onEditingChange?.(val)
    setInternalEditing(val)
  }

  const { data, isLoading } = useQuery({
    queryKey: ["cost-sharing", caseId],
    queryFn: () => getCostSharing(caseId),
  })

  useEffect(() => {
    if (editingProp && data) {
      const partner = data.partner
      setSelectedPerson(partner ? String(partner.person_id) : "")
      setTheirPct(partner?.cost_share_pct != null ? String(partner.cost_share_pct) : "50")
    }
  }, [editingProp, data])

  if (isLoading || !data) return null
  if (data.co_counsel.length === 0) return null

  const partner = data.partner
  const ourPct = data.our_pct

  function startEditing() {
    setSelectedPerson(partner ? String(partner.person_id) : "")
    setTheirPct(partner?.cost_share_pct != null ? String(partner.cost_share_pct) : "50")
    setEditing(true)
  }

  async function handleSave() {
    if (!selectedPerson) return
    setSaving(true)
    try {
      await setCostSharing(caseId, parseInt(selectedPerson), parseFloat(theirPct) || 50)
      queryClient.invalidateQueries({ queryKey: ["cost-sharing", caseId] })
      queryClient.invalidateQueries({ queryKey: ["equalization"] })
      queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
      toast.success("Cost sharing updated")
      setEditing(false)
    } catch {
      toast.error("Failed to update cost sharing")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-3 border border-dashed p-3 text-sm">
        <span className="text-muted-foreground shrink-0">Cost sharing:</span>
        <Select value={selectedPerson} onValueChange={setSelectedPerson}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue placeholder="Select co-counsel..." />
          </SelectTrigger>
          <SelectContent>
            {data.co_counsel.map((c) => (
              <SelectItem key={c.person_id} value={String(c.person_id)}>
                {c.name}
                {c.organization ? ` (${c.organization})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground shrink-0">pays</span>
        <Input
          type="number"
          min="1"
          max="99"
          step="1"
          value={theirPct}
          onChange={(e) => setTheirPct(e.target.value)}
          className="w-[70px] h-8 text-sm text-center"
        />
        <span className="text-muted-foreground shrink-0">%</span>
        <span className="text-muted-foreground shrink-0">
          (we pay {100 - (parseFloat(theirPct) || 0)}%)
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={saving || !selectedPerson}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    )
  }

  if (!partner) return null

  return (
    <div className="flex items-center gap-3 border p-3 text-sm">
      <span className="text-muted-foreground">Cost split:</span>
      <span className="font-medium">
        Our Firm {ourPct != null ? `${ourPct}%` : "—"}
      </span>
      <span className="text-muted-foreground">/</span>
      <span className="font-medium">
        {partner.name} {partner.cost_share_pct != null ? `${partner.cost_share_pct}%` : "—"}
      </span>
      <button
        onClick={startEditing}
        className="text-xs text-muted-foreground hover:text-foreground underline ml-auto"
      >
        Edit
      </button>
    </div>
  )
}
