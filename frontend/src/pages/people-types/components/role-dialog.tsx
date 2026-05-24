import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createRole, updateRole, deleteRole, type Role } from "@/services/roles"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"

const CATEGORIES = [
  { value: "client", label: "Client" },
  { value: "counsel", label: "Counsel" },
  { value: "defendant", label: "Defendant" },
  { value: "expert", label: "Expert" },
  { value: "mediator", label: "Mediator" },
  { value: "other", label: "Other" },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: Role | null
  defaultCategory?: string
}

export function RoleDialog({ open, onOpenChange, role, defaultCategory }: Props) {
  const isEdit = !!role
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "")
      setCategory(role?.category ?? defaultCategory ?? "other")
      setDescription(role?.description ?? "")
      setConfirmDelete(false)
    }
  }, [open, role, defaultCategory])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return updateRole(role.id, {
          name: name.trim(),
          category,
          description: description.trim() || undefined,
        })
      }
      return createRole({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? "Role updated" : "Role created")
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save role"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRole(role!.id),
    onSuccess: () => {
      toast.success("Role deleted")
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete"),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    saveMutation.mutate()
  }

  const canDelete = isEdit && !role.is_system && (role.usage_count ?? 0) === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Role" : "Add Role"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. insurance_adjuster"
              disabled={isEdit && role?.is_system}
            />
            {isEdit && role?.is_system && (
              <p className="text-xs text-muted-foreground mt-1">
                System roles cannot be renamed.
              </p>
            )}
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isEdit && role?.is_system}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="role-desc">Description</Label>
            <Textarea
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
            />
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {isEdit && !role.is_system && (
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
                    title={
                      !canDelete && (role.usage_count ?? 0) > 0
                        ? `Cannot delete — role is assigned to ${role.usage_count} person(s)`
                        : undefined
                    }
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
              <Button
                type="submit"
                disabled={saveMutation.isPending || !name.trim() || (isEdit && role?.is_system && name === role.name && category === role.category && description === (role.description ?? ""))}
              >
                {saveMutation.isPending ? "Saving..." : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
