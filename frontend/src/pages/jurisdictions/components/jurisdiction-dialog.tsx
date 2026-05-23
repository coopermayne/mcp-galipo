import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createJurisdiction,
  updateJurisdiction,
  deleteJurisdiction,
  type Jurisdiction,
} from "@/services/jurisdictions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  jurisdiction?: Jurisdiction | null
}

export function JurisdictionDialog({ open, onOpenChange, jurisdiction }: Props) {
  const isEdit = !!jurisdiction
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [localRulesLink, setLocalRulesLink] = useState("")
  const [notes, setNotes] = useState("")
  const [aliases, setAliases] = useState<string[]>([])
  const [aliasInput, setAliasInput] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setName(jurisdiction?.name ?? "")
      setLocalRulesLink(jurisdiction?.local_rules_link ?? "")
      setNotes(jurisdiction?.notes ?? "")
      setAliases(jurisdiction?.aliases ?? [])
      setAliasInput("")
      setConfirmDelete(false)
    }
  }, [open, jurisdiction])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        // On edit, always send all editable fields. Empty strings are sent
        // explicitly so the backend can clear previously-set values.
        return updateJurisdiction(jurisdiction.id, {
          name: name.trim(),
          local_rules_link: localRulesLink.trim() || null,
          notes: notes.trim() || null,
          aliases,
        })
      }
      return createJurisdiction({
        name: name.trim(),
        local_rules_link: localRulesLink.trim() || undefined,
        notes: notes.trim() || undefined,
        aliases,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Jurisdiction updated" : "Jurisdiction created")
      queryClient.invalidateQueries({ queryKey: ["jurisdictions"] })
      onOpenChange(false)
    },
    onError: () => toast.error("Failed to save jurisdiction"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteJurisdiction(jurisdiction!.id),
    onSuccess: () => {
      toast.success("Jurisdiction deleted")
      queryClient.invalidateQueries({ queryKey: ["jurisdictions"] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
  })

  function addAlias() {
    const val = aliasInput.trim()
    if (val && !aliases.includes(val)) {
      setAliases([...aliases, val])
    }
    setAliasInput("")
  }

  function removeAlias(alias: string) {
    setAliases(aliases.filter((a) => a !== alias))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    saveMutation.mutate()
  }

  const canDelete = isEdit && jurisdiction.judge_count === 0 && jurisdiction.proceeding_count === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Jurisdiction" : "Add Jurisdiction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="jur-name">Name</Label>
            <Input
              id="jur-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Los Angeles Superior Court"
            />
          </div>
          <div>
            <Label htmlFor="jur-link">Local Rules Link</Label>
            <Input
              id="jur-link"
              value={localRulesLink}
              onChange={(e) => setLocalRulesLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label htmlFor="jur-notes">Notes</Label>
            <Textarea
              id="jur-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Aliases</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Short names used for fuzzy matching during case import
            </p>
            <div className="flex gap-2">
              <Input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addAlias()
                  }
                }}
                placeholder="e.g. LASC"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addAlias}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </Button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {aliases.map((alias) => (
                  <Badge
                    key={alias}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/15 hover:text-destructive transition-colors"
                    onClick={() => removeAlias(alias)}
                  >
                    {alias} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {isEdit && (
              <div>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive">Delete?</span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Confirm"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    disabled={!canDelete}
                    title={!canDelete ? "Cannot delete — jurisdiction has linked judges or proceedings" : undefined}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !name.trim()}>
                {saveMutation.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
