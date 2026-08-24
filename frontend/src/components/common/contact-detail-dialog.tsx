import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { useCasePreview } from "@/hooks/use-case-preview"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SmartPhone01Icon,
  Mail01Icon,
  Building06Icon,
  Location01Icon,
  NoteIcon,
  Add01Icon,
  Cancel01Icon,
  Briefcase01Icon,
  MoreHorizontalIcon,
  Delete01Icon,
  PenTool01Icon,
} from "@hugeicons/core-free-icons"
import type { PersonListItem } from "@/types/person"
import type { ContactInfo } from "@/types/person"
import { getPerson, updatePerson, removePersonFromCase, deletePerson } from "@/services/persons"
import { getWorklogByPerson, formatHours } from "@/services/worklog"
import { Button } from "@/components/ui/button"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { getBadgeStyle, getAvatarStyleById } from "@/lib/badge-colors"
import { formatRoleName } from "@/pages/contacts/contact-data"
import { cn } from "@/lib/utils"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface ContactDetailDialogProps {
  person: PersonListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, shows "Remove from case" in the actions menu */
  caseId?: number
  /** Additional query keys to invalidate on mutation success */
  extraInvalidateKeys?: unknown[][]
}

function ContactInfoRow({
  icon,
  items,
  type,
  placeholder,
  onUpdate,
}: {
  icon: typeof SmartPhone01Icon
  items: ContactInfo[]
  type: "phone" | "email"
  placeholder: string
  onUpdate: (items: ContactInfo[]) => void
}) {
  function handleEdit(index: number, newValue: string) {
    if (!newValue.trim()) {
      // Remove the item
      const updated = items.filter((_, i) => i !== index)
      onUpdate(updated)
      return
    }
    const updated = items.map((item, i) =>
      i === index ? { ...item, value: newValue } : item
    )
    onUpdate(updated)
  }

  function handleAdd() {
    onUpdate([...items, { value: "", type: type === "phone" ? "mobile" : "work" }])
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={icon} className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {type === "phone" ? "Phones" : "Emails"}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-0.5 pl-5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1 group/row">
              <InlineEditField
                value={item.value}
                onSave={(v) => handleEdit(i, v)}
                placeholder={placeholder}
                className="text-xs"
              />
              <button
                type="button"
                onClick={() => handleEdit(i, "")}
                className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground pl-5"
      >
        <HugeiconsIcon icon={Add01Icon} className="size-3" />
        Add {type}
      </button>
    </div>
  )
}

