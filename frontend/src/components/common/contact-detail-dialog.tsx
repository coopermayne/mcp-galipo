import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
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
  Message01Icon,
} from "@hugeicons/core-free-icons"
import type { PersonListItem } from "@/types/person"
import type { ContactInfo } from "@/types/person"
import { getPerson, updatePerson } from "@/services/persons"
import { getConversationsByPerson, createConversation } from "@/services/sms"
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

function PersonSmsSection({
  personId,
  phones,
  navigate,
  onClose,
}: {
  personId: number
  phones: ContactInfo[]
  navigate: ReturnType<typeof useNavigate>
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: smsData } = useQuery({
    queryKey: ["sms", "by-person", personId],
    queryFn: () => getConversationsByPerson(personId),
  })

  const startSmsMutation = useMutation({
    mutationFn: (phone: string) =>
      createConversation(phone, undefined, undefined, personId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sms"] })
      onClose()
      navigate(`/sms/${result.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const conversations = smsData?.conversations ?? []
  const primaryPhone = phones[0]?.value

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={Message01Icon} className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          SMS
        </span>
      </div>
      <div className="pl-5 space-y-1">
        {conversations.length > 0 ? (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center justify-between py-1 cursor-pointer hover:bg-accent/50 -mx-2 px-2 transition-colors"
              onClick={() => {
                onClose()
                navigate(`/sms/${conv.id}`)
              }}
            >
              <div className="min-w-0">
                <span className="text-xs font-medium">{conv.label || conv.phone_number}</span>
                {conv.last_message_preview && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {conv.last_message_preview}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : primaryPhone ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => startSmsMutation.mutate(primaryPhone)}
            disabled={startSmsMutation.isPending}
          >
            <HugeiconsIcon icon={Message01Icon} className="size-3 mr-1" />
            {startSmsMutation.isPending ? "Starting..." : "Start SMS Conversation"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No phone number to text</span>
        )}
      </div>
    </div>
  )
}

export function ContactDetailDialog({
  person,
  open,
  onOpenChange,
  extraInvalidateKeys,
}: ContactDetailDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

  if (!person) return null

  const d = detail ?? null
  const phones = (d?.phones ?? person.phones ?? []) as ContactInfo[]
  const emails = (d?.emails ?? person.emails ?? []) as ContactInfo[]
  const roles = d?.roles ?? []

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
      <DialogContent className="sm:max-w-lg">
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

        <div className="space-y-4 mt-2">
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

          {/* SMS */}
          <PersonSmsSection personId={person.id} phones={phones} navigate={navigate} onClose={() => onOpenChange(false)} />

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
                {Array.from(caseRoles.entries()).map(([caseId, group]) => (
                  <div
                    key={caseId ?? "standalone"}
                    className={cn(
                      "flex items-center justify-between gap-2 py-1",
                      caseId != null && "cursor-pointer hover:bg-accent/50 -mx-2 px-2 transition-colors"
                    )}
                    onClick={() => {
                      if (caseId != null) {
                        onOpenChange(false)
                        navigate(`/cases/${caseId}`)
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
