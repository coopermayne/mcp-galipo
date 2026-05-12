import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import {
  getCostSharing,
  setCostSharing,
  removeCostSharing,
} from "@/services/invoices"
import {
  searchPersons,
  createPerson,
} from "@/services/persons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CostSharingBarProps {
  caseId: number
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}

export function CostSharingBar({ caseId, editing: editingProp, onEditingChange }: CostSharingBarProps) {
  const queryClient = useQueryClient()
  const [internalEditing, setInternalEditing] = useState(false)
  const [theirPct, setTheirPct] = useState("50")
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Person selection state
  const [search, setSearch] = useState("")
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string } | null>(null)
  const [mode, setMode] = useState<"pick" | "create">("pick")
  const [newName, setNewName] = useState("")

  const debouncedSearch = useDebounce(search, 300)

  const editing = editingProp ?? internalEditing
  function setEditing(val: boolean) {
    onEditingChange?.(val)
    setInternalEditing(val)
  }

  const { data, isLoading } = useQuery({
    queryKey: ["cost-sharing", caseId],
    queryFn: () => getCostSharing(caseId),
  })

  const { data: searchResults } = useQuery({
    queryKey: ["person-search", debouncedSearch],
    queryFn: () => searchPersons({ name: debouncedSearch, limit: 10 }),
    enabled: editing && mode === "pick" && debouncedSearch.length >= 2,
  })

  useEffect(() => {
    if (editingProp && data) {
      const partner = data.partner
      if (partner) {
        setSelectedPerson({ id: partner.person_id, name: partner.name })
        setTheirPct(partner.cost_share_pct != null ? String(partner.cost_share_pct) : "50")
      } else {
        setSelectedPerson(null)
        setTheirPct("50")
      }
      setSearch("")
      setMode("pick")
      setNewName("")
    }
  }, [editingProp, data])

  if (isLoading || !data) return null

  const partner = data.partner
  const ourPct = data.our_pct
  const coCounsel = data.co_counsel

  function startEditing() {
    if (partner) {
      setSelectedPerson({ id: partner.person_id, name: partner.name })
      setTheirPct(partner.cost_share_pct != null ? String(partner.cost_share_pct) : "50")
    } else {
      setSelectedPerson(null)
      setTheirPct("50")
    }
    setSearch("")
    setMode("pick")
    setNewName("")
    setEditing(true)
  }

  async function handleSave() {
    let personId = selectedPerson?.id
    if (mode === "create" && newName.trim()) {
      setSaving(true)
      try {
        const result = await createPerson({ name: newName.trim() })
        personId = result.person.id
      } catch {
        toast.error("Failed to create person")
        setSaving(false)
        return
      }
    }
    if (!personId) return
    setSaving(true)
    try {
      await setCostSharing(caseId, personId, parseFloat(theirPct) || 50)
      queryClient.invalidateQueries({ queryKey: ["cost-sharing", caseId] })
      queryClient.invalidateQueries({ queryKey: ["equalization"] })
      queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Cost sharing updated")
      setEditing(false)
    } catch {
      toast.error("Failed to update cost sharing")
    } finally {
      setSaving(false)
    }
  }

  const canSave = mode === "create"
    ? newName.trim().length > 0
    : selectedPerson != null

  const searchPersons_ = searchResults?.persons ?? []
  const coCounselIds = new Set(coCounsel.map((c) => c.person_id))

  // Split results: co-counsel on case first, then others
  const coCounselResults = coCounsel.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  )
  const otherResults = searchPersons_.filter(
    (p) => !coCounselIds.has(p.id)
  )

  if (editing) {
    return (
      <div className="flex flex-col gap-3 border border-dashed p-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground shrink-0">Cost sharing with:</span>

          {selectedPerson ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">{selectedPerson.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson(null)
                  setSearch("")
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Change
              </button>
            </div>
          ) : mode === "create" ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name..."
                className="w-[200px] h-8 text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMode("pick")}
                className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
              >
                Search instead
              </button>
            </div>
          ) : (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-[200px] h-8 text-sm"
              autoFocus
            />
          )}

          {(selectedPerson || mode === "create") && (
            <>
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
            </>
          )}

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
              disabled={saving || !canSave}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Search results dropdown */}
        {!selectedPerson && mode === "pick" && (
          <div className="max-h-48 overflow-y-auto border divide-y -mt-1">
            {coCounselResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50">
                  Co-counsel on case
                </div>
                {coCounselResults.map((c) => (
                  <button
                    key={c.person_id}
                    type="button"
                    onClick={() => {
                      setSelectedPerson({ id: c.person_id, name: c.name })
                      setTheirPct(c.cost_share_pct != null ? String(c.cost_share_pct) : "50")
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.organization && (
                      <span className="text-muted-foreground">{c.organization}</span>
                    )}
                  </button>
                ))}
              </>
            )}
            {otherResults.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50">
                  Other contacts
                </div>
                {otherResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPerson({ id: p.id, name: p.name })}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.organization && (
                      <span className="text-muted-foreground">{p.organization}</span>
                    )}
                  </button>
                ))}
              </>
            )}
            {debouncedSearch.length >= 2 && coCounselResults.length === 0 && otherResults.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No matches found.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setMode("create")
                setNewName(search)
              }}
              className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
            >
              + Create new person
            </button>
          </div>
        )}
      </div>
    )
  }

  async function handleRemove() {
    if (!confirm(`Remove cost sharing with ${partner?.name}?`)) return
    setRemoving(true)
    try {
      await removeCostSharing(caseId)
      queryClient.invalidateQueries({ queryKey: ["cost-sharing", caseId] })
      queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      toast.success("Cost sharing removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove cost sharing")
    } finally {
      setRemoving(false)
    }
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
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={startEditing}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Edit
        </button>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-xs text-muted-foreground hover:text-destructive underline disabled:opacity-50"
        >
          {removing ? "Removing..." : "Remove"}
        </button>
      </div>
    </div>
  )
}
