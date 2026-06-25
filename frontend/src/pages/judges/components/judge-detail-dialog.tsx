import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useCasePreview } from "@/hooks/use-case-preview"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SmartPhone01Icon,
  Mail01Icon,
  Location01Icon,
  NoteIcon,
  Add01Icon,
  Cancel01Icon,
  Briefcase01Icon,
  Building06Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import type { JudgeListItem, ContactInfo } from "@/services/judges"
import { getJudge, updateJudge, deleteJudge } from "@/services/judges"
import { getJurisdictions } from "@/services/jurisdictions"
import { InlineEditField } from "@/components/common/inline-edit-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getAvatarStyleById } from "@/lib/badge-colors"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface JudgeDetailDialogProps {
  judge: JudgeListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

function FieldRow({
  icon,
  label,
  value,
  onSave,
  placeholder,
  type,
}: {
  icon: typeof SmartPhone01Icon
  label: string
  value: string
  onSave: (v: string) => void
  placeholder?: string
  type?: "text" | "textarea"
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={icon} className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="pl-5">
        <InlineEditField
          value={value}
          onSave={onSave}
          placeholder={placeholder ?? `No ${label.toLowerCase()}`}
          className="text-xs"
          type={type}
        />
      </div>
    </div>
  )
}

export function JudgeDetailDialog({
  judge,
  open,
  onOpenChange,
}: JudgeDetailDialogProps) {
  const { openCasePreview } = useCasePreview()
  const queryClient = useQueryClient()

  const { data: detail } = useQuery({
    queryKey: ["judge", judge?.id],
    queryFn: () => getJudge(judge!.id),
    enabled: !!judge && open,
  })

  const mutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      updateJudge(judge!.id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["judges"] })
      queryClient.invalidateQueries({ queryKey: ["judge", judge?.id] })
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteJudge(judge!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["judges"] })
      onOpenChange(false)
      toast.success("Judge deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: jurisdictionsData } = useQuery({
    queryKey: ["jurisdictions"],
    queryFn: async () => {
      const res = await getJurisdictions()
      return res.jurisdictions
    },
    enabled: open,
  })

  if (!judge) return null

  const d = detail ?? null
  const phones = (d?.phones ?? judge.phones ?? []) as ContactInfo[]
  const emails = (d?.emails ?? judge.emails ?? []) as ContactInfo[]
  const proceedings = d?.proceedings ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center text-sm font-medium"
              style={getAvatarStyleById(judge.id)}
            >
              {getInitials(d?.name ?? judge.name)}
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">
                <InlineEditField
                  value={d?.name ?? judge.name}
                  onSave={(v) => mutation.mutate({ name: v })}
                />
              </DialogTitle>
              <DialogDescription className="text-xs">
                {d?.title ?? judge.title ?? "Judge"}
                {(d?.jurisdiction_name ?? judge.jurisdiction_name) &&
                  ` · ${d?.jurisdiction_name ?? judge.jurisdiction_name}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Title */}
          <FieldRow
            icon={UserIcon}
            label="Title"
            value={d?.title ?? judge.title ?? ""}
            onSave={(v) => mutation.mutate({ title: v || null })}
            placeholder="No title"
          />

          {/* Jurisdiction */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Location01Icon} className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Jurisdiction
              </span>
            </div>
            <div className="pl-5">
              <Select
                value={String(d?.jurisdiction_id ?? judge.jurisdiction_id ?? "")}
                onValueChange={(v) =>
                  mutation.mutate({ jurisdiction_id: v === "__none__" ? null : Number(v) })
                }
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder="No jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs text-muted-foreground">
                    None
                  </SelectItem>
                  {(jurisdictionsData ?? []).map((j) => (
                    <SelectItem key={j.id} value={String(j.id)} className="text-xs">
                      {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chambers */}
          <FieldRow
            icon={Building06Icon}
            label="Chambers"
            value={d?.chambers ?? judge.chambers ?? ""}
            onSave={(v) => mutation.mutate({ chambers: v || null })}
            placeholder="No chambers"
          />

          {/* Courtroom */}
          <FieldRow
            icon={Building06Icon}
            label="Courtroom"
            value={d?.courtroom_number ?? judge.courtroom_number ?? ""}
            onSave={(v) => mutation.mutate({ courtroom_number: v || null })}
            placeholder="No courtroom"
          />

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
          <FieldRow
            icon={NoteIcon}
            label="Notes"
            value={d?.notes ?? judge.notes ?? ""}
            onSave={(v) => mutation.mutate({ notes: v || null })}
            placeholder="No notes"
            type="textarea"
          />

          {/* Proceeding Assignments */}
          {proceedings.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Briefcase01Icon} className="size-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Proceedings
                </span>
              </div>
              <div className="space-y-1 pl-5">
                {proceedings.map((p) => (
                  <div
                    key={p.proceeding_id}
                    className="flex items-center justify-between gap-2 py-1 cursor-pointer hover:bg-accent/50 -mx-2 px-2 transition-colors"
                    onClick={() => {
                      onOpenChange(false)
                      openCasePreview(p.case_id)
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs truncate">
                        {p.short_name ?? p.case_name}
                      </span>
                      {p.case_number && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {p.case_number}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 leading-none shrink-0"
                    >
                      {p.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Judge"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
