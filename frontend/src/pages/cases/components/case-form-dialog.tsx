import { useState, useEffect } from "react"
import type { CaseStatus } from "@/types/case"
import type { CreateCaseData } from "@/services/cases"
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
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CASE_STATUSES: CaseStatus[] = [
  "Signing Up",
  "Prospective",
  "Pre-Claim",
  "Pre-Filing",
  "Pleadings",
  "Discovery",
  "Expert Discovery",
  "Pre-trial",
  "Trial",
  "Post-Trial",
  "Appeal",
  "Settl. Pend.",
  "Stayed",
  "Closed",
]

interface CaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateCaseData) => void
  isPending: boolean
  initialData?: Partial<CreateCaseData>
}

const EMPTY_FORM: CreateCaseData = {
  case_name: "",
  status: "Signing Up",
  short_name: "",
  print_code: "",
  date_of_injury: "",
  case_summary: "",
}

export function CaseFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialData,
}: CaseFormDialogProps) {
  const [form, setForm] = useState<CreateCaseData>(EMPTY_FORM)
  const isEdit = !!initialData

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM)
    }
  }, [open, initialData])

  function set(field: keyof CreateCaseData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: CreateCaseData = { case_name: form.case_name.trim() }
    if (form.status && form.status !== "Signing Up") data.status = form.status
    if (form.short_name?.trim()) data.short_name = form.short_name.trim()
    if (form.print_code?.trim()) data.print_code = form.print_code.trim()
    if (form.date_of_injury?.trim()) data.date_of_injury = form.date_of_injury.trim()
    if (form.case_summary?.trim()) data.case_summary = form.case_summary.trim()
    onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Case" : "New Case"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update case details."
              : "Create a new case. You can add staff, contacts, and proceedings after creation."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="case_name">Case Name *</Label>
            <Input
              id="case_name"
              value={form.case_name}
              onChange={set("case_name")}
              placeholder="Doe v. Smith"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status ?? "Signing Up"}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, status: val }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date of Injury</Label>
              <DatePicker
                value={form.date_of_injury || null}
                onChange={(d) => setForm((f) => ({ ...f, date_of_injury: d ?? "" }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="short_name">Short Name</Label>
              <Input
                id="short_name"
                value={form.short_name}
                onChange={set("short_name")}
                placeholder="Doe"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="print_code">Print Code</Label>
              <Input
                id="print_code"
                value={form.print_code}
                onChange={set("print_code")}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="case_summary">Case Summary</Label>
            <Textarea
              id="case_summary"
              value={form.case_summary}
              onChange={set("case_summary")}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !form.case_name.trim()}>
              {isPending
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
