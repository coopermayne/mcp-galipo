import { useState, useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import { searchPersons, createPerson, assignPersonToCase } from "@/services/persons"
import { getRoles } from "@/services/roles"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatRoleName(name: string) {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

interface AddPersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
  category: string
  roleId?: number | null
}

export function AddPersonDialog({
  open,
  onOpenChange,
  caseId,
  category,
  roleId,
}: AddPersonDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [newPersonName, setNewPersonName] = useState("")
  const [mode, setMode] = useState<"search" | "create">("search")

  const debouncedSearch = useDebounce(search, 300)

  // Fetch roles filtered by category (still needed for fallback display)
  const { data: rolesData } = useQuery({
    queryKey: ["roles", category],
    queryFn: () => getRoles(category),
    enabled: open,
  })

  // Search existing persons
  const { data: searchResults } = useQuery({
    queryKey: ["person-search", debouncedSearch],
    queryFn: () => searchPersons({ name: debouncedSearch, limit: 10 }),
    enabled: open && debouncedSearch.length >= 2,
  })

  const roles = rolesData?.roles ?? []
  const persons = searchResults?.persons ?? []
  const selectedRole = useMemo(
    () => roles.find((r) => String(r.id) === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  )

  // Pre-select role from prop, or auto-select if only one
  useEffect(() => {
    if (roleId) {
      setSelectedRoleId(String(roleId))
    } else if (roles.length === 1 && !selectedRoleId) {
      setSelectedRoleId(String(roles[0].id))
    }
  }, [roleId, roles, selectedRoleId])

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setSearch("")
      setSelectedPersonId(null)
      setSelectedRoleId(roleId ? String(roleId) : "")
      setNewPersonName("")
      setMode("search")
    }
  }, [open, roleId])

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["case", caseId] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
  }

  const assignMutation = useMutation({
    mutationFn: (data: { person_id: number; role_id: number }) =>
      assignPersonToCase(caseId, data),
    onSuccess: () => {
      toast.success("Person assigned to case")
      invalidate()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const createAndAssignMutation = useMutation({
    mutationFn: async () => {
      const result = await createPerson({ name: newPersonName })
      await assignPersonToCase(caseId, {
        person_id: result.person.id,
        role_id: Number(selectedRoleId),
      })
    },
    onSuccess: () => {
      toast.success("Person created and assigned")
      invalidate()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  function handleAssign() {
    if (!selectedPersonId || !selectedRoleId) return
    assignMutation.mutate({
      person_id: selectedPersonId,
      role_id: Number(selectedRoleId),
    })
  }

  function handleCreateAndAssign() {
    if (!newPersonName.trim() || !selectedRoleId) return
    createAndAssignMutation.mutate()
  }

  const isPending = assignMutation.isPending || createAndAssignMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add {selectedRole ? formatRoleName(selectedRole.name) : category.charAt(0).toUpperCase() + category.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Role select — only show if no role was pre-selected */}
          {!roleId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {formatRoleName(r.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "search" ? (
            <>
              {/* Search existing */}
              <div className="space-y-1.5">
                <Label className="text-xs">Search Existing Person</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a name..."
                />
              </div>

              {/* Results */}
              {persons.length > 0 && (
                <div className="max-h-40 overflow-y-auto border divide-y">
                  {persons.map(
                    (p: { id: number; name: string; organization?: string | null }) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPersonId(p.id)}
                        className={`flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent transition-colors ${
                          selectedPersonId === p.id ? "bg-accent" : ""
                        }`}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.organization && (
                          <span className="text-muted-foreground">
                            {p.organization}
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}

              {debouncedSearch.length >= 2 && persons.length === 0 && (
                <p className="text-xs text-muted-foreground">No matches found.</p>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode("create")
                  setNewPersonName(search)
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                + Create new person
              </button>
            </>
          ) : (
            <>
              {/* Create new */}
              <div className="space-y-1.5">
                <Label className="text-xs">New Person Name</Label>
                <Input
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Full name..."
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setMode("search")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Search existing instead
              </button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          {mode === "search" ? (
            <Button
              onClick={handleAssign}
              disabled={!selectedPersonId || !selectedRoleId || isPending}
              size="sm"
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          ) : (
            <Button
              onClick={handleCreateAndAssign}
              disabled={!newPersonName.trim() || !selectedRoleId || isPending}
              size="sm"
            >
              {isPending ? "Creating..." : "Create & Assign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