function PersonInteractionsSection({
  personId,
  navigate,
  onClose,
}: {
  personId: number
  navigate: ReturnType<typeof useNavigate>
  onClose: () => void
}) {
  const { data } = useQuery({
    queryKey: ["worklog-by-person", personId],
    queryFn: () => getWorklogByPerson(personId),
  })
  const entries = data?.entries ?? []
  if (entries.length === 0) return null

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={PenTool01Icon} className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Interactions
        </span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {formatHours(data?.total_hours ?? 0)}
        </span>
      </div>
      <div className="pl-5 space-y-1">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-start justify-between gap-2 py-1 -mx-2 px-2 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => {
              if (e.case_id) {
                onClose()
                navigate(`/cases/${e.case_id}`)
              }
            }}
          >
            <div className="min-w-0">
              <span className="text-xs">{e.description}</span>
              <p className="text-[11px] text-muted-foreground truncate">
                {(e.short_name || e.case_name) ?? "—"}
                {e.activity_date ? ` · ${e.activity_date}` : ""}
              </p>
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
              {formatHours(e.hours)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ContactDetailDialog({
  person,
  open,
  onOpenChange,
  caseId,
  extraInvalidateKeys,
}: ContactDetailDialogProps) {
  const navigate = useNavigate()
  const { openCasePreview } = useCasePreview()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<"remove" | "delete" | null>(null)

  const { data: detail } = useQuery({
    queryKey: ["person", person?.id],
    queryFn: () => getPerson(person!.id),
    enabled: !!person && open,
  })

  const mutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      updatePerson(person!.id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] })
      queryClient.invalidateQueries({ queryKey: ["person", person?.id] })
      if (extraInvalidateKeys) {
        for (const key of extraInvalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key })
        }
      }
    },
    onError: (e) => toast.error(e.message),
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["persons"] })
    queryClient.invalidateQueries({ queryKey: ["person", person?.id] })
    if (extraInvalidateKeys) {
      for (const key of extraInvalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    }
  }

  const removeFromCaseMutation = useMutation({
    mutationFn: () => removePersonFromCase(caseId!, person!.id),
    onSuccess: () => {
      toast.success("Person removed from case")
      invalidateAll()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const deletePersonMutation = useMutation({
    mutationFn: () => deletePerson(person!.id),
    onSuccess: () => {
      toast.success("Person deleted")
      invalidateAll()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  if (!person) return null

  const d = detail ?? null
  const phones = (d?.phones ?? person.phones ?? []) as ContactInfo[]
  const emails = (d?.emails ?? person.emails ?? []) as ContactInfo[]
  const roles = d?.roles ?? []

  const hasCaseAssignments = roles.some((r) => r.case_id != null)
  const canDelete = !hasCaseAssignments
  const showActionsMenu = caseId != null || canDelete

  // Group roles by case
  const caseRoles = new Map<
    number | null,
    { case_name: string | null; short_name: string | null; color: string | null; roles: typeof roles }
  >()
  for (const role of roles) {
    const key = role.case_id
    if (!caseRoles.has(key)) {
      caseRoles.set(key, {
        case_name: role.case_name,
        short_name: role.short_name,
        color: role.color,
        roles: [],
      })
    }
    caseRoles.get(key)!.roles.push(role)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        {showActionsMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-10"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {caseId != null && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmAction("remove")}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="mr-2 size-4" />
                  Remove from case
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmAction("delete")}
                >
                  <HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
                  Delete person
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <AlertDialog open={confirmAction === "remove"} onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from case?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove {d?.name ?? person.name} from this case. The person will still exist in the system and can be re-added later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeFromCaseMutation.mutate()}
                disabled={removeFromCaseMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeFromCaseMutation.isPending ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmAction === "delete"} onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete person?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {d?.name ?? person.name}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletePersonMutation.mutate()}
                disabled={deletePersonMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletePersonMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center text-sm font-medium"
              style={getAvatarStyleById(person.id)}
            >
              {getInitials(d?.name ?? person.name)}
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">
                <InlineEditField
                  value={d?.name ?? person.name}
                  onSave={(v) => mutation.mutate({ name: v })}
                />
              </DialogTitle>
              <DialogDescription className="text-xs">
                {d?.organization ?? person.organization ?? "No organization"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="-mr-2 mt-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          {/* Organization */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Building06Icon} className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Organization
              </span>
            </div>
            <div className="pl-5">
              <InlineEditField
                value={d?.organization ?? person.organization ?? ""}
                onSave={(v) => mutation.mutate({ organization: v || null })}
                placeholder="No organization"
                className="text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Location01Icon} className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Address
              </span>
            </div>
            <div className="pl-5">
              <InlineEditField
                value={d?.address ?? ""}
                onSave={(v) => mutation.mutate({ address: v || null })}
                placeholder="No address"
                className="text-xs"
              />
            </div>
          </div>

          {/* Phones */}
          <ContactInfoRow
            icon={SmartPhone01Icon}
            items={phones}
            type="phone"
            placeholder="Enter phone"
            onUpdate={(items) => mutation.mutate({ phones: items })}
          />

          {/* Emails */}
          <ContactInfoRow
            icon={Mail01Icon}
            items={emails}
            type="email"
            placeholder="Enter email"
            onUpdate={(items) => mutation.mutate({ emails: items })}
          />

          {/* Notes */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={NoteIcon} className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </span>
            </div>
            <div className="pl-5">
              <InlineEditField
                value={d?.notes ?? person.notes ?? ""}
                onSave={(v) => mutation.mutate({ notes: v || null })}
                type="textarea"
                placeholder="No notes"
                className="text-xs"
              />
            </div>
          </div>

          {/* Interactions (worklog entries naming this person) */}
          <PersonInteractionsSection personId={person.id} navigate={navigate} onClose={() => onOpenChange(false)} />

          {/* Case Assignments */}
          {caseRoles.size > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Briefcase01Icon} className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cases & Roles
                </span>
              </div>
              <div className="space-y-2 pl-5">
                {Array.from(caseRoles.entries()).map(([roleCaseId, group]) => (
                  <div
                    key={roleCaseId ?? "standalone"}
                    className={cn(
                      "flex items-center justify-between gap-2 py-1",
                      roleCaseId != null && "cursor-pointer hover:bg-accent/50 -mx-2 px-2 transition-colors"
                    )}
                    onClick={() => {
                      if (roleCaseId != null) {
                        onOpenChange(false)
                        openCasePreview(roleCaseId)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {group.short_name ? (
                        <Badge
                          className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0"
                          style={getBadgeStyle(group.color)}
                        >
                          {group.short_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {group.case_name ?? "Standalone"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {group.roles.map((r) => (
                        <Badge
                          key={r.assignment_id}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 leading-none"
                        >
                          {formatRoleName(r.role.name)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
