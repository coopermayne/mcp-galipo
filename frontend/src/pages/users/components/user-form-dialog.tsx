import { useState, useEffect } from "react"
import type { User, UserPosition, FeatureKey } from "@/types/user"
import { FEATURE_OPTIONS } from "@/types/user"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  paralegals: User[]
  onSubmit: (data: Record<string, unknown>) => void
  isPending: boolean
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  initials: "",
  position: "paralegal" as UserPosition,
  barNumber: "",
  paralegalId: null as number | null,
  isAdmin: false,
  visibleFeatures: null as FeatureKey[] | null,
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  paralegals,
  onSubmit,
  isPending,
}: UserFormDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const isEditing = user !== null

  useEffect(() => {
    if (open) {
      if (user) {
        setForm({
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email,
          initials: user.initials ?? "",
          position: user.position ?? "paralegal",
          barNumber: user.barNumber ?? "",
          paralegalId: user.paralegalId,
          isAdmin: user.isAdmin,
          visibleFeatures: user.visibleFeatures,
        })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, user])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      initials: form.initials,
      position: form.position,
      isAdmin: form.isAdmin,
      visibleFeatures: form.visibleFeatures,
    }
    if (form.position === "attorney") {
      data.barNumber = form.barNumber || null
      data.paralegalId = form.paralegalId
    } else {
      data.barNumber = null
      data.paralegalId = null
    }
    if (!isEditing) {
      data.mustChangePassword = true
    }
    onSubmit(data)
  }

  function toggleFeature(feature: FeatureKey) {
    setForm((prev) => {
      const current = prev.visibleFeatures ?? FEATURE_OPTIONS.map((f) => f.value)
      const next = current.includes(feature)
        ? current.filter((f) => f !== feature)
        : [...current, feature]
      return { ...prev, visibleFeatures: next.length === FEATURE_OPTIONS.length ? null : next }
    })
  }

  const effectiveFeatures = form.visibleFeatures ?? FEATURE_OPTIONS.map((f) => f.value)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit User" : "Add User"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update user details and permissions."
              : "Create a new user. Default password will be 'changeme'."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_5rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="initials">Initials</Label>
              <Input
                id="initials"
                value={form.initials}
                onChange={(e) =>
                  setForm((f) => ({ ...f, initials: e.target.value }))
                }
                maxLength={4}
                required
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Position</Label>
            <Select
              value={form.position}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, position: v as UserPosition }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attorney">Attorney</SelectItem>
                <SelectItem value="paralegal">Paralegal</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.position === "attorney" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="barNumber">Bar Number</Label>
                <Input
                  id="barNumber"
                  value={form.barNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, barNumber: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Default Paralegal</Label>
                <Select
                  value={form.paralegalId?.toString() ?? "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      paralegalId: v === "none" ? null : Number(v),
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {paralegals.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {[p.firstName, p.lastName].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="isAdmin"
              checked={form.isAdmin}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isAdmin: checked === true }))
              }
            />
            <Label htmlFor="isAdmin">Administrator</Label>
          </div>

          <div className="grid gap-1.5">
            <Label>Visible Features</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {FEATURE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`feature-${opt.value}`}
                    checked={effectiveFeatures.includes(opt.value)}
                    onCheckedChange={() => toggleFeature(opt.value)}
                  />
                  <Label
                    htmlFor={`feature-${opt.value}`}
                    className="text-xs font-normal"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
