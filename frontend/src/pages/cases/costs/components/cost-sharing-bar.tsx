import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import {
  getCostSharing,
  setCostSharing,
  removeCostSharing,
  setCostSharingConfig,
  type AdvancedConfig,
  type AdvancedParty,
  type AdvancedCap,
} from "@/services/invoices"
import {
  searchPersons,
  createPerson,
} from "@/services/persons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CostSharingBarProps {
  caseId: number
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}

type AdvancedPartyDraft = AdvancedParty & {
  pct: number
  maxCost?: number | null
}

const OURS = "ours"

function partyIdForPerson(personId: number): string {
  return `p:${personId}`
}

export function CostSharingBar({ caseId, editing: editingProp, onEditingChange }: CostSharingBarProps) {
  const queryClient = useQueryClient()
  const [internalEditing, setInternalEditing] = useState(false)
  const [theirPct, setTheirPct] = useState("50")
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)

  // Person selection state (simple editor)
  const [search, setSearch] = useState("")
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string; organization?: string | null } | null>(null)
  const [mode, setMode] = useState<"pick" | "create">("pick")
  const [newName, setNewName] = useState("")

  // Advanced editor state
  const [advancedMode, setAdvancedMode] = useState(false)
  const [advancedParties, setAdvancedParties] = useState<AdvancedPartyDraft[]>([])

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
    enabled: editing && !advancedMode && mode === "pick" && debouncedSearch.length >= 2,
  })

  // Initialize state when entering edit mode.
  useEffect(() => {
    if (!editing || !data) return
    const parties = data.parties_with_pct
    if (parties.length > 2) {
      setAdvancedMode(true)
      const caps = data.config?.phases?.[0]?.caps ?? []
      const capMap = new Map(caps.map((c) => [c.party, c.max_cumulative]))
      setAdvancedParties(
        parties.map((p) => ({
          id: p.party_id,
          label: p.label,
          person_id: p.person_id,
          organization: p.organization,
          pct: p.pct,
          maxCost: capMap.get(p.party_id) ?? null,
        }))
      )
    } else {
      setAdvancedMode(false)
      const partner = parties.find((p) => p.party_id !== OURS)
      if (partner) {
        setSelectedPerson({ id: partner.person_id!, name: partner.label, organization: partner.organization })
        setTheirPct(String(partner.pct))
      } else {
        setSelectedPerson(null)
        setTheirPct("50")
      }
      setSearch("")
      setMode("pick")
      setNewName("")
    }
  }, [editing, data])

  function invalidateAfterChange() {
    queryClient.invalidateQueries({ queryKey: ["cost-sharing", caseId] })
    queryClient.invalidateQueries({ queryKey: ["equalization"] })
    queryClient.invalidateQueries({ queryKey: ["cost-summary", caseId] })
    queryClient.invalidateQueries({ queryKey: ["settlement", caseId] })
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
  }

  async function handleSaveSimple() {
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
      invalidateAfterChange()
      toast.success("Cost sharing updated")
      setEditing(false)
    } catch {
      toast.error("Failed to update cost sharing")
    } finally {
      setSaving(false)
    }
  }

  function startEditing() {
    if (!data) return
    const parties = data.parties_with_pct
    if (parties.length > 2) {
      setAdvancedMode(true)
      const caps = data.config?.phases?.[0]?.caps ?? []
      const capMap = new Map(caps.map((c) => [c.party, c.max_cumulative]))
      setAdvancedParties(
        parties.map((p) => ({
          id: p.party_id,
          label: p.label,
          person_id: p.person_id,
          organization: p.organization,
          pct: p.pct,
          maxCost: capMap.get(p.party_id) ?? null,
        }))
      )
    } else {
      setAdvancedMode(false)
      const partner = parties.find((p) => p.party_id !== OURS)
      if (partner) {
        setSelectedPerson({ id: partner.person_id!, name: partner.label, organization: partner.organization })
        setTheirPct(String(partner.pct))
      } else {
        setSelectedPerson(null)
        setTheirPct("50")
      }
      setSearch("")
      setMode("pick")
      setNewName("")
    }
    setEditing(true)
  }

  async function handleRemove() {
    if (!data?.config) return
    setRemoving(true)
    try {
      await removeCostSharing(caseId)
      invalidateAfterChange()
      toast.success("Cost sharing removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove cost sharing")
    } finally {
      setRemoving(false)
      setConfirmRemoveOpen(false)
    }
  }

  // Switch from simple editor to advanced — seed the advanced editor with
  // whatever's currently in the simple form.
  function enterAdvancedMode() {
    const caps = data?.config?.phases?.[0]?.caps ?? []
    const capMap = new Map(caps.map((c) => [c.party, c.max_cumulative]))
    const parties: AdvancedPartyDraft[] = [
      { id: OURS, label: "Our Firm", person_id: null, pct: 100 - (parseFloat(theirPct) || 50), maxCost: capMap.get(OURS) ?? null },
    ]
    if (selectedPerson) {
      const pid = partyIdForPerson(selectedPerson.id)
      parties.push({
        id: pid,
        label: selectedPerson.name,
        person_id: selectedPerson.id,
        organization: selectedPerson.organization ?? null,
        pct: parseFloat(theirPct) || 50,
        maxCost: capMap.get(pid) ?? null,
      })
    }
    setAdvancedParties(parties)
    setAdvancedMode(true)
  }

  if (isLoading || !data) return null

  // ---------- Edit mode (advanced) ----------
  if (editing && advancedMode) {
    return (
      <AdvancedEditor
        caseId={caseId}
        parties={advancedParties}
        onPartiesChange={setAdvancedParties}
        coCounselSuggestions={data.co_counsel}
        saving={saving}
        onSave={async (parties) => {
          setSaving(true)
          try {
            const caps: AdvancedCap[] = parties
              .filter((p) => p.maxCost != null && p.maxCost > 0)
              .map((p) => ({ party: p.id, max_cumulative: p.maxCost! }))
            const config: AdvancedConfig = {
              version: 1,
              parties: parties.map((p) => ({
                id: p.id,
                label: p.label,
                person_id: p.person_id ?? null,
                organization: p.organization ?? null,
              })),
              phases: [
                {
                  id: "phase-1",
                  label: "Default",
                  boundary_kind: "open_start",
                  boundary_date: null,
                  shares: parties.map((p) => ({ party: p.id, pct: p.pct })),
                  caps,
                },
              ],
              absorber_party: OURS,
            }
            await setCostSharingConfig(caseId, config)
            invalidateAfterChange()
            toast.success("Cost sharing updated")
            setEditing(false)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to save cost sharing")
          } finally {
            setSaving(false)
          }
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  // ---------- Edit mode (simple) ----------
  if (editing) {
    const searchPersons_ = searchResults?.persons ?? []
    const coCounsel = data.co_counsel
    const coCounselIds = new Set(coCounsel.map((c) => c.person_id))
    const coCounselResults = coCounsel.filter(
      (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
    )
    const otherResults = searchPersons_.filter((p) => !coCounselIds.has(p.id))

    const canSave = mode === "create"
      ? newName.trim().length > 0
      : selectedPerson != null

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
            <button
              type="button"
              onClick={enterAdvancedMode}
              className="text-xs text-muted-foreground hover:text-foreground underline mr-2"
            >
              Advanced...
            </button>
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
              onClick={handleSaveSimple}
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
                      setSelectedPerson({ id: c.person_id, name: c.name, organization: c.organization })
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
                    onClick={() => setSelectedPerson({ id: p.id, name: p.name, organization: p.organization })}
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

  // ---------- View mode ----------
  if (!data.config) return null

  return (
    <div className="flex items-center gap-3 border p-3 text-sm flex-wrap">
      <span className="text-muted-foreground">Cost split:</span>
      {data.parties_with_pct.map((p, idx) => (
        <span key={p.party_id} className="flex items-center gap-1">
          {idx > 0 && <span className="text-muted-foreground mr-2">/</span>}
          <span className="font-medium">{p.label} {p.pct}%</span>
        </span>
      ))}
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={startEditing}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Edit
        </button>
        <button
          onClick={() => setConfirmRemoveOpen(true)}
          disabled={removing}
          className="text-xs text-muted-foreground hover:text-destructive underline disabled:opacity-50"
        >
          {removing ? "Removing..." : "Remove"}
        </button>
      </div>
      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove cost sharing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the cost-sharing configuration. Existing invoices won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Advanced editor — N parties + per-party percent rows.
// Slice 1: parties only. Phases / caps come in later slices.
// ---------------------------------------------------------------------------

function AdvancedEditor({
  parties,
  onPartiesChange,
  coCounselSuggestions,
  saving,
  onSave,
  onCancel,
}: {
  caseId: number
  parties: AdvancedPartyDraft[]
  onPartiesChange: (parties: AdvancedPartyDraft[]) => void
  coCounselSuggestions: { person_id: number; name: string; organization: string | null }[]
  saving: boolean
  onSave: (parties: AdvancedPartyDraft[]) => Promise<void>
  onCancel: () => void
}) {
  const [search, setSearch] = useState("")
  const [pickerOpenForRow, setPickerOpenForRow] = useState<number | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)

  const debouncedSearch = useDebounce(search, 300)
  const { data: searchResults } = useQuery({
    queryKey: ["person-search-advanced", debouncedSearch],
    queryFn: () => searchPersons({ name: debouncedSearch, limit: 10 }),
    enabled: pickerOpenForRow != null && !createMode && debouncedSearch.length >= 2,
  })

  const total = parties.reduce((sum, p) => sum + (Number.isFinite(p.pct) ? p.pct : 0), 0)
  const totalOk = Math.abs(total - 100) < 0.01
  const personPartyIds = new Set(parties.map((p) => p.id))

  function updatePartyPct(idx: number, pct: number) {
    const next = [...parties]
    next[idx] = { ...next[idx], pct }
    onPartiesChange(next)
  }

  function updatePartyCap(idx: number, value: string) {
    const next = [...parties]
    const parsed = parseFloat(value)
    next[idx] = { ...next[idx], maxCost: value === "" ? null : (Number.isFinite(parsed) ? parsed : null) }
    onPartiesChange(next)
  }

  function removeParty(idx: number) {
    if (parties[idx].id === OURS) return
    const next = parties.filter((_, i) => i !== idx)
    onPartiesChange(next)
  }

  function addEmptyPartySlot() {
    setPickerOpenForRow(parties.length)
    setSearch("")
    setCreateMode(false)
    setNewName("")
  }

  async function pickPerson(p: { id: number; name: string; organization?: string | null }) {
    if (pickerOpenForRow == null) return
    const partyId = partyIdForPerson(p.id)
    if (personPartyIds.has(partyId)) {
      toast.error("That person is already a party")
      return
    }
    const next = [...parties]
    if (pickerOpenForRow >= parties.length) {
      next.push({
        id: partyId,
        label: p.name,
        person_id: p.id,
        organization: p.organization ?? null,
        pct: 0,
      })
    } else {
      next[pickerOpenForRow] = {
        ...next[pickerOpenForRow],
        id: partyId,
        label: p.name,
        person_id: p.id,
        organization: p.organization ?? null,
      }
    }
    onPartiesChange(next)
    setPickerOpenForRow(null)
  }

  async function createAndPick() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const result = await createPerson({ name: newName.trim() })
      await pickPerson({ id: result.person.id, name: result.person.name, organization: null })
      setCreateMode(false)
      setNewName("")
    } catch {
      toast.error("Failed to create person")
    } finally {
      setCreating(false)
    }
  }

  const filteredSuggestions = coCounselSuggestions.filter(
    (c) => !personPartyIds.has(partyIdForPerson(c.person_id))
  ).filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredOthers = (searchResults?.persons ?? []).filter(
    (p) => !personPartyIds.has(partyIdForPerson(p.id))
      && !filteredSuggestions.some((c) => c.person_id === p.id)
  )

  return (
    <div className="flex flex-col gap-3 border border-dashed p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Cost-sharing parties</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSave(parties)}
            disabled={saving || !totalOk || parties.length < 2}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {parties.map((p, idx) => (
          <div key={`${p.id}-${idx}`} className="flex items-center gap-2">
            <span className="font-medium w-[200px] truncate">{p.label}</span>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={p.pct}
              onChange={(e) => updatePartyPct(idx, parseFloat(e.target.value) || 0)}
              className="w-[80px] h-8 text-sm text-center"
            />
            <span className="text-muted-foreground shrink-0">%</span>
            {p.id !== OURS && (
              <>
                <span className="text-muted-foreground shrink-0 ml-2">max</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.maxCost ?? ""}
                    onChange={(e) => updatePartyCap(idx, e.target.value)}
                    placeholder="no limit"
                    className="w-[120px] h-8 text-sm pl-5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeParty(idx)}
                  className="text-xs text-muted-foreground hover:text-destructive underline ml-1"
                >
                  remove
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Total + add button */}
      <div className="flex items-center justify-between border-t pt-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Total:</span>{" "}
          <span className={totalOk ? "font-medium" : "font-medium text-destructive"}>
            {total.toFixed(2)}%
          </span>
          {!totalOk && (
            <span className="ml-2 text-destructive">must equal 100%</span>
          )}
        </div>
        <button
          type="button"
          onClick={addEmptyPartySlot}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          + Add co-counsel
        </button>
      </div>

      {/* Picker for the new row */}
      {pickerOpenForRow != null && (
        <div className="flex flex-col gap-2 border p-2">
          <div className="flex items-center gap-2">
            {createMode ? (
              <>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name..."
                  className="h-8 text-sm flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setCreateMode(false)}
                  className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                >
                  Search
                </button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={createAndPick}
                  disabled={creating || !newName.trim()}
                >
                  {creating ? "Adding..." : "Add"}
                </Button>
              </>
            ) : (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="h-8 text-sm flex-1"
                autoFocus
              />
            )}
            <button
              type="button"
              onClick={() => {
                setPickerOpenForRow(null)
                setSearch("")
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
            >
              cancel
            </button>
          </div>
          {!createMode && (
            <div className="max-h-40 overflow-y-auto border divide-y">
              {filteredSuggestions.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/50">
                    Co-counsel on case
                  </div>
                  {filteredSuggestions.map((c) => (
                    <button
                      key={c.person_id}
                      type="button"
                      onClick={() => pickPerson({ id: c.person_id, name: c.name, organization: c.organization })}
                      className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.organization && (
                        <span className="text-muted-foreground">{c.organization}</span>
                      )}
                    </button>
                  ))}
                </>
              )}
              {filteredOthers.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/50">
                    Other contacts
                  </div>
                  {filteredOthers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPerson({ id: p.id, name: p.name, organization: p.organization })}
                      className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent"
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.organization && (
                        <span className="text-muted-foreground">{p.organization}</span>
                      )}
                    </button>
                  ))}
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setCreateMode(true)
                  setNewName(search)
                }}
                className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent text-left"
              >
                + Create new person
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
