import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon, Loading03Icon } from "@hugeicons/core-free-icons"
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { extractIntakeFields, type CreateIntakeData } from "@/services/intakes"

interface IntakeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateIntakeData) => void
  isPending: boolean
}

const EMPTY_FORM: CreateIntakeData = {
  name: "",
  email: "",
  phone: "",
  contact_relationship: "",
  referral_name: "",
  referral_org: "",
  referral_email: "",
  referral_phone: "",
  case_type: "",
  incident_date: "",
  incident_time: "",
  location: "",
  incident_description: "",
  injury_description: "",
  notes: "",
}

export function IntakeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: IntakeFormDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [pasteText, setPasteText] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setPasteText("")
      setExtractError(null)
    }
  }, [open])

  function set(field: keyof CreateIntakeData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleExtract() {
    if (!pasteText.trim()) return
    setIsExtracting(true)
    setExtractError(null)
    try {
      const { fields } = await extractIntakeFields(pasteText)
      setForm((prev) => {
        const merged = { ...prev }
        for (const [key, value] of Object.entries(fields)) {
          if (value) {
            merged[key as keyof CreateIntakeData] = value
          }
        }
        return merged
      })
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed")
    } finally {
      setIsExtracting(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Only send non-empty fields
    const data: CreateIntakeData = {}
    for (const [key, value] of Object.entries(form)) {
      if (value && typeof value === "string" && value.trim()) {
        data[key as keyof CreateIntakeData] = value.trim()
      }
    }
    onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Intake</DialogTitle>
          <DialogDescription>
            Paste an email or phone notes to auto-extract fields, or fill in
            manually.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="max-h-[70vh] overflow-y-auto space-y-4 pr-1"
        >
          {/* AI Extraction */}
          <div className="space-y-2">
            <Label htmlFor="pasteText">Paste raw text</Label>
            <Textarea
              id="pasteText"
              placeholder="Paste an email, phone notes, referral letter..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtract}
                disabled={isExtracting || !pasteText.trim()}
              >
                {isExtracting ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="mr-2 size-4 animate-spin"
                  />
                ) : (
                  <HugeiconsIcon icon={SparklesIcon} className="mr-2 size-4" />
                )}
                {isExtracting ? "Extracting..." : "Extract Fields"}
              </Button>
              {extractError && (
                <span className="text-destructive text-xs">{extractError}</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Contact</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={set("name")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contact_relationship">Relationship</Label>
                <Input
                  id="contact_relationship"
                  placeholder="Self, Spouse, Parent..."
                  value={form.contact_relationship}
                  onChange={set("contact_relationship")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>
          </fieldset>

          <Separator />

          {/* Referral Info */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Referral</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="referral_name">Referral Name</Label>
                <Input
                  id="referral_name"
                  value={form.referral_name}
                  onChange={set("referral_name")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="referral_org">Organization</Label>
                <Input
                  id="referral_org"
                  value={form.referral_org}
                  onChange={set("referral_org")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="referral_email">Referral Email</Label>
                <Input
                  id="referral_email"
                  type="email"
                  value={form.referral_email}
                  onChange={set("referral_email")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="referral_phone">Referral Phone</Label>
                <Input
                  id="referral_phone"
                  type="tel"
                  value={form.referral_phone}
                  onChange={set("referral_phone")}
                />
              </div>
            </div>
          </fieldset>

          <Separator />

          {/* Incident Info */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Incident</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="case_type">Case Type</Label>
                <Input
                  id="case_type"
                  placeholder="Auto Accident, Slip and Fall..."
                  value={form.case_type}
                  onChange={set("case_type")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="incident_date">Date</Label>
                <Input
                  id="incident_date"
                  type="date"
                  value={form.incident_date}
                  onChange={set("incident_date")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="incident_time">Time</Label>
                <Input
                  id="incident_time"
                  value={form.incident_time}
                  onChange={set("incident_time")}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={set("location")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="incident_description">Incident Description</Label>
              <Textarea
                id="incident_description"
                value={form.incident_description}
                onChange={set("incident_description")}
                rows={3}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="injury_description">Injury Description</Label>
              <Textarea
                id="injury_description"
                value={form.injury_description}
                onChange={set("injury_description")}
                rows={2}
              />
            </div>
          </fieldset>

          <Separator />

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={set("notes")}
              rows={2}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Intake"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
